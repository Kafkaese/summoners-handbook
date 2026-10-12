// Scrapes the Summon Monster and Summon Nature's Ally tables from d20pfsrd
// into src/data/summonLists.json.
import * as cheerio from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { fetchPage, normalizeUrl } from './fetch.mjs';

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };
const clean = (s) => s.replace(/\s+/g, ' ').trim();

// Points list links at the official bestiary page rather than the
// community-made "summoned creature" variants and fixes known bad links.
const URL_FIXES = {
  'https://www.d20pfsrd.com/extras/community-creations/summoned-creature-leopard-cat-great/':
    'https://www.d20pfsrd.com/bestiary/monster-listings/animals/felines/cat-great/leopard/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/animals/horse/':
    'https://www.d20pfsrd.com/bestiary/monster-listings/animals/horse/horse/',
};
// Old paths used by the Summon Nature's Ally table.
const PATH_FIXES = [
  ['/animals/cat-great/', '/animals/felines/cat-great/'],
  ['/animals/eagle/', '/animals/birds/eagle/'],
  ['/animals/roc/', '/animals/birds/roc/'],
  ['/animals/axe-beak/', '/animals/birds/axe-beak/'],
  ['/animals/vulture/', '/animals/birds/vulture/'],
];
function fixCreatureUrl(href) {
  let url = normalizeUrl(href.replace('/monster-listin/', '/monster-listings/'));
  url = URL_FIXES[url] ?? url;
  for (const [from, to] of PATH_FIXES) url = url.replace(from, to);
  if (url.includes('/races/')) return null;
  url = url.replace(/summoned-creature[^/]*\/$/, '');
  return URL_FIXES[url] ?? url;
}

function parseEntry($, tds, { hasSubtypeCol, hasSourceCol }) {
  const cell = $(tds[0]);
  const links = cell.find('a').map((_, a) => ({ text: clean($(a).text()), href: $(a).attr('href') })).get();
  const raw = clean(cell.text());
  const templated = raw.includes('*');
  const footnotes = [...raw.matchAll(/(?<=[a-z)*\s])(\d)\b/gi)].map((m) => Number(m[1]));
  // Template links (e.g. "Celestial Elk") are prefixes, not the creature itself.
  const creatureLinks = links.filter((l) => !/\/templates\//.test(l.href ?? ''));
  const presetTemplates = links
    .filter((l) => /\/templates\//.test(l.href ?? ''))
    .map((l) => l.text.toLowerCase());
  const name = clean(raw.replace(/\*/g, '').replace(/(?<=\S)\s*\d(\s+\d)*\s*(?=$|\()/g, ' ').replace(/^Young\s+\d\s+/, 'Young '));
  let subtypes = [];
  let source = null;
  if (hasSubtypeCol) {
    const t = clean($(tds[1]).text());
    subtypes = t === '—' ? [] : t.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  if (hasSourceCol) source = clean($(tds[tds.length - 1]).text());
  let finalName = name;
  // "Young¹ frost giant": footnote 1 means the young template applies.
  const young = finalName.match(/^Young\s*1?\s+(.*)$/i);
  if (young) {
    finalName = young[1].charAt(0).toUpperCase() + young[1].slice(1);
    if (!presetTemplates.includes('young')) presetTemplates.push('young');
    if (!footnotes.includes(1)) footnotes.push(1);
  }
  return {
    name: finalName,
    url: creatureLinks[0]?.href ? fixCreatureUrl(creatureLinks[0].href) : null,
    templated,
    presetTemplates,
    subtypes,
    source,
    footnotes,
  };
}

async function scrapeSummonMonster() {
  const { html } = await fetchPage('https://www.d20pfsrd.com/magic/all-spells/s/summon-monster/');
  const $ = cheerio.load(html);
  const levels = {};
  $('article table').each((_, table) => {
    const caption = clean($(table).find('caption').text());
    const m = caption.match(/Summon Monster ([IVX]+)/);
    if (!m) return;
    const level = ROMAN[m[1]];
    const kind = caption.includes('Alternative') ? 'alternatives' : 'standard';
    levels[level] ??= { standard: [], alternatives: [] };
    $(table).find('tbody tr').each((_, tr) => {
      const tds = $(tr).find('td').get();
      if (tds.length < 2) return;
      levels[level][kind].push(parseEntry($, tds, { hasSubtypeCol: true, hasSourceCol: true }));
    });
  });
  return levels;
}

async function scrapeNaturesAlly() {
  const { html } = await fetchPage('https://www.d20pfsrd.com/magic/all-spells/s/summon-natures-ally/');
  const $ = cheerio.load(html);
  const levels = {};
  const table = $('article table').filter((_, t) => clean($(t).find('caption').text()).includes('Nature')).first();
  let level = null;
  let kind = null;
  table.children().each((_, el) => {
    if (el.tagName === 'thead') {
      const h = clean($(el).find('th').first().text());
      level = Number(h.match(/^(\d)/)[1]);
      kind = h.includes('Alternatives') ? 'alternatives' : 'standard';
      levels[level] ??= { standard: [], alternatives: [] };
    } else if (el.tagName === 'tbody') {
      $(el).find('tr').each((_, tr) => {
        const tds = $(tr).find('td').get();
        const e = parseEntry($, tds, { hasSubtypeCol: kind === 'standard', hasSourceCol: kind === 'alternatives' });
        if (kind === 'standard') e.source = null;
        // The SNA table's asterisks mark AP notes, not the celestial/fiendish rule.
        e.templated = false;
        levels[level][kind].push(e);
      });
    }
  });
  return levels;
}

const data = {
  scrapedFrom: 'https://www.d20pfsrd.com',
  spells: {
    'summon-monster': await scrapeSummonMonster(),
    'summon-natures-ally': await scrapeNaturesAlly(),
  },
};
await writeFile(new URL('../src/data/summonLists.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
for (const [spell, levels] of Object.entries(data.spells)) {
  for (const [l, v] of Object.entries(levels)) console.log(spell, l, v.standard.length, v.alternatives.length);
}
