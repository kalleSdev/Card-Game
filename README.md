# Card Battler

A turn-based tactical card game built as a single-page React application. The project is a
study in separating game rules from presentation: all combat logic lives in a pure,
framework-agnostic reducer, while the UI is a thin rendering layer driven by the events that
reducer emits.

Built with React 18, TypeScript, and Vite in an npm workspaces monorepo.

---

## Highlights

- **Pure reducer game engine** — ~2,400 lines of side-effect-free TypeScript. Every player
  action is an intent; every result is a `{ state, events }` pair. No framework imports, fully
  unit-testable, and trivially portable to a server for authoritative multiplayer.
- **Discriminated-union rule system** — 25 intent types, 12 event types, 18 spell effects and
  23 domain-effect variants, all modelled as tagged unions so the compiler enforces exhaustive
  handling whenever a new mechanic is added.
- **Data-driven content** — 34 characters, 18 unique abilities, 26 activatable perks and 13
  deck synergies are declared as data, not code. New content is added by extending a table;
  the engine is untouched.
- **Zero-asset procedural rendering** — the animated battlefield, card frames and all visual
  effects are generated from CSS, SVG and Framer Motion. No image or model pipeline, no
  licensing surface, and the production bundle stays small.
- **Type-safe workspace boundaries** — shared contracts are published as their own workspace
  package, so the UI, the rules engine and the content database cannot drift out of sync.
- **Tested and enforced** — the reducer's purity makes it directly unit-testable with no DOM or
  mocking. Type-checking, linting and tests run on every push via GitHub Actions.

---

## Architecture

```
card-game/
├── client/
│   ├── apps/
│   │   └── web/                    # @cg/app-web — React application
│   │       └── src/
│   │           ├── screens/        # 27 route-level screens
│   │           ├── components/     # Shared presentational components
│   │           ├── battleEngine.ts # Pure combat reducer (~2.4k LOC)
│   │           └── profiles.ts     # Local persistence, collection, progression
│   └── packages/
│       ├── engine/                 # @cg/engine — content database & scoring (~1.6k LOC)
│       └── render/                 # @cg/render — shared render helpers
└── shared/
    └── contracts/                  # @cg/contracts — cross-package type definitions
```

### Unidirectional data flow

```
UI event ──▶ BattleIntent ──▶ applyBattleIntent(state, intent)
                                        │
                             ┌──────────┴──────────┐
                             ▼                     ▼
                        next state             BattleEvent[]
                             │                     │
                             ▼                     ▼
                       render board          drive animations
```

State is never mutated. The reducer returns a new state plus a list of events describing what
happened; the UI renders the state and uses the event stream to trigger transient effects
(impacts, deaths, screen shake). This keeps animation concerns entirely out of the rules layer
and means the same engine could run headless on a server without modification.

### Design decisions worth noting

**Rules as data.** Abilities, synergies and perks are lookup tables keyed by card id. Adding a
character is a data change; adding a *new kind of effect* is a new union member, which the
compiler then forces you to handle everywhere it matters.

**Events over callbacks.** Rather than having the engine call into the UI, it returns a
description of what occurred. The renderer decides what that looks like. Combat resolution and
visual feedback evolve independently.

**Procedural visuals.** Backgrounds, particle systems and card effects are composed from CSS
keyframes, inline SVG and spring animations. Depth is achieved with layered parallax driven by
pointer-position springs rather than 3D geometry — the visual payoff of a rendered scene at a
fraction of the runtime and build cost.

**Performance.** Ambient animation runs on CSS keyframes (compositor-driven) while interactive
motion uses springs. Tooltips render through portals to escape transformed ancestors, and
entity lists are keyed by stable instance ids so enter/exit transitions stay correct as the
board mutates.

---

## Features

| Area | Detail |
| --- | --- |
| Game modes | Quick match, drafted-deck battle, and a persistent collection mode |
| Combat | Resource curve, summoning sickness, taunt/protection, counterattacks, stuns, targeting restrictions |
| Abilities | 18 leader abilities with distinct escalating second activations |
| Perks | 26 one-per-match activated abilities, several requiring multi-step target selection |
| Synergies | 13 tag-based deck synergies that populate a per-player spell pool |
| Progression | Card collection, duplicate-based ascension tiers, per-card statistics, profiles and leaderboards |
| Presentation | Layered parallax arena, interactive props, event-driven combat feedback, cinematic transitions |

---

## Getting started

```bash
npm install       # install all workspaces
npm run dev       # Vite dev server
npm test          # run the engine test suite
npm run verify    # type-check + lint + test (what CI runs)
npm run build     # type-check and produce a production build
```

The dev server prints a local URL on start (default `http://localhost:5173`).

### Testing

Combat rules are covered by unit tests against `applyBattleIntent`. Because the reducer is pure,
tests construct a state, apply an intent and assert on the returned state and events — no
rendering, no mocks, no async:

```ts
const selected = apply(state, { type: "SELECT_ATTACKER", pid: "P1", instanceId: attacker.id });
const result = apply(selected, { type: "ATTACK_LEADER", pid: "P1" });

expect(result.state.winner).toBe("P1");
expect(result.events.some(e => e.type === "GAME_OVER")).toBe(true);
```

---

## Project status

Actively developed. The combat engine, content pipeline and progression systems are complete
and stable; presentation work and additional content are ongoing.

Planned next: server-authoritative multiplayer using the existing engine unchanged, an
automated test suite over the reducer, and a second content set to exercise the data-driven
design.

---

## Notes

This is a personal, non-commercial project built to explore game-state architecture and
animation in the browser. Character names and likenesses referenced in the sample content set
belong to their respective rights holders and are used here for non-commercial study only.
