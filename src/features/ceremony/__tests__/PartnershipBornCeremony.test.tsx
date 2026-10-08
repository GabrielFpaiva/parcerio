import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { PartnershipDoc } from '@shared/types';
import { PartnershipBornCeremony } from '../PartnershipBornCeremony';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const partnership = {
  id: 'p1',
  members: ['u1', 'u2'],
  memberProfiles: {
    u1: { displayName: 'Gabriel', photoURL: null, avatarEmoji: '🦊' },
    u2: { displayName: 'João', photoURL: null, avatarEmoji: '🐻' },
  },
  level: 1,
  xpIntoLevel: 100,
  xpForNextLevel: 200,
  temperature: 50,
} as unknown as PartnershipDoc;

function mockReduceMotion(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReduceMotion(false);
});

describe('PartnershipBornCeremony', () => {
  it('mostra os dois nomes e "Parceria Nível 1"', async () => {
    await render(<PartnershipBornCeremony partnership={partnership} onDismiss={jest.fn()} />);
    expect(screen.getByText('Gabriel e João')).toBeTruthy();
    expect(screen.getByText('Parceria Nível 1')).toBeTruthy();
  });

  it('mostra "+100 XParceria" e "Temperatura 50"', async () => {
    await render(<PartnershipBornCeremony partnership={partnership} onDismiss={jest.fn()} />);
    expect(screen.getByText(/\+100 XParceria/)).toBeTruthy();
    expect(screen.getByText(/Temperatura 50/)).toBeTruthy();
  });

  it('mostra a conquista "O Começo"', async () => {
    await render(<PartnershipBornCeremony partnership={partnership} onDismiss={jest.fn()} />);
    expect(screen.getByText('O Começo')).toBeTruthy();
  });

  it('fechar chama dismiss exatamente uma vez, mesmo com toque duplo', async () => {
    const onDismiss = jest.fn();
    await render(<PartnershipBornCeremony partnership={partnership} onDismiss={onDismiss} />);
    await fireEvent.press(screen.getByLabelText('Fechar'));
    await fireEvent.press(screen.getByLabelText('Continuar'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('com movimento reduzido mostra tudo, dá um único háptico e ainda fecha', async () => {
    mockReduceMotion(true);
    const onDismiss = jest.fn();
    await render(<PartnershipBornCeremony partnership={partnership} onDismiss={onDismiss} />);
    await act(async () => {});
    expect(screen.getByText('Parceria Nível 1')).toBeTruthy();
    expect(screen.getByText('O Começo')).toBeTruthy();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('com animação, o háptico do clímax dispara na conquista', async () => {
    jest.useFakeTimers();
    try {
      await render(<PartnershipBornCeremony partnership={partnership} onDismiss={jest.fn()} />);
      await act(async () => {});
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(2500);
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

it('o X e o "Continuar" ficam fora da Dynamic Island e do indicador de home', async () => {
  const insets = { top: 59, bottom: 34, left: 0, right: 0 };
  await render(
    <SafeAreaProvider initialMetrics={{ insets, frame: { x: 0, y: 0, width: 393, height: 852 } }}>
      <PartnershipBornCeremony partnership={partnership} onDismiss={jest.fn()} />
    </SafeAreaProvider>,
  );
  const close = StyleSheet.flatten(screen.getByLabelText('Fechar').props.style);
  expect(close.top).toBeGreaterThanOrEqual(59);
  const footer = StyleSheet.flatten(screen.getByTestId('born-ceremony-footer').props.style);
  expect(footer.paddingBottom).toBeGreaterThanOrEqual(34);
});
