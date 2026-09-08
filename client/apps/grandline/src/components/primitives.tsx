import type { CSSProperties, ReactNode } from "react";
import type { PrintTier, RankId } from "@cg/meta";
import { COLOR, RADIUS, SPACE, TIER_COLOR, RANK_COLOR, MOTION, text } from "../design/tokens";

/** Text. Every string on screen goes through a role on the scale. */
export function Text({
  as: As = "div",
  role = "body",
  color = COLOR.foam,
  style,
  children,
}: {
  as?: "div" | "span" | "h1" | "h2" | "h3" | "h4" | "p" | "label";
  role?: Parameters<typeof text>[0];
  color?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <As style={{ ...text(role), color, ...style }}>{children}</As>
  );
}

/** A surface. Panels are flat with a hairline; only a lifted one gets a shadow. */
export function Panel({
  padding = SPACE.xl,
  lifted = false,
  style,
  children,
}: {
  padding?: number;
  lifted?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: COLOR.hull,
        border: `1px solid ${COLOR.rope}`,
        borderRadius: RADIUS.lg,
        padding,
        boxShadow: lifted ? "0 8px 28px rgba(0,0,0,0.45)" : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_TONE: Record<ButtonTone, { bg: string; border: string; fg: string }> = {
  primary:   { bg: COLOR.signal,             border: COLOR.signal,  fg: "#0B0507" },
  secondary: { bg: "rgba(62,143,160,0.10)",  border: COLOR.current, fg: COLOR.foam },
  ghost:     { bg: "transparent",            border: COLOR.rope,    fg: COLOR.mist },
  danger:    { bg: "rgba(214,65,47,0.10)",   border: "#7A2A22",     fg: "#E9857A" },
};

export function Button({
  tone = "secondary",
  size = "md",
  disabled = false,
  full = false,
  onClick,
  children,
}: {
  tone?: ButtonTone;
  size?: "sm" | "md";
  disabled?: boolean;
  full?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  // A disabled control drops its tone entirely rather than wearing a faded
  // version of it. A greyed out red button still reads as "danger, but broken".
  const t = disabled
    ? { bg: "transparent", border: COLOR.rope, fg: COLOR.fathom }
    : BUTTON_TONE[tone];
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...text(size === "sm" ? "small" : "body"),
        fontWeight: 600,
        padding: size === "sm" ? "6px 12px" : "9px 18px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: RADIUS.md,
        color: t.fg,
        width: full ? "100%" : undefined,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: `filter ${MOTION.quick}, transform ${MOTION.instant}`,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "translateY(1px)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "none"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.filter = "none"; }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(1.15)"; }}
    >
      {children}
    </button>
  );
}

/** A small labelled marker. Used for tiers, states and counts. */
export function Chip({
  color = COLOR.mist,
  border,
  children,
}: {
  color?: string;
  border?: string;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        ...text("label"),
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: RADIUS.sm,
        border: `1px solid ${border ?? COLOR.rope}`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function TierPip({ tier, size = 8 }: { tier: PrintTier; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: TIER_COLOR[tier],
        display: "inline-block",
        flex: "none",
      }}
    />
  );
}

/** Rank badge. The two leaderboard ranks carry a filled bar; the rest are outlines. */
export function RankBadge({ rank, label, mmr }: { rank: RankId; label: string; mmr?: number }) {
  const color = RANK_COLOR[rank];
  const isTop = rank === "emperor" || rank === "pirateKing";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px 5px 8px",
        borderRadius: RADIUS.sm,
        border: `1px solid ${isTop ? color : COLOR.rope}`,
        background: isTop ? `${color}1A` : "transparent",
      }}
    >
      <span style={{ width: 3, height: 14, borderRadius: 2, background: color, flex: "none" }} />
      <span style={{ ...text("label"), color }}>{label}</span>
      {mmr !== undefined && (
        <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>{mmr}</span>
      )}
    </span>
  );
}

/** Currency readout. Berries and Stardust never share a colour. */
export function Currency({
  kind,
  amount,
  size = "md",
}: {
  kind: "berries" | "stardust";
  amount: number;
  size?: "sm" | "md";
}) {
  const color = kind === "berries" ? COLOR.doubloon : COLOR.marine;
  const glyph = kind === "berries" ? "◈" : "✦";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ color, fontSize: size === "sm" ? 11 : 13, lineHeight: 1 }}>{glyph}</span>
      <span
        style={{
          ...text("data"),
          fontSize: size === "sm" ? 12 : 14,
          color: COLOR.foam,
        }}
      >
        {amount.toLocaleString()}
      </span>
    </span>
  );
}

/** A section heading with an optional right-hand slot. */
export function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: SPACE.lg,
        marginBottom: SPACE.lg,
      }}
    >
      <div>
        {eyebrow && (
          <div style={{ ...text("label"), color: COLOR.current, marginBottom: 6 }}>{eyebrow}</div>
        )}
        <Text as="h2" role="title">
          {title}
        </Text>
      </div>
      {right}
    </div>
  );
}

/** A labelled value, for stat rows. */
export function Stat({ label, value, color = COLOR.foam }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...text("label"), color: COLOR.fathom }}>{label}</span>
      <span style={{ ...text("data"), fontSize: 17, color }}>{value}</span>
    </div>
  );
}

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      style={{
        background: COLOR.rope,
        width: vertical ? 1 : "100%",
        height: vertical ? "auto" : 1,
        alignSelf: "stretch",
        flex: "none",
      }}
    />
  );
}
