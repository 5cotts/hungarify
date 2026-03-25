import { StyleSheet, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  editable?: boolean;
  placeholder?: string;
};

export function FillInBlank({ value, onChangeText, editable = true, placeholder = 'Type your answer' }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
  },
});
