# Touchline — offline-first football manager simulation PWA

A personal-use football management sim built with Next.js 14 (App Router) +
TypeScript, IndexedDB for saves, a Web Worker for match simulation, and a
service worker for full offline support once installed.

This is a **scaffold with a working core loop**, not a finished game. The
calendar loop, persistence, and match engine are fully wired end-to-end —
start a career, advance days, play a full 90 minutes with live subs/tactics,
see the result affect finances/morale/fan sentiment. Every other pillar
(transfers, youth, scouting, media, facilities, world progression) has real
baseline logic behind it, with clearly marked extension points for adding
depth. See **"What's real vs. a documented stub"** below before you dig in.

## Running it

```bash
npm install
npm run dev       # http://localhost:3000
```

To get the genuine offline PWA experience (not just "offline against your
dev server"), build the static export and serve it:

```bash
npm run build     # outputs to ./out — a fully static site, no server needed
npx serve out     # or any static file server / host
```

Open it once while online so the service worker can precache the app shell;
after that, it works fully offline (airplane mode, no wifi, etc.) including
starting new careers, since world generation is entirely client-side.

> This scaffold was built in a sandboxed environment with no network access,
> so `npm install` / `npm run build` have **not** been run or verified here.
> Do that first thing — if anything doesn't compile, it's most likely a
> small version-pin mismatch in `package.json`, not a logic error.

## Architecture

```
src/
  domain/types.ts        <- single source of truth for every data shape
  engines/                <- pure(ish) logic, no React, easy to unit test
    calendar/              weekly-briefing -> training -> off-pitch ->
                            matchday-build-up -> matchday-live -> post-match
                            -> calendar-advance loop
    match/                 possession-based tick simulation, set pieces,
                            weather modifiers, live subs/tactic changes
    tactics/                position-fit/familiarity math + AI lineup builder
    transfers/              valuation, offer lifecycle, scouting reports
    finance/                wage burn, sponsorships, budget checks
    youth/                  deterministic procedural player generation +
                            annual intake
    staff/                  training application, coaching quality effects
    personality/            squad chemistry, team talks, morale
    media/                  press stories + response effects
    facilities/             upgrade proposals (queue persistence is a
                            documented TODO — see file header)
    fanSentiment/           slow-moving mood tracker
    world/                  weekly briefing text, season rollover skeleton,
                            rivalries, takeovers, new-save world generation
    persistence/            IndexedDB (db.ts) + save policy (saveManager.ts):
                            autosave, manual save, snapshots, export/import,
                            optional cloud sync hook
  workers/
    matchSim.worker.ts      runs the match engine off the UI thread
    simDispatch.ts          promise/event wrapper the UI talks to
  state/gameStore.ts        zustand store holding the active save in memory
  hooks/                    useAutoLoadSave, useSaveList, useLiveMatch, usePlayer
  components/               UI, organized by section
  app/                      Next.js App Router pages — one per bottom-nav tab
  data/leagues/*.json       editable "real world" seed data (see data/README.md)
public/
  manifest.json, sw.js, icons/   PWA install + offline caching
```

**Why this split:** engines never import from `components/` or `app/` — they
take a `SaveGameWorld` (or a slice of it) and mutate/return it. UI components
only read from `state/gameStore.ts` and call engine functions through it.
This means every engine is independently testable and the match simulation
can run identically in the worker, on the main thread, or in a unit test.

## The gameplay loop

Each in-game day cycles through `GamePhase` (see `domain/types.ts`):
`weekly-briefing → tactics-training → off-pitch → matchday-build-up →
matchday-live → post-match → calendar-advance`. The **Continue** button in
the top bar (`components/layout/TopBar.tsx`) advances one phase at a time by
calling `engines/calendar/calendarEngine.ts::advancePhase`, which delegates
side effects to the relevant engine per phase. `calendarEngine.ts` also
exposes `advanceUntilNextMatchOrDecisionNeeded` for a "sim to next match"
fast-forward, stopping early if an urgent inbox item needs attention.

## The match engine

`engines/match/matchEngine.ts` simulates one minute at a time: possession is
weighted by aggregated team strength (passing/vision/decisions for the side
in possession) plus home advantage and weather, chances are resolved to an
xG value contested by the defense and goalkeeper, and cards/injuries/fatigue
accumulate every minute. Set pieces (`setPieces.ts`) are resolved separately
using designated takers and aerial targets rather than the generic open-play
model. Everything is pure and deterministic given a seed
(`mulberry32` PRNG), so the same inputs always produce the same match —
useful for debugging and for eventually adding a "watch a replay" feature.

Live subs and tactic changes during a match go: UI (`app/matchday/page.tsx`)
→ `hooks/useGameLoop.ts::useLiveMatch` → `workers/simDispatch.ts` →
`workers/matchSim.worker.ts`, which holds the live `MatchState` and re-posts
it after every mutation so the UI re-renders.

## What's real vs. a documented stub

**Fully wired, playable end-to-end:**
- New career creation → squad/fixture/referee generation → calendar loop
- Weekly briefing, training (fatigue/growth/injury rolls), finance ticks
- A full 90-minute match with live subs/tactic changes, cards, injuries, set
  pieces, weather effects
- Post-match: fan sentiment update, media story + press-conference response,
  player stat/form/fatigue write-back
- Transfers: valuation, offer submission, AI accept/reject, completion
- Youth intake generation, promotion/release
- Saves: autosave, manual save, backup snapshots, export/import JSON,
  optional cloud sync hook (no-op until you register a provider)

**Real baseline logic, deliberately left shallow (each file says exactly
where to extend it):**
- `engines/world/worldEngine.ts::progressSeasonEnd` — season rollover is
  scaffolded (contract expiries, youth intake trigger, table finalisation)
  but the actual standings computation and promotion/relegation application
  aren't implemented yet
- `engines/facilities/facilitiesEngine.ts` — upgrade proposals work, but the
  day-by-day construction queue needs a new `SaveGameWorld` field to persist
  (documented inline)
- Scouting only estimates a composite ability number, not per-attribute
  estimates (the noise function is there; populating
  `ScoutingReport.estimatedAttributes` is a small addition)
- Rivalry intensity math exists (`bumpRivalry`) but nothing currently calls
  it from normal league fixtures — only from big margins/media incidents —
  so wire it into `applyMatchResultToFanSentiment` or a post-match hook for
  derby fixtures specifically
- Manager AI (transfer activity, in-season tactical tweaks) reads
  `ManagerTacticalProfile` for setup but doesn't yet *act* on the transfer
  market autonomously — `transferEngine.ts` has everything needed
  (valuation, offer evaluation) for an AI club to call it on a timer

## Real-world player/manager data

This ships with **zero real player/club data** — `src/data/leagues/sample-league.json`
has eight fictional clubs so the game is playable out of the box. Real-world
data (players, managers, tactical tendencies) is entirely your own editable
JSON per `src/data/README.md`; nothing here fetches or embeds any
copyrighted database. The more detail you add per player (full attributes,
personality, contract), the more realistic that player will behave in the
sim — anything you omit gets a sensible generated default.

## Known gaps to check once you can actually build this

- `npm install` hasn't been run in this sandbox (no network access) —
  double-check the pinned versions in `package.json` still resolve cleanly
- Google Fonts (`Fraunces`/`Inter`/`IBM Plex Mono`, linked in
  `app/layout.tsx`) need network on first load; swap for local `next/font`
  files if you want zero external requests even on first launch
- `next.config.js` uses `output: "export"` for genuine offline support —
  if you add any server-only feature later (API routes, ISR), you'll need
  to drop that and rethink the offline strategy (e.g. cache API responses
  in the service worker instead)
