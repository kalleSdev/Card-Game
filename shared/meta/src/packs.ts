import type { PrintId, PrintTier } from "./prints";
import { PRINTS_BY_TIER, VARIANT_CHANCE } from "./prints";
import { assertSumsTo100, makeRng, pickWeighted, type Rng } from "./rng";

// Packs roll in two or three stages. First the tier, then — on 5★ and 6★ — the
// standard print or its variant. Cosmetic packs roll a category after that.

export type RateTable = Readonly<Record<PrintTier, number>>;

/** Silver and gold packs, cards and cosmetics alike. */
export const STANDARD_RATES: RateTable = { 3: 87, 4: 9, 5: 3.6, 6: 0.4 };

/** Diamond packs. Better on every line, not just the top. */
export const DIAMOND_RATES: RateTable = { 3: 78.2, 4: 16, 5: 5, 6: 0.8 };

assertSumsTo100("STANDARD_RATES", Object.values(STANDARD_RATES));
assertSumsTo100("DIAMOND_RATES", Object.values(DIAMOND_RATES));

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
  /** Berries, or null when the pack is only ever earned. */
  price: number | null;
}

export const PACKS: Record<PackId, PackDef> = {
  silverCard:      { id: "silverCard",      name: "Silver Card Pack",      contents: "cards",     pulls: 5,  rates: STANDARD_RATES, price: 90  },
  goldCard:        { id: "goldCard",        name: "Gold Card Pack",        contents: "cards",     pulls: 10, rates: STANDARD_RATES, price: 170 },
  diamondCard:     { id: "diamondCard",     name: "Diamond Card Pack",     contents: "cards",     pulls: 10, rates: DIAMOND_RATES,  price: 300 },
  goldCosmetic:    { id: "goldCosmetic",    name: "Gold Cosmetic Pack",    contents: "cosmetics", pulls: 1,  rates: STANDARD_RATES, price: null },
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
  return pickWeighted(rng, [
    { value: 3 as PrintTier, weight: rates[3] },
    { value: 4 as PrintTier, weight: rates[4] },
    { value: 5 as PrintTier, weight: rates[5] },
    { value: 6 as PrintTier, weight: rates[6] },
  ]);
}

/** Standard print, or its variant one time in ten. */
function rollPrint(rng: Rng, tier: PrintTier): PrintId {
  const options = PRINTS_BY_TIER[tier];
  if (options.length === 1) return options[0];
  return rng.next() * 100 < VARIANT_CHANCE ? options[1] : options[0];
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
    const tier = rollTier(rng, pack.rates);
    if (pack.contents === "cosmetics") {
      pulls.push({ kind: "cosmetic", category: rollCategory(rng, tier), tier });
      continue;
    }
    if (cardPool.length === 0) throw new Error("Cannot open a card pack with an empty pool");
    const cardId = cardPool[Math.floor(rng.next() * cardPool.length)];
    pulls.push({ kind: "card", cardId, print: rollPrint(rng, tier), tier });
  }

  return { pack: packId, pulls, seed };
}

/** The real odds of a print once the variant roll is folded in, in percent. */
export function effectiveRate(print: PrintId, rates: RateTable): number {
  for (const tier of [3, 4, 5, 6] as PrintTier[]) {
    const list = PRINTS_BY_TIER[tier];
    const at = list.indexOf(print);
    if (at < 0) continue;
    if (list.length === 1) return rates[tier];
    return (rates[tier] * (at === 1 ? VARIANT_CHANCE : 100 - VARIANT_CHANCE)) / 100;
  }
  return 0;
}
