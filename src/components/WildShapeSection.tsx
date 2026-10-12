import { useEffect, useState } from 'react';
import type { Settings } from '../rules/summon';
import type { Creature } from '../rules/types';
import { DEFAULT_PROFILE, type DruidProfile, tierFor } from '../rules/wildshape';
import { useStored } from '../useStored';
import { DruidPanel } from './DruidPanel';
import { FormDetail } from './FormDetail';
import { FormList } from './FormList';
import { SettingsPanel } from './SettingsPanel';

type Pane = 'spells' | 'creatures' | 'detail';

interface Props {
  settings: Settings;
  onSettings: (s: Settings) => void;
  setPane: (p: Pane) => void;
}

const reviveProfile = (raw: unknown): DruidProfile => ({ ...DEFAULT_PROFILE, ...(typeof raw === 'object' && raw ? raw : {}) });
const reviveIds = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []);

export function WildShapeSection({ settings, onSettings, setPane }: Props) {
  const [forms, setForms] = useState<Creature[] | null>(null);
  const [profile, setProfile] = useStored<DruidProfile>('pf1e-summoner.druid', DEFAULT_PROFILE, reviveProfile);
  const [familiarIds, setFamiliarIds] = useStored<string[]>('pf1e-summoner.familiar', [], reviveIds);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // The animal data is only needed here, so it loads on first use.
    import('../data/animals.json').then((m) => setForms(Object.values(m.default as unknown as Record<string, Creature>)));
  }, []);

  const isDruid = settings.classId === 'druid';
  const tier = tierFor(settings.level);
  const familiar = new Set(familiarIds);
  const form = forms?.find((f) => f.id === selected && tier?.sizes.includes(f.size as never)) ?? null;

  const notice = !tier ? (
    <section className="card placeholder">
      <p>Druids gain wild shape at 4th level.</p>
    </section>
  ) : null;

  return (
    <main className="layout">
      <div className="pane pane-spells">
        <SettingsPanel settings={settings} onChange={onSettings} characterOnly />
        {/* In the first pane so phones (one pane at a time) see it too. */}
        {notice}
        {isDruid && (
          <>
            <DruidPanel level={settings.level} profile={profile} onChange={setProfile} />
            {tier && (
              <button className="chip is-active show-forms" onClick={() => setPane('creatures')}>
                Show animal forms
              </button>
            )}
          </>
        )}
      </div>

      <div className="pane pane-creatures">
        {notice ? (
          <section className="card placeholder">
            <p>Animal forms appear here once your druid can wild shape.</p>
          </section>
        ) : forms && tier ? (
          <FormList
            forms={forms}
            tier={tier}
            familiar={familiar}
            onToggleFamiliar={(id) => setFamiliarIds(familiar.has(id) ? familiarIds.filter((x) => x !== id) : [...familiarIds, id])}
            selected={form?.id ?? null}
            onSelect={(id) => {
              setSelected(id);
              setPane('detail');
            }}
            onBack={() => setPane('spells')}
          />
        ) : (
          <section className="card placeholder">
            <p>Loading animals…</p>
          </section>
        )}
      </div>

      <div className="pane pane-detail">
        {form && isDruid ? (
          <FormDetail form={form} level={settings.level} profile={profile} alignment={settings.alignment} onBack={() => setPane('creatures')} />
        ) : (
          <section className="card placeholder">
            <p>Pick an animal to see your stats in that form.</p>
          </section>
        )}
      </div>
    </main>
  );
}
