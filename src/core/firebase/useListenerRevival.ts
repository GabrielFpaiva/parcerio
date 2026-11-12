import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * No Firestore, o callback de erro do onSnapshot é terminal: aquele listener
 * não emite mais nada. O refetch do "tentar de novo" traz os dados de volta,
 * mas não o tempo real. Este hook marca o listener como morto no erro e,
 * quando dados novos chegam ao cache depois disso (o refetch que a pessoa
 * pediu), devolve uma geração nova — que entra nas deps do efeito do
 * listener e o reinscreve.
 *
 * Nunca reinscreve direto no erro: permission-denied viraria um loop. Só
 * dado que chegou com sucesso reinscreve, e um listener morto não produz
 * dado sozinho.
 */
export function useListenerRevival(dataUpdatedAt: number) {
  const [generation, setGeneration] = useState(0);
  const deadSince = useRef<number | null>(null);

  useEffect(() => {
    if (deadSince.current !== null && dataUpdatedAt > deadSince.current) {
      deadSince.current = null;
      setGeneration((g) => g + 1);
    }
  }, [dataUpdatedAt]);

  const markDead = useCallback(() => {
    deadSince.current = Date.now();
  }, []);

  return { generation, markDead };
}
