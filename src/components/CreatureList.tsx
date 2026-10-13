import { useMemo, useState } from 'react';
import { listName } from '../rules/classes';
import { crString, crValue } from '../rules/fields';
import type { CountGroup, CreatureChoice } from '../rules/summon';
import type { SpellKey } from '../rules/types';
import { TEMPLATES, templateName } from '../rules/templates';

interface Props {
  spell: SpellKey;
  title: string;
  groups: CountGroup[];
  groupIndex: number;
  onGroup: (i: number) => void;
  choices: CreatureChoice[];
  selected: string | null;
  onSelect: (key: string) => void;
  onBack: () => void;
}

function hitDiceOf(c: CreatureChoice) {
  const hp = c.creature?.sections.defense.find((f) => f.label === 'hp')?.value ?? '';
  const paren = hp.match(/\(([^)]*)\)/)?.[1] ?? '';
  return [...paren.matchAll(/(\d+)d\d+/g)].reduce((n, m) => n + Number(m[1]), 0);
}

/** CR shown in the list, including the +1 an alignment template adds at 5+ HD. */
function displayCr(c: CreatureChoice) {
  const base = c.creature?.cr;
  if (!base) return '—';
  const templated = c.templateOptions.length > 0 || c.presetTemplates.some((t) => t in TEMPLATES);
  return templated && hitDiceOf(c) >= 5 ? crString(crValue(base) + 1) : base;
}

export function CreatureList({ spell, title, groups, groupIndex, onGroup, choices, selected, onSelect, onBack }: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? choices.filter((c) => c.name.toLowerCase().includes(q) || c.creature?.type?.includes(q)) : choices;
  }, [choices, query]);
  const levels = [...new Set(filtered.map((c) => c.listLevel))];

  return (
    <section className="card creatures">
      <header className="pane-header">
        <button className="back" onClick={onBack} aria-label="Back to spells">
          ‹
        </button>
        <h2 className="pane-title">{title}</h2>
      </header>
      {groups.length > 1 && (
        <div className="segmented" role="tablist">
          {groups.map((g, i) => (
            <button key={g.label} role="tab" aria-selected={i === groupIndex} className={i === groupIndex ? 'is-active' : ''} onClick={() => onGroup(i)}>
              <strong>{g.count}</strong>
              <span>{g.listLevels.length > 1 ? `${listName(spell, g.listLevels[g.listLevels.length - 1])}–${listName(spell, g.listLevels[0])}` : listName(spell, g.listLevels[0])}</span>
            </button>
          ))}
        </div>
      )}
      <p className="group-label">{groups[groupIndex]?.label}</p>
      <input className="search" type="search" placeholder="Filter creatures…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {levels.map((level) => (
        <div key={level}>
          {levels.length > 1 && <h3 className="group-title">Level {listName(spell, level)}</h3>}
          <ul className="creature-items">
            {filtered
              .filter((c) => c.listLevel === level)
              .map((c) => (
                <li key={c.key}>
                  <button
                    className={`creature-item ${selected === c.key ? 'is-active' : ''} ${c.blocked ? 'is-blocked' : ''}`}
                    onClick={() => onSelect(c.key)}
                  >
                    <span className="creature-name">
                      {c.name}
                      {c.alternative && <span className="badge alt">{c.entry.source}</span>}
                      {c.featList && <span className={`badge feat feat-${c.featList}`}>{c.featList} list</span>}
                    </span>
                    <span className="creature-meta">
                      <span className="cr">CR {displayCr(c)}</span>
                      {c.templateOptions.length > 0 && (
                        <span className="badge template" title="Summoned with a template">
                          {c.templateOptions.length === 1 ? templateName(c.templateOptions[0]) : 'template'}
                        </span>
                      )}
                      {c.descriptors.map((d) => (
                        <span key={d} className={`badge desc desc-${d}`}>
                          {d}
                        </span>
                      ))}
                      {c.blocked && <span className="badge blocked">can't cast</span>}
                      {!c.creature && <span className="badge">no stat block</span>}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {!filtered.length && <p className="empty">No creatures match.</p>}
    </section>
  );
}
