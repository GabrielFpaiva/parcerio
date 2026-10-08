import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { getDoc, onSnapshot, type DocumentReference } from 'firebase/firestore';
import { publishListenerError } from './publishListenerError';
import { useListenerRevival } from './useListenerRevival';

/**
 * Único ponto de integração entre o listener do Firestore e o cache do React
 * Query. O listener empurra para o cache; o componente lê pelo useQuery e não
 * sabe que existe tempo real. Nenhum componente chama onSnapshot direto.
 */
export function useFirestoreDoc<T>(
  ref: DocumentReference | null,
  key: QueryKey,
): UseQueryResult<T | null> {
  const qc = useQueryClient();

  const result = useQuery<T | null>({
    queryKey: key,
    enabled: ref !== null,
    // Ver useFirestoreCollection: o listener mantém o cache; um getDoc por
    // observer novo podia sobrescrever um snapshot mais novo.
    staleTime: Infinity,
    queryFn: async () => {
      const snap = await getDoc(ref!);
      return snap.exists() ? (snap.data() as T) : null;
    },
  });
  const { generation, markDead } = useListenerRevival(result.dataUpdatedAt);

  useEffect(() => {
    if (ref === null) return;
    return onSnapshot(
      ref,
      (snap) => {
        qc.setQueryData<T | null>(key, snap.exists() ? (snap.data() as T) : null);
      },
      (error) => {
        markDead();
        publishListenerError(qc, key, error);
      },
    );
    // `key` é serializável; a identidade do array muda a cada render.
  }, [ref?.path, qc, JSON.stringify(key), generation]);

  return result;
}
