// Parsing and adjusting attack lines such as
// "glaive +11/+6 melee (1d10+6 plus infernal wound) or 2 claws +10 melee (1d6+4)".
import { fmtMod, parseNum } from './fields';

/** Splits on a separator, ignoring separators inside parentheses. */
export function splitTopLevel(s: string, sep: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const m = s.slice(i).match(sep);
      if (m && m.index === 0) {
        parts.push(s.slice(start, i));
        start = i + m[0].length;
        i = start - 1;
      }
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

interface ParsedAttack {
  prefix: string;
  bonuses: number[];
  middle: string;
  damage: string;
  suffix: string;
}

const ATTACK_RE = /^(.*?)\s([+\-–−]\d+(?:\/[+\-–−]\d+)*)(\s[^(]*)?\((.*)\)(.*)$/;

export function parseAttack(s: string): ParsedAttack | null {
  const m = s.match(ATTACK_RE);
  if (!m) return null;
  return {
    prefix: m[1],
    bonuses: m[2].split('/').map((b) => parseNum(b) ?? 0),
    middle: m[3] ?? ' ',
    damage: m[4],
    suffix: m[5],
  };
}

export const formatAttack = (a: ParsedAttack) =>
  `${a.prefix} ${a.bonuses.map(fmtMod).join('/')}${a.middle}(${a.damage})${a.suffix}`;

const DAMAGE_RE = /^(\d+d\d+)(?:\s*([+\-–−])\s*(\d+))?/;

export function damageBonus(damage: string): number | null {
  const m = damage.match(DAMAGE_RE);
  if (!m) return null;
  if (!m[2]) return 0;
  return m[2] === '+' ? Number(m[3]) : -Number(m[3]);
}

export function setDamageBonus(damage: string, bonus: number): string {
  return damage.replace(DAMAGE_RE, (_, dice) => (bonus === 0 ? dice : `${dice}${bonus > 0 ? '+' : '–'}${Math.abs(bonus)}`));
}

/** Strength contribution to damage for a given multiplier (penalties are not multiplied). */
const strDamage = (mod: number, mult: number) => (mod < 0 ? (mult === 0 ? 0 : mod) : Math.floor(mod * mult));

/**
 * Guesses the Strength multiplier (0, ½, 1 or 1½) from the printed damage
 * bonus, falling back to 1½ for a creature's only natural attack and 1 otherwise.
 */
export function inferStrMultiplier(bonus: number, strMod: number, soleAttack: boolean): number {
  const fallback = soleAttack ? 1.5 : 1;
  if (strMod <= 0) return fallback;
  const candidates = [1.5, 1, 0.5, 0];
  const exact = candidates.filter((m) => strDamage(strMod, m) === bonus);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return exact.includes(fallback) ? fallback : exact[0];
  // Other bonuses (feats, weapon enhancement) are mixed in: assume the closest.
  return candidates.reduce((best, m) =>
    Math.abs(strDamage(strMod, m) - bonus) < Math.abs(strDamage(strMod, best) - bonus) ? m : best,
  );
}

export interface StrChange {
  oldMod: number;
  newMod: number;
  /** Change to the attack bonus (0 for finesse attacks that keep using Dex). */
  attackDelta: number;
}

/** Applies a Strength change to a full Melee value. */
export function adjustMelee(value: string, change: StrChange): string {
  return splitTopLevel(value, /^\s+or\s+/)
    .map((option) => {
      const attacks = splitTopLevel(option, /^,\s*/);
      const sole = attacks.length === 1 && !/^\d+\s/.test(attacks[0]);
      return attacks
        .map((text) => {
          const a = parseAttack(text);
          if (!a) return text;
          a.bonuses = a.bonuses.map((b) => b + change.attackDelta);
          const bonus = damageBonus(a.damage);
          if (bonus !== null) {
            const mult = inferStrMultiplier(bonus, change.oldMod, sole);
            a.damage = setDamageBonus(a.damage, bonus + strDamage(change.newMod, mult) - strDamage(change.oldMod, mult));
          }
          return formatAttack(a);
        })
        .join(', ');
    })
    .join(' or ');
}

/** Ranged attacks keep their attack bonus; thrown weapons add Strength to damage. */
export function adjustRanged(value: string, change: StrChange): string {
  return splitTopLevel(value, /^\s+or\s+/)
    .map((option) =>
      splitTopLevel(option, /^,\s*/)
        .map((text) => {
          const a = parseAttack(text);
          if (!a) return text;
          const bonus = damageBonus(a.damage);
          // Composite bows have a fixed Strength rating.
          if (/\bbow\b|longbow|shortbow|crossbow/i.test(a.prefix)) return text;
          if (bonus === null || change.oldMod <= 0 || bonus !== change.oldMod) return text;
          a.damage = setDamageBonus(a.damage, bonus + change.newMod - change.oldMod);
          return formatAttack(a);
        })
        .join(', '),
    )
    .join(' or ');
}

/** Adjusts Strength-based damage in special attacks like "trample (2d6+9, DC 20)". */
export function adjustSpecialAttackDamage(entry: string, change: StrChange): string {
  if (!/^(constrict|rend|trample|rake|powerful charge|crush|swallow whole|tail slap|tail sweep|wing buffet)\b/i.test(entry)) return entry;
  return entry.replace(/\((\d+d\d+(?:\s*[+\-–−]\s*\d+)?)/, (m, dmg: string) => {
    const bonus = damageBonus(dmg);
    if (bonus === null) return m;
    const mult = /^(rend|trample)/i.test(entry) ? 1.5 : inferStrMultiplier(bonus, change.oldMod, false);
    return `(${setDamageBonus(dmg, bonus + strDamage(change.newMod, mult) - strDamage(change.oldMod, mult))}`;
  });
}
