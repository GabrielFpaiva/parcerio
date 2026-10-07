import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Empurra o erro de um listener do Firestore para o estado da query, para a
 * tela ler por `q.error` (e traduzir com firestoreErrorMessage). O próximo
 * snapshot bem-sucedido limpa o erro via setQueryData.
 */
export function publishListenerError(qc: QueryClient, key: QueryKey, error: unknown): void {
  qc.getQueryCache()
    .find({ queryKey: key, exact: true })
    ?.setState({ error: error as Error, status: 'error', fetchStatus: 'idle' });
}
