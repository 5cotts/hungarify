import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModuleCard } from '@/src/components/ModuleCard';
import { getAllModuleStats, getStreak } from '@/src/db/progress';
import { MODULE_IDS, MODULE_LABELS, type ModuleId } from '@/src/engine';
import { colors, spacing, typography } from '@/src/theme';

const MODULE_COPY: Record<ModuleId, { title: string; description: string }> = {
  conjugation: {
    title: MODULE_LABELS.conjugation,
    description: 'Present and past forms, definite vs indefinite objects.',
  },
  cases: {
    title: MODULE_LABELS.cases,
    description: 'Inessive, dative, illative, and other noun endings.',
  },
  vowelHarmony: {
    title: MODULE_LABELS.vowelHarmony,
    description: 'Back, front rounded, and front unrounded harmony.',
  },
  wordOrder: {
    title: MODULE_LABELS.wordOrder,
    description: 'Topic, focus, and natural sentence order.',
  },
  numbers: {
    title: MODULE_LABELS.numbers,
    description: 'Cardinals, time expressions, and useful phrases.',
  },
};

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAllModuleStats>> | null>(null);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    const [s, st] = await Promise.all([getAllModuleStats(MODULE_IDS), getStreak()]);
    setStats(s);
    setStreak(st);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Practice Hungarian</Text>
        <Text style={styles.sub}>
          Short drills on core grammar. Streak: {streak} correct in a row (latest attempts).
        </Text>
        <View style={styles.list}>
          {MODULE_IDS.map((id) => {
            const m = stats?.[id];
            return (
              <ModuleCard
                key={id}
                title={MODULE_COPY[id].title}
                description={MODULE_COPY[id].description}
                accuracy={m?.accuracy ?? 0}
                totalAttempts={m?.total ?? 0}
                onPractice={() => router.push(`/exercise/${id}`)}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  list: {},
});
