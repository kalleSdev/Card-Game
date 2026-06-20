import { useState } from "react";
import type { CardDef } from "@cg/contracts";
import { rc, rg } from "../helpers";

// ─────────────────────────────────────────────────────────────────────────────
// CARD IMAGE SETTINGS — edit these two lines when your files use a
// different format.  Supported values: "png" | "jpg" | "jpeg" | "webp" | "avif"
//
//   CARD_EXT        — extension used for every character image
//                     e.g. "jpg"  →  /cards/gojo-base.jpg
//
//   CARD_BACK_EXT   — extension used for the single card-back image
//                     e.g. "png"  →  /cards/card-back.png
//
// You can also use DIFFERENT extensions per card by editing the
// `src={cardImageSrc(defId)}` call further down in CharacterCard.
// ─────────────────────────────────────────────────────────────────────────────
const CARD_EXT      = "PNG";   // ← change this for character art
const CARD_BACK_EXT = "JPG";   // ← change this for the back design image

const cardImageSrc     = (defId: string) => `/cards/${defId}.${CARD_EXT}`;
const cardBackImageSrc = ()              => `/cards/card-back.${CARD_BACK_EXT}`;

// Preload card-back at module init so it's in browser cache before any CardBack mounts.
// This eliminates the flash of the fallback pattern on first render.
const _preload = new Image();
_preload.src = cardBackImageSrc();

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

const DIMS: Record<CardSize, { w: number; h: number; nameFontSize: number; ptsFontSize: number; rarityFontSize: number }> = {
  xs: { w: 72,   h: 102, nameFontSize: 9,  ptsFontSize: 9,  rarityFontSize: 8  },
  sm: { w: 96,   h: 136, nameFontSize: 10, ptsFontSize: 10, rarityFontSize: 9  },
  md: { w: 128,  h: 182, nameFontSize: 12, ptsFontSize: 11, rarityFontSize: 10 },
  lg: { w: 168,  h: 238, nameFontSize: 14, ptsFontSize: 13, rarityFontSize: 11 },
  xl: { w: 210,  h: 294, nameFontSize: 16, ptsFontSize: 14, rarityFontSize: 12 },
};

// Affinity icon shown on the card
const AFFINITY_ICON: Record<string, string> = {
  LEADER:  "👑",
  COMBAT:  "💥",
  SUPPORT: "✨",
};

interface CharacterCardProps {
  defId: string;
  def: CardDef | undefined;
  size?: CardSize;
  selected?: boolean;
  dimmed?: boolean;
  /** Show a golden "equipped" tag on the card */
  equippedBonus?: number;
  /** Faint overlay text e.g. "EQUIPPED" */
  overlay?: string;
}

export default function CharacterCard({
  defId, def, size = "md", selected = false, dimmed = false,
  equippedBonus, overlay,
}: CharacterCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const d = DIMS[size];
  const color  = def ? rc(def.rarity) : "#333";
  const glowShadow = def ? rg(def.rarity) : "none";

  const borderColor = selected ? "#ffd700" : `${color}99`;
  const boxShadow   = selected
    ? `0 0 0 2px #ffd70066, 0 0 20px #ffd70033, ${glowShadow}`
    : glowShadow !== "none"
      ? glowShadow
      : `0 4px 14px #00000088`;

  return (
    <div
      style={{
        width: d.w, height: d.h,
        borderRadius: 10,
        border: `2px solid ${borderColor}`,
        background: "#0a0a18",
        overflow: "hidden",
        boxShadow,
        opacity: dimmed ? 0.45 : 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        transition: "box-shadow 0.15s, border-color 0.15s, opacity 0.15s",
        flexShrink: 0,
      }}
    >
      {/* ── Art area (top ~72%) — increase to show more art, info strip at bottom ── */}
      <div style={{ height: "72%", position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {!imgFailed ? (
          <img
            src={cardImageSrc(defId)}
            alt={def?.name ?? defId}
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
          />
        ) : (
          /* Fallback art — rarity gradient + initial */
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(160deg, ${color}28 0%, #08081a 80%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: d.w * 0.38,
              fontWeight: 900,
              color: color,
              opacity: 0.18,
              userSelect: "none",
              lineHeight: 1,
            }}>
              {def?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}

        {/* Gradient fade into info area — only the bottom ~25% */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "28%",
          background: "linear-gradient(transparent, #0a0a18ee)",
          pointerEvents: "none",
        }} />

        {/* Rarity badge — top-left */}
        <div style={{
          position: "absolute", top: 5, left: 5,
          fontSize: d.rarityFontSize, fontWeight: "bold", color,
          background: "#000000aa",
          borderRadius: 4, padding: "2px 5px",
          letterSpacing: 1,
          border: `1px solid ${color}55`,
          backdropFilter: "blur(4px)",
        }}>
          {def?.rarity ?? "?"}
        </div>

        {/* Affinity icon — top-right */}
        {def?.affinity && (
          <div style={{
            position: "absolute", top: 5, right: 5,
            fontSize: d.rarityFontSize + 1,
            background: "#000000aa",
            borderRadius: 4, padding: "2px 4px",
            backdropFilter: "blur(4px)",
          }}>
            {AFFINITY_ICON[def.affinity] ?? ""}
          </div>
        )}

        {/* Rarity color strip at very top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: color,
          opacity: 0.8,
        }} />
      </div>

      {/* ── Info area (bottom ~38%) ── */}
      <div style={{
        flex: 1,
        padding: size === "xs" ? "2px 5px" : "4px 7px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(180deg, #0a0a18 0%, #070710 100%)",
        overflow: "hidden",
      }}>
        <div style={{
          fontSize: d.nameFontSize,
          fontWeight: "bold",
          color: "#e8e8e8",
          lineHeight: 1.25,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {def?.name ?? "Unknown"}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: d.rarityFontSize, color: "#444", letterSpacing: 1 }}>
            {def?.affinity ?? ""}
          </span>
          <span style={{ fontSize: d.ptsFontSize, color, fontWeight: "bold" }}>
            {def?.basePoints?.toLocaleString() ?? ""}
          </span>
        </div>

        {/* Weapon bonus row */}
        {equippedBonus !== undefined && (
          <div style={{ fontSize: d.rarityFontSize, color: "#44cc44", fontWeight: "bold" }}>
            ⚔ +{equippedBonus.toLocaleString()}
          </div>
        )}
      </div>

      {/* Selected gold ring */}
      {selected && (
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: 10,
          border: "2px solid #ffd70066",
          pointerEvents: "none",
        }} />
      )}

      {/* Generic overlay text */}
      {overlay && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10,
          background: "#00000055",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{
            fontSize: d.nameFontSize,
            fontWeight: "bold",
            color: "#ffd700",
            letterSpacing: 2,
            textTransform: "uppercase",
            textShadow: "0 0 8px #ffd700",
          }}>
            {overlay}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Mystery card (face-down) ────────────────────────────────────────────────
// shownRarity  — rate revealed by RATE spell (real rarity + role shown as overlay)
// shownRole    — affinity revealed alongside RATE spell (LEADER/COMBAT/SUPPORT)
export function CardBack({ size = "md", shownRarity, shownRole }: { size?: CardSize; shownRarity?: string; shownRole?: string }) {
  const [backImgFailed, setBackImgFailed] = useState(false);
  const d = DIMS[size];
  const color = shownRarity ? rc(shownRarity) : "#1e1e40";

  const ROLE_ICON: Record<string, string> = { LEADER: "👑", COMBAT: "💥", SUPPORT: "✨" };

  return (
    <div style={{
      width: d.w, height: d.h, borderRadius: 10,
      border: `2px solid ${color}66`,
      // Always use the striped fallback base (image layered on top)
      background: "repeating-linear-gradient(135deg, #0a0a1e 0px, #0a0a1e 6px, #0d0d2a 6px, #0d0d2a 12px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 4, overflow: "hidden", flexShrink: 0,
      position: "relative",
      boxShadow: shownRarity ? `0 0 12px ${color}44` : "0 4px 12px #00000066",
    }}>

      {/* Card-back image — always shown (unless image load failed) */}
      {!backImgFailed && (
        <img
          src={cardBackImageSrc()}
          alt="card back"
          onError={() => setBackImgFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
        />
      )}

      {/* Fallback when card-back.JPG not found */}
      {backImgFailed && (
        <>
          <div style={{ fontSize: d.w * 0.28, color: "#141430", fontWeight: "bold", lineHeight: 1, position: "relative", zIndex: 1 }}>呪</div>
          <div style={{ fontSize: d.rarityFontSize, color: "#1a1a38", letterSpacing: 3, position: "relative", zIndex: 1 }}>CURSED</div>
        </>
      )}

      {/* RATE overlay — translucent panel showing rarity + role on top of card-back */}
      {shownRarity && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          background: "rgba(0,0,0,0.55)",
          borderRadius: 8,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          <div style={{ fontSize: d.rarityFontSize, color: `${color}88`, letterSpacing: 2, fontWeight: "bold" }}>RATE</div>
          <div style={{
            fontSize: d.nameFontSize * 1.9, fontWeight: 900, color,
            letterSpacing: 2,
            textShadow: `0 0 14px ${color}aa`,
          }}>
            {shownRarity}
          </div>
          {shownRole && (
            <div style={{
              fontSize: d.rarityFontSize, color: `${color}cc`, letterSpacing: 1,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <span>{ROLE_ICON[shownRole] ?? ""}</span>
              <span>{shownRole}</span>
            </div>
          )}
        </div>
      )}

      {/* Top rarity strip */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.5, zIndex: 3 }} />
      {/* Bottom strip */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.3, zIndex: 3 }} />
    </div>
  );
}
