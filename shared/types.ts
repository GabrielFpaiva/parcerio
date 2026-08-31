import type { TEMPERATURE_BANDS } from './constants';

export type TemperatureBandId = (typeof TEMPERATURE_BANDS)[number]['id'];
export type TemperatureBand = (typeof TEMPERATURE_BANDS)[number];

export type PartnershipStatus = 'active' | 'hibernating' | 'paused' | 'ended';

export interface UserStats {
  partnershipCount: number;
  totalXParceria: number;
  totalEncounters: number;
  daysUsing: number;
  strongestPartnershipId: string | null;
}

export interface UserSettings {
  shareLocation: boolean;
  ritualHour: number;
  notifications: { ritual: boolean; challenges: boolean; encounters: boolean };
}

export interface UserDoc {
  uid: string;
  displayName: string;
  handle: string;
  photoURL: string | null;
  avatarEmoji: string;
  timezone: string;
  createdAt: unknown; // Timestamp — o tipo concreto difere entre SDK e admin
  lastActiveAt: unknown;
  stats: UserStats;
  settings: UserSettings;
}

export const INITIAL_USER_STATS: UserStats = {
  partnershipCount: 0,
  totalXParceria: 0,
  totalEncounters: 0,
  daysUsing: 0,
  strongestPartnershipId: null,
};

export const INITIAL_USER_SETTINGS: UserSettings = {
  shareLocation: true,
  ritualHour: 19,
  notifications: { ritual: true, challenges: true, encounters: true },
};

export type EventType =
  | 'partnership_born'
  | 'partnership_paused'
  | 'partnership_resumed'
  | 'partnership_ended'
  | 'encounter'
  | 'level_up'
  | 'mission_completed'
  | 'achievement'
  | 'streak_milestone'
  | 'anniversary'
  | 'super_born';

export const LIFECYCLE_EVENT_TYPES = [
  'partnership_born',
  'partnership_paused',
  'partnership_resumed',
  'partnership_ended',
] as const;

export interface MemberProfile {
  displayName: string;
  photoURL: string | null;
  avatarEmoji: string;
}

export interface PartnershipStreak {
  current: number;
  longest: number;
  lastDay: string | null; // null no nascimento: não existe dia anterior
  freezesLeft: number;
}

export interface PartnershipStats {
  encounterCount: number;
  totalMinutesTogether: number;
  lastEncounterAt: unknown | null;
  daysSinceLastEncounter: number;
  firstEncounterAt: unknown | null;
  longestEncounterMinutes: number;
  maxDistanceKm: number;
  placesVisited: number;
}

export interface PartnershipDoc {
  id: string;
  members: [string, string];
  memberProfiles: Record<string, MemberProfile>;
  status: PartnershipStatus;
  createdBy: string;
  bornFromInvite: string;
  createdAt: unknown;
  activatedAt: unknown;
  xparceria: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  temperature: number;
  temperatureBand: TemperatureBandId;
  streak: PartnershipStreak;
  stats: PartnershipStats;
  achievements: string[];
  superPartnershipId: string | null;
  updatedAt: unknown;
}

export interface PartnershipEvent {
  type: EventType;
  occurredAt: unknown;
  xpAwarded: number;
}

export interface InviteFromProfile extends MemberProfile {
  handle: string;
}

/**
 * Sem `expiresAt`: o cliente não consegue prever `request.time`, então um
 * campo de vencimento gravado seria impossível de fixar por regra — e um
 * convite que nunca expira é o abuso óbvio. O vencimento é derivado de
 * `createdAt + INVITE_TTL_MS`, no cliente e na regra.
 */
export interface InviteDoc {
  code: string;
  fromUid: string;
  fromProfile: InviteFromProfile;
  createdAt: unknown;
  usedBy: string | null;
  status: 'pending' | 'accepted';
  maxUses: 1;
}

export const ACHIEVEMENT_FIRST_PARTNERSHIP = 'o-comeco';

/** Fixado na regra de `events`. Tipo fora desta tabela é negado por omissão. */
export const LIFECYCLE_EVENT_XP: Record<(typeof LIFECYCLE_EVENT_TYPES)[number], number> = {
  partnership_born: 100,
  partnership_paused: 0,
  partnership_resumed: 0,
  partnership_ended: 0,
};
