// Scrapes the Summon Monster and Summon Nature's Ally tables from d20pfsrd
// into src/data/summonLists.json.
import * as cheerio from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { fetchPage, normalizeUrl } from './fetch.mjs';

// Adventure Path volumes whose OGL copyright notice we couldn't verify; their
// alternative summons are left out so every included source can be credited.
const UNCREDITED_SOURCES = /\bAP(23|26|32|59|64)\b/;

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

// Summon swarm has a single "list": the swarms linked from its effect line.
async function scrapeSummonSwarm() {
  const { html } = await fetchPage('https://www.d20pfsrd.com/magic/all-spells/s/summon-swarm/');
  const $ = cheerio.load(html);
  const seen = new Set();
  const standard = [];
  $('article a[href*="/bestiary/"]').each((_, a) => {
    const url = fixCreatureUrl($(a).attr('href'));
    if (!url || seen.has(url)) return;
    seen.add(url);
    const kind = clean($(a).text()).toLowerCase();
    standard.push({ name: `${kind.replace(/s$/, '')} swarm`, url, templated: false, presetTemplates: [], subtypes: [], source: null, footnotes: [] });
  });
  return { 1: { standard, alternatives: [] } };
}

// Spells whose description names creatures per version (lesser/normal/greater
// or I–III). `tiers` lists the page slugs of each version's own creatures.
async function scrapeTiered(spellUrl, tiers, suffix) {
  const { html } = await fetchPage(spellUrl);
  const $ = cheerio.load(html);
  const links = $('article a[href*="/bestiary/"]').map((_, a) => fixCreatureUrl($(a).attr('href'))).get().filter(Boolean);
  const levels = {};
  tiers.forEach((slugs, i) => {
    const standard = slugs.map((slug) => {
      const url = links.find((u) => u.endsWith(`/${slug}/`));
      if (!url) throw new Error(`${spellUrl}: no link for ${slug}`);
      const base = slug.replace(/^giant-/, '');
      const name = `${base.charAt(0).toUpperCase()}${base.slice(1)}${suffix}`;
      return { name, url, templated: false, presetTemplates: [], subtypes: [], source: null, footnotes: [] };
    });
    levels[i + 1] = { standard, alternatives: [] };
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

/** Drops alternative summons whose source can't be credited in Section 15. */
function withoutUncredited(levels) {
  for (const level of Object.values(levels)) level.alternatives = level.alternatives.filter((e) => !UNCREDITED_SOURCES.test(e.source ?? ''));
  return levels;
}

const data = {
  scrapedFrom: 'https://www.d20pfsrd.com',
  spells: {
    'summon-monster': withoutUncredited(await scrapeSummonMonster()),
    'summon-natures-ally': withoutUncredited(await scrapeNaturesAlly()),
    'summon-swarm': await scrapeSummonSwarm(),
    'summon-genie': await scrapeTiered('https://www.d20pfsrd.com/magic/all-spells/s/summon-genie/', [['janni'], ['djinni'], ['shaitan']], ''),
    'summon-giant-ally': await scrapeTiered(
      'https://www.d20pfsrd.com/magic/all-spells/s/summon-giant-ally/',
      [
        ['giant-cave', 'giant-hill', 'giant-marsh', 'giant-river', 'giant-slag', 'giant-stone', 'giant-wood'],
        ['giant-desert', 'giant-fire', 'giant-frost', 'giant-jungle'],
        ['giant-ash', 'giant-cloud'],
      ],
      ' giant',
    ),
  },
};
await writeFile(new URL('../src/data/summonLists.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
for (const [spell, levels] of Object.entries(data.spells)) {
  for (const [l, v] of Object.entries(levels)) console.log(spell, l, v.standard.length, v.alternatives.length);
}
