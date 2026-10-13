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
  // Old paths used by the Summon Good/Evil Monster tables.
  'https://www.d20pfsrd.com/bestiary/monster-listings/animals/dolphin/orca/': 'https://www.d20pfsrd.com/bestiary/monster-listings/animals/cetacean/dolphin/orca/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/animals/octopus/giant-octopus/': 'https://www.d20pfsrd.com/bestiary/monster-listings/animals/octopus/octopus-giant/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/animals/stingray/': 'https://www.d20pfsrd.com/bestiary/monster-listings/animals/ray-stingray/',
  'https://www.d20pfsrd.com/bestiary/monster-listings/animals/eel/giant-moray-eel/': 'https://www.d20pfsrd.com/bestiary/monster-listings/animals/eel/eel-moray-giant/',
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
  let url = normalizeUrl(href.replace('/monster-listin/', '/monster-listings/').replace('/monster-list/', '/monster-listings/').replace(/([^:])\/\/+/g, '$1/'));
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

// Summon Good/Evil/Neutral Monster: extra summon monster lists from feats.
const FEAT_LISTS = {
  good: 'https://www.d20pfsrd.com/feats/general-feats/summon-good-monster/',
  evil: 'https://www.d20pfsrd.com/feats/general-feats/summon-evil-monster/',
  neutral: 'https://www.d20pfsrd.com/feats/general-feats/summon-neutral-monster/',
};
const ALIGNMENT_RE = /\b(LG|NG|CG|LN|N|CN|LE|NE|CE)\b/;
// Feat-list creatures whose source book has no verified OGL copyright notice.
const UNCREDITED_FEAT_ENTRIES = new Set(['Larvae petitioner']); // Pathfinder #76: The Midnight Isles

/** One feat's list. Tables per level ("Table: Summon Monster III") or level headers ("3rd Level"). */
async function scrapeFeatList(url) {
  const { html } = await fetchPage(url);
  const $ = cheerio.load(html);
  const levels = {};
  let level = null;
  const add = (tr) => {
    const tds = $(tr).find('td').get();
    if (!tds.length || level === null) return;
    const cell = $(tds[0]);
    const links = cell.find('a').map((_, a) => ({ text: clean($(a).text()), href: $(a).attr('href') ?? '' })).get();
    const isTemplate = (l) => /\/templates\//.test(l.href);
    // The creature link: not a template, not a rules or group page (e.g. "gremlins", "divs").
    const creature = links.find((l) => !isTemplate(l) && /\/bestiary\//.test(l.href) && !/rules-for-monsters/.test(l.href) && l.text);
    const raw = clean(cell.text());
    const alignment = tds[1] ? clean($(tds[1]).text()) : raw.match(new RegExp(`\\(([^)]*?\\b${ALIGNMENT_RE.source}\\b[^)]*)\\)`))?.[2] ?? null;
    const name = clean(raw.replace(/\s*\((?:[^()]*\b(?:LG|NG|CG|LN|N|CN|LE|NE|CE)\b[^()]*)\)\s*$/, '').replace(/\*/g, ''));
    const subtypeText = tds[2] ? clean($(tds[2]).text()) : '';
    // "Viduus (psychopomp)": the parenthetical repeats the subtype.
    const bare = name.replace(/\s*\(([a-z]+)\)$/, (m, sub) => (subtypeText.toLowerCase().includes(sub) ? '' : m));
    levels[level].standard.push({
      name: bare.charAt(0).toUpperCase() + bare.slice(1),
      url: creature ? fixCreatureUrl(creature.href) : null,
      templated: false,
      presetTemplates: links.filter(isTemplate).map((l) => l.text.toLowerCase()),
      subtypes: subtypeText === '—' ? [] : subtypeText.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      alignment: alignment && ALIGNMENT_RE.test(alignment) ? alignment.match(ALIGNMENT_RE)[1] : null,
      source: null,
      footnotes: [],
    });
  };
  // The neutral list wraps its level tables in an outer table; only read the innermost ones.
  $('article table').filter((_, t) => !$(t).find('table').length).each((_, table) => {
    const caption = clean($(table).find('caption').text()).match(/Summon Monster ([IVX]+)/);
    if (caption) level = ROMAN[caption[1]];
    $(table)
      .children()
      .each((_, el) => {
        if (el.tagName === 'thead') {
          const h = clean($(el).find('th').first().text()).match(/^(\d)(st|nd|rd|th) Level/);
          if (h) level = Number(h[1]);
          if (level !== null) levels[level] ??= { standard: [], alternatives: [] };
        } else if (el.tagName === 'tbody') {
          if (level !== null) levels[level] ??= { standard: [], alternatives: [] };
          $(el).find('tr').each((_, tr) => add(tr));
        }
      });
  });
  for (const level of Object.values(levels)) level.standard = level.standard.filter((e) => !UNCREDITED_FEAT_ENTRIES.has(e.name));
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
  featLists: Object.fromEntries(await Promise.all(Object.entries(FEAT_LISTS).map(async ([k, url]) => [k, await scrapeFeatList(url)]))),
};
await writeFile(new URL('../src/data/summonLists.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
for (const [spell, levels] of Object.entries(data.spells)) {
  for (const [l, v] of Object.entries(levels)) console.log(spell, l, v.standard.length, v.alternatives.length);
}
