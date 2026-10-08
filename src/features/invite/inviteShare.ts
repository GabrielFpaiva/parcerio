import { Share } from 'react-native';

/** "K7QM2X9P" -> "K7QM 2X9P": mais fácil de ler e de ditar. */
export function formatInviteCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1 ');
}

// Todas as mensagens que o app põe no Share moram aqui.

export function inviteMessage(url: string): string {
  return `Bora construir uma parceria? ${url}`;
}

export function resumeInviteMessage(url: string): string {
  return `Bora retomar nossa parceria? ${url}`;
}

export function newInviteRequestMessage(inviterName: string | null, reason: 'used' | 'expired'): string {
  const what = reason === 'used' ? 'já foi usado' : 'esfriou';
  const greeting = inviterName !== null ? `${inviterName}, seu` : 'Seu';
  return `${greeting} convite do Parcerio ${what} — me manda outro?`;
}

/** Falha do Share não é erro do Firestore: mensagem própria. */
export const SHARE_FAILED_MESSAGE = 'Não consegui abrir o compartilhamento. Tenta de novo.';

/**
 * O app empurra para o WhatsApp (ou o que a pessoa escolher); não tenta ser o
 * canal. Nunca rejeita: true se a folha de compartilhamento abriu (cancelar
 * é escolha da pessoa, não erro), false se o Share falhou.
 */
export async function shareText(message: string): Promise<boolean> {
  try {
    await Share.share({ message });
    return true;
  } catch {
    return false;
  }
}
