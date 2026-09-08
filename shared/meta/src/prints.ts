// A card and its print are different things. Every print of a card plays
// identically; they differ only in how the card looks on the board.

export type PrintTier = 3 | 4 | 5 | 6 | 7;

export const PRINTS = [
  "base",        // 3★ standard art
  "foil",        // 4★ shine and border over the same illustration
  "altArt",      // 5★ new illustration, breaks the card border
  "blackLabel",  // 5★ alt art restruck in monochrome on black, borderless
  "secret",      // 6★ alt art in the red manga treatment, plus VFX
  "signed",      // 6★ secret with a signature struck across it
  "holoOne",     // 7★ the same treatment struck in white, running rainbow
] as const;

export type PrintId = (typeof PRINTS)[number];

export interface PrintInfo {
  id: PrintId;
  tier: PrintTier;
  /** Shown to players. */
  name: string;
  /** For small cards, where the full label would wrap. */
  short: string;
  /** True for the one-in-ten variant of its tier. */
  isVariant: boolean;
}

export const PRINT_INFO: Record<PrintId, PrintInfo> = {
  base:       { id: "base",       tier: 3, name: "Base",        short: "Base",     isVariant: false },
  foil:       { id: "foil",       tier: 4, name: "Foil",        short: "Foil",     isVariant: false },
  altArt:     { id: "altArt",     tier: 5, name: "Alt Art",     short: "Alt Art",  isVariant: false },
  blackLabel: { id: "blackLabel", tier: 5, name: "Black Label", short: "B. Label", isVariant: true  },
  secret:     { id: "secret",     tier: 6, name: "Secret",      short: "Secret",   isVariant: false },
  signed:     { id: "signed",     tier: 6, name: "Signed",      short: "Signed",   isVariant: true  },
  holoOne:    { id: "holoOne",    tier: 7, name: "Holo One",    short: "Holo One", isVariant: false },
};

/** The standard and variant print for a tier, in that order. */
export const PRINTS_BY_TIER: Record<PrintTier, readonly PrintId[]> = {
  3: ["base"],
  4: ["foil"],
  5: ["altArt", "blackLabel"],
  6: ["secret", "signed"],
  7: ["holoOne"],
};

/** Identifies one card in one treatment. Everything you own is one of these. */
export interface OwnedPrint {
  cardId: string;
  print: PrintId;
  /** How many you hold. One means no duplicates yet. */
  count: number;
}

export function printKey(cardId: string, print: PrintId): string {
  return `${cardId}:${print}`;
}

export function parsePrintKey(key: string): { cardId: string; print: PrintId } | null {
  const at = key.lastIndexOf(":");
  if (at < 0) return null;
  const print = key.slice(at + 1) as PrintId;
  if (!PRINTS.includes(print)) return null;
  return { cardId: key.slice(0, at), print };
}

/** Ranks prints so a collection can show the best one first. */
export function printRank(print: PrintId): number {
  const info = PRINT_INFO[print];
  return info.tier * 2 + (info.isVariant ? 1 : 0);
}
