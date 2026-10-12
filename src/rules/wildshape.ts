// Druid wild shape into animals (beast shape I–III), per the druid class
// feature and the polymorph rules.
import { parseAttack, splitTopLevel } from './attacks';
import { abilityMod, fmtMod, parseNum } from './fields';
import type { BuiltCreature, Creature, Field } from './types';

export type Size = 'Diminutive' | 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge';
export const SIZES: Size[] = ['Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge'];

/** The druid's own numbers that wild shape builds on (current values, items included). */
export interface DruidProfile {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  /** Max hit points; null means estimate from level and Con. */
  hp: number | null;
  /** Initiative in normal form, if it isn't just Dex (e.g. Improved Initiative). */
  initBonus: number;
  resistance: number;
  deflection: number;
  /** Enhancement bonus to natural armor (amulet of natural armor). */
  naturalArmorEnhancement: number;
  dodge: number;
  /** Armor bonus from armor with the wild property, which keeps working. */
  wildArmor: number;
  weaponFinesse: boolean;
  multiattack: boolean;
  naturalSpell: boolean;
}

export const DEFAULT_PROFILE: DruidProfile = {
  str: 10,
  dex: 14,
  con: 14,
  int: 10,
  wis: 16,
  cha: 10,
  hp: null,
  initBonus: 0,
  resistance: 0,
  deflection: 0,
  naturalArmorEnhancement: 0,
  dodge: 0,
  wildArmor: 0,
  weaponFinesse: false,
  multiattack: false,
  naturalSpell: false,
};

// --- Wild shape by druid level ----------------------------------------------

export interface Tier {
  spell: 'beast shape I' | 'beast shape II' | 'beast shape III';
  /** Equivalent spell level, used for the DCs of gained abilities. */
  spellLevel: number;
  sizes: Size[];
  caps: { climb: number; fly: number; flyManeuver: Maneuver; swim: number; burrow: number };
  senses: string[];
  abilities: string[];
}

type Maneuver = 'clumsy' | 'poor' | 'average' | 'good' | 'perfect';
const MANEUVERS: Maneuver[] = ['clumsy', 'poor', 'average', 'good', 'perfect'];

const TIERS: Tier[] = [
  {
    spell: 'beast shape I',
    spellLevel: 3,
    sizes: ['Small', 'Medium'],
    caps: { climb: 30, fly: 30, flyManeuver: 'average', swim: 30, burrow: 0 },
    senses: ['darkvision 60', 'low-light vision', 'scent'],
    abilities: [],
  },
  {
    spell: 'beast shape II',
    spellLevel: 4,
    sizes: ['Tiny', 'Small', 'Medium', 'Large'],
    caps: { climb: 60, fly: 60, flyManeuver: 'good', swim: 60, burrow: 0 },
    senses: ['darkvision 60', 'low-light vision', 'scent'],
    abilities: ['grab', 'pounce', 'trip'],
  },
  {
    spell: 'beast shape III',
    spellLevel: 5,
    sizes: ['Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge'],
    caps: { climb: 90, fly: 90, flyManeuver: 'good', swim: 90, burrow: 30 },
    senses: ['blindsense 30', 'darkvision 60', 'low-light vision', 'scent'],
    abilities: ['constrict', 'ferocity', 'grab', 'jet', 'poison', 'pounce', 'rake', 'trample', 'trip', 'web'],
  },
];

/** The beast shape spell wild shape works like at this druid level, or null before 4th. */
export function tierFor(level: number): Tier | null {
  if (level >= 8) return TIERS[2];
  if (level >= 6) return TIERS[1];
  if (level >= 4) return TIERS[0];
  return null;
}

/** Uses per day: 1 at 4th, +1 at 6th and every two levels after, at will at 20th. */
export function usesPerDay(level: number): number | 'at will' {
  if (level >= 20) return 'at will';
  if (level < 4) return 0;
  return 1 + Math.floor((level - 4) / 2);
}

/** Size adjustments from beast shape (the same values in every version that allows the size). */
const SIZE_ADJUST: Record<Size, { str: number; dex: number; naturalArmor: number }> = {
  Diminutive: { str: -4, dex: 6, naturalArmor: 1 },
  Tiny: { str: -2, dex: 4, naturalArmor: 1 },
  Small: { str: 0, dex: 2, naturalArmor: 1 },
  Medium: { str: 2, dex: 0, naturalArmor: 2 },
  Large: { str: 4, dex: -2, naturalArmor: 4 },
  Huge: { str: 6, dex: -4, naturalArmor: 6 },
};
const SIZE_MOD: Record<Size, number> = { Diminutive: 4, Tiny: 2, Small: 1, Medium: 0, Large: -1, Huge: -2 };
const SPECIAL_SIZE_MOD: Record<Size, number> = { Diminutive: -4, Tiny: -2, Small: -1, Medium: 0, Large: 1, Huge: 2 };
const STEALTH_SIZE_MOD: Record<Size, number> = { Diminutive: 12, Tiny: 8, Small: 4, Medium: 0, Large: -4, Huge: -8 };

export const sizeAdjustment = (size: Size) => SIZE_ADJUST[size];

// --- Druid basics -----------------------------------------------------------

export const druidBab = (level: number) => Math.floor((level * 3) / 4);
const goodSave = (level: number) => 2 + Math.floor(level / 2);
const poorSave = (level: number) => Math.floor(level / 3);

/** Average hit points (max at 1st level, d8 average after), if the player didn't enter any. */
export const estimateHp = (level: number, con: number) => 8 + Math.ceil(4.5 * (level - 1)) + abilityMod(con) * level;

// --- Reading the form's stat block ------------------------------------------

const field = (c: Creature, label: string) => Object.values(c.sections).flat().find((f) => f.label === label)?.value ?? '';

interface Movement {
  land: number;
  climb: number;
  fly: number;
  flyManeuver: Maneuver | null;
  swim: number;
  burrow: number;
}

export function parseSpeed(speed: string): Movement {
  const m: Movement = { land: 0, climb: 0, fly: 0, flyManeuver: null, swim: 0, burrow: 0 };
  for (const part of splitTopLevel(speed, /^,\s*/)) {
    const hit = part.match(/^(?:(climb|fly|swim|burrow)\s+)?(\d+)\s*ft\.?\s*(?:\(([^)]*)\))?/i);
    if (!hit) continue;
    const kind = (hit[1]?.toLowerCase() ?? 'land') as keyof Movement;
    const value = Number(hit[2]);
    if (kind === 'land' && m.land) continue;
    (m[kind] as number) = value;
    if (kind === 'fly') m.flyManeuver = (MANEUVERS.find((x) => hit[3]?.toLowerCase().includes(x)) ?? 'average') as Maneuver;
  }
  return m;
}

/** Abilities the form has, by universal monster rule name. */
export function formAbilities(c: Creature): Set<string> {
  const text = [field(c, 'Melee'), field(c, 'Special Attacks'), field(c, 'Defensive Abilities'), field(c, 'SQ'), ...c.special.map((s) => s.name)]
    .join(', ')
    .toLowerCase();
  const all = ['constrict', 'ferocity', 'grab', 'jet', 'poison', 'pounce', 'rake', 'trample', 'trip', 'web', 'rend', 'roar', 'blood rage', 'disease', 'attach', 'bleed', 'swallow whole', 'powerful charge', 'stench', 'distraction'];
  return new Set(all.filter((a) => new RegExp(`\\b${a}\\b`).test(text)));
}

export function formMovement(c: Creature) {
  return parseSpeed(field(c, 'Speed'));
}

// --- Natural attacks --------------------------------------------------------

/** Natural attack types from the Bestiary's natural attacks table. */
const PRIMARY = /\b(bite|claw|gore|slam|sting|talon)s?\b/i;
const SECONDARY = /\b(hoof|hooves|tentacle|wing|pincer|tail slap|tail|tusk)s?\b/i;

interface NaturalAttack {
  count: number;
  name: string;
  primary: boolean;
  /** Damage dice without the form's Str bonus ("1d8"), or fixed damage ("1"). */
  dice: string;
  /** Critical range or multiplier, e.g. "/19–20" or "/×3". */
  crit: string;
  riders: string[];
  bonus: number;
}

function parseNaturalAttacks(melee: string): Omit<NaturalAttack, 'primary'>[] {
  // Only the first option of an "a or b" line: animals list their full natural attack first.
  const first = splitTopLevel(melee, /^\s+or\s+/)[0] ?? '';
  const out: Omit<NaturalAttack, 'primary'>[] = [];
  // Attacks are separated by commas, sometimes by "and" ("bite +5 (…) and tail slap +0 (…)").
  for (const text of splitTopLevel(first, /^(,\s*|\s+and\s+)/)) {
    const a = parseAttack(text);
    if (!a) continue;
    const countMatch = a.prefix.match(/^(\d+)\s+(.*)$/);
    const [base, ...riders] = a.damage.split(/\s+plus\s+/);
    // Only plain physical damage adds Strength; "1d6 electricity" stays as printed.
    const dmg = base.trim().match(/^(\d+d\d+|\d+)(?:\s*[+\-–−]\s*\d+)?(\/\S+)?$/);
    out.push({
      count: countMatch ? Number(countMatch[1]) : 1,
      name: (countMatch ? countMatch[2] : a.prefix).trim(),
      dice: dmg?.[1] ?? base.trim(),
      crit: dmg?.[2] ?? '',
      riders: riders.map((r) => r.trim()),
      bonus: a.bonuses[0],
    });
  }
  return out;
}

function classify(attacks: Omit<NaturalAttack, 'primary'>[]): NaturalAttack[] {
  const best = Math.max(...attacks.map((a) => a.bonus));
  return attacks.map((a) => ({
    ...a,
    // The table decides; for other attack types, fall back to the printed bonus.
    primary: PRIMARY.test(a.name) ? true : SECONDARY.test(a.name) ? false : a.bonus > best - 3,
  }));
}

// --- Building the stat block ------------------------------------------------

export interface WildShapeResult {
  creature: BuiltCreature;
  tier: Tier;
  gained: string[];
  notGained: string[];
  lost: string[];
  abilities: { str: number; dex: number; con: number };
  dc: number;
}

const strDamage = (mod: number, mult: number) => (mod < 0 ? mod : Math.floor(mod * mult));
const withBonus = (dice: string, bonus: number) => (bonus === 0 ? dice : `${dice}${bonus > 0 ? '+' : '–'}${Math.abs(bonus)}`);

const ABILITY_NAMES: Record<string, string> = {
  grab: 'Grab',
  pounce: 'Pounce',
  trip: 'Trip',
  rake: 'Rake',
  constrict: 'Constrict',
  ferocity: 'Ferocity',
  jet: 'Jet',
  poison: 'Poison',
  trample: 'Trample',
  web: 'Web',
};

export function buildWildShape(form: Creature, level: number, profile: DruidProfile, alignment: string): WildShapeResult | null {
  const tier = tierFor(level);
  const size = form.size as Size;
  if (!tier || !tier.sizes.includes(size)) return null;

  const adj = SIZE_ADJUST[size];
  const str = profile.str + adj.str;
  const dex = profile.dex + adj.dex;
  const con = profile.con;
  const strMod = abilityMod(str);
  const dexMod = abilityMod(dex);
  const conMod = abilityMod(con);
  const bab = druidBab(level);
  const sizeMod = SIZE_MOD[size];
  const dc = 10 + tier.spellLevel + abilityMod(profile.wis);

  const has = formAbilities(form);
  const gainedAbilities = tier.abilities.filter((a) => has.has(a));
  const notGained = [...has].filter((a) => !tier.abilities.includes(a));

  // Movement: the form's land speed, other movement capped by the spell.
  const move = formMovement(form);
  // Some forms (fish) have no land speed; the druid then can't move on land.
  const speedParts = move.land ? [`${move.land} ft.`] : [];
  const capped = (kind: 'climb' | 'swim' | 'burrow') => Math.min(move[kind], tier.caps[kind]);
  if (capped('burrow')) speedParts.push(`burrow ${capped('burrow')} ft.`);
  if (capped('climb')) speedParts.push(`climb ${capped('climb')} ft.`);
  if (move.fly && tier.caps.fly) {
    const maneuver = MANEUVERS[Math.min(MANEUVERS.indexOf(move.flyManeuver ?? 'average'), MANEUVERS.indexOf(tier.caps.flyManeuver))];
    speedParts.push(`fly ${Math.min(move.fly, tier.caps.fly)} ft. (${maneuver})`);
  }
  if (capped('swim')) speedParts.push(`swim ${capped('swim')} ft.`);
  const landless = !move.land;
  for (const kind of ['climb', 'fly', 'swim', 'burrow'] as const) {
    if (move[kind] > tier.caps[kind]) notGained.push(tier.caps[kind] ? `${kind} ${move[kind]} ft. (capped at ${tier.caps[kind]} ft.)` : `${kind} speed`);
  }

  // Senses: only those the spell grants, at most its range.
  const formSenses = field(form, 'Senses').toLowerCase();
  const senses: string[] = [];
  for (const s of tier.senses) {
    const [name, range] = s.split(/ (?=\d)/);
    const hit = formSenses.match(new RegExp(`${name}(?: (\\d+) ft\\.)?`));
    if (!hit) continue;
    senses.push(range ? `${name} ${Math.min(Number(hit[1] ?? range), Number(range))} ft.` : name);
  }

  // Natural attacks with the druid's BAB and Str (or Dex with Weapon Finesse).
  const attacks = classify(parseNaturalAttacks(field(form, 'Melee')));
  const sole = attacks.length === 1 && attacks[0].count === 1;
  const attackMod = profile.weaponFinesse ? Math.max(strMod, dexMod) : strMod;
  const melee = attacks
    .map((a) => {
      const penalty = a.primary || sole ? 0 : profile.multiattack ? -2 : -5;
      const mult = sole ? 1.5 : a.primary ? 1 : 0.5;
      const riders = a.riders.filter((r) => {
        const key = r.toLowerCase().replace(/\s*\(.*$/, '');
        return !Object.keys(ABILITY_NAMES).includes(key) ? false : tier.abilities.includes(key);
      });
      // Fixed damage (e.g. "1") doesn't add Strength.
      const dice = /^\d+d\d+$/.test(a.dice) ? withBonus(a.dice, strDamage(strMod, mult)) : a.dice;
      const damage = [`${dice}${a.crit}`, ...riders].join(' plus ');
      const name = a.count > 1 ? `${a.count} ${a.name}` : a.name;
      return `${name} ${fmtMod(bab + attackMod + sizeMod + penalty)} (${damage})`;
    })
    .join(', ');
  for (const a of attacks) {
    for (const r of a.riders) if (!tier.abilities.includes(r.toLowerCase().replace(/\s*\(.*$/, ''))) notGained.push(`${r} (on ${a.name})`);
  }

  // Special attacks the spell grants, recomputed with the druid's numbers.
  const specialAttacks: string[] = [];
  for (const part of splitTopLevel(field(form, 'Special Attacks'), /^,\s*/)) {
    const key = part.toLowerCase().replace(/\s*\(.*$/, '').trim();
    if (!tier.abilities.includes(key)) continue;
    if (key === 'rake') {
      // "rake (2 claws +6, 1d4+3)" → attack with BAB + Str + size, damage + Str.
      const m = part.match(/\((\d+)\s+([a-z ]+?)\s+[+\-–−]\d+,\s*(\d+d\d+)/i);
      specialAttacks.push(m ? `rake (${m[1]} ${m[2]} ${fmtMod(bab + attackMod + sizeMod)}, ${withBonus(m[3], strMod)})` : part);
    } else if (key === 'trample' || key === 'constrict') {
      const dice = part.match(/(\d+d\d+)/)?.[1];
      const bonus = key === 'trample' ? strDamage(strMod, 1.5) : strMod;
      specialAttacks.push(dice ? `${key} (${withBonus(dice, bonus)}${key === 'trample' ? `, DC ${dc}` : ''})` : part);
    } else if (key === 'poison' || key === 'web' || key === 'jet') {
      specialAttacks.push(part.replace(/DC \d+/g, `DC ${dc}`));
    } else {
      specialAttacks.push(part);
    }
  }
  // Grab and trip are usually only listed on the attack; pounce in Special Attacks.
  const defensive = gainedAbilities.includes('ferocity') ? 'ferocity' : '';

  // Defense and statistics.
  const naturalArmor = adj.naturalArmor + profile.naturalArmorEnhancement;
  const ac = 10 + dexMod + sizeMod + naturalArmor + profile.deflection + profile.dodge + profile.wildArmor;
  const touch = 10 + dexMod + sizeMod + profile.deflection + profile.dodge;
  const flatFooted = ac - Math.max(0, dexMod) - profile.dodge;
  const acParts = [
    profile.wildArmor ? `+${profile.wildArmor} armor` : '',
    profile.deflection ? `+${profile.deflection} deflection` : '',
    dexMod ? `${fmtMod(dexMod)} Dex` : '',
    profile.dodge ? `+${profile.dodge} dodge` : '',
    `+${naturalArmor} natural`,
    sizeMod ? `${fmtMod(sizeMod)} size` : '',
  ].filter(Boolean);
  const hp = profile.hp ?? estimateHp(level, profile.con);
  const fort = goodSave(level) + conMod + profile.resistance;
  const ref = poorSave(level) + dexMod + profile.resistance;
  const will = goodSave(level) + abilityMod(profile.wis) + profile.resistance;
  const cmb = bab + strMod + SPECIAL_SIZE_MOD[size];
  const cmd = 10 + bab + strMod + dexMod + SPECIAL_SIZE_MOD[size] + profile.deflection + profile.dodge;
  // Extra legs make a creature harder to trip; copy the form's "vs. trip" difference.
  const formCmd = field(form, 'CMD');
  const formCmdBase = parseNum(formCmd) ?? 0;
  const vsTrip = formCmd.match(/\((\d+) vs\.? trip\)/i);
  const cmdText = /can't be tripped|cannot be tripped/i.test(formCmd)
    ? `${cmd} (can't be tripped)`
    : vsTrip
      ? `${cmd} (${cmd + Number(vsTrip[1]) - formCmdBase} vs. trip)`
      : String(cmd);

  const init = dexMod + profile.initBonus;
  const skills = [
    STEALTH_SIZE_MOD[size] ? `Stealth ${fmtMod(STEALTH_SIZE_MOD[size])} size` : '',
    capped('climb') ? 'Climb +8 racial (climb speed)' : '',
    capped('swim') ? 'Swim +8 racial (swim speed)' : '',
  ].filter(Boolean);

  const sections: Record<'intro' | 'defense' | 'offense' | 'tactics' | 'statistics', Field[]> = {
    intro: [{ label: 'Init', value: fmtMod(init) }, ...(senses.length ? [{ label: 'Senses', value: senses.join(', ') }] : [])],
    defense: [
      { label: 'AC', value: `${ac}, touch ${touch}, flat-footed ${flatFooted} (${acParts.join(', ')})` },
      { label: 'hp', value: `${hp} (unchanged)` },
      { label: 'Fort', value: fmtMod(fort) },
      { label: 'Ref', value: fmtMod(ref) },
      { label: 'Will', value: fmtMod(will) },
      ...(defensive ? [{ label: 'Defensive Abilities', value: defensive }] : []),
    ],
    offense: [
      { label: 'Speed', value: landless ? `${speedParts.join(', ') || '0 ft.'} (no land speed)` : speedParts.join(', ') },
      ...(melee ? [{ label: 'Melee', value: melee }] : []),
      ...[field(form, 'Space') && { label: 'Space', value: field(form, 'Space') }, field(form, 'Reach') && { label: 'Reach', value: field(form, 'Reach') }].filter(
        (f): f is Field => !!f,
      ),
      ...(specialAttacks.length ? [{ label: 'Special Attacks', value: specialAttacks.join(', ') }] : []),
    ],
    tactics: [],
    statistics: [
      { label: 'Str', value: String(str) },
      { label: 'Dex', value: String(dex) },
      { label: 'Con', value: String(con) },
      { label: 'Int', value: String(profile.int) },
      { label: 'Wis', value: String(profile.wis) },
      { label: 'Cha', value: String(profile.cha) },
      { label: 'Base Atk', value: fmtMod(bab) },
      { label: 'CMB', value: fmtMod(cmb) + (gainedAbilities.includes('grab') ? ` (${fmtMod(cmb + 4)} grapple)` : '') },
      { label: 'CMD', value: cmdText },
      { label: 'Skills', value: `${skills.join('; ')}; other skills as normal` },
    ],
  };

  // Special abilities text for what's gained, from the form's stat block when it has one.
  const special = gainedAbilities
    .map((a) => {
      const own = form.special.find((s) => s.name.toLowerCase().startsWith(a));
      if (!own) return null;
      return { name: own.name, text: own.text.replace(/DC \d+/g, `DC ${dc}`).replace(/The save DC is [A-Za-z]+-based\.?/i, `The save DC is 10 + ${tier.spellLevel} (spell level) + Wis modifier.`) };
    })
    .filter((s): s is { name: string; text: string } => !!s);

  const lost = [
    profile.naturalSpell ? '' : 'Spellcasting (you need Natural Spell to cast in animal form)',
    'Speech (you can only communicate with animals of the same kind)',
    profile.wildArmor ? 'Shield bonuses' : 'Armor and shield bonuses (unless the armor has the wild property)',
    'Items that need activating (gear with constant bonuses keeps working)',
  ].filter(Boolean);

  const creature: BuiltCreature = {
    ...form,
    name: `Wild shape: ${form.name}`,
    cr: null,
    xp: null,
    alignment,
    typeLine: `${alignment} ${size} animal (wild shape)`,
    sections,
    special,
    changed: new Map(),
    notes: [],
  };

  return {
    creature,
    tier,
    gained: [...senses, ...speedParts.slice(landless ? 0 : 1), ...gainedAbilities],
    notGained: [...new Set(notGained)],
    lost,
    abilities: { str, dex, con },
    dc,
  };
}
