// The simple templates applied by summon monster (Bestiary 1 and 2).
import { abilityMod, abilityScore, crString, crValue, findField, getValue, hitDice, parseNum, setOrAddField, setValue, xpForCr } from './fields';
import type { BuiltCreature } from './types';

export type TemplateId = 'celestial' | 'fiendish' | 'entropic' | 'resolute';

interface TemplateDef {
  id: TemplateId;
  name: string;
  energies: string[];
  drType: string;
  smite: 'evil' | 'good' | 'law' | 'chaos';
  source: string;
  url: string;
}

const BASE = 'https://www.d20pfsrd.com/bestiary/monster-listings/templates/';

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  celestial: {
    id: 'celestial',
    name: 'Celestial',
    energies: ['acid', 'cold', 'electricity'],
    drType: 'evil',
    smite: 'evil',
    source: 'Bestiary 1',
    url: `${BASE}celestial-creature-cr-special/`,
  },
  fiendish: {
    id: 'fiendish',
    name: 'Fiendish',
    energies: ['cold', 'fire'],
    drType: 'good',
    smite: 'good',
    source: 'Bestiary 1',
    url: `${BASE}fiendish/`,
  },
  entropic: {
    id: 'entropic',
    name: 'Entropic',
    energies: ['acid', 'fire'],
    drType: 'lawful',
    smite: 'law',
    source: 'Bestiary 2',
    url: `${BASE}simple-template-entropic-cr-0-or-1-1/`,
  },
  resolute: {
    id: 'resolute',
    name: 'Resolute',
    energies: ['acid', 'cold', 'fire'],
    drType: 'chaotic',
    smite: 'chaos',
    source: 'Bestiary 2',
    url: `${BASE}resolute-cr-0-or-1/`,
  },
};

const SMITE_TARGET = { evil: 'evil', good: 'good', law: 'lawful', chaos: 'chaotic' } as const;

/** Defenses by Hit Dice: 1–4, 5–10, 11+. */
function defensesFor(hd: number) {
  if (hd >= 11) return { resist: 15, dr: 10 };
  if (hd >= 5) return { resist: 10, dr: 5 };
  return { resist: 5, dr: 0 };
}

function addDarkvision(c: BuiltCreature) {
  const senses = getValue(c, 'Senses');
  if (senses === null) {
    setOrAddField(c, 'intro', 'Senses', 'darkvision 60 ft.', ['Init']);
    return;
  }
  const dv = senses.match(/darkvision (\d+) ft\./);
  if (dv && Number(dv[1]) >= 60) return;
  setValue(c, 'Senses', dv ? senses.replace(dv[0], 'darkvision 60 ft.') : `darkvision 60 ft., ${senses}`);
}

function mergeResist(c: BuiltCreature, energies: string[], amount: number) {
  const immune = (getValue(c, 'Immune') ?? '').toLowerCase();
  const current = getValue(c, 'Resist');
  const entries = new Map<string, string>();
  for (const part of (current ?? '').split(/,\s*/).filter(Boolean)) {
    const m = part.match(/^([a-z ]+?)\s+(\d+)(.*)$/i);
    entries.set(m ? m[1].toLowerCase() : part, part);
  }
  for (const e of energies) {
    if (immune.includes(e)) continue;
    const existing = entries.get(e);
    const existingAmount = existing ? Number(existing.match(/(\d+)/)?.[1] ?? 0) : 0;
    if (existingAmount < amount) entries.set(e, `${e} ${amount}`);
  }
  const value = [...entries.values()].join(', ');
  if (value) setOrAddField(c, 'defense', 'Resist', value, ['Immune', 'DR', 'Defensive Abilities', 'Will']);
}

function addDr(c: BuiltCreature, amount: number, type: string) {
  if (!amount) return;
  const current = getValue(c, 'DR');
  if (!current) {
    setOrAddField(c, 'defense', 'DR', `${amount}/${type}`, ['Defensive Abilities', 'Will']);
    return;
  }
  const same = current.match(new RegExp(`(\\d+)/${type}\\b`));
  if (same && Number(same[1]) >= amount) return;
  setValue(c, 'DR', same ? current.replace(same[0], `${amount}/${type}`) : `${current}, ${amount}/${type}`);
}

export function applyTemplate(c: BuiltCreature, id: TemplateId) {
  const t = TEMPLATES[id];
  const hd = hitDice(c);
  c.name = `${t.name} ${c.name.charAt(0).toLowerCase()}${c.name.slice(1)}`;

  const baseCr = crValue(c.cr);
  if (hd >= 5) {
    const cr = crString(baseCr + 1);
    c.changed.set('cr', c.cr ?? '');
    c.cr = cr;
    c.xp = xpForCr(cr) ?? c.xp;
  }

  addDarkvision(c);
  const { resist, dr } = defensesFor(hd);
  addDr(c, dr, t.drType);
  mergeResist(c, t.energies, resist);

  const sr = Math.floor(crValue(c.cr)) + 5;
  const currentSr = parseNum(getValue(c, 'SR') ?? '');
  if (currentSr === null || currentSr < sr) setOrAddField(c, 'defense', 'SR', String(sr), ['Resist', 'Immune', 'DR', 'Will']);

  const smite = `smite ${t.smite} (1/day)`;
  const sa = findField(c, 'Special Attacks');
  if (sa) setValue(c, 'Special Attacks', `${sa.field.value}, ${smite}`);
  else setOrAddField(c, 'offense', 'Special Attacks', smite, ['Reach', 'Space', 'Ranged', 'Melee', 'Speed']);

  const cha = abilityScore(c, 'Cha');
  const chaBonus = cha === null ? 0 : Math.max(0, abilityMod(cha));
  const target = SMITE_TARGET[t.smite];
  const name = `Smite ${t.smite[0].toUpperCase()}${t.smite.slice(1)} (Su)`;
  c.special.push({
    name,
    text:
      `Once per day as a swift action, the ${t.name.toLowerCase()} creature chooses one ${target} target within sight to smite. ` +
      `It adds its Charisma bonus (${chaBonus >= 0 ? '+' : ''}${chaBonus}) to attack rolls and gains a damage bonus equal to its HD (+${hd}) against that foe. ` +
      `The smite persists until the target is dead or the creature rests.`,
  });
  c.changed.set(`special.${name}`, '');
  c.notes.push(`${t.name} template (${t.source}): CR ${hd >= 5 ? '+1 (5 or more HD)' : '+0 (4 HD or fewer)'}.`);
}
