# Summoner's Handbook (Pathfinder 1e)

A local web app for Pathfinder 1e summoning spells: *summon monster*, *summon
nature's ally*, *summon swarm*, *summon genie* and *summon giant ally*. Set your
class, level and alignment, pick a spell, pick a creature, and get the summoned
stat block with the alignment template, alignment change and Augment Summoning applied.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173, also reachable from your phone on the same network
npm test         # rules tests
npm run build    # static build in dist/
```

## How it works

- `scripts/` scrapes d20pfsrd.com into `src/data/`:
  - `scrape-lists.mjs` reads the summon tables into `summonLists.json`
  - `scrape-creatures.mjs` parses every linked bestiary page into `creatures.json`

  Run both with `npm run scrape`. Fetched pages are cached in `scripts/.cache/`
  (gitignored), so re-running only hits the network for new pages.
- `src/rules/` holds the rules logic:
  - class spell access, including summoner, unchained summoner and medium spell levels and the summoner SLA
  - alignment → template choice (celestial, entropic, fiendish, resolute) and cleric/warpriest restrictions
  - the four templates, applied by HD band
  - Augment Summoning (attack, damage, hp, saves, CMB/CMD, Climb/Swim and Str/Con-based DCs)
- `src/components/` is the React UI: three panes on desktop, one pane at a time on phones.

## Known limitations

- The young template, used by a few Adventure Path alternatives, is noted but not applied.
- Damage changes from Augment Summoning infer the Strength multiplier (½, 1, 1½)
  from the printed stat block. Unusual attacks are worth a quick check.
- Summon Good/Evil/Neutral Monster feat lists, Evolved Summoned Monster and
  similar feats are not included yet.

Rules text and stat blocks are Open Game Content from d20pfsrd.com.
