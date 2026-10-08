import {
  type Timestamp,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import { checkInvite, generateInviteCode, type InviteRejection } from '@shared/invite';
import { buildBirthPartnership, buildReactivationUpdate, partnershipId } from '@shared/partnership';
import type { InviteDoc, MemberProfile, PartnershipDoc, UserDoc } from '@shared/types';

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

/**
 * Por que o aceite não aconteceu, para a tela escolher a mensagem:
 * `used` e `expired` levam ao pedido de convite novo; `self`, `not-found` e
 * `already-partners` têm texto próprio. Erro que não é recusa de domínio
 * (rede, PERMISSION_DENIED) sai como o FirestoreError original.
 */
export type AcceptRejection = InviteRejection | 'not-found' | 'already-partners';

export class InviteRejectedError extends Error {
  constructor(readonly reason: AcceptRejection) {
    super(reason);
    this.name = 'InviteRejectedError';
  }
}

export interface AcceptResult {
  pid: string;
  reactivated: boolean;
}

/**
 * A regra fixa memberProfiles contra users/{uid} de cada membro, com chave
 * ausente valendo null. Por isso o perfil vem do banco, lido na transação,
 * e não de invite.fromProfile (fica velho se a pessoa editou o perfil depois
 * de convidar) nem de um parâmetro (seria o cliente escolhendo).
 */
async function memberProfileOf(tx: Transaction, db: Firestore, uid: string): Promise<MemberProfile> {
  const u = (await tx.get(doc(db, 'users', uid))).data() as Partial<UserDoc> | undefined;
  return {
    displayName: u?.displayName ?? null,
    photoURL: u?.photoURL ?? null,
    avatarEmoji: u?.avatarEmoji ?? null,
  } as MemberProfile;
}

/**
 * Nascimento inteiro numa transação: parceria, evento e baixa do convite.
 * A regra exige os dois juntos nos dois sentidos — a parceria só nasce se o
 * convite for consumido no mesmo commit, e o convite só vira `accepted` se a
 * parceria do par apontar para ele. O evento só passa porque a regra de
 * `events` usa getAfter(), que enxerga a parceria criada nesta transação.
 * Ou nasce inteira, ou não nasce.
 *
 * As validações aqui existem para a mensagem ser específica; a autoridade
 * continua sendo a regra, que roda de novo no commit.
 */
export async function acceptInvite(
  db: Firestore,
  code: string,
  accepterUid: string,
): Promise<AcceptResult> {
  return runTransaction(db, async (tx) => {
    const inviteRef = doc(db, 'invites', code);
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new InviteRejectedError('not-found');

    const invite = inviteSnap.data() as InviteDoc;
    const rejection = checkInvite(
      {
        fromUid: invite.fromUid,
        usedBy: invite.usedBy,
        status: invite.status,
        createdAtMs: (invite.createdAt as Timestamp).toMillis(),
      },
      accepterUid,
      Date.now(),
    );
    if (rejection !== null) throw new InviteRejectedError(rejection);

    const pid = partnershipId(invite.fromUid, accepterUid);
    const partnershipRef = doc(db, 'partnerships', pid);
    // A regra libera `get` de parceria inexistente para quem compõe o pid,
    // então ausência é snapshot vazio; PERMISSION_DENIED aqui é real e propaga.
    const snap = await tx.get(partnershipRef);
    const existing = snap.exists() ? (snap.data() as PartnershipDoc) : null;
    if (existing && existing.status !== 'ended') {
      throw new InviteRejectedError('already-partners');
    }

    const memberProfiles = {
      [invite.fromUid]: await memberProfileOf(tx, db, invite.fromUid),
      [accepterUid]: await memberProfileOf(tx, db, accepterUid),
    };

    tx.update(inviteRef, { usedBy: accepterUid, status: 'accepted' });

    if (existing) {
      tx.update(partnershipRef, {
        ...buildReactivationUpdate(memberProfiles, code),
        updatedAt: serverTimestamp(),
      });
      // Id = o código do convite: é o evento que a regra da reativação confere.
      tx.set(doc(db, `partnerships/${pid}/events`, code), {
        type: 'partnership_resumed',
        occurredAt: serverTimestamp(),
        xpAwarded: 0,
      });
      return { pid, reactivated: true };
    }

    const birth = buildBirthPartnership({
      inviter: { uid: invite.fromUid, profile: memberProfiles[invite.fromUid]! },
      accepter: { uid: accepterUid, profile: memberProfiles[accepterUid]! },
      inviteCode: code,
    });
    tx.set(partnershipRef, {
      ...birth,
      createdAt: serverTimestamp(),
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Id fixo `born`: a regra do nascimento confere este evento no pós-commit.
    tx.set(doc(db, `partnerships/${pid}/events`, 'born'), {
      type: 'partnership_born',
      occurredAt: serverTimestamp(),
      xpAwarded: 100,
    });
    return { pid, reactivated: false };
  });
}
