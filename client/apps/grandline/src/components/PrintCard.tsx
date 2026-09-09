import type { CSSProperties } from "react";
import type { PrintId } from "@cg/meta";
import { PRINT_INFO } from "@cg/meta";
import { CARD_COMPACT_MAX, CARD_SIZE } from "../design/tokens";
import "../design/card.css";

export interface CardFace {
  id: string;
  name: string;
  /** Used on small cards, where the full name would wrap. */
  shortName?: string;
  atk: number;
  hp: number;
  cost: number;
  /** The character's picture. Cards without one fall back to the drawn placeholder. */
  art?: string;
}

/**
 * Placeholder illustration until real art exists. The same card always gets the
 * same two colours, so a binder looks like a binder rather than noise.
 */
function artColors(id: string): { a: string; b: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    a: `hsl(${hue} 42% 26%)`,
    b: `hsl(${(hue + 40) % 360} 48% 12%)`,
  };
}

/**
 * Which prints run their picture to the card's edge, with the writing over it
 * rather than on a plate below it. Base and foil keep the plate.
 */
const BREAKING: Record<PrintId, boolean> = {
  base: false,
  foil: false,
  altArt: true,
  blackLabel: true,
  secret: true,
  holoOne: true,
};

/**
 * Which prints carry foiling. Base is the plain one by definition, and foil
 * already has its own treatment across the art.
 */
const FOILED: Record<PrintId, boolean> = {
  base: false,
  foil: false,
  altArt: true,
  blackLabel: true,
  secret: true,
  holoOne: true,
};

export default function PrintCard({
  card,
  print,
  width = CARD_SIZE.lg,
  count,
  duplicate = false,
  interactive = true,
  onClick,
}: {
  card: CardFace;
  print: PrintId;
  width?: number;
  /** Shown top right when you hold more than one. */
  count?: number;
  /** Dims the card, for a duplicate in a pack opening. */
  duplicate?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const info = PRINT_INFO[print];
  const art = artColors(card.id);
  const drawn = Boolean(card.art);
  // Small cards drop to short names and short print labels, so a row keeps one
  // baseline instead of stepping wherever a name happens to be long
  const compact = width <= CARD_COMPACT_MAX;

  const style = {
    "--pc-w": `${width}px`,
    "--pc-art-a": art.a,
    "--pc-art-b": art.b,
    "--pc-art-image": drawn ? `url("${card.art}")` : "none",
  } as CSSProperties;

  const classes = [
    "pc",
    `pc--${print}`,
    interactive ? "pc--interactive" : "",
    compact ? "pc--compact" : "",
    duplicate ? "pc--duplicate" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style} onClick={onClick}>
      {/* Star and name only. The tier number is dropped: it reads as a stat next
          to cost and attack, and the name already says which tier it is. */}
      <div className="pc__ribbon">
        {"★"} {compact ? info.short : info.name}
      </div>
      {count !== undefined && count > 1 && <div className="pc__count">{"×"}{count}</div>}

      <div className="pc__art">
        <div className="pc__art-fill" />
        {/* The drawn sun and horizon are the stand-in for a card with no
            picture yet. A card that has one gets the picture instead. */}
        {!drawn && <div className="pc__sun" />}
        {!drawn && <div className="pc__horizon" />}
        {print === "holoOne" && <div className="pc__hue" />}
      </div>

      {FOILED[print] && <div className="pc__leaf" />}
      {/* The colour rule along the bottom edge, on the prints that break their
          border. The plain two draw nothing here. */}
      {BREAKING[print] && <div className="pc__band" />}

      <div className="pc__body">
        <div className="pc__name">{compact ? card.shortName ?? card.name : card.name}</div>
        <div className="pc__stats">
          <span>
            ATK <b>{card.atk}</b>
          </span>
          <span>
            HP <b>{card.hp}</b>
          </span>
          <span style={{ marginLeft: "auto" }}>
            <b>{card.cost}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
