import { Share } from 'react-native';

/** "K7QM2X9P" -> "K7QM 2X9P": mais fácil de ler e de ditar. */
export function formatInviteCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1 ');
}

/** O app empurra para o WhatsApp (ou o que a pessoa escolher); não tenta ser o canal. */
export function shareInvite(url: string) {
  return Share.share({ message: `Bora construir uma parceria? ${url}` });
}
