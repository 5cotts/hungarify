import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';

import { colors, radii, spacing, typography } from '@/src/theme';

type Row = { key: string; text: string };

type Props = {
  words: string[];
  onOrderChange: (ordered: string[]) => void;
  disabled?: boolean;
};

export function WordSorter({ words, onOrderChange, disabled }: Props) {
  const [data, setData] = useState<Row[]>(() => toRows(words));

  useEffect(() => {
    setData(toRows(words));
  }, [words]);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Row>) => (
    <ScaleDecorator>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={disabled ? undefined : drag}
        disabled={disabled || isActive}
        style={[styles.chip, isActive && styles.chipActive]}>
        <Text style={styles.chipText}>{item.text}</Text>
      </TouchableOpacity>
    </ScaleDecorator>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Long-press a word, then drag to reorder</Text>
      <DraggableFlatList
        data={data}
        onDragEnd={({ data: next }) => {
          if (disabled) return;
          setData(next);
          onOrderChange(next.map((r) => r.text));
        }}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        scrollEnabled={false}
        containerStyle={styles.list}
      />
    </View>
  );
}

function toRows(words: string[]): Row[] {
  return words.map((text, i) => ({
    key: `${i}-${text}`,
    text,
  }));
}

const styles = StyleSheet.create({
  container: {
    minHeight: 120,
    width: '100%',
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chipActive: {
    borderColor: colors.accentGreen,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  chipText: {
    ...typography.body,
    color: colors.text,
  },
});
