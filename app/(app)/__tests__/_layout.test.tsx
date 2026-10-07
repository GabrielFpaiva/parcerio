import { render, screen } from '@testing-library/react-native';
import AppLayout from '../_layout';

// Prefixo `mock` é obrigatório: babel-plugin-jest-hoist bloqueia qualquer
// variável fora do escopo do factory de jest.mock() que não comece com "mock".
const mockUseAuth = jest.fn();
const mockUseProfile = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@/core/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => mockUseProfile(),
}));
jest.mock('@/features/ceremony/BornCeremonyGate', () => ({ BornCeremonyGate: () => null }));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Stack: () => <Text>app-stack</Text>,
  };
});

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseProfile.mockReset();
  mockRefetch.mockReset();
});

describe('AppLayout', () => {
  it('mostra indicador enquanto carrega', async () => {
    mockUseAuth.mockReturnValue({ status: 'loading', user: null });
    mockUseProfile.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: mockRefetch });
    await render(<AppLayout />);
    expect(screen.getByTestId('app-loading')).toBeTruthy();
  });

  it('redireciona para /sign-in quando deslogado', async () => {
    mockUseAuth.mockReturnValue({ status: 'signedOut', user: null });
    mockUseProfile.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: mockRefetch });
    await render(<AppLayout />);
    expect(screen.getByText('redirect:/sign-in')).toBeTruthy();
  });

  it('redireciona para /profile-setup quando não há perfil', async () => {
    mockUseAuth.mockReturnValue({ status: 'signedIn', user: { uid: 'alice' } });
    mockUseProfile.mockReturnValue({ isLoading: false, isError: false, data: null, refetch: mockRefetch });
    await render(<AppLayout />);
    expect(screen.getByText('redirect:/profile-setup')).toBeTruthy();
  });

  it('mostra erro e não entra no app quando a query de perfil falha', async () => {
    mockUseAuth.mockReturnValue({ status: 'signedIn', user: { uid: 'alice' } });
    mockUseProfile.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch: mockRefetch });
    await render(<AppLayout />);
    expect(screen.getByText('Não consegui carregar seu perfil. Verifica a conexão.')).toBeTruthy();
    expect(screen.queryByText('app-stack')).toBeNull();
    expect(screen.queryByText('redirect:/profile-setup')).toBeNull();
  });

  it('renderiza o conteúdo quando o perfil existe', async () => {
    mockUseAuth.mockReturnValue({ status: 'signedIn', user: { uid: 'alice' } });
    mockUseProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { uid: 'alice', handle: 'alice' },
      refetch: mockRefetch,
    });
    await render(<AppLayout />);
    expect(screen.getByText('app-stack')).toBeTruthy();
  });
});
