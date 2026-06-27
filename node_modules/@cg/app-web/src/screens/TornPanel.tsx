import type { CSSProperties, ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Torn-paper panel — organic P5 ripped edges
//
// Design rules:
//   • Tooth depths vary wildly: 0-2% valleys beside 36-44% peaks
//   • x-spacing is irregular: tight 2-4 units (steep cuts) vs wide 10-15 units
//   • addRegionalDiagonal: piecewise-linear envelope makes each 20% section
//     lean a different direction — genuinely organic, not a regular wave
//   • SVG overlay drawn OUTSIDE clip: thick black line art on torn edges
//   • Outer wrapper is transparent — outside rips = see-through
// ─────────────────────────────────────────────────────────────────────────────

// [x, y] — x: 0–100, y: depth into panel (% of panel height)
// High contrast: 0-2 valleys between 36-44 peaks

// Depths intentionally varied: small (5-10%), medium (16-24%), large (32-40%)
// Rhythm: small→small→medium→large→small→medium→small→large creates a natural feel
// The tear cuts through the card in places but leaves most of it visible
const FULL_TOP_RAW: [number, number][] = [
  [  0,  6], [  2,  0], [  5, 10], [  7,  1],   // small opening pair
  [ 12, 22], [ 14,  0],                           // medium cut
  [ 20, 38], [ 23,  2],                           // large dramatic cut
  [ 27,  7], [ 29,  0], [ 32,  5], [ 34,  1],    // two small cuts
  [ 40, 18], [ 42,  0],                           // medium
  [ 47, 34], [ 50,  2], [ 53,  8], [ 55,  0],    // large then small
  [ 59, 14], [ 61,  1],                           // medium
  [ 66, 36], [ 69,  0],                           // large
  [ 73,  6], [ 75,  1], [ 78, 22], [ 80,  0],    // small then medium
  [ 85, 32], [ 88,  2],                           // large near end
  [ 92,  9], [ 94,  0], [ 97, 20], [100, 10],    // small then medium finish
];

const FULL_BOT_RAW: [number, number][] = [
  [  0,  8], [  3,  1], [  7, 34], [ 10,  0],   // large opener
  [ 15,  5], [ 17,  1], [ 21, 18], [ 23,  0],   // small then medium
  [ 28, 38], [ 31,  2],                           // large
  [ 35,  7], [ 37,  0], [ 40, 12], [ 42,  1],   // small pair
  [ 48, 28], [ 51,  0],                           // medium-large
  [ 55,  6], [ 57,  1], [ 60, 32], [ 63,  0],   // small then large
  [ 67, 16], [ 69,  2],                           // medium
  [ 73,  9], [ 75,  0], [ 80, 36], [ 83,  1],   // small then large
  [ 87, 14], [ 89,  0], [ 93,  8], [ 96,  2],   // medium then small
  [100,  6],
];

const HALF_TOP_RAW: [number, number][] = [
  [  0, 10], [  2,  0], [  5, 38], [  7,  1],
  [ 13, 24], [ 15,  0], [ 20, 42], [ 23,  2],
  [ 27, 16], [ 29,  0], [ 34, 36], [ 37,  1],
  [ 41, 20], [ 43,  0], [ 48, 34], [ 51,  2],
  [ 56, 14], [ 58,  0], [ 63, 40], [ 66,  1],
  [ 70, 22], [ 72,  0], [ 77, 32], [ 80,  2],
  [ 84, 18], [ 86,  0], [ 91, 36], [ 94,  1],
  [ 97, 22], [100, 14],
];

const HALF_BOT_RAW: [number, number][] = [
  [  0, 16], [  3,  1], [  8, 34], [ 11,  0],
  [ 17, 22], [ 19,  2], [ 24, 40], [ 27,  0],
  [ 32, 18], [ 34,  1], [ 39, 32], [ 42,  2],
  [ 47, 24], [ 49,  0], [ 54, 36], [ 57,  1],
  [ 62, 20], [ 64,  0], [ 69, 30], [ 72,  2],
  [ 77, 16], [ 79,  1], [ 84, 34], [ 87,  0],
  [ 92, 22], [ 95,  2], [100, 12],
];

// ── Regional diagonal: piecewise-linear envelope ─────────────────────────────
// keyframes: [x, cumulativeOffset] — each region between keyframes leans a
// different direction; abrupt changes between regions = genuinely torn character
function addRegionalDiagonal(
  pts: [number, number][],
  keyframes: [number, number][],
): [number, number][] {
  return pts.map(([x, y]) => {
    let lo = 0;
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (x <= keyframes[i + 1][0]) { lo = i; break; }
      lo = i + 1;
    }
    const hi = Math.min(lo + 1, keyframes.length - 1);
    const [x0, d0] = keyframes[lo];
    const [x1, d1] = keyframes[hi];
    const t = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
    return [x, Math.max(0, y + d0 + (d1 - d0) * t)] as [number, number];
  });
}

// Diagonal envelopes — different sections lean OPPOSITE directions
// Numbers are Y-offsets (positive = deeper = more to bottom side of panel)
const FULL_TOP = addRegionalDiagonal(FULL_TOP_RAW, [
  [0, 0], [22, +9], [44, -6], [65, +15], [84, +2], [100, +11],
]);
const FULL_BOT = addRegionalDiagonal(FULL_BOT_RAW, [
  [0, 0], [30, +7], [54, -9], [76, +11], [100, +5],
]);
const HALF_TOP = addRegionalDiagonal(HALF_TOP_RAW, [
  [0, 0], [24, +11], [46, -7], [68, +17], [100, +9],
]);
const HALF_BOT = addRegionalDiagonal(HALF_BOT_RAW, [
  [0, 0], [28, -5], [52, +13], [76, -4], [100, +9],
]);

// ── Clip-path builders ────────────────────────────────────────────────────────
function buildClip(top: [number, number][], bot: [number, number][]): string {
  const tPts = top.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`);
  const bPts = [...bot].reverse().map(([x, y]) =>
    `${x.toFixed(2)}% ${(100 - y).toFixed(2)}%`
  );
  return `polygon(${[...tPts, ...bPts].join(", ")})`;
}

export const TORN_CLIP_FULL = buildClip(FULL_TOP, FULL_BOT);
export const TORN_CLIP_HALF = buildClip(HALF_TOP, HALF_BOT);

// ── SVG stroke overlay — 3-layer: blur shadow + thick black + accent ──────────
function TornEdgeStrokes({
  top, bot, accentColor,
}: {
  top: [number, number][];
  bot: [number, number][];
  accentColor: string;
}) {
  const topPts = top.map(([x, y]) => `${x},${y}`).join(" ");
  const botPts = bot.map(([x, y]) => `${x},${(100 - y).toFixed(2)}`).join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 20,
        overflow: "visible",
      }}
    >
      {/* Soft diffuse shadow */}
      <g style={{ filter: "blur(4px)" } as CSSProperties}>
        <polyline points={topPts} fill="none" stroke="rgba(0,0,0,0.75)"
          strokeWidth="14" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <polyline points={botPts} fill="none" stroke="rgba(0,0,0,0.75)"
          strokeWidth="14" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </g>

      {/* Hard black outline */}
      <polyline points={topPts} fill="none" stroke="#000"
        strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <polyline points={botPts} fill="none" stroke="#000"
        strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

      {/* Thin accent inner line */}
      <polyline points={topPts} fill="none" stroke={accentColor}
        strokeWidth="2.2" strokeOpacity="0.85"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <polyline points={botPts} fill="none" stroke={accentColor}
        strokeWidth="2.2" strokeOpacity="0.85"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// ── Exported wrappers ─────────────────────────────────────────────────────────
// outer div: transparent  (outside torn area = see-through to game)
// innerStyle goes on the inner clipped div (set background here)

interface TornProps {
  children: ReactNode;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
  accentColor?: string;
}

export function TornFull({ children, style, innerStyle, accentColor = "#fff" }: TornProps) {
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ position: "absolute", inset: 0, clipPath: TORN_CLIP_FULL, overflow: "hidden", ...innerStyle }}>
        {children}
      </div>
      <TornEdgeStrokes top={FULL_TOP} bot={FULL_BOT} accentColor={accentColor} />
    </div>
  );
}

export function TornHalf({ children, style, innerStyle, accentColor = "#fff" }: TornProps) {
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ position: "absolute", inset: 0, clipPath: TORN_CLIP_HALF, overflow: "hidden", ...innerStyle }}>
        {children}
      </div>
      <TornEdgeStrokes top={HALF_TOP} bot={HALF_BOT} accentColor={accentColor} />
    </div>
  );
}

// Re-export raw arrays for cinematics that need to overlay SVG strokes themselves
export { FULL_TOP, FULL_BOT, HALF_TOP, HALF_BOT };
