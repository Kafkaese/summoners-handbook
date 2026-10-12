import { describe, expect, it } from 'vitest';
import { allowedTemplates } from '../alignment';
import { classById, summonOptions } from '../classes';
import { getValue } from '../fields';
import { buildCreature, choicesFor, countGroups, type Settings } from '../summon';

const settings: Settings = {
  classId: 'wizard',
  level: 9,
  alignment: 'NG',
  augmentSummoning: false,
  superiorSummoning: false,
  includeAlternatives: false,
  templateRule: 'core',
  deityAlignment: 'NG',
};

function build(spell: 'summon-monster' | 'summon-natures-ally', level: number, name: string, opts: Partial<Settings> = {}, template: Parameters<typeof buildCreature>[1] = null) {
  const s = { ...settings, ...opts };
  const choice = choicesFor(spell, level, classById(s.classId), s).find((c) => c.name === name);
  if (!choice) throw new Error(`no choice ${name}`);
  return { choice, creature: buildCreature(choice, template, s)! };
}

describe('class spell access', () => {
  it('gives a 9th-level wizard summon monster I–V', () => {
    const opts = summonOptions(classById('wizard'), 9).filter((o) => o.available);
    expect(opts.map((o) => o.level)).toEqual([1, 2, 3, 4, 5]);
  });
  it('maps summoner spell levels and adds the SLA', () => {
    const opts = summonOptions(classById('summoner'), 7).filter((o) => o.available);
    expect(opts.filter((o) => !o.sla).map((o) => o.level)).toEqual([1, 2, 4]);
    expect(opts.filter((o) => o.sla).map((o) => o.level)).toEqual([1, 2, 3, 4]);
  });
  it('rangers get summon nature’s ally I at 4th level with caster level 1', () => {
    const [first] = summonOptions(classById('ranger'), 4);
    expect(first).toMatchObject({ level: 1, available: true, casterLevel: 1 });
  });
});

describe('templates by alignment', () => {
  it('core: celestial or fiendish, either when neutral on good/evil', () => {
    expect(allowedTemplates('LG', 'core')).toEqual(['celestial']);
    expect(allowedTemplates('CN', 'core')).toEqual(['celestial', 'fiendish']);
  });
  it('expanded: one template per alignment component, any for true neutral', () => {
    expect(allowedTemplates('LG', 'expanded')).toEqual(['resolute', 'celestial']);
    expect(allowedTemplates('NE', 'expanded')).toEqual(['fiendish']);
    expect(allowedTemplates('N', 'expanded')).toHaveLength(4);
  });
  it('lenient: a neutral axis offers both of its templates', () => {
    expect(allowedTemplates('NG', 'expanded-lenient')).toEqual(['celestial', 'entropic', 'resolute']);
    expect(allowedTemplates('LN', 'expanded-lenient')).toEqual(['celestial', 'fiendish', 'resolute']);
    expect(allowedTemplates('CE', 'expanded-lenient')).toEqual(['fiendish', 'entropic']);
  });
});

describe('count groups', () => {
  it('lists the lower-level options', () => {
    expect(countGroups(4, false).map((g) => g.count)).toEqual(['1', '1d3', '1d4+1']);
    expect(countGroups(4, true).map((g) => g.count)).toEqual(['1', '1d3+1', '1d4+2']);
  });
});

describe('celestial template', () => {
  it('adds HD-based defenses and CR to a dire wolf', () => {
    const { creature } = build('summon-monster', 4, 'Dire wolf', {}, 'celestial');
    expect(creature.name).toBe('Celestial dire wolf');
    expect(creature.cr).toBe('4');
    expect(creature.alignment).toBe('NG');
    expect(getValue(creature, 'DR')).toBe('5/evil');
    expect(getValue(creature, 'Resist')).toBe('acid 10, cold 10, electricity 10');
    expect(getValue(creature, 'SR')).toBe('9');
    expect(getValue(creature, 'Senses')).toMatch(/^darkvision 60 ft\., low-light vision/);
    expect(getValue(creature, 'Special Attacks')).toBe('smite evil (1/day)');
  });
  it('keeps CR for creatures with 4 HD or fewer', () => {
    const { creature } = build('summon-monster', 1, 'Dog', {}, 'celestial');
    expect(creature.cr).toBe('1/3');
    expect(getValue(creature, 'SR')).toBe('5');
    expect(getValue(creature, 'DR')).toBeNull();
  });
});

describe('augment summoning', () => {
  it('raises a dire wolf’s bite, hp, Fort and CMD', () => {
    const { creature } = build('summon-monster', 4, 'Dire wolf', { augmentSummoning: true });
    expect(getValue(creature, 'Str')).toBe('23');
    expect(getValue(creature, 'Melee')).toBe('bite +9 (1d8+9 plus trip)');
    expect(getValue(creature, 'hp')).toBe('47 (5d8+25)');
    expect(getValue(creature, 'Fort')).toBe('+9');
    expect(getValue(creature, 'CMB')).toBe('+10');
    expect(getValue(creature, 'CMD')).toBe('22 (26 vs. trip)');
  });
  it('handles two-handed weapons, multiple attacks and Climb', () => {
    const { creature } = build('summon-monster', 5, 'Bearded devil', { augmentSummoning: true, alignment: 'LE' });
    expect(getValue(creature, 'Melee')).toBe('glaive +13/+8 melee (1d10+9 plus infernal wound) or 2 claws +12 melee (1d6+6)');
    expect(getValue(creature, 'Skills')).toMatch(/^Climb \+15,/);
    expect(creature.special.find((s) => s.name.startsWith('Beard'))!.text).toMatch(/DC 19 Fortitude/);
  });
  it('keeps finesse attack bonuses when Dex is still higher', () => {
    const { creature } = build('summon-monster', 2, 'Small Air Elemental', { augmentSummoning: true });
    expect(getValue(creature, 'Melee')).toBe('slam +6 (1d4+4)');
  });
});

describe('alignment restrictions', () => {
  it('blocks a good cleric from summoning devils', () => {
    const choices = choicesFor('summon-monster', 2, classById('cleric'), { ...settings, classId: 'cleric', alignment: 'LG' });
    expect(choices.find((c) => c.name === 'Lemure (devil)')!.blocked).toMatch(/evil/);
    expect(choices.find((c) => c.name === 'Wolf')!.blocked).toBeNull();
  });
  it('lets nature’s ally creatures match the caster’s alignment', () => {
    const { creature } = build('summon-natures-ally', 5, 'Cyclops', { classId: 'druid', alignment: 'CN' });
    expect(creature.alignment).toBe('CN');
  });
});

describe('deity alignment', () => {
  const cleric = (alignment: Settings['alignment'], deityAlignment: Settings['alignment'], templateRule: Settings['templateRule'] = 'core') =>
    choicesFor('summon-monster', 2, classById('cleric'), { ...settings, classId: 'cleric', alignment, deityAlignment, templateRule });

  it('blocks creatures opposed to the deity even when the cleric could cast them', () => {
    const lemure = cleric('N', 'LG').find((c) => c.name === 'Lemure (devil)')!;
    expect(lemure.blocked).toMatch(/evil opposes your deity's alignment \(lawful good\)/);
    expect(cleric('N', 'LN').find((c) => c.name === 'Lemure (devil)')!.blocked).toBeNull();
  });
  it('removes templates opposed to the deity', () => {
    const wolf = cleric('N', 'NG').find((c) => c.name === 'Wolf')!;
    expect(wolf.templateOptions).toEqual(['celestial']);
    expect(wolf.excludedTemplates.map((x) => x.template)).toEqual(['fiendish']);
  });
  it('checks both alignments for expanded templates', () => {
    const wolf = cleric('NG', 'LG', 'expanded-lenient').find((c) => c.name === 'Wolf')!;
    expect(wolf.templateOptions).toEqual(['celestial', 'resolute']);
  });
  it('ignores the deity for other classes', () => {
    const s = { ...settings, alignment: 'N' as const, deityAlignment: 'LG' as const };
    expect(choicesFor('summon-monster', 2, classById('wizard'), s).find((c) => c.name === 'Wolf')!.templateOptions).toEqual(['celestial', 'fiendish']);
  });
});
