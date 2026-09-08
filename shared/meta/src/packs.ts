import type { PrintId, PrintTier } from "./prints";
import { PRINTS, PRINT_INFO } from "./prints";
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
  base: 90.65,
  foil: 7.5,
  altArt: 1,
  blackLabel: 0.5,
  secret: 0.2,
  signed: 0.1,
  holoOne: 0.05,
};

/** Diamond packs. Better on every line, not just the top. */
export const DIAMOND_RATES: RateTable = {
  base: 71.3,
  foil: 25,
  altArt: 2,
  blackLabel: 1,
  secret: 0.4,
  signed: 0.2,
  holoOne: 0.1,
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
  rates: RateTable;
  /** Berries. Null only for a pack that cannot be bought at all. */
  price: number | null;
}

export const PACKS: Record<PackId, PackDef> = {
  silverCard:      { id: "silverCard",      name: "Silver Card Pack",      contents: "cards",     pulls: 5, rates: STANDARD_RATES, price: 90  },
  goldCard:        { id: "goldCard",        name: "Gold Card Pack",        contents: "cards",     pulls: 8, rates: STANDARD_RATES, price: 170 },
  diamondCard:     { id: "diamondCard",     name: "Diamond Card Pack",     contents: "cards",     pulls: 8, rates: DIAMOND_RATES,  price: 300 },
  goldCosmetic:    { id: "goldCosmetic",    name: "Gold Cosmetic Pack",    contents: "cosmetics", pulls: 1,  rates: STANDARD_RATES, price: 100 },
  diamondCosmetic: { id: "diamondCosmetic", name: "Diamond Cosmetic Pack", contents: "cosmetics", pulls: 5,  rates: DIAMOND_RATES,  price: 450 },
};

/** What a match hands out. The winner gets both of theirs. */
export const MATCH_REWARDS = {
  winner: ["goldCard", "goldCosmetic"] as PackId[],
  loser: ["silverCard"] as PackId[],
};

// ── Cosmetics ────────────────────────────────────────────────────────────────
// A cosmetic pull rolls its tier, then what kind of thing it is, so a run of
// wins is not a run of stickers.

export const COSMETIC_CATEGORIES = [
  "finisher", "arena", "killEffect", "border", "banner", "sticker", "title", "berries",
] as const;

export type CosmeticCategory = (typeof COSMETIC_CATEGORIES)[number];

/** Which categories a tier can produce, and how often within that tier. */
export const CATEGORY_WEIGHTS: Record<PrintTier, Readonly<Partial<Record<CosmeticCategory, number>>>> = {
  3: { berries: 40, sticker: 30, border: 15, banner: 15 },
  // Your tier list put mid-tier arenas at 4 stars, but the category list said
  // arenas are 5 star and up because they are big background visuals. Following
  // the category list, since that reasoning is the stronger of the two.
  4: { title: 30, sticker: 25, killEffect: 25, banner: 20 },
  5: { killEffect: 30, finisher: 25, border: 20, banner: 15, arena: 10 },
  6: { finisher: 45, arena: 35, border: 20 },
  7: { finisher: 55, arena: 45 },
};

for (const [tier, weights] of Object.entries(CATEGORY_WEIGHTS)) {
  assertSumsTo100(`CATEGORY_WEIGHTS[${tier}]`, Object.values(weights) as number[]);
}

// ── Rolling ──────────────────────────────────────────────────────────────────

export interface CardPull {
  kind: "card";
  cardId: string;
  print: PrintId;
  tier: PrintTier;
}

export interface CosmeticPull {
  kind: "cosmetic";
  category: CosmeticCategory;
  tier: PrintTier;
}

export type Pull = CardPull | CosmeticPull;

export interface PackResult {
  pack: PackId;
  pulls: Pull[];
  /** Seed the pack was opened with, so the same pack can be replayed. */
  seed: number;
}

function rollTier(rng: Rng, rates: RateTable): PrintTier {
  const totals = tierRates(rates);
  return pickWeighted(rng, [
    { value: 3 as PrintTier, weight: totals[3] },
    { value: 4 as PrintTier, weight: totals[4] },
    { value: 5 as PrintTier, weight: totals[5] },
    { value: 6 as PrintTier, weight: totals[6] },
    { value: 7 as PrintTier, weight: totals[7] },
  ]);
}

/** One roll across all six prints. */
function rollPrint(rng: Rng, rates: RateTable): PrintId {
  return pickWeighted(rng, PRINTS.map(print => ({ value: print, weight: rates[print] })));
}

function rollCategory(rng: Rng, tier: PrintTier): CosmeticCategory {
  const weights = CATEGORY_WEIGHTS[tier];
  const entries = (Object.entries(weights) as [CosmeticCategory, number][])
    .map(([value, weight]) => ({ value, weight }));
  return pickWeighted(rng, entries);
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
      const tier = rollTier(rng, pack.rates);
      pulls.push({ kind: "cosmetic", category: rollCategory(rng, tier), tier });
      continue;
    }
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
