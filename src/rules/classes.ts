import type { SpellKey } from './types';

type Progression = 'full-prepared' | 'full-spontaneous' | 'six' | 'four';

interface SpellAccess {
  spell: SpellKey;
  /** Summon spell level (I–IX) → the class's own spell level for it. */
  levels: Record<number, number>;
}

export interface ClassDef {
  id: string;
  name: string;
  progression: Progression;
  access: SpellAccess[];
  /** Clerics and warpriests can't cast spells of an opposed alignment. */
  alignmentRestricted?: boolean;
  /** Summoners also get summon monster as a spell-like ability. */
  summonSla?: boolean;
  casterLevelOffset?: number;
}

const range = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));

export const CLASSES: ClassDef[] = [
  { id: 'antipaladin', name: 'Antipaladin', progression: 'four', casterLevelOffset: -3, access: [{ spell: 'summon-monster', levels: range(4) }] },
  { id: 'arcanist', name: 'Arcanist', progression: 'full-spontaneous', access: [{ spell: 'summon-monster', levels: range(9) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'bard', name: 'Bard', progression: 'six', access: [{ spell: 'summon-monster', levels: range(6) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'cleric', name: 'Cleric', progression: 'full-prepared', alignmentRestricted: true, access: [{ spell: 'summon-monster', levels: range(9) }] },
  { id: 'druid', name: 'Druid', progression: 'full-prepared', access: [{ spell: 'summon-natures-ally', levels: range(9) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'hunter', name: 'Hunter', progression: 'six', access: [{ spell: 'summon-natures-ally', levels: range(6) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'medium', name: 'Medium', progression: 'four', access: [{ spell: 'summon-monster', levels: { 1: 1, 2: 2, 4: 3, 5: 4 } }] },
  { id: 'oracle', name: 'Oracle', progression: 'full-spontaneous', access: [{ spell: 'summon-monster', levels: range(9) }] },
  { id: 'psychic', name: 'Psychic', progression: 'full-spontaneous', access: [{ spell: 'summon-monster', levels: range(9) }] },
  { id: 'ranger', name: 'Ranger', progression: 'four', casterLevelOffset: -3, access: [{ spell: 'summon-natures-ally', levels: range(4) }] },
  { id: 'shaman', name: 'Shaman', progression: 'full-prepared', access: [{ spell: 'summon-natures-ally', levels: range(9) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'skald', name: 'Skald', progression: 'six', access: [{ spell: 'summon-monster', levels: range(6) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'sorcerer', name: 'Sorcerer', progression: 'full-spontaneous', access: [{ spell: 'summon-monster', levels: range(9) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'spiritualist', name: 'Spiritualist', progression: 'six', access: [{ spell: 'summon-monster', levels: range(6) }] },
  {
    id: 'summoner',
    name: 'Summoner',
    progression: 'six',
    summonSla: true,
    access: [{ spell: 'summon-monster', levels: { 1: 1, 2: 2, 4: 3, 5: 4, 7: 5, 8: 6 } }, { spell: 'summon-swarm', levels: { 1: 2 } }],
  },
  {
    id: 'unchained-summoner',
    name: 'Summoner (Unchained)',
    progression: 'six',
    summonSla: true,
    access: [{ spell: 'summon-monster', levels: { 1: 1, 2: 2, 4: 3, 5: 4, 6: 5, 7: 6 } }, { spell: 'summon-swarm', levels: { 1: 2 } }],
  },
  { id: 'warpriest', name: 'Warpriest', progression: 'six', alignmentRestricted: true, access: [{ spell: 'summon-monster', levels: range(6) }] },
  { id: 'witch', name: 'Witch', progression: 'full-prepared', access: [{ spell: 'summon-monster', levels: range(9) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
  { id: 'wizard', name: 'Wizard', progression: 'full-prepared', access: [{ spell: 'summon-monster', levels: range(9) }, { spell: 'summon-swarm', levels: { 1: 2 } }] },
];

export const classById = (id: string) => CLASSES.find((c) => c.id === id) ?? CLASSES[0];

/** Class level at which a class first casts spells of the given spell level. */
export function levelForSpellLevel(progression: Progression, spellLevel: number): number {
  switch (progression) {
    case 'full-prepared':
      return 2 * spellLevel - 1;
    case 'full-spontaneous':
      return spellLevel === 1 ? 1 : 2 * spellLevel;
    case 'six':
      return 3 * spellLevel - 2;
    case 'four':
      return 3 * spellLevel + 1;
  }
}

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export const SPELL_NAMES: Record<SpellKey, string> = {
  'summon-monster': 'Summon Monster',
  'summon-natures-ally': "Summon Nature's Ally",
  'summon-swarm': 'Summon Swarm',
};

/** "III" for the leveled summon spells; summon swarm has a single version. */
export const spellLevelLabel = (spell: SpellKey, level: number) => (spell === 'summon-swarm' ? '' : ROMAN[level]);

export interface SummonOption {
  key: string;
  spell: SpellKey;
  /** Level of the summon spell (I–IX). */
  level: number;
  /** The class's spell level for it (differs for summoners and mediums). */
  classSpellLevel: number | null;
  sla: boolean;
  requiredLevel: number;
  available: boolean;
  casterLevel: number;
  duration: string;
}

export function summonOptions(cls: ClassDef, classLevel: number): SummonOption[] {
  const casterLevel = Math.max(1, classLevel + (cls.casterLevelOffset ?? 0));
  const options: SummonOption[] = [];
  for (const { spell, levels } of cls.access) {
    for (const [summonLevel, classSpellLevel] of Object.entries(levels)) {
      const requiredLevel = levelForSpellLevel(cls.progression, classSpellLevel);
      options.push({
        key: `${spell}-${summonLevel}`,
        spell,
        level: Number(summonLevel),
        classSpellLevel,
        sla: false,
        requiredLevel,
        available: classLevel >= requiredLevel,
        casterLevel,
        duration: spell === 'summon-swarm' ? 'concentration + 2 rounds' : `${casterLevel} round${casterLevel === 1 ? '' : 's'}`,
      });
    }
  }
  if (cls.summonSla) {
    // Summon monster I at 1st level, one spell level higher every two levels.
    for (let level = 1; level <= 9; level++) {
      const requiredLevel = 2 * level - 1;
      options.push({
        key: `sla-${level}`,
        spell: 'summon-monster',
        level,
        classSpellLevel: null,
        sla: true,
        requiredLevel,
        available: classLevel >= requiredLevel,
        casterLevel: classLevel,
        duration: `${classLevel} minute${classLevel === 1 ? '' : 's'}`,
      });
    }
  }
  return options;
}
