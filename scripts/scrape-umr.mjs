// Scrapes the universal monster rules that wild shape can grant into
// src/data/umr.json, so stat blocks can explain grab, pounce, trip and so on.
import * as cheerio from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { fetchPage } from './fetch.mjs';

const URL_UMR = 'https://www.d20pfsrd.com/bestiary/rules-for-monsters/universal-monster-rules/';
// Heading ids on the page for each ability wild shape can grant.
const ABILITIES = {
  constrict: 'constrict_ex',
  ferocity: 'ferocity_ex',
  grab: 'grab_ex',
  jet: 'jet_ex',
  poison: 'poison_ex_or_su',
  pounce: 'pounce_ex',
  rake: 'rake_ex',
  trample: 'trample_ex',
  trip: 'trip_ex',
  web: 'web_ex',
  // Elemental body (vortex has no universal rule; the water elemental entries describe it).
  burn: 'burn_ex',
  'earth glide': 'earth_glide_ex',
  whirlwind: 'whirlwind_su',
  // Plant shape III.
  regeneration: 'regeneration_ex',
};

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const { html } = await fetchPage(URL_UMR);
const $ = cheerio.load(html);
const rules = {};

for (const [key, id] of Object.entries(ABILITIES)) {
  const heading = $(`#${id}`).closest('h1, h2, h3, h4');
  if (!heading.length) throw new Error(`No heading #${id}`);
  const paragraphs = [];
  for (let el = heading.next(); el.length && !/^h[1-4]$/i.test(el[0].tagName); el = el.next()) {
    // Skip d20pfsrd's editor notes and the "Format: …; Location: …" lines.
    if (el.is('.ed-note-outer') || el.find('.ed-note-outer').length) continue;
    const text = clean(el.text());
    if (!text || /^Format\s*:/.test(text)) continue;
    if (el.is('p, ul, ol, div')) paragraphs.push(text);
  }
  // Footnote asterisks ("*A creature with …") aren't part of the rule.
  rules[key] = { name: clean(heading.text()).replace(/\*$/, ''), text: paragraphs.join('\n').replace(/^\*/, '') };
}

await writeFile(new URL('../src/data/umr.json', import.meta.url), JSON.stringify({ source: URL_UMR, rules }, null, 2) + '\n');
for (const [k, r] of Object.entries(rules)) console.log(`${k}: ${r.name} — ${r.text.slice(0, 140)}…`);
