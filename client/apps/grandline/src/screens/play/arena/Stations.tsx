import {
  LEADER, LIGHT, SHELL, STAGE, WELL, leaderSeat, station, type Side,
} from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { nichePath, platePath } from "./board";
import Materials, { MATERIAL_MIX, materialFill } from "./materials";

/**
 * The two stations: three fittings each, mounted on the rim at the ends of
 * the board, with the board running on underneath them.
 *
 * One drawing, done twice from one set of numbers reflected about the seam.
 * In the middle of each end the plate: a piece of ivory standing on the rim
 * from the board's outer edge to the parchment's, over the brass and the
 * stone frame, with the leader's arched cavity cut into it, a brass retaining
 * frame round the opening, and its foot stepped out into two shoulders that
 * each carry a dark plate for a number. It is drawn here, above the surface,
 * because it reaches out over the parchment's edge and drops its shadow on
 * it. To one side of it, across a gap of bare rim, the dial's socket; to the
 * other, across the same gap, the counter rail — one brass frame with the
 * number's plate and the ten stone sockets in it. Nothing joins the three
 * but the board.
 *
 * Every hole is the same hole as every hole on the board — dark floor, the
 * walls' shadow across it from the lamp's side, a lit far wall, a brass lip
 * — and every raised piece is lit the same way, top and left edges to the
 * lamp, contact shadow down and to the right.
 *
 * What goes in the holes — the picture, the numbers, the stones, the dial's
 * glass — is gameplay, and is drawn by the things that own it, in HTML, at
 * the places measured here.
 */

const W = STAGE.width;
const H = STAGE.height;

/** A stroke on an outline, pushed a hair down and right, shows on the top and
    left edges of the shape it is clipped to: the edges that face the lamp. */
const TOWARDS_LAMP = `translate(${SHELL.lit} ${SHELL.lit})`;
/** Pushed up and left, it shows on the bottom and right: the walls of a hole
    the lamp reaches. */
const AWAY_FROM_LAMP = `translate(${-SHELL.lit} ${-SHELL.lit})`;

const LIT = 0.85;
const DARK = 0.8;

export default function Stations({ theme, spread = 0 }: {
  theme: ArenaTheme;
  spread?: number;
}) {
  const full = { x: -spread, y: 0, width: W + spread * 2, height: H };

  return (
    <svg
      viewBox={`${-spread} 0 ${W + spread * 2} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <Materials only={["stone", "brass"]} />

        {/* The same lamp, falloff, stone and brass as the structure, so the
            fittings are lit by the board's lamp and made of the board's
            materials. */}
        <radialGradient id="sn-lamp" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.82" />
          <stop offset="0.3" stopColor={theme.lamp} stopOpacity="0.4" />
          <stop offset="0.65" stopColor={theme.lamp} stopOpacity="0.1" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sn-falloff" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach * 1.16}>
          <stop offset="0" stopColor="#161C26" stopOpacity="0" />
          <stop offset="0.4" stopColor="#161C26" stopOpacity="0.16" />
          <stop offset="0.72" stopColor="#141A24" stopOpacity="0.46" />
          <stop offset="1" stopColor="#101620" stopOpacity="0.74" />
        </radialGradient>
        <linearGradient id="sn-stone" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY - 100} x2={0} y2={WELL.nearY + 100}>
          <stop offset="0" stopColor={theme.wing.light} />
          <stop offset="0.5" stopColor={theme.wing.mid} />
          <stop offset="1" stopColor={theme.wing.dark} />
        </linearGradient>
        <linearGradient id="sn-brass" gradientUnits="userSpaceOnUse" x1={WELL.farX0} y1={WELL.farY} x2={WELL.nearX1} y2={WELL.nearY}>
          <stop offset="0" stopColor={theme.gold.light} />
          <stop offset="0.16" stopColor={theme.gold.mid} />
          <stop offset="0.5" stopColor={theme.gold.dark} />
          <stop offset="1" stopColor={theme.gold.dark} />
        </linearGradient>
        <linearGradient id="sn-hole" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY} x2={0} y2={WELL.nearY}>
          <stop offset="0" stopColor={theme.bezel} />
          <stop offset="1" stopColor={theme.frameEdge} stopOpacity="0.85" />
        </linearGradient>

        <linearGradient id="sn-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <filter id="sn-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={SHELL.occlusion / 2} />
        </filter>
        <filter id="sn-cast" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx={SHELL.cast.dx} dy={SHELL.cast.dy} stdDeviation={SHELL.cast.blur} floodColor={theme.shadow} floodOpacity={0.85} />
        </filter>
      </defs>

      {(["far", "near"] as Side[]).map(side => (
        <Station key={side} theme={theme} side={side} full={full} />
      ))}
    </svg>
  );
}

function Station({ theme, side, full }: {
  theme: ArenaTheme;
  side: Side;
  full: { x: number; y: number; width: number; height: number };
}) {
  const seat = station(side);
  const leader = leaderSeat(side);
  const { stats, ability, channel, readout } = seat;
  const plate = platePath(side);
  const clipId = `sn-plate-${side}`;

  /** The opening in the plate, one seat's width outside the picture. */
  const cavity = nichePath(leader.x, leader.y, leader.width, leader.height, 0);
  /** The brass retaining frame's outer edge. */
  const frame = nichePath(leader.x, leader.y, leader.width, leader.height, -LEADER.trim);

  return (
    <g>
      <clipPath id={clipId}><path d={plate} /></clipPath>

      {/* ── The plate: ivory, standing on the rim ────────────────────────── */}
      <g filter="url(#sn-cast)">
        <path d={plate} fill="url(#sn-stone)" />
      </g>
      <g clipPath={`url(#${clipId})`}>
        <g style={{ mixBlendMode: MATERIAL_MIX.stone.blend }} opacity={MATERIAL_MIX.stone.opacity}>
          <rect {...full} fill={materialFill("stone")} />
        </g>
        <rect {...full} fill="url(#sn-lamp)" style={{ mixBlendMode: "soft-light" }} opacity="0.6" />
        <rect {...full} fill="url(#sn-falloff)" opacity="0.7" />
        <path d={plate} fill="none" stroke={theme.wing.light} strokeWidth={SHELL.lit} opacity={LIT * 0.7} transform={TOWARDS_LAMP} />
        {/* The bevel's shadow side: the plate's bottom and right edges, turned
            away from the lamp. */}
        <path d={plate} fill="none" stroke={theme.wingEdge} strokeWidth={SHELL.edge} opacity="0.5" transform={AWAY_FROM_LAMP} />
        {/* A brass line let into the plate a hair inside its edge, as on the
            reference. */}
        <path d={plate} fill="none" stroke={theme.gold.mid} strokeWidth={SHELL.edge * 2} opacity="0.55" />
      </g>
      <path d={plate} fill="none" stroke={theme.frameEdge} strokeWidth={SHELL.edge} />

      {/* ── The leader's cavity, with its brass retaining frame ──────────── */}
      <g filter="url(#sn-cast)">
        <path d={frame} fill="url(#sn-brass)" />
      </g>
      <clipPath id={`sn-frame-${side}`}><path d={frame} /></clipPath>
      <path d={frame} fill="none" stroke={theme.gold.dark} strokeWidth={SHELL.lit} opacity="0.85" />
      <path d={frame} fill="none" stroke={theme.gold.light} strokeWidth={SHELL.lit} opacity={LIT * 0.6} transform={TOWARDS_LAMP} clipPath={`url(#sn-frame-${side})`} />
      <Hole theme={theme} d={cavity} deep />
      {/* The seat's own edge, where the picture sits down into the cavity:
          one clean dark line, so the picture reads as set in rather than
          floating in a dark hole. */}
      <path d={nichePath(leader.x, leader.y, leader.width, leader.height, LEADER.picture)} fill="none" stroke={theme.bezel} strokeWidth={SHELL.lit} opacity="0.9" />

      {/* ── The number plates, on the shoulders ──────────────────────────── */}
      {stats.map(box => (
        <Recess key={box.x} theme={theme} x={box.x} y={box.y} w={box.width} h={box.height} r={SHELL.radius.hole / 2} />
      ))}

      {/* ── The dial's socket, across the gap ────────────────────────────── */}
      <Recess
        theme={theme}
        x={ability.cx - ability.radius}
        y={ability.cy - ability.radius}
        w={ability.radius * 2}
        h={ability.radius * 2}
        r={ability.radius}
        round
      />

      {/* ── The counter rail, across the other gap: a brass frame standing
             on the rim, with the recess inside it ───────────────────────── */}
      <Frame theme={theme} box={channel} />
      <Recess theme={theme} x={channel.x} y={channel.y} w={channel.width} h={channel.height} r={SHELL.radius.hole} />
      <Recess theme={theme} x={readout.x} y={readout.y} w={readout.width} h={readout.height} r={SHELL.radius.hole / 2} />
      {/* The glass over the track: one pale sheet across its upper half, which
          is where a pane catches the lamp. */}
      <rect x={channel.x + 2} y={channel.y + 2} width={channel.width - 4} height={channel.height / 2} rx={SHELL.radius.hole - 2} fill="url(#sn-glass)" />
    </g>
  );
}

/**
 * A brass frame standing proud of the rim round a recess: the structural edge
 * of a fitting that is mounted rather than cut. One band of brass the width
 * of the inlay, with the board's contact shadow under it.
 */
export function Frame({ theme, box, r = SHELL.radius.hole }: {
  theme: ArenaTheme;
  box: { x: number; y: number; width: number; height: number };
  r?: number;
}) {
  const out = SHELL.edge * 3;
  return (
    <g>
      <g filter="url(#sn-cast)">
        <rect x={box.x - out} y={box.y - out} width={box.width + out * 2} height={box.height + out * 2} rx={r + out} fill="url(#sn-brass)" />
      </g>
      <rect x={box.x - out} y={box.y - out} width={box.width + out * 2} height={box.height + out * 2} rx={r + out} fill="none" stroke={theme.gold.dark} strokeWidth={SHELL.lit} opacity="0.85" />
      <rect x={box.x - out + SHELL.lit} y={box.y - out + SHELL.lit} width={box.width + out * 2} height={box.height + out * 2} rx={r + out} fill="none" stroke={theme.gold.light} strokeWidth={SHELL.lit} opacity={LIT * 0.5} />
    </g>
  );
}

/**
 * A hole in the board, as a path. Every hole on the board is this one.
 *
 * Four things, in order: the floor, which is the dark every hole here is
 * floored with; the walls' shadow across it, pushed down and right so it lies
 * under the top and left walls, which are the ones between the lamp and the
 * floor; the bottom and right walls, which the lamp reaches, as one lit
 * hairline; and a brass lip round the opening, which is the trim every
 * fitting on this board is set in.
 */
function Hole({ theme, d, deep = false }: { theme: ArenaTheme; d: string; deep?: boolean }) {
  const id = `sn-hole-${hash(d)}`;
  return (
    <g>
      <clipPath id={id}><path d={d} /></clipPath>
      <path d={d} fill="url(#sn-hole)" />
      <g clipPath={`url(#${id})`}>
        <path d={d} fill="none" stroke={theme.shadow} strokeWidth={SHELL.occlusion * (deep ? 1.8 : 1)} filter="url(#sn-soft)" opacity={DARK} transform="translate(0 2)" />
        <path d={d} fill="none" stroke={theme.frameInlay} strokeWidth={SHELL.lit} opacity={LIT * 0.6} transform={AWAY_FROM_LAMP} />
      </g>
      <path d={d} fill="none" stroke={theme.gold.dark} strokeWidth={SHELL.lit} opacity="0.85" />
    </g>
  );
}

/** The same hole, as a rounded box or a circle. */
export function Recess({ theme, x, y, w, h, r, round = false }: {
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
  const d = round
    ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`
    : `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  return <Hole theme={theme} d={d} />;
}

/** A short stable id for a path, so each hole's clip is its own. */
function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
