import { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import lessonsData from '@/src/data/knowledge/lessons.json';
import rulesData from '@/src/data/knowledge/rules.json';
import vocabData from '@/src/data/knowledge/vocab.json';
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

type VocabRow = (typeof vocabData.items)[number];
type RuleRow = (typeof rulesData.items)[number];

function norm(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

export default function ReferenceScreen() {
  const [mode, setMode] = useState<'core' | 'materials'>('core');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [lessonFilter, setLessonFilter] = useState<number | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  const lessons = lessonsData.lessons;
  const vocabItems = vocabData.items;
  const ruleItems = rulesData.items;

  const topics = useMemo(() => {
    const t = new Set<string>();
    for (const r of ruleItems) {
      if (r.topic) t.add(r.topic);
    }
    return [...t].sort().slice(0, 24);
  }, [ruleItems]);

  const filteredVocab = useMemo(() => {
    const q = norm(search);
    return vocabItems.filter((v) => {
      if (lessonFilter != null && v.lesson !== lessonFilter) return false;
      if (!q) return true;
      return norm(v.hu).includes(q) || norm(v.en).includes(q);
    });
  }, [vocabItems, search, lessonFilter]);

  const filteredRules = useMemo(() => {
    const q = norm(search);
    return ruleItems.filter((r) => {
      if (topicFilter && r.topic !== topicFilter) return false;
      if (lessonFilter != null && r.lesson !== lessonFilter) return false;
      if (!q) return true;
      return norm(r.topic).includes(q) || norm(r.ruleText).includes(q);
    });
  }, [ruleItems, search, lessonFilter, topicFilter]);

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  };

  const lessonChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      <Pressable
        onPress={() => setLessonFilter(null)}
        style={[styles.chip, lessonFilter === null && styles.chipOn]}>
        <Text style={[styles.chipTxt, lessonFilter === null && styles.chipTxtOn]}>All lessons</Text>
      </Pressable>
      {lessons.map((l) => (
        <Pressable
          key={l.id}
          onPress={() => setLessonFilter(l.lessonNumber)}
          style={[styles.chip, lessonFilter === l.lessonNumber && styles.chipOn]}>
          <Text style={[styles.chipTxt, lessonFilter === l.lessonNumber && styles.chipTxtOn]}>L{l.lessonNumber}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const topicChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      <Pressable
        onPress={() => setTopicFilter(null)}
        style={[styles.chip, topicFilter === null && styles.chipOn]}>
        <Text style={[styles.chipTxt, topicFilter === null && styles.chipTxtOn]}>All topics</Text>
      </Pressable>
      {topics.map((t) => (
        <Pressable
          key={t}
          onPress={() => setTopicFilter(t)}
          style={[styles.chip, topicFilter === t && styles.chipOn]}>
          <Text style={[styles.chipTxt, topicFilter === t && styles.chipTxtOn]} numberOfLines={1}>
            {t.length > 28 ? `${t.slice(0, 26)}…` : t}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('core')}
          style={[styles.modeBtn, mode === 'core' && styles.modeBtnOn]}>
          <Text style={[styles.modeTxt, mode === 'core' && styles.modeTxtOn]}>Core reference</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('materials')}
          style={[styles.modeBtn, mode === 'materials' && styles.modeBtnOn]}>
          <Text style={[styles.modeTxt, mode === 'materials' && styles.modeTxtOn]}>My materials</Text>
        </Pressable>
      </View>

      {mode === 'core' ? (
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
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Search ingested vocab and rules from knowledge-source. Run npm run ingest:knowledge after you edit source files.
          </Text>
          <TextInput
            style={styles.search}
            placeholder="Search Hungarian or English…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.filterLabel}>Lesson</Text>
          {lessonChips}
          <Text style={styles.filterLabel}>Rule topic</Text>
          {topicChips}

          <Text style={styles.sectionHeading}>Vocabulary ({filteredVocab.length})</Text>
          {filteredVocab.slice(0, 200).map((v: VocabRow) => (
            <View key={v.id} style={styles.miniCard}>
              <Text style={styles.hu}>{v.hu}</Text>
              <Text style={styles.en}>{v.en}</Text>
              <Text style={styles.meta}>
                {v.lesson != null ? `Lesson ${v.lesson} · ` : ''}
                {v.sourceFile}
              </Text>
            </View>
          ))}
          {filteredVocab.length > 200 ? (
            <Text style={styles.meta}>Showing first 200 matches. Narrow your search or filters.</Text>
          ) : null}

          <Text style={styles.sectionHeading}>Rules & notes ({filteredRules.length})</Text>
          {filteredRules.slice(0, 120).map((r: RuleRow) => (
            <View key={r.id} style={styles.miniCard}>
              <Text style={styles.topic}>{r.topic}</Text>
              <Text style={styles.ruleBody}>{r.ruleText}</Text>
              <Text style={styles.meta}>
                {r.lesson != null ? `Lesson ${r.lesson} · ` : ''}
                {r.sourceFile}
              </Text>
            </View>
          ))}
          {filteredRules.length > 120 ? (
            <Text style={styles.meta}>Showing first 120 matches. Narrow your search or filters.</Text>
          ) : null}
        </ScrollView>
      )}
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
  modeRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modeBtnOn: {
    borderColor: colors.accentGreen,
    backgroundColor: 'rgba(0, 132, 61, 0.08)',
  },
  modeTxt: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  modeTxtOn: {
    color: colors.accentGreen,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  search: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    marginBottom: spacing.md,
  },
  filterLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'nowrap',
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipOn: {
    borderColor: colors.accentGreen,
    backgroundColor: 'rgba(0, 132, 61, 0.08)',
  },
  chipTxt: {
    ...typography.caption,
    color: colors.textMuted,
    maxWidth: 200,
  },
  chipTxtOn: {
    color: colors.accentGreen,
    fontWeight: '600',
  },
  sectionHeading: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  miniCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  hu: {
    ...typography.subtitle,
    color: colors.text,
  },
  en: {
    ...typography.body,
    color: colors.textMuted,
  },
  topic: {
    ...typography.caption,
    color: colors.accentGreen,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  ruleBody: {
    ...typography.body,
    color: colors.text,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
