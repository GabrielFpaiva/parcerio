import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { getDoc, onSnapshot, type DocumentReference } from 'firebase/firestore';

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

  useEffect(() => {
    if (ref === null) return;
    return onSnapshot(ref, (snap) => {
      qc.setQueryData<T | null>(key, snap.exists() ? (snap.data() as T) : null);
    });
    // `key` é serializável; a identidade do array muda a cada render.
  }, [ref?.path, qc, JSON.stringify(key)]);

  return useQuery<T | null>({
    queryKey: key,
    enabled: ref !== null,
    queryFn: async () => {
      const snap = await getDoc(ref!);
      return snap.exists() ? (snap.data() as T) : null;
    },
  });
}
