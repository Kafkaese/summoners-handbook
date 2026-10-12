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
const restricted = await data('restrictedSpells.json');
const lists = await data('summonLists.json');
const pages = new Set([
  ...Object.values(creatures).map((c) => c.url),
  ...Object.values(restricted).map((s) => s.url).filter(Boolean),
  ...Object.keys(lists.spells).map((s) => `https://www.d20pfsrd.com/magic/all-spells/s/${s}/`),
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/celestial-creature-cr-special/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/fiendish/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/resolute-cr-0-or-1/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/templates/simple-template-entropic-cr-0-or-1-1/',
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

// --- Assemble: WotC and Paizo first, then everything else -----------------
const section15 = [];
const seen = new Set();
for (const notice of [...prdNotices, ...pageNotices, ...apNotices, OWN_NOTICE]) {
  const key = titleKey(notice);
  if (seen.has(key)) continue;
  seen.add(key);
  section15.push(notice);
}

await writeFile(
  new URL('../src/data/legal.json', import.meta.url),
  JSON.stringify({ sources: [PRD_OGL_URL, 'd20pfsrd.com Section 15 notices', D20PFSRD_SECTION15_CSV], ogl, section15, missing }, null, 2) + '\n',
);
console.log(`OGL: ${ogl.length} paragraphs; Section 15: ${section15.length} notices (${prdNotices.length} PRD, ${pageNotices.length} from pages, ${apNotices.length} AP).`);
if (missing.length) console.log(`No verified notice found for: ${missing.join(', ')}`);
