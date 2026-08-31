import { TEMPERATURE, XP } from './constants';
import { xpForNextLevel } from './level';
import { bandForTemperature } from './temperature';
import {
  ACHIEVEMENT_FIRST_PARTNERSHIP,
  type MemberProfile,
  type PartnershipDoc,
  type TemperatureBandId,
} from './types';

/** O que o construtor devolve: tudo menos os campos de relógio. */
export type BirthPartnership = Omit<PartnershipDoc, 'createdAt' | 'activatedAt' | 'updatedAt'>;

export interface BirthInput {
  inviter: { uid: string; profile: MemberProfile };
  accepter: { uid: string; profile: MemberProfile };
  inviteCode: string;
}

export interface ReactivationUpdate {
  status: 'active';
  temperature: number;
  temperatureBand: TemperatureBandId;
  memberProfiles: Record<string, MemberProfile>;
  bornFromInvite: string;
}

/**
 * Id determinístico: duas pessoas se convidando ao mesmo tempo geram o mesmo
 * documento, e a segunda escrita falha sozinha. Sem transação de deduplicação.
 */
export function partnershipId(a: string, b: string): string {
  if (a === b) throw new Error('Parceria exige duas pessoas, não a mesma pessoa duas vezes.');
  return [a, b].sort().join('_');
}

export function buildBirthPartnership({
  inviter,
  accepter,
  inviteCode,
}: BirthInput): BirthPartnership {
  const id = partnershipId(inviter.uid, accepter.uid);
  const members = [inviter.uid, accepter.uid].sort() as [string, string];
  const temperature = TEMPERATURE.INITIAL;

  return {
    id,
    members,
    memberProfiles: {
      [inviter.uid]: inviter.profile,
      [accepter.uid]: accepter.profile,
    },
    status: 'active',
    createdBy: inviter.uid,
    bornFromInvite: inviteCode,
    xparceria: XP.PARTNERSHIP_BORN,
    level: 1,
    xpIntoLevel: XP.PARTNERSHIP_BORN,
    xpForNextLevel: xpForNextLevel(1),
    temperature,
    temperatureBand: bandForTemperature(temperature).id,
    streak: { current: 0, longest: 0, lastDay: null, freezesLeft: 2 },
    stats: {
      encounterCount: 0,
      totalMinutesTogether: 0,
      lastEncounterAt: null,
      daysSinceLastEncounter: 0,
      firstEncounterAt: null,
      longestEncounterMinutes: 0,
      maxDistanceKm: 0,
      placesVisited: 0,
    },
    achievements: [ACHIEVEMENT_FIRST_PARTNERSHIP],
    superPartnershipId: null,
  };
}

/**
 * Reaceite de parceria encerrada. XParceria, nível, conquistas e timeline
 * ficam intactos — "XParceria nunca é perdido" é princípio fundador.
 * `activatedAt` não entra: o aniversário é o do nascimento original.
 */
export function buildReactivationUpdate(
  memberProfiles: Record<string, MemberProfile>,
  inviteCode: string,
): ReactivationUpdate {
  const temperature = TEMPERATURE.INITIAL;
  return {
    status: 'active',
    temperature,
    temperatureBand: bandForTemperature(temperature).id,
    memberProfiles,
    bornFromInvite: inviteCode,
  };
}
