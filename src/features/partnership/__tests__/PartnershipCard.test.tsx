import { fireEvent, render, screen } from '@testing-library/react-native';
import { PartnershipCard } from '../PartnershipCard';
import type { PartnershipDoc } from '@shared/types';

const base = {
  id: 'a_b',
  members: ['a', 'b'],
  memberProfiles: {
    a: { displayName: 'Alice', photoURL: null, avatarEmoji: '🦊' },
    b: { displayName: 'Bob', photoURL: null, avatarEmoji: '🐢' },
  },
  status: 'active',
  level: 3,
  xparceria: 400,
  xpIntoLevel: 40,
  xpForNextLevel: 144,
  temperature: 72,
  temperatureBand: 'warm',
} as unknown as PartnershipDoc;

it('mostra o parceiro, não o próprio usuário', async () => {
  await render(<PartnershipCard partnership={base} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Bob')).toBeTruthy();
  expect(screen.queryByText('Alice')).toBeNull();
});

it('visto pelo outro lado, mostra o outro parceiro', async () => {
  await render(<PartnershipCard partnership={base} viewerUid="b" onPress={jest.fn()} />);
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(screen.queryByText('Bob')).toBeNull();
});

it('mostra o nível e a banda de temperatura', async () => {
  await render(<PartnershipCard partnership={base} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Nível 3')).toBeTruthy();
  expect(screen.getByText('Aquecida')).toBeTruthy();
});

it('marca a parceria pausada, para o mapa desligado não parecer bug', async () => {
  const paused = { ...base, status: 'paused' } as PartnershipDoc;
  await render(<PartnershipCard partnership={paused} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Pausada')).toBeTruthy();
});

it('não marca "Pausada" numa parceria ativa', async () => {
  await render(<PartnershipCard partnership={base} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.queryByText('Pausada')).toBeNull();
});

it('deriva a banda da temperatura em vez de confiar no campo gravado', async () => {
  const inconsistente = { ...base, temperature: 10, temperatureBand: 'burning' } as PartnershipDoc;
  await render(<PartnershipCard partnership={inconsistente} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Hibernando')).toBeTruthy();
  expect(screen.queryByText('Em chamas')).toBeNull();
});

it('chama onPress ao tocar no card', async () => {
  const onPress = jest.fn();
  await render(<PartnershipCard partnership={base} viewerUid="a" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('dado inconsistente (sem o outro membro) cai em "Parceiro", nunca no próprio usuário', async () => {
  const broken = { ...base, members: ['a'] } as unknown as PartnershipDoc;
  await render(<PartnershipCard partnership={broken} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Parceiro')).toBeTruthy();
  expect(screen.queryByText('Alice')).toBeNull();
});
