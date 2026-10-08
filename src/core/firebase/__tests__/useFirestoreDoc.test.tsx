import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { ReactNode } from 'react';
import { firestoreErrorMessage } from '../firestoreError';
import { useFirestoreDoc } from '../useFirestoreDoc';

const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn();
let mockEmit: ((snap: unknown) => void) | null = null;
let mockEmitError: ((err: unknown) => void) | null = null;

jest.mock('firebase/firestore', () => ({
  onSnapshot: (
    _ref: unknown,
    next: (snap: unknown) => void,
    onError: (err: unknown) => void,
  ) => {
    mockOnSnapshot();
    mockEmit = next;
    mockEmitError = onError;
    return mockUnsubscribe;
  },
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));
const mockGetDoc = jest.fn(async (..._args: unknown[]) => ({ exists: () => false, data: () => undefined }));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Probe() {
  const q = useFirestoreDoc<{ name: string }>({ id: 'x' } as never, ['probe']);
  return (
    <>
      <Text testID="error">{q.error ? firestoreErrorMessage(q.error) : 'sem erro'}</Text>
      <Text testID="value">{q.data?.name ?? 'vazio'}</Text>
      <Text testID="state">{q.data === null ? 'null' : q.data === undefined ? 'undefined' : 'doc'}</Text>
      <Pressable testID="retry" onPress={() => void q.refetch()} />
    </>
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockUnsubscribe.mockClear();
  mockOnSnapshot.mockClear();
  mockGetDoc.mockClear();
  mockEmit = null;
  mockEmitError = null;
});

it('publica o snapshot no cache do React Query', async () => {
  await render(<Probe />, { wrapper });
  mockEmit?.({ exists: () => true, data: () => ({ name: 'Alice' }) });
  await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Alice'));
});

it('trata documento inexistente como null, não como carregando', async () => {
  await render(<Probe />, { wrapper });
  mockEmit?.({ exists: () => true, data: () => ({ name: 'Alice' }) });
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('doc'));
  mockEmit?.({ exists: () => false, data: () => undefined });
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'));
});

it('cancela a inscrição ao desmontar', async () => {
  const view = await render(<Probe />, { wrapper });
  await view.unmount();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

it('expõe o erro do listener em q.error', async () => {
  await render(<Probe />, { wrapper });
  mockEmitError?.({ code: 'permission-denied' });
  await waitFor(() =>
    expect(screen.getByTestId('error')).toHaveTextContent('Você não tem acesso a isso.'),
  );
});

it('reinscreve o listener quando a pessoa tenta de novo depois de um erro', async () => {
  await render(<Probe />, { wrapper });
  mockEmitError?.({ code: 'unavailable' });
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Sem conexão. Tenta de novo.'));
  expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByTestId('retry'));
  await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));

  mockEmit?.({ exists: () => true, data: () => ({ name: 'Ao vivo' }) });
  await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Ao vivo'));
});

it('não reinscreve sozinho no erro — permission-denied viraria loop', async () => {
  await render(<Probe />, { wrapper });
  mockEmitError?.({ code: 'permission-denied' });
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Você não tem acesso a isso.'));
  expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
});

it('um observer novo não refaz a leitura nem sobrescreve o snapshot mais novo', async () => {
  await render(<Probe />, { wrapper });
  await waitFor(() => expect(mockGetDoc).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'));
  mockEmit?.({ exists: () => true, data: () => ({ name: 'Novo' }) });
  await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Novo'));

  await render(<><Probe /><Probe /></>, { wrapper });
  expect(mockGetDoc).toHaveBeenCalledTimes(1);
  for (const el of screen.getAllByTestId('value')) expect(el).toHaveTextContent('Novo');
});
