// Augment Summoning: +4 enhancement bonus to Strength and Constitution.
import { adjustMelee, adjustRanged, adjustSpecialAttackDamage, splitTopLevel } from './attacks';
import { abilityMod, abilityScore, bumpLeading, bumpWithSituational, fmtMod, getValue, hitDice, setValue } from './fields';
import type { BuiltCreature } from './types';

const hasFeat = (c: BuiltCreature, feat: string) => new RegExp(`\\b${feat}\\b`, 'i').test(getValue(c, 'Feats') ?? '');

const CON_BASED_RULES = ['distraction', 'breath weapon'];

/** Raises "DC N" by `delta` in abilities whose save DC is based on the given ability. */
function bumpDcs(c: BuiltCreature, ability: 'Strength' | 'Constitution', delta: number) {
  const based = new RegExp(`DCs? (is|are) ${ability}-based`, 'i');
  const bumpedNames: string[] = [];
  for (const sa of c.special) {
    if (!based.test(sa.text)) continue;
    const text = sa.text.replace(/\bDC (\d+)/g, (_, n) => `DC ${Number(n) + delta}`);
    if (text !== sa.text) {
      if (!c.changed.has(`special.${sa.name}`)) c.changed.set(`special.${sa.name}`, sa.text);
      sa.text = text;
      bumpedNames.push(sa.name.replace(/\s*\((Ex|Su|Sp)[^)]*\)\s*$/i, '').toLowerCase());
    }
  }
  // Universal monster rules whose DCs are Con-based without saying so in the stat block.
  if (ability === 'Constitution') {
    for (const umr of CON_BASED_RULES) {
      if (!c.special.some((sa) => sa.name.toLowerCase().startsWith(umr))) bumpedNames.push(umr);
    }
  }
  if (!bumpedNames.length) return;
  // The same DCs also appear in the offense/defense lines ("trample (2d6+9, DC 20)").
  for (const label of ['Special Attacks', 'Melee', 'Defensive Abilities', 'Aura']) {
    const value = getValue(c, label);
    if (!value) continue;
    const parts = splitTopLevel(value, /^[,;]\s*/);
    const updated = parts.map((p) =>
      bumpedNames.some((n) => p.toLowerCase().startsWith(n) || p.toLowerCase().includes(`plus ${n}`))
        ? p.replace(/\bDC (\d+)/g, (_, n) => `DC ${Number(n) + delta}`)
        : p,
    );
    setValue(c, label, rejoin(value, updated));
  }
}

/** Re-joins parts with the separators of the original string. */
function rejoin(original: string, parts: string[]) {
  const seps = [...original.matchAll(/[,;]\s*(?![^(]*\))/g)].map((m) => m[0]);
  return parts.map((p, i) => p + (i < parts.length - 1 ? seps[i] ?? ', ' : '')).join('');
}

export function applyAugmentSummoning(c: BuiltCreature) {
  const str = abilityScore(c, 'Str');
  const con = abilityScore(c, 'Con');
  const dex = abilityScore(c, 'Dex');

  if (str !== null) {
    const oldMod = abilityMod(str);
    const newMod = abilityMod(str + 4);
    const delta = newMod - oldMod;
    setValue(c, 'Str', String(str + 4));

    // Weapon Finesse attacks keep using Dex when it is still higher.
    const dexMod = dex === null ? -99 : abilityMod(dex);
    const finesse = hasFeat(c, 'Weapon Finesse');
    const attackDelta = finesse ? Math.max(newMod, dexMod) - Math.max(oldMod, dexMod) : delta;
    const change = { oldMod, newMod, attackDelta };

    const melee = getValue(c, 'Melee');
    if (melee) setValue(c, 'Melee', adjustMelee(melee, change));
    const ranged = getValue(c, 'Ranged');
    if (ranged) setValue(c, 'Ranged', adjustRanged(ranged, change));
    const sa = getValue(c, 'Special Attacks');
    if (sa) setValue(c, 'Special Attacks', rejoin(sa, splitTopLevel(sa, /^[,;]\s*/).map((p) => adjustSpecialAttackDamage(p, change))));

    const agile = hasFeat(c, 'Agile Maneuvers');
    const cmbDelta = agile ? Math.max(newMod, dexMod) - Math.max(oldMod, dexMod) : delta;
    const cmb = getValue(c, 'CMB');
    if (cmb && cmbDelta) setValue(c, 'CMB', bumpWithSituational(cmb, cmbDelta, true));
    const cmd = getValue(c, 'CMD');
    if (cmd) setValue(c, 'CMD', bumpWithSituational(cmd, delta, false));

    const skills = getValue(c, 'Skills');
    // Climb and Swim are Str-based unless the creature "uses Dex to modify" them.
    const dexSkills = (getValue(c, 'Racial Modifiers') ?? '').match(/uses Dex to modify ([^;]*)/i)?.[1] ?? '';
    const strSkillNames = ['Climb', 'Swim'].filter((sk) => !dexSkills.includes(sk));
    const strSkills = new RegExp(`\\b(${strSkillNames.join('|')}) ([+\\-–−]\\d+)((?: \\([+\\-–−]\\d+[^)]*\\))?)`, 'g');
    if (skills && strSkillNames.length) {
      setValue(
        c,
        'Skills',
        skills.replace(strSkills, (_, skill, bonus, extra: string) =>
          `${skill} ${bumpLeading(bonus, delta)}${extra.replace(/\(([+\-–−]\d+)/, (_m, b) => `(${bumpLeading(b, delta)}`)}`,
        ),
      );
    }
    bumpDcs(c, 'Strength', delta);
  }

  if (con !== null) {
    const delta = abilityMod(con + 4) - abilityMod(con);
    setValue(c, 'Con', String(con + 4));
    const hd = hitDice(c);
    const hp = getValue(c, 'hp');
    if (hp) {
      const extra = delta * hd;
      const updated = hp
        .replace(/^(\d+)/, (n) => String(Number(n) + extra))
        .replace(/\((\d+d\d+)(?:\s*([+\-–−])\s*(\d+))?/, (_, dice, sign, n) => {
          const bonus = (sign && sign !== '+' ? -Number(n) : Number(n ?? 0)) + extra;
          return `(${dice}${bonus === 0 ? '' : bonus > 0 ? `+${bonus}` : `–${-bonus}`}`;
        });
      setValue(c, 'hp', updated);
    }
    const fort = getValue(c, 'Fort');
    if (fort) setValue(c, 'Fort', bumpWithSituational(fort, delta, true));
    bumpDcs(c, 'Constitution', delta);
  }

  c.notes.push(`Augment Summoning: +4 Str and Con (${fmtMod(2)} to Str/Con modifiers).`);
}
