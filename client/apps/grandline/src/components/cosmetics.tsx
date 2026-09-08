import type { CSSProperties } from "react";
import { COSMETIC_BY_ID, type CosmeticDef } from "@cg/meta";
import { COLOR, RADIUS, TIER_COLOR, text } from "../design/tokens";

/**
 * Cosmetics, drawn.
 *
 * Every one of these renders from the two colours on its definition rather than
 * an image, so the catalogue can grow before any art exists and a new banner is
 * a row in a table rather than a file.
 */

export function cosmeticOf(id: string | null | undefined): CosmeticDef | null {
  return id ? COSMETIC_BY_ID[id] ?? null : null;
}

/** The strip behind a name. */
export function Banner({
  id, height = 76, radius = RADIUS.lg, children,
}: {
  id: string | null;
  height?: number;
  radius?: number;
  children?: React.ReactNode;
}) {
  const def = cosmeticOf(id);
  const [a, b] = def?.colors ?? ["#16273A", "#0D1520"];
  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: radius,
        overflow: "hidden",
        border: `1px solid ${COLOR.rope}`,
        background: `linear-gradient(104deg, ${a}, ${b})`,
      }}
    >
      {/* A sheen for the ones that move, so a 5★ banner is not just two colours */}
      {def?.animated && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(104deg, transparent 30%, ${a}88 48%, transparent 66%)`,
            mixBlendMode: "screen",
          }}
        />
      )}
      {children}
    </div>
  );
}

/** The ring around an icon. */
export function BorderRing({
  id, size, children,
}: {
  id: string | null;
  size: number;
  children?: React.ReactNode;
}) {
  const def = cosmeticOf(id);
  const [a, b] = def?.colors ?? [COLOR.rope, COLOR.rope];
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: RADIUS.md,
    padding: 2,
    background: def ? `linear-gradient(140deg, ${a}, ${b})` : COLOR.rope,
    flex: "none",
  };
  return (
    <div style={style}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: RADIUS.md - 2,
          overflow: "hidden",
          background: COLOR.deck,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A worn title, in its own colour. */
export function Title({ id, size = 11 }: { id: string | null; size?: number }) {
  const def = cosmeticOf(id);
  if (!def) return null;
  const [a, b] = def.colors;
  return (
    <span
      style={{
        ...text("label"),
        fontSize: size,
        background: a === b ? undefined : `linear-gradient(96deg, ${a}, ${b})`,
        WebkitBackgroundClip: a === b ? undefined : "text",
        WebkitTextFillColor: a === b ? undefined : "transparent",
        color: a === b ? a : undefined,
      }}
    >
      {def.name}
    </span>
  );
}

/** A cosmetic as a thing you can pick, for the wardrobe and the pack opening. */
export function CosmeticTile({
  def, selected, owned = true, onClick,
}: {
  def: CosmeticDef;
  selected?: boolean;
  owned?: boolean;
  onClick?: () => void;
}) {
  const [a, b] = def.colors;
  return (
    <button
      onClick={onClick}
      disabled={!owned}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        width: 150,
        textAlign: "left",
        borderRadius: RADIUS.md,
        border: `1px solid ${selected ? COLOR.current : COLOR.rope}`,
        background: selected ? "rgba(62,143,160,0.1)" : COLOR.hull,
        opacity: owned ? 1 : 0.35,
        cursor: owned ? "pointer" : "not-allowed",
      }}
    >
      <div
        style={{
          height: def.kind === "banner" ? 40 : 26,
          borderRadius: RADIUS.sm,
          background:
            def.kind === "border"
              ? `linear-gradient(140deg, ${a}, ${b})`
              : `linear-gradient(104deg, ${a}, ${b})`,
          border: def.kind === "title" ? `1px solid ${COLOR.rope}` : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {def.kind === "title" && (
          <span
            style={{
              ...text("label"),
              fontSize: 10,
              color: COLOR.abyss,
              padding: "0 6px",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {def.name}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: TIER_COLOR[def.tier], flex: "none",
          }}
        />
        <span style={{ ...text("small"), fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {def.name}
        </span>
      </div>
    </button>
  );
}
