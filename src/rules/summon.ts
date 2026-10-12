import creaturesJson from '../data/creatures.json';
import listsJson from '../data/summonLists.json';
import { ALIGNMENT_NAMES, type Alignment, allowedTemplates, hasAlignmentSubtype, opposedDescriptors, spellDescriptors, TEMPLATE_ALIGNMENT, type TemplateRule } from './alignment';
import { applyAugmentSummoning } from './augment';
import { type ClassDef, ROMAN, spellLevelLabel, type SummonOption } from './classes';
import { applyTemplate, type TemplateId } from './templates';
import type { BuiltCreature, Creature, ListEntry, SpellKey, SummonLists } from './types';

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
}

export interface CountGroup {
  /** List level the creatures come from. */
  listLevels: number[];
  count: string;
  label: string;
}

/** One creature, two lower-level 1d3 or lower 1d4+1, as the summon spells allow. */
export function countGroups(level: number, superior: boolean, spell: SpellKey = 'summon-monster'): CountGroup[] {
  if (spell === 'summon-swarm') return [{ listLevels: [1], count: '1', label: '1 swarm of bats, rats, or spiders' }];
  const groups: CountGroup[] = [{ listLevels: [level], count: '1', label: `1 creature from the ${ROMAN[level]} list` }];
  if (level >= 2) {
    const count = superior ? '1d3+1' : '1d3';
    groups.push({ listLevels: [level - 1], count, label: `${count} creatures from the ${ROMAN[level - 1]} list` });
  }
  if (level >= 3) {
    const count = superior ? '1d4+2' : '1d4+1';
    const lower = Array.from({ length: level - 2 }, (_, i) => level - 2 - i);
    const names = lower.length === 1 ? ROMAN[lower[0]] : `${ROMAN[lower[lower.length - 1]]}–${ROMAN[lower[0]]}`;
    groups.push({ listLevels: lower, count, label: `${count} creatures from the ${names} list${lower.length > 1 ? 's' : ''}` });
  }
  return groups;
}

export interface CreatureChoice {
  key: string;
  spell: SpellKey;
  entry: ListEntry;
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
  const entries = [
    ...level.standard.map((e) => ({ e, alternative: false })),
    ...(settings.includeAlternatives ? level.alternatives.map((e) => ({ e, alternative: true })) : []),
  ];
  const restriction = alignmentRestriction(cls, settings);
  const out: CreatureChoice[] = [];
  for (const { e, alternative } of entries) {
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
      for (const t of templated ? allowedTemplates(settings.alignment, settings.templateRule) : []) {
        const reason = restriction.conflicts([TEMPLATE_ALIGNMENT[t]]);
        if (reason) excludedTemplates.push({ template: t, reason });
        else templateOptions.push(t);
      }
      const matches = templated || (spell === 'summon-natures-ally' && !hasAlignmentSubtype(subtypes));
      out.push({
        key: `${spell}:${listLevel}:${e.name}:${id ?? 'none'}`,
        spell,
        entry: e,
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
        : "Alignment matches yours (summon nature's ally creatures without an alignment subtype).",
    );
  }

  const preset = choice.presetTemplates.find((t): t is TemplateId => t in TEMPLATE_IDS);
  if (preset) applyTemplate(c, preset);
  else if (template) applyTemplate(c, template);
  if (choice.presetTemplates.includes('young')) {
    c.notes.push(
      'This alternative summon is the young version of the creature. The young template (–1 CR, one size smaller, –4 Str/Con, +4 Dex) is not applied automatically yet.',
    );
  }

  if (choice.spell === 'summon-swarm') {
    c.notes.push('The swarm attacks all other creatures in its area; you have no control over its target or direction.');
  }
  if (settings.augmentSummoning) applyAugmentSummoning(c);
  if (choice.creature.note) c.notes.push(choice.creature.note);
  return c;
}

const TEMPLATE_IDS: Record<TemplateId, true> = { celestial: true, fiendish: true, entropic: true, resolute: true };

export function optionTitle(option: SummonOption, spellNames: Record<SpellKey, string>) {
  return [spellNames[option.spell], spellLevelLabel(option.spell, option.level)].filter(Boolean).join(' ') + (option.sla ? ' (SLA)' : '');
}
