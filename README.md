# Cursed Clash — a Jujutsu Kaisen Card Battler

A fast, animated, Hearthstone-meets-TFT card game set in the world of *Jujutsu Kaisen*.
Draft a deck of sorcerers and curses, take them onto a living battle board, unleash Domain
Expansions, chain deck synergies into spells, and trigger character Perks to swing the fight.

> **Fan project.** This is a non-commercial, for-fun project built by fans. All *Jujutsu Kaisen*
> characters and names belong to Gege Akutami / Shueisha. No affiliation, no endorsement.

---

## ✨ What's in this version

- **34 playable characters**, each with real ATK/HP stats, a **Domain Expansion**, and many with an
  activatable **Perk**.
- **Full Hearthstone-style battle board** — place cards, attack, take counter damage, protect your
  leader with **Shield** cards, and win by dropping the enemy leader to 0 HP.
- **Domain Expansions** — fill your domain meter to unleash a signature effect (Gojo's Infinite Void,
  Sukuna's Malevolent Shrine, Mahoraga's Adaptation, Takaba's Comedian, and ~30 more), with escalating
  second-fill effects.
- **Deck Synergies → Spells** — build a deck around shared tags (Zenin Clan, Gojo Clan, Disaster Curses,
  Culling Game, Brotherhood…) and each active synergy adds a spell to your pool that you can draw and
  cast in battle.
- **Character Perks** — one-per-game activated abilities (Mechamaru summons a Shield robot, Todo redirects
  a hit, Megumi sacrifices to summon Mahoraga, Nobara pins two enemies with Resonance, Toji breaks
  Shields, and more), each with an in-card icon + hover explanation.
- **Card collection & ascension** — collect duplicates to ascend cards up the rarity ladder
  (S → SS → SSS → X), and earn kill marks by finishing games with a card. Ascension diamonds, dupe stars,
  and kill marks render right on the card border.
- **Profiles, stats & rankings** — per-player win/loss records for each mode and a global leaderboard.
- **Juiced-up presentation** — attack lunges, impact sparks, screen shake, spell-cast splashes, turn
  banners, entrance shockwaves, floating damage numbers, domain cinematics, and animated card art.

---

## 🎮 Game Modes

| Mode | Description |
| --- | --- |
| **Quick Match** ⚡ | Fast draft into a score-based battle. |
| **Quick Draft** 🃏 | Draft your own deck pick-by-pick, then battle it out on the full board. |
| **Normal Mode** ⚔️ | Bring your collected & ascended deck and build your legacy. |
| **Gallery** 📖 | Browse every character, their stats, domains, and perks. |
| **Profiles** 👤 | View stats, match history, and your card collection. |
| **Ranking** 🏆 | Global leaderboard of top players. |

Universes: **Jujutsu Kaisen** is playable now. *One Piece* and a third universe are sealed and coming
later.

---

## ⚔️ Core Battle Rules (quick reference)

- **Leaders** start at 2 ATK / 30 HP. Reduce the enemy leader to 0 HP to win.
- **Energy** starts at 2 and grows by 1 each turn (capped at 10). Cards cost energy to play.
- **Summoning sickness** — a freshly played or summoned card can't attack the turn it arrives.
- **Shield (taunt)** — while an enemy has a Shield card in play, you can only target Shield cards; once
  they're gone, everything (including the leader) is fair game.
- **Damage spells** must target board cards first; they can only hit a leader when that side's board is
  empty. **+ATK buffs** are board-only; **+HP buffs** may target the leader.
- **Domain meter** fills as you play cards and take damage; getting your leader hit gives a comeback boost.

---

## 🧱 Tech Stack

- **React 18 + TypeScript** with **Vite**
- **Framer Motion** for animation, **Howler** for audio
- **npm workspaces** monorepo
- A pure, data-driven **battle engine** (no framework coupling) — every action is an intent, every result
  is `{ state, events }`, and the UI renders state while events drive animations.

### Repository layout

```
card-game/
├── client/
│   ├── apps/
│   │   └── web/                 # @cg/app-web — the React app
│   │       └── src/
│   │           ├── screens/     # every screen (home, draft, battle board, gallery, …)
│   │           ├── components/  # CharacterCard, ambient FX, player icons
│   │           ├── battleEngine.ts   # Hearthstone-style combat engine
│   │           └── profiles.ts       # local profiles, collection, ascension
│   └── packages/
│       ├── engine/              # @cg/engine — card database, domains, binding vows, items
│       └── render/              # @cg/render — shared render helpers
└── shared/
    └── contracts/               # @cg/contracts — card/type definitions
```

---

## 🚀 Getting Started

```bash
# install (root — uses npm workspaces)
npm install

# run the web app (Vite dev server)
npm run dev

# type-check
npm run typecheck

# production build
npm run build
```

The dev server prints a local URL (defaults to `http://localhost:5173`).

---

## 🗺️ Roadmap (next up)

This is a "done for now" snapshot — active development continues. On deck:

- More character Perks and universe expansion (One Piece + the sealed third set)
- **Binding Vows** and **Hakari's Gamble / Deal with the Devil** risk-reward events
- TFT-style items & weapon building
- Deeper collection meta — leaderboards, medals, and richer profile pages

---

*Built with care (and cursed energy) as a fan project.*
