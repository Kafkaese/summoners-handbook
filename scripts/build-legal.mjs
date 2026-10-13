// Builds src/data/legal.json: the Open Game License 1.0a text and the Section 15
// copyright notices for all Open Game Content the app uses.
//
// Sources:
// - OGL text and Paizo's own compiled Section 15 (Pathfinder Reference Document),
//   mirrored at legacy.aonprd.com/openGameLicense.html
// - the Section 15 block on every d20pfsrd page the app copies content from
// - d20pfsrd's master Section 15 spreadsheet, for Adventure Path volumes cited
//   as sources of alternative summons
import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { aonIndexFor, aonSource, d20Keys } from './aon.mjs';
import { fetchPage } from './fetch.mjs';

const PRD_OGL_URL = 'https://legacy.aonprd.com/openGameLicense.html';
const D20PFSRD_SECTION15_CSV = 'https://docs.google.com/spreadsheets/d/1OhL3YCCMQqRJQ2MposZwk4UTcC465soWqwxQE9XuHv8/export?format=csv';
const OWN_NOTICE = "Summoner's Handbook. © 2026, Kafkaese.";

const data = (f) => readFile(new URL(`../src/data/${f}`, import.meta.url), 'utf8').then(JSON.parse);
const clean = (s) => s.replace(/\s+/g, ' ').trim();
/** Title part of a notice, for de-duplication ("Pathfinder RPG Bestiary" ≈ "Pathfinder Roleplaying Game Bestiary"). */
const titleKey = (s) =>
  s
    .split(/©|\bCopyright\b/)[0]
    .replace(/Pathfinder RPG\b/i, 'Pathfinder Roleplaying Game')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

// --- OGL text and Paizo's Section 15 -------------------------------------
const { html: prdHtml } = await fetchPage(PRD_OGL_URL);
const $prd = cheerio.load(prdHtml);
const prdParas = $prd('p')
  .map((_, p) => clean($prd(p).text()))
  .get()
  .filter(Boolean);
const start = prdParas.findIndex((p) => p.startsWith('The following text is the property of Wizards'));
const s15 = prdParas.findIndex((p) => /^15\. COPYRIGHT NOTICE/i.test(p));
if (start < 0 || s15 < 0) throw new Error('Unexpected OGL page layout');
const ogl = prdParas.slice(start, s15);
// The PRD lists each notice as its own paragraph after the heading.
const prdNotices = prdParas.slice(s15 + 1).filter((p) => /©|Copyright/.test(p) && !/^©\d{4}-\d{4} Paizo/.test(p));

// --- Notices on the d20pfsrd pages the app uses ----------------------------
const creatures = await data('creatures.json');
const animals = await data('animals.json');
const plants = await data('plants.json');
const restricted = await data('restrictedSpells.json');
const lists = await data('summonLists.json');
const pages = new Set([
  ...Object.values(creatures).map((c) => c.url),
  ...Object.values(animals).map((c) => c.url),
  ...Object.values(plants).map((c) => c.url),
  ...Object.values(restricted).map((s) => s.url).filter(Boolean),
  ...Object.keys(lists.spells).map((s) => `https://www.d20pfsrd.com/magic/all-spells/s/${s}/`),
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/celestial-creature-cr-special/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/fiendish/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/resolute-cr-0-or-1/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/simple-template-entropic-cr-0-or-1-1/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/counterpoised-creature-cr-0-or-1/',
  'https://www.d20pfsrd.com/feats/general-feats/summon-good-monster/',
  'https://www.d20pfsrd.com/feats/general-feats/summon-evil-monster/',
  'https://www.d20pfsrd.com/feats/general-feats/summon-neutral-monster/',
]);
const pageNotices = [];
for (const url of pages) {
  const { html } = await fetchPage(url);
  const $ = cheerio.load(html);
  $('#article-content .section15 p').each((_, p) => {
    const t = clean($(p).text());
    if (/©|Copyright/.test(t) && !/^Section 15\b/i.test(t)) pageNotices.push(t);
  });
}

// --- Adventure Path volumes cited by the summon tables ---------------------
const apNumbers = new Set();
for (const levels of Object.values(lists.spells)) {
  for (const level of Object.values(levels)) {
    for (const e of [...level.standard, ...level.alternatives]) for (const m of (e.source ?? '').matchAll(/AP(\d+)/g)) apNumbers.add(Number(m[1]));
  }
}
const csv = await (await fetch(D20PFSRD_SECTION15_CSV)).text();
const csvNotices = [...csv.matchAll(/^\d*,(?:"((?:[^"]|"")*)"|([^\n]*))$/gm)].map((m) => clean((m[1] ?? m[2] ?? '').replace(/""/g, '"')));
const apNotices = [];
const missing = [];
for (const n of [...apNumbers].sort((a, b) => a - b)) {
  const hit = csvNotices.find((t) => new RegExp(`^Pathfinder (Adventure Path )?#?${n}\\b`).test(t));
  if (hit) apNotices.push(hit);
  else missing.push(`Pathfinder Adventure Path #${n}`);
}

// --- Source books of the wild shape forms (from Archives of Nethys) ---------
const titleOf = (notice) => notice.split(/©|\bCopyright\b/)[0];
const words = (s) => s.toLowerCase().replace(/pathfinder (rpg|roleplaying game)/g, ' ').replace(/[^a-z0-9#]+/g, ' ').trim();
/** Finds the notice for a source title like "Bestiary 3", "Pathfinder #57: Tempest Rising" or "Animal Archive". */
function noticeFor(source) {
  const ap = source.match(/^Pathfinder #(\d+)/);
  if (ap) return csvNotices.find((t) => new RegExp(`^Pathfinder (Adventure Path )?#?${ap[1]}\\b`).test(t));
  if (/^Pathfinder RPG Bestiary$/.test(source)) return prdNotices.find((t) => /^Pathfinder Roleplaying Game Bestiary\./.test(t));
  const want = words(source);
  const exact = [...prdNotices, ...csvNotices].find((t) => words(titleOf(t)).replace(/^(campaign setting|player companion|module|chronicles)\s+/, '') === want);
  return exact ?? [...prdNotices, ...csvNotices].find((t) => words(titleOf(t)).endsWith(` ${want}`));
}
// Notices not in the lists above: from d20pfsrd's content-source pages, or
// spelled differently in d20pfsrd's master list.
const BOOK_NOTICES = {
  'Bestiary 6': 'https://www.d20pfsrd.com/srd-content-source/pathfinder-roleplaying-game-bestiary-6/',
  'Osirion, Legacy of the Pharaohs': (t) => t.startsWith('Pathfinder Campaign Setting: Osirion, Legacy of Pharaohs'),
  'Pathfinder #31: Stolen Land': (t) => t.startsWith('Pathfinder Adventure Path volume #31: Stolen Land'),
};
async function knownNotice(source) {
  const how = BOOK_NOTICES[source];
  if (typeof how === 'function') return csvNotices.find(how);
  if (typeof how === 'string') {
    const { html } = await fetchPage(how);
    // "Content Source: <title> <notice>. 3 Records Found …"
    const text = clean(cheerio.load(html)('article').text());
    return text.match(/Content Source: .*? (Pathfinder [^©]*©\s*\d{4}.*?\.)\s+\d+ Records Found/)?.[1];
  }
  return undefined;
}
// Summon Good/Evil/Neutral Monster creatures come from many books; look them up too.
// Names that differ between d20pfsrd and Archives of Nethys, checked by hand.
const AON_NAMES = {
  damned: 'Petitioner',
  hunted: 'Petitioner',
  'young-adult-green-dragon': 'Young Green Dragon',
};
const aonIndex = await aonIndexFor('');
// Creatures on the regular summon lists are already credited; check the feat lists' new ones.
const onSpellLists = new Set(
  Object.values(lists.spells).flatMap((levels) => Object.values(levels).flatMap((l) => [...l.standard, ...l.alternatives].flatMap((e) => e.creatureIds))),
);
const featSources = new Map();
for (const levels of Object.values(lists.featLists ?? {})) {
  for (const level of Object.values(levels)) {
    for (const id of level.standard.flatMap((e) => e.creatureIds)) {
      if (onSpellLists.has(id)) continue;
      const c = creatures[id];
      const item = AON_NAMES[id] ?? (/-mephit$/.test(id) ? 'Mephit' : d20Keys(c).map((k) => aonIndex.get(k)).find(Boolean));
      featSources.set(c.name, item ? await aonSource(item) : null);
    }
  }
}
const unsourced = [...featSources].filter(([, s]) => !s).map(([n]) => n);

const bookNotices = [];
const uncreditedBooks = [];
const formSources = [...Object.values(animals), ...Object.values(plants)].map((a) => a.source);
for (const source of [...new Set([...formSources, ...[...featSources.values()].filter(Boolean)])].sort()) {
  const hit = (await knownNotice(source)) ?? noticeFor(source);
  if (hit) bookNotices.push(hit);
  else uncreditedBooks.push(source);
}

// --- Assemble: WotC and Paizo first, then everything else -----------------
const section15 = [];
const seen = new Set();
for (const notice of [...prdNotices, ...pageNotices, ...apNotices, ...bookNotices, OWN_NOTICE]) {
  const key = titleKey(notice);
  if (seen.has(key)) continue;
  seen.add(key);
  section15.push(notice);
}

await writeFile(
  new URL('../src/data/legal.json', import.meta.url),
  JSON.stringify({ sources: [PRD_OGL_URL, 'd20pfsrd.com Section 15 notices', D20PFSRD_SECTION15_CSV], ogl, section15, missing: [...missing, ...uncreditedBooks] }, null, 2) + '\n',
);
console.log(`OGL: ${ogl.length} paragraphs; Section 15: ${section15.length} notices (${prdNotices.length} PRD, ${pageNotices.length} from pages, ${apNotices.length} AP).`);
if (missing.length) console.log(`No verified notice found for: ${missing.join(', ')}`);
if (uncreditedBooks.length) {
  console.log(`No notice found for source books: ${uncreditedBooks.join(', ')}`);
  for (const [name, s] of featSources) if (uncreditedBooks.includes(s)) console.log(`  feat-list creature from it: ${name} (${s})`);
}
if (unsourced.length) console.log(`Feat-list creatures not found on Archives of Nethys: ${unsourced.join(', ')}`);
console.log(`Form source books matched:\n${bookNotices.map((n) => `  ${titleOf(n).trim()}`).join('\n')}`);
