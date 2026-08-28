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

import { GAME_XP, MS_PER_DAY, isRoundClosed, tallyVotes, xpForRound } from '../dailyGame';

const NA_VIRADA_2 = Date.UTC(2026, 7, 28, 3, 0, 0);
const DIA_DA_RODADA = dayNumber(NA_VIRADA_2);

describe('isRoundClosed', () => {
  const rodada = (voterCount: number, memberCount: number) => ({
    voterCount,
    memberCount,
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
});

describe('xpForRound', () => {
  it('vale 6 enquanto está parcial', () => {
    expect(xpForRound(1, 5)).toBe(GAME_XP.PARTIAL);
    expect(xpForRound(4, 5)).toBe(GAME_XP.PARTIAL);
  });

  it('vale 15 quando todos votaram', () => {
    expect(xpForRound(5, 5)).toBe(GAME_XP.COMPLETE);
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
