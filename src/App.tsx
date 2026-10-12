import { useMemo, useState } from 'react';
import { CreatureList } from './components/CreatureList';
import { SettingsPanel } from './components/SettingsPanel';
import { SpellList } from './components/SpellList';
import { SummonDetail } from './components/SummonDetail';
import { classById, SPELL_NAMES, summonOptions } from './rules/classes';
import { choicesFor, countGroups, optionTitle } from './rules/summon';
import type { TemplateId } from './rules/templates';
import { useSettings } from './useSettings';

type Pane = 'spells' | 'creatures' | 'detail';

export default function App() {
  const [settings, setSettings] = useSettings();
  const [optionKey, setOptionKey] = useState<string | null>(null);
  const [groupIndex, setGroupIndex] = useState(0);
  const [choiceKey, setChoiceKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, TemplateId>>({});
  const [pane, setPane] = useState<Pane>('spells');

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
          Summoner's Handbook
        </h1>
        <p className="tagline">Pathfinder 1e summon monster &amp; summon nature's ally</p>
      </header>

      <main className="layout">
        <div className="pane pane-spells">
          <SettingsPanel settings={settings} onChange={setSettings} />
          <SpellList cls={cls} options={options} selected={option?.key ?? null} onSelect={selectOption} />
        </div>

        <div className="pane pane-creatures">
          {option && group ? (
            <CreatureList
              title={optionTitle(option, SPELL_NAMES)}
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

      <footer className="app-footer">
        Rules text and stat blocks from <a href="https://www.d20pfsrd.com">d20pfsrd.com</a> under the Open Game License. Pathfinder is a trademark of Paizo Inc.
      </footer>
    </div>
  );
}
