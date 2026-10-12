import { useState } from 'react';
import { abilityMod } from '../rules/fields';
import { type DruidProfile, druidBab, estimateHp, tierFor, usesPerDay } from '../rules/wildshape';

interface Props {
  level: number;
  profile: DruidProfile;
  onChange: (p: DruidProfile) => void;
}

const ABILITIES = [
  ['str', 'Str'],
  ['dex', 'Dex'],
  ['con', 'Con'],
  ['int', 'Int'],
  ['wis', 'Wis'],
  ['cha', 'Cha'],
] as const;

const BONUSES = [
  ['initBonus', 'Init bonus', 'besides Dex, e.g. Improved Initiative'],
  ['resistance', 'Resistance', 'to saves, e.g. a cloak'],
  ['deflection', 'Deflection', 'to AC, e.g. a ring'],
  ['naturalArmorEnhancement', 'Natural armor', 'enhancement, e.g. an amulet'],
  ['dodge', 'Dodge', 'to AC, e.g. the Dodge feat'],
  ['wildArmor', 'Wild armor', 'armor bonus of wild armor'],
] as const;

const TOGGLES = [
  ['naturalSpell', 'Natural Spell', 'cast spells in animal form'],
  ['multiattack', 'Multiattack', 'secondary attacks at –2 instead of –5'],
  ['weaponFinesse', 'Weapon Finesse', 'use Dex for natural attack rolls'],
] as const;

export function DruidPanel({ level, profile, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof DruidProfile>(key: K, value: DruidProfile[K]) => onChange({ ...profile, [key]: value });
  const tier = tierFor(level);
  const uses = usesPerDay(level);
  const num = (v: string) => (v === '' ? 0 : Math.max(-99, Math.min(99, Math.round(Number(v)) || 0)));

  return (
    <section className={`card settings druid ${open ? 'is-open' : ''}`}>
      <button className="settings-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="eyebrow">Druid stats</span>
          <strong>
            Str {profile.str} · Dex {profile.dex} · Con {profile.con} · Wis {profile.wis}
          </strong>
        </span>
        <span className="chevron" aria-hidden>
          ▾
        </span>
      </button>
      <div className="settings-body">
        {tier && (
          <p className="wild-summary">
            <strong>Wild shape</strong> {uses === 'at will' ? 'at will' : `${uses}/day`} · {level} hour{level === 1 ? '' : 's'} · works like{' '}
            <em>{tier.spell}</em>
          </p>
        )}
        <p className="field-hint">
          Enter your normal-form values, items included. Base attack +{druidBab(level)} and base saves come from your druid level.
        </p>

        <div className="ability-grid">
          {ABILITIES.map(([key, label]) => (
            <label key={key} className="field">
              <span>{label}</span>
              <input type="number" inputMode="numeric" min={1} max={60} value={profile[key]} onChange={(e) => set(key, Math.max(1, num(e.target.value)))} />
              <small className="field-hint">{abilityMod(profile[key]) >= 0 ? `+${abilityMod(profile[key])}` : abilityMod(profile[key])}</small>
            </label>
          ))}
        </div>

        <label className="field">
          <span>Max hit points</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder={`${estimateHp(level, profile.con)} (estimated)`}
            value={profile.hp ?? ''}
            onChange={(e) => set('hp', e.target.value === '' ? null : Math.max(1, num(e.target.value)))}
          />
        </label>

        <div className="bonus-grid">
          {BONUSES.map(([key, label, hint]) => (
            <label key={key} className="field">
              <span>{label}</span>
              <input type="number" inputMode="numeric" min={0} max={20} value={profile[key]} onChange={(e) => set(key, num(e.target.value))} />
              <small className="field-hint">{hint}</small>
            </label>
          ))}
        </div>

        <fieldset className="toggles">
          <legend>Feats</legend>
          {TOGGLES.map(([key, label, hint]) => (
            <label key={key} className="toggle">
              <input type="checkbox" checked={profile[key]} onChange={(e) => set(key, e.target.checked)} />
              <span>
                {label} <small>{hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
}
