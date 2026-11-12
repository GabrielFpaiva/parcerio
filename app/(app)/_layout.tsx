import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/core/auth/useAuth';
import { ErrorState } from '@/core/ui/ErrorState';
import { BornCeremonyGate } from '@/features/ceremony/BornCeremonyGate';
import { useProfile } from '@/features/profile/hooks/useProfile';

// Guarda de sessão + guarda de perfil: sem perfil criado, não entra no app.
export default function AppLayout() {
  const { status, user } = useAuth();
  const profile = useProfile(user?.uid ?? null);
  const insets = useSafeAreaInsets();

  if (status === 'loading' || (status === 'signedIn' && profile.isLoading)) {
    return (
      <View testID="app-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  // Query falhou (rede caiu, permissão negada) — data vem undefined, não null.
  // Não redireciona pra /profile-setup: a pessoa pode já ter perfil, e mandá-la
  // criar outro seria pior que mostrar o erro com opção de tentar de novo.
  if (profile.isError) {
    return (
      <ErrorState
        message="Não consegui carregar seu perfil. Verifica a conexão."
        onRetry={() => void profile.refetch()}
      />
    );
  }
  // Frouxa de propósito: depois do isError acima, o único jeito de `data` ainda
  // ser undefined aqui é um resíduo do estado anterior à guarda de erro. `===`
  // estrito reintroduziria o bug de deixar `undefined` passar como "tem perfil".
  if (profile.data == null) return <Redirect href="/profile-setup" />;

  return (
    <>
      {/* Sem header, cada tela encostaria no notch e no indicador de home. A
          área segura fica num lugar só, para todas as telas do app. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        }}
      />
      <BornCeremonyGate />
    </>
  );
}
