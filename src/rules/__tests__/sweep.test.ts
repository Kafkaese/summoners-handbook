import { expect, it } from 'vitest';
import { classById } from '../classes';
import { buildCreature, choicesFor, LISTS, type Settings } from '../summon';
import { VERSATILE_IDS } from '../versatile';

it('builds every creature with each template, Augment Summoning and the feat lists', () => {
  let built = 0;
  // Each feat list needs a qualifying alignment.
  for (const alignment of ['NG', 'NE', 'N'] as const) {
    const settings: Settings = {
      classId: 'wizard',
      level: 20,
      alignment,
      augmentSummoning: true,
      superiorSummoning: false,
      includeAlternatives: true,
      templateRule: 'expanded',
      deityAlignment: alignment,
      summonGoodMonster: true,
      summonEvilMonster: true,
      summonNeutralMonster: true,
      sunlightSummons: true,
      moonlightSummons: true,
      versatileSummonMonster: true,
      versatileTemplates: [...VERSATILE_IDS],
    };
    for (const spell of Object.keys(LISTS.spells) as (keyof typeof LISTS.spells)[]) {
      for (let level = 1; level <= 9; level++) {
        for (const choice of choicesFor(spell, level, classById('wizard'), settings)) {
          for (const template of choice.templateOptions.length ? choice.templateOptions : [null]) {
            const c = buildCreature(choice, template, settings);
            if (!c) continue;
            built++;
            expect(JSON.stringify(c.sections), c.name).not.toMatch(/NaN|undefined/);
          }
        }
      }
    }
  }
  expect(built).toBeGreaterThan(600);
});
