import type { CardDef } from "@cg/contracts";
import { GRADE_POINTS, type Grade, type ScoreCard, type ScoreRole } from "./rules";

/**
 * Turning a card definition into a Score card.
 *
 * Score needs two things a card already implies: where it belongs, and what it
 * is worth. Both are read off the definition rather than written down twice, so
 * a new set drops in without a second table to keep in step.
 *
 * Points are spread across the grade's band by a stable hash of the card id, so
 * two Epics are rarely worth the same and the spread never moves between runs.
 * That is a placeholder with a real property — it is deterministic — and the
 * intention is that One Piece cards carry hand-set points once they exist.
 */

const ROLE_OF: Record<string, ScoreRole> = {
  LEADER: "captain",
  COMBAT: "combat",
  SUPPORT: "support",
};

/**
 * Rarity letters to grades. The top end is narrow on purpose: mythic is the
 * only grade a card cannot be common at, and it should stay something you are
 * pleased to turn over rather than something you expect.
 */
const GRADE_OF: Record<string, Grade> = {
  C: "common",
  B: "common",
  A: "rare",
  S: "rare",
  SS: "epic",
  SSS: "legendary",
  X: "mythic",
};

export function roleOf(def: CardDef): ScoreRole {
  return ROLE_OF[String(def.affinity)] ?? "combat";
}

export function gradeOf(def: CardDef): Grade {
  return GRADE_OF[String(def.rarity)] ?? "common";
}

/** Points inside the grade's band, decided by the id and nothing else. */
export function pointsFor(id: string, grade: Grade): number {
  const band = GRADE_POINTS[grade];
  const span = band.max - band.min + 1;
  return band.min + (hash(id) % span);
}

export function scoreCardOf(id: string, def: CardDef): ScoreCard {
  const grade = gradeOf(def);
  return { id, role: roleOf(def), grade, points: pointsFor(id, grade) };
}

export function scoreCardsFrom(cardDb: Record<string, CardDef>): ScoreCard[] {
  return Object.entries(cardDb)
    .map(([id, def]) => scoreCardOf(id, def))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** FNV-1a. Small, stable, and not trying to be anything else. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
