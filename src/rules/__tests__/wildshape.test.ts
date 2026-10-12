import { describe, expect, it } from 'vitest';
import { getValue } from '../fields';
import { CREATURES } from '../summon';
import { buildWildShape, DEFAULT_PROFILE, type DruidProfile, tierFor, usesPerDay } from '../wildshape';

const druid: DruidProfile = { ...DEFAULT_PROFILE, str: 10, dex: 14, con: 14, wis: 16 };
const shape = (id: string, level: number, profile: Partial<DruidProfile> = {}) => buildWildShape(CREATURES[id], level, { ...druid, ...profile }, 'N');

describe('wild shape by level', () => {
  it('follows the druid table', () => {
    expect(tierFor(3)).toBeNull();
    expect(tierFor(4)?.spell).toBe('beast shape I');
    expect(tierFor(7)?.spell).toBe('beast shape II');
    expect(tierFor(12)?.spell).toBe('beast shape III');
    expect([4, 5, 6, 8, 18, 19, 20].map(usesPerDay)).toEqual([1, 1, 2, 3, 8, 8, 'at will']);
  });
  it("doesn't allow Large forms before 6th level", () => {
    expect(shape('dire-wolf', 4)).toBeNull();
  });
});

describe('dire wolf at 6th level (beast shape II, Large)', () => {
  const r = shape('dire-wolf', 6)!;
  it('applies the size adjustments', () => {
    expect(r.abilities).toEqual({ str: 14, dex: 12, con: 14 });
    expect(getValue(r.creature, 'AC')).toBe('14, touch 10, flat-footed 13 (+1 Dex, +4 natural, –1 size)');
  });
  it('uses the druid’s BAB and Str for the natural attack, with trip', () => {
    // Sole natural attack: 1½ × Str.
    expect(getValue(r.creature, 'Melee')).toBe('bite +5 (1d8+3 plus trip)');
    expect(getValue(r.creature, 'CMB')).toBe('+7');
    expect(getValue(r.creature, 'CMD')).toBe('18 (22 vs. trip)');
  });
  it('takes the form’s speed and senses, and the druid’s saves', () => {
    expect(getValue(r.creature, 'Speed')).toBe('50 ft.');
    expect(getValue(r.creature, 'Senses')).toBe('low-light vision, scent');
    expect([getValue(r.creature, 'Fort'), getValue(r.creature, 'Ref'), getValue(r.creature, 'Will')]).toEqual(['+7', '+3', '+8']);
    expect(r.dc).toBe(17);
  });
});

describe('tiger', () => {
  it('gets pounce and grab but not rake from beast shape II', () => {
    const r = shape('tiger', 6)!;
    expect(getValue(r.creature, 'Melee')).toBe('2 claws +5 (1d8+2 plus grab), bite +5 (2d6+2 plus grab)');
    expect(getValue(r.creature, 'Special Attacks')).toBe('pounce');
    expect(r.notGained).toContain('rake');
    expect(getValue(r.creature, 'CMB')).toBe('+7 (+11 grapple)');
  });
  it('gets rake from beast shape III, recomputed', () => {
    const r = shape('tiger', 8)!;
    expect(getValue(r.creature, 'Special Attacks')).toBe('pounce, rake (2 claws +7, 1d8+2)');
  });
  it('keeps critical ranges', () => {
    expect(getValue(shape('tiger-dire-smilodon', 8)!.creature, 'Melee')).toMatch(/bite \+7 \(2d6\+2\/19–20 plus grab\)/);
  });
});

describe('profile options', () => {
  it('Multiattack, Weapon Finesse and wild armor', () => {
    const r = shape('tiger', 6, { wildArmor: 5, deflection: 1, weaponFinesse: true, dex: 20 })!;
    // Dex 20 → 18 as Large (+4); finesse uses it for the attack roll.
    expect(getValue(r.creature, 'Melee')).toMatch(/^2 claws \+7 /);
    // 10 + Dex 4 – size 1 + natural 4 + deflection 1 + wild armor 5.
    expect(getValue(r.creature, 'AC')).toMatch(/^23, touch 14, flat-footed 19 /);
    expect(r.lost.some((l) => /Spellcasting/.test(l))).toBe(true);
    expect(shape('tiger', 6, { naturalSpell: true })!.lost.some((l) => /Spellcasting/.test(l))).toBe(false);
  });
});

describe('attack lines', () => {
  it('splits attacks joined with "and" and keeps non-Strength damage as printed', () => {
    const croc = buildWildShape(CREATURES['crocodile'], 8, druid, 'N')!;
    // Large: Str 14 (+2), size –1, BAB 6. The tail slap is secondary: –5 and ½ Str.
    expect(getValue(croc.creature, 'Melee')).toBe('bite +7 (1d8+2 plus grab), tail slap +2 (1d12+1)');
  });
});
