import { Share } from 'react-native';
import {
  SHARE_FAILED_MESSAGE,
  newInviteRequestMessage,
  resumeInviteMessage,
  shareText,
} from '../inviteShare';

afterEach(() => jest.restoreAllMocks());

it('shareText resolve true quando o Share abre (mesmo se a pessoa cancelar)', async () => {
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
  await expect(shareText('oi')).resolves.toBe(true);
});

it('shareText engole a falha do Share e resolve false, sem rejeitar', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('no activity'));
  await expect(shareText('oi')).resolves.toBe(false);
});

it('as mensagens de compartilhamento moram aqui', () => {
  expect(resumeInviteMessage('https://x')).toBe('Bora retomar nossa parceria? https://x');
  expect(newInviteRequestMessage('Ana', 'used')).toBe('Ana, seu convite do Parcerio já foi usado — me manda outro?');
  expect(newInviteRequestMessage(null, 'expired')).toBe('Seu convite do Parcerio esfriou — me manda outro?');
  expect(SHARE_FAILED_MESSAGE).toBe('Não consegui abrir o compartilhamento. Tenta de novo.');
});
