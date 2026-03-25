import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Section = { id: string; title: string; body: string };

const SECTIONS: Section[] = [
  {
    id: 'conj',
    title: 'Verb conjugation (overview)',
    body:
      'Hungarian conjugates for person (six persons), tense, and definiteness. Indefinite conjugation is used with indefinite objects or no object; definite conjugation is used when the object is definite (e.g. a könyvet “the book”).',
  },
  {
    id: 'cases',
    title: 'Cases (sample suffixes)',
    body:
      '-ban/-ben inessive (in), -ba/-be illative (into), -nak/-nek dative (to/for), -on/-en/-ön/-n superessive (on), -ra/-re sublative (onto), -val/-vel instrumental (with), -ból/-ből/-ból elative (out of).',
  },
  {
    id: 'vh',
    title: 'Vowel harmony',
    body:
      'The last harmonic vowel in the stem decides the suffix: back (a, á, o, ó, u, ú) vs front unrounded (e, é, i, í) vs front rounded (ö, ő, ü, ű). Mixed stems usually follow the last vowel’s class.',
  },
  {
    id: 'wo',
    title: 'Word order',
    body:
      'Neutral order often puts topic first, then verb–object. Focused constituents can move before the verb; nem “not” immediately precedes the verb it negates.',
  },
  {
    id: 'num',
    title: 'Numbers & time',
    body:
      'Learn tíz (10), húsz (20), száz (100). For clock time, “half past three” is often expressed as fél négy (literally “half four”).',
  },
];

export default function ReferenceScreen() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>Quick reference — expand a section to review.</Text>
        {SECTIONS.map((s) => {
          const expanded = open[s.id];
          return (
            <View key={s.id} style={styles.card}>
              <Pressable onPress={() => toggle(s.id)} style={styles.header}>
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.chev}>{expanded ? '−' : '+'}</Text>
              </Pressable>
              {expanded ? <Text style={styles.body}>{s.body}</Text> : null}
            </View>
          );
        })}
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
  lead: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.sm,
  },
  chev: {
    ...typography.title,
    color: colors.accentGreen,
    width: 28,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
