// Archives of Nethys (aonprd.com, Paizo-licensed) lookups: which Paizo book a
// creature comes from. Used by scrape-forms.mjs and build-legal.mjs.
import * as cheerio from 'cheerio';
import { fetchPage } from './fetch.mjs';

const AON = 'https://aonprd.com/';

export const norm = (s) =>
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

/** Normalized name → AoN page name, for every creature of this type in AoN's monster index. */
export async function aonIndexFor(type) {
  const { html } = await fetchPage(`${AON}Monsters.aspx?Letter=All`);
  const $ = cheerio.load(html);
  const index = new Map();
  $('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (!new RegExp(`^${type}\\b`).test($(tds[2]).text().trim())) return;
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

export function d20Keys(a) {
  const names = [a.name, a.pageTitle];
  for (const n of [a.name, a.pageTitle]) {
    names.push(n.replace(/\s*\(.*?\)\s*/g, ' '));
    const paren = n.match(/\(([^)]+)\)/)?.[1];
    if (paren && !/\bor\b/.test(paren)) names.push(paren);
  }
  return [...new Set(names.map(norm).filter(Boolean))];
}

export async function aonSource(item) {
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

