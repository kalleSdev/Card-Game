# Card Battler

A turn based card game I've been building in React and TypeScript. Two players
draft a deck, then fight it out on a board with leaders, abilities and spells.

The main thing I wanted out of this was keeping the game rules completely
separate from the interface. All the combat logic sits in one pure function, and
the UI just renders whatever comes back out of it.

## Running it

```bash
npm install
npm run dev       # dev server
npm test          # engine tests
npm run verify    # typecheck, lint and tests
npm run build     # production build
```

## How it's put together

```
client/
  apps/web/            the React app
    src/
      screens/         one file per screen
      components/      shared bits
      battleEngine.ts  all the combat rules
      profiles.ts      saved profiles and collection
  packages/
    engine/            card database and scoring
    render/            render helpers
shared/
  contracts/           types shared across packages
```

Everything goes through one function:

```
click ─> BattleIntent ─> applyBattleIntent(state, intent) ─> { state, events }
```

State never gets mutated. The function returns a new state plus a list of what
happened, and the screen uses that list to fire off animations. That means the
rules don't know anything about React, and I could drop the same engine on a
server later without touching it.

Cards, abilities, perks and synergies are all just data in lookup tables, so
adding a character is a data change rather than a code change. New kinds of
effects are added to a union type, which makes TypeScript point out everywhere
that needs handling.

The background and card effects are all CSS and SVG rather than images.

## What's in it

- Quick match, drafted deck battles, and a collection mode
- 34 characters, 18 leader abilities, 26 activatable perks, 13 deck synergies
- Shields, Block, stuns, counterattacks, targeting restrictions
- Card collection with duplicate based ascension, profiles and a leaderboard

## Testing

The engine tests build a state, apply an intent and check the result. No DOM, no
mocks:

```ts
const selected = apply(state, { type: "SELECT_ATTACKER", pid: "P1", instanceId: attacker.id });
const result = apply(selected, { type: "ATTACK_LEADER", pid: "P1" });

expect(result.state.winner).toBe("P1");
```

Typecheck, lint, tests and build run on every push.

## Still to do

- Server side multiplayer using the same engine
- Sound
- A second card set

## Note

Personal project, not for sale. Character names belong to their respective
owners and are only used here for practice.
