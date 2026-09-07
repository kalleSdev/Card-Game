import { createEngine, createInitialState } from "@cg/engine";
import type { CardDef } from "@cg/contracts";

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
