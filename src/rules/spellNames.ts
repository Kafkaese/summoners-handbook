// Splitting and normalizing spell lines such as
// "1/day—summon (level 2, 1 mephit 25%), blur 1/hour, quickened dimension door".
// Shared by the app and scripts/scrape-spells.mjs, so keep it dependency-free.

/** Splits "At will—a, b (x, y), c" into its prefix ("At will—") and items. */
export function splitSpellLine(line: string): { prefix: string; items: string[] } {
  const dash = line.indexOf('—');
  const prefix = dash >= 0 ? line.slice(0, dash + 1) : '';
  return { prefix, items: splitItems(line.slice(prefix.length)) };
}

/** Splits "a, b (x, y), c" on top-level commas. */
export function splitItems(body: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth = Math.max(0, depth - 1);
      // A missing comma after a parenthetical: "greater teleport (self only) telekinesis".
      if (depth === 0 && /^ [a-z]/i.test(body.slice(i + 1, i + 3)) && !/^ \d/.test(body.slice(i + 1, i + 3))) {
        items.push(body.slice(start, i + 1));
        start = i + 2;
      }
    } else if (ch === ',' && depth === 0) {
      items.push(body.slice(start, i));
      start = i + 1;
    }
  }
  items.push(body.slice(start));
  return items.map((s) => s.trim()).filter(Boolean);
}

const METAMAGIC = /^(quickened|empowered|maximized|extended|heightened|silent|still|enlarged|widened)\s+/i;

/** Canonical lowercase spell name for an item: "Quickened Dimension Door^D (DC 15)" → "dimension door". */
export function spellKey(item: string): string {
  return item
    .replace(/<\/?a\b[^>]*>?/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\^\S*/g, '')
    .replace(/[*†‡]/g, '')
    .replace(/\s+\d+\/(day|hour|week|month|year|round)\.?\s*$/i, '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(METAMAGIC, '')
    .toLowerCase();
}

/** The d20pfsrd page name for a spell: "greater teleport" → base "teleport" with variant "greater". */
export function spellPage(key: string): { base: string; variant: string | null } {
  const m = key.match(/^(greater|lesser|mass|communal)\s+(.*)$/) ?? key.match(/^(.*?),?\s+(greater|lesser|mass|communal)$/);
  if (!m) return { base: key, variant: null };
  return /^(greater|lesser|mass|communal)$/.test(m[1]) ? { base: m[2], variant: m[1] } : { base: m[1], variant: m[2] };
}
