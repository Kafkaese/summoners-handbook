export type SectionName = 'intro' | 'defense' | 'offense' | 'tactics' | 'statistics';

export interface Field {
  label: string;
  value: string;
  /** Extra lines, e.g. the individual spell-like abilities. */
  lines?: string[];
}

export interface SpecialAbility {
  name: string;
  text: string;
}

export interface Creature {
  id: string;
  url: string;
  pageTitle: string;
  source: string | null;
  note?: string;
  name: string;
  cr: string | null;
  mr: number | null;
  xp: string | null;
  alignment: string | null;
  size: string | null;
  type: string | null;
  subtypes: string[];
  typeLine: string | null;
  sections: Record<SectionName, Field[]>;
  special: SpecialAbility[];
  description: string | null;
}

export interface ListEntry {
  name: string;
  url: string | null;
  /** Marked "*" on the Summon Monster table: summoned with an alignment template. */
  templated: boolean;
  /** Templates that always apply, e.g. "Celestial Elk" or a young giant. */
  presetTemplates: string[];
  subtypes: string[];
  source: string | null;
  footnotes: number[];
  creatureIds: string[];
}

export interface ListLevel {
  standard: ListEntry[];
  alternatives: ListEntry[];
}

export type SpellKey = 'summon-monster' | 'summon-natures-ally' | 'summon-swarm' | 'summon-genie' | 'summon-giant-ally';

export interface SummonLists {
  scrapedFrom: string;
  spells: Record<SpellKey, Record<string, ListLevel>>;
}

/** A stat block after templates and feats have been applied. */
export interface BuiltCreature extends Creature {
  /** Keys ("section.label" or "special.name") of values that differ from the base creature. */
  changed: Map<string, string>;
  notes: string[];
}
