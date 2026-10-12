import { ALIGNMENT_NAMES } from '../rules/alignment';
import type { Settings, CountGroup, CreatureChoice } from '../rules/summon';
import { buildCreature } from '../rules/summon';
import { TEMPLATES, type TemplateId } from '../rules/templates';
import { StatBlock } from './StatBlock';

interface Props {
  choice: CreatureChoice;
  group: CountGroup;
  template: TemplateId | null;
  onTemplate: (t: TemplateId) => void;
  settings: Settings;
  onBack: () => void;
}

export function SummonDetail({ choice, group, template, onTemplate, settings, onBack }: Props) {
  const creature = buildCreature(choice, template, settings);
  const neutralOneAxis = choice.templateOptions.length === 1 && settings.alignment.includes('N');

  return (
    <section className="card detail">
      <header className="pane-header">
        <button className="back" onClick={onBack} aria-label="Back to creatures">
          ‹
        </button>
        <h2 className="pane-title">{choice.name}</h2>
      </header>

      <div className="summary">
        <p>
          <strong>Summons {group.count === '1' ? '1 creature' : `${group.count} creatures`}</strong>
          {choice.descriptors.length > 0 && <> · spell becomes {choice.descriptors.join(', ')}</>}
        </p>

        {choice.blocked && <p className="warning">{choice.blocked}</p>}

        {choice.templateOptions.length > 0 && (
          <div className="template-picker">
            <span className="eyebrow">Template</span>
            <div className="chips" role="radiogroup" aria-label="Template">
              {choice.templateOptions.map((t) => (
                <button key={t} role="radio" aria-checked={template === t} className={`chip ${template === t ? 'is-active' : ''}`} onClick={() => onTemplate(t)}>
                  {TEMPLATES[t].name}
                </button>
              ))}
            </div>
            {neutralOneAxis && (
              <p className="hint">
                As {ALIGNMENT_NAMES[settings.alignment].toLowerCase()} you get the {TEMPLATES[choice.templateOptions[0]].name.toLowerCase()} template. Some GMs
                also let casters who are neutral on one axis choose entropic or resolute.
              </p>
            )}
          </div>
        )}

        {creature && creature.notes.length > 0 && (
          <ul className="notes">
            {creature.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>

      {creature ? (
        <>
          <StatBlock creature={creature} />
          <p className="source">
            Base stat block:{' '}
            <a href={creature.url} target="_blank" rel="noreferrer">
              {creature.pageTitle} on d20pfsrd.com
            </a>
            {choice.entry.source && choice.alternative && <> · alternative option from {choice.entry.source}</>}
            {creature.changed.size > 0 && <> · highlighted values were changed</>}
          </p>
        </>
      ) : (
        <p className="empty">d20pfsrd has no stat block for this option, so look it up in {choice.entry.source ?? 'the source book'}.</p>
      )}
    </section>
  );
}
