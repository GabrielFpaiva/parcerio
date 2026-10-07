import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Avatar } from '@/core/ui/Avatar';
import { XParceriaBar } from '@/core/ui/XParceriaBar';
import { theme } from '@/core/ui/theme';
import { XP } from '@shared/constants';
import type { PartnershipDoc } from '@shared/types';

type Props = {
  partnership: PartnershipDoc;
  onDismiss: () => void;
};

// Roteiro: tudo assentado em ~2,4 s (theme.motion.duration.ceremony).
// Cada passo entra depois do anterior; a conquista, por último, carrega o clímax.
const AT = {
  avatars: 0,
  handshake: 550,
  level: 850,
  bar: 1150,
  achievement: 1900,
} as const;
const AVATAR_OFFSET = 90;
const FALLBACK_PROFILE = { displayName: 'Parceiro', photoURL: null, avatarEmoji: '🙂' };

export function PartnershipBornCeremony({ partnership, onDismiss }: Props) {
  const [uidA, uidB] = partnership.members;
  const left = partnership.memberProfiles[uidA] ?? FALLBACK_PROFILE;
  const right = partnership.memberProfiles[uidB] ?? FALLBACK_PROFILE;

  // 0 = escondido, 1 = assentado. Com movimento reduzido, tudo pula direto para 1.
  const approach = useSharedValue(0);
  const handshake = useSharedValue(0);
  const level = useSharedValue(0);
  const bar = useSharedValue(0);
  const achievement = useSharedValue(0);
  const closed = useRef(false);

  useEffect(() => {
    let cancelado = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Se a consulta falhar, o estado final é o mais seguro: nada fica invisível.
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => true).then((reduce) => {
      if (cancelado) return;
      if (reduce) {
        approach.value = 1;
        handshake.value = 1;
        level.value = 1;
        bar.value = 1;
        achievement.value = 1;
        // Um único toque: reduzir movimento não pede para calar o momento.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      approach.value = withDelay(AT.avatars, withSpring(1, theme.motion.spring.gentle));
      handshake.value = withDelay(AT.handshake, withSpring(1, theme.motion.spring.bouncy));
      level.value = withDelay(AT.level, withSpring(1, theme.motion.spring.bouncy));
      bar.value = withDelay(AT.bar, withTiming(1, { duration: theme.motion.duration.slow + 250 }));
      achievement.value = withDelay(AT.achievement, withSpring(1, theme.motion.spring.bouncy));
      timers.push(
        setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), AT.handshake),
        setTimeout(
          () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
          AT.achievement,
        ),
      );
    });

    return () => {
      cancelado = true;
      timers.forEach(clearTimeout);
    };
    // Shared values têm identidade estável; roda uma vez por montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: approach.value,
    transform: [{ translateX: -AVATAR_OFFSET * (1 - approach.value) }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: approach.value,
    transform: [{ translateX: AVATAR_OFFSET * (1 - approach.value) }],
  }));
  const handshakeStyle = useAnimatedStyle(() => ({
    opacity: handshake.value,
    transform: [
      { scale: 0.4 + 0.6 * handshake.value },
      { rotate: `${(1 - handshake.value) * -25}deg` },
    ],
  }));
  const levelStyle = useAnimatedStyle(() => ({
    opacity: level.value,
    transform: [{ scale: 0.6 + 0.4 * level.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: bar.value }],
    transformOrigin: 'left',
  }));
  const xpTextStyle = useAnimatedStyle(() => ({ opacity: bar.value }));
  const achievementStyle = useAnimatedStyle(() => ({
    opacity: achievement.value,
    transform: [{ translateY: 16 * (1 - achievement.value) }, { scale: 0.9 + 0.1 * achievement.value }],
  }));

  function close() {
    if (closed.current) return;
    closed.current = true;
    onDismiss();
  }

  return (
    <View style={styles.screen} testID="born-ceremony" accessibilityViewIsModal>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        disabled={false}
        hitSlop={12}
        onPress={close}
        style={styles.close}
      >
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>

      <View style={styles.center}>
        <View style={styles.pair}>
          <Animated.View style={leftStyle}>
            <Avatar photoURL={left.photoURL} fallbackEmoji={left.avatarEmoji} size={96} />
          </Animated.View>
          <Animated.Text style={[styles.handshake, handshakeStyle]}>🤝</Animated.Text>
          <Animated.View style={rightStyle}>
            <Avatar photoURL={right.photoURL} fallbackEmoji={right.avatarEmoji} size={96} />
          </Animated.View>
        </View>

        <Text style={styles.names}>{`${left.displayName} e ${right.displayName}`}</Text>
        <Animated.Text style={[styles.level, levelStyle]}>
          {`Parceria Nível ${partnership.level}`}
        </Animated.Text>

        <View style={styles.xp}>
          <XParceriaBar
            level={partnership.level}
            xpIntoLevel={partnership.xpIntoLevel}
            FillComponent={Animated.View}
            fillStyle={fillStyle as StyleProp<ViewStyle>}
            hideLabel
          />
          <Animated.Text style={[styles.xpText, xpTextStyle]}>
            {`+${XP.PARTNERSHIP_BORN} XParceria · Temperatura ${partnership.temperature}`}
          </Animated.Text>
        </View>

        <Animated.View style={[styles.achievement, achievementStyle]}>
          <Text style={styles.achievementKicker}>Conquista desbloqueada</Text>
          <Text style={styles.achievementName}>O Começo</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuar"
          disabled={false}
          onPress={close}
          style={styles.continue}
        >
          <Text style={styles.continueLabel}>Continuar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.paper[0] },
  close: {
    position: 'absolute',
    top: theme.space[7],
    right: theme.space[4],
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.paper[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 16, color: theme.colors.ink[700] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space[5], gap: theme.space[4] },
  pair: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  handshake: { fontSize: 44 },
  names: {
    fontSize: theme.type.headline.fontSize,
    fontWeight: '600',
    color: theme.colors.ink[500],
    textAlign: 'center',
  },
  level: {
    fontSize: theme.type.display.fontSize,
    fontWeight: '700',
    letterSpacing: theme.type.display.letterSpacing,
    color: theme.colors.ink[900],
    textAlign: 'center',
  },
  xp: { width: '100%', maxWidth: 320, gap: theme.space[2], alignItems: 'center' },
  xpText: { fontSize: theme.type.callout.fontSize, fontWeight: '500', color: theme.colors.ink[700] },
  achievement: {
    marginTop: theme.space[3],
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[5],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brand[100],
    alignItems: 'center',
    gap: theme.space[1],
  },
  achievementKicker: {
    fontSize: theme.type.micro.fontSize,
    fontWeight: '600',
    letterSpacing: theme.type.micro.letterSpacing,
    textTransform: 'uppercase',
    color: theme.colors.brand[600],
  },
  achievementName: { fontSize: theme.type.headline.fontSize, fontWeight: '700', color: theme.colors.ink[900] },
  footer: { padding: theme.space[5] },
  continue: {
    minHeight: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: { fontSize: theme.type.callout.fontSize, fontWeight: '600', color: theme.colors.paper[0] },
});
