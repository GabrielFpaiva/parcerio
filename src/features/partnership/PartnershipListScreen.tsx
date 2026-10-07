import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';
import { firestoreErrorMessage } from '@/core/firebase/firestoreError';
import { Button } from '@/core/ui/Button';
import { ErrorState } from '@/core/ui/ErrorState';
import { theme } from '@/core/ui/theme';
import { usePartnerships } from './hooks/usePartnerships';
import { PartnershipCard } from './PartnershipCard';

function Skeleton() {
  return (
    <View testID="partnership-skeleton" style={styles.list}>
      {[0, 1, 2].map((i) => <View key={i} style={styles.skeletonCard} />)}
    </View>
  );
}

export function PartnershipListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const q = usePartnerships(uid);

  if (q.isError) {
    return (
      <ErrorState message={firestoreErrorMessage(q.error)} onRetry={() => void q.refetch()} />
    );
  }
  if (uid === null || q.isLoading || q.data === undefined) return <Skeleton />;

  if (q.data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Quem você quer chamar?</Text>
        <Text style={styles.body}>
          Uma parceria começa quando duas pessoas decidem se encontrar mais. Chama alguém.
        </Text>
        <View style={styles.actions}>
          <Button label="Convidar um parceiro" onPress={() => router.push('/onboarding/first-invite')} />
          <Button label="Tenho um convite" variant="ghost" onPress={() => router.push('/invite/enter' as never)} />
        </View>
      </View>
    );
  }

  // A query já ordena; reordenar aqui garante a ordem mesmo se o cache vier de outra fonte.
  const sorted = [...q.data].sort((a, b) => b.temperature - a.temperature);
  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={sorted}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <PartnershipCard
          partnership={item}
          viewerUid={uid}
          onPress={() => router.push({ pathname: '/partnership/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.space[4], gap: theme.space[3] },
  skeletonCard: {
    height: 112,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.ink[100],
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.space[5],
    gap: theme.space[4],
  },
  title: {
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
    color: theme.colors.ink[900],
  },
  body: {
    fontSize: theme.type.body.fontSize,
    lineHeight: theme.type.body.lineHeight,
    color: theme.colors.ink[700],
  },
  actions: { gap: theme.space[2], marginTop: theme.space[3] },
});
