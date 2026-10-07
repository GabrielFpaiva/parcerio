import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, Share } from 'react-native';
import { WaitingScreen } from '../WaitingScreen';

const mockCreateInvite = jest.fn();
const mockReplace = jest.fn();
const mockUsePartnerships = jest.fn();
let mockParams: { code?: string; nome?: string } = {};

jest.mock('@/core/firebase/client', () => ({ db: {} }));
// invites.ts importa o SDK (ESM) só para os outros serviços; aqui só createInvite é trocado.
jest.mock('firebase/firestore', () => ({}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/core/auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'a' } }),
}));
jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => ({
    data: { displayName: 'Gabriel', photoURL: null, avatarEmoji: '🦊', handle: 'g' },
  }),
}));
jest.mock('@/features/partnership/hooks/usePartnerships', () => ({
  usePartnerships: (uid: string | null) => mockUsePartnerships(uid),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../services/invites', () => ({
  ...jest.requireActual('../services/invites'),
  createInvite: (...args: unknown[]) => mockCreateInvite(...args),
}));

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  const view = await render(
    <QueryClientProvider client={client}><WaitingScreen /></QueryClientProvider>,
  );
  // Espera o AccessibilityInfo responder: o setState dele é assíncrono e vazaria para o teste seguinte.
  await waitFor(() => expect(screen.getByTestId(/^preview-(animated|static)$/)).toBeTruthy());
  return view;
}

beforeEach(() => {
  mockCreateInvite.mockReset();
  mockReplace.mockReset();
  mockParams = { code: 'K7QM2X9P', nome: 'João' };
  mockUsePartnerships.mockReturnValue({ data: [], isLoading: false, isError: false });
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

it('mostra o código e o preview animado da parceria nível 12', async () => {
  await renderScreen();
  expect(screen.getByText('K7QM 2X9P')).toBeTruthy();
  expect(screen.getByText('Nível 12')).toBeTruthy();
  expect(screen.getByTestId('preview-animated')).toBeTruthy();
});

it('com movimento reduzido mostra o mesmo card, parado', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await renderScreen();
  expect(screen.getByTestId('preview-static')).toBeTruthy();
  expect(screen.getByText('Nível 12')).toBeTruthy();
  expect(screen.queryByTestId('preview-animated')).toBeNull();
});

it('usa o nome do parceiro quando existe', async () => {
  await renderScreen();
  expect(screen.getByText(/Enquanto o João não aceita/)).toBeTruthy();
});

it('usa um texto neutro quando o nome não existe', async () => {
  mockParams = { code: 'K7QM2X9P' };
  await renderScreen();
  expect(screen.getByText(/Enquanto seu convite não é aceito/)).toBeTruthy();
});

it('vai para a raiz quando a parceria aparece', async () => {
  const view = await renderScreen();
  expect(mockReplace).not.toHaveBeenCalled();
  mockUsePartnerships.mockReturnValue({ data: [{ id: 'p' }], isLoading: false, isError: false });
  await view.rerender(
    <QueryClientProvider client={new QueryClient()}><WaitingScreen /></QueryClientProvider>,
  );
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

it('"Depois eu faço isso" leva à raiz sem convite', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Depois eu faço isso'));
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('"Gerar outro convite" cria um código novo e passa a mostrar e compartilhar o novo', async () => {
  mockCreateInvite.mockResolvedValue('NEW1CODE');
  await renderScreen();
  await fireEvent.press(screen.getByText('Gerar outro convite'));
  await waitFor(() => expect(screen.getByText('NEW1 CODE')).toBeTruthy());
  expect(screen.queryByText('K7QM 2X9P')).toBeNull();
  expect(mockCreateInvite).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByText('Compartilhar de novo'));
  expect(Share.share).toHaveBeenCalledWith({
    message: 'Bora construir uma parceria? https://parceria-db699.web.app/?c=NEW1CODE&de=Gabriel',
  });
});

it('erro ao gerar outro convite mostra mensagem traduzida e mantém o código atual', async () => {
  mockCreateInvite.mockRejectedValue({ code: 'unavailable' });
  await renderScreen();
  await fireEvent.press(screen.getByText('Gerar outro convite'));
  await waitFor(() => expect(screen.getByText('Sem conexão. Tenta de novo.')).toBeTruthy());
  expect(screen.getByText('K7QM 2X9P')).toBeTruthy();
});
