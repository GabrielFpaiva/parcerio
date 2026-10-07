import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { PartnershipDoc } from '@shared/types';
import PartnershipBornModal from '../../../../app/(modals)/partnership-born';
import { BornCeremonyGate } from '../BornCeremonyGate';
import { useBornCeremony } from '../useBornCeremony';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockUsePartnerships = jest.fn();
let mockSegments: string[] = ['(app)'];

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-router', () => {
  const { Text: T } = require('react-native');
  return {
    useRouter: () => ({
      push: mockPush,
      back: mockBack,
      replace: mockReplace,
      canGoBack: () => true,
    }),
    useLocalSearchParams: () => ({ id: 'p1' }),
    useSegments: () => mockSegments,
    Redirect: ({ href }: { href: string }) => <T>{`redirect:${href}`}</T>,
  };
});
jest.mock('@/core/auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/features/partnership/hooks/usePartnerships', () => ({
  usePartnerships: () => mockUsePartnerships(),
}));

const born = {
  id: 'p1',
  status: 'active',
  members: ['u1', 'u2'],
  memberProfiles: {
    u1: { displayName: 'Gabriel', photoURL: null, avatarEmoji: '🦊' },
    u2: { displayName: 'João', photoURL: null, avatarEmoji: '🐻' },
  },
  level: 1,
  xpIntoLevel: 100,
  xpForNextLevel: 200,
  temperature: 50,
  createdAt: { toMillis: () => Date.now() - 1000 },
} as unknown as PartnershipDoc;

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  mockUsePartnerships.mockReturnValue({ data: [born] });
  mockSegments = ['(app)'];
});

describe('BornCeremonyGate', () => {
  it('abre o modal uma única vez por parceria, mesmo com re-render', async () => {
    const { rerender } = await render(<BornCeremonyGate />);
    await flush();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/partnership-born', params: { id: 'p1' } });
    mockUsePartnerships.mockReturnValue({ data: [{ ...born }] });
    await rerender(<BornCeremonyGate />);
    await flush();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  // A tela de aceite e a de espera navegam para a raiz quando a parceria
  // nasce. Se o push do modal viesse antes, essa navegação derrubava o modal
  // e a cerimônia sumia. O Gate espera a pessoa sair dessas telas.
  it.each([
    ['aceite', ['(app)', 'invite', '[code]']],
    ['espera', ['(app)', 'onboarding', 'waiting']],
  ])('espera sair da tela de %s antes de abrir o modal', async (_tela, segments) => {
    mockSegments = segments;
    const { rerender } = await render(<BornCeremonyGate />);
    await flush();
    expect(mockPush).not.toHaveBeenCalled();

    mockSegments = ['(app)'];
    await rerender(<BornCeremonyGate />);
    await flush();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/partnership-born', params: { id: 'p1' } });
  });

  it('abre normalmente sobre outras telas, como a de digitar código', async () => {
    mockSegments = ['(app)', 'invite', 'enter'];
    await render(<BornCeremonyGate />);
    await flush();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('não abre nada sem parceria recém-nascida', async () => {
    mockUsePartnerships.mockReturnValue({ data: [{ ...born, status: 'paused' }] });
    await render(<BornCeremonyGate />);
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('rota partnership-born', () => {
  it('fechar grava a flag, volta, e remontar o app não reabre a cerimônia', async () => {
    await render(<PartnershipBornModal />);
    await flush();
    await fireEvent.press(screen.getByLabelText('Fechar'));
    await flush();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('ceremony:born:p1')).toBe('1');

    const lista = [born];
    const { result } = await renderHook(() => useBornCeremony(lista));
    await flush();
    expect(result.current.pending).toBeNull();
  });

  it('abrir o modal já grava a flag — o voltar do Android fecha sem passar pelo X', async () => {
    await render(<PartnershipBornModal />);
    await flush();
    expect(await AsyncStorage.getItem('ceremony:born:p1')).toBe('1');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('parceria inexistente redireciona para a raiz', async () => {
    mockUsePartnerships.mockReturnValue({ data: [] });
    await render(<PartnershipBornModal />);
    expect(screen.getByText('redirect:/')).toBeTruthy();
  });
});
