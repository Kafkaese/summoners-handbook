// What a summoned creature can't use: "A summoned monster cannot summon or
// otherwise conjure another creature, nor can it use any teleportation or
// planar travel abilities. Creatures summoned using this spell cannot use
// spells or spell-like abilities that duplicate spells with expensive
// material components."
import restrictedJson from '../data/restrictedSpells.json';
import { splitItems, splitSpellLine, spellKey } from './spellNames';
import type { Creature } from './types';

interface RestrictedSpell {
  name: string;
  url: string | null;
  reasons: string[];
}

const RESTRICTED = restrictedJson as Record<string, RestrictedSpell>;

/** Non-spell abilities (special qualities, special abilities) by name. */
const RESTRICTED_ABILITIES: [RegExp, string][] = [
  [/^summon\b/i, 'summons a creature'],
  [/^planewalk\b/i, 'planar travel'],
  [/^(greater )?teleport\b|^dimension door\b/i, 'teleportation'],
  [/^(plane shift|etherealness|ethereal jaunt|astral projection|shadow walk)\b/i, 'planar travel'],
];

/** Why a spell or spell-like ability item can't be used, if it can't. */
export function spellRestriction(item: string): string[] | null {
  return RESTRICTED[spellKey(item)]?.reasons ?? null;
}

/** Why a named ability ("Planewalk (Ex)", "planewalk") can't be used, if it can't. */
export function abilityRestriction(name: string): string[] | null {
  const bare = name.replace(/\s*\((Ex|Su|Sp)[^)]*\)\s*$/i, '').trim();
  const hit = RESTRICTED_ABILITIES.find(([re]) => re.test(bare));
  return hit ? [hit[1]] : null;
}

/** Fields whose comma-separated items are abilities. */
export const ABILITY_LIST_FIELDS = new Set(['SQ', 'Special Attacks', 'Defensive Abilities']);

export interface Restriction {
  name: string;
  reasons: string[];
}

/** Every spell and ability in the stat block that a summoned creature can't use. */
export function restrictionsOf(c: Creature): Restriction[] {
  const found = new Map<string, Restriction>();
  const add = (name: string, reasons: string[] | null) => {
    if (reasons && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), { name, reasons });
  };
  for (const f of Object.values(c.sections).flat()) {
    for (const line of f.lines ?? []) {
      for (const item of splitSpellLine(line).items) add(spellKey(item), spellRestriction(item));
    }
    if (ABILITY_LIST_FIELDS.has(f.label)) {
      for (const item of splitItems(f.value)) add(item.replace(/\s*\(.*$/, '').toLowerCase(), abilityRestriction(item));
    }
  }
  for (const sa of c.special) add(sa.name.replace(/\s*\((Ex|Su|Sp)[^)]*\)\s*$/i, '').toLowerCase(), abilityRestriction(sa.name));
  return [...found.values()];
}
