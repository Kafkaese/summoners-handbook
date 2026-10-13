import { useEffect, useState } from 'react';
import { ALIGNMENTS, TEMPLATE_RULES } from './rules/alignment';
import { CLASSES } from './rules/classes';
import type { Settings } from './rules/summon';
import { isVersatile } from './rules/versatile';

const KEY = 'pf1e-summoner.settings';

export const DEFAULT_SETTINGS: Settings = {
  classId: 'wizard',
  level: 5,
  alignment: 'NG',
  augmentSummoning: false,
  superiorSummoning: false,
  includeAlternatives: false,
  templateRule: 'core',
  deityAlignment: 'NG',
  summonGoodMonster: false,
  summonEvilMonster: false,
  summonNeutralMonster: false,
  sunlightSummons: false,
  moonlightSummons: false,
  versatileSummonMonster: false,
  versatileTemplates: [],
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    if (!CLASSES.some((c) => c.id === s.classId)) s.classId = DEFAULT_SETTINGS.classId;
    if (!TEMPLATE_RULES.some((r) => r.id === s.templateRule)) s.templateRule = DEFAULT_SETTINGS.templateRule;
    if (!ALIGNMENTS.includes(s.alignment)) s.alignment = DEFAULT_SETTINGS.alignment;
    if (!ALIGNMENTS.includes(s.deityAlignment)) s.deityAlignment = s.alignment;
    s.versatileTemplates = Array.isArray(s.versatileTemplates) ? [...new Set(s.versatileTemplates.filter(isVersatile))] : [];
    s.level = Math.min(20, Math.max(1, Math.round(Number(s.level)) || 1));
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Character settings, remembered in this browser. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable (private mode); settings just won't persist.
    }
  }, [settings]);
  return [settings, setSettings] as const;
}
