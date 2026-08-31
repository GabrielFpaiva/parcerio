import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { MS_PER_DAY, SP_UTC_OFFSET_MS } from '../../shared/dailyGame';

export const ALICE = 'alice-uid';
export const BOB = 'bob-uid';
export const CAROL = 'carol-uid';

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'parceria-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}

// Duplicado de propósito em relação a shared/types.ts (INITIAL_USER_STATS) e
// à função zeroStats() em firestore.rules: os três precisam bater
// exatamente. Se alguém mudar um sem os outros, o teste de criação de
// perfil quebra — isso é o comportamento desejado, não um bug.
export const INITIAL_STATS = {
  partnershipCount: 0,
  totalXParceria: 0,
  totalEncounters: 0,
  daysUsing: 0,
  strongestPartnershipId: null,
};

// A regra lê request.time no instante da escrita; os testes de rodada leem
// Date.now() no processo do teste (hoje()/hojeNum()). Nenhum dos dois
// enxerga o relógio do outro — perto da virada de São Paulo (03:00 UTC) os
// dois podem discordar sobre qual dia é, e a suíte fica verde ou vermelha
// por sorte, uma vez por dia. Em vez de tentar sincronizar os dois
// relógios, evita a janela: se "agora" está a poucos segundos da virada,
// dorme até passar dela antes do teste prosseguir. Relógio e sleep são
// injetáveis para o teste em helpers.test.ts não depender da virada real
// acontecer.
const MARGEM_DA_VIRADA_MS = 10_000;
const FOLGA_APOS_VIRADA_MS = 500;

export function msAteViradaDeSaoPaulo(nowMs: number): number {
  const msDesdeVirada = ((nowMs - SP_UTC_OFFSET_MS) % MS_PER_DAY + MS_PER_DAY) % MS_PER_DAY;
  return MS_PER_DAY - msDesdeVirada;
}

export async function evitarViradaDeDia(
  nowMs: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<void> {
  const ateVirada = msAteViradaDeSaoPaulo(nowMs());
  if (ateVirada < MARGEM_DA_VIRADA_MS) {
    await sleep(ateVirada + FOLGA_APOS_VIRADA_MS);
  }
}

export function validProfile(uid: string, handle: string) {
  return {
    uid,
    displayName: 'Alguém',
    handle,
    photoURL: null,
    avatarEmoji: '🦊',
    timezone: 'America/Sao_Paulo',
    stats: INITIAL_STATS,
    settings: {
      shareLocation: true,
      ritualHour: 19,
      notifications: { ritual: true, challenges: true, encounters: true },
    },
  };
}
