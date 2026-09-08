import { createEngine, createInitialState } from "@cg/engine";
import { deriveStats } from "@cg/battle";
import type { CardFace } from "../components/PrintCard";

/**
 * The card pool.
 *
 * One Piece has no cards drawn yet, so this borrows the existing set to build
 * against. Everything downstream reads `POOL` and `cardFace()` rather than
 * naming a universe, so swapping the source later is a change to this file and
 * nothing else.
 */
const cardDb = createEngine(createInitialState()).getState().cardDb;

export const POOL: string[] = Object.keys(cardDb).sort();

const faces: Record<string, CardFace> = Object.fromEntries(
  POOL.map(id => {
    const def = cardDb[id];
    const stats = deriveStats(def);
    return [id, { id, name: def.name, atk: stats.atk, hp: stats.hp, cost: stats.cost }];
  }),
);

export function cardFace(id: string): CardFace {
  return faces[id] ?? { id, name: id, atk: 0, hp: 0, cost: 0 };
}

export function cardName(id: string): string {
  return faces[id]?.name ?? id;
}

/** Cards that can lead a deck. Placeholder rule: the strongest rarities. */
export const LEADER_POOL: string[] = POOL.filter(id => {
  const rarity = cardDb[id].rarity;
  return rarity === "SSS" || rarity === "SS" || rarity === "X";
});
