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

describe('ability descriptions', () => {
  it('explains each gained ability with the universal monster rules', () => {
    const tiger = shape('tiger', 8)!;
    expect(tiger.creature.special.map((s) => s.name)).toEqual(['Grab (Ex)', 'Pounce (Ex)', 'Rake (Ex)']);
    expect(tiger.creature.special[0].text).toMatch(/\+4 bonus on combat maneuver checks/);
    // Not granted by beast shape II, so not described either.
    expect(shape('tiger', 6)!.creature.special.map((s) => s.name)).toEqual(['Grab (Ex)', 'Pounce (Ex)']);
    expect(shape('dire-wolf', 6)!.creature.special.map((s) => s.name)).toEqual(['Trip (Ex)']);
  });
});

describe('elementals (elemental body)', () => {
  it('follows the druid table for sizes', () => {
    expect(shape('small-earth-elemental', 5)).toBeNull();
    expect(shape('small-earth-elemental', 6)!.tier.spell).toBe('elemental body I');
    expect(shape('medium-earth-elemental', 7)).toBeNull();
    expect(shape('small-earth-elemental', 8)!.tier.spell).toBe('elemental body II');
    expect(shape('huge-earth-elemental', 11)).toBeNull();
    expect(shape('huge-earth-elemental', 12)!.tier.spell).toBe('elemental body IV');
  });
  it('applies the element’s bonuses, including Con and hit points', () => {
    // Large water: +2 Str, –2 Dex, +6 Con, +6 natural armor (elemental body III).
    const r = shape('large-water-elemental', 10, { hp: 70 })!;
    expect(r.abilities).toEqual({ str: 12, dex: 12, con: 20 });
    expect(getValue(r.creature, 'hp')).toBe('100 (+30 from Con)');
    expect(getValue(r.creature, 'Fort')).toBe('+12');
    expect(getValue(r.creature, 'Speed')).toBe('20 ft., swim 60 ft.');
    expect(getValue(r.creature, 'Immune')).toBe('bleed, critical hits, sneak attacks');
    expect(getValue(r.creature, 'SQ')).toBe('water breathing');
    // Two slams: primary, 1× Str. BAB 7, Str +1, size –1.
    expect(getValue(r.creature, 'Melee')).toBe('2 slams +7 (1d8+1)');
    expect(getValue(r.creature, 'Special Attacks')).toMatch(/^vortex \(DC 19, 10–40 ft\.\)$/);
    expect(r.notGained).toEqual(expect.arrayContaining(['drench', 'water mastery']));
  });
  it('gives air its perfect fly speed and fire its burn, resistance and vulnerability', () => {
    const air = shape('small-air-elemental', 6)!;
    expect(getValue(air.creature, 'Speed')).toBe('fly 60 ft. (perfect) (no land speed)');
    const fire = shape('huge-fire-elemental', 12)!;
    // BAB 9, Str 10 (fire gives no Str), size –2.
    expect(getValue(fire.creature, 'Melee')).toBe('2 slams +7 (2d6 plus burn)');
    expect(getValue(fire.creature, 'Special Attacks')).toBe('burn (2d6, DC 20)');
    expect(getValue(fire.creature, 'Resist')).toBe('fire 20');
    expect(getValue(fire.creature, 'Weaknesses')).toBe('vulnerability to cold');
    expect(getValue(fire.creature, 'DR')).toBe('5/—');
    expect(fire.lost.some((l) => /Speech/.test(l))).toBe(false);
  });
  it("doesn't allow greater or elder elementals", () => {
    expect(shape('greater-fire-elemental', 20)).toBeNull();
    expect(shape('elder-air-elemental', 20)).toBeNull();
  });
  it('lets earth elementals glide through earth', () => {
    expect(getValue(shape('medium-earth-elemental', 8)!.creature, 'Speed')).toBe('20 ft., burrow 20 ft., earth glide');
  });
});
