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
