import { Alert, Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PartnershipOverviewScreen } from '../PartnershipOverviewScreen';
import type { PartnershipDoc } from '@shared/types';

const mockUsePartnership = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockEnd = jest.fn();
const mockCreateInvite = jest.fn();
const mockRefetch = jest.fn();
const profile = { uid: 'a', displayName: 'Alice', handle: 'alice' };

jest.mock('@/core/auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'a' } }),
}));
jest.mock('@/core/firebase/client', () => ({ db: { fake: 'db' } }));
jest.mock('../hooks/usePartnership', () => ({
  usePartnership: (pid: string | null) => mockUsePartnership(pid),
}));
jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => ({ data: profile }),
}));
jest.mock('../services/partnerships', () => ({
  pausePartnership: (...a: unknown[]) => mockPause(...a),
  resumePartnership: (...a: unknown[]) => mockResume(...a),
  endPartnership: (...a: unknown[]) => mockEnd(...a),
}));
jest.mock('@/features/invite/services/invites', () => ({
  createInvite: (...a: unknown[]) => mockCreateInvite(...a),
  inviteUrl: (code: string, name: string) => `https://x.test/?c=${code}&de=${name}`,
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

function partnership(status: PartnershipDoc['status'] = 'active'): PartnershipDoc {
  return {
    id: 'p1',
    members: ['a', 'b'],
    memberProfiles: {
      a: { displayName: 'Alice', photoURL: null, avatarEmoji: '🦊' },
      b: { displayName: 'Bob', photoURL: null, avatarEmoji: '🐢' },
    },
    status,
    level: 3,
    xpIntoLevel: 10,
    temperature: 90,
    activatedAt: { toDate: () => new Date(2026, 7, 6) },
  } as unknown as PartnershipDoc;
}

function ready(status: PartnershipDoc['status'] = 'active') {
  mockUsePartnership.mockReturnValue({
    isLoading: false, isError: false, data: partnership(status), refetch: mockRefetch,
  });
}

let alertSpy: jest.SpyInstance;
let shareSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockPause.mockResolvedValue(undefined);
  mockResume.mockResolvedValue(undefined);
  mockEnd.mockResolvedValue(undefined);
  mockCreateInvite.mockResolvedValue('ABC12345');
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  ready();
});

function confirmEnd() {
  const buttons = alertSpy.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
  return buttons;
}

it('mostra os dois nomes, o nível, a barra de XParceria e a banda', async () => {
  await render(<PartnershipOverviewScreen />);
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(screen.getByText('Bob')).toBeTruthy();
  expect(screen.getByText('Nível 3')).toBeTruthy();
  expect(screen.getByLabelText('Progresso de XParceria')).toBeTruthy();
  expect(screen.getByText(/Em chamas/)).toBeTruthy();
});

it('mostra desde quando a parceria existe', async () => {
  await render(<PartnershipOverviewScreen />);
  expect(screen.getByText('Parceria desde 06/08/2026')).toBeTruthy();
});

it('encerrar pede confirmação dizendo que o XParceria é preservado', async () => {
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Encerrar'));
  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(alertSpy.mock.calls[0]![1]).toMatch(/XParceria.*preservad/i);
  expect(mockEnd).not.toHaveBeenCalled();
});

it('confirmar encerra a parceria certa', async () => {
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Encerrar'));
  await act(async () => { confirmEnd().find((b) => b.text === 'Encerrar')!.onPress!(); });
  await waitFor(() => expect(mockEnd).toHaveBeenCalledWith({ fake: 'db' }, 'p1'));
});

it('cancelar não chama nada', async () => {
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Encerrar'));
  const cancel = confirmEnd().find((b) => b.text === 'Cancelar')!;
  cancel.onPress?.();
  expect(mockEnd).not.toHaveBeenCalled();
  expect(mockPause).not.toHaveBeenCalled();
});

it('pausar chama o serviço', async () => {
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Pausar'));
  await waitFor(() => expect(mockPause).toHaveBeenCalledWith({ fake: 'db' }, 'p1'));
});

it('parceria dormindo ainda pode pausar e encerrar', async () => {
  ready('hibernating');
  await render(<PartnershipOverviewScreen />);
  expect(screen.getByText('Pausar')).toBeTruthy();
  expect(screen.getByText('Encerrar')).toBeTruthy();
});

it('parceria pausada mostra Retomar no lugar de Pausar', async () => {
  ready('paused');
  await render(<PartnershipOverviewScreen />);
  expect(screen.queryByText('Pausar')).toBeNull();
  await fireEvent.press(screen.getByText('Retomar'));
  await waitFor(() => expect(mockResume).toHaveBeenCalledWith({ fake: 'db' }, 'p1'));
});

it('parceria encerrada esconde as ações e explica o convite novo', async () => {
  ready('ended');
  await render(<PartnershipOverviewScreen />);
  expect(screen.queryByText('Pausar')).toBeNull();
  expect(screen.queryByText('Retomar')).toBeNull();
  expect(screen.queryByText('Encerrar')).toBeNull();
  expect(screen.getByText(/convite novo traz a parceria de volta/i)).toBeTruthy();
});

it('o convite novo só aparece em encerrada', async () => {
  await render(<PartnershipOverviewScreen />);
  expect(screen.queryByText('Mandar convite novo')).toBeNull();
});

it('mandar convite novo cria o convite e abre o compartilhamento', async () => {
  ready('ended');
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Mandar convite novo'));
  await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
  expect(mockCreateInvite).toHaveBeenCalledWith({ fake: 'db' }, 'a', profile);
  expect(shareSpy).toHaveBeenCalledWith({
    message: 'Bora retomar nossa parceria? https://x.test/?c=ABC12345&de=Alice',
  });
});

it('erro no convite mostra mensagem traduzida', async () => {
  ready('ended');
  mockCreateInvite.mockRejectedValue({ code: 'unavailable' });
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Mandar convite novo'));
  expect(await screen.findByText('Sem conexão. Tenta de novo.')).toBeTruthy();
  expect(shareSpy).not.toHaveBeenCalled();
});

it('erro na ação mostra a mensagem traduzida e mantém o botão utilizável', async () => {
  mockPause.mockRejectedValueOnce({ code: 'permission-denied' });
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Pausar'));
  expect(await screen.findByText('Você não tem acesso a isso.')).toBeTruthy();
  expect(screen.queryByText('permission-denied')).toBeNull();
  expect(screen.getByRole('button', { name: 'Pausar' }).props.accessibilityState.disabled).toBe(false);
  await fireEvent.press(screen.getByText('Pausar'));
  await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(2));
});

it('desabilita os botões enquanto a mutação está em voo', async () => {
  let release!: () => void;
  mockPause.mockReturnValue(new Promise<void>((r) => { release = r; }));
  await render(<PartnershipOverviewScreen />);
  await fireEvent.press(screen.getByText('Pausar'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Encerrar' }).props.accessibilityState.disabled).toBe(true));
  release();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Encerrar' }).props.accessibilityState.disabled).toBe(false));
});

it('erro de leitura mostra a mensagem traduzida e tenta de novo', async () => {
  mockUsePartnership.mockReturnValue({
    isLoading: false, isError: true, error: { code: 'permission-denied' }, data: undefined, refetch: mockRefetch,
  });
  await render(<PartnershipOverviewScreen />);
  expect(screen.getByText('Você não tem acesso a isso.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Tentar de novo'));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
