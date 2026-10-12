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
 * Templates a caster may apply to a "*" creature: celestial if good, entropic
 * if chaotic, fiendish if evil, resolute if lawful; any if neutral.
 */
export function allowedTemplates(a: Alignment): TemplateId[] {
  if (a === 'N') return ['celestial', 'entropic', 'fiendish', 'resolute'];
  return components(a).map((c) => TEMPLATE_FOR[c]);
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
export const hasAlignmentSubtype = (subtypes: string[]) => subtypes.some((s) => ALIGNMENT_SUBTYPES.includes(s));
