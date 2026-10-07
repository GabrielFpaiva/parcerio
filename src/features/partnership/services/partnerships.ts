import {
  collection, doc, getDoc, serverTimestamp, writeBatch, type Firestore,
} from 'firebase/firestore';
import type { EventType, MemberProfile, PartnershipStatus } from '@shared/types';

/**
 * Status e evento no mesmo lote. A regra do evento só aceita o registro se o
 * mesmo commit fizer a transição que ele narra.
 */
async function transition(
  db: Firestore,
  pid: string,
  status: PartnershipStatus,
  type: EventType,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'partnerships', pid), { status, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, `partnerships/${pid}/events`)), {
    type,
    occurredAt: serverTimestamp(),
    xpAwarded: 0,
  });
  await batch.commit();
}

export const pausePartnership = (db: Firestore, pid: string) =>
  transition(db, pid, 'paused', 'partnership_paused');

export const resumePartnership = (db: Firestore, pid: string) =>
  transition(db, pid, 'active', 'partnership_resumed');

export const endPartnership = (db: Firestore, pid: string) =>
  transition(db, pid, 'ended', 'partnership_ended');

/**
 * Sem trigger no servidor, quem edita o perfil propaga. A regra só deixa
 * mexer na própria chave e nega update sem diff, então a parceria que já está
 * igual é pulada (senão a batch inteira falha). Se o app morrer no meio,
 * alguma parceria fica com o nome velho até a próxima edição.
 */
export async function propagateProfile(
  db: Firestore,
  uid: string,
  profile: MemberProfile,
  pids: string[],
): Promise<void> {
  // Só esses três campos: a regra confere o formato exato da entrada.
  const entry = {
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    avatarEmoji: profile.avatarEmoji,
  };
  const snaps = await Promise.all(pids.map((pid) => getDoc(doc(db, 'partnerships', pid))));
  const batch = writeBatch(db);
  let pending = 0;
  snaps.forEach((snap, i) => {
    const current = snap.get(`memberProfiles.${uid}`) as MemberProfile | undefined;
    if (
      current &&
      current.displayName === entry.displayName &&
      current.photoURL === entry.photoURL &&
      current.avatarEmoji === entry.avatarEmoji
    ) {
      return;
    }
    batch.update(doc(db, 'partnerships', pids[i]!), {
      [`memberProfiles.${uid}`]: entry,
      updatedAt: serverTimestamp(),
    });
    pending += 1;
  });
  if (pending > 0) await batch.commit();
}
