import type { ReactNode } from "react";
import { COLOR, LAYOUT, MOTION, RADIUS, SPACE, text } from "../design/tokens";
import { Currency, RankBadge } from "./primitives";

export interface NavItem {
  id: string;
  label: string;
  /** Not built yet. Shown, but plainly marked. */
  soon?: boolean;
}

export const NAV: NavItem[] = [
  { id: "play", label: "Play", soon: true },
  { id: "collection", label: "Collection", soon: true },
  { id: "packs", label: "Packs", soon: true },
  { id: "shop", label: "Shop", soon: true },
  { id: "trade", label: "Trade", soon: true },
  { id: "ladder", label: "Ladder", soon: true },
  { id: "profile", label: "Profile", soon: true },
  { id: "design", label: "Design" },
];

/**
 * The frame every page sits in. A permanent left rail rather than tabs, because
 * there are nine destinations and hiding them behind a menu would be pretending
 * the app is smaller than it is.
 */
export default function Shell({
  active,
  onNavigate,
  children,
}: {
  active: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100%", position: "relative", zIndex: 1 }}>
      {/* ── Rail ── */}
      <nav
        style={{
          width: LAYOUT.railWidth,
          flex: "none",
          borderRight: `1px solid ${COLOR.rope}`,
          background: COLOR.hull,
          display: "flex",
          flexDirection: "column",
          padding: `${SPACE.xl}px ${SPACE.md}px`,
          gap: SPACE.xl,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: `0 ${SPACE.sm}px` }}>
          <div
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 900,
              fontSize: 21,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: COLOR.foam,
            }}
          >
            Grand Line
          </div>
          <div style={{ ...text("label"), color: COLOR.fathom, marginTop: 6 }}>Card Game</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(item => {
            const on = item.id === active;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  ...text("body"),
                  fontWeight: on ? 600 : 500,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.sm,
                  padding: "9px 10px",
                  borderRadius: RADIUS.md,
                  border: "1px solid transparent",
                  background: on ? COLOR.swell : "transparent",
                  color: on ? COLOR.foam : COLOR.mist,
                  transition: `background ${MOTION.quick}, color ${MOTION.quick}`,
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(27,40,58,0.5)"; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <span
                  style={{
                    width: 2,
                    height: 15,
                    borderRadius: 2,
                    background: on ? COLOR.signal : "transparent",
                    flex: "none",
                  }}
                />
                {item.label}
                {item.soon && (
                  <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom, marginLeft: "auto" }}>
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", padding: `0 ${SPACE.sm}px` }}>
          <div style={{ ...text("small"), color: COLOR.fathom }}>
            Design draft. Screens arrive in build order.
          </div>
        </div>
      </nav>

      {/* ── Page ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: LAYOUT.topBarHeight,
            flex: "none",
            borderBottom: `1px solid ${COLOR.rope}`,
            background: "rgba(13,21,32,0.72)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            gap: SPACE.lg,
            padding: `0 ${SPACE.xl}px`,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <RankBadge rank="diamond" label="Diamond" mmr={194} />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: SPACE.lg }}>
            <Currency kind="berries" amount={1240} />
            <Currency kind="stardust" amount={860} />
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: RADIUS.sm,
                background: "linear-gradient(150deg, #2A3B52, #101A26)",
                border: `1px solid ${COLOR.doubloon}`,
              }}
            />
          </div>
        </header>

        <main style={{ flex: 1, padding: `${SPACE.xxl}px ${SPACE.xl}px ${SPACE.xxxl}px` }}>
          <div style={{ maxWidth: LAYOUT.contentWidth, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
