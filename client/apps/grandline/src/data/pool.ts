import { createEngine, createInitialState } from "@cg/engine";
import { deriveStats } from "@cg/battle";
import { assertGraded, scoreCardsFrom, type ScoreCard } from "@cg/score";
import type { CardFace } from "../components/PrintCard";
import { shortNameFor } from "./names";

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
    return [id, {
      id,
      name: def.name,
      shortName: shortNameFor(id, def.name),
      atk: stats.atk,
      hp: stats.hp,
      cost: stats.cost,
      art: artUrl(id),
    }];
  }),
);

/**
 * Where a character's picture lives. This app serves the JJK client's public
 * folder, so every card that has been drawn is already here under its own id.
 */
export function artUrl(id: string): string {
  return `/cards/${id}.PNG`;
}

export function cardFace(id: string): CardFace {
  return faces[id] ?? { id, name: id, atk: 0, hp: 0, cost: 0 };
}

export function cardName(id: string): string {
  return faces[id]?.name ?? id;
}

export function cardShortName(id: string): string {
  return faces[id]?.shortName ?? id;
}

/**
 * The same cards, as Score reads them: a seat and a number of points each.
 * Checked at load, so a card outside its grade's band is a startup error rather
 * than something noticed mid-match.
 */
export const SCORE_POOL: ScoreCard[] = scoreCardsFrom(cardDb);
assertGraded(SCORE_POOL);

const scoreById = new Map(SCORE_POOL.map(card => [card.id, card]));

export function scoreCard(id: string): ScoreCard | null {
  return scoreById.get(id) ?? null;
}

/** Cards that can lead a deck. Placeholder rule: the strongest rarities. */
export const LEADER_POOL: string[] = POOL.filter(id => {
  const rarity = cardDb[id].rarity;
  return rarity === "SSS" || rarity === "SS" || rarity === "X";
});
