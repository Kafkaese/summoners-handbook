// Versatile Summon Monster (Monster Summoner's Handbook): six simple templates
// that can replace the celestial, entropic, fiendish or resolute template.
import { formatAttack, parseAttack, splitTopLevel } from './attacks';
import { abilityMod, abilityScore, crValue, findField, getValue, hitDice, setOrAddField, setValue } from './fields';
import { addDarkvision, addDr, bumpCrForHd, mergeResist, prefixName, raiseSr } from './templates';
import type { BuiltCreature, Creature } from './types';

export type VersatileTemplateId = 'aerial' | 'aqueous' | 'chthonic' | 'dark' | 'fiery' | 'primordial';

/** A value for each Hit Dice band: 1–4, 5–10, 11+. */
type ByHd<T> = [T, T, T];

interface VersatileDef {
  id: VersatileTemplateId;
  name: string;
  /** Short summary for the settings list. */
  benefit: string;
  url: string;
  subtype?: 'air' | 'earth' | 'fire' | 'water';
  dr: ByHd<number>;
  drType: string;
  resist?: { energies: string[]; amounts: ByHd<number> };
  energyDamage?: { energy: string; amounts: ByHd<string>; metalWeapons: boolean };
  /** SR equal to the new CR + this. */
  srBonus?: number;
}

const BASE = 'https://www.d20pfsrd.com/bestiary/monster-listings/templates/';
const SOURCE = "Monster Summoner's Handbook";

export const VERSATILE_TEMPLATES: Record<VersatileTemplateId, VersatileDef> = {
  aerial: {
    id: 'aerial',
    name: 'Aerial',
    benefit: 'air; perfect fly speed; electricity resistance and damage',
    url: `${BASE}simple-template-aerial-creature-cr-0-or-1/`,
    subtype: 'air',
    dr: [0, 3, 5],
    drType: '—',
    resist: { energies: ['electricity'], amounts: [10, 15, 20] },
    energyDamage: { energy: 'electricity', amounts: ['1', '1d6', '2d6'], metalWeapons: true },
  },
  aqueous: {
    id: 'aqueous',
    name: 'Aqueous',
    benefit: 'water; swim speed; cold resistance and damage',
    url: `${BASE}simple-template-aqueous-creature-cr-0-or-1/`,
    subtype: 'water',
    dr: [0, 3, 5],
    drType: '—',
    resist: { energies: ['cold'], amounts: [10, 15, 20] },
    energyDamage: { energy: 'cold', amounts: ['1', '1d6', '2d6'], metalWeapons: true },
  },
  chthonic: {
    id: 'chthonic',
    name: 'Chthonic',
    benefit: 'earth; burrow speed; acid resistance and damage',
    url: `${BASE}simple-template-chthonic-creature-cr-0-or-1/`,
    subtype: 'earth',
    dr: [0, 3, 5],
    drType: '—',
    resist: { energies: ['acid'], amounts: [10, 15, 20] },
    energyDamage: { energy: 'acid', amounts: ['1', '1d6', '2d6'], metalWeapons: false },
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    benefit: 'shadow blend; cold and electricity resistance; SR',
    url: `${BASE}simple-template-dark-creature-cr-0-or-1/`,
    dr: [0, 5, 10],
    drType: 'magic',
    resist: { energies: ['cold', 'electricity'], amounts: [5, 10, 15] },
    srBonus: 5,
  },
  fiery: {
    id: 'fiery',
    name: 'Fiery',
    benefit: 'fire; fire damage',
    url: `${BASE}simple-template-fiery-creature-cr-0-or-1/`,
    subtype: 'fire',
    dr: [0, 3, 5],
    drType: '—',
    energyDamage: { energy: 'fire', amounts: ['1', '2d6', '3d6'], metalWeapons: true },
  },
  primordial: {
    id: 'primordial',
    name: 'Primordial',
    benefit: '+10 ft. speeds; bigger primary attack; spell-like abilities; SR',
    url: `${BASE}simple-template-primordial-creature-cr-0-or-1/`,
    dr: [0, 5, 10],
    drType: 'cold iron',
    srBonus: 6,
  },
};

export const VERSATILE_IDS = Object.keys(VERSATILE_TEMPLATES) as VersatileTemplateId[];

export const isVersatile = (id: string): id is VersatileTemplateId => id in VERSATILE_TEMPLATES;

const band = (hd: number) => (hd >= 11 ? 2 : hd >= 5 ? 1 : 0);

const EXCLUDED_SUBTYPES = ['air', 'cold', 'earth', 'fire', 'water'];

/** Why the template can't be applied to this creature, or null if it can. */
export function versatileIneligibility(id: VersatileTemplateId, creature: Creature, subtypes: string[]): string | null {
  if (creature.type?.toLowerCase() === 'outsider') return 'it can only be applied to non-outsiders';
  const bad = subtypes.find((s) => EXCLUDED_SUBTYPES.includes(s));
  if (bad && id !== 'primordial') return `it can't be applied to creatures with the ${bad} subtype`;
  if (id === 'fiery') {
    const speed = creature.sections.offense.find((f) => f.label === 'Speed')?.value ?? '';
    if (/\bswim\b/i.test(speed)) return "creatures with a swim speed can't be fiery";
  }
  return null;
}

// --- Speed ------------------------------------------------------------------

type Mode = 'land' | 'burrow' | 'climb' | 'fly' | 'swim';
const MODE_ORDER: Mode[] = ['land', 'burrow', 'climb', 'fly', 'swim'];

interface SpeedPart {
  mode: Mode | null;
  feet: number;
  /** Anything after the distance, e.g. " (perfect)". */
  rest: string;
  raw: string;
}

/** Edits the movement modes of a Speed value, keeping extras like "jet 200 ft." or "; sprint". */
function editSpeed(c: BuiltCreature, edit: (parts: SpeedPart[], highest: number) => void) {
  const speed = getValue(c, 'Speed');
  if (speed === null) return;
  const semi = speed.indexOf(';');
  const [moves, tail] = semi >= 0 ? [speed.slice(0, semi), speed.slice(semi)] : [speed, ''];
  const parts: SpeedPart[] = moves
    .split(/,\s*|\s+(?=(?:burrow|climb|fly|swim)\s+\d)/)
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^(?:(burrow|climb|fly|swim)\s+)?(\d+)\s*ft\.?(.*)$/i);
      return m ? { mode: (m[1]?.toLowerCase() ?? 'land') as Mode, feet: Number(m[2]), rest: m[3], raw } : { mode: null, feet: 0, rest: '', raw };
    });
  const highest = Math.max(0, ...parts.filter((p) => p.mode).map((p) => p.feet));
  edit(parts, highest);
  const ordered = [
    ...MODE_ORDER.flatMap((mode) => parts.filter((p) => p.mode === mode)),
    ...parts.filter((p) => !p.mode),
  ];
  const text = ordered
    .map((p) => (p.mode ? `${p.mode === 'land' ? '' : `${p.mode} `}${p.feet} ft.${p.rest}` : p.raw))
    .join(', ');
  setValue(c, 'Speed', text + tail);
}

function setMode(parts: SpeedPart[], mode: Mode, feet: number, rest = '') {
  if (feet <= 0) return;
  const existing = parts.find((p) => p.mode === mode);
  // Same speed: the new mode can still bring better maneuverability.
  if (existing && (existing.feet > feet || (existing.feet === feet && !rest))) return;
  if (existing) Object.assign(existing, { feet, rest });
  else parts.push({ mode, feet, rest, raw: '' });
}

// --- Attacks ----------------------------------------------------------------

/** Rewrites each attack in a Melee value. */
function editMelee(c: BuiltCreature, edit: (attack: NonNullable<ReturnType<typeof parseAttack>>) => void) {
  const melee = getValue(c, 'Melee');
  if (!melee) return;
  const value = splitTopLevel(melee, /^\s+or\s+/)
    .map((option) =>
      splitTopLevel(option, /^,\s*/)
        .map((text) => {
          const a = parseAttack(text);
          if (!a) return text;
          edit(a);
          return formatAttack(a);
        })
        .join(', '),
    )
    .join(' or ');
  setValue(c, 'Melee', value);
}

// Damage and any critical range or multiplier: "4d6+22/19–20".
const LEADING_DAMAGE = /^((?:\d+d\d+(?:\s*[+\-–−]\s*\d+)?|\d+)(?:\/\d+[–-]20)?(?:\/[×x]\d)?)/;

/**
 * Paizo's FAQ "Size Changes, Effective Size Changes, and Damage Dice Progression":
 * one size larger moves two steps on this chart, or one step if the creature is
 * Small or smaller or the damage is 1d6 or less.
 */
const DAMAGE_CHART = ['1', '1d2', '1d3', '1d4', '1d6', '1d8', '1d10', '2d6', '2d8', '3d6', '3d8', '4d6', '4d8', '6d6', '6d8', '8d6', '8d8', '12d6', '12d8', '16d6'];
const SMALL_OR_LOWER = ['fine', 'diminutive', 'tiny', 'small'];

export function damageOneSizeLarger(dice: string, size: string | null): string {
  const m = dice.match(/^(\d+)d(\d+)$/);
  const [n, die] = m ? [Number(m[1]), Number(m[2])] : [0, 0];
  // 2d10 increases to 4d8 regardless of size, and so on for more d10s.
  if (die === 10 && n >= 2) return `${n * 2}d8`;
  let start = dice;
  if (die === 12) start = `${n * 2}d6`;
  else if (dice === '2d4') start = '1d8';
  else if (dice === '3d4') start = '2d6';
  if (!DAMAGE_CHART.includes(start)) {
    const sm = start.match(/^(\d+)d([68])$/);
    if (!sm) return dice;
    const count = Number(sm[1]);
    const counts = (d: string) => DAMAGE_CHART.filter((x) => x.endsWith(`d${d}`)).map((x) => Number(x.split('d')[0]));
    // Off-chart d6s use the next lower number of d8s; off-chart d8s the next higher number of d6s.
    start =
      sm[2] === '6'
        ? `${Math.max(...counts('8').filter((x) => x < count))}d8`
        : `${Math.min(...counts('6').filter((x) => x > count))}d6`;
    if (!DAMAGE_CHART.includes(start)) return dice;
  }
  const i = DAMAGE_CHART.indexOf(start);
  const steps = SMALL_OR_LOWER.includes(size?.toLowerCase() ?? '') || i <= DAMAGE_CHART.indexOf('1d6') ? 1 : 2;
  return DAMAGE_CHART[Math.min(i + steps, DAMAGE_CHART.length - 1)];
}

const PRIMARY_ORDER = ['bite', 'claw', 'slam', 'gore', 'talon', 'sting'];
const weaponType = (prefix: string) => PRIMARY_ORDER.find((w) => new RegExp(`\\b${w}s?\\b`, 'i').test(prefix));

// --- Primordial spell-like abilities ----------------------------------------

function addPrimordialSlas(c: BuiltCreature, hd: number) {
  const cha = abilityScore(c, 'Cha');
  const chaMod = cha === null ? 0 : abilityMod(cha);
  const dc = 10 + Math.max(0, chaMod) + 1;
  const spells = ['dancing lights', hd >= 5 && 'faerie fire', hd >= 11 && `lesser confusion (DC ${dc})`].filter(Boolean).join(', ');
  const found = findField(c, 'Spell-Like Abilities');
  if (found) {
    const lines = found.field.lines ?? [];
    c.changed.set(`${found.section}.Spell-Like Abilities.lines`, JSON.stringify(lines));
    const oncePerDay = lines.findIndex((l) => /^1\/day\s*[—-]/i.test(l));
    found.field.lines =
      oncePerDay >= 0 ? lines.map((l, i) => (i === oncePerDay ? `${l}, ${spells}` : l)) : [...lines, `1/day—${spells}`];
    return;
  }
  const ordinal = hd === 1 ? '1st' : hd === 2 ? '2nd' : hd === 3 ? '3rd' : `${hd}th`;
  setOrAddField(c, 'offense', 'Spell-Like Abilities', `(CL ${ordinal}; concentration ${hd + chaMod >= 0 ? '+' : '–'}${Math.abs(hd + chaMod)})`, ['Special Attacks', 'Reach', 'Space', 'Ranged', 'Melee', 'Speed']);
  const added = findField(c, 'Spell-Like Abilities')!;
  added.field.lines = [`1/day—${spells}`];
  c.changed.set(`${added.section}.Spell-Like Abilities.lines`, '[]');
}

// --- Applying ---------------------------------------------------------------

function addSubtype(c: BuiltCreature, subtype: string) {
  if (c.subtypes.includes(subtype)) return;
  c.subtypes = [...c.subtypes, subtype];
  if (!c.typeLine) return;
  c.changed.set('type', c.typeLine);
  c.typeLine = /\)\s*$/.test(c.typeLine) ? c.typeLine.replace(/\)\s*$/, `, ${subtype})`) : `${c.typeLine} (${subtype})`;
}

function addSenses(c: BuiltCreature, sense: string) {
  const senses = getValue(c, 'Senses') ?? '';
  if (senses.includes(sense)) return;
  setValue(c, 'Senses', senses.replace(/(darkvision \d+ ft\.)/, `$1, ${sense}`));
}

export function applyVersatileTemplate(c: BuiltCreature, id: VersatileTemplateId) {
  const t = VERSATILE_TEMPLATES[id];
  const hd = hitDice(c);
  const b = band(hd);
  prefixName(c, t.name);
  bumpCrForHd(c, hd);
  if (t.subtype) addSubtype(c, t.subtype);

  addDarkvision(c);
  if (id === 'dark') addSenses(c, 'low-light vision');
  addDr(c, t.dr[b], t.drType);
  if (t.resist) mergeResist(c, t.resist.energies, t.resist.amounts[b]);
  if (t.srBonus) raiseSr(c, Math.floor(crValue(c.cr)) + t.srBonus);

  if (id === 'fiery') {
    // The fire subtype: immunity to fire, vulnerability to cold.
    const immune = getValue(c, 'Immune');
    if (!/\bfire\b/i.test(immune ?? '')) setOrAddField(c, 'defense', 'Immune', immune ? `${immune}, fire` : 'fire', ['DR', 'Defensive Abilities', 'Will']);
    const resist = getValue(c, 'Resist');
    if (resist && /\bfire\b/i.test(resist)) setValue(c, 'Resist', splitTopLevel(resist, /^,\s*/).filter((r) => !/^fire\b/i.test(r)).join(', '));
    const weak = getValue(c, 'Weaknesses');
    if (!/vulnerab\w* to cold/i.test(weak ?? '')) setOrAddField(c, 'defense', 'Weaknesses', weak ? `${weak}, vulnerability to cold` : 'vulnerability to cold', ['SR', 'Resist', 'Immune', 'DR', 'Defensive Abilities', 'Will']);
  }

  if (id === 'aerial') editSpeed(c, (parts, highest) => setMode(parts, 'fly', Math.min(highest, 10 * hd), ' (perfect)'));
  if (id === 'aqueous') editSpeed(c, (parts, highest) => setMode(parts, 'swim', highest + 10));
  if (id === 'chthonic') editSpeed(c, (parts, highest) => setMode(parts, 'burrow', Math.floor(highest / 10) * 5));
  if (id === 'primordial') editSpeed(c, (parts) => parts.forEach((p) => p.mode && (p.feet += 10)));

  const energy = t.energyDamage;
  if (energy) {
    const extra = `plus ${energy.amounts[b]} ${energy.energy}`;
    editMelee(c, (a) => {
      if (a.damage.includes(extra)) return;
      a.damage = a.damage.replace(LEADING_DAMAGE, `$1 ${extra}`);
    });
  }

  if (id === 'primordial') {
    const melee = getValue(c, 'Melee') ?? '';
    const attacks = splitTopLevel(melee, /^(?:\s+or\s+|\s+and\s+|,\s*)/).filter((p) => parseAttack(p));
    const types = attacks.map((p) => weaponType(parseAttack(p)!.prefix));
    // The list only breaks ties between primary attacks; a sole natural attack (an ankylosaurus's tail) is primary.
    const primary = PRIMARY_ORDER.find((w) => types.includes(w));
    const sole = !primary && attacks.length === 1;
    if (primary || sole) {
      editMelee(c, (a) => {
        if (primary && weaponType(a.prefix) !== primary) return;
        a.damage = a.damage.replace(/^(\d+d\d+|1(?!\d))/, (dice) => damageOneSizeLarger(dice, c.size));
      });
    }
    addPrimordialSlas(c, hd);
  }

  if (id === 'dark') {
    const name = 'Shadow Blend (Su)';
    c.special.push({
      name,
      text:
        'In any illumination other than bright light, a dark creature blends into the shadows, giving it concealment (20% miss chance). ' +
        'If it already has concealment, the miss chance gained from concealment increases to 50% (though this does not count as total concealment). ' +
        'A dark creature can suspend or resume this ability as a free action.',
    });
    c.changed.set(`special.${name}`, '');
  }

  const notes = [`${t.name} template (${SOURCE}, via Versatile Summon Monster): CR ${hd >= 5 ? '+1 (5 or more HD)' : '+0 (4 HD or fewer)'}.`];
  if (energy) notes.push(`The ${energy.amounts[b]} ${energy.energy} damage applies to natural weapons${energy.metalWeapons ? ' and metal weapons' : ' only'}.`);
  if (t.subtype) notes.push(`The ${t.subtype} subtype makes this summon monster spell ${/^[ae]/.test(t.subtype) ? 'an' : 'a'} ${t.subtype} spell.`);
  if (id === 'chthonic') notes.push('Its tunnels always collapse behind it and never leave a usable passage.');
  if (id === 'primordial') notes.push(`Spell-like abilities are 1/day; caster level assumed equal to its HD (${hd}).`);
  c.notes.push(notes.join(' '));
}
