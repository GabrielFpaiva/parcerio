import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Share } from 'react-native';
import { FirstInviteScreen } from '../FirstInviteScreen';

const mockCreateInvite = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/core/firebase/client', () => ({ db: {} }));
// invites.ts importa o SDK (ESM) só para os outros serviços; aqui só createInvite é trocado.
jest.mock('firebase/firestore', () => ({}));
jest.mock('@/core/auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'a' } }),
}));
jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => ({
    data: { displayName: 'Gabriel', photoURL: null, avatarEmoji: '🦊', handle: 'g' },
  }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../services/invites', () => ({
  ...jest.requireActual('../services/invites'),
  createInvite: (...args: unknown[]) => mockCreateInvite(...args),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}><FirstInviteScreen /></QueryClientProvider>,
  );
}

beforeEach(() => {
  mockCreateInvite.mockReset();
  mockReplace.mockReset();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});

it('pergunta quem é o parceiro e não menciona agenda nem contatos', async () => {
  await renderScreen();
  expect(screen.getByText('Quem é o seu parceiro?')).toBeTruthy();
  const all = JSON.stringify(screen.toJSON()).toLowerCase();
  expect(all).not.toMatch(/agenda|contato/);
});

it('gerar convite chama createInvite uma vez', async () => {
  mockCreateInvite.mockResolvedValue('K7QM2X9P');
  await renderScreen();
  await fireEvent.press(screen.getByText('Gerar convite'));
  await waitFor(() => expect(screen.getByText('K7QM 2X9P')).toBeTruthy());
  expect(mockCreateInvite).toHaveBeenCalledTimes(1);
  expect(mockCreateInvite.mock.calls[0]![1]).toBe('a');
});

it('depois de gerado, mostra o código em blocos e o botão do WhatsApp', async () => {
  mockCreateInvite.mockResolvedValue('K7QM2X9P');
  await renderScreen();
  await fireEvent.press(screen.getByText('Gerar convite'));
  await waitFor(() => expect(screen.getByText('K7QM 2X9P')).toBeTruthy());
  expect(screen.getByText('Compartilhar no WhatsApp')).toBeTruthy();
});

it('compartilhar manda a URL da landing', async () => {
  mockCreateInvite.mockResolvedValue('K7QM2X9P');
  await renderScreen();
  await fireEvent.press(screen.getByText('Gerar convite'));
  await waitFor(() => screen.getByText('Compartilhar no WhatsApp'));
  await fireEvent.press(screen.getByText('Compartilhar no WhatsApp'));
  expect(Share.share).toHaveBeenCalledWith({
    message: 'Bora construir uma parceria? https://parceria-db699.web.app/?c=K7QM2X9P&de=Gabriel',
  });
});

it('erro mostra a mensagem traduzida e deixa tentar de novo', async () => {
  mockCreateInvite.mockRejectedValueOnce({ code: 'unavailable' });
  await renderScreen();
  await fireEvent.press(screen.getByText('Gerar convite'));
  await waitFor(() => expect(screen.getByText('Sem conexão. Tenta de novo.')).toBeTruthy());
  expect(JSON.stringify(screen.toJSON())).not.toContain('unavailable');

  mockCreateInvite.mockResolvedValueOnce('K7QM2X9P');
  await fireEvent.press(screen.getByText('Tentar de novo'));
  await waitFor(() => expect(screen.getByText('K7QM 2X9P')).toBeTruthy());
  expect(mockCreateInvite).toHaveBeenCalledTimes(2);
});

it('enquanto gera, o botão fica com disabled nativo', async () => {
  mockCreateInvite.mockReturnValue(new Promise(() => {}));
  await renderScreen();
  await fireEvent.press(screen.getByText('Gerar convite'));
  await waitFor(() => {
    const btn = screen.getByLabelText('Gerar convite');
    expect(btn.props.accessibilityState.busy).toBe(true);
    expect(btn.props.accessibilityState.disabled).toBe(true);
  });
  // Segundo toque durante a geração não pode disparar outra criação.
  await fireEvent.press(screen.getByLabelText('Gerar convite'));
  expect(mockCreateInvite).toHaveBeenCalledTimes(1);
});
