import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

type Props = {
  visible: boolean;
  correct: boolean;
  explanation: string;
};

export function FeedbackBanner({ visible, correct, explanation }: Props) {
  if (!visible) return null;
  return (
    <View style={[styles.banner, correct ? styles.bannerOk : styles.bannerBad]}>
      <Text style={styles.title}>{correct ? 'Correct' : 'Not quite'}</Text>
      <Text style={styles.body}>{explanation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  bannerOk: {
    backgroundColor: 'rgba(27, 122, 61, 0.12)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  bannerBad: {
    backgroundColor: 'rgba(179, 38, 30, 0.08)',
    borderWidth: 1,
    borderColor: colors.error,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
});
