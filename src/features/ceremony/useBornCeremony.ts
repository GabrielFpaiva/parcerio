import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import type { PartnershipDoc } from '@shared/types';

const JANELA_MS = 5 * 60 * 1000;
const chave = (pid: string) => `ceremony:born:${pid}`;

export async function markCeremonySeen(pid: string): Promise<void> {
  await AsyncStorage.setItem(chave(pid), '1');
}

/**
 * Dispara a cerimônia nos dois aparelhos sem push e sem polling: os dois já
 * escutam a mesma query, e a parceria aparecendo é o próprio sinal.
 *
 * A janela de 5 minutos existe para quem reinstala o app: sem ela, o
 * AsyncStorage vazio faria chover uma cerimônia por parceria antiga.
 */
export function useBornCeremony(partnerships: PartnershipDoc[] | undefined) {
  const [pending, setPending] = useState<PartnershipDoc | null>(null);
  const avaliadas = useRef(new Set<string>());

  useEffect(() => {
    if (partnerships === undefined) return;
    let cancelado = false;

    void (async () => {
      for (const p of partnerships) {
        if (cancelado) return;
        if (p.status !== 'active' || avaliadas.current.has(p.id)) continue;
        avaliadas.current.add(p.id);

        const jaVista = (await AsyncStorage.getItem(chave(p.id))) !== null;
        if (cancelado) {
          // A próxima execução do efeito precisa reavaliar esta parceria.
          avaliadas.current.delete(p.id);
          return;
        }
        if (jaVista) continue;

        const nascidaMs = (p.createdAt as Timestamp | null)?.toMillis?.() ?? 0;
        if (Date.now() - nascidaMs > JANELA_MS) {
          await markCeremonySeen(p.id); // vista em silêncio
          continue;
        }
        if (cancelado) {
          avaliadas.current.delete(p.id);
          return;
        }
        setPending(p);
        return;
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [partnerships]);

  const dismiss = useCallback(async () => {
    if (pending === null) return;
    await markCeremonySeen(pending.id);
    setPending(null);
  }, [pending]);

  return { pending, dismiss };
}
