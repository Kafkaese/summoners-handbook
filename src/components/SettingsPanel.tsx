import { useState } from 'react';
import { ALIGNMENT_NAMES, ALIGNMENTS, TEMPLATE_RULES, type TemplateRule } from '../rules/alignment';
import { CLASSES, classById } from '../rules/classes';
import type { Settings } from '../rules/summon';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const cls = classById(settings.classId);

  return (
    <section className={`card settings ${open ? 'is-open' : ''}`}>
      <button className="settings-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="eyebrow">Character</span>
          <strong>
            {cls.name} {settings.level} · {settings.alignment}
          </strong>
        </span>
        <span className="chevron" aria-hidden>
          ▾
        </span>
      </button>
      <div className="settings-body">
        <div className="row">
          <label className="field grow">
            <span>Class</span>
            <select value={settings.classId} onChange={(e) => set('classId', e.target.value)}>
              {CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field level">
            <span>Level</span>
            <div className="stepper">
              <button onClick={() => set('level', Math.max(1, settings.level - 1))} aria-label="Lower level">
                −
              </button>
              <input
                type="number"
                min={1}
                max={20}
                inputMode="numeric"
                value={settings.level}
                onChange={(e) => set('level', Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              />
              <button onClick={() => set('level', Math.min(20, settings.level + 1))} aria-label="Raise level">
                +
              </button>
            </div>
          </label>
        </div>

        <div className="field">
          <span>Alignment</span>
          <div className="alignment-grid" role="radiogroup" aria-label="Alignment">
            {ALIGNMENTS.map((a) => (
              <button
                key={a}
                role="radio"
                aria-checked={settings.alignment === a}
                className={settings.alignment === a ? 'is-active' : ''}
                title={ALIGNMENT_NAMES[a]}
                onClick={() => set('alignment', a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Summon monster templates</span>
          <select value={settings.templateRule} onChange={(e) => set('templateRule', e.target.value as TemplateRule)}>
            {TEMPLATE_RULES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <small className="field-hint">{TEMPLATE_RULES.find((r) => r.id === settings.templateRule)?.description}</small>
        </label>

        <fieldset className="toggles">
          <legend>Feats &amp; options</legend>
          <label className="toggle">
            <input type="checkbox" checked={settings.augmentSummoning} onChange={(e) => set('augmentSummoning', e.target.checked)} />
            <span>
              Augment Summoning <small>+4 Str and Con</small>
            </span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.superiorSummoning} onChange={(e) => set('superiorSummoning', e.target.checked)} />
            <span>
              Superior Summoning <small>+1 creature when summoning several</small>
            </span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.includeAlternatives} onChange={(e) => set('includeAlternatives', e.target.checked)} />
            <span>
              Adventure Path alternatives <small>GM approval needed</small>
            </span>
          </label>
        </fieldset>
      </div>
    </section>
  );
}
