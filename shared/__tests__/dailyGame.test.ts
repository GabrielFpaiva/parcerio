import {
  dayNumber,
  gameDateId,
  questionIndexFor,
  GAME_CATALOG_SIZE,
} from '../dailyGame';

// 2026-08-28T02:59:59Z é 27/08 23:59:59 em São Paulo — ainda o dia 27.
const ANTES_DA_VIRADA = Date.UTC(2026, 7, 28, 2, 59, 59);
// 2026-08-28T03:00:00Z é 28/08 00:00:00 em São Paulo.
const NA_VIRADA = Date.UTC(2026, 7, 28, 3, 0, 0);

describe('dayNumber', () => {
  it('vira na meia-noite de São Paulo, não na de UTC', () => {
    expect(dayNumber(NA_VIRADA)).toBe(dayNumber(ANTES_DA_VIRADA) + 1);
  });

  it('não vira na meia-noite UTC', () => {
    // 00:00Z do dia 28 ainda é 21h do dia 27 em São Paulo.
    const meiaNoiteUtc = Date.UTC(2026, 7, 28, 0, 0, 0);
    expect(dayNumber(meiaNoiteUtc)).toBe(dayNumber(ANTES_DA_VIRADA));
  });

  it('avança de um em um a cada 24h', () => {
    expect(dayNumber(NA_VIRADA + 86_400_000)).toBe(dayNumber(NA_VIRADA) + 1);
  });
});

describe('questionIndexFor', () => {
  it('fica dentro do catálogo', () => {
    for (const dia of [0, 1, 119, 120, 121, 5000]) {
      const i = questionIndexFor(dia, 120);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(120);
    }
  });

  it('cicla no tamanho do catálogo', () => {
    expect(questionIndexFor(120, 120)).toBe(questionIndexFor(0, 120));
  });

  it('dias consecutivos dão perguntas diferentes', () => {
    expect(questionIndexFor(41, 120)).not.toBe(questionIndexFor(42, 120));
  });

  it('usa GAME_CATALOG_SIZE quando o tamanho não é passado', () => {
    expect(questionIndexFor(7)).toBe(questionIndexFor(7, GAME_CATALOG_SIZE));
  });
});

describe('gameDateId', () => {
  it('usa a data de São Paulo, não a de UTC', () => {
    expect(gameDateId(ANTES_DA_VIRADA)).toBe('2026-08-27');
    expect(gameDateId(NA_VIRADA)).toBe('2026-08-28');
  });
});

import { GAME_XP, MS_PER_DAY, SP_UTC_OFFSET_MS, isRoundClosed, tallyVotes, xpForRound } from '../dailyGame';

const NA_VIRADA_2 = Date.UTC(2026, 7, 28, 3, 0, 0);
const DIA_DA_RODADA = dayNumber(NA_VIRADA_2);

describe('isRoundClosed', () => {
  // members/voterUids são identidades, não contagens — mesma forma que
  // roundClosed() usa nas regras (hasAll). `membros(n)` gera n uids
  // sintéticos; `rodada` monta o RoundState a partir de quantos deles já
  // votaram, na ordem, só para os testes que ainda pensam em quórum.
  const membros = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
  const rodada = (voterCount: number, memberCount: number) => ({
    voterUids: membros(memberCount).slice(0, voterCount),
    members: membros(memberCount),
    roundDayNumber: DIA_DA_RODADA,
  });

  it('fecha quando todos votaram, no mesmo dia', () => {
    expect(isRoundClosed(rodada(4, 4), NA_VIRADA_2)).toBe(true);
  });

  it('fica aberta faltando exatamente uma pessoa', () => {
    expect(isRoundClosed(rodada(3, 4), NA_VIRADA_2)).toBe(false);
  });

  it('fecha na virada do dia mesmo faltando gente', () => {
    expect(isRoundClosed(rodada(1, 4), NA_VIRADA_2 + MS_PER_DAY)).toBe(true);
  });

  it('continua aberta às 23:59:59 do próprio dia', () => {
    const quaseVirada = NA_VIRADA_2 + MS_PER_DAY - 1000;
    expect(isRoundClosed(rodada(1, 4), quaseVirada)).toBe(false);
  });

  it('NÃO fecha por um uid de quem já saiu do grupo — containment, não contagem', () => {
    // Finding 2: a rodada carrega ['alice', 'bob', 'saiu'] em voterUids —
    // 'saiu' votou e depois deixou o grupo. members hoje é só
    // ['alice', 'bob', 'carol']. Contar bateria 3 >= 3 e fecharia a rodada
    // sem a Carol ter votado; a versão antiga (voterCount/memberCount) dizia
    // isso. hasAll nega, porque 'carol' não está em voterUids — é o mesmo
    // caso que o comentário de roundClosed() nas regras descreve.
    const round = {
      voterUids: ['alice', 'bob', 'saiu'],
      members: ['alice', 'bob', 'carol'],
      roundDayNumber: DIA_DA_RODADA,
    };
    expect(isRoundClosed(round, NA_VIRADA_2)).toBe(false);
  });
});

describe('xpForRound', () => {
  it('vale 6 enquanto está parcial', () => {
    // Literal, não GAME_XP.PARTIAL: comparar a constante com ela mesma
    // passaria com qualquer valor. Ver describe de constantes duplicadas
    // mais abaixo, que é quem realmente prende esse número.
    expect(xpForRound(1, 5)).toBe(6);
    expect(xpForRound(4, 5)).toBe(6);
  });

  it('vale 15 quando todos votaram', () => {
    expect(xpForRound(5, 5)).toBe(15);
  });

  it('não cresce com o tamanho do grupo — 8 votos valem o mesmo que 3', () => {
    // Este é o teste que segura a tese: grupo grande não ganha mais por ser grande.
    expect(xpForRound(8, 8)).toBe(xpForRound(3, 3));
  });
});

describe('tallyVotes', () => {
  it('conta e ordena do mais votado para o menos', () => {
    const r = tallyVotes({ a: 'x', b: 'x', c: 'y' });
    expect(r).toEqual([
      { uid: 'x', count: 2 },
      { uid: 'y', count: 1 },
    ]);
  });

  it('desempata por uid, para a ordem não piscar entre renderizações', () => {
    expect(tallyVotes({ a: 'z', b: 'm' })).toEqual([
      { uid: 'm', count: 1 },
      { uid: 'z', count: 1 },
    ]);
  });

  it('devolve lista vazia quando ninguém votou', () => {
    expect(tallyVotes({})).toEqual([]);
  });
});

describe('constantes duplicadas em firestore.rules', () => {
  // Estes números existem duas vezes: aqui e como literal nas regras, que
  // não conseguem importar TypeScript. O teste afirma o literal, nunca a
  // própria constante — `toBe(GAME_XP.PARTIAL)` passaria com qualquer valor.

  it('SP_UTC_OFFSET_MS bate com o 10800000 de todayNumber() e todayId()', () => {
    expect(SP_UTC_OFFSET_MS).toBe(10_800_000);
  });

  it('GAME_CATALOG_SIZE bate com gameCatalogSize()', () => {
    expect(GAME_CATALOG_SIZE).toBe(120);
  });

  it('GAME_XP bate com gameXp()', () => {
    expect(GAME_XP.PARTIAL).toBe(6);
    expect(GAME_XP.COMPLETE).toBe(15);
  });
});
