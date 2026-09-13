import {
  BOARD, LIGHT, PLINTH, RAIL, RIM, STAGE, STATION, WELL, boardReach, railSeat, slabEdges,
  station, type Side,
} from "../../../design/arenaStage";
import { ARENA_THEME_LIST, type ArenaTheme } from "../../../design/arenaThemes";
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
 * The left rim is cut for the board's information: two shallow plaques, three
 * gem sockets and a slot for the way out. Three small holes rather than one
 * large one, because a single box behind all of it is exactly the panel this is
 * trying not to be.
 *
 * Each end of the rim is also a player's station, and the board is cut for it:
 * a plinth for the leader, a round socket to its left for the ability dial, and
 * a channel to its right holding the energy readout and its ten stones. Those
 * are holes in the wood drawn here, not panels drawn by the things that sit in
 * them, which is the whole difference between a control the board was built for
 * and a control laid on top of it.
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

/**
 * The strength of a lit edge, and of the one in shadow.
 *
 * A carved edge is the only thing on a flat screen that says a surface has
 * turned, so every one of them is worth its contrast: the board has a dozen
 * steps in it and none of them exist unless their edges catch something.
 */
const LIT = 0.92;
const DARK = 0.72;

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
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.72" />
          <stop offset="0.34" stopColor={theme.lamp} stopOpacity="0.3" />
          <stop offset="0.7" stopColor={theme.lamp} stopOpacity="0.08" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </radialGradient>

        {/* What the lamp does not reach. Not a vignette over the screen: it is
            centred on the lamp, so the far corner from it is the dark one. */}
        <radialGradient id="st-falloff" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach * 1.12}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.38" stopColor="#000000" stopOpacity="0.16" />
          <stop offset="0.72" stopColor="#000000" stopOpacity="0.46" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.78" />
        </radialGradient>

        {/*
          The board's outer body going into shadow towards its own edge.
          Painted as one very wide stroke along the slab's outline rather than
          as another radial, because it has to follow the board's shape: the
          point of it is that the battlefield ends up the brightest thing on
          screen and the wood falls away from it in every direction, which is
          what the eye reads as a thick object rather than a lit panel.
        */}
        <radialGradient id="st-edge-dark" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.3" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.62" stopColor="#000000" stopOpacity="0.2" />
          <stop offset="0.86" stopColor="#000000" stopOpacity="0.58" />
        </radialGradient>

        <linearGradient id="st-slab" gradientUnits="userSpaceOnUse" x1={0} y1={BOARD.farY} x2={0} y2={BOARD.nearY + BOARD.lip}>
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="0.45" stopColor={theme.frame.mid} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>

        {/* The near edge, seen end on: the one face of the board turned
            fully away from the lamp, so it goes to the board's own near black
            rather than merely to a darker wood. This is the underside, and an
            underside that is only a little darker than the top reads as paint
            on a flat sheet. */}
        <linearGradient id="st-lip" gradientUnits="userSpaceOnUse" x1={0} y1={BOARD.nearY} x2={0} y2={BOARD.nearY + BOARD.lip}>
          <stop offset="0" stopColor={theme.frameEdge} />
          <stop offset="0.55" stopColor={theme.frame.dark} />
          <stop offset="1" stopColor={theme.bezel} />
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
          <feDropShadow dx="4" dy={18} stdDeviation={18} floodColor={theme.shadow} floodOpacity={0.85} />
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
            {/* The apron is a step below the slab, so it keeps less of the
                lamp than the slab does whatever the falloff says. */}
            <path d={apron} fill={theme.shadow} opacity="0.3" />
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

        {/* The wood going into shadow towards the board's own outer edge, so
            the battlefield ends up the brightest thing on screen and the wood
            falls away from it in every direction. A gradient rather than a
            wide stroke along the outline: a stroke has one opacity across its
            whole width, so it puts a hard line wherever it stops and reads as
            a painted border. Bounding box units make this an ellipse the shape
            of the board, which is close enough to the board's own shape. */}
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-edge-dark)" />

        <Wear theme={theme} spread={spread} />

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

      {/* The scribed line goes on before anything is cut through it, because a
          line that ran across a hole would say the hole was painted on. */}
      <RimGroove theme={theme} spread={spread} />

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

      {/* ── The stations: what the board is cut to hold ─────────────────── */}
      {(["far", "near"] as Side[]).map(side => (
        <StationRecesses key={side} theme={theme} side={side} />
      ))}

      {/* ── The information area, down the left rim ──────────────────────── */}
      <RailRecesses theme={theme} />
    </svg>
  );
}

/**
 * A fixed number between nought and one, for a given pair of whole numbers.
 *
 * Not a random number generator: a function. A generator would have to carry a
 * seed it kept changing, which is a thing a component may not do during a
 * render, and it would hand back a different board every time React looked at
 * it. Scratches that moved when a card was played would be the single worst
 * thing on this board, so they are a pure function of which scratch it is.
 */
function noise(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Two decimals, which keeps the path short and is finer than a screen pixel. */
function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * What a board this old looks like up close.
 *
 * Three kinds of nothing much: two broad tonal patches, because a plank is
 * never one tone across its whole width; eleven hairline scratches, because a
 * surface with cards slid across it for years is not smooth; and a scuff worn
 * pale along the near rim, where hands actually rest. Everything is between
 * four and nine per cent opacity — the point is that you cannot see any of it,
 * only that the wood has stopped being perfect.
 *
 * All of it is clipped to the slab by the group it sits in, and none of it is
 * anywhere near the well, so nothing here is ever under a card.
 */
function Wear({ theme, spread }: { theme: ArenaTheme; spread: number }) {
  const reach = boardReach(spread);
  const scratches = Array.from({ length: 11 }, (_unused, i) => {
    // Out on the body, either side of the play area, never across it.
    const side = noise(i, 0) < 0.5 ? -1 : 1;
    const x = W / 2 + side * (W * 0.34 + reach * noise(i, 1));
    const y = BOARD.farY + noise(i, 2) * (BOARD.nearY - BOARD.farY);
    const run = 40 + noise(i, 3) * 130;
    const lean = (noise(i, 4) - 0.5) * 26;
    return `M ${round(x)} ${round(y)} L ${round(x + run)} ${round(y + lean)}`;
  }).join(" ");

  return (
    <g>
      <ellipse cx={W * 0.2 - reach * 0.4} cy={BOARD.farY + 210} rx={300} ry={190} fill={theme.frameEdge} opacity="0.07" />
      <ellipse cx={W * 0.82 + reach * 0.4} cy={BOARD.nearY - 180} rx={260} ry={210} fill={theme.frameEdge} opacity="0.05" />
      <path d={scratches} stroke={theme.frameEdge} strokeWidth={1.5} fill="none" opacity="0.09" />
      <path d={scratches} stroke={theme.frameInlay} strokeWidth={1} fill="none" opacity="0.06" transform="translate(0 1.5)" />
      {/* Where hands rest, along the near rim. */}
      <ellipse cx={W / 2} cy={BOARD.nearY - 18} rx={W * 0.3} ry={26} fill={theme.frameInlay} opacity="0.05" />
    </g>
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

/**
 * The two holes cut into one end of the rim for that player's controls.
 *
 * Both are the same construction as the deck wells: the board's face turns down
 * into a shadowed wall, the floor is the dark every hole on this board is
 * floored with, and a brass hairline runs round the opening. The channel is
 * long and shallow and the socket is round, and that is the only difference
 * between them.
 */
function StationRecesses({ theme, side }: { theme: ArenaTheme; side: Side }) {
  const seat = station(side);
  const { channel, ability } = seat;

  return (
    <g>
      <Recess
        theme={theme}
        x={channel.x}
        y={channel.y}
        w={channel.width}
        h={channel.height}
        r={STATION.channel.round}
      />
      <Recess
        theme={theme}
        x={ability.cx - ability.radius}
        y={ability.cy - ability.radius}
        w={ability.radius * 2}
        h={ability.radius * 2}
        r={ability.radius}
        round
      />
    </g>
  );
}

/**
 * A hole in the rim.
 *
 * Five steps, outwards in: the board's face darkening as it turns down towards
 * the opening, a lit edge on the far side of that turn where the lamp catches
 * the wood, the floor, the corner between floor and wall which never sees the
 * lamp at all, and a brass hairline round the lip. A hole is the one place on
 * this board where the lighting runs backwards — the near wall is the one you
 * cannot see into, so the light lands on the far one.
 *
 * `round` swaps the rounded box for a circle at the same radius, which is the
 * only difference between the energy channel and the ability socket.
 */
function Recess({ theme, x, y, w, h, r, round = false }: {
  theme: ArenaTheme;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  round?: boolean;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  /** How far the board's face is drawn back before it turns down. */
  const OUT = 5;

  const shape = (grow: number, props: Record<string, unknown>) =>
    round
      ? <circle cx={cx} cy={cy} r={r + grow} {...props} />
      : (
        <rect
          x={x - grow}
          y={y - grow}
          width={w + grow * 2}
          height={h + grow * 2}
          rx={r + grow}
          {...props}
        />
      );

  return (
    <g>
      {/* The wood around the lip sits a step lower, so it keeps less light. */}
      {shape(OUT, { fill: theme.shadow, opacity: 0.22 })}
      {shape(OUT, { fill: "none", stroke: theme.frameEdge, strokeWidth: 1 })}
      {/* Where that step turns back up into the board's face. */}
      {shape(OUT, {
        fill: "none",
        stroke: theme.frame.light,
        strokeWidth: 1.5,
        opacity: LIT * 0.45,
        transform: "translate(0 1.5)",
      })}

      {shape(0, { fill: "url(#st-hole)" })}
      {/* The corner where the wall meets the floor. */}
      {shape(0, {
        fill: "none",
        stroke: theme.shadow,
        strokeWidth: 9,
        filter: "url(#st-soft)",
        opacity: DARK,
      })}
      {/* The far wall, which is the one the lamp reaches. Drawn as the top of
          the opening only, rather than as an offset outline, so no light ends
          up on the near wall you are looking at the back of. */}
      <path
        d={round ? topArc(cx, cy, r - 2) : `M ${x + r} ${y + 2.5} L ${x + w - r} ${y + 2.5}`}
        fill="none"
        stroke={theme.frame.light}
        strokeWidth={EDGE}
        strokeLinecap="round"
        opacity={LIT * 0.55}
      />
      {shape(0, { fill: "none", stroke: theme.gold.dark, strokeWidth: 1.5, opacity: 0.75 })}
    </g>
  );
}

/**
 * The holes cut down the left rim for the board's information.
 *
 * Two shallow plaques and, at the bottom, a socket for each table you can play
 * on and a slot for the way out. All of them are the same `Recess` as the deck
 * wells and the energy channel, so the information area is made of the same
 * thing the rest of the board is made of.
 */
function RailRecesses({ theme }: { theme: ArenaTheme }) {
  const seat = railSeat(ARENA_THEME_LIST.length);

  return (
    <g>
      {[seat.plaque, seat.status].map(band => (
        <Recess
          key={band.top}
          theme={theme}
          x={seat.x}
          y={band.top}
          w={seat.width}
          h={band.height}
          r={RAIL.seat * 2}
        />
      ))}

      {seat.gems.map(gem => (
        <Recess
          key={gem.cx}
          theme={theme}
          x={gem.cx - gem.radius}
          y={gem.cy - gem.radius}
          w={gem.radius * 2}
          h={gem.radius * 2}
          r={gem.radius}
          round
        />
      ))}

      <Recess
        theme={theme}
        x={seat.leave.x - RAIL.seat}
        y={seat.leave.y - RAIL.seat}
        w={seat.leave.width + RAIL.seat * 2}
        h={seat.leave.height + RAIL.seat * 2}
        r={RAIL.seat * 2}
      />
    </g>
  );
}

/**
 * The lit part of a round opening's wall: the arc across the top of it, from
 * eight o'clock round to four, which is as much of the far wall as the lamp
 * reaches before the sides turn away from it.
 */
function topArc(cx: number, cy: number, r: number): string {
  const dx = r * 0.94;
  const dy = r * 0.342;
  return `M ${cx - dx} ${cy - dy} A ${r} ${r} 0 0 1 ${cx + dx} ${cy - dy}`;
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
  const inset = 26 + boardReach(spread);
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
