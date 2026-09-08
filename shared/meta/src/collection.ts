import type { PrintId } from "./prints";
import { PRINTS, PRINT_INFO, printKey, printRank } from "./prints";
import { DUPLICATE_VALUE } from "./economy";

/**
 * What a player owns.
 *
 * Keyed by card and print together, because owning Luffy in Base and Luffy in
 * Secret is owning two different objects. The number is how many copies of that
 * exact print are held: one means no spares yet.
 *
 * Deliberately a plain object so it can be stored, sent over a socket or
 * written to a row without a translation step.
 */
export type Collection = Record<string, number>;

export interface OwnedEntry {
  cardId: string;
  print: PrintId;
  count: number;
}

export const EMPTY_COLLECTION: Collection = {};

export function countOf(collection: Collection, cardId: string, print: PrintId): number {
  return collection[printKey(cardId, print)] ?? 0;
}

export function owns(collection: Collection, cardId: string, print: PrintId): boolean {
  return countOf(collection, cardId, print) > 0;
}

/** Copies beyond the first. These are what can be dusted, sold or traded. */
export function sparesOf(collection: Collection, cardId: string, print: PrintId): number {
  return Math.max(0, countOf(collection, cardId, print) - 1);
}

/** Adds one pull. Says whether it was the first of that print, for the opening. */
export function addPull(
  collection: Collection,
  cardId: string,
  print: PrintId,
): { collection: Collection; isNew: boolean } {
  const key = printKey(cardId, print);
  const before = collection[key] ?? 0;
  return {
    collection: { ...collection, [key]: before + 1 },
    isNew: before === 0,
  };
}

/** Every print of one card that is owned, best first. */
export function printsOwnedOf(collection: Collection, cardId: string): OwnedEntry[] {
  return PRINTS.filter(print => owns(collection, cardId, print))
    .map(print => ({ cardId, print, count: countOf(collection, cardId, print) }))
    .sort((a, b) => printRank(b.print) - printRank(a.print));
}

/** The print a card should be shown and played as, unless the player picks another. */
export function bestPrintOf(collection: Collection, cardId: string): PrintId | null {
  return printsOwnedOf(collection, cardId)[0]?.print ?? null;
}

/**
 * Removes spares of one print. Never touches the last copy: a player cannot
 * accidentally scrap the only one they have.
 */
export function removeSpares(
  collection: Collection,
  cardId: string,
  print: PrintId,
  amount: number,
): { collection: Collection; removed: number } {
  const available = sparesOf(collection, cardId, print);
  const removed = Math.max(0, Math.min(amount, available));
  if (removed === 0) return { collection, removed: 0 };
  const key = printKey(cardId, print);
  return {
    collection: { ...collection, [key]: collection[key] - removed },
    removed,
  };
}

export type SpareAction = "dust" | "sell";

/** Scraps spares for Stardust, or sells them for Berries. */
export function scrapSpares(
  collection: Collection,
  cardId: string,
  print: PrintId,
  amount: number,
  action: SpareAction,
): { collection: Collection; removed: number; gained: number } {
  const { collection: next, removed } = removeSpares(collection, cardId, print, amount);
  const rate = action === "dust"
    ? DUPLICATE_VALUE[print].stardust
    : DUPLICATE_VALUE[print].berries;
  return { collection: next, removed, gained: removed * rate };
}

/** What the whole pile of spares is worth, if it were all scrapped at once. */
export function valueOfAllSpares(collection: Collection): { stardust: number; berries: number } {
  let stardust = 0;
  let berries = 0;
  for (const entry of entriesOf(collection)) {
    const spares = entry.count - 1;
    if (spares <= 0) continue;
    stardust += spares * DUPLICATE_VALUE[entry.print].stardust;
    berries += spares * DUPLICATE_VALUE[entry.print].berries;
  }
  return { stardust, berries };
}

/** Every held print, best first, skipping anything that has fallen to zero. */
export function entriesOf(collection: Collection): OwnedEntry[] {
  const out: OwnedEntry[] = [];
  for (const [key, count] of Object.entries(collection)) {
    if (count <= 0) continue;
    const at = key.lastIndexOf(":");
    if (at < 0) continue;
    const print = key.slice(at + 1) as PrintId;
    if (!PRINTS.includes(print)) continue;
    out.push({ cardId: key.slice(0, at), print, count });
  }
  return out.sort((a, b) => printRank(b.print) - printRank(a.print) || a.cardId.localeCompare(b.cardId));
}

export interface CollectionStats {
  /** Distinct cards held in any print. */
  cardsOwned: number;
  cardsTotal: number;
  /** Distinct card-and-print combinations held. */
  printsOwned: number;
  printsTotal: number;
  /** Every copy, spares included. */
  copiesHeld: number;
  spares: number;
  /** Held prints as a fraction of every print that exists, 0 to 1. */
  completion: number;
  /** How many of each print are held, for the binder header. */
  byPrint: Record<PrintId, number>;
}

export function statsFor(collection: Collection, pool: readonly string[]): CollectionStats {
  const byPrint = Object.fromEntries(PRINTS.map(p => [p, 0])) as Record<PrintId, number>;
  const cards = new Set<string>();
  let printsOwned = 0;
  let copiesHeld = 0;
  let spares = 0;

  for (const entry of entriesOf(collection)) {
    // A card that has left the pool should not count toward completion
    if (!pool.includes(entry.cardId)) continue;
    cards.add(entry.cardId);
    printsOwned += 1;
    copiesHeld += entry.count;
    spares += entry.count - 1;
    byPrint[entry.print] += 1;
  }

  const printsTotal = pool.length * PRINTS.length;
  return {
    cardsOwned: cards.size,
    cardsTotal: pool.length,
    printsOwned,
    printsTotal,
    copiesHeld,
    spares,
    completion: printsTotal === 0 ? 0 : printsOwned / printsTotal,
    byPrint,
  };
}

// ── Decks ────────────────────────────────────────────────────────────────────
// Deck shape is a placeholder until the One Piece ruleset is settled: it copies
// the draft the current engine uses, one leader and twelve cards. Everything
// that reads a deck goes through these rules rather than hard coding the number.

export const DECK_RULES = {
  leaders: 1,
  cards: 12,
  /** How many copies of the same card a deck may hold, prints aside. */
  maxCopiesOfACard: 1,
} as const;

export interface Deck {
  id: string;
  name: string;
  /** Card id, or null while the slot is still empty. */
  leaderId: string | null;
  /** Card ids, in the order they were added. */
  cardIds: string[];
  /** Which print to show for a card, when more than one is held. */
  prints: Record<string, PrintId>;
  updatedAt: number;
}

export function emptyDeck(id: string, name: string): Deck {
  return { id, name, leaderId: null, cardIds: [], prints: {}, updatedAt: Date.now() };
}

export function deckIsComplete(deck: Deck): boolean {
  return deck.leaderId !== null && deck.cardIds.length === DECK_RULES.cards;
}

export type DeckProblem =
  | { kind: "noLeader" }
  | { kind: "wrongSize"; have: number; want: number }
  | { kind: "duplicate"; cardId: string }
  | { kind: "notOwned"; cardId: string };

/** Everything wrong with a deck, so the builder can say so rather than just refusing. */
export function deckProblems(deck: Deck, collection: Collection): DeckProblem[] {
  const problems: DeckProblem[] = [];
  if (!deck.leaderId) problems.push({ kind: "noLeader" });
  if (deck.cardIds.length !== DECK_RULES.cards) {
    problems.push({ kind: "wrongSize", have: deck.cardIds.length, want: DECK_RULES.cards });
  }

  const seen = new Map<string, number>();
  for (const id of deck.cardIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const [cardId, times] of seen) {
    if (times > DECK_RULES.maxCopiesOfACard) problems.push({ kind: "duplicate", cardId });
  }

  for (const cardId of [deck.leaderId, ...deck.cardIds]) {
    if (cardId && bestPrintOf(collection, cardId) === null) {
      problems.push({ kind: "notOwned", cardId });
    }
  }
  return problems;
}

export function describeProblem(problem: DeckProblem, nameOf: (id: string) => string): string {
  switch (problem.kind) {
    case "noLeader":
      return "Pick a leader";
    case "wrongSize":
      return problem.have < problem.want
        ? `Add ${problem.want - problem.have} more card${problem.want - problem.have === 1 ? "" : "s"}`
        : `Remove ${problem.have - problem.want} card${problem.have - problem.want === 1 ? "" : "s"}`;
    case "duplicate":
      return `${nameOf(problem.cardId)} is in the deck more than once`;
    case "notOwned":
      return `${nameOf(problem.cardId)} is not in your collection`;
  }
}

/** The print a deck will show for a card: the chosen one, else the best held. */
export function printForDeck(deck: Deck, collection: Collection, cardId: string): PrintId | null {
  const picked = deck.prints[cardId];
  if (picked && owns(collection, cardId, picked)) return picked;
  return bestPrintOf(collection, cardId);
}

/** Sorts card ids the way a binder should read: best print first, then by name. */
export function binderOrder(
  collection: Collection,
  pool: readonly string[],
  nameOf: (id: string) => string,
): string[] {
  return [...pool].sort((a, b) => {
    const pa = bestPrintOf(collection, a);
    const pb = bestPrintOf(collection, b);
    const ra = pa ? printRank(pa) : -1;
    const rb = pb ? printRank(pb) : -1;
    if (ra !== rb) return rb - ra;
    return nameOf(a).localeCompare(nameOf(b));
  });
}

/** Tier of the best print held, for filtering. Null when the card is missing. */
export function bestTierOf(collection: Collection, cardId: string): number | null {
  const print = bestPrintOf(collection, cardId);
  return print ? PRINT_INFO[print].tier : null;
}
