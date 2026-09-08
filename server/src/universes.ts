import { createEngine, createInitialState } from "@cg/engine";
import { playBotTurn } from "@cg/battle";
import type { CardDef, PlayerId } from "@cg/contracts";
import type { BattleState, BattleEvent } from "@cg/battle";

// One place to add a new set of cards. The rest of the server never names a
// universe, it just asks for the pool a match should be played with, so adding
// a second one is a change here rather than a change everywhere.

export type UniverseId = "jjk";

export const DEFAULT_UNIVERSE: UniverseId = "jjk";

const pools: Record<UniverseId, Record<string, CardDef>> = {
  jjk: createEngine(createInitialState()).getState().cardDb,
};

export function cardsFor(universe: UniverseId = DEFAULT_UNIVERSE): Record<string, CardDef> {
  return pools[universe] ?? pools[DEFAULT_UNIVERSE];
}

// How the computer plays. Kept next to the card pool because a universe with
// different rules will want a policy that understands them, and the rest of the
// server should not have to care which one it got.
export type BotPolicy = (state: BattleState, pid: PlayerId) => { state: BattleState; events: BattleEvent[] };

const bots: Record<UniverseId, BotPolicy> = {
  jjk: playBotTurn,
};

export function botFor(universe: UniverseId = DEFAULT_UNIVERSE): BotPolicy {
  return bots[universe] ?? bots[DEFAULT_UNIVERSE];
}
