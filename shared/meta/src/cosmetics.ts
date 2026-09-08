import type { PrintTier } from "./prints";
import { assertSumsTo100, pickWeighted, type Rng } from "./rng";

/**
 * Cosmetics.
 *
 * Deliberately small to begin with: a title, a banner and a border are things
 * that can exist before a single match has been designed. Finishers, kill
 * effects, arenas and emotes all need the modes settled first, because none of
 * them mean anything until there is a board for them to happen on. They get
 * added here when there is.
 *
 * Everything renders from a couple of colours rather than an image, so the set
 * can grow without waiting on art.
 */

export type CosmeticKind = "title" | "banner" | "border";

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  tier: PrintTier;
  /** Two colours. A banner runs between them; a border and title use the first. */
  colors: [string, string];
  /** True for the ones that move. Kept as a flag so the UI decides how. */
  animated?: boolean;
}

function def(
  id: string,
  kind: CosmeticKind,
  name: string,
  tier: PrintTier,
  colors: [string, string],
  animated = false,
): CosmeticDef {
  return { id, kind, name, tier, colors, animated };
}

export const COSMETICS: CosmeticDef[] = [
  // ── Titles ───────────────────────────────────────────────────────────────
  def("title.deckhand", "title", "Deckhand", 3, ["#8595A5", "#8595A5"]),
  def("title.stowaway", "title", "Stowaway", 3, ["#8595A5", "#8595A5"]),
  def("title.lookout", "title", "Lookout", 3, ["#8595A5", "#8595A5"]),
  def("title.navigator", "title", "Navigator", 4, ["#7B6BD9", "#7B6BD9"]),
  def("title.shipwright", "title", "Shipwright", 4, ["#7B6BD9", "#7B6BD9"]),
  def("title.quartermaster", "title", "Quartermaster", 4, ["#7B6BD9", "#7B6BD9"]),
  def("title.firstMate", "title", "First Mate", 5, ["#E0A93B", "#E0A93B"], true),
  def("title.captain", "title", "Captain", 5, ["#E0A93B", "#E0A93B"], true),
  def("title.corsair", "title", "Corsair", 5, ["#E0A93B", "#E0A93B"], true),
  def("title.warlord", "title", "Warlord", 6, ["#D6412F", "#FF6A4D"], true),
  def("title.legendOfTheLine", "title", "Legend of the Line", 6, ["#D6412F", "#FF6A4D"], true),

  // ── Banners ──────────────────────────────────────────────────────────────
  def("banner.harbour", "banner", "Harbour", 3, ["#16273A", "#0D1520"]),
  def("banner.lowTide", "banner", "Low Tide", 3, ["#1B2A2E", "#0D1520"]),
  def("banner.fog", "banner", "Fog", 3, ["#232C36", "#101720"]),
  def("banner.tradeWinds", "banner", "Trade Winds", 4, ["#1D3A4A", "#0E1B26"]),
  def("banner.reef", "banner", "Reef", 4, ["#12403A", "#0A1E1C"]),
  def("banner.squall", "banner", "Squall", 4, ["#2A2F52", "#12142A"]),
  def("banner.goldenHour", "banner", "Golden Hour", 5, ["#6B4A16", "#2A1B08"], true),
  def("banner.maelstrom", "banner", "Maelstrom", 5, ["#123A54", "#08161F"], true),
  def("banner.kraken", "banner", "Kraken", 5, ["#3A1650", "#150720"], true),
  def("banner.redLine", "banner", "Red Line", 6, ["#6B1810", "#1E0705"], true),
  def("banner.voidCentury", "banner", "Void Century", 6, ["#2A0E38", "#05060B"], true),

  // ── Borders ──────────────────────────────────────────────────────────────
  def("border.rope", "border", "Rope", 3, ["#5D6E7F", "#5D6E7F"]),
  def("border.iron", "border", "Iron", 3, ["#6E6A65", "#6E6A65"]),
  def("border.brass", "border", "Brass", 4, ["#A9713F", "#D9A441"]),
  def("border.verdigris", "border", "Verdigris", 4, ["#3FA46B", "#4FBFA8"]),
  def("border.gilded", "border", "Gilded", 5, ["#E0A93B", "#FFE9B0"], true),
  def("border.stormGlass", "border", "Storm Glass", 5, ["#3E8FA0", "#BFE9F2"], true),
  def("border.logPose", "border", "Log Pose", 6, ["#D6412F", "#FFD2B0"], true),
  def("border.signedSteel", "border", "Signed Steel", 6, ["#E8E2D4", "#FFFFFF"], true),
];

export const COSMETIC_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(
  COSMETICS.map(c => [c.id, c]),
);

export function cosmeticsOfTier(tier: PrintTier, kind?: CosmeticKind): CosmeticDef[] {
  return COSMETICS.filter(c => c.tier === tier && (kind === undefined || c.kind === kind));
}

// ── Odds ─────────────────────────────────────────────────────────────────────

/**
 * Cosmetic packs roll their own table, not the card one. Gold and diamond
 * cosmetic packs share it: a cosmetic pack is scarce because you get few of
 * them, not because its rates are worse.
 */
export const COSMETIC_RATES: Record<PrintTier, number> = {
  3: 77,
  4: 15,
  5: 6,
  6: 2,
  // No 7★ cosmetic exists yet. Holo One is a card print.
  7: 0,
};

assertSumsTo100("COSMETIC_RATES", Object.values(COSMETIC_RATES));

/**
 * What kind of thing a tier hands out. Berries only appear at the bottom, so a
 * common pull still moves you forward rather than being nothing.
 */
export const KIND_WEIGHTS: Record<PrintTier, Readonly<Partial<Record<CosmeticKind | "berries", number>>>> = {
  3: { berries: 40, title: 20, banner: 20, border: 20 },
  4: { title: 34, banner: 33, border: 33 },
  5: { title: 34, banner: 33, border: 33 },
  6: { title: 34, banner: 33, border: 33 },
  7: { title: 100 },
};

for (const [tier, weights] of Object.entries(KIND_WEIGHTS)) {
  assertSumsTo100(`KIND_WEIGHTS[${tier}]`, Object.values(weights) as number[]);
}

/** What a 3★ pull pays when it pays Berries rather than a cosmetic. */
export const BERRIES_PER_COMMON = { min: 15, max: 40 } as const;

export interface CosmeticRoll {
  tier: PrintTier;
  /** The cosmetic won, or null when the pull paid Berries instead. */
  cosmeticId: string | null;
  /** Set only when the pull paid Berries. */
  berries: number | null;
}

/** Rolls one cosmetic pull: a tier, then a kind, then a specific thing. */
export function rollCosmetic(rng: Rng): CosmeticRoll {
  const tier = pickWeighted(rng, ([3, 4, 5, 6, 7] as PrintTier[]).map(t => ({
    value: t,
    weight: COSMETIC_RATES[t],
  })));

  const weights = KIND_WEIGHTS[tier];
  const kind = pickWeighted(
    rng,
    (Object.entries(weights) as [CosmeticKind | "berries", number][]).map(([value, weight]) => ({
      value,
      weight,
    })),
  );

  if (kind === "berries") {
    const span = BERRIES_PER_COMMON.max - BERRIES_PER_COMMON.min;
    return {
      tier,
      cosmeticId: null,
      berries: BERRIES_PER_COMMON.min + Math.floor(rng.next() * (span + 1)),
    };
  }

  const options = cosmeticsOfTier(tier, kind);
  // A tier with nothing of that kind falls back to Berries rather than throwing:
  // a pack should never fail to open because the catalogue has a hole in it.
  if (options.length === 0) {
    return { tier, cosmeticId: null, berries: BERRIES_PER_COMMON.min };
  }
  return {
    tier,
    cosmeticId: options[Math.floor(rng.next() * options.length)].id,
    berries: null,
  };
}
