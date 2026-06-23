import type { CSSProperties, ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Torn-paper panel — organic P5 ripped edges with thick SVG line art
//
// Diagonal variation strategy:
//   • x-gap variation: tight gaps (2-4 units) = steep angular cuts
//                      wide gaps (8-12 units) = long diagonal slashes
//   • addVariedDiagonal: primary slope + sinusoidal undulation so different
//     sections lean at different angles — some hard left, some hard right
//   • SVG overlay drawn OUTSIDE clip for thick black line art
//   • Outer wrapper is transparent — outside rips = see-through
// ─────────────────────────────────────────────────────────────────────────────

// [x, y] pairs — x: 0–100 left→right, y: depth into panel (% of panel height)
// x-gap variation intentional: tight = steep diagonal, wide = long slash

const FULL_TOP_RAW: [number, number][] = [
  [  0, 16], [  3,  0], [  7, 30], [ 10,  1], // tight steep cuts
  [ 20, 28], [ 23,  0],                         // wide diagonal run → quick peak
  [ 27, 22], [ 30,  1], [ 34, 32], [ 37,  0],  // mix
  [ 46, 29], [ 49,  2],                         // wide deep valley
  [ 53, 26], [ 56,  0], [ 60, 31], [ 63,  1],  // tight alternation
  [ 72, 28], [ 75,  2],                         // wide slash
  [ 78, 24], [ 81,  0], [ 85, 30], [ 88,  1],
  [ 94, 22], [ 97,  3], [100, 18],
];

const FULL_BOT_RAW: [number, number][] = [
  [  0, 20], [  4,  1], [  8, 28], [ 11,  0],
  [ 18, 26], [ 21,  2], [ 26, 32], [ 29,  0],
  [ 35, 22], [ 38,  3], [ 43, 30], [ 46,  1],
  [ 55, 27], [ 58,  2],
  [ 62, 24], [ 65,  0], [ 69, 31], [ 73,  1],
  [ 80, 25], [ 83,  2], [ 87, 28], [ 90,  0],
  [ 96, 22], [100,  4],
];

const HALF_TOP_RAW: [number, number][] = [
  [  0, 20], [  3,  0], [  8, 34], [ 11,  1],  // very steep opening
  [ 20, 30], [ 23,  2], [ 27, 36], [ 30,  0],
  [ 38, 28], [ 41,  3], [ 46, 34], [ 49,  0],
  [ 57, 26], [ 60,  2], [ 65, 32], [ 68,  1],
  [ 76, 24], [ 79,  3], [ 84, 30], [ 87,  0],
  [ 93, 22], [ 97,  4], [100, 16],
];

const HALF_BOT_RAW: [number, number][] = [
  [  0, 18], [  4,  1], [  9, 32], [ 13,  0],
  [ 21, 28], [ 24,  2], [ 30, 34], [ 33,  0],
  [ 41, 26], [ 44,  3], [ 49, 32], [ 52,  1],
  [ 60, 28], [ 63,  2], [ 68, 30], [ 71,  0],
  [ 79, 24], [ 83,  3], [ 88, 28], [ 91,  1],
  [ 97, 20], [100,  5],
];

// Banner: tapering toward the pointed end — depths reduce near x=85+
const BANNER_TOP_RAW: [number, number][] = [
  [  0, 14], [  3,  0], [  7, 26], [ 10,  1],
  [ 18, 24], [ 21,  0], [ 26, 28], [ 29,  2],
  [ 36, 22], [ 39,  0], [ 44, 26], [ 47,  2],
  [ 54, 20], [ 57,  1], [ 62, 22], [ 65,  0],
  [ 71, 16], [ 74,  2], [ 79, 12], [ 82,  1],
  [ 87,  7], [ 90,  0], [ 94,  4], [ 97,  1], [ 99,  2],
];

const BANNER_BOT_RAW: [number, number][] = [
  [  0, 12], [  4,  1], [  9, 24], [ 12,  0],
  [ 19, 22], [ 22,  2], [ 27, 26], [ 30,  0],
  [ 37, 20], [ 40,  2], [ 45, 24], [ 48,  1],
  [ 55, 18], [ 58,  0], [ 63, 20], [ 66,  2],
  [ 72, 14], [ 75,  1], [ 80, 10], [ 83,  0],
  [ 88,  6], [ 91,  1], [ 95,  3], [ 98,  1], [ 99,  0],
];

// ── Varied diagonal: primary slope + sinusoidal undulation ───────────────────
// Different sections lean at different angles — like real torn paper grain
function addVariedDiagonal(
  pts: [number, number][],
  primarySlope: number,   // overall tilt (positive = right side deeper)
  waveAmp: number,        // amplitude of diagonal variation (makes sections lean differently)
  waveFreq: number,       // how many waves across the width
): [number, number][] {
  return pts.map(([x, y]) => {
    const t = x / 100;
    const primary = t * primarySlope;
    // Sinusoidal component creates sections that lean differently
    const wave = Math.sin(t * Math.PI * waveFreq) * waveAmp;
    return [x, Math.max(0, y + primary + wave)] as [number, number];
  });
}

const FULL_TOP    = addVariedDiagonal(FULL_TOP_RAW,    5,  3, 2.2);
const FULL_BOT    = addVariedDiagonal(FULL_BOT_RAW,   -4,  2.5, 1.8);
const HALF_TOP    = addVariedDiagonal(HALF_TOP_RAW,    6,  4, 2.5);
const HALF_BOT    = addVariedDiagonal(HALF_BOT_RAW,   -5,  3, 2.0);
const BANNER_TOP  = addVariedDiagonal(BANNER_TOP_RAW,  3,  2, 1.5);
const BANNER_BOT  = addVariedDiagonal(BANNER_BOT_RAW, -2,  1.5, 1.2);

// ── Clip-path builders ────────────────────────────────────────────────────────
function buildClip(top: [number, number][], bot: [number, number][]): string {
  const tPts = top.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`);
  const bPts = [...bot].reverse().map(([x, y]) =>
    `${x.toFixed(2)}% ${(100 - y).toFixed(2)}%`
  );
  return `polygon(${[...tPts, ...bPts].join(", ")})`;
}

function buildBannerClip(
  top: [number, number][],
  bot: [number, number][],
  tipAtRight: boolean,
): string {
  if (tipAtRight) {
    const tPts = top.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`);
    const bPts = [...bot].reverse().map(([x, y]) =>
      `${x.toFixed(2)}% ${(100 - y).toFixed(2)}%`
    );
    return `polygon(${tPts.join(", ")}, 100% 50%, ${bPts.join(", ")})`;
  } else {
    const flip = (p: [number, number][]): [number, number][] =>
      p.map(([x, y]) => [100 - x, y] as [number, number]).sort((a, b) => a[0] - b[0]);
    return buildBannerClip(flip(top), flip(bot), true);
  }
}

export const TORN_CLIP_FULL    = buildClip(FULL_TOP, FULL_BOT);
export const TORN_CLIP_HALF    = buildClip(HALF_TOP, HALF_BOT);
export const TORN_BANNER_LEFT  = buildBannerClip(BANNER_TOP, BANNER_BOT, true);
export const TORN_BANNER_RIGHT = buildBannerClip(BANNER_TOP, BANNER_BOT, false);

// ── SVG stroke overlay ────────────────────────────────────────────────────────
type EdgeKind = "topbot" | "banner-left" | "banner-right";

function TornEdgeStrokes({
  top, bot, accentColor, kind = "topbot",
}: {
  top: [number, number][];
  bot: [number, number][];
  accentColor: string;
  kind?: EdgeKind;
}) {
  const topPts = top.map(([x, y]) => `${x},${y}`).join(" ");
  const botPts = bot.map(([x, y]) => `${x},${100 - y}`).join(" ");

  const isBanner = kind !== "topbot";
  const topLast = top[top.length - 1];
  const botLast = bot[bot.length - 1];
  const tipX = kind === "banner-left" ? 100 : 0;
  const tipPts = isBanner
    ? `${topLast[0]},${topLast[1]} ${tipX},50 ${botLast[0]},${100 - botLast[1]}`
    : "";

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
      {/* Soft shadow behind the tear */}
      <g style={{ filter: "blur(3px)" } as CSSProperties}>
        <polyline points={topPts} fill="none" stroke="rgba(0,0,0,0.7)"
          strokeWidth="11" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
        <polyline points={botPts} fill="none" stroke="rgba(0,0,0,0.7)"
          strokeWidth="11" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
        {isBanner && <polyline points={tipPts} fill="none" stroke="rgba(0,0,0,0.7)"
          strokeWidth="11" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />}
      </g>

      {/* Thick black outline */}
      <polyline points={topPts} fill="none" stroke="#000"
        strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
      <polyline points={botPts} fill="none" stroke="#000"
        strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
      {isBanner && <polyline points={tipPts} fill="none" stroke="#000"
        strokeWidth="7" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />}

      {/* Thin inner accent */}
      <polyline points={topPts} fill="none" stroke={accentColor}
        strokeWidth="2" strokeOpacity="0.8"
        vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
      <polyline points={botPts} fill="none" stroke={accentColor}
        strokeWidth="2" strokeOpacity="0.8"
        vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
      {isBanner && <polyline points={tipPts} fill="none" stroke={accentColor}
        strokeWidth="2" strokeOpacity="0.8"
        vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />}
    </svg>
  );
}

// ── Exported wrapper components ───────────────────────────────────────────────
// Outer div: transparent — outside the torn clip = see-through to game
// innerStyle: apply background here (inside the clip only)

interface TornProps {
  children: ReactNode;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
  accentColor?: string;
}

export function TornFull({ children, style, innerStyle, accentColor = "#fff" }: TornProps) {
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ position: "absolute", inset: 0, clipPath: TORN_CLIP_FULL, ...innerStyle }}>
        {children}
      </div>
      <TornEdgeStrokes top={FULL_TOP} bot={FULL_BOT} accentColor={accentColor} />
    </div>
  );
}

export function TornHalf({ children, style, innerStyle, accentColor = "#fff" }: TornProps) {
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ position: "absolute", inset: 0, clipPath: TORN_CLIP_HALF, ...innerStyle }}>
        {children}
      </div>
      <TornEdgeStrokes top={HALF_TOP} bot={HALF_BOT} accentColor={accentColor} />
    </div>
  );
}

export function TornBanner({
  children, style, innerStyle, accentColor = "#fff", tipAtRight = true,
}: TornProps & { tipAtRight?: boolean }) {
  const clip = tipAtRight ? TORN_BANNER_LEFT : TORN_BANNER_RIGHT;
  const top = tipAtRight
    ? BANNER_TOP
    : BANNER_TOP.map(([x, y]) => [100 - x, y] as [number, number]).sort((a, b) => a[0] - b[0]);
  const bot = tipAtRight
    ? BANNER_BOT
    : BANNER_BOT.map(([x, y]) => [100 - x, y] as [number, number]).sort((a, b) => a[0] - b[0]);
  const kind: EdgeKind = tipAtRight ? "banner-left" : "banner-right";

  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ position: "absolute", inset: 0, clipPath: clip, ...innerStyle }}>
        {children}
      </div>
      <TornEdgeStrokes top={top} bot={bot} accentColor={accentColor} kind={kind} />
    </div>
  );
}
