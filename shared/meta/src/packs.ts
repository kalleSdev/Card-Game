import type { PrintId, PrintTier } from "./prints";
import { PRINTS, PRINT_INFO } from "./prints";
import { rollCosmetic, type CosmeticRoll } from "./cosmetics";
import { assertSumsTo100, makeRng, pickWeighted, type Rng } from "./rng";

// Packs roll in two or three stages. First the tier, then — on 5★ and 6★ — the
// standard print or its variant. Cosmetic packs roll a category after that.

/**
 * Odds are quoted per print rather than per tier, so a variant is not tied to a
 * fixed share of its tier and each of the six can be tuned on its own.
 */
export type RateTable = Readonly<Record<PrintId, number>>;

/** Silver and gold packs, cards and cosmetics alike. */
export const STANDARD_RATES: RateTable = {
  // Base takes whatever the others leave, so the column always totals 100
  base: 90.7,
  foil: 7.5,
  altArt: 1,
  blackLabel: 0.5,
  secret: 0.2,
  holoOne: 0.1,
};

/** Diamond packs. Better on every line, not just the top. */
export const DIAMOND_RATES: RateTable = {
  base: 71.4,
  foil: 25,
  altArt: 2,
  blackLabel: 1,
  secret: 0.4,
  holoOne: 0.2,
};

assertSumsTo100("STANDARD_RATES", Object.values(STANDARD_RATES));
assertSumsTo100("DIAMOND_RATES", Object.values(DIAMOND_RATES));

/** Rolls the six print rates up into four tier rates, for cosmetic packs. */
export function tierRates(rates: RateTable): Record<PrintTier, number> {
  const totals: Record<PrintTier, number> = { 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const print of PRINTS) totals[PRINT_INFO[print].tier] += rates[print];
  return totals;
}

export type PackId =
  | "silverCard" | "goldCard" | "diamondCard"
  | "goldCosmetic" | "diamondCosmetic";

export interface PackDef {
  id: PackId;
  name: string;
  /** Cards for a card pack, cosmetics for a cosmetic pack. */
  contents: "cards" | "cosmetics";
  pulls: number;
  /**
   * Card packs only. Cosmetic packs all roll COSMETIC_RATES, because a cosmetic
   * pack is scarce for how few you get rather than for its rates.
   */
  rates: RateTable | null;
  /** Berries. Null only for a pack that cannot be bought at all. */
  price: number | null;
}

export const PACKS: Record<PackId, PackDef> = {
  silverCard:      { id: "silverCard",      name: "Silver Card Pack",      contents: "cards",     pulls: 5, rates: STANDARD_RATES, price: 90  },
  goldCard:        { id: "goldCard",        name: "Gold Card Pack",        contents: "cards",     pulls: 8, rates: STANDARD_RATES, price: 170 },
  diamondCard:     { id: "diamondCard",     name: "Diamond Card Pack",     contents: "cards",     pulls: 8, rates: DIAMOND_RATES,  price: 300 },
  goldCosmetic:    { id: "goldCosmetic",    name: "Gold Cosmetic Pack",    contents: "cosmetics", pulls: 1, rates: null, price: 100 },
  diamondCosmetic: { id: "diamondCosmetic", name: "Diamond Cosmetic Pack", contents: "cosmetics", pulls: 5, rates: null, price: 450 },
};

/** What a match hands out. The winner gets both of theirs. */
export const MATCH_REWARDS = {
  winner: ["goldCard", "goldCosmetic"] as PackId[],
  loser: ["silverCard"] as PackId[],
};

// ── Rolling ──────────────────────────────────────────────────────────────────

export interface CardPull {
  kind: "card";
  cardId: string;
  print: PrintId;
  tier: PrintTier;
}

export interface CosmeticPull extends CosmeticRoll {
  kind: "cosmetic";
}

export type Pull = CardPull | CosmeticPull;

export interface PackResult {
  pack: PackId;
  pulls: Pull[];
  /** Seed the pack was opened with, so the same pack can be replayed. */
  seed: number;
}

/** One roll across all six prints. */
function rollPrint(rng: Rng, rates: RateTable): PrintId {
  return pickWeighted(rng, PRINTS.map(print => ({ value: print, weight: rates[print] })));
}

/**
 * Opens a pack. `cardPool` is the set of card ids this universe can produce, so
 * the roller never needs to know what game it is rolling for.
 */
export function openPack(
  packId: PackId,
  cardPool: readonly string[],
  seed: number,
): PackResult {
  const pack = PACKS[packId];
  const rng = makeRng(seed);
  const pulls: Pull[] = [];

  for (let i = 0; i < pack.pulls; i++) {
    if (pack.contents === "cosmetics") {
      pulls.push({ kind: "cosmetic", ...rollCosmetic(rng) });
      continue;
    }
    if (!pack.rates) throw new Error(`${pack.name} has no card rates`);
    if (cardPool.length === 0) throw new Error("Cannot open a card pack with an empty pool");
    const print = rollPrint(rng, pack.rates);
    const cardId = cardPool[Math.floor(rng.next() * cardPool.length)];
    pulls.push({ kind: "card", cardId, print, tier: PRINT_INFO[print].tier });
  }

  return { pack: packId, pulls, seed };
}

/** The odds of a print, in percent. */
export function effectiveRate(print: PrintId, rates: RateTable): number {
  return rates[print];
}

/** "8 cards" or "1 cosmetic": what a pack holds, said properly. */
export function packContents(def: PackDef): string {
  const noun = def.contents === "cards" ? "card" : "cosmetic";
  return `${def.pulls} ${noun}${def.pulls === 1 ? "" : "s"}`;
}
