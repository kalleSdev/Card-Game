import {
  BOARD, LIGHT, PLINTH, RIM, STAGE, WELL, slabEdges,
} from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import {
  apronPath, buttonSocket, deckSocket, lipPath, plinthPath, slabPath, wellBandPath,
  wellOffsetPath, wellPath,
} from "./board";
import Materials, { MATERIAL_MIX, materialFill, type MaterialName } from "./materials";

/**
 * The board as an object.
 *
 * A wooden slab with a well cut into it, a rim built up around the well in
 * bands, a stone block at each end holding a leader, and sockets cut into the
 * right hand rim for the decks and the button. Nothing here knows about the
 * game; it is the thing the game is played on.
 *
 * Read the rim from the play surface outwards and it is five surfaces at four
 * heights: a chamfer falling into the well, wood, a band of brass inlay, a
 * channel with shadow in it, and wood again out to the edge. That is the whole
 * reason it reads as constructed. A single flat border with a highlight on it
 * reads as a border no matter how well it is shaded.
 *
 * Everything is lit by one lamp, hung high and a little to the left. An edge
 * facing the lamp is pale, the edge opposite it is dark, and a hole is the one
 * where those two are the wrong way round. Getting that inversion right is the
 * difference between something set into the board and something sitting on it.
 *
 * Materials go on last, over surfaces the theme has already tinted, so the
 * greyscale textures add grain and wear without taking the colour with them.
 */

const W = STAGE.width;
const H = STAGE.height;

/** How wide a carved edge reads at this size. */
const EDGE = 3;

/** The strength of a lit edge, and of the one in shadow. */
const LIT = 0.75;
const DARK = 0.6;

export default function Structure({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** How far past the gameplay composition this board reaches on each side. */
  spread?: number;
}) {
  const slab = slabPath(spread);
  const well = wellPath();
  const lip = lipPath(spread);
  const apron = spread > 8 ? apronPath(spread) : null;
  const farPlinth = plinthPath("far");
  const nearPlinth = plinthPath("near");
  const decks = [deckSocket("far"), deckSocket("near")];
  const button = buttonSocket();

  const bevel = wellBandPath(0, RIM.bevel);
  /**
   * The rim's flat top, between the chamfer and the channel.
   *
   * It is the same wood as the body but a step higher, so it takes more of the
   * lamp. Without a tonal break here the rim and the body read as one plate
   * with a groove scratched in it, whatever the shading does.
   */
  const rimTop = wellBandPath(RIM.bevel, RIM.channelIn);
  const inlay = wellBandPath(RIM.inlayIn, RIM.inlayOut);
  const channel = wellBandPath(RIM.channelIn, RIM.channelOut);

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
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.5" />
          <stop offset="0.4" stopColor={theme.lamp} stopOpacity="0.16" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </radialGradient>

        {/* What the lamp does not reach. Not a vignette over the screen: it is
            centred on the lamp, so the far corner from it is the dark one. */}
        <radialGradient id="st-falloff" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach * 1.15}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.42" stopColor="#000000" stopOpacity="0.14" />
          <stop offset="0.75" stopColor="#000000" stopOpacity="0.38" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
        </radialGradient>

        <linearGradient id="st-slab" gradientUnits="userSpaceOnUse" x1={0} y1={BOARD.farY} x2={0} y2={BOARD.nearY + BOARD.lip}>
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="0.45" stopColor={theme.frame.mid} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>

        {/* The near edge, seen end on. Always darker than the face above it. */}
        <linearGradient id="st-lip" gradientUnits="userSpaceOnUse" x1={0} y1={BOARD.nearY} x2={0} y2={BOARD.nearY + BOARD.lip}>
          <stop offset="0" stopColor={theme.frame.dark} />
          <stop offset="1" stopColor={theme.frameEdge} />
        </linearGradient>

        {/* The chamfer into the well. Pale on its far wall, which faces the
            lamp, and dark on its near one, which turns away from it. */}
        <linearGradient id="st-bevel" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY - RIM.bevel} x2={0} y2={WELL.nearY + RIM.bevel}>
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="0.4" stopColor={theme.frame.mid} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>

        {/* Brass. Bright where the lamp catches it, and it loses its shine
            rather than its colour as it turns away. */}
        <linearGradient id="st-brass" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY} x2={0} y2={WELL.nearY}>
          <stop offset="0" stopColor={theme.gold.mid} />
          <stop offset="0.4" stopColor={theme.gold.dark} />
          <stop offset="1" stopColor={theme.gold.dark} />
        </linearGradient>

        <linearGradient id="st-plinth-far" gradientUnits="userSpaceOnUse" x1={0} y1={PLINTH.far.top} x2={0} y2={PLINTH.far.bottom}>
          <stop offset="0" stopColor={theme.wing.light} />
          <stop offset="1" stopColor={theme.wing.mid} />
        </linearGradient>
        <linearGradient id="st-plinth-near" gradientUnits="userSpaceOnUse" x1={0} y1={PLINTH.near.top} x2={0} y2={PLINTH.near.bottom}>
          <stop offset="0" stopColor={theme.wing.mid} />
          <stop offset="0.55" stopColor={theme.wing.light} />
          <stop offset="1" stopColor={theme.wing.dark} />
        </linearGradient>

        {/* A hole. Dark at its far wall, because that is the wall facing you. */}
        <linearGradient id="st-hole" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY} x2={0} y2={WELL.nearY}>
          <stop offset="0" stopColor={theme.bezel} />
          <stop offset="1" stopColor={theme.frameEdge} stopOpacity="0.85" />
        </linearGradient>

        <filter id="st-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={WELL.depth / 2} />
        </filter>

        <filter id="st-cast" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy={10} stdDeviation={14} floodColor={theme.shadow} floodOpacity={DARK} />
        </filter>

        <clipPath id="st-slab-clip"><path d={slab} /></clipPath>
        <clipPath id="st-apron-clip">{apron ? <path d={apron} /> : <path d={slab} />}</clipPath>
        <clipPath id="st-well-clip"><path d={well} /></clipPath>
        <clipPath id="st-plinths-clip">
          <path d={farPlinth} />
          <path d={nearPlinth} />
        </clipPath>
        <clipPath id="st-brass-clip"><path d={inlay} clipRule="evenodd" /></clipPath>
      </defs>

      {/* ── The apron: the tier the board stands on ──────────────────────── */}
      {apron && (
        <>
          <g filter="url(#st-cast)">
            <path d={apron} fill="url(#st-slab)" opacity="0.94" />
          </g>
          <Material name="wood" clip="st-apron-clip" x={-spread} width={W + spread * 2} />
          <g clipPath="url(#st-apron-clip)">
            <path d={apron} fill="url(#st-falloff)" />
          </g>
          <path d={apron} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
        </>
      )}

      {/* ── The slab, and the thickness along its near edge ──────────────── */}
      <g filter="url(#st-cast)">
        <path d={lip} fill="url(#st-lip)" />
        <path d={slab} fill="url(#st-slab)" />
      </g>

      <Material name="wood" clip="st-slab-clip" x={-spread} width={W + spread * 2} />

      <g clipPath="url(#st-slab-clip)">
        {/* Lit, then unlit, in that order, so the far corner from the lamp is
            the one that goes dark rather than the middle of the board. */}
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-lamp)" style={{ mixBlendMode: "soft-light" }} />
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-falloff)" />

        {/* The edge where the slab's face turns over into its near edge. */}
        <path d={slab} fill="none" stroke={theme.frameInlay} strokeWidth={EDGE} opacity={LIT * 0.55} transform="translate(0 2)" />
      </g>

      <path d={slab} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      <path d={lip} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      {/* The lip keeps its own grain, running along the edge it is cut from. */}
      <g clipPath="url(#st-slab-clip)" />

      {/* ── The rim, built up in bands ───────────────────────────────────── */}
      {/* Everything outside the channel is the body, and it sits lower, so it
          keeps less of the light. */}
      <g clipPath="url(#st-slab-clip)">
        <path d={wellOffsetPath(RIM.channelOut)} fill={theme.shadow} opacity="0.16" fillRule="evenodd" />
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="none" />
      </g>
      <path d={rimTop} fillRule="evenodd" fill={theme.frame.light} opacity="0.3" />
      <path d={rimTop} fillRule="evenodd" fill="url(#st-falloff)" opacity="0.5" />
      {/* A channel cut into the wood, with nothing in it but shadow. */}
      <path d={channel} fillRule="evenodd" fill={theme.bezel} opacity="0.4" />
      <path d={wellOffsetPath(RIM.channelOut)} fill="none" stroke={theme.frame.light} strokeWidth={1.5} opacity={LIT * 0.5} transform="translate(0 1.5)" />

      {/* The brass inlay. Restrained: a band the width of a finger, catching
          the lamp, and the only metal on the rim. */}
      <g>
        <path d={inlay} fillRule="evenodd" fill="url(#st-brass)" />
        <Material name="brass" clip="st-brass-clip" x={-spread} width={W + spread * 2} />
        <path d={wellOffsetPath(RIM.inlayOut)} fill="none" stroke={theme.gold.dark} strokeWidth={1.5} opacity="0.8" />
        <path d={wellOffsetPath(RIM.inlayIn)} fill="none" stroke={theme.gold.light} strokeWidth={1} opacity={LIT * 0.7} />
      </g>

      {/* The chamfer falling into the well. Its own shading, over the wood. */}
      <path d={bevel} fillRule="evenodd" fill="url(#st-bevel)" />
      <path d={bevel} fillRule="evenodd" fill="url(#st-falloff)" opacity="0.55" />
      {/* The break where the rim's flat top turns down into the chamfer. A
          chamfer without a hard line at the top of it reads as a soft ramp. */}
      <path d={wellOffsetPath(RIM.bevel)} fill="none" stroke={theme.shadow} strokeWidth={2.5} opacity="0.45" />
      <path d={wellOffsetPath(RIM.bevel)} fill="none" stroke={theme.frame.light} strokeWidth={1.5} opacity={LIT * 0.8} transform="translate(0 2)" />

      {/* ── The well ─────────────────────────────────────────────────────── */}
      <path d={well} fill="url(#st-hole)" />
      <g clipPath="url(#st-well-clip)">
        {/* Ambient occlusion: the corner where the rim meets the floor of the
            well never sees the lamp, so it is dark all the way round. */}
        <path d={well} fill="none" stroke={theme.shadow} strokeWidth={WELL.depth * 2.4} filter="url(#st-soft)" opacity={DARK} />
      </g>
      <path d={well} fill="none" stroke={theme.frameEdge} strokeWidth={2} />

      {/* ── Sockets cut into the right hand rim ──────────────────────────── */}
      {decks.map((socket, i) => (
        <Socket key={`deck${i}`} theme={theme} {...socket} r={12} />
      ))}
      <Socket theme={theme} {...button} r={14} />

      {/* ── The plinths: stone, standing out of the wood ─────────────────── */}
      <g filter="url(#st-cast)">
        <path d={farPlinth} fill="url(#st-plinth-far)" />
        <path d={nearPlinth} fill="url(#st-plinth-near)" />
      </g>
      <Material name="stone" clip="st-plinths-clip" x={-spread} width={W + spread * 2} />
      <g clipPath="url(#st-plinths-clip)">
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-lamp)" style={{ mixBlendMode: "soft-light" }} opacity="0.6" />
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-falloff)" opacity="0.7" />
      </g>
      <path d={farPlinth} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      <path d={nearPlinth} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      {/* A stone block's top edge catches the lamp; its far edge does not. */}
      <path d={farPlinth} fill="none" stroke={theme.wing.light} strokeWidth={1.5} opacity={LIT * 0.6} transform="translate(0 2)" />
      <path d={nearPlinth} fill="none" stroke={theme.wing.light} strokeWidth={1.5} opacity={LIT * 0.6} transform="translate(0 -2)" />

      <RimGroove theme={theme} spread={spread} />
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

/** A recess cut into the rim, for a deck or for the button. */
function Socket({ theme, x, y, w, h, r }: {
  theme: ArenaTheme;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#st-hole)" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="none"
        stroke={theme.shadow}
        strokeWidth={10}
        filter="url(#st-soft)"
        opacity={DARK}
      />
      {/* Lit on the far lip, dark on the near one: a hole, not a bump. */}
      <path d={`M ${x + r} ${y + 2} L ${x + w - r} ${y + 2}`} stroke={theme.frame.light} strokeWidth={EDGE} opacity={LIT * 0.8} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={theme.gold.dark} strokeWidth={1.5} opacity="0.7" />
    </g>
  );
}

/**
 * The groove that runs round the outside of the rim.
 *
 * It follows the slab's edge rather than the well's, because out here it is
 * describing the board's own outline: a line scribed a hand's width in from
 * the edge, which is what stops the outer wood reading as a plain expanse.
 */
function RimGroove({ theme, spread }: { theme: ArenaTheme; spread: number }) {
  const inset = 26 + spread;
  const steps = 24;
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const y = BOARD.farY + ((BOARD.nearY - BOARD.farY) * i) / steps;
    points.push(`${slabEdges(y).x0 + inset},${y}`);
  }
  for (let i = steps; i >= 0; i--) {
    const y = BOARD.farY + ((BOARD.nearY - BOARD.farY) * i) / steps;
    points.push(`${slabEdges(y).x1 - inset},${y}`);
  }

  const d = `M ${points.join(" L ")} Z`;

  return (
    <g clipPath="url(#st-slab-clip)">
      <path d={d} fill="none" stroke={theme.shadow} strokeWidth={3} opacity="0.55" />
      <path d={d} fill="none" stroke={theme.frame.light} strokeWidth={1.5} opacity={LIT * 0.6} transform="translate(0 2.5)" />
    </g>
  );
}
