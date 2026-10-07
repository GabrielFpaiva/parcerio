import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { getDocs, onSnapshot, queryEqual, type Query } from 'firebase/firestore';
import { publishListenerError } from './publishListenerError';

/** Versão coleção de useFirestoreDoc: mesma ponte listener -> cache. */
export function useFirestoreCollection<T>(
  q: Query | null,
  key: QueryKey,
): UseQueryResult<T[]> {
  const qc = useQueryClient();

  // A query costuma ser montada inline; só troca de identidade se for outra
  // query de fato, para não reinscrever o listener a cada render.
  const stable = useRef<Query | null>(q);
  if (q === null || stable.current === null || !queryEqual(stable.current, q)) {
    stable.current = q;
  }
  const current = stable.current;

  useEffect(() => {
    if (current === null) return;
    return onSnapshot(
      current,
      (snap) => {
        qc.setQueryData<T[]>(
          key,
          snap.docs.map((d) => d.data() as T),
        );
      },
      (error) => publishListenerError(qc, key, error),
    );
    // `key` é serializável; a identidade do array muda a cada render.
  }, [current, qc, JSON.stringify(key)]);

  return useQuery<T[]>({
    queryKey: key,
    enabled: q !== null,
    queryFn: async () => {
      const snap = await getDocs(q!);
      return snap.docs.map((d) => d.data() as T);
    },
  });
}
