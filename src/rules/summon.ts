import creaturesJson from '../data/creatures.json';
import listsJson from '../data/summonLists.json';
import { ALIGNMENT_NAMES, type Alignment, allowedTemplates, hasAlignmentSubtype, opposedDescriptors, qualifiesForFeat, spellDescriptors, TEMPLATE_ALIGNMENT, type TemplateRule } from './alignment';
import { applyAugmentSummoning } from './augment';
import { bumpLeading, getValue, setOrAddField, setValue } from './fields';
import { type ClassDef, listName, spellTitle, type SummonOption } from './classes';
import { applyTemplate, type TemplateId } from './templates';
import type { BuiltCreature, Creature, FeatList, ListEntry, SpellKey, SummonLists } from './types';

export const CREATURES = creaturesJson as unknown as Record<string, Creature>;
export const LISTS = listsJson as unknown as SummonLists;

export interface Settings {
  classId: string;
  level: number;
  alignment: Alignment;
  augmentSummoning: boolean;
  superiorSummoning: boolean;
  includeAlternatives: boolean;
  templateRule: TemplateRule;
  /** For clerics and warpriests: their deity's alignment also restricts spells. */
  deityAlignment: Alignment;
  summonGoodMonster: boolean;
  summonEvilMonster: boolean;
  summonNeutralMonster: boolean;
}

export const FEAT_LISTS: { id: FeatList; setting: 'summonGoodMonster' | 'summonEvilMonster' | 'summonNeutralMonster'; name: string; benefit: string; requires: string }[] = [
  { id: 'good', setting: 'summonGoodMonster', name: 'Summon Good Monster', benefit: 'extra list; its creatures gain Diehard', requires: 'good alignment' },
  { id: 'evil', setting: 'summonEvilMonster', name: 'Summon Evil Monster', benefit: 'extra list; cast as a standard action', requires: 'evil alignment' },
  { id: 'neutral', setting: 'summonNeutralMonster', name: 'Summon Neutral Monster', benefit: 'extra list and the counterpoised template; +2 Will', requires: 'LN, N or CN alignment' },
];

/** The summon feats whose lists the caster can use (selected and alignment allows). */
export const activeFeatLists = (settings: Settings) => FEAT_LISTS.filter((f) => settings[f.setting] && qualifiesForFeat(f.id, settings.alignment)).map((f) => f.id);

export interface CountGroup {
  /** List level the creatures come from. */
  listLevels: number[];
  count: string;
  label: string;
}

const joinOr = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] ?? '');

/** "1 creature from the III list", or the creatures by name for genie and giant ally spells. */
function groupLabel(spell: SpellKey, count: string, levels: number[]): string {
  if (spell === 'summon-genie' || spell === 'summon-giant-ally') {
    const names = levels.flatMap((l) => LISTS.spells[spell][String(l)]?.standard.map((e) => e.name.toLowerCase()) ?? []);
    return `${count} × ${joinOr(names)}`;
  }
  const names = levels.length === 1 ? listName(spell, levels[0]) : `${listName(spell, levels[levels.length - 1])}–${listName(spell, levels[0])}`;
  return `${count} ${count === '1' ? 'creature' : 'creatures'} from the ${names} list${levels.length > 1 ? 's' : ''}`;
}

/** One creature, 1d3 from the list below, or 1d4+1 from lower lists, as the summon spells allow. */
export function countGroups(level: number, superior: boolean, spell: SpellKey = 'summon-monster'): CountGroup[] {
  if (spell === 'summon-swarm') return [{ listLevels: [1], count: '1', label: '1 swarm of bats, rats, or spiders' }];
  const groups: CountGroup[] = [{ listLevels: [level], count: '1', label: groupLabel(spell, '1', [level]) }];
  if (level >= 2) {
    const count = superior ? '1d3+1' : '1d3';
    groups.push({ listLevels: [level - 1], count, label: groupLabel(spell, count, [level - 1]) });
  }
  if (level >= 3) {
    const count = superior ? '1d4+2' : '1d4+1';
    const lower = Array.from({ length: level - 2 }, (_, i) => level - 2 - i);
    groups.push({ listLevels: lower, count, label: groupLabel(spell, count, lower) });
  }
  return groups;
}

export interface CreatureChoice {
  key: string;
  spell: SpellKey;
  entry: ListEntry;
  /** Set for creatures from a Summon Good/Evil/Neutral Monster list. */
  featList: FeatList | null;
  listLevel: number;
  alternative: boolean;
  creature: Creature | null;
  name: string;
  /** Templates the caster may choose from; empty when the creature isn't templated. */
  templateOptions: TemplateId[];
  presetTemplates: string[];
  /** Templates removed because the caster's or deity's alignment opposes them; `reason` is a short clause. */
  excludedTemplates: { template: TemplateId; reason: string }[];
  descriptors: string[];
  /** Reason the caster can't summon it, if any. */
  blocked: string | null;
  /** Whether the summoned creature takes the caster's alignment. */
  matchesCasterAlignment: boolean;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Clerics and warpriests can't cast spells with an alignment descriptor
 * opposed to their own alignment or their deity's.
 */
function alignmentRestriction(cls: ClassDef, settings: Settings) {
  const sources: { who: string; alignment: Alignment }[] = cls.alignmentRestricted
    ? [
        { who: 'your', alignment: settings.alignment },
        { who: "your deity's", alignment: settings.deityAlignment },
      ]
    : [];
  const opposed = (descriptors: string[]) => [...new Set(sources.flatMap((s) => opposedDescriptors(s.alignment, descriptors)))];
  /** E.g. "evil opposes your deity's alignment (neutral good)". */
  const conflicts = (descriptors: string[]) =>
    sources
      .map((s) => ({ ...s, opposed: opposedDescriptors(s.alignment, descriptors) }))
      .filter((s) => s.opposed.length)
      .map((s) => `${s.opposed.join(' and ')} opposes ${s.who} alignment (${ALIGNMENT_NAMES[s.alignment].toLowerCase()})`)
      .join('; ');
  const reason = (descriptors: string[]): string | null => {
    const c = conflicts(descriptors);
    return c ? `${cls.name}s can't cast spells of an opposed alignment: this would make the spell ${opposed(descriptors).join(' and ')}, and ${c}.` : null;
  };
  return { opposed, conflicts, reason };
}

export function choicesFor(spell: SpellKey, listLevel: number, cls: ClassDef, settings: Settings): CreatureChoice[] {
  const level = LISTS.spells[spell][String(listLevel)];
  if (!level) return [];
  const feats = spell === 'summon-monster' ? activeFeatLists(settings) : [];
  const entries: { e: ListEntry; alternative: boolean; featList: FeatList | null }[] = [
    ...level.standard.map((e) => ({ e, alternative: false, featList: null })),
    ...(settings.includeAlternatives ? level.alternatives.map((e) => ({ e, alternative: true, featList: null })) : []),
    ...feats.flatMap((f) => (LISTS.featLists?.[f]?.[String(listLevel)]?.standard ?? []).map((e) => ({ e, alternative: false, featList: f }))),
  ];
  const restriction = alignmentRestriction(cls, settings);
  const out: CreatureChoice[] = [];
  for (const { e, alternative, featList } of entries) {
    const ids = e.creatureIds.length ? e.creatureIds : [null];
    for (const id of ids) {
      const creature = id ? CREATURES[id] : null;
      const subtypes = [...new Set([...(creature?.subtypes ?? []), ...e.subtypes])];
      const templated = spell === 'summon-monster' && e.templated;
      // Templated creatures take the caster's alignment, so they add no opposed descriptors.
      const descriptors = templated ? [] : spellDescriptors(subtypes);
      const opposed = restriction.opposed(descriptors);
      const templateOptions: TemplateId[] = [];
      const excludedTemplates: CreatureChoice['excludedTemplates'] = [];
      // Summon Neutral Monster: the counterpoised template instead of celestial or fiendish.
      const options = templated ? [...allowedTemplates(settings.alignment, settings.templateRule), ...(feats.includes('neutral') ? (['counterpoised'] as TemplateId[]) : [])] : [];
      for (const t of options) {
        const reason = restriction.conflicts([TEMPLATE_ALIGNMENT[t]]);
        if (reason) excludedTemplates.push({ template: t, reason });
        else templateOptions.push(t);
      }
      // Summon giant ally works like summon nature's ally.
      const naturesAlly = spell === 'summon-natures-ally' || spell === 'summon-giant-ally';
      const matches = templated || (naturesAlly && !hasAlignmentSubtype(subtypes));
      out.push({
        key: `${featList ? `feat-${featList}` : spell}:${listLevel}:${e.name}:${id ?? 'none'}`,
        spell,
        entry: e,
        featList,
        listLevel,
        alternative,
        creature,
        name: e.creatureIds.length > 1 && creature ? creature.name : capitalize(e.name),
        templateOptions,
        presetTemplates: e.presetTemplates,
        excludedTemplates,
        descriptors,
        blocked: opposed.length
          ? restriction.reason(descriptors)
          : templated && !templateOptions.length && excludedTemplates.length
            ? restriction.reason(excludedTemplates.map((x) => TEMPLATE_ALIGNMENT[x.template]))
            : null,
        matchesCasterAlignment: matches,
      });
    }
  }
  return out;
}

export function buildCreature(choice: CreatureChoice, template: TemplateId | null, settings: Settings): BuiltCreature | null {
  if (!choice.creature) return null;
  const c: BuiltCreature = { ...structuredClone(choice.creature), changed: new Map(), notes: [] };
  c.name = choice.name;

  if (choice.matchesCasterAlignment && c.alignment !== settings.alignment) {
    c.changed.set('alignment', c.alignment ?? '');
    c.alignment = settings.alignment;
    c.notes.push(
      choice.spell === 'summon-monster'
        ? 'Alignment matches yours (creatures marked "*" on the Summon Monster table).'
        : choice.spell === 'summon-giant-ally'
          ? "Alignment matches yours (summon giant ally works like summon nature's ally)."
          : "Alignment matches yours (summon nature's ally creatures without an alignment subtype).",
    );
  }

  // Feat lists give each creature's alignment.
  if (choice.entry.alignment && c.alignment !== choice.entry.alignment) {
    c.changed.set('alignment', c.alignment ?? '');
    c.alignment = choice.entry.alignment;
  }

  const preset = choice.presetTemplates.find((t): t is TemplateId => t in TEMPLATE_IDS);
  const applied = preset ?? template;
  // "Celestial wolf" on a feat list: the template adds the prefix itself.
  if (preset && c.name.toLowerCase().startsWith(`${preset} `)) c.name = capitalize(c.name.slice(preset.length + 1));
  if (applied) applyTemplate(c, applied);

  if (choice.featList === 'good') {
    const feats = getValue(c, 'Feats');
    setOrAddField(c, 'statistics', 'Feats', feats ? `${feats}, Diehard` : 'Diehard', ['CMD']);
    c.notes.push('Summon Good Monster: creatures from this list gain the Diehard feat.');
  }
  if (choice.featList === 'evil') {
    c.notes.push(
      "Summon Evil Monster: you can cast the spell as a standard action. The creature can't act until your next turn, but it isn't flat-footed and can make attacks of opportunity.",
    );
  }
  if (choice.featList === 'neutral' || applied === 'counterpoised') {
    const will = getValue(c, 'Will');
    if (will) setValue(c, 'Will', bumpLeading(will, 2));
    c.notes.push('Summon Neutral Monster: +2 resistance bonus on Will saves.');
  }
  if (choice.presetTemplates.includes('young')) {
    c.notes.push(
      'This alternative summon is the young version of the creature. The young template (–1 CR, one size smaller, –4 Str/Con, +4 Dex) is not applied automatically yet.',
    );
  }

  if (choice.spell === 'summon-giant-ally') c.notes.push('Casting time 1 standard action (instead of 1 round).');
  if (choice.spell === 'summon-swarm') {
    c.notes.push('The swarm attacks all other creatures in its area; you have no control over its target or direction.');
  }
  if (settings.augmentSummoning) applyAugmentSummoning(c);
  if (choice.creature.note) c.notes.push(choice.creature.note);
  return c;
}

const TEMPLATE_IDS: Record<TemplateId, true> = { celestial: true, fiendish: true, entropic: true, resolute: true, counterpoised: true };

export function optionTitle(option: SummonOption) {
  return spellTitle(option.spell, option.level) + (option.sla ? ' (SLA)' : '');
}
