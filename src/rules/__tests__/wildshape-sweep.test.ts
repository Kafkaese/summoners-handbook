import { expect, it } from 'vitest';
import animalsJson from '../../data/animals.json';
import plantsJson from '../../data/plants.json';
import { CREATURES } from '../summon';
import type { Creature } from '../types';
import { buildWildShape, DEFAULT_PROFILE, elementOf, rulesFor } from '../wildshape';

const forms = [
  ...Object.values(animalsJson as unknown as Record<string, Creature>),
  ...Object.values(CREATURES).filter((c) => elementOf(c)),
  ...Object.values(plantsJson as unknown as Record<string, Creature>),
];

it('builds every animal, elemental and plant form at every druid level that allows it', () => {
  let built = 0;
  for (let level = 4; level <= 20; level++) {
    for (const a of forms) {
      const r = buildWildShape(a, level, DEFAULT_PROFILE, 'N');
      expect(r === null, `${a.name} at ${level}`).toBe(rulesFor(a, level) === null);
      if (!r) continue;
      built++;
      expect(JSON.stringify(r.creature.sections), a.name).not.toMatch(/NaN|undefined|Infinity/);
    }
  }
  expect(built).toBeGreaterThan(2000);
});
