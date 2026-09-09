import type { CSSProperties } from "react";
import type { Grade, ScoreCard as ScoreCardDef } from "@cg/score";
import { CARD_COMPACT_MAX, CARD_SIZE } from "../design/tokens";
import "../design/scorecard.css";

/**
 * The Score Battle face of a card.
 *
 * The same characters as the collection, drawn a second way for one game mode.
 * Everything the collection card carries to say how it plays is gone — no print
 * name, no attack, no health, no cost — because none of it means anything here.
 * What is left is a star with no label beside it, the character, and the points.
 *
 * The collection card is untouched by any of this. Two faces, one character, and
 * the mode decides which one you are looking at.
 */

/** One colour per grade. This is the whole grading system on a Score card. */
export const GRADE_TONE: Record<Grade, { tone: string; edge: string; inner: string }> = {
  common: { tone: "#8595A5", edge: "#2B3947", inner: "rgba(133,149,165,0.22)" },
  rare: { tone: "#3E8FA0", edge: "#2A4E58", inner: "rgba(62,143,160,0.28)" },
  epic: { tone: "#9A8BEF", edge: "#3D3670", inner: "rgba(154,139,239,0.32)" },
  legendary: { tone: "#E0A93B", edge: "#6B5220", inner: "rgba(224,169,59,0.34)" },
  mythic: { tone: "#FF8AD6", edge: "#7A2C63", inner: "rgba(255,138,214,0.34)" },
};

export const GRADE_LABEL: Record<Grade, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

/** Which grades catch light. The plain two are plain on purpose. */
const TREATED: Record<Grade, boolean> = {
  common: false,
  rare: false,
  epic: true,
  legendary: true,
  mythic: true,
};

/** The art, keyed off the id, so a character looks like itself in both modes. */
function artColors(id: string): { a: string; b: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    a: `hsl(${hue} 42% 26%)`,
    b: `hsl(${(hue + 40) % 360} 48% 12%)`,
  };
}

export default function ScoreCard({
  card,
  name,
  width = CARD_SIZE.md,
  selected = false,
  spent = false,
  interactive = false,
  onClick,
}: {
  card: ScoreCardDef;
  /** The character's name. Everything else on the card comes from the card. */
  name: string;
  width?: number;
  selected?: boolean;
  /** Taken, denied, or otherwise out of play. */
  spent?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const art = artColors(card.id);
  const grade = GRADE_TONE[card.grade];
  const compact = width <= CARD_COMPACT_MAX;

  const style = {
    "--sc-w": `${width}px`,
    "--sc-art-a": art.a,
    "--sc-art-b": art.b,
    "--sc-tone": grade.tone,
    "--sc-edge": grade.edge,
    "--sc-inner": grade.inner,
  } as CSSProperties;

  const classes = [
    "sc",
    `sc--${card.grade}`,
    compact ? "sc--compact" : "",
    interactive ? "sc--interactive" : "",
    selected ? "sc--selected" : "",
    spent ? "sc--spent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style} onClick={onClick}>
      {/* A star, and deliberately nothing written next to it */}
      <div className="sc__star">★</div>

      <div className="sc__art">
        <div className="sc__art-fill" />
        <div className="sc__sun" />
        <div className="sc__horizon" />
        <div className="sc__band" />
      </div>

      {TREATED[card.grade] && <div className="sc__leaf" />}

      <div className="sc__body">
        <div className="sc__name">{name}</div>
        <div className="sc__line">
          <span className="sc__value">{card.points}</span>
        </div>
      </div>
    </div>
  );
}
