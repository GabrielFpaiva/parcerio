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
