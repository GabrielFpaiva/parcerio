import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { ReactNode } from 'react';
import { firestoreErrorMessage } from '../firestoreError';
import { useFirestoreCollection } from '../useFirestoreCollection';

const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn();
let mockEmit: ((snap: unknown) => void) | null = null;
let mockEmitError: ((err: unknown) => void) | null = null;

jest.mock('firebase/firestore', () => ({
  onSnapshot: (
    q: unknown,
    next: (snap: unknown) => void,
    onError: (err: unknown) => void,
  ) => {
    mockOnSnapshot(q);
    mockEmit = next;
    mockEmitError = onError;
    return mockUnsubscribe;
  },
  queryEqual: (a: { id: string }, b: { id: string }) => a.id === b.id,
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));
const mockGetDocs = jest.fn(async (..._args: unknown[]) => ({ docs: [] as unknown[] }));

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Probe() {
  // Query nova (mesmo conteúdo) a cada render, como no uso real.
  const q = useFirestoreCollection<{ name: string }>({ id: 'c' } as never, ['coll']);
  return (
    <>
      <Text testID="names">{q.data ? q.data.map((d) => d.name).join(',') || 'vazia' : 'carregando'}</Text>
      <Text testID="error">{q.error ? firestoreErrorMessage(q.error) : 'sem erro'}</Text>
      <Pressable testID="retry" onPress={() => void q.refetch()} />
    </>
  );
}

beforeEach(() => {
  client.clear();
  mockUnsubscribe.mockClear();
  mockOnSnapshot.mockClear();
  mockGetDocs.mockClear();
  mockEmit = null;
  mockEmitError = null;
});

const snapOf = (names: string[]) => ({ docs: names.map((name) => ({ data: () => ({ name }) })) });

it('publica os documentos e trata coleção vazia como []', async () => {
  await render(<Probe />, { wrapper });
  mockEmit?.(snapOf(['A', 'B']));
  await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('A,B'));
  mockEmit?.(snapOf([]));
  await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('vazia'));
});

it('expõe o erro do listener em q.error', async () => {
  await render(<Probe />, { wrapper });
  mockEmitError?.({ code: 'unavailable' });
  await waitFor(() =>
    expect(screen.getByTestId('error')).toHaveTextContent('Sem conexão. Tenta de novo.'),
  );
});

it('não reinscreve quando re-renderiza com query equivalente', async () => {
  const view = await render(<Probe />, { wrapper });
  await view.rerender(<Probe />);
  await view.rerender(<Probe />);
  expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  expect(mockUnsubscribe).not.toHaveBeenCalled();
});

it('cancela a inscrição ao desmontar', async () => {
  const view = await render(<Probe />, { wrapper });
  await view.unmount();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

it('reinscreve o listener quando a pessoa tenta de novo depois de um erro', async () => {
  // No Firestore o erro do onSnapshot é terminal: o listener não emite mais.
  // O refetch do "tentar de novo" precisa trazer o tempo real de volta.
  await render(<Probe />, { wrapper });
  mockEmitError?.({ code: 'unavailable' });
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Sem conexão. Tenta de novo.'));
  expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByTestId('retry'));
  await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1); // o morto foi desligado

  mockEmit?.(snapOf(['Ao vivo']));
  await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('Ao vivo'));
});

it('não reinscreve sozinho no erro — permission-denied viraria loop', async () => {
  await render(<Probe />, { wrapper });
  mockEmitError?.({ code: 'permission-denied' });
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Você não tem acesso a isso.'));
  expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
});

it('um observer novo não refaz a leitura nem sobrescreve o snapshot mais novo', async () => {
  await render(<Probe />, { wrapper });
  await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('vazia'));
  mockEmit?.(snapOf(['Novo']));
  await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('Novo'));

  // Outra tela monta o mesmo hook (Gate, lista, Waiting): o getDocs dela
  // voltaria o estado velho do servidor ([]) por cima do snapshot.
  await render(<><Probe /><Probe /></>, { wrapper });
  expect(mockGetDocs).toHaveBeenCalledTimes(1);
  for (const el of screen.getAllByTestId('names')) expect(el).toHaveTextContent('Novo');
});
