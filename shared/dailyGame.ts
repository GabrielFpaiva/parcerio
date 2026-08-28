/**
 * O produto inteiro vive em America/Sao_Paulo, que não tem horário de verão
 * desde 2019 — por isso o offset é constante e não precisa de biblioteca.
 * Este mesmo número aparece literal em firestore.rules; se um mudar, o outro
 * tem que mudar junto.
 */
export const SP_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Precisa bater com gameCatalogSize() em firestore.rules. */
export const GAME_CATALOG_SIZE = 120;

/** Dias inteiros desde a época, contados a partir da meia-noite de São Paulo. */
export function dayNumber(nowMs: number): number {
  return Math.floor((nowMs - SP_UTC_OFFSET_MS) / MS_PER_DAY);
}

/**
 * O módulo é escrito duas vezes porque `%` em JS devolve negativo para
 * entrada negativa, e datas antes da época existem em teste.
 */
export function questionIndexFor(day: number, catalogSize = GAME_CATALOG_SIZE): number {
  return ((day % catalogSize) + catalogSize) % catalogSize;
}

/** Id do documento da rodada: legível por humano e ordenável por range. */
export function gameDateId(nowMs: number): string {
  return new Date(nowMs - SP_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * XP da RODADA, não do votante: numa Super Parceria de 6, seis votos não
 * valem 36. Sem isso o teto diário de 15 seria estourado por qualquer grupo
 * com mais de dois membros, e grupo grande ganharia por ser grande.
 */
export const GAME_XP = {
  PARTIAL: 6,
  COMPLETE: 15,
} as const;

export interface RoundState {
  voterCount: number;
  memberCount: number;
  roundDayNumber: number;
}

/**
 * Fechamento é derivado, nunca escrito por um job: não há Cloud Functions.
 * Mesma estratégia do decaimento preguiçoso da Temperatura.
 */
export function isRoundClosed(round: RoundState, nowMs: number): boolean {
  return round.voterCount >= round.memberCount || dayNumber(nowMs) > round.roundDayNumber;
}

export function xpForRound(voterCount: number, memberCount: number): number {
  return voterCount >= memberCount ? GAME_XP.COMPLETE : GAME_XP.PARTIAL;
}

/** `votes` é votante → votado. A saída é o votado com quantos votos recebeu. */
export function tallyVotes(votes: Record<string, string>): Array<{ uid: string; count: number }> {
  const counts = new Map<string, number>();
  for (const votedFor of Object.values(votes)) {
    counts.set(votedFor, (counts.get(votedFor) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([uid, count]) => ({ uid, count }))
    .sort((a, b) => b.count - a.count || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}
