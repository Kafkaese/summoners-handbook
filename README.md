# Summoner's Handbook (Pathfinder 1e)

A web app for Pathfinder 1e summoning spells and druid wild shape.

- **Summoning:** *summon monster*, *summon nature's ally*, *summon swarm*, *summon genie*
  and *summon giant ally*. Set your class, level and alignment, pick a spell, pick a
  creature, and get the summoned stat block with the alignment template, alignment
  change and Augment Summoning applied.
- **Wild Shape** (`#wild-shape`): for druids. Enter your ability scores and a few
  bonuses, browse the animals you can turn into at your level (beast shape I–III),
  star the ones you're familiar with, and get your stat block in that form.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173, also reachable from your phone on the same network
npm test         # rules tests
npm run build    # static build in dist/
```

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
it installs dependencies, runs the tests, builds, and publishes `dist/` to GitHub Pages at
https://kafkaese.github.io/summoners-handbook/. A failing test stops the deploy.

The workflow passes the Pages base path to Vite as `BASE_PATH`. To build for the subfolder
locally, run `BASE_PATH=/summoners-handbook/ npm run build`.

The scraped data in `src/data/` is committed; CI doesn't scrape. To update it, run
`npm run scrape` locally, then commit and push.

## How it works

- `scripts/` scrapes d20pfsrd.com into `src/data/`:
  - `scrape-lists.mjs` reads the summon tables into `summonLists.json`
  - `scrape-creatures.mjs` parses every linked bestiary page into `creatures.json`

  - `scrape-animals.mjs` crawls the animal listings into `animals.json` for wild shape. It
    keeps only animals found on [Archives of Nethys](https://aonprd.com) (Paizo's licensed
    reference), which also gives each one's source book, and leaves out swarms, advanced
    or templated versions, and books without a verified copyright notice.
  - `scrape-spells.mjs` looks up every spell in those stat blocks and writes
    `restrictedSpells.json`: spells a summoned creature can't use (summoning, teleportation,
    planar travel, costly material components). The app crosses these out.

  Run them all with `npm run scrape`. Fetched pages are cached in `scripts/.cache/`
  (gitignored), so re-running only hits the network for new pages.
- `src/rules/` holds the rules logic:
  - class spell access, including summoner, unchained summoner and medium spell levels and the summoner SLA
  - alignment → template choice (celestial, entropic, fiendish, resolute) and cleric/warpriest restrictions
  - the four templates, applied by HD band
  - Augment Summoning (attack, damage, hp, saves, CMB/CMD, Climb/Swim and Str/Con-based DCs)
  - wild shape (`wildshape.ts`): beast shape I–III by druid level, size adjustments,
    movement and sense caps, which special abilities each version grants, and natural
    attacks with the druid's own BAB and Str
- `src/components/` is the React UI: three panes on desktop, one pane at a time on phones.

## Known limitations

- The young template, used by a few Adventure Path alternatives, is noted but not applied.
- Damage changes from Augment Summoning infer the Strength multiplier (½, 1, 1½)
  from the printed stat block. Unusual attacks are worth a quick check.
- Summon Good/Evil/Neutral Monster feat lists, Evolved Summoned Monster and
  similar feats are not included yet.

- Wild shape covers animals only so far; elementals and plants (elemental body,
  plant shape), druid archetypes and Improved Natural Attack aren't included yet.

## Licensing

- **Game content** (stat blocks, rules text, summon lists, spell data) is Open Game Content
  used under the Open Game License v1.0a. The app's license page (`#license`) shows the full
  license and the Section 15 copyright notices. `scripts/build-legal.mjs` generates them into
  `src/data/legal.json` from Paizo's compiled notices (Pathfinder Reference Document), the
  notices on each d20pfsrd page used, and d20pfsrd's master Section 15 list.
- **The Pathfinder name and other Paizo trademarks** are used under Paizo's
  [Community Use Policy](https://paizo.com/licenses/communityuse). The required notice is in
  the footer and on the license page; the wording lives in `src/legal.ts`. The policy requires
  the app to stay free, unofficial, and to show contact details (`CONTACT` in `src/legal.ts`).
