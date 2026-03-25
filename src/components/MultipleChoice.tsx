import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

type Props = {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
};

export function MultipleChoice({ options, selected, onSelect, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const isSel = selected === opt;
        return (
          <Pressable
            key={opt}
            disabled={disabled}
            onPress={() => onSelect(opt)}
            style={({ pressed }) => [
              styles.option,
              isSel && styles.optionSelected,
              pressed && !disabled && styles.optionPressed,
            ]}>
            <Text style={[styles.optionText, isSel && styles.optionTextSelected]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.accentGreen,
    backgroundColor: 'rgba(0, 132, 61, 0.08)',
  },
  optionPressed: {
    opacity: 0.9,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
});
