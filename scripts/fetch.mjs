// Cached, rate-limited fetch for d20pfsrd pages.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.join(import.meta.dirname, '.cache');
let lastRequest = 0;

export function normalizeUrl(url) {
  const u = new URL(url, 'https://www.d20pfsrd.com/');
  u.hash = '';
  u.protocol = 'https:';
  u.hostname = 'www.d20pfsrd.com';
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.toString();
}

export async function fetchPage(url) {
  url = normalizeUrl(url);
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, createHash('sha1').update(url).digest('hex') + '.html');
  try {
    return { url, html: await readFile(file, 'utf8') };
  } catch {}
  const wait = 1000 - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (pf1e-summoner local scraper)' } });
  const html = await res.text();
  if (!res.ok || html.includes('<title>Page not found')) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  await writeFile(file, html);
  return { url: normalizeUrl(res.url), html };
}
