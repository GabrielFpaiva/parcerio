import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { getDocs, onSnapshot, queryEqual, type Query } from 'firebase/firestore';
import { publishListenerError } from './publishListenerError';
import { useListenerRevival } from './useListenerRevival';

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

  const result = useQuery<T[]>({
    queryKey: key,
    enabled: q !== null,
    // O listener é quem mantém o cache em dia. Sem staleTime infinito, cada
    // observer novo (Gate, lista, Waiting) faria um getDocs no mount, e a
    // resposta podia chegar depois de um snapshot mais novo e sobrescrevê-lo.
    staleTime: Infinity,
    queryFn: async () => {
      const snap = await getDocs(q!);
      return snap.docs.map((d) => d.data() as T);
    },
  });
  const { generation, markDead } = useListenerRevival(result.dataUpdatedAt);

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
      (error) => {
        markDead();
        publishListenerError(qc, key, error);
      },
    );
    // `key` é serializável; a identidade do array muda a cada render.
  }, [current, qc, JSON.stringify(key), generation]);

  return result;
}
