import { expect, it } from 'vitest';
import { classById } from '../classes';
import { buildCreature, choicesFor, LISTS, type Settings } from '../summon';

it('builds every creature with a template and Augment Summoning', () => {
  const settings: Settings = { classId: 'wizard', level: 20, alignment: 'N', augmentSummoning: true, superiorSummoning: false, includeAlternatives: true };
  let built = 0;
  for (const spell of Object.keys(LISTS.spells) as (keyof typeof LISTS.spells)[]) {
    for (let level = 1; level <= 9; level++) {
      for (const choice of choicesFor(spell, level, classById('wizard'), settings)) {
        const c = buildCreature(choice, choice.templateOptions[0] ?? null, settings);
        if (!c) continue;
        built++;
        const text = JSON.stringify(c.sections);
        expect(text, c.name).not.toMatch(/NaN|undefined/);
      }
    }
  }
  expect(built).toBeGreaterThan(200);
});
