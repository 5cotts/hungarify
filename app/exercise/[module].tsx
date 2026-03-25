import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackBanner } from '@/src/components/FeedbackBanner';
import { FillInBlank } from '@/src/components/FillInBlank';
import { MultipleChoice } from '@/src/components/MultipleChoice';
import { WordSorter } from '@/src/components/WordSorter';
import { recordAttempt } from '@/src/db/progress';
import {
  checkAnswer,
  generateExercise,
  isModuleId,
  MODULE_LABELS,
  type Difficulty,
  type Exercise,
} from '@/src/engine';
import { colors, radii, spacing, typography } from '@/src/theme';

const LESSON_CHIPS = [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export default function ExerciseScreen() {
  const navigation = useNavigation();
  const { module: moduleParam } = useLocalSearchParams<{ module: string }>();
  const module = typeof moduleParam === 'string' ? moduleParam : '';

  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [fillValue, setFillValue] = useState('');
  const [wordOrder, setWordOrder] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  /** null = all lessons for knowledge-backed drills */
  const [lessonFilter, setLessonFilter] = useState<number | null>(null);

  const loadExercise = useCallback(() => {
    if (!isModuleId(module)) return;
    setLoading(true);
    setSubmitted(false);
    setSelected(null);
    setFillValue('');
    setLastCorrect(false);
    try {
      const ex = generateExercise(module, difficulty, { lessonNumber: lessonFilter });
      setExercise(ex);
      if (ex.type === 'wordOrder' && ex.words) {
        setWordOrder([...ex.words]);
      }
    } finally {
      setLoading(false);
    }
  }, [module, difficulty, lessonFilter]);

  useLayoutEffect(() => {
    if (isModuleId(module)) {
      navigation.setOptions({ title: MODULE_LABELS[module] });
    }
  }, [module, navigation]);

  useLayoutEffect(() => {
    loadExercise();
  }, [loadExercise]);

  const onSubmit = async () => {
    if (!exercise || !isModuleId(module)) return;
    let user: string | string[] = '';
    if (exercise.type === 'multipleChoice' || exercise.type === 'classify') {
      if (!selected) return;
      user = selected;
    } else if (exercise.type === 'fillInBlank') {
      if (!fillValue.trim()) return;
      user = fillValue;
    } else if (exercise.type === 'wordOrder') {
      user = wordOrder;
    }
    const ok = checkAnswer(exercise, user);
    setLastCorrect(ok);
    setSubmitted(true);
    await recordAttempt(module, exercise.id, ok);
  };

  const onNext = () => {
    loadExercise();
  };

  if (!isModuleId(module)) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.error}>Unknown module.</Text>
      </SafeAreaView>
    );
  }

  const diffButtons = (
    <View style={styles.diffRow}>
      {DIFFICULTIES.map((d) => (
        <Pressable
          key={d}
          onPress={() => setDifficulty(d)}
          style={({ pressed }) => [
            styles.diffChip,
            difficulty === d && styles.diffChipOn,
            pressed && styles.diffPressed,
          ]}>
          <Text style={[styles.diffText, difficulty === d && styles.diffTextOn]}>{d}</Text>
        </Pressable>
      ))}
    </View>
  );

  const lessonRow = (
    <View style={styles.lessonSection}>
      <Text style={styles.lessonLabel}>Knowledge drills (lesson)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lessonScroll}>
        {LESSON_CHIPS.map((n) => {
          const active = lessonFilter === n;
          const label = n == null ? 'All' : `L${n}`;
          return (
            <Pressable
              key={label}
              onPress={() => setLessonFilter(n)}
              style={({ pressed }) => [
                styles.lessonChip,
                active && styles.lessonChipOn,
                pressed && styles.diffPressed,
              ]}>
              <Text style={[styles.lessonChipText, active && styles.lessonChipTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading || !exercise) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accentGreen} />
        </View>
      </SafeAreaView>
    );
  }

  const showMc =
    exercise.type === 'multipleChoice' || exercise.type === 'classify';
  const locked = submitted;

  const promptBlock = (
    <>
      {diffButtons}
      {lessonRow}
      <Text style={styles.prompt}>{exercise.prompt}</Text>
    </>
  );

  const actions = (
    <View style={styles.actions}>
      {!submitted ? (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryPressed]}
          onPress={onSubmit}>
          <Text style={styles.primaryBtnText}>Check answer</Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryPressed]}
          onPress={onNext}>
          <Text style={styles.secondaryBtnText}>Next question</Text>
        </Pressable>
      )}
    </View>
  );

  const feedback = (
    <FeedbackBanner visible={submitted} correct={lastCorrect} explanation={exercise.explanation} />
  );

  if (exercise.type === 'wordOrder') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.wordOrderWrap}>
            {promptBlock}
            <WordSorter
              words={exercise.words ?? []}
              disabled={locked}
              onOrderChange={(o) => setWordOrder(o)}
            />
            {actions}
            {feedback}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {promptBlock}
          {showMc && exercise.options ? (
            <MultipleChoice
              options={exercise.options}
              selected={selected}
              onSelect={setSelected}
              disabled={locked}
            />
          ) : (
            <FillInBlank value={fillValue} onChangeText={setFillValue} editable={!locked} />
          )}
          {actions}
          {feedback}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  wordOrderWrap: {
    flex: 1,
    padding: spacing.md,
  },
  diffRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  diffChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  diffChipOn: {
    borderColor: colors.accentGreen,
    backgroundColor: 'rgba(0, 132, 61, 0.1)',
  },
  diffPressed: {
    opacity: 0.85,
  },
  diffText: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  diffTextOn: {
    color: colors.accentGreen,
    fontWeight: '600',
  },
  prompt: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  actions: {
    marginTop: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.accentGreen,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primaryPressed: {
    opacity: 0.9,
  },
  primaryBtnText: {
    ...typography.subtitle,
    color: '#fff',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.accentGreen,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  secondaryPressed: {
    opacity: 0.85,
  },
  secondaryBtnText: {
    ...typography.subtitle,
    color: colors.accentGreen,
  },
  error: {
    ...typography.body,
    color: colors.error,
    padding: spacing.md,
  },
  lessonSection: {
    marginBottom: spacing.md,
  },
  lessonLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  lessonScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lessonChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  lessonChipOn: {
    borderColor: colors.accentRed,
    backgroundColor: 'rgba(200, 16, 46, 0.08)',
  },
  lessonChipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  lessonChipTextOn: {
    color: colors.accentRed,
    fontWeight: '600',
  },
});
