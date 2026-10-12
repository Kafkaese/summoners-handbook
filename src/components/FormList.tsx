import { useMemo, useState } from 'react';
import type { Creature } from '../rules/types';
import { formAbilities, formMovement, rulesFor, type ShapeRules, type Size, SIZES } from '../rules/wildshape';

interface Props {
  forms: Creature[];
  level: number;
  familiar: Set<string>;
  onToggleFamiliar: (id: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}

const MOVES = ['fly', 'swim', 'climb', 'burrow'] as const;
type Move = (typeof MOVES)[number];
type Kind = ShapeRules['kind'];

const KIND_LABELS: Record<Kind, string> = { animal: 'Animals', elemental: 'Elementals', plant: 'Plants' };

export function FormList({ forms, level, familiar, onToggleFamiliar, selected, onSelect, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('animal');
  const [sizes, setSizes] = useState<Set<Size>>(new Set());
  const [moves, setMoves] = useState<Set<Move>>(new Set());
  const [onlyFamiliar, setOnlyFamiliar] = useState(false);

  // Each available form with the rules it's taken with at this level.
  const available = useMemo(
    () =>
      forms.flatMap((f) => {
        const rules = rulesFor(f, level);
        if (!rules) return [];
        const m = formMovement(f);
        const abilities = [...formAbilities(f)].filter((a) => rules.abilities.includes(a));
        return [{ form: f, rules, moves: MOVES.filter((k) => m[k] > 0 && rules.caps[k] > 0), abilities }];
      }),
    [forms, level],
  );
  const kinds = (['animal', 'elemental', 'plant'] as Kind[]).filter((k) => available.some((a) => a.rules.kind === k));
  const activeKind = kinds.includes(kind) ? kind : kinds[0];
  const ofKind = available.filter((a) => a.rules.kind === activeKind);
  const kindSizes = SIZES.filter((s) => ofKind.some((a) => a.form.size === s));
  const kindMoves = MOVES.filter((m) => ofKind.some((a) => a.moves.includes(m)));

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const q = query.trim().toLowerCase();
  const shown = ofKind.filter(({ form, moves: m }) => {
    if (sizes.size && !sizes.has(form.size as Size)) return false;
    if (onlyFamiliar && !familiar.has(form.id)) return false;
    if (q && !form.name.toLowerCase().includes(q)) return false;
    return [...moves].every((x) => m.includes(x));
  });

  return (
    <section className="card creatures">
      <header className="pane-header">
        <button className="back" onClick={onBack} aria-label="Back to druid stats">
          ‹
        </button>
        <h2 className="pane-title">Forms</h2>
      </header>

      {kinds.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Form type">
          {kinds.map((k) => (
            <button key={k} role="tab" aria-selected={k === activeKind} className={k === activeKind ? 'is-active' : ''} onClick={() => setKind(k)}>
              <strong>{KIND_LABELS[k]}</strong>
              <span>{available.find((a) => a.rules.kind === k)?.rules.spell.replace(/ (I|II|III|IV)$/, '')}</span>
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        {kindSizes.length > 1 && (
          <div className="chips" aria-label="Size">
            {kindSizes.map((s) => (
              <button key={s} className={`chip small ${sizes.has(s) ? 'is-active' : ''}`} aria-pressed={sizes.has(s)} onClick={() => setSizes(toggle(sizes, s))}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="chips" aria-label="Movement">
          {kindMoves.map((m) => (
            <button key={m} className={`chip small ${moves.has(m) ? 'is-active' : ''}`} aria-pressed={moves.has(m)} onClick={() => setMoves(toggle(moves, m))}>
              {m}
            </button>
          ))}
          <button className={`chip small ${onlyFamiliar ? 'is-active' : ''}`} aria-pressed={onlyFamiliar} onClick={() => setOnlyFamiliar(!onlyFamiliar)}>
            ★ familiar
          </button>
        </div>
      </div>
      <input className="search" type="search" placeholder={`Filter ${KIND_LABELS[activeKind].toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
      <p className="group-label">
        {shown.length} form{shown.length === 1 ? '' : 's'}
        {onlyFamiliar && !familiar.size && ' · star the forms your druid is familiar with'}
      </p>

      {SIZES.filter((s) => shown.some((a) => a.form.size === s)).map((size) => (
        <div key={size}>
          <h3 className="group-title">{size}</h3>
          <ul className="creature-items">
            {shown
              .filter((a) => a.form.size === size)
              .map(({ form: f, moves: m, abilities }) => {
                const isFamiliar = familiar.has(f.id);
                return (
                  <li key={f.id} className="form-row">
                    <button className={`creature-item ${selected === f.id ? 'is-active' : ''}`} onClick={() => onSelect(f.id)}>
                      <span className="creature-name">{f.name}</span>
                      <span className="creature-meta">
                        {m.map((x) => (
                          <span key={x} className="badge">
                            {x}
                          </span>
                        ))}
                        {abilities.map((a) => (
                          <span key={a} className="badge template">
                            {a}
                          </span>
                        ))}
                      </span>
                    </button>
                    <button
                      className={`star ${isFamiliar ? 'is-active' : ''}`}
                      aria-pressed={isFamiliar}
                      aria-label={isFamiliar ? `Unmark ${f.name} as familiar` : `Mark ${f.name} as familiar`}
                      title={isFamiliar ? 'Familiar form' : 'Mark as familiar'}
                      onClick={() => onToggleFamiliar(f.id)}
                    >
                      {isFamiliar ? '★' : '☆'}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      {!shown.length && <p className="empty">No forms match.</p>}
    </section>
  );
}
