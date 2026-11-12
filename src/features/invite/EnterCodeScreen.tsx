import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/core/ui/Button';
import { theme } from '@/core/ui/theme';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@shared/invite';

export function EnterCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const complete = code.length === INVITE_CODE_LENGTH;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tem um código?</Text>
      <Text style={styles.hint}>Digite o código que a outra pessoa te mandou.</Text>
      <TextInput
        accessibilityLabel="Código do convite"
        placeholder="AB3D4F7H"
        value={code}
        onChangeText={(text) => setCode(normalizeInviteCode(text).slice(0, INVITE_CODE_LENGTH))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INVITE_CODE_LENGTH + 2}
        style={styles.input}
      />
      <Button
        label="Continuar"
        disabled={!complete}
        onPress={() => router.push(`/invite/${code}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.space[5], gap: theme.space[3] },
  title: { fontSize: theme.type.title.fontSize, fontWeight: '700', color: theme.colors.ink[900] },
  hint: { fontSize: theme.type.body.fontSize, color: theme.colors.ink[500] },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper[100],
    paddingHorizontal: theme.space[4],
    fontSize: theme.type.headline.fontSize,
    letterSpacing: 2,
  },
});
