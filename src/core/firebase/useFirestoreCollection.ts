import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { getDocs, onSnapshot, type Query } from 'firebase/firestore';

/** Versão coleção de useFirestoreDoc: mesma ponte listener -> cache. */
export function useFirestoreCollection<T>(
  q: Query | null,
  key: QueryKey,
): UseQueryResult<T[]> {
  const qc = useQueryClient();

  useEffect(() => {
    if (q === null) return;
    return onSnapshot(q, (snap) => {
      qc.setQueryData<T[]>(
        key,
        snap.docs.map((d) => d.data() as T),
      );
    });
    // `key` é serializável; a identidade do array muda a cada render.
  }, [q, qc, JSON.stringify(key)]);

  return useQuery<T[]>({
    queryKey: key,
    enabled: q !== null,
    queryFn: async () => {
      const snap = await getDocs(q!);
      return snap.docs.map((d) => d.data() as T);
    },
  });
}
