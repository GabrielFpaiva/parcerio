import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';
import { usePartnerships } from '@/features/partnership/hooks/usePartnerships';
import { useBornCeremony } from './useBornCeremony';

/**
 * Telas que, elas mesmas, navegam para a raiz quando a parceria nasce: o
 * aceite (depois do commit) e a espera de quem convidou (quando a parceria
 * aparece). Se o modal abrisse por cima delas, essa navegação o derrubaria e
 * a cerimônia sumiria. O Gate espera a pessoa sair, e então abre.
 */
const NAVIGATE_ON_BIRTH = new Set(['(app)/invite/[code]', '(app)/onboarding/waiting']);

/**
 * Montado dentro de (app), com sessão e perfil garantidos. Observa a mesma
 * query da lista e, quando uma parceria recém-nascida aparece, abre o modal.
 * A rota é um modal de tela cheia por cima da stack: ao fechar, a pessoa volta
 * exatamente onde estava.
 */
export function BornCeremonyGate() {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { pending } = useBornCeremony(usePartnerships(user?.uid ?? null).data);
  const opened = useRef<string | null>(null);
  const waitForNavigation = NAVIGATE_ON_BIRTH.has(segments.join('/'));

  useEffect(() => {
    if (pending === null || waitForNavigation || opened.current === pending.id) return;
    opened.current = pending.id;
    router.push({ pathname: '/partnership-born', params: { id: pending.id } });
  }, [pending, waitForNavigation, router]);

  return null;
}
