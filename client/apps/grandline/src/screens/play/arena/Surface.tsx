import { HAZE, LIGHT, SHELL, STAGE, WELL } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { surfacePath, wellPath } from "./board";
import Materials, { MATERIAL_MIX, materialFill } from "./materials";

/**
 * The playing surface, set down inside the well.
 *
 * It is smaller than the opening it sits in, because it is lower: the rim
 * overhangs it all the way round, which is what puts it inside the board
 * rather than on top of it. The overhang throws a shadow onto it, heaviest
 * along the near edge where the rim is between it and the lamp.
 *
 * The far half is greyer than the near one. That is the air between the two
 * ends of the board, and it is the cheapest depth cue there is: it costs one
 * gradient and it does more work than any amount of shading on the rim.
 *
 * The parchment is the quietest material on the board on purpose. Cards sit on
 * this and nothing else does, so the surface has to hold grain without holding
 * attention. Its tile is larger than the surface itself, which means the one
 * thing a player stares at all game has no repeat in it anywhere.
 *
 * What stops it reading as one flat fill is four things, none of which you are
 * meant to be able to point at.
 *
 * The light across it is directional, not radial. It used to be a circle
 * centred on the lamp, which is what a spotlight looks like rather than what a
 * lit table looks like: a surface this size under a lamp this far away gets a
 * broad gradient across it, so that is what it gets now, leaning the way the
 * lamp leans.
 *
 * The paper's own tone varies in patches. Seven of them, none above six per
 * cent, at deliberately unequal sizes and unequal distances from each other,
 * because paper is never one colour across a metre of it. The faintest and
 * broadest is the one in the middle: the centre has to stay calm, since that is
 * where the cards are, but calm is not the same as blank.
 *
 * The grain is masked to be quieter in the middle and stronger out at the
 * edges. Same material, same tile, but the character comes up where there is
 * nothing to read and stands down where there is.
 *
 * And there are fibres and a few marks in it — hairlines a unit and a half
 * wide, which is about one screen pixel, so they read as the tooth of the paper
 * rather than as damage to it.
 *
 * Every one of those amplitudes was measured rather than guessed. The first
 * version of all of it was set by eye at three to six per cent and turned out
 * to be doing literally nothing: rasterised and sampled, the surface came back
 * with the same tonal spread with the whole lot removed as with it in. What is
 * here now is the value at which each part starts to register, and no more.
 */

const W = STAGE.width;
const H = STAGE.height;

/** The surface's own bounds, which everything on it is placed against. */
const FELT = {
  x0: WELL.farX0 + WELL.depth,
  x1: WELL.farX1 - WELL.depth,
  y0: WELL.farY + WELL.depth / 2,
  y1: WELL.nearY - WELL.depth / 2,
  get width() { return this.x1 - this.x0; },
  get height() { return this.y1 - this.y0; },
} as const;

/**
 * A fixed number between nought and one, for a given pair of whole numbers.
 *
 * A function rather than a generator, so the fibres in this sheet of paper are
 * the same fibres on every render. Anything that re-rolled would crawl across
 * the surface whenever a card was played, which on the one surface a player
 * stares at all game would be unbearable.
 */
function noise(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * How the paper's tone varies across the sheet.
 *
 * Placed by hand rather than by the noise, because the one rule that matters
 * is that the middle stays calm and no arrangement a random function comes up
 * with can be trusted to honour it. Unequal sizes and unequal gaps: patches on
 * a grid read as a pattern however faint they are.
 *
 * `up` lightens towards the paper's own pale, `down` darkens towards its own
 * shade. Neither borrows a colour from anywhere else, because this is the tone
 * of the material rather than light falling on it.
 */
const PATCHES: { cx: number; cy: number; rx: number; ry: number; o: number; up: boolean }[] = [
  { cx: 380, cy: WELL.farY + 6, rx: 300, ry: 190, o: 0.3, up: true },
  { cx: 1120, cy: WELL.farY + 26, rx: 280, ry: 200, o: 0.33, up: false },
  { cx: 300, cy: WELL.farY + 338, rx: 260, ry: 160, o: 0.27, up: false },
  { cx: 900, cy: WELL.farY + 294, rx: 250, ry: 170, o: 0.21, up: true },
  { cx: 646, cy: WELL.farY + -22, rx: 190, ry: 112, o: 0.18, up: false },
  { cx: 1004, cy: WELL.farY + 376, rx: 220, ry: 120, o: 0.24, up: false },
  // Two gentler ones over the middle. There was a single broad lightener here
  // and it had to go: laid over the body gradient it cancelled some of it, so
  // the one patch meant to keep the centre from being blank was measurably
  // flattening it instead. Two smaller ones pulling opposite ways add
  // variation where one large one removed it.
  { cx: 620, cy: WELL.farY + 106, rx: 200, ry: 130, o: 0.09, up: false },
  { cx: 830, cy: WELL.farY + 216, rx: 190, ry: 120, o: 0.07, up: true },
];

/**
 * The fibres: long, almost horizontal, following the sheet's own long axis.
 *
 * Eighteen of them in one path, so the whole of the grain costs a single
 * element. Their opacity is set once on the path rather than per line, which is
 * why they are all the same weight — a sheet of paper does not have some fibres
 * that stand out.
 */
const FIBRES = Array.from({ length: 18 }, (_unused, i) => {
  const y = FELT.y0 + 14 + noise(i, 0) * (FELT.height - 28);
  const from = FELT.x0 + noise(i, 1) * FELT.width * 0.55;
  const run = FELT.width * (0.18 + noise(i, 2) * 0.34);
  const lean = (noise(i, 3) - 0.5) * 16;
  return `M ${round(from)} ${round(y)} L ${round(from + run)} ${round(y + lean)}`;
}).join(" ");

/**
 * A few marks, from whatever has been slid across this over the years.
 *
 * Short, steeper than the fibres and kept out towards the ends of the sheet,
 * where the cards are not. Five is enough: a surface with a dozen visible
 * scratches is a damaged surface, and this one is supposed to read as looked
 * after.
 */
const MARKS = Array.from({ length: 5 }, (_unused, i) => {
  const side = i % 2 === 0 ? 0 : 1;
  const x = FELT.x0 + 40 + side * (FELT.width - 200) + noise(i, 4) * 120;
  const y = FELT.y0 + 40 + noise(i, 5) * (FELT.height - 80);
  const run = 30 + noise(i, 6) * 60;
  const drop = (noise(i, 7) - 0.5) * 44;
  return `M ${round(x)} ${round(y)} L ${round(x + run)} ${round(y + drop)}`;
}).join(" ");

export default function Surface({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** Only widens the box this is drawn into. The surface itself never moves. */
  spread?: number;
}) {
  const surface = surfacePath();

  return (
    <svg
      viewBox={`${-spread} 0 ${W + spread * 2} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <Materials only={["parchment"]} />

        {/*
          Lit across, not lit from a point. The lamp is a long way off the
          board's own scale, so what a surface this size gets from it is a
          broad gradient leaning the way the lamp leans — up and a little to
          the left — rather than a circle of brightness with the paper falling
          away around it. The old radial was a spotlight; this is a table.
        */}
        <linearGradient
          id="sf-body"
          gradientUnits="userSpaceOnUse"
          x1={LIGHT.x - 260}
          y1={WELL.farY}
          x2={LIGHT.x + 420}
          y2={WELL.nearY}
        >
          <stop offset="0" stopColor={theme.felt.light} />
          <stop offset="0.38" stopColor={theme.felt.mid} />
          <stop offset="1" stopColor={theme.felt.dark} />
        </linearGradient>

        {/* Where the paper's own tone runs pale, and where it runs dark. */}
        <radialGradient id="sf-up" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.felt.light} stopOpacity="1" />
          <stop offset="0.55" stopColor={theme.felt.light} stopOpacity="0.55" />
          <stop offset="1" stopColor={theme.felt.light} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sf-down" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.felt.dark} stopOpacity="1" />
          <stop offset="0.55" stopColor={theme.felt.dark} stopOpacity="0.55" />
          <stop offset="1" stopColor={theme.felt.dark} stopOpacity="0" />
        </radialGradient>

        {/*
          How much grain is allowed where. Black hides the tile and white shows
          it, so this is quiet across the middle — where five cards and their
          numbers have to be read — and comes up towards the edges, where there
          is nothing to compete with. Same material either way: what changes is
          how much of it you are being shown.
        */}
        <radialGradient id="sf-grain-fade" cx="0.5" cy="0.5" r="0.58">
          <stop offset="0" stopColor="#6E6E6E" />
          <stop offset="0.5" stopColor="#909090" />
          <stop offset="1" stopColor="#FFFFFF" />
        </radialGradient>
        <mask id="sf-grain-mask" maskContentUnits="userSpaceOnUse">
          <path d={surface} fill="url(#sf-grain-fade)" />
        </mask>

        {/* The far wall of the recess, and the shade at the foot of it. */}
        <linearGradient id="sf-far" gradientUnits="userSpaceOnUse" x1={0} y1={FELT.y0} x2={0} y2={FELT.y0 + 96}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* The near end of the surface is furthest from the lamp, and the
            board's own near rim stands between the two. */}
        <linearGradient id="sf-fall" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.seamY} x2={0} y2={WELL.nearY}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.34" />
        </linearGradient>

        {/* The air over the far half. */}
        <linearGradient id="sf-haze" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY} x2={0} y2={WELL.seamY}>
          <stop offset="0" stopColor={theme.hazeTint} stopOpacity={HAZE} />
          <stop offset="1" stopColor={theme.hazeTint} stopOpacity="0" />
        </linearGradient>

        {/* The seam: drawn, then rubbed out at both ends, so it separates the
            halves without fencing them off. */}
        <linearGradient id="sf-seam" gradientUnits="userSpaceOnUse" x1={WELL.nearX0} y1={0} x2={WELL.nearX1} y2={0}>
          <stop offset="0" stopColor={theme.seam} stopOpacity="0" />
          <stop offset="0.25" stopColor={theme.seam} stopOpacity="1" />
          <stop offset="0.75" stopColor={theme.seam} stopOpacity="1" />
          <stop offset="1" stopColor={theme.seam} stopOpacity="0" />
        </linearGradient>

        <filter id="sf-soft" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation={WELL.depth} />
        </filter>

        <clipPath id="sf-clip"><path d={surface} /></clipPath>
      </defs>

      <path d={surface} fill="url(#sf-body)" />

      {/* The paper's own tone, varying across the sheet. Under the grain, not
          over it: this is what the material is, and the grain is what it looks
          like close up. */}
      <g clipPath="url(#sf-clip)">
        {PATCHES.map(patch => (
          <ellipse
            key={`${patch.cx}-${patch.cy}`}
            cx={patch.cx}
            cy={patch.cy}
            rx={patch.rx}
            ry={patch.ry}
            fill={patch.up ? "url(#sf-up)" : "url(#sf-down)"}
            opacity={patch.o}
          />
        ))}
      </g>

      {/* The grain, mixed into the tint rather than painted over it, and masked
          so it is quieter under the cards than out at the edges. A little more
          of it than before overall, because it now has somewhere to be. */}
      <g
        mask="url(#sf-grain-mask)"
        style={{ mixBlendMode: MATERIAL_MIX.parchment.blend }}
        opacity={MATERIAL_MIX.parchment.opacity * 1.5}
      >
        <rect x={-spread} y={0} width={W + spread * 2} height={H} fill={materialFill("parchment")} />
      </g>

      {/* The fibres and the marks. */}
      <g clipPath="url(#sf-clip)">
        <path d={FIBRES} stroke={theme.feltEdge} strokeWidth={1.5} fill="none" opacity="0.15" />
        <path d={FIBRES} stroke={theme.felt.light} strokeWidth={1.2} fill="none" opacity="0.1" transform="translate(0 1.4)" />
        <path d={MARKS} stroke={theme.feltEdge} strokeWidth={1.8} fill="none" opacity="0.18" strokeLinecap="round" />
      </g>

      <g clipPath="url(#sf-clip)">
        {/* What the rim above it throws onto it. */}
        <path
          d={wellPath()}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={WELL.depth * 3.4}
          filter="url(#sf-soft)"
          opacity="0.92"
        />
        {/* And again along the near edge only, unblurred and tight, because
            the rim there stands between the surface and the lamp and is the
            one wall of the recess that throws a hard shadow. */}
        <path
          d={`M ${WELL.nearX0} ${WELL.nearY - WELL.depth / 2} L ${WELL.nearX1} ${WELL.nearY - WELL.depth / 2}`}
          stroke={theme.shadow}
          strokeWidth={WELL.depth * 1.5}
          opacity="0.5"
        />

        {/* The far wall of the recess: shallower than the near one, because the
            lamp is over that end and reaches down into it. */}
        <rect x={-spread} y={FELT.y0} width={W + spread * 2} height={96} fill="url(#sf-far)" />


        <rect x={-spread} y={WELL.farY} width={W + spread * 2} height={WELL.height / 2} fill="url(#sf-haze)" />
        <rect x={-spread} y={WELL.seamY} width={W + spread * 2} height={WELL.height / 2} fill="url(#sf-fall)" />

        <path
          d={`M ${WELL.nearX0} ${WELL.seamY} L ${WELL.nearX1} ${WELL.seamY}`}
          stroke="url(#sf-seam)"
          strokeWidth="1.5"
        />
      </g>

      {/* The paper's own edge, where it stops and the recess floor shows. */}
      <path d={surface} fill="none" stroke={theme.feltEdge} strokeWidth={SHELL.lit} opacity="0.8" />
    </svg>
  );
}
