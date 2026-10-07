import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { AcceptInviteScreen } from '../AcceptInviteScreen';
import { InviteRejectedError, acceptInvite, readInvite } from '../services/invites';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    dismissTo: mockDismissTo,
    canGoBack: () => mockCanGoBack,
  }),
}));
jest.mock('@/core/auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'me' } }) }));
jest.mock('@/core/firebase/client', () => ({ db: {} }));
// Sem requireActual: o módulo real puxa firebase/firestore (ESM), que o jest não transforma.
jest.mock('../services/invites', () => ({
  InviteRejectedError: class InviteRejectedError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  },
  readInvite: jest.fn(),
  acceptInvite: jest.fn(),
}));

const mockRead = readInvite as jest.Mock;
const mockAccept = acceptInvite as jest.Mock;

function invite(over: Record<string, unknown> = {}) {
  return {
    code: 'AB3D4F7H',
    fromUid: 'ana',
    fromProfile: { displayName: 'Ana', photoURL: null, avatarEmoji: '🦊', handle: 'ana' },
    createdAt: { toMillis: () => Date.now() - 1000 },
    usedBy: null,
    status: 'pending',
    maxUses: 1,
    ...over,
  };
}

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <AcceptInviteScreen code="AB3D4F7H" />
    </QueryClientProvider>,
  );
}

let shareSpy: jest.SpyInstance;
beforeEach(() => {
  jest.resetAllMocks();
  mockCanGoBack = true;
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});

describe('AcceptInviteScreen', () => {
  it('mostra quem convidou', async () => {
    mockRead.mockResolvedValue(invite());
    await renderScreen();
    expect(await screen.findByText('Ana quer construir uma parceria com você')).toBeTruthy();
    expect(screen.getByText('🦊')).toBeTruthy();
  });

  it('mostra skeleton, não spinner, enquanto carrega', async () => {
    mockRead.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(screen.getByTestId('invite-skeleton')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('código inexistente tem mensagem e voltar', async () => {
    mockRead.mockResolvedValue(null);
    await renderScreen();
    expect(await screen.findByText('Não encontrei esse convite.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Voltar'));
    expect(mockBack).toHaveBeenCalled();
    expect(screen.queryByLabelText('Pedir um convite novo')).toBeNull();
  });

  it.each([
    ['self', 'Esse convite é seu.', false],
    ['used', 'Esse convite já virou parceria de outra pessoa.', true],
    ['expired', 'Esse convite esfriou.', true],
  ] as const)('recusa %s no aceite', async (reason, message, canAsk) => {
    mockRead.mockResolvedValue(invite());
    mockAccept.mockRejectedValue(new InviteRejectedError(reason));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Aceitar'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByLabelText('Pedir um convite novo') !== null).toBe(canAsk);
  });

  it('recusa already-partners no aceite leva à parceria, como quem reabre o link', async () => {
    mockRead.mockResolvedValue(invite());
    mockAccept.mockRejectedValue(new InviteRejectedError('already-partners'));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Aceitar'));
    expect(await screen.findByText('Vocês já são parceiros.')).toBeTruthy();
    expect(screen.queryByLabelText('Pedir um convite novo')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ver parceria'));
    expect(mockReplace).toHaveBeenCalledWith('/partnership/ana_me');
  });

  it('"Voltar" sem histórico (app aberto pelo link) vai para a raiz', async () => {
    mockCanGoBack = false;
    mockRead.mockResolvedValue(null);
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Voltar'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('"Voltar" da parceria já existente também cai na raiz sem histórico', async () => {
    mockCanGoBack = false;
    mockRead.mockResolvedValue(invite({ usedBy: 'me', status: 'accepted' }));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Voltar'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('"Ver parceria" sem histórico vai para a lista, onde a parceria está', async () => {
    // Trocar a tela única pela visão geral deixaria a pessoa sem voltar.
    mockCanGoBack = false;
    mockRead.mockResolvedValue(invite({ usedBy: 'me', status: 'accepted' }));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Ver parceria'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('já mostra a recusa lendo o convite, sem tentar aceitar', async () => {
    mockRead.mockResolvedValue(invite({ usedBy: 'bia', status: 'accepted' }));
    await renderScreen();
    expect(await screen.findByText('Esse convite já virou parceria de outra pessoa.')).toBeTruthy();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('convite próprio é recusado na leitura', async () => {
    mockRead.mockResolvedValue(invite({ fromUid: 'me' }));
    await renderScreen();
    expect(await screen.findByText('Esse convite é seu.')).toBeTruthy();
  });

  it('quem já aceitou e abre o link de novo vê a própria parceria', async () => {
    mockRead.mockResolvedValue(invite({ usedBy: 'me', status: 'accepted' }));
    await renderScreen();
    expect(await screen.findByText('Vocês já são parceiros.')).toBeTruthy();
    expect(screen.queryByLabelText('Pedir um convite novo')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ver parceria'));
    expect(mockReplace).toHaveBeenCalledWith('/partnership/ana_me');
  });

  it('usado por outra pessoa continua sem "Ver parceria"', async () => {
    mockRead.mockResolvedValue(invite({ usedBy: 'bia', status: 'accepted' }));
    await renderScreen();
    expect(await screen.findByText('Esse convite já virou parceria de outra pessoa.')).toBeTruthy();
    expect(screen.queryByLabelText('Ver parceria')).toBeNull();
  });

  it('pede convite novo pelo Share, com o nome de quem convidou', async () => {
    mockRead.mockResolvedValue(invite({ usedBy: 'bia', status: 'accepted' }));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Pedir um convite novo'));
    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Ana, seu convite do Parcerio já foi usado — me manda outro?',
    });
  });

  it('falha do Share no pedido de convite novo vira mensagem curta, sem rejeição solta', async () => {
    shareSpy.mockRejectedValue(new Error('no activity'));
    mockRead.mockResolvedValue(invite({ usedBy: 'bia', status: 'accepted' }));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Pedir um convite novo'));
    expect(await screen.findByText('Não consegui abrir o compartilhamento. Tenta de novo.')).toBeTruthy();
  });

  it('pedido de convite expirado usa o texto de esfriou', async () => {
    mockRead.mockResolvedValue(invite({ createdAt: { toMillis: () => 0 } }));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Pedir um convite novo'));
    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Ana, seu convite do Parcerio esfriou — me manda outro?',
    });
  });

  it('aceitar chama o serviço e volta para a lista que já existe', async () => {
    mockRead.mockResolvedValue(invite());
    mockAccept.mockResolvedValue({ pid: 'ana_me', reactivated: false });
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Aceitar'));
    // dismissTo, não replace: replace empilharia uma lista nova sobre a velha.
    await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith('/'));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockAccept).toHaveBeenCalledWith({}, 'AB3D4F7H', 'me');
  });

  it('traduz erro que não é recusa de domínio', async () => {
    mockRead.mockResolvedValue(invite());
    mockAccept.mockRejectedValue({ code: 'unavailable' });
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Aceitar'));
    expect(await screen.findByText('Sem conexão. Tenta de novo.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it('desabilita o botão nativamente enquanto aceita', async () => {
    mockRead.mockResolvedValue(invite());
    mockAccept.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Aceitar'));
    await waitFor(() =>
      expect(screen.getByLabelText('Aceitar').props.accessibilityState.disabled).toBe(true),
    );
    // O Pressable nativo com `disabled` recusa ser responder; sem a prop, devolveria true.
    expect(screen.getByLabelText('Aceitar').props.onStartShouldSetResponder()).toBe(false);
    await fireEvent.press(screen.getByLabelText('Aceitar'));
    expect(mockAccept).toHaveBeenCalledTimes(1);
  });
});
