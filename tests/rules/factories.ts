import { serverTimestamp } from 'firebase/firestore';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { validProfile } from './helpers';

export function validInvite(fromUid: string, overrides: Record<string, unknown> = {}) {
  const p = validProfile(fromUid, fromUid.replace(/-/g, ''));
  return {
    code: 'AB3D4F7H',
    fromUid,
    fromProfile: {
      displayName: p.displayName,
      photoURL: p.photoURL,
      avatarEmoji: p.avatarEmoji,
      handle: p.handle,
    },
    createdAt: serverTimestamp(),
    usedBy: null,
    status: 'pending',
    maxUses: 1,
    ...overrides,
  };
}

export function validPartnership(
  inviterUid: string,
  accepterUid: string,
  code: string,
  overrides: Record<string, unknown> = {},
) {
  const members = [inviterUid, accepterUid].sort();
  const profileOf = (uid: string) => {
    const p = validProfile(uid, uid.replace(/-/g, ''));
    return { displayName: p.displayName, photoURL: p.photoURL, avatarEmoji: p.avatarEmoji };
  };
  return {
    id: members.join('_'),
    members,
    memberProfiles: { [members[0]!]: profileOf(members[0]!), [members[1]!]: profileOf(members[1]!) },
    status: 'active',
    createdBy: inviterUid,
    bornFromInvite: code,
    createdAt: serverTimestamp(),
    activatedAt: serverTimestamp(),
    xparceria: 100,
    level: 1,
    xpIntoLevel: 100,
    xpForNextLevel: 122,
    temperature: 50,
    temperatureBand: 'mild',
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
    achievements: ['o-comeco'],
    superPartnershipId: null,
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Semeia por fora das regras — `matchesOwnProfile` faz get em users. */
export async function seedUsers(env: RulesTestEnvironment, uids: string[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const uid of uids) {
      await ctx.firestore().doc(`users/${uid}`).set(validProfile(uid, uid.replace(/-/g, '')));
    }
  });
}

export async function seedInvite(
  env: RulesTestEnvironment,
  code: string,
  data: Record<string, unknown>,
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    // `createdAt` só cai para `new Date()` (agora) quando `data` não trouxer
    // um valor — sem este `??` não dava para semear um convite velho para
    // testar o TTL (Hole 3): a chamada sempre sobrescrevia createdAt com o
    // instante atual, não importa o que viesse em `data`.
    await ctx.firestore().doc(`invites/${code}`).set({ createdAt: new Date(), ...data });
  });
}

/**
 * Parceria já existente, semeada por fora das regras. Serve para testar
 * invites.update isolado: o lado do convite exige (getAfter) que a parceria
 * do par aponte para o código, e sem ela todo teste de negação do convite
 * passaria pelo motivo errado.
 */
export async function seedPartnership(
  env: RulesTestEnvironment,
  pid: string,
  data: Record<string, unknown>,
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`partnerships/${pid}`).set(data);
  });
}

export function validSuperPartnership(members: string[], overrides: Record<string, unknown> = {}) {
  const sorted = [...members].sort();
  return {
    id: sorted.join('_'),
    members: sorted,
    memberProfiles: Object.fromEntries(
      sorted.map((uid) => {
        const p = validProfile(uid, uid.replace(/-/g, ''));
        return [uid, { displayName: p.displayName, photoURL: p.photoURL, avatarEmoji: p.avatarEmoji }];
      }),
    ),
    partnershipIds: [],
    name: 'Os Fominhas',
    emoji: '🔥',
    bornAt: serverTimestamp(),
    level: 1,
    xparceria: 0,
    bonusMultiplier: 1.5,
    status: 'active',
    stats: { groupEncounters: 0, lastGroupEncounterAt: null },
    ...overrides,
  };
}

export async function seedSuperPartnership(
  env: RulesTestEnvironment,
  spid: string,
  members: string[],
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(`superPartnerships/${spid}`)
      .set({ ...validSuperPartnership(members), bornAt: new Date() });
  });
}

export async function seedRound(
  env: RulesTestEnvironment,
  spid: string,
  date: string,
  data: Record<string, unknown>,
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`superPartnerships/${spid}/games/${date}`).set(data);
  });
}
