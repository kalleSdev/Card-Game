# Card Battler

A turn based card game I've been building in React and TypeScript. Two players
draft a deck, then fight it out on a board with leaders, abilities and spells.
There's an authoritative game server behind it, and a second client I'm building
now for a new card set with packs, a collection and a ranked ladder.

The main thing I wanted out of this was keeping the game rules completely
separate from the interface. All the combat logic sits in one pure function, and
both the UI and the server just call it.

## Running it

```bash
npm install
```

There are two clients and one server. Each is its own command:

```bash
npm run dev           # Grand Line client   → localhost:5180
npm run dev:jjk       # the original client → localhost:5173
npm run dev:server    # game server         → localhost:8787
```

The Grand Line client needs the server running, since accounts, packs and the
collection all live there. The original client runs standalone, and only needs
the server for online play.

```bash
npm test              # engine, rules and server tests
npm run verify        # typecheck, lint and tests
npm run build         # production build of both clients
```

## How it's put together

```
client/
  apps/
    web/               the original client
    grandline/         the new client: design system, binder, decks, shop
  packages/
    engine/            card database and scoring
    render/            render helpers
shared/
  contracts/           types shared everywhere
  battle/              the combat rules, used by client and server alike
  meta/                everything around a match: prints, packs, money, ranks
server/                Fastify + websockets, SQLite
```

Everything in a match goes through one function:

```
click ─> BattleIntent ─> applyBattleIntent(state, intent) ─> { state, events }
```

State never gets mutated. The function returns a new state plus a list of what
happened, and the screen uses that list to fire off animations. The rules don't
know anything about React, which is what let me drop the same engine on the
server without touching it. The engine's random rolls come from a seed carried
in the state, so the server and both clients always agree, and a match can be
replayed exactly.

Cards, abilities, perks and synergies are all just data in lookup tables, so
adding a character is a data change rather than a code change. New kinds of
effects are added to a union type, which makes TypeScript point out everywhere
that needs handling.

The background and card effects are all CSS and SVG rather than images.

## Online play

The server owns the match. Clients send intents and get back a redacted view of
the state, so a client is never sent the opponent's hand and can't read it out
of memory. You play a friend by opening a lobby and passing them a five
character code or an invite link. Dropping out doesn't end the match: the seat
is held for 45 seconds and the client reconnects into it.

There's also a computer opponent that sends the same intents a person does, so
it goes through the same rules and can't cheat.

## Grand Line

The second card set, built as its own client rather than bolted onto the first.
Same server, same engine, its own design system.

Every card has six prints, from a plain base up to a signed secret. They all
play identically — a print only changes how the card looks on the board, so
opening packs never buys an advantage. Packs are rolled on the server when
they're opened, never when they're earned, and the seed is kept so an opening
can be replayed exactly.

Spare copies can be scrapped for Stardust to craft a specific card, or sold for
Berries to buy more packs. Scrapping never takes your last copy.

## What's in it

- Quick match, drafted deck battles, and a collection mode
- 34 characters, 18 leader abilities, 26 activatable perks, 13 deck synergies
- Shields, Block, stuns, counterattacks, targeting restrictions
- Online play with lobbies, reconnect, surrender and a computer opponent
- Accounts, a card collection, packs, two currencies and a ranked ladder

## Testing

The engine tests build a state, apply an intent and check the result. No DOM, no
mocks:

```ts
const selected = apply(state, { type: "SELECT_ATTACKER", pid: "P1", instanceId: attacker.id });
const result = apply(selected, { type: "ATTACK_LEADER", pid: "P1" });

expect(result.state.winner).toBe("P1");
```

The pack tests open a hundred thousand cards and check the distribution matches
the published odds. The server tests run against the real schema in memory.

Typecheck, lint, tests and build run on every push.

## Still to do

- The pack opening screen, trading, and the ladder pages
- Sound
- Art for the new set

## Note

Personal project, not for sale. Character names belong to their respective
owners and are only used here for practice.
