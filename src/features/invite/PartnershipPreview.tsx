import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Avatar } from '@/core/ui/Avatar';
import { GlassCard } from '@/core/ui/GlassCard';
import { theme } from '@/core/ui/theme';
import { XParceriaBar } from '@/core/ui/XParceriaBar';

function useReduceMotion(): boolean {
  // Começa parado: só anima depois de saber que a pessoa não pediu o contrário.
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduce;
}

function PreviewCard() {
  return (
    <GlassCard>
      <View style={styles.row}>
        <Avatar photoURL={null} fallbackEmoji="🦊" size={44} temperature={82} />
        <Avatar photoURL={null} fallbackEmoji="🐻" size={44} temperature={82} />
        <View style={styles.info}>
          <Text style={styles.name}>Vocês, daqui a um tempo</Text>
          <Text style={styles.level}>Nível 12</Text>
        </View>
      </View>
      <View style={styles.bar}>
        <XParceriaBar level={12} xpIntoLevel={620} />
      </View>
    </GlassCard>
  );
}

function FloatingCard() {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: theme.motion.duration.ceremony / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: theme.motion.duration.ceremony / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View testID="preview-animated" style={style}>
      <PreviewCard />
    </Animated.View>
  );
}

/** Parceria fictícia nível 12: mostra o que o convite vai virar. Parado se o sistema pede menos movimento. */
export function PartnershipPreview() {
  const reduce = useReduceMotion();
  return reduce
    ? <View testID="preview-static"><PreviewCard /></View>
    : <FloatingCard />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  info: { flex: 1, marginLeft: theme.space[2] },
  name: { fontSize: theme.type.callout.fontSize, fontWeight: '600', color: theme.colors.ink[900] },
  level: { fontSize: theme.type.caption.fontSize, color: theme.colors.ink[500] },
  bar: { marginTop: theme.space[3] },
});
