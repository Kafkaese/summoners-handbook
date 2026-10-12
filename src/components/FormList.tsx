import { useMemo, useState } from 'react';
import type { Creature } from '../rules/types';
import { formAbilities, formMovement, type Size, SIZES, type Tier } from '../rules/wildshape';

interface Props {
  forms: Creature[];
  tier: Tier;
  familiar: Set<string>;
  onToggleFamiliar: (id: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}

const MOVES = ['fly', 'swim', 'climb', 'burrow'] as const;
type Move = (typeof MOVES)[number];

export function FormList({ forms, tier, familiar, onToggleFamiliar, selected, onSelect, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [sizes, setSizes] = useState<Set<Size>>(new Set());
  const [moves, setMoves] = useState<Set<Move>>(new Set());
  const [onlyFamiliar, setOnlyFamiliar] = useState(false);

  const info = useMemo(
    () =>
      new Map(
        forms.map((f) => {
          const m = formMovement(f);
          const abilities = [...formAbilities(f)].filter((a) => tier.abilities.includes(a));
          return [f.id, { moves: MOVES.filter((k) => m[k] > 0 && tier.caps[k] > 0), abilities }];
        }),
      ),
    [forms, tier],
  );

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const q = query.trim().toLowerCase();
  const shown = forms.filter((f) => {
    if (!tier.sizes.includes(f.size as Size)) return false;
    if (sizes.size && !sizes.has(f.size as Size)) return false;
    if (onlyFamiliar && !familiar.has(f.id)) return false;
    if (q && !f.name.toLowerCase().includes(q)) return false;
    const i = info.get(f.id)!;
    return [...moves].every((m) => i.moves.includes(m));
  });

  return (
    <section className="card creatures">
      <header className="pane-header">
        <button className="back" onClick={onBack} aria-label="Back to druid stats">
          ‹
        </button>
        <h2 className="pane-title">Animal forms</h2>
      </header>

      <div className="filters">
        <div className="chips" aria-label="Size">
          {SIZES.filter((s) => tier.sizes.includes(s)).map((s) => (
            <button key={s} className={`chip small ${sizes.has(s) ? 'is-active' : ''}`} aria-pressed={sizes.has(s)} onClick={() => setSizes(toggle(sizes, s))}>
              {s}
            </button>
          ))}
        </div>
        <div className="chips" aria-label="Movement">
          {MOVES.filter((m) => tier.caps[m] > 0).map((m) => (
            <button key={m} className={`chip small ${moves.has(m) ? 'is-active' : ''}`} aria-pressed={moves.has(m)} onClick={() => setMoves(toggle(moves, m))}>
              {m}
            </button>
          ))}
          <button className={`chip small ${onlyFamiliar ? 'is-active' : ''}`} aria-pressed={onlyFamiliar} onClick={() => setOnlyFamiliar(!onlyFamiliar)}>
            ★ familiar
          </button>
        </div>
      </div>
      <input className="search" type="search" placeholder="Filter animals…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <p className="group-label">
        {shown.length} form{shown.length === 1 ? '' : 's'}
        {onlyFamiliar && !familiar.size && ' · star the animals your druid is familiar with'}
      </p>

      {SIZES.filter((s) => shown.some((f) => f.size === s)).map((size) => (
        <div key={size}>
          <h3 className="group-title">{size}</h3>
          <ul className="creature-items">
            {shown
              .filter((f) => f.size === size)
              .map((f) => {
                const i = info.get(f.id)!;
                const isFamiliar = familiar.has(f.id);
                return (
                  <li key={f.id} className="form-row">
                    <button className={`creature-item ${selected === f.id ? 'is-active' : ''}`} onClick={() => onSelect(f.id)}>
                      <span className="creature-name">{f.name}</span>
                      <span className="creature-meta">
                        {i.moves.map((m) => (
                          <span key={m} className="badge">
                            {m}
                          </span>
                        ))}
                        {i.abilities.map((a) => (
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
      {!shown.length && <p className="empty">No animals match.</p>}
    </section>
  );
}
