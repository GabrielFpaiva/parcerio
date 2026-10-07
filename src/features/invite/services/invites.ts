import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { generateInviteCode } from '@shared/invite';
import type { InviteDoc, UserDoc } from '@shared/types';

export const INVITE_LANDING_BASE = 'https://parceria-db699.web.app';

export function inviteUrl(code: string, displayName: string): string {
  return `${INVITE_LANDING_BASE}/?c=${code}&de=${encodeURIComponent(displayName)}`;
}

/**
 * Unicidade vem da semântica de create do Firestore: a regra proíbe update,
 * então uma colisão simplesmente falha e a gente tenta outro código. Com
 * 32^8 combinações, a colisão é teórica — o retry existe para que, se
 * acontecer, não vire erro na cara de ninguém.
 */
export async function createInvite(db: Firestore, uid: string, profile: UserDoc): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const invite = {
      code,
      fromUid: uid,
      fromProfile: {
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        avatarEmoji: profile.avatarEmoji,
        handle: profile.handle,
      },
      createdAt: serverTimestamp(),
      usedBy: null,
      status: 'pending' as const,
      maxUses: 1 as const,
    };
    try {
      await setDoc(doc(db, 'invites', code), invite);
      return code;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function readInvite(db: Firestore, code: string): Promise<InviteDoc | null> {
  const snap = await getDoc(doc(db, 'invites', code));
  return snap.exists() ? (snap.data() as InviteDoc) : null;
}
