import { createEngine, createInitialState } from "@cg/engine";
import { deriveStats } from "@cg/battle";
import { assertGraded, scoreCardsFrom, type ScoreCard } from "@cg/score";
import type { CardFace } from "../components/PrintCard";
import { displayNameFor, shortNameFor } from "./names";

/**
 * The card pool.
 *
 * One Piece has no cards drawn yet, so this borrows the existing set to build
 * against. Everything downstream reads `POOL` and `cardFace()` rather than
 * naming a universe, so swapping the source later is a change to this file and
 * nothing else.
 */
/** Every card definition, which the battle engine needs whole. */
export const cardDb = createEngine(createInitialState()).getState().cardDb;

export const POOL: string[] = Object.keys(cardDb).sort();

const faces: Record<string, CardFace> = Object.fromEntries(
  POOL.map(id => {
    const def = cardDb[id];
    const stats = deriveStats(def);
    return [id, {
      id,
      name: displayNameFor(id, def.name, false),
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

/** What a card calls itself on a card. Full name unless that would wrap. */
export function cardName(id: string): string {
  return faces[id]?.name ?? id;
}

/** The name as written down, wrapping or not, for anywhere with room for it. */
export function fullCardName(id: string): string {
  return cardDb[id]?.name ?? id;
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

/**
 * Pulling every card's picture into the browser cache, once, at start.
 *
 * A card is an object, not a frame with a picture arriving inside it a moment
 * later. Without this the first sight of any card is its border and its
 * gradient, then a pop as the art lands — which reads as a page assembling
 * itself rather than as a card being turned over.
 *
 * The whole set is thirty-odd images and it is fetched in the background, so
 * nothing waits on it: by the time the binder or a board is on screen the
 * pictures are already decoded and paint with the card. Fetch failures are
 * ignored on purpose, because a missing picture still leaves a usable card.
 */
let preloaded = false;

export function preloadCardArt(): void {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;

  for (const id of POOL) {
    const image = new Image();
    image.decoding = "async";
    image.src = artUrl(id);
  }
}

/** What a card is for: LEADER, COMBAT or SUPPORT, as the pool records it. */
export function cardAffinity(id: string): string {
  return String(cardDb[id]?.affinity ?? "");
}

/** The rarity letter, which is what decides who can lead a deck. */
export function cardRarity(id: string): string {
  return String(cardDb[id]?.rarity ?? "");
}
