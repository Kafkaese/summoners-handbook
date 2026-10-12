import type { Creature } from '../rules/types';
import { buildWildShape, type DruidProfile, type Size, sizeAdjustment } from '../rules/wildshape';
import { fmtMod } from '../rules/fields';
import { StatBlock } from './StatBlock';

interface Props {
  form: Creature;
  level: number;
  profile: DruidProfile;
  alignment: string;
  onBack: () => void;
}

export function FormDetail({ form, level, profile, alignment, onBack }: Props) {
  const result = buildWildShape(form, level, profile, alignment);
  if (!result) return null;
  const adj = sizeAdjustment(form.size as Size);
  const adjText = [adj.str && `${fmtMod(adj.str)} Str`, adj.dex && `${fmtMod(adj.dex)} Dex`, `+${adj.naturalArmor} natural armor`].filter(Boolean).join(', ');

  return (
    <section className="card detail">
      <header className="pane-header">
        <button className="back" onClick={onBack} aria-label="Back to animal forms">
          ‹
        </button>
        <h2 className="pane-title">{form.name}</h2>
        <span className="duration" title="Duration of wild shape">
          ⏳ {level} hour{level === 1 ? '' : 's'}
        </span>
      </header>

      <div className="summary">
        <p>
          <strong>
            {form.size} animal, as <em>{result.tier.spell}</em>
          </strong>{' '}
          · {adjText}
        </p>
        {result.gained.length > 0 && (
          <p className="hint">
            <strong>Gained:</strong> {result.gained.join(', ')}
          </p>
        )}
        {result.notGained.length > 0 && (
          <p className="hint">
            <strong>Not gained</strong> ({result.tier.spell} doesn't grant it): {result.notGained.join(', ')}
          </p>
        )}
        <div className="restricted-note">
          <strong>While in this form you lose</strong>
          <ul>
            {result.lost.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <p className="hint">
          DCs for gained abilities: {result.dc} (10 + {result.tier.spellLevel} for {result.tier.spell} + Wis modifier). Tables differ on this; check with
          your GM.
        </p>
      </div>

      <StatBlock creature={result.creature} />
      <p className="source">
        Form:{' '}
        <a href={form.url} target="_blank" rel="noreferrer">
          {form.pageTitle} on d20pfsrd.com
        </a>
      </p>
    </section>
  );
}
