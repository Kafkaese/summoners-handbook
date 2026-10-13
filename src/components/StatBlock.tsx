import type { ReactNode } from 'react';
import { ABILITY_LIST_FIELDS, abilityRestriction, spellRestriction } from '../rules/restrictions';
import { splitItems, splitSpellLine } from '../rules/spellNames';
import type { BuiltCreature, Field, SectionName } from '../rules/types';

/** Fields printed on one line together, in stat block order. */
const LINE_GROUPS: Record<SectionName, string[][]> = {
  intro: [['Init', 'Senses', 'Perception'], ['Aura']],
  defense: [['AC'], ['hp'], ['Fort', 'Ref', 'Will'], ['Defensive Abilities', 'DR', 'Immune', 'Resist', 'SR'], ['Weaknesses']],
  offense: [['Speed'], ['Melee'], ['Ranged'], ['Space', 'Reach'], ['Special Attacks']],
  tactics: [],
  statistics: [['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'], ['Base Atk', 'CMB', 'CMD'], ['Feats'], ['Skills', 'Racial Modifiers'], ['Languages'], ['SQ']],
};
const COMMA_GROUPS = new Set(['Fort', 'Str']);

const SECTION_TITLES: Partial<Record<SectionName, string>> = {
  defense: 'Defense',
  offense: 'Offense',
  tactics: 'Tactics',
  statistics: 'Statistics',
};

function Value({ creature, section, label, children }: { creature: BuiltCreature; section: string; label: string; children: ReactNode }) {
  const key = `${section}.${label}`;
  if (!creature.changed.has(key)) return <>{children}</>;
  const original = creature.changed.get(key);
  return (
    <mark className="changed" title={original ? `Base: ${original}` : 'Added'}>
      {children}
    </mark>
  );
}

/** Renders the parser's superscript markers ("Toughness^B", "dispel magic^D") as <sup>. */
function Text({ children }: { children: string }) {
  const parts = children.split(/\^([A-Za-z0-9]+)/);
  if (parts.length === 1) return <>{children}</>;
  return <>{parts.map((part, i) => (i % 2 ? <sup key={i}>{part}</sup> : part))}</>;
}

/** Comma-separated items with the ones a summoned creature can't use struck through. */
function Items({ items, restriction }: { items: string[]; restriction: (item: string) => string[] | null }) {
  return (
    <>
      {items.map((item, i) => {
        const reasons = restriction(item);
        return (
          <span key={i}>
            {i > 0 && ', '}
            {reasons ? (
              <s className="forbidden" title={`Summoned creatures can't use this: ${reasons.join(', ')}`}>
                <Text>{item}</Text>
              </s>
            ) : (
              <Text>{item}</Text>
            )}
          </span>
        );
      })}
    </>
  );
}

function SpellLine({ line }: { line: string }) {
  const { prefix, items } = splitSpellLine(line);
  return (
    <>
      {prefix}
      <Items items={items} restriction={spellRestriction} />
    </>
  );
}

function FieldText({ creature, section, field }: { creature: BuiltCreature; section: SectionName; field: Field }) {
  const abilities = ABILITY_LIST_FIELDS.has(field.label) && splitItems(field.value).some((item) => abilityRestriction(item));
  return (
    <>
      {field.label && <b>{field.label} </b>}
      <Value creature={creature} section={section} label={field.label}>
        {/* A trailing ";" in the source would double up with the separator. */}
        {abilities ? <Items items={splitItems(field.value)} restriction={abilityRestriction} /> : <Text>{field.value.replace(/[;,]\s*$/, '')}</Text>}
      </Value>
    </>
  );
}

function Section({ creature, section }: { creature: BuiltCreature; section: SectionName }) {
  const fields = creature.sections[section];
  if (!fields.length) return null;
  const used = new Set<Field>();
  const lines: ReactNode[] = [];

  const lineFor = (group: string[]) => {
    const members = group.map((label) => fields.find((f) => f.label === label && !used.has(f))).filter((f): f is Field => !!f);
    if (!members.length) return;
    members.forEach((f) => used.add(f));
    const sep = COMMA_GROUPS.has(group[0]) ? ', ' : '; ';
    lines.push(
      <p key={`g-${group[0]}`}>
        {members.map((f, i) => (
          <span key={f.label}>
            {i > 0 && sep}
            <FieldText creature={creature} section={section} field={f} />
          </span>
        ))}
      </p>,
    );
  };

  // Walk the fields in their original order, grouping known labels.
  for (const f of fields) {
    if (used.has(f)) continue;
    const group = LINE_GROUPS[section].find((g) => g.includes(f.label));
    if (group) {
      lineFor(group);
      continue;
    }
    used.add(f);
    lines.push(
      <div key={`f-${lines.length}`}>
        <p>
          <FieldText creature={creature} section={section} field={f} />
        </p>
        {f.lines && (
          <ul className="sb-lines">
            {f.lines.map((l, i) => (
              <li key={i}>
                <SpellLine line={l} />
              </li>
            ))}
          </ul>
        )}
      </div>,
    );
  }

  return (
    <>
      {SECTION_TITLES[section] && <h4 className="sb-divider">{SECTION_TITLES[section]}</h4>}
      {lines}
    </>
  );
}

export function StatBlock({ creature }: { creature: BuiltCreature }) {
  const crChanged = creature.changed.has('cr');
  const alignmentChanged = creature.changed.has('alignment');
  const typeRest = creature.typeLine && creature.alignment ? creature.typeLine.replace(/^\S+\s+/, '') : creature.typeLine;

  return (
    <article className="statblock">
      <header className="sb-title">
        <h3>{creature.name}</h3>
        {creature.cr && (
          <span className="sb-cr">
            {crChanged ? <mark className="changed" title={`Base: CR ${creature.changed.get('cr')}`}>CR {creature.cr}</mark> : `CR ${creature.cr}`}
          </span>
        )}
      </header>
      {creature.xp && <p className="sb-xp">XP {creature.xp}</p>}
      {creature.typeLine && (
        <p>
          {alignmentChanged ? (
            <mark className="changed" title={`Base: ${creature.changed.get('alignment')}`}>
              {creature.alignment}
            </mark>
          ) : (
            creature.alignment
          )}{' '}
          {typeRest}
        </p>
      )}
      <Section creature={creature} section="intro" />
      <Section creature={creature} section="defense" />
      <Section creature={creature} section="offense" />
      <Section creature={creature} section="tactics" />
      <Section creature={creature} section="statistics" />
      {creature.special.length > 0 && (
        <>
          <h4 className="sb-divider">Special Abilities</h4>
          {creature.special.map((s, i) => {
            const changed = creature.changed.has(`special.${s.name}`);
            const forbidden = abilityRestriction(s.name);
            return (
              <div
                key={i}
                className={`sb-special ${changed ? 'is-changed' : ''} ${forbidden ? 'is-forbidden' : ''}`}
                title={forbidden ? `Summoned creatures can't use this: ${forbidden.join(', ')}` : changed ? 'Changed by a template or feat' : undefined}
              >
                {s.text.split('\n').map((para, j) => (
                  <p key={j}>
                    {j === 0 && s.name && <b>{forbidden ? <s className="forbidden">{s.name}</s> : s.name} </b>}
                    <Text>{para}</Text>
                  </p>
                ))}
              </div>
            );
          })}
        </>
      )}
    </article>
  );
}
