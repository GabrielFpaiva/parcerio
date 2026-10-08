import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Empurra o erro de um listener do Firestore para o estado da query, para a
 * tela ler por `q.error` (e traduzir com firestoreErrorMessage). O listener
 * que errou não emite mais: quem limpa o erro é o refetch do "tentar de
 * novo", que também reinscreve o listener (useListenerRevival).
 */
export function publishListenerError(qc: QueryClient, key: QueryKey, error: unknown): void {
  qc.getQueryCache()
    .find({ queryKey: key, exact: true })
    ?.setState({ error: error as Error, status: 'error', fetchStatus: 'idle' });
}
