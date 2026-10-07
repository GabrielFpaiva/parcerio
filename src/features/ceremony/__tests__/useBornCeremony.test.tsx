import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PartnershipDoc, PartnershipStatus } from '@shared/types';
import { markCeremonySeen, useBornCeremony } from '../useBornCeremony';

function partnership(id: string, ageMs: number, status: PartnershipStatus = 'active'): PartnershipDoc {
  return {
    id,
    status,
    createdAt: { toMillis: () => Date.now() - ageMs },
  } as unknown as PartnershipDoc;
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useBornCeremony', () => {
  it('celebra uma parceria recém-nascida ainda não vista', async () => {
    const lista = [partnership('p1', 1000)];
    const { result } = await renderHook(() => useBornCeremony(lista));
    await waitFor(() => expect(result.current.pending?.id).toBe('p1'));
  });

  it('não celebra duas vezes — a flag no AsyncStorage é o que impede a reprise', async () => {
    const lista = [partnership('p1', 1000)];
    const first = await renderHook(() => useBornCeremony(lista));
    await waitFor(() => expect(first.result.current.pending).not.toBeNull());
    await act(async () => {
      await markCeremonySeen('p1');
    });
    await first.unmount();

    const second = await renderHook(() => useBornCeremony(lista));
    await flush();
    expect(second.result.current.pending).toBeNull();
  });

  it('não celebra parceria antiga em instalação nova', async () => {
    const lista = [partnership('old', 3 * 24 * 60 * 60 * 1000)];
    const { result } = await renderHook(() => useBornCeremony(lista));
    await flush();
    expect(await AsyncStorage.getItem('ceremony:born:old')).toBe('1');
    expect(result.current.pending).toBeNull();
  });

  it('ignora parceria pausada ou encerrada', async () => {
    const lista = [partnership('a', 1000, 'paused'), partnership('b', 1000, 'ended'), partnership('c', 1000, 'hibernating')];
    const { result } = await renderHook(() => useBornCeremony(lista));
    await flush();
    expect(result.current.pending).toBeNull();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('celebra uma parceria que aparece depois, sem reprisar a anterior', async () => {
    const a = partnership('a', 1000);
    const b = partnership('b', 500);
    const { result, rerender } = await renderHook(
      (props: { lista: PartnershipDoc[] }) => useBornCeremony(props.lista),
      { initialProps: { lista: [a] } },
    );
    await waitFor(() => expect(result.current.pending?.id).toBe('a'));
    await act(async () => {
      await markCeremonySeen('a');
    });
    await rerender({ lista: [a, b] });
    await waitFor(() => expect(result.current.pending?.id).toBe('b'));
  });

  it('reavalia a parceria quando a lista muda no meio do getItem e celebra uma única vez', async () => {
    let resolveFirst: (v: string | null) => void = () => {};
    const getItem = AsyncStorage.getItem as jest.Mock;
    getItem.mockClear();
    getItem.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve; }),
    );
    const p = partnership('p1', 1000);
    const { result, rerender } = await renderHook(
      (props: { lista: PartnershipDoc[] }) => useBornCeremony(props.lista),
      { initialProps: { lista: [p] } },
    );
    await rerender({ lista: [p] }); // nova referência, mesma parceria, antes do getItem voltar
    await flush();
    expect(result.current.pending?.id).toBe('p1');
    await act(async () => {
      resolveFirst(null); // o efeito cancelado acorda tarde e não pode interferir
    });
    await flush();
    expect(result.current.pending?.id).toBe('p1');
    expect(getItem).toHaveBeenCalledTimes(2);
  });
});
