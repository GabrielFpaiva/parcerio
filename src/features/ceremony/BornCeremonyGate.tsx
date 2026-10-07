import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';
import { usePartnerships } from '@/features/partnership/hooks/usePartnerships';
import { useBornCeremony } from './useBornCeremony';

/**
 * Montado dentro de (app), com sessão e perfil garantidos. Observa a mesma
 * query da lista e, quando uma parceria recém-nascida aparece, abre o modal.
 * A rota é um modal de tela cheia por cima da stack: ao fechar, a pessoa volta
 * exatamente onde estava.
 */
export function BornCeremonyGate() {
  const { user } = useAuth();
  const router = useRouter();
  const { pending } = useBornCeremony(usePartnerships(user?.uid ?? null).data);
  const opened = useRef<string | null>(null);

  useEffect(() => {
    if (pending === null || opened.current === pending.id) return;
    opened.current = pending.id;
    router.push({ pathname: '/partnership-born', params: { id: pending.id } } as never);
  }, [pending, router]);

  return null;
}
