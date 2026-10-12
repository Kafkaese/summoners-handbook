// Crawls d20pfsrd's animal listings and writes src/data/animals.json: the
// Paizo animals a druid can wild shape into (Diminutive to Huge, no
// templated, advanced or mythic versions — polymorph doesn't allow those).
import * as cheerio from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { fetchPage, normalizeUrl } from './fetch.mjs';
import { parsePage } from './statblock.mjs';

const ROOT = 'https://www.d20pfsrd.com/bestiary/monster-listings/animals/';
// Swarms and troops are collections of creatures, not forms you can take.
const COLLECTIVE = new Set(['swarm', 'troop']);
const SIZES = new Set(['Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge']);
// d20pfsrd marks third-party pages in their URL or title.
const THIRD_PARTY = /3pp|-tohc\b|-fgg\b|-kp\b|-rgg\b|-lpj\b|-ff\b|-jbe\b|\(3pp\)|tome of horrors/i;
// Not valid wild shape forms: templated, advanced, young, mythic or summoned variants.
const VARIANT = /\b(advanced|young|mythic|celestial|fiendish|summoned|elite|giant\s+\(advanced\)|companion|animal lord|awakened|feral|primal|dire\s+\(advanced\))\b/i;

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Section 15 notices on a page; pages with notices but none by Paizo are third-party. */
function isThirdPartyPage(html) {
  const $ = cheerio.load(html);
  const notices = $('#article-content .section15 p')
    .map((_, p) => $(p).text())
    .get()
    .filter((t) => /©|copyright/i.test(t));
  return notices.length > 0 && !notices.some((t) => /paizo/i.test(t));
}

const queue = [ROOT];
const seen = new Set(queue);
const animals = {};
const skipped = { thirdParty: 0, variant: [], notAnimal: 0, size: 0 };

while (queue.length) {
  const url = queue.shift();
  let page;
  let html;
  try {
    ({ html } = await fetchPage(url));
    page = parsePage(html, url);
  } catch (e) {
    console.log(`! ${url}: ${e.message}`);
    continue;
  }
  // Follow links that stay inside the animal listings.
  const $ = cheerio.load(html);
  $('#article-content a[href]').each((_, a) => {
    const href = $(a).attr('href');
    if (!href || !href.includes('/bestiary/monster-listings/animals/')) return;
    const next = normalizeUrl(href);
    if (seen.has(next) || THIRD_PARTY.test(next)) return;
    seen.add(next);
    queue.push(next);
  });
  if (THIRD_PARTY.test(url) || THIRD_PARTY.test(page.title) || isThirdPartyPage(html)) {
    skipped.thirdParty++;
    continue;
  }
  for (const sb of page.statblocks) {
    if (sb.type !== 'animal') {
      skipped.notAnimal++;
      continue;
    }
    if (sb.subtypes.some((s) => COLLECTIVE.has(s))) {
      skipped.variant.push(sb.name);
      continue;
    }
    if (!SIZES.has(sb.size)) {
      skipped.size++;
      continue;
    }
    if (VARIANT.test(sb.name) || sb.mr || THIRD_PARTY.test(sb.name)) {
      skipped.variant.push(sb.name);
      continue;
    }
    const id = slug(sb.name);
    if (animals[id]) continue;
    animals[id] = { id, url: page.url, pageTitle: page.title, source: page.source, ...sb };
  }
  if (seen.size % 50 === 0) console.log(`… ${seen.size} pages queued, ${Object.keys(animals).length} animals`);
}

// Archives of Nethys (Paizo-licensed) lists every Paizo monster with its source
// book. Keep only animals found there; that also excludes unmarked third-party ones.
const AON = 'https://aonprd.com/';
// Source books without a verified OGL copyright notice (see build-legal.mjs);
// their animals are left out so every included form can be credited.
const UNCREDITED_SOURCES = new Set([
  'Animal Archive',
  'Druma, Profit and Prophecy',
  'Familiar Folio',
  'Magnimar, City of Monuments',
  'Pathfinder #59: The Price of Infamy',
  'Pathfinder #70: The Frozen Stars',
  'Pathfinder #90: The Divinity Drive',
  'Pathfinder #115: Trail of the Hunted',
  'Pathfinder #118: Siege of Stone',
  'Pathfinder #119: Prisoners of the Blight',
  'Pathfinder #121: The Lost Outpost',
  'Qadira, Jewel of the East',
]);
// d20pfsrd and AoN names for the same stat block, checked by hand.
const AON_ALIASES = {
  'common-bat': 'Bat',
  'frog-poisonous': 'Poison Frog',
  'light-riding-horse': 'Horse',
  'common-shark': 'Shark',
};
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[“”"’']/g, '')
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && w !== 'or')
    .sort()
    .join(' ');

/** Normalized name → AoN page name, for every animal in AoN's monster index. */
async function aonAnimalIndex() {
  const { html } = await fetchPage(`${AON}Monsters.aspx?Letter=All`);
  const $ = cheerio.load(html);
  const index = new Map();
  $('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (!/^animal\b/.test($(tds[2]).text().trim())) return;
    const a = $(tds[0]).find('a');
    const item = decodeURIComponent((a.attr('href') ?? '').split('ItemName=')[1] ?? '');
    if (!item) return;
    // "Bear, Grizzly Bear" / "Grizzly Bear" / "Dire Boar (Daeodon)" → all point to the item.
    for (const key of [item, a.text(), item.replace(/\s*\(.*?\)/g, ''), item.match(/\(([^)]+)\)/)?.[1] ?? '']) {
      if (key && !index.has(norm(key))) index.set(norm(key), item);
    }
  });
  return index;
}

function d20Keys(a) {
  const names = [a.name, a.pageTitle];
  for (const n of [a.name, a.pageTitle]) {
    names.push(n.replace(/\s*\(.*?\)\s*/g, ' '));
    const paren = n.match(/\(([^)]+)\)/)?.[1];
    if (paren && !/\bor\b/.test(paren)) names.push(paren);
  }
  return [...new Set(names.map(norm).filter(Boolean))];
}

async function aonSource(item) {
  const url = `${AON}MonsterDisplay.aspx?ItemName=${encodeURIComponent(item)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { html } = await fetchPage(url);
      return cheerio.load(html).text().replace(/\s+/g, ' ').match(/Source (.+?) pg\. \d+/)?.[1]?.trim() ?? null;
    } catch {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  return null;
}

const aonIndex = await aonAnimalIndex();
const unverified = [];
for (const [id, a] of Object.entries(animals)) {
  const item = AON_ALIASES[id] ?? d20Keys(a).map((k) => aonIndex.get(k)).find(Boolean);
  const source = item ? await aonSource(item) : null;
  if (source && UNCREDITED_SOURCES.has(source)) {
    unverified.push(`${a.name} (${source}: no verified copyright notice)`);
    delete animals[id];
  } else if (source) {
    a.source = source;
    a.aonName = item;
  } else {
    unverified.push(item ? `${a.name} (no source on AoN)` : a.name);
    delete animals[id];
  }
}

const sorted = Object.fromEntries(Object.entries(animals).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(new URL('../src/data/animals.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n');
console.log(`\n${seen.size} pages crawled, ${Object.keys(animals).length} animals written.`);
console.log(`Skipped: ${skipped.thirdParty} third-party pages, ${skipped.notAnimal} non-animal and ${skipped.size} wrong-size stat blocks, ${skipped.variant.length} variants:`);
console.log(skipped.variant.join(', '));
console.log(`\nNot found on Archives of Nethys (left out): ${unverified.join(', ') || 'none'}`);
