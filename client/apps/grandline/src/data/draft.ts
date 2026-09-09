import type { PlayerDraftResult } from "@cg/contracts";
import { POOL, cardAffinity, cardRarity } from "./pool";

/**
 * The draft, carried over from the old client.
 *
 * You take a leader first, then twelve cards: two combat, three support, and
 * seven of anything. Three options a pick, and nothing is ever offered twice.
 *
 * The rules are the same ones the JJK draft used, because they work and the
 * point of this pass is the board rather than the ruleset. What is new is that
 * they live in a data file instead of inside a screen, so the bot, a local
 * game and the server can all draft the same way later.
 */

export interface PickSpec {
  /** Null means anything goes. */
  affinity: "COMBAT" | "SUPPORT" | null;
  label: string;
}

export const LEADER_OPTIONS = 3;
export const OPTIONS_PER_PICK = 3;

export const PICK_SPECS: PickSpec[] = [
  { affinity: "COMBAT", label: "Combat" },
  { affinity: "COMBAT", label: "Combat" },
  { affinity: "SUPPORT", label: "Support" },
  { affinity: "SUPPORT", label: "Support" },
  { affinity: "SUPPORT", label: "Support" },
  { affinity: null, label: "Free pick" },
  { affinity: null, label: "Free pick" },
  { affinity: null, label: "Free pick" },
  { affinity: null, label: "Free pick" },
  { affinity: null, label: "Free pick" },
  { affinity: null, label: "Free pick" },
  { affinity: null, label: "Free pick" },
];

/** One leader and twelve cards, the same size a built deck is. */
export const DECK_CARDS = PICK_SPECS.length;

/** Leaders are the top two rarities, the way they always have been. */
export const LEADER_RARITIES = ["SSS", "X"];

function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function leaderOptions(): string[] {
  return shuffled(POOL.filter(id => LEADER_RARITIES.includes(cardRarity(id)))).slice(0, LEADER_OPTIONS);
}

/**
 * What a pick is allowed to offer: the right affinity, and nothing already
 * taken. A leader-affinity card is a normal card once somebody has a leader,
 * so free picks can offer them.
 */
export function pickOptions(index: number, taken: string[]): string[] {
  const spec = PICK_SPECS[index];
  const pool = POOL.filter(id => !taken.includes(id))
    .filter(id => (spec?.affinity ? cardAffinity(id) === spec.affinity : true));
  return shuffled(pool).slice(0, OPTIONS_PER_PICK);
}

/** An empty draft, ready to be filled in. */
export function emptyDraft(): PlayerDraftResult {
  return { leaderId: "", combatIds: [], supportIds: [], extraIds: [], weaponIds: [] };
}

/** Files a pick into the right list, the way the engine expects to read it. */
export function withPick(draft: PlayerDraftResult, index: number, cardId: string): PlayerDraftResult {
  const spec = PICK_SPECS[index];
  if (spec?.affinity === "COMBAT") return { ...draft, combatIds: [...draft.combatIds, cardId] };
  if (spec?.affinity === "SUPPORT") return { ...draft, supportIds: [...draft.supportIds, cardId] };
  return { ...draft, extraIds: [...draft.extraIds, cardId] };
}

export function draftedCards(draft: PlayerDraftResult): string[] {
  return [...draft.combatIds, ...draft.supportIds, ...draft.extraIds];
}

export function everythingTaken(draft: PlayerDraftResult): string[] {
  return [draft.leaderId, ...draftedCards(draft)].filter(Boolean);
}

/** A whole draft, played at random. What the computer brings to a match. */
export function randomDraft(): PlayerDraftResult {
  let draft = emptyDraft();
  draft = { ...draft, leaderId: leaderOptions()[0] ?? POOL[0] };
  for (let i = 0; i < PICK_SPECS.length; i++) {
    const options = pickOptions(i, everythingTaken(draft));
    if (options.length === 0) break;
    draft = withPick(draft, i, options[Math.floor(Math.random() * options.length)]);
  }
  return draft;
}

/** Turns a deck you built into the shape the engine drafts into. */
export function draftFromDeck(leaderId: string | null, cardIds: string[]): PlayerDraftResult {
  return {
    leaderId: leaderId ?? "",
    combatIds: cardIds.filter(id => cardAffinity(id) === "COMBAT"),
    supportIds: cardIds.filter(id => cardAffinity(id) === "SUPPORT"),
    extraIds: cardIds.filter(id => !["COMBAT", "SUPPORT"].includes(cardAffinity(id))),
    weaponIds: [],
  };
}
