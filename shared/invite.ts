/** Base32 de Crockford: sem I, L, O e U. O código é digitado à mão. */
export const INVITE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 8;
export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

export type InviteRejection = 'expired' | 'used' | 'self';

export interface InviteCheckInput {
  fromUid: string;
  usedBy: string | null;
  status: 'pending' | 'accepted';
  createdAtMs: number;
}

export function generateInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)];
  }
  return code;
}

/**
 * Corrige o que a pessoa erra ao digitar em vez de recusar: I e L viram 1,
 * O vira 0, U vira V — exatamente os caracteres que o alfabeto exclui.
 */
export function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}

export function checkInvite(
  invite: InviteCheckInput,
  accepterUid: string,
  nowMs: number,
): InviteRejection | null {
  // O auto-convite vem primeiro: para quem convidou, "esse convite é seu" é
  // melhor que "expirou", mesmo quando as duas coisas são verdade.
  if (invite.fromUid === accepterUid) return 'self';
  if (invite.usedBy !== null || invite.status === 'accepted') return 'used';
  if (invite.createdAtMs + INVITE_TTL_MS <= nowMs) return 'expired';
  return null;
}
