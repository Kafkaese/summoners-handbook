import type { TemplateId } from './templates';

export type Alignment = 'LG' | 'NG' | 'CG' | 'LN' | 'N' | 'CN' | 'LE' | 'NE' | 'CE';

export const ALIGNMENTS: Alignment[] = ['LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'];

export const ALIGNMENT_NAMES: Record<Alignment, string> = {
  LG: 'Lawful Good',
  NG: 'Neutral Good',
  CG: 'Chaotic Good',
  LN: 'Lawful Neutral',
  N: 'True Neutral',
  CN: 'Chaotic Neutral',
  LE: 'Lawful Evil',
  NE: 'Neutral Evil',
  CE: 'Chaotic Evil',
};

type Component = 'lawful' | 'chaotic' | 'good' | 'evil';

export function components(a: Alignment): Component[] {
  const out: Component[] = [];
  if (a[0] === 'L') out.push('lawful');
  if (a[0] === 'C') out.push('chaotic');
  if (a.endsWith('G')) out.push('good');
  if (a.endsWith('E')) out.push('evil');
  return out;
}

const OPPOSITE: Record<Component, Component> = { lawful: 'chaotic', chaotic: 'lawful', good: 'evil', evil: 'good' };
const TEMPLATE_FOR: Record<Component, TemplateId> = {
  good: 'celestial',
  evil: 'fiendish',
  lawful: 'resolute',
  chaotic: 'entropic',
};

/**
 * Which templates "*" creatures may take. Paizo never settled whether the
 * Bestiary 2 entropic and resolute templates work with summon monster, so
 * this is a table setting.
 */
export type TemplateRule = 'core' | 'expanded' | 'expanded-lenient';

export const TEMPLATE_RULES: { id: TemplateRule; name: string; description: string }[] = [
  {
    id: 'core',
    name: 'Core: celestial or fiendish',
    description: 'Core Rulebook: celestial if good, fiendish if evil; choose either if neutral on good and evil.',
  },
  {
    id: 'expanded',
    name: 'Expanded: by alignment',
    description: 'd20pfsrd wording: celestial if good, entropic if chaotic, fiendish if evil, resolute if lawful; any if true neutral.',
  },
  {
    id: 'expanded-lenient',
    name: 'Expanded: neutral axes choose',
    description: 'As expanded, but being neutral on an axis lets you choose either template of that axis.',
  },
];

/** Templates a caster may apply to a "*" creature under the given rule. */
export function allowedTemplates(a: Alignment, rule: TemplateRule = 'core'): TemplateId[] {
  const mine = components(a);
  const neutralGoodEvil = !mine.includes('good') && !mine.includes('evil');
  const neutralLawChaos = !mine.includes('lawful') && !mine.includes('chaotic');
  if (rule === 'core') return neutralGoodEvil ? ['celestial', 'fiendish'] : mine.filter((c) => c === 'good' || c === 'evil').map((c) => TEMPLATE_FOR[c]);
  if (rule === 'expanded') {
    if (a === 'N') return ['celestial', 'entropic', 'fiendish', 'resolute'];
    return mine.map((c) => TEMPLATE_FOR[c]);
  }
  const out: TemplateId[] = [];
  if (neutralGoodEvil) out.push('celestial', 'fiendish');
  else out.push(...mine.filter((c) => c === 'good' || c === 'evil').map((c) => TEMPLATE_FOR[c]));
  if (neutralLawChaos) out.push('entropic', 'resolute');
  else out.push(...mine.filter((c) => c === 'lawful' || c === 'chaotic').map((c) => TEMPLATE_FOR[c]));
  return out;
}

const DESCRIPTOR_SUBTYPES = ['lawful', 'chaotic', 'good', 'evil', 'air', 'earth', 'fire', 'water'];

/** Descriptors the summoning spell gains from the creature's subtypes. */
export function spellDescriptors(subtypes: string[]): string[] {
  return DESCRIPTOR_SUBTYPES.filter((d) => subtypes.includes(d));
}

/** Alignment descriptors that oppose the caster's alignment. */
export function opposedDescriptors(a: Alignment, descriptors: string[]): string[] {
  const mine = components(a);
  return descriptors.filter((d) => mine.some((c) => OPPOSITE[c] === d));
}

const ALIGNMENT_SUBTYPES = ['lawful', 'chaotic', 'good', 'evil'];
/** The alignment a template gives the spell under the alignment-template house reading. */
export const TEMPLATE_ALIGNMENT: Record<TemplateId, string> = {
  celestial: 'good',
  fiendish: 'evil',
  resolute: 'lawful',
  entropic: 'chaotic',
  // Counterpoised creatures embody balance; the template adds no alignment.
  counterpoised: '',
};

/** Alignment prerequisites of Summon Good/Evil/Neutral Monster. */
export function qualifiesForFeat(feat: 'good' | 'evil' | 'neutral', a: Alignment): boolean {
  if (feat === 'good') return components(a).includes('good');
  if (feat === 'evil') return components(a).includes('evil');
  return a === 'LN' || a === 'N' || a === 'CN';
}

/** Whether two alignments are within one step of each other (a cleric and their deity). */
export function withinOneStep(a: Alignment, b: Alignment): boolean {
  const axis = (x: Alignment) => [x[0] === 'L' ? 1 : x[0] === 'C' ? -1 : 0, x.endsWith('G') ? 1 : x.endsWith('E') ? -1 : 0];
  const [la, ga] = axis(a);
  const [lb, gb] = axis(b);
  return Math.abs(la - lb) + Math.abs(ga - gb) <= 1;
}

export const hasAlignmentSubtype = (subtypes: string[]) => subtypes.some((s) => ALIGNMENT_SUBTYPES.includes(s));
