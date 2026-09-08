import type { PrintId } from "./prints";

// Two currencies with one job each. Berries buy chances, Stardust buys
// certainty. Nothing here is spent on power, only on how things look.

export type Currency = "berries" | "stardust";

export interface DuplicateValue {
  /** Stardust from scrapping a spare. */
  stardust: number;
  /** Berries from selling one. */
  berries: number;
}

export const DUPLICATE_VALUE: Record<PrintId, DuplicateValue> = {
  base:       { stardust: 5,     berries: 5     },
  foil:       { stardust: 25,    berries: 20    },
  altArt:     { stardust: 100,   berries: 90    },
  blackLabel: { stardust: 250,   berries: 220   },
  secret:     { stardust: 400,   berries: 400   },
  signed:     { stardust: 1000,  berries: 1000  },
};

/**
 * What Stardust can be spent on. Only the plain alt art has a price: the moment
 * a print costs a number it stops being a chase and becomes a grind.
 */
export const CRAFTABLE: Partial<Record<PrintId, number>> = {
  altArt: 1500,
};

export function craftCost(print: PrintId): number | null {
  return CRAFTABLE[print] ?? null;
}

export function isCraftable(print: PrintId): boolean {
  return craftCost(print) !== null;
}

// ── Match payouts ────────────────────────────────────────────────────────────

export const PAYOUT = {
  /** Paid to both players for finishing. */
  finish: 40,
  /** On top of the finish payout, for the winner. */
  winBonus: 110,
  /** Once a day, on the first win. */
  firstWinOfDay: 150,
} as const;

export function berriesForMatch(won: boolean, isFirstWinOfDay = false): number {
  let total = PAYOUT.finish;
  if (won) total += PAYOUT.winBonus;
  if (won && isFirstWinOfDay) total += PAYOUT.firstWinOfDay;
  return total;
}

// ── Ledger ───────────────────────────────────────────────────────────────────
// Every movement is written down. Without a log the first question anyone asks
// about a missing balance is unanswerable.

export type LedgerReason =
  | "matchReward" | "packPurchase" | "packReward"
  | "duplicateSold" | "duplicateDusted" | "craft" | "trade";

export interface LedgerEntry {
  currency: Currency;
  /** Positive for income, negative for spending. */
  amount: number;
  reason: LedgerReason;
  /** Free-form detail, such as which print was dusted. */
  note?: string;
  at: number;
}

export interface Wallet {
  berries: number;
  stardust: number;
}

export const EMPTY_WALLET: Wallet = { berries: 0, stardust: 0 };

export function canAfford(wallet: Wallet, currency: Currency, amount: number): boolean {
  return wallet[currency] >= amount;
}

/** Applies a movement, refusing anything that would push a balance negative. */
export function applyToWallet(wallet: Wallet, currency: Currency, amount: number): Wallet {
  const next = wallet[currency] + amount;
  if (next < 0) throw new Error(`Not enough ${currency}`);
  return { ...wallet, [currency]: next };
}
