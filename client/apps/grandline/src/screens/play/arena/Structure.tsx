import {
  BOARD, LIGHT, RIM, SHELL, STAGE, WELL, leftFittings, rightFittings, type Box,
} from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import {
  apronPath, baseFacePath, lipPath, slabPath, wellBandPath, wellOffsetPath, wellPath,
} from "./board";
import Materials, { MATERIAL_MIX, materialFill, type MaterialName } from "./materials";
import { Frame, Recess } from "./Stations";

/**
 * The board as an object.
 *
 * Six layers, from the table up: a base of dark wood that owns the whole
 * footprint and stands on the table; a slab of the same wood raised on it,
 * with the well cut through it; a band of brass let in where the slab's wood
 * steps down; a frame of stone below that step, running in to a chamfer; the
 * dark of the recess; and the parchment, which is drawn elsewhere and set
 * down into it. Every line on the board is where two of those meet. There
 * used to be a scribed groove round the rim, wear rings and scratches on the
 * wood, and two or three outlines on every edge, and the board read as a
 * drawing of a board; what is here now is only the construction.
 *
 * The fittings are mounted on the rim, and the rim runs on underneath them.
 * At each end a player's station — drawn in its own layer, since its plate
 * reaches out over the parchment's edge. Down the right, the two decks in
 * brass frames and the key that ends a turn between them; down the left, two
 * plates for the board's writing, three stones in rings, the key that leaves,
 * and a compass mark engraved above and below. All drawn here, not by the
 * things that sit in them, which is the whole difference between a control
 * the board was built for and a control laid on top of it. There is no
 * housing behind any of it: the wood, the brass and the stone frame are one
 * continuous ring, and a fitting that lands across them sits across them.
 *
 * Everything is lit by one lamp, high and to the left. A raised layer casts
 * down and to the right onto the one beneath it, and its top and left edges
 * catch the light; a hole is the same thing turned over — its top and left
 * walls throw shadow across the floor, and its bottom and right walls are
 * the ones the lamp reaches. Getting that inversion right is the difference
 * between something set into the board and something sitting on it, and it
 * is the same rule for every edge here.
 *
 * Materials go on last, over surfaces the theme has already tinted, so the
 * greyscale textures add grain and wear without taking the colour with them.
 */

const W = STAGE.width;
const H = STAGE.height;

/** A stroke on an outline, pushed a hair down and right, shows on the top and
    left edges of the shape it is clipped to: the edges that face the lamp. */
const TOWARDS_LAMP = `translate(${SHELL.lit} ${SHELL.lit})`;

/** The strength of a lit edge, and of the one in shadow. */
const LIT = 0.85;
const DARK = 0.8;

export default function Structure({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** How far past the gameplay composition this board reaches on each side. */
  spread?: number;
}) {
  const base = apronPath(spread);
  const baseFace = baseFacePath(spread);
  const slab = slabPath(spread);
  const lip = lipPath(spread);
  const well = wellPath();
  const left = leftFittings();
  const right = rightFittings();

  const bevel = wellBandPath(0, RIM.bevel);
  const stone = wellBandPath(RIM.bevel, RIM.brassIn);
  const brass = wellBandPath(RIM.brassIn, RIM.brassOut);
  /** Everything below the wood's step: chamfer, stone and brass together. */
  const sunk = wellBandPath(0, RIM.brassOut);
  /** The line the wood steps down on. */
  const step = wellOffsetPath(RIM.brassOut);

  const full = { x: -spread, y: 0, width: W + spread * 2, height: H };

  return (
    <svg
      viewBox={`${-spread} 0 ${W + spread * 2} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <Materials only={["wood", "stone", "brass"]} />

        {/* The lamp. Everything on the board is shaded against this one shape,
            which is what keeps the whole object lit from the same place. */}
        <radialGradient id="st-lamp" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.72" />
          <stop offset="0.34" stopColor={theme.lamp} stopOpacity="0.3" />
          <stop offset="0.7" stopColor={theme.lamp} stopOpacity="0.08" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </radialGradient>

        {/* What the lamp does not reach: cool, and centred on the lamp, so the
            far corner from it is the dark one. */}
        <radialGradient id="st-falloff" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach * 1.16}>
          <stop offset="0" stopColor="#161C26" stopOpacity="0" />
          <stop offset="0.36" stopColor="#161C26" stopOpacity="0.14" />
          <stop offset="0.7" stopColor="#141A24" stopOpacity="0.42" />
          <stop offset="1" stopColor="#121820" stopOpacity="0.68" />
        </radialGradient>

        {/* The wood, lit down its length. */}
        <linearGradient id="st-wood" gradientUnits="userSpaceOnUse" x1={0} y1={BOARD.farY} x2={0} y2={BOARD.nearY + BOARD.lip}>
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="0.45" stopColor={theme.frame.mid} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>

        {/* A near face, seen end on: the one surface turned fully away from
            the lamp, so it goes to the board's own near black rather than
            merely to a darker wood. An edge only a little darker than the top
            reads as paint on a flat sheet. */}
        <linearGradient id="st-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.frameEdge} />
          <stop offset="0.55" stopColor={theme.frame.dark} />
          <stop offset="1" stopColor={theme.bezel} />
        </linearGradient>

        {/* The stone frame: lit at its far edge and going to its own shadow
            colour at the near one, the same way the plinths do, because it is
            the same stone. */}
        <linearGradient id="st-stone" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY - RIM.brassIn} x2={0} y2={WELL.nearY + RIM.brassIn}>
          <stop offset="0" stopColor={theme.wing.light} />
          <stop offset="0.5" stopColor={theme.wing.mid} />
          <stop offset="1" stopColor={theme.wing.dark} />
        </linearGradient>

        {/* The chamfer into the well. Pale on its far wall, which faces the
            lamp, and dark on its near one, which turns away from it. */}
        <linearGradient id="st-bevel" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY - RIM.bevel} x2={0} y2={WELL.nearY + RIM.bevel}>
          <stop offset="0" stopColor={theme.wing.light} />
          <stop offset="0.4" stopColor={theme.wing.mid} />
          <stop offset="1" stopColor={theme.wing.dark} />
        </linearGradient>

        {/* Brass. Bright where the lamp catches it, and it loses its shine
            rather than its colour as it turns away. */}
        <linearGradient id="st-brass" gradientUnits="userSpaceOnUse" x1={WELL.farX0} y1={WELL.farY} x2={WELL.nearX1} y2={WELL.nearY}>
          <stop offset="0" stopColor={theme.gold.light} />
          <stop offset="0.16" stopColor={theme.gold.mid} />
          <stop offset="0.5" stopColor={theme.gold.dark} />
          <stop offset="1" stopColor={theme.gold.dark} />
        </linearGradient>

        {/* A hole. Dark at its far wall, because that is the wall facing you. */}
        <linearGradient id="st-hole" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY} x2={0} y2={WELL.nearY}>
          <stop offset="0" stopColor={theme.bezel} />
          <stop offset="1" stopColor={theme.frameEdge} stopOpacity="0.85" />
        </linearGradient>

        {/* The one softness every shadow on the board has. */}
        <filter id="st-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={SHELL.occlusion / 2} />
        </filter>

        {/* The one contact shadow a raised layer drops on the layer below. */}
        <filter id="st-cast" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx={SHELL.cast.dx} dy={SHELL.cast.dy} stdDeviation={SHELL.cast.blur} floodColor={theme.shadow} floodOpacity={0.85} />
        </filter>

        <clipPath id="st-base-clip"><path d={base} /></clipPath>
        <clipPath id="st-slab-clip"><path d={slab} /></clipPath>
        <clipPath id="st-sunk-clip"><path d={sunk} clipRule="evenodd" /></clipPath>
        <clipPath id="st-stone-clip"><path d={stone} clipRule="evenodd" /></clipPath>
        <clipPath id="st-brass-clip"><path d={brass} clipRule="evenodd" /></clipPath>
        <clipPath id="st-well-clip"><path d={well} /></clipPath>
      </defs>

      {/* ── 1. The base: the whole footprint, standing on the table ─────── */}
      <g filter="url(#st-cast)">
        <path d={baseFace} fill="url(#st-face)" />
        <path d={base} fill="url(#st-wood)" opacity="0.94" />
      </g>
      <Material name="wood" clip="st-base-clip" x={-spread} width={W + spread * 2} />
      <g clipPath="url(#st-base-clip)">
        <rect {...full} fill="url(#st-falloff)" />
        {/* A step below the slab, so it keeps less of the lamp whatever the
            falloff says. */}
        <path d={base} fill={theme.shadow} opacity="0.3" />
      </g>
      <path d={base} fill="none" stroke={theme.frameEdge} strokeWidth={SHELL.edge} />

      {/* ── 2. The slab, raised on the base, with its own near face ─────── */}
      <g filter="url(#st-cast)">
        <path d={lip} fill="url(#st-face)" />
        <path d={slab} fill="url(#st-wood)" />
      </g>
      <Material name="wood" clip="st-slab-clip" x={-spread} width={W + spread * 2} />
      <g clipPath="url(#st-slab-clip)">
        {/* Lit, then unlit, in that order, so the far corner from the lamp is
            the one that goes dark rather than the middle of the board. */}
        <rect {...full} fill="url(#st-lamp)" style={{ mixBlendMode: "soft-light" }} />
        <rect {...full} fill="url(#st-falloff)" />
        {/* The top and left edges, where the wood turns over towards the lamp. */}
        <path d={slab} fill="none" stroke={theme.frameInlay} strokeWidth={SHELL.lit} opacity={LIT} transform={TOWARDS_LAMP} />
      </g>
      <path d={slab} fill="none" stroke={theme.frameEdge} strokeWidth={SHELL.edge} />

      {/* ── 3–4. Below the wood's step: brass at its foot, then stone ─────── */}
      <path d={stone} fillRule="evenodd" fill="url(#st-stone)" />
      <Material name="stone" clip="st-stone-clip" x={-spread} width={W + spread * 2} />
      <g clipPath="url(#st-stone-clip)">
        <rect {...full} fill="url(#st-lamp)" style={{ mixBlendMode: "soft-light" }} opacity="0.6" />
        <rect {...full} fill="url(#st-falloff)" opacity="0.7" />
      </g>
      <g>
        <path d={brass} fillRule="evenodd" fill="url(#st-brass)" />
        <Material name="brass" clip="st-brass-clip" x={-spread} width={W + spread * 2} />
        {/* The brass's inner edge, where it stops and the stone begins. */}
        <path d={wellOffsetPath(RIM.brassIn)} fill="none" stroke={theme.gold.dark} strokeWidth={SHELL.lit} opacity="0.8" />
      </g>
      <g clipPath="url(#st-sunk-clip)">
        {/* The wood's step stands above all of this and drops its shadow
            across it: soft, and pushed down and right so it lies under the
            top and left walls, which are the ones between the lamp and the
            floor. */}
        <path d={step} fill="none" stroke={theme.shadow} strokeWidth={SHELL.occlusion * 1.4} filter="url(#st-soft)" opacity={DARK * 0.8} transform="translate(4 4)" />
      </g>
      {/* The step itself: where the wood stops. */}
      <path d={step} fill="none" stroke={theme.frameEdge} strokeWidth={SHELL.edge} />

      {/* The chamfer falling into the well, and the break at the top of it: a
          chamfer without a hard line at the top reads as a soft ramp. */}
      <path d={bevel} fillRule="evenodd" fill="url(#st-bevel)" />
      <path d={bevel} fillRule="evenodd" fill="url(#st-falloff)" opacity="0.55" />
      <path d={wellOffsetPath(RIM.bevel)} fill="none" stroke={theme.shadow} strokeWidth={SHELL.lit} opacity="0.5" />

      {/* ── 5. The recess ────────────────────────────────────────────────── */}
      <path d={well} fill="url(#st-hole)" />
      <g clipPath="url(#st-well-clip)">
        {/* The walls' shadow across the floor, heaviest under the top and
            left walls. */}
        <path d={well} fill="none" stroke={theme.shadow} strokeWidth={SHELL.occlusion * 2.6} filter="url(#st-soft)" opacity={DARK} transform="translate(3 3)" />
      </g>
      <path d={well} fill="none" stroke={theme.frameEdge} strokeWidth={SHELL.edge} />

      {/* ── The right hand fittings: two deck frames and the key ─────────── */}
      {[right.decks.far, right.decks.near].map(box => (
        <g key={box.y}>
          <Frame theme={theme} box={box} />
          <BoxRecess theme={theme} box={box} />
        </g>
      ))}
      <Frame theme={theme} box={right.button} r={SHELL.radius.hole / 2} />
      <BoxRecess theme={theme} box={right.button} r={SHELL.radius.hole / 2} />

      {/* ── The left hand fittings: two plates, three stones, the key ────── */}
      {[left.plaque, left.status].map(box => (
        <g key={box.y}>
          <Frame theme={theme} box={box} r={SHELL.radius.hole / 2} />
          <BoxRecess theme={theme} box={box} r={SHELL.radius.hole / 2} />
        </g>
      ))}
      {left.stones.map((stone, i) => (
        <Stone key={stone.cx} theme={theme} cx={stone.cx} cy={stone.cy} r={stone.radius} tint={STONES[i]} />
      ))}
      <Frame theme={theme} box={left.leave} r={SHELL.radius.hole / 2} />
      <BoxRecess theme={theme} box={left.leave} r={SHELL.radius.hole / 2} />
      {left.emblems.map(mark => (
        <Emblem key={mark.cy} theme={theme} cx={mark.cx} cy={mark.cy} r={mark.radius} />
      ))}
    </svg>
  );
}

/**
 * A material, laid over whatever has already been drawn inside a clip.
 *
 * The texture is greyscale and mixed rather than painted, so what comes out is
 * the surface's own colour with the material's grain in it. Painting the
 * texture directly would throw the theme away.
 */
function Material({ name, clip, x, width }: {
  name: MaterialName;
  clip: string;
  x: number;
  width: number;
}) {
  const mix = MATERIAL_MIX[name];
  return (
    <g clipPath={`url(#${clip})`} style={{ mixBlendMode: mix.blend }} opacity={mix.opacity}>
      <rect x={x} y={0} width={width} height={H} fill={materialFill(name)} />
    </g>
  );
}

/** A hole the size of a box, with the board's corner. */
function BoxRecess({ theme, box, r = SHELL.radius.hole }: { theme: ArenaTheme; box: Box; r?: number }) {
  return <Recess theme={theme} x={box.x} y={box.y} w={box.width} h={box.height} r={r} />;
}

/**
 * The three stones' glass. Board hardware, not the game: they are the
 * coloured caps on the reference board, and they do nothing.
 */
const STONES = ["#E8E4DC", "#4E9BE6", "#9A5FD6"] as const;

/** A stone in a brass ring, set into the rim. */
function Stone({ theme, cx, cy, r, tint }: { theme: ArenaTheme; cx: number; cy: number; r: number; tint: string }) {
  const id = `st-stone-${Math.round(cx)}-${Math.round(cy)}`;
  return (
    <g>
      <radialGradient id={id} cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
        <stop offset="0.3" stopColor={tint} />
        <stop offset="1" stopColor={theme.bezel} />
      </radialGradient>
      <Recess theme={theme} x={cx - r - 3} y={cy - r - 3} w={(r + 3) * 2} h={(r + 3) * 2} r={r + 3} round />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.gold.dark} strokeWidth={SHELL.lit} opacity="0.9" />
    </g>
  );
}

/**
 * A compass mark engraved in the rim: a ring, a rose of eight points, and a
 * centre. Cut, not painted — a dark line with the lamp catching its lower
 * wall — and faint, because it is a mark on a board and not a picture.
 */
function Emblem({ theme, cx, cy, r }: { theme: ArenaTheme; cx: number; cy: number; r: number }) {
  const points: string[] = [];
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0;
    const a = (i * Math.PI) / 4;
    const tip = long ? r * 0.82 : r * 0.5;
    const base = r * 0.12;
    const b1 = a - Math.PI / 8;
    const b2 = a + Math.PI / 8;
    points.push(
      `M ${cx + Math.cos(a) * tip} ${cy + Math.sin(a) * tip}`
      + ` L ${cx + Math.cos(b1) * base * 2} ${cy + Math.sin(b1) * base * 2}`
      + ` L ${cx + Math.cos(a) * base} ${cy + Math.sin(a) * base}`
      + ` L ${cx + Math.cos(b2) * base * 2} ${cy + Math.sin(b2) * base * 2} Z`,
    );
  }
  const rose = points.join(" ");
  const cut = (props: Record<string, unknown>) => (
    <g {...props}>
      <circle cx={cx} cy={cy} r={r} fill="none" />
      <circle cx={cx} cy={cy} r={r * 0.9} fill="none" />
      <path d={rose} />
      <circle cx={cx} cy={cy} r={r * 0.06} />
    </g>
  );
  return (
    <g opacity="0.7">
      {cut({ fill: theme.frameInlay, stroke: theme.frameInlay, strokeWidth: SHELL.lit, transform: TOWARDS_LAMP, opacity: 0.5 })}
      {cut({ fill: theme.frameEdge, stroke: theme.frameEdge, strokeWidth: SHELL.lit })}
    </g>
  );
}
