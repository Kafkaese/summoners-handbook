import { describe, expect, it } from 'vitest';
import { restrictionsOf, spellRestriction } from '../restrictions';
import { spellKey, splitSpellLine } from '../spellNames';
import { CREATURES } from '../summon';

describe('spell names', () => {
  it('normalizes stat block items', () => {
    expect(spellKey('Quickened Dimension Door^D (DC 15)')).toBe('dimension door');
    expect(spellKey('blur 1/hour')).toBe('blur');
    expect(spellKey('Summon</a (level 4, 2 bone devils, 50%)')).toBe('summon');
    expect(spellKey('bear’s endurance')).toBe("bear's endurance");
  });
  it('splits lines, including a missing comma after a parenthetical', () => {
    expect(splitSpellLine('At will—deeper darkness, greater teleport (self only) telekinesis (DC 19)')).toEqual({
      prefix: 'At will—',
      items: ['deeper darkness', 'greater teleport (self only)', 'telekinesis (DC 19)'],
    });
    expect(splitSpellLine('4th—dismissal (2) (DC 18), divine power').items).toEqual(['dismissal (2) (DC 18)', 'divine power']);
  });
});

describe('restricted spells', () => {
  it('flags summoning, teleportation, planar travel and costly components', () => {
    expect(spellRestriction('summon (level 3, 1 bearded devil 50%)')).toEqual(['summons a creature']);
    expect(spellRestriction('greater teleport (self only)')).toEqual(['teleportation']);
    expect(spellRestriction('plane shift (DC 20)')).toEqual(['teleportation', 'planar travel']);
    expect(spellRestriction('ethereal jaunt')).toEqual(['planar travel']);
    expect(spellRestriction('wish')).toEqual(['costly material component (25,000 gp)']);
    expect(spellRestriction('lesser restoration')).toBeNull();
    expect(spellRestriction('telekinesis (DC 18)')).toBeNull();
  });
  it('collects everything a creature can’t use', () => {
    const names = (id: string) => restrictionsOf(CREATURES[id]).map((r) => r.name);
    expect(names('bearded-devil-barbazu')).toEqual(['greater teleport', 'summon']);
    expect(names('xill')).toEqual(['planewalk']);
    expect(names('dire-wolf')).toEqual([]);
  });
});
