import { useEffect, useMemo, useState } from 'react';
import { CreatureList } from './components/CreatureList';
import { LicensePage } from './components/LicensePage';
import { SettingsPanel } from './components/SettingsPanel';
import { SpellList } from './components/SpellList';
import { SummonDetail } from './components/SummonDetail';
import { WildShapeSection } from './components/WildShapeSection';
import { classById, summonOptions } from './rules/classes';
import { choicesFor, countGroups, optionTitle } from './rules/summon';
import type { TemplateId } from './rules/templates';
import { APP_NAME, COMMUNITY_USE_NOTICE } from './legal';
import { useSettings } from './useSettings';

type Pane = 'spells' | 'creatures' | 'detail';
type Route = 'summon' | 'wild-shape' | 'license';

const routeFromHash = (): Route => (window.location.hash === '#license' ? 'license' : window.location.hash === '#wild-shape' ? 'wild-shape' : 'summon');

export default function App() {
  const [settings, setSettings] = useSettings();
  const [optionKey, setOptionKey] = useState<string | null>(null);
  const [groupIndex, setGroupIndex] = useState(0);
  const [choiceKey, setChoiceKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, TemplateId>>({});
  const [pane, setPane] = useState<Pane>('spells');
  const [route, setRoute] = useState<Route>(routeFromHash);
  // The section to return to from the license page.
  const [section, setSection] = useState<Exclude<Route, 'license'>>(() => (routeFromHash() === 'wild-shape' ? 'wild-shape' : 'summon'));
  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash();
      setRoute(next);
      if (next !== 'license') {
        setSection(next);
        setPane('spells');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const closeLicense = () => {
    window.location.hash = section === 'wild-shape' ? '#wild-shape' : '';
  };

  const cls = classById(settings.classId);
  const options = useMemo(() => summonOptions(cls, settings.level), [cls, settings.level]);
  const option = options.find((o) => o.key === optionKey && o.available) ?? null;
  const groups = option ? countGroups(option.level, settings.superiorSummoning, option.spell) : [];
  const group = groups[Math.min(groupIndex, groups.length - 1)];

  const choices = option && group ? group.listLevels.flatMap((l) => choicesFor(option.spell, l, cls, settings)) : [];
  const choice = choices.find((c) => c.key === choiceKey) ?? null;
  const chosenTemplate = choice ? templates[choice.key] : undefined;
  const template = choice?.templateOptions.length
    ? chosenTemplate && choice.templateOptions.includes(chosenTemplate)
      ? chosenTemplate
      : choice.templateOptions[0]
    : null;

  const selectOption = (key: string) => {
    setOptionKey(key);
    setGroupIndex(0);
    setChoiceKey(null);
    setPane('creatures');
  };

  return (
    <div className="app" data-pane={pane}>
      <header className="app-header">
        <h1>
          <span className="logo" aria-hidden>
            ✶
          </span>{' '}
          {APP_NAME}
        </h1>
        <p className="tagline">Pathfinder 1e summoning &amp; wild shape</p>
        <nav className="tabs" aria-label="Sections">
          <a href="#" className={route === 'summon' ? 'is-active' : ''} aria-current={route === 'summon' ? 'page' : undefined}>
            Summoning
          </a>
          <a href="#wild-shape" className={route === 'wild-shape' ? 'is-active' : ''} aria-current={route === 'wild-shape' ? 'page' : undefined}>
            Wild Shape
          </a>
        </nav>
      </header>

      {route === 'license' ? (
        <main className="license-layout">
          <LicensePage onClose={closeLicense} />
        </main>
      ) : route === 'wild-shape' ? (
        <WildShapeSection settings={settings} onSettings={setSettings} setPane={setPane} />
      ) : (
        <main className="layout">
          <div className="pane pane-spells">
            <SettingsPanel settings={settings} onChange={setSettings} />
            <SpellList cls={cls} options={options} selected={option?.key ?? null} onSelect={selectOption} />
          </div>

          <div className="pane pane-creatures">
            {option && group ? (
              <CreatureList
                spell={option.spell}
                title={optionTitle(option)}
                groups={groups}
                groupIndex={groups.indexOf(group)}
                onGroup={(i) => {
                  setGroupIndex(i);
                  setChoiceKey(null);
                }}
                choices={choices}
                selected={choice?.key ?? null}
                onSelect={(key) => {
                  setChoiceKey(key);
                  setPane('detail');
                }}
                onBack={() => setPane('spells')}
              />
            ) : (
              <section className="card placeholder">
                <p>Pick a spell to see what you can summon.</p>
              </section>
            )}
          </div>

          <div className="pane pane-detail">
            {choice && group ? (
              <SummonDetail
                choice={choice}
                group={group}
                duration={option!.duration}
                template={template}
                onTemplate={(t) => setTemplates({ ...templates, [choice.key]: t })}
                settings={settings}
                onBack={() => setPane('creatures')}
              />
            ) : (
              <section className="card placeholder">
                <p>Pick a creature to see its summoned stat block.</p>
              </section>
            )}
          </div>
        </main>
      )}

      <footer className="app-footer">
        <p>{COMMUNITY_USE_NOTICE}</p>
        <p>
          Game rules are Open Game Content used under the Open Game License v1.0a. <a href="#license">License &amp; credits</a>
        </p>
      </footer>
    </div>
  );
}
