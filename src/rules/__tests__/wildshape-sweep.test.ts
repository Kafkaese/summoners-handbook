import { expect, it } from 'vitest';
import animalsJson from '../../data/animals.json';
import type { Creature } from '../types';
import { buildWildShape, DEFAULT_PROFILE, tierFor } from '../wildshape';

const animals = Object.values(animalsJson as unknown as Record<string, Creature>);

it('builds every animal form at every druid level that allows it', () => {
  let built = 0;
  for (let level = 4; level <= 20; level++) {
    const tier = tierFor(level)!;
    for (const a of animals) {
      const r = buildWildShape(a, level, DEFAULT_PROFILE, 'N');
      expect(r === null, `${a.name} at ${level}`).toBe(!tier.sizes.includes(a.size as never));
      if (!r) continue;
      built++;
      expect(JSON.stringify(r.creature.sections), a.name).not.toMatch(/NaN|undefined|Infinity/);
    }
  }
  expect(built).toBeGreaterThan(2000);
});
