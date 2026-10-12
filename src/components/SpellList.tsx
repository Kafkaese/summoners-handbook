import { type ClassDef, spellTitle, type SummonOption } from '../rules/classes';

interface Props {
  cls: ClassDef;
  options: SummonOption[];
  selected: string | null;
  onSelect: (key: string) => void;
}

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export function SpellList({ cls, options, selected, onSelect }: Props) {
  const groups = [
    { title: 'Spells', items: options.filter((o) => !o.sla) },
    { title: 'Spell-like ability', items: options.filter((o) => o.sla) },
  ].filter((g) => g.items.length);
  const available = options.filter((o) => o.available);

  return (
    <section className="card spells">
      <h2 className="pane-title">Cast</h2>
      {!available.length && <p className="empty">No summoning spells at this level yet.</p>}
      {groups.map((g) => {
        const shown = g.items.filter((o) => o.available);
        const next = g.items.find((o) => !o.available);
        return (
          <div key={g.title} className="spell-group">
            {groups.length > 1 && <h3 className="group-title">{g.title}</h3>}
            <ul className="spell-items">
              {shown.map((o) => (
                <li key={o.key}>
                  <button className={`spell-item ${selected === o.key ? 'is-active' : ''}`} onClick={() => onSelect(o.key)}>
                    <span className="spell-name">{spellTitle(o.spell, o.level)}</span>
                    <span className="spell-meta">
                      {o.sla ? `SLA · ${o.duration}` : `${ordinal(o.classSpellLevel!)}-level ${cls.name.toLowerCase()} spell · ${o.duration}`}
                    </span>
                  </button>
                </li>
              ))}
              {next && (
                <li className="spell-next">
                  {spellTitle(next.spell, next.level)}
                  {next.sla ? ' (SLA)' : ''} at level {next.requiredLevel}
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
