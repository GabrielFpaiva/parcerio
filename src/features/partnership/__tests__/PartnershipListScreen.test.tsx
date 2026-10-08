import { fireEvent, render, screen } from '@testing-library/react-native';
import { PartnershipListScreen } from '../PartnershipListScreen';
import type { PartnershipDoc } from '@shared/types';

const mockUsePartnerships = jest.fn();
const mockPush = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@/core/auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'a' } }),
}));
jest.mock('../hooks/usePartnerships', () => ({
  usePartnerships: (uid: string | null) => mockUsePartnerships(uid),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function partnership(id: string, partner: string, temperature: number): PartnershipDoc {
  return {
    id,
    members: ['a', id],
    memberProfiles: {
      a: { displayName: 'Alice', photoURL: null, avatarEmoji: '🦊' },
      [id]: { displayName: partner, photoURL: null, avatarEmoji: '🐢' },
    },
    status: 'active',
    level: 1,
    xpIntoLevel: 0,
    temperature,
  } as unknown as PartnershipDoc;
}

beforeEach(() => {
  mockUsePartnerships.mockReset();
  mockPush.mockReset();
  mockRefetch.mockReset();
});

it('mostra o skeleton enquanto carrega, sem spinner', async () => {
  mockUsePartnerships.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: mockRefetch });
  await render(<PartnershipListScreen />);
  expect(screen.getByTestId('partnership-skeleton')).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/ActivityIndicator/);
});

it('convida a chamar alguém quando não há parcerias', async () => {
  mockUsePartnerships.mockReturnValue({ isLoading: false, isError: false, data: [], refetch: mockRefetch });
  await render(<PartnershipListScreen />);
  expect(screen.getByText('Convidar um parceiro')).toBeTruthy();
  expect(screen.getByText('Tenho um convite')).toBeTruthy();
  expect(screen.queryByTestId('partnership-skeleton')).toBeNull();
});

it('os botões do vazio levam às telas de convite', async () => {
  mockUsePartnerships.mockReturnValue({ isLoading: false, isError: false, data: [], refetch: mockRefetch });
  await render(<PartnershipListScreen />);
  await fireEvent.press(screen.getByText('Convidar um parceiro'));
  expect(mockPush).toHaveBeenLastCalledWith('/onboarding/first-invite');
  await fireEvent.press(screen.getByText('Tenho um convite'));
  expect(mockPush).toHaveBeenLastCalledWith('/invite/enter');
});

it('mostra um card por parceria, da mais quente para a mais fria', async () => {
  mockUsePartnerships.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [partnership('p1', 'Frio', 10), partnership('p2', 'Quente', 90), partnership('p3', 'Morno', 50)],
    refetch: mockRefetch,
  });
  await render(<PartnershipListScreen />);
  const names = ['Quente', 'Morno', 'Frio'];
  const found = screen.getAllByText(/^(Quente|Morno|Frio)$/).map((n) => n.props.children);
  expect(found).toEqual(names);
});

it('abre a parceria ao tocar no card', async () => {
  mockUsePartnerships.mockReturnValue({
    isLoading: false, isError: false, data: [partnership('p1', 'Bob', 50)], refetch: mockRefetch,
  });
  await render(<PartnershipListScreen />);
  await fireEvent.press(screen.getByText('Bob'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/partnership/[id]', params: { id: 'p1' } });
});

it('mostra o erro traduzido e tenta de novo', async () => {
  mockUsePartnerships.mockReturnValue({
    isLoading: false,
    isError: true,
    error: { code: 'permission-denied' },
    data: undefined,
    refetch: mockRefetch,
  });
  await render(<PartnershipListScreen />);
  expect(screen.getByText('Você não tem acesso a isso.')).toBeTruthy();
  expect(screen.queryByText('permission-denied')).toBeNull();
  await fireEvent.press(screen.getByText('Tentar de novo'));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

// Quem já tem parceria, mesmo encerrada, precisa de onde digitar o código do
// convite novo (é assim que a parceria encerrada volta) e de onde convidar
// outra pessoa.
it('com parcerias, ainda oferece convidar e digitar um convite', async () => {
  mockUsePartnerships.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [{ ...partnership('p1', 'Bob', 50), status: 'ended' }],
    refetch: mockRefetch,
  });
  await render(<PartnershipListScreen />);
  expect(screen.getByText('Bob')).toBeTruthy();
  await fireEvent.press(screen.getByText('Convidar um parceiro'));
  expect(mockPush).toHaveBeenLastCalledWith('/onboarding/first-invite');
  await fireEvent.press(screen.getByText('Tenho um convite'));
  expect(mockPush).toHaveBeenLastCalledWith('/invite/enter');
});
