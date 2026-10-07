import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ReactNode } from 'react';
import { firestoreErrorMessage } from '../firestoreError';
import { useFirestoreDoc } from '../useFirestoreDoc';

const mockUnsubscribe = jest.fn();
let mockEmit: ((snap: unknown) => void) | null = null;
let mockEmitError: ((err: unknown) => void) | null = null;

jest.mock('firebase/firestore', () => ({
  onSnapshot: (
    _ref: unknown,
    next: (snap: unknown) => void,
    onError: (err: unknown) => void,
  ) => {
    mockEmit = next;
    mockEmitError = onError;
    return mockUnsubscribe;
  },
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => undefined })),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Probe() {
  const q = useFirestoreDoc<{ name: string }>({ id: 'x' } as never, ['probe']);
  return (
    <>
      <Text testID="error">{q.error ? firestoreErrorMessage(q.error) : 'sem erro'}</Text>
      <Text testID="value">{q.data?.name ?? 'vazio'}</Text>
      <Text testID="state">{q.data === null ? 'null' : q.data === undefined ? 'undefined' : 'doc'}</Text>
    </>
  );
}

beforeEach(() => {
  mockUnsubscribe.mockClear();
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
