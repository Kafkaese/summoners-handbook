// Parses d20pfsrd bestiary pages into a field-based stat block structure.
//
// A stat block is split into sections (intro, defense, offense, tactics,
// statistics) holding ordered fields ({ label, value, lines? }), plus a list
// of special abilities ({ name, text }). Field values are kept as text; the
// app parses the specific fields it needs to modify.
import * as cheerio from 'cheerio';

const B_OPEN = '\u0001';
const B_CLOSE = '\u0002';

const SECTION_NAMES = {
  DEFENSE: 'defense',
  DEFENSES: 'defense',
  OFFENSE: 'offense',
  TACTICS: 'tactics',
  STATISTICS: 'statistics',
  'SPECIAL ABILITIES': 'special',
  ECOLOGY: 'ecology',
};

const clean = (s) =>
  s
    .replace(/ /g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/\s+([,;)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();

/** Text of an element, with <br> turned into '\n' and <b> labels marked. */
function richText($, el) {
  const $el = $(el).clone();
  $el.find('br').replaceWith('\n');
  $el.find('b, strong').each((_, b) => {
    const t = $(b).text();
    if (!t.trim()) return;
    // Line breaks inside a bold label belong before/after the label.
    const before = /^\s*\n/.test(t) ? '\n' : '';
    const after = /\n\s*$/.test(t) ? '\n' : '';
    const parts = t.split('\n').map((s) => s.trim()).filter(Boolean);
    $(b).replaceWith(`${before}${parts.map((p) => `${B_OPEN}${p}${B_CLOSE}`).join('\n')}${after}`);
  });
  $el.find('sup').each((_, s) => {
    $(s).replaceWith(`^${$(s).text()}`);
  });
  return $el.text();
}

const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'section', 'center', 'blockquote']);
const SKIP_TAGS = new Set(['script', 'style', 'img', 'noscript', 'iframe']);
const SKIP_SELECTOR = '#toc_container, .ogn-npa, .page-widget, .breadcrumbs, .ogn-childpages, .shopify-buybutton, .product-listing';

/** Flattens article content into a list of blocks ({ tag, cls, text, level }). */
function linearize($, root) {
  const blocks = [];
  const hasBlockChild = (el) => $(el).children().get().some((c) => BLOCK_TAGS.has(c.tagName?.toLowerCase()));
  const push = (tag, cls, nodes) => {
    const wrapper = $('<p></p>');
    for (const n of nodes) wrapper.append($(n).clone());
    const text = richText($, wrapper);
    if (stripMarks(text)) blocks.push({ tag, cls, text, level: wrapper.find('.level').length > 0 });
  };
  const walk = (el) => {
    let inline = [];
    const flush = () => {
      if (inline.length) push('p', '', inline);
      inline = [];
    };
    $(el)
      .contents()
      .each((_, child) => {
        if (child.type === 'text') return void inline.push(child);
        if (child.type !== 'tag') return;
        const tag = child.tagName.toLowerCase();
        const $c = $(child);
        if (SKIP_TAGS.has(tag) || $c.is(SKIP_SELECTOR)) return;
        if (!BLOCK_TAGS.has(tag)) return void inline.push(child);
        flush();
        if (tag === 'li') return void push('li', '', [child]);
        if (hasBlockChild(child) || ['div', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'ul', 'ol', 'section', 'center', 'blockquote'].includes(tag)) {
          // Containers: keep a <p class="title">-style class for leaf divs.
          if (!hasBlockChild(child)) return void push('p', $c.attr('class') ?? '', [...$c.contents().get()]);
          return void walk(child);
        }
        push(tag, $c.attr('class') ?? '', [...$c.contents().get()]);
      });
    flush();
  };
  walk(root);
  return blocks;
}

/** Splits a line like "<b>Init</b> +6; <b>Senses</b> darkvision" into fields. */
function splitFields(line) {
  const fields = [];
  const re = new RegExp(`${B_OPEN}([^${B_CLOSE}]*)${B_CLOSE}`, 'g');
  let m;
  let last = null;
  let lastEnd = 0;
  let leading = '';
  while ((m = re.exec(line))) {
    const between = line.slice(lastEnd, m.index);
    if (last) last.value += between;
    else leading += between;
    last = { label: clean(m[1]).replace(/:$/, ''), value: '' };
    fields.push(last);
    lastEnd = re.lastIndex;
  }
  const rest = line.slice(lastEnd);
  if (last) last.value += rest;
  else leading += rest;
  for (const f of fields) f.value = clean(f.value).replace(/^[:—–-]\s*(?=\S)/, (s) => (s.startsWith(':') ? '' : s)).replace(/[;,]$/, '').trim();
  return { leading: clean(leading), fields };
}

const stripMarks = (s) => clean(s.replaceAll(B_OPEN, '').replaceAll(B_CLOSE, ''));

function isTitleBlock(b) {
  const t = stripMarks(b.text);
  if (!/CR\s*([\d/]+|—|–|-)/.test(t) || t.length > 120) return false;
  // Also headings like <h4>Shaitan (CR 7)</h4>.
  return b.level || /\b(title|creature)\b/.test(b.cls) || (/^h[4-6]$/.test(b.tag) && /\(CR\s*[\d/]+\)\s*$/.test(t));
}

function dividerName(b) {
  const t = stripMarks(b.text).toUpperCase();
  if (/\bdivider\b/.test(b.cls) || /^(h[2-6])$/.test(b.tag) || SECTION_NAMES[t]) {
    if (SECTION_NAMES[t]) return SECTION_NAMES[t];
  }
  return null;
}

const SIZES = ['Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];

/** Parses "LE Medium outsider (devil, evil, extraplanar, lawful)". */
function parseTypeLine(line) {
  const sizeRe = new RegExp(`^(.*?)\\b(${SIZES.join('|')})\\s+(.+)$`);
  const m = line.match(sizeRe);
  if (!m) return null;
  const typeMatch = m[3].match(/^([^(]+?)\s*(?:\(([^)]*)\))?\s*$/);
  return {
    alignment: clean(m[1]),
    size: m[2],
    type: clean(typeMatch ? typeMatch[1] : m[3]),
    subtypes: typeMatch?.[2] ? typeMatch[2].split(',').map((s) => clean(s).toLowerCase()).filter(Boolean) : [],
  };
}

function parseStatblock(blocks, start) {
  const titleText = stripMarks(blocks[start].text);
  const tm = titleText.match(/^(.*?)\s*CR\s*([\d/]+|—|–|-)(.*)$/);
  const sb = {
    name: clean(tm ? tm[1] : titleText).replace(/\s*\($/, ''),
    cr: tm ? tm[2] : null,
    mr: tm && /MR\s*(\d+)/.test(tm[3]) ? Number(tm[3].match(/MR\s*(\d+)/)[1]) : null,
    xp: null,
    alignment: null,
    size: null,
    type: null,
    subtypes: [],
    typeLine: null,
    sections: { intro: [], defense: [], offense: [], tactics: [], statistics: [] },
    special: [],
    description: null,
  };
  let section = 'intro';
  let i = start + 1;
  let lastField = null;
  for (; i < blocks.length; i++) {
    const b = blocks[i];
    if (isTitleBlock(b)) break;
    if (/^h[1-3]$/.test(b.tag)) break;
    const div = dividerName(b);
    if (div) {
      if (div === 'ecology') break;
      section = div;
      lastField = null;
      continue;
    }
    const plain = stripMarks(b.text);
    if (!plain) continue;
    if (/\bdescription\b/.test(b.cls) && section === 'intro' && !sb.description) {
      sb.description = plain;
      continue;
    }
    if (section === 'special') {
      if (/^h[4-6]$/.test(b.tag)) {
        sb.special.push({ name: plain.replace(/:$/, ''), text: '' });
        continue;
      }
      const lead = b.text.match(new RegExp(`^\\s*${B_OPEN}([^${B_CLOSE}]+)${B_CLOSE}`));
      if (lead && /\((Ex|Su|Sp|Ex, Su|Su, Sp)\)|^[A-Z][\w' -]+:?$/.test(clean(lead[1])) && b.tag !== 'li') {
        const name = clean(lead[1]).replace(/[:.]$/, '');
        const text = stripMarks(b.text.slice(lead[0].length)).replace(/^[:.]\s*/, '');
        sb.special.push({ name, text });
        continue;
      }
      if (sb.special.length) {
        const last = sb.special[sb.special.length - 1];
        last.text = last.text ? `${last.text}\n${plain}` : plain;
      } else {
        sb.special.push({ name: '', text: plain });
      }
      continue;
    }
    if (b.tag === 'li') {
      if (lastField) (lastField.lines ??= []).push(plain);
      continue;
    }
    for (const rawLine of b.text.split('\n')) {
      if (!stripMarks(rawLine)) continue;
      const { leading, fields } = splitFields(rawLine);
      if (section === 'intro' && leading && !fields.length) {
        const tl = parseTypeLine(leading);
        if (tl && !sb.typeLine) {
          Object.assign(sb, tl);
          sb.typeLine = leading;
          continue;
        }
      }
      if (leading) {
        // Continuation text (e.g. spell lists without <li>, or wrapped values).
        if (lastField) {
          if (lastField.lines || /Spell|Spells|Prepared|Known/i.test(lastField.label)) (lastField.lines ??= []).push(leading);
          else lastField.value = clean(`${lastField.value} ${leading}`);
        } else {
          sb.sections[section].push({ label: '', value: leading });
        }
      }
      for (const f of fields) {
        if (section === 'intro' && /^XP\b/.test(f.label)) {
          sb.xp = clean(f.label.replace(/^XP/, '') + ' ' + f.value);
          continue;
        }
        sb.sections[section].push(f);
        lastField = f;
      }
    }
  }
  return { statblock: sb, end: i };
}

const KNOWN_LABELS = [
  'Init', 'Senses', 'Perception', 'Aura', 'AC', 'hp', 'Fort', 'Ref', 'Will', 'Defensive Abilities', 'DR', 'Immune', 'Resist', 'SR', 'Weaknesses',
  'Speed', 'Melee', 'Ranged', 'Space', 'Reach', 'Special Attacks', 'Spell-Like Abilities',
  'Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha', 'Base Atk', 'CMB', 'CMD', 'Feats', 'Skills', 'Racial Modifiers', 'Languages', 'SQ',
];
const LABEL_ALIASES = { 'Base Attack': 'Base Atk', BAB: 'Base Atk', HP: 'hp', Defensive: 'Defensive Abilities' };

const CANONICAL_SECTION = {
  Init: 'intro', Senses: 'intro', Perception: 'intro', Aura: 'intro',
  AC: 'defense', hp: 'defense', Fort: 'defense', Ref: 'defense', Will: 'defense', 'Defensive Abilities': 'defense',
  DR: 'defense', Immune: 'defense', Resist: 'defense', SR: 'defense', Weaknesses: 'defense',
  Speed: 'offense', Melee: 'offense', Ranged: 'offense', Space: 'offense', Reach: 'offense', 'Special Attacks': 'offense',
  Str: 'statistics', Dex: 'statistics', Con: 'statistics', Int: 'statistics', Wis: 'statistics', Cha: 'statistics',
  'Base Atk': 'statistics', CMB: 'statistics', CMD: 'statistics', Feats: 'statistics', Skills: 'statistics',
  'Racial Modifiers': 'statistics', Languages: 'statistics', SQ: 'statistics',
};

/** Moves well-known fields to their usual section when a page mislabels its dividers. */
function moveToCanonicalSections(sb) {
  // Animal pages append animal companion stats ("Starting Statistics: Size …"); they aren't the creature's.
  for (const [name, fields] of Object.entries(sb.sections)) {
    const cut = fields.findIndex((f) => /^Starting Statistics$/i.test(f.label));
    if (cut >= 0) sb.sections[name] = fields.slice(0, cut);
  }
  for (const [name, fields] of Object.entries(sb.sections)) {
    sb.sections[name] = fields.filter((f) => {
      const target = CANONICAL_SECTION[f.label] ?? (/^(Spell-Like Abilities|Spells (Known|Prepared)|.*Spell-Like Abilities)/.test(f.label) ? 'offense' : null);
      if (!target || target === name) return true;
      sb.sections[target].push(f);
      return false;
    });
  }
  // Keep the usual order within each section: canonical labels sorted by their position in the list.
  const order = Object.keys(CANONICAL_SECTION);
  for (const fields of Object.values(sb.sections)) {
    const known = fields.filter((f) => order.includes(f.label)).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    let k = 0;
    for (let i = 0; i < fields.length; i++) if (order.includes(fields[i].label)) fields[i] = known[k++];
  }
}

/** Repairs fields split or merged by inconsistent bold markup. */
function normalizeSections(sb) {
  for (const [name, fields] of Object.entries(sb.sections)) {
    const out = [];
    for (let i = 0; i < fields.length; i++) {
      let f = { ...fields[i], label: LABEL_ALIASES[fields[i].label] ?? fields[i].label };
      const next = fields[i + 1];
      // "<b>Base</b> <b>Atk</b> +1"
      if (next && !f.value && KNOWN_LABELS.includes(`${f.label} ${next.label}`)) {
        f = { ...next, label: `${f.label} ${next.label}` };
        i++;
      }
      // "<b>2/day</b>—control weather" lines of a spell-like ability block.
      const prev = out[out.length - 1];
      if (prev && /Spell|Spells|Prepared|Known|Extracts/i.test(prev.label) && /^(Constant|At will|\d+\/(day|week|month|year|hour)|\d+(st|nd|rd|th)( \(\d+\))?|0( \(at will\))?|Domain|Bloodline|Mystery|Patron)/i.test(f.label)) {
        (prev.lines ??= []).push(`${f.label}${f.value.startsWith('—') ? '' : ' '}${f.value}`);
        continue;
      }
      // Unbolded label at the start of a value: "Speed swim 60 ft."
      if (!f.label) {
        const known = KNOWN_LABELS.find((l) => f.value.startsWith(`${l} `));
        if (known) f = { ...f, label: known, value: f.value.slice(known.length + 1).replace(/^[:,]\s*/, '') };
      }
      // "Senses darkvision 60 ft.; Perception +10" with Perception unbolded.
      const perception = f.label === 'Senses' ? f.value.match(/^(.*?);?\s*Perception\s+([+\-–−]\d+.*)$/) : null;
      if (perception) {
        if (perception[1]) out.push({ ...f, value: perception[1] });
        out.push({ label: 'Perception', value: perception[2] });
        continue;
      }
      // "Wis 17, Cha 9" with only Wis bolded.
      const embedded = f.value.match(/^(.*?)[,;]\s*(Str|Dex|Con|Int|Wis|Cha) (\S+)$/);
      if (embedded && ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'].includes(f.label)) {
        out.push({ ...f, value: embedded[1] });
        out.push({ label: embedded[2], value: embedded[3] });
        continue;
      }
      out.push(f);
    }
    sb.sections[name] = out;
  }
  // Type line split over several unlabeled intro lines ("N Medium" / "animal").
  if (!sb.typeLine) {
    const intro = sb.sections.intro;
    for (let i = 0; i < intro.length; i++) {
      if (intro[i].label) continue;
      let text = intro[i].value;
      for (let j = i + 1; j <= intro.length; j++) {
        const tl = parseTypeLine(text);
        if (tl && /[a-z]/.test(tl.type)) {
          Object.assign(sb, tl);
          sb.typeLine = text;
          intro.splice(i, j - i);
          return;
        }
        if (j === intro.length || intro[j].label) break;
        text = `${text} ${intro[j].value}`;
      }
    }
  }
}

export function parsePage(html, url) {
  const $ = cheerio.load(html);
  const root = $('#article-content').length ? $('#article-content') : $('article');
  const title = clean($('h1').first().text());
  const blocks = linearize($, root);
  const statblocks = [];
  for (let i = 0; i < blocks.length; i++) {
    if (isTitleBlock(blocks[i])) {
      const { statblock, end } = parseStatblock(blocks, i);
      normalizeSections(statblock);
      moveToCanonicalSections(statblock);
      if (statblock.sections.defense.length || statblock.sections.statistics.length) statblocks.push(statblock);
      i = end - 1;
    }
  }
  const text = root.text();
  const sourceMatch = text.match(/Source\s*:?\s*((?:PZO|Pathfinder|PRG|PF)[^\n]{0,120})/);
  const childPages = $('.ogn-childpages a')
    .map((_, a) => ({ title: clean($(a).text()), href: $(a).attr('href') }))
    .get();
  return { url, title, statblocks, source: sourceMatch ? clean(sourceMatch[1]) : null, childPages };
}
