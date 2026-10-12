// Fetches every creature referenced by src/data/summonLists.json, parses its
// stat block and writes src/data/creatures.json. Each list entry gets a
// `creatureIds` array (several for generic entries such as "Mephit (any)").
import { readFile, writeFile } from 'node:fs/promises';
import { fetchPage } from './fetch.mjs';
import { parsePage } from './statblock.mjs';

const LISTS_FILE = new URL('../src/data/summonLists.json', import.meta.url);
const CREATURES_FILE = new URL('../src/data/creatures.json', import.meta.url);
const BASE = 'https://www.d20pfsrd.com/bestiary/monster-listings/';

const ELEMENTS = [
  { element: 'air', note: null },
  { element: 'earth', note: null },
  { element: 'fire', note: null },
  { element: 'water', note: null },
  { element: 'ice', note: 'Bestiary 2 elemental; the summon lists name only "elemental", so check with your GM.' },
  { element: 'lightning', note: 'Bestiary 2 elemental; the summon lists name only "elemental", so check with your GM.' },
  { element: 'magma', note: 'Bestiary 2 elemental; the summon lists name only "elemental", so check with your GM.' },
  { element: 'mud', note: 'Bestiary 2 elemental; the summon lists name only "elemental", so check with your GM.' },
];
// The ten mephits from the Bestiary ("mephit (any)" on the core lists).
const MEPHITS = ['air', 'dust', 'earth', 'fire', 'ice', 'magma', 'ooze', 'salt', 'steam', 'water'];

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const tokens = (s) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[(),]/g, ' ')
      .split(/\s+/)
      .map((t) => t.replace(/s$/, ''))
      .filter((t) => t && !['the', 'of', 'a', 'herd', 'animal', 'cat', 'dinosaur', 'devil', 'demon', 'snake', 'horse', 'elephant', 'dolphin'].includes(t)),
  );

function pickStatblock(page, wantedName) {
  if (page.statblocks.length <= 1) return page.statblocks[0] ?? null;
  const want = tokens(wantedName);
  let best = null;
  let bestScore = -Infinity;
  for (const sb of page.statblocks) {
    const have = tokens(sb.name);
    let score = 0;
    for (const t of want) if (have.has(t)) score += 2;
    score -= [...have].filter((t) => !want.has(t)).length;
    if (score > bestScore) {
      best = sb;
      bestScore = score;
    }
  }
  return best;
}

const creatures = {};
const warnings = [];

async function loadCreature(url, wantedName, extra = {}) {
  let page;
  try {
    const { html, url: finalUrl } = await fetchPage(url);
    page = parsePage(html, finalUrl);
  } catch (e) {
    warnings.push(`${wantedName}: fetch failed (${e.message})`);
    return null;
  }
  const sb = pickStatblock(page, wantedName);
  if (!sb) {
    warnings.push(`${wantedName}: no stat block found at ${url}`);
    return null;
  }
  if (page.statblocks.length > 1) {
    console.log(`  picked "${sb.name}" for "${wantedName}" from [${page.statblocks.map((s) => s.name).join(', ')}]`);
  }
  const id = slug(sb.name);
  if (creatures[id] && creatures[id].pageTitle !== page.title) {
    warnings.push(`${wantedName}: id collision ${id} (${creatures[id].url} vs ${page.url})`);
  }
  creatures[id] ??= { id, url: page.url, pageTitle: page.title, source: page.source, ...extra, ...sb };
  return id;
}

async function resolveEntry(entry) {
  const elemental = entry.name.match(/^Elemental \((small|medium|large|huge|greater|elder)\)$/i);
  if (elemental) {
    const size = elemental[1].toLowerCase();
    const ids = [];
    for (const { element, note } of ELEMENTS) {
      const { html } = await fetchPage(`${BASE}outsiders/elemental/elemental-${element}/`);
      const index = parsePage(html, '');
      const child = index.childPages.find((c) => c.title.toLowerCase().endsWith(`, ${size}`));
      if (!child) {
        warnings.push(`${entry.name}: no ${size} ${element} elemental page`);
        continue;
      }
      const id = await loadCreature(child.href, `${size} ${element} elemental`, note ? { note } : {});
      if (id) ids.push(id);
    }
    return ids;
  }
  if (/^Mephit \(any\)$/i.test(entry.name)) {
    const ids = [];
    for (const m of MEPHITS) {
      const id = await loadCreature(`${BASE}outsiders/mephit/mephit-${m}/`, `${m} mephit`);
      if (id) ids.push(id);
    }
    return ids;
  }
  if (!entry.url) {
    warnings.push(`${entry.name}: no stat block link on the summon list`);
    return [];
  }
  const id = await loadCreature(entry.url, entry.name);
  return id ? [id] : [];
}

const lists = JSON.parse(await readFile(LISTS_FILE, 'utf8'));
for (const [spell, levels] of Object.entries(lists.spells)) {
  for (const [level, groups] of Object.entries(levels)) {
    for (const entries of Object.values(groups)) {
      for (const entry of entries) {
        console.log(`${spell} ${level}: ${entry.name}`);
        entry.creatureIds = await resolveEntry(entry);
      }
    }
  }
}

await writeFile(LISTS_FILE, JSON.stringify(lists, null, 2) + '\n');
const sorted = Object.fromEntries(Object.entries(creatures).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(CREATURES_FILE, JSON.stringify(sorted, null, 1) + '\n');
console.log(`\n${Object.keys(creatures).length} creatures written.`);
if (warnings.length) console.log(`\nWarnings:\n${warnings.map((w) => `- ${w}`).join('\n')}`);
