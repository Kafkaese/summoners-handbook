import creaturesJson from '../data/creatures.json';
import listsJson from '../data/summonLists.json';
import { type Alignment, allowedTemplates, hasAlignmentSubtype, opposedDescriptors, spellDescriptors } from './alignment';
import { applyAugmentSummoning } from './augment';
import { type ClassDef, ROMAN, type SummonOption } from './classes';
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
}

export interface CountGroup {
  /** List level the creatures come from. */
  listLevels: number[];
  count: string;
  label: string;
}

/** One creature, two lower-level 1d3 or lower 1d4+1, as the summon spells allow. */
export function countGroups(level: number, superior: boolean): CountGroup[] {
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
  descriptors: string[];
  /** Reason the caster can't summon it, if any. */
  blocked: string | null;
  /** Whether the summoned creature takes the caster's alignment. */
  matchesCasterAlignment: boolean;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function choicesFor(spell: SpellKey, listLevel: number, cls: ClassDef, settings: Settings): CreatureChoice[] {
  const level = LISTS.spells[spell][String(listLevel)];
  if (!level) return [];
  const entries = [
    ...level.standard.map((e) => ({ e, alternative: false })),
    ...(settings.includeAlternatives ? level.alternatives.map((e) => ({ e, alternative: true })) : []),
  ];
  const out: CreatureChoice[] = [];
  for (const { e, alternative } of entries) {
    const ids = e.creatureIds.length ? e.creatureIds : [null];
    for (const id of ids) {
      const creature = id ? CREATURES[id] : null;
      const subtypes = [...new Set([...(creature?.subtypes ?? []), ...e.subtypes])];
      const templated = spell === 'summon-monster' && e.templated;
      // Templated creatures take the caster's alignment, so they add no opposed descriptors.
      const descriptors = templated ? [] : spellDescriptors(subtypes);
      const opposed = opposedDescriptors(settings.alignment, descriptors);
      const matches = templated || (spell === 'summon-natures-ally' && !hasAlignmentSubtype(subtypes));
      out.push({
        key: `${spell}:${listLevel}:${e.name}:${id ?? 'none'}`,
        spell,
        entry: e,
        listLevel,
        alternative,
        creature,
        name: e.creatureIds.length > 1 && creature ? creature.name : capitalize(e.name),
        templateOptions: templated ? allowedTemplates(settings.alignment) : [],
        presetTemplates: e.presetTemplates,
        descriptors,
        blocked:
          cls.alignmentRestricted && opposed.length
            ? `${cls.name}s can't cast ${opposed.join(' or ')} spells, and summoning this creature makes the spell ${opposed.join(' and ')}.`
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

  if (settings.augmentSummoning) applyAugmentSummoning(c);
  if (choice.creature.note) c.notes.push(choice.creature.note);
  return c;
}

const TEMPLATE_IDS: Record<TemplateId, true> = { celestial: true, fiendish: true, entropic: true, resolute: true };

export function optionTitle(option: SummonOption, spellNames: Record<SpellKey, string>) {
  return `${spellNames[option.spell]} ${ROMAN[option.level]}${option.sla ? ' (SLA)' : ''}`;
}
