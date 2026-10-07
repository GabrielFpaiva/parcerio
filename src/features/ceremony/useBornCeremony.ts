import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
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

    // `avaliadas` só recebe uma parceria depois da decisão: uma execução
    // cancelada no meio do await não reserva nada, e a seguinte reavalia.
    // getItem/setItem são idempotentes, então reavaliar é seguro.
    void (async () => {
      for (const p of partnerships) {
        if (p.status !== 'active' || avaliadas.current.has(p.id)) continue;

        const jaVista = (await AsyncStorage.getItem(chave(p.id))) !== null;
        if (cancelado) return;
        if (jaVista) {
          avaliadas.current.add(p.id);
          continue;
        }

        // createdAt ausente vira 0 ("antiga"): hoje o nascimento é transacional
        // e o listener só vê o doc com o timestamp já resolvido.
        const nascidaMs = (p.createdAt as Timestamp | null)?.toMillis?.() ?? 0;
        if (Date.now() - nascidaMs > JANELA_MS) {
          await markCeremonySeen(p.id); // vista em silêncio
          avaliadas.current.add(p.id);
          continue;
        }
        avaliadas.current.add(p.id);
        setPending(p);
        return;
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [partnerships]);

  return { pending };
}
