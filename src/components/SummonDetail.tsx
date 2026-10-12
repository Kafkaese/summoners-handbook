import { TEMPLATE_ALIGNMENT, TEMPLATE_RULES } from '../rules/alignment';
import type { Settings, CountGroup, CreatureChoice } from '../rules/summon';
import { buildCreature } from '../rules/summon';
import { TEMPLATES, type TemplateId } from '../rules/templates';
import { restrictionsOf } from '../rules/restrictions';
import { StatBlock } from './StatBlock';

interface Props {
  choice: CreatureChoice;
  group: CountGroup;
  /** How long the summons last, e.g. "9 rounds". */
  duration: string;
  template: TemplateId | null;
  onTemplate: (t: TemplateId) => void;
  settings: Settings;
  onBack: () => void;
}

export function SummonDetail({ choice, group, duration, template, onTemplate, settings, onBack }: Props) {
  const creature = buildCreature(choice, template, settings);
  const restricted = creature ? restrictionsOf(creature) : [];

  return (
    <section className="card detail">
      <header className="pane-header">
        <button className="back" onClick={onBack} aria-label="Back to creatures">
          ‹
        </button>
        <h2 className="pane-title">{choice.name}</h2>
        <span className="duration" title="Duration of the summoning">
          ⏳ {duration}
        </span>
      </header>

      <div className="summary">
        <p>
          <strong>Summons {choice.spell === 'summon-swarm' ? '1 swarm' : group.count === '1' ? '1 creature' : `${group.count} creatures`}</strong>
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
            {choice.excludedTemplates.map((x) => (
              <p key={x.template} className="hint">
                No {TEMPLATES[x.template].name.toLowerCase()} template: it makes the spell {TEMPLATE_ALIGNMENT[x.template]}, and {x.reason}.
              </p>
            ))}
            <p className="hint">{TEMPLATE_RULES.find((r) => r.id === settings.templateRule)?.description} Change this under Character.</p>
          </div>
        )}

        {restricted.length > 0 && (
          <div className="restricted-note">
            <strong>Can't be used while summoned</strong> (crossed out below):
            <ul>
              {restricted.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong>: {r.reasons.join(', ')}
                </li>
              ))}
            </ul>
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
