import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

type Props = {
  title: string;
  description: string;
  accuracy: number;
  totalAttempts: number;
  onPractice: () => void;
};

export function ModuleCard({
  title,
  description,
  accuracy,
  totalAttempts,
  onPractice,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.stats}>
          {totalAttempts === 0 ? 'No attempts yet' : `${accuracy}% correct (${totalAttempts} tries)`}
        </Text>
      </View>
      <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={onPractice}>
        <Text style={styles.buttonText}>Practice</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  statsRow: {
    marginBottom: spacing.md,
  },
  stats: {
    ...typography.caption,
    color: colors.textMuted,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentGreen,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
});
