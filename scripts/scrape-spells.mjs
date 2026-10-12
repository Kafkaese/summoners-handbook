// Looks up every spell used by the scraped creatures on d20pfsrd and writes
// src/data/restrictedSpells.json: the spells a summoned creature can't use
// (summoning/calling, teleportation, planar travel, costly material components).
import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { spellKey, spellPage, splitSpellLine } from '../src/rules/spellNames.ts';
import { fetchPage } from './fetch.mjs';

const CREATURES_FILE = new URL('../src/data/creatures.json', import.meta.url);
const OUT_FILE = new URL('../src/data/restrictedSpells.json', import.meta.url);

// Travel to another plane without being teleportation spells.
const PLANAR_TRAVEL = new Set(['plane shift', 'etherealness', 'ethereal jaunt', 'astral projection', 'shadow walk', 'gate', 'interplanetary teleport', 'planar travel']);
// Summoning-subschool spells that bring objects, not creatures.
const OBJECT_SUMMONS = new Set(['instant summons', 'summon instrument', 'obscuring mist', 'black tentacles']);

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[’‘]/g, "'");

/** Spell name → page URL, from the A–Z index pages. */
async function spellIndex() {
  const index = new Map();
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    const { html } = await fetchPage(`https://www.d20pfsrd.com/magic/all-spells/${letter}/`);
    const $ = cheerio.load(html);
    $(`a[href*="/magic/all-spells/${letter}/"]`).each((_, a) => {
      const name = norm($(a).text());
      if (name && !index.has(name)) index.set(name, $(a).attr('href'));
    });
  }
  return index;
}

/** School and components for a spell, or for its greater/lesser/mass section of the page. */
function readSpell(html, base, variant) {
  const $ = cheerio.load(html);
  const text = clean($('#article-content').text() || $('article').text());
  let from = 0;
  if (variant) {
    // The variant's heading ("Restoration, Lesser") directly precedes its School line.
    // The last match skips the table of contents at the top of the page.
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const heading = new RegExp(`(${esc},? ${variant}|${variant} ${esc})\\s+School `, 'gi');
    const found = [...text.matchAll(heading)].pop();
    if (found) from = found.index;
  }
  const school = text.slice(from).match(/School ([^;]*?)(?:;|\s+Level\b)/)?.[1] ?? '';
  const section = text.slice(from, from + 1500);
  const ownComponents = section.match(/Components (.*?)(?= EFFECT| Range | Effect | Target | Area | Duration |$)/)?.[1];
  const baseComponents = text.match(/Components (.*?)(?= EFFECT| Range | Effect | Target | Area | Duration |$)/)?.[1];
  return { school: clean(school), components: clean(ownComponents ?? baseComponents ?? '') };
}

function reasonsFor(key, { school, components }) {
  const reasons = [];
  if ((/\((summoning|calling)\)/i.test(school) || /^summon\b/.test(key)) && !OBJECT_SUMMONS.has(key)) reasons.push('summons or calls a creature');
  if (/\(teleportation\)/i.test(school)) reasons.push('teleportation');
  if (PLANAR_TRAVEL.has(key)) reasons.push('planar travel');
  // "M (diamond worth 25,000 gp)", "M/DF (incense worth 25 gp)"
  const material = components.match(/\bM(?:\/DF)?\s*\(([^)]*)\)/)?.[1] ?? '';
  const cost = material.match(/([\d,]+)\s*gp/);
  if (cost) reasons.push(`costly material component (${cost[1]} gp)`);
  return reasons;
}

const creatures = JSON.parse(await readFile(CREATURES_FILE, 'utf8'));
const keys = new Set();
for (const c of Object.values(creatures)) {
  for (const f of Object.values(c.sections).flat()) {
    for (const line of f.lines ?? []) for (const item of splitSpellLine(line).items) keys.add(spellKey(item));
  }
}

const index = await spellIndex();
const restricted = {
  // The universal monster rule "summon" (e.g. "1/day—summon (level 3, 1 bearded devil 50%)").
  summon: { name: 'summon', url: 'https://www.d20pfsrd.com/bestiary/rules-for-monsters/universal-monster-rules/#Summon_Sp', reasons: ['summons a creature'] },
};
const missing = [];
for (const key of [...keys].sort()) {
  if (key === 'summon') continue;
  const { base, variant } = spellPage(key);
  const url = index.get(key) ?? index.get(base);
  if (!url) {
    // e.g. "summon nature's ally iii" (the page is "Summon Nature's Ally").
    if (/^summon\b/.test(key)) restricted[key] = { name: key, url: null, reasons: ['summons a creature'] };
    else missing.push(key);
    continue;
  }
  const { html } = await fetchPage(url);
  const info = readSpell(html, base, index.has(key) ? null : variant);
  const reasons = reasonsFor(key, info);
  if (reasons.length) restricted[key] = { name: key, url, reasons };
  console.log(`${reasons.length ? 'X' : ' '} ${key.padEnd(32)} ${info.school.padEnd(34)} ${info.components.slice(0, 60)}`);
}

await writeFile(OUT_FILE, JSON.stringify(restricted, null, 2) + '\n');
console.log(`\n${keys.size} spells checked, ${Object.keys(restricted).length} restricted.`);
if (missing.length) console.log(`Not found on d20pfsrd: ${missing.join(', ')}`);
