import type { BuiltCreature, Field, SectionName } from './types';

/** Parses "+7", "–2", "−1" or "12" into a number. */
export function parseNum(s: string): number | null {
  const m = s.trim().match(/^([+\-–−]?)\s*(\d+)/);
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] && m[1] !== '+' ? -n : n;
}

/** Formats a modifier the way stat blocks do ("+3", "–1"). */
export const fmtMod = (n: number) => (n < 0 ? `–${-n}` : `+${n}`);

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export function findField(c: BuiltCreature, label: string): { section: SectionName; field: Field } | null {
  for (const [section, fields] of Object.entries(c.sections) as [SectionName, Field[]][]) {
    const field = fields.find((f) => f.label === label);
    if (field) return { section, field };
  }
  return null;
}

export const getValue = (c: BuiltCreature, label: string) => findField(c, label)?.field.value ?? null;

function markChanged(c: BuiltCreature, key: string, original: string) {
  if (!c.changed.has(key)) c.changed.set(key, original);
}

/** Replaces a field's value, recording the original for highlighting. */
export function setValue(c: BuiltCreature, label: string, value: string) {
  const found = findField(c, label);
  if (!found || found.field.value === value) return;
  markChanged(c, `${found.section}.${label}`, found.field.value);
  found.field.value = value;
}

/** Adds a field, placing it after the first existing label in `after`. */
export function addField(c: BuiltCreature, section: SectionName, label: string, value: string, after: string[] = []) {
  const fields = c.sections[section];
  let index = fields.length;
  for (const a of after) {
    const i = fields.findIndex((f) => f.label === a);
    if (i >= 0) {
      index = i + 1;
      break;
    }
  }
  fields.splice(index, 0, { label, value });
  markChanged(c, `${section}.${label}`, '');
}

export function setOrAddField(c: BuiltCreature, section: SectionName, label: string, value: string, after: string[] = []) {
  if (findField(c, label)) setValue(c, label, value);
  else addField(c, section, label, value, after);
}

/** Adds `delta` to the leading number of a value ("+7 (+9 vs. poison)" → only +7). */
export function bumpLeading(value: string, delta: number, signed = true): string {
  return value.replace(/^([+\-–−]?)(\d+)/, (m) => {
    const n = (parseNum(m) ?? 0) + delta;
    return signed ? fmtMod(n) : String(n);
  });
}

/** Adds `delta` to the leading number and to numbers opening a parenthetical ("(+14 grapple)", "(24 vs. trip)"). */
export function bumpWithSituational(value: string, delta: number, signed: boolean): string {
  const lead = bumpLeading(value, delta, signed);
  return lead.replace(/\(([+\-–−]?)(\d+)(?=\s)/g, (m) => {
    const n = (parseNum(m.slice(1)) ?? 0) + delta;
    return `(${signed || m[1] === '+' ? fmtMod(n) : n}`;
  });
}

export function hitDice(c: BuiltCreature): number {
  const hp = getValue(c, 'hp') ?? '';
  const paren = hp.match(/\(([^)]*)\)/)?.[1] ?? hp;
  let total = 0;
  for (const m of paren.matchAll(/(\d+)\s*(?:HD|d\d+)/g)) total += Number(m[1]);
  return total || 1;
}

export function abilityScore(c: BuiltCreature, ability: 'Str' | 'Dex' | 'Con' | 'Int' | 'Wis' | 'Cha'): number | null {
  const v = getValue(c, ability);
  return v ? parseNum(v) : null;
}

/** Parses "1/3", "1/2", "5" into a number. */
export function crValue(cr: string | null): number {
  if (!cr) return 0;
  const frac = cr.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(cr) || 0;
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '1/8'],
  [1 / 6, '1/6'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [1 / 2, '1/2'],
];

export function crString(v: number): string {
  if (v >= 1) return String(Math.round(v));
  return FRACTIONS.find(([f]) => Math.abs(f - v) < 0.01)?.[1] ?? String(v);
}

const XP_BY_CR: Record<string, number> = {
  '1/8': 50, '1/6': 65, '1/4': 100, '1/3': 135, '1/2': 200,
  1: 400, 2: 600, 3: 800, 4: 1200, 5: 1600, 6: 2400, 7: 3200, 8: 4800, 9: 6400, 10: 9600,
  11: 12800, 12: 19200, 13: 25600, 14: 38400, 15: 51200, 16: 76800, 17: 102400, 18: 153600,
  19: 204800, 20: 307200, 21: 409600, 22: 614400, 23: 819200, 24: 1228800, 25: 1638400,
};

export const xpForCr = (cr: string) => XP_BY_CR[cr]?.toLocaleString('en-US') ?? null;
