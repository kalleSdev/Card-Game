import type { CSSProperties } from "react";
import type { BattleCard } from "@cg/battle";
import { LEADER, MOTION, STATION, leaderSeat, station, type Side } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { COLOR, text } from "../../../design/tokens";
import { artUrl, cardShortName } from "../../../data/pool";

/**
 * What stands in a leader's niche: the picture, the name, and the two numbers.
 *
 * A leader is not a card. It is never picked up, never laid down and never put
 * back in a deck, so it is not drawn as one: its picture is set into an opening
 * in the board and cropped to that opening's outline. That is why every leader
 * is framed identically whatever its art does, and why nothing here draws a card
 * border or a printed statline. What changes about a leader during a match is
 * what it hits for and what is left of it, and those two numbers sit on the
 * plates the station carries at the foot of the frame.
 *
 * The niche itself — the cavity in the stone, the brass retaining frame round
 * it, the plates, the dial's socket — is the board's, and the board draws it
 * in the stations layer. This draws only what changes during a match, at the
 * places the board measured, and draws no frame, plate or shadow of its own:
 * a picture with a shadow under it is a picture stuck on, and this one is set
 * in.
 *
 * The seat is one piece of geometry, taken from the stage and mirrored about the
 * board's seam, so the far leader and the near one are the same construction
 * seen from opposite ends of the table.
 */

// ── The one shape ────────────────────────────────────────────────────────────

const TRIM = LEADER.trim;

/** The smallest step this niche takes: the dark seat between the opening and
    the picture, and the offset of the one shadow drawn here. */
const LINE = LEADER.foot;

/** How far in from the opening the picture starts. */
const PICTURE = LEADER.picture;

/** How far outside the opening the target ring reaches, when there is one:
    over the brass frame, which is what it is aimed at. */
const TARGET = TRIM;

/** The bottom corners of the picture, before each ring outside it widens them. */
const FOOT = LEADER.foot;

/** The dial's bezel: the same finger of brass as the window's frame. */
const DIAL_RING = TRIM;

/** The seat's own geometry, which both ends of the board are cut from. */
const WINDOW = LEADER.window;

/**
 * The niche's outline, offset in or out, as one piece of geometry.
 *
 * The same outline the board cuts the cavity to (`nichePath` in board.ts),
 * given here relative to the window's own box so it can be a clip path on a
 * div. `inset` is how far inside the opening a layer sits: 0 is the opening,
 * PICTURE is the picture, and a negative number reaches outside it.
 * Offsetting works evenly because the dome's radius is half the window's
 * width, so every layer shares the dome's centre and comes out the same
 * thickness the whole way round.
 *
 * The shape is given twice, as a clip path and as a border radius, and the two
 * describe the same outline: the clip is what crops the picture and what the
 * glow is cast from, the radius is what clips a child and what the shape falls
 * back to anywhere a path clip is not honoured.
 */
function niche(inset: number): CSSProperties {
  const width = WINDOW.width - inset * 2;
  const height = WINDOW.height - inset * 2;
  // A half circle on top of straight sides, which is what makes it an arch
  // rather than a rounded rectangle
  const dome = width / 2;
  // Each layer turns its bottom corners wider than the one inside it by exactly
  // its own offset, which is what keeps the moulding even where it turns
  const foot = FOOT + (PICTURE - inset);

  const outline = `M 0 ${dome}`
    + ` A ${dome} ${dome} 0 0 1 ${width} ${dome}`
    + ` L ${width} ${height - foot}`
    + ` A ${foot} ${foot} 0 0 1 ${width - foot} ${height}`
    + ` L ${foot} ${height}`
    + ` A ${foot} ${foot} 0 0 1 0 ${height - foot}`
    + ` Z`;

  return {
    position: "absolute",
    left: inset,
    top: inset,
    width,
    height,
    clipPath: `path("${outline}")`,
    borderRadius: `${dome}px ${dome}px ${foot}px ${foot}px`,
  };
}

/**
 * How full the ability well is.
 *
 * The dial is drawn because the board has a socket for it in the same place on
 * both banners, and a socket left out would move everything around it. No
 * leader in this ruleset has an ability yet, so the well is drawn with nothing
 * in it and labelled rather than filled. When leaders do get abilities the fill
 * goes in here and nothing else on the banner has to be measured again.
 */
const ABILITY_PROGRESS: number = 0;

// ── The niche ────────────────────────────────────────────────────────────────

export default function LeaderNiche({ theme, end, card, attackable, active, onClick }: {
  theme: ArenaTheme;
  /** Whose leader this is. The board no longer paints the two sides apart. */
  side: "you" | "them";
  /** Which end of the board this leader stands at. */
  end: Side;
  card: BattleCard;
  attackable: boolean;
  active: boolean;
  onClick?: () => void;
}): JSX.Element {
  const hit = attackable && Boolean(onClick);
  const hurt = card.currentHp < card.maxHp;
  // The seat is the same seat at both ends of the board, mirrored about the
  // seam. Nothing here is measured for one player: the window is centred on the
  // board's middle line, set the same distance inside the board's outer edge,
  // and everything else is an offset inside that one box.
  const seat = leaderSeat(end);
  const { stats } = station(end);

  return (
    <div
      style={{
        position: "absolute",
        left: seat.x,
        top: seat.y,
        width: seat.width,
        height: seat.height,
      }}
    >
      {/*
        The opening. Nothing physical is drawn here: the cavity, the brass
        frame and the seat are the board's. What this wrapper carries is the
        state a player has to read off the leader — whose turn it is, and
        whether this one can be hit — as a ring over the brass frame, since a
        ring is the one thing a real board would not have and so reads as the
        game speaking rather than the furniture.
      */}
      <div
        onClick={hit ? onClick : undefined}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: hit ? "auto" : "none",
          cursor: hit ? "crosshair" : "default",
        }}
      >
        {/*
          The rings, and only while they mean something. Red comes from the
          app's palette rather than the table's: no theme owns a danger colour,
          and a table that had one would be arguing with the cards. The turn's
          ring is the board's own accent, faint, so it says "you" without
          lighting the leader up.
        */}
        {(attackable || active) && (
          <div
            style={{
              ...niche(-TARGET),
              background: attackable ? COLOR.signal : theme.accent,
              opacity: attackable ? 1 : 0.55,
              transition: `opacity ${MOTION.glow}ms ease-out`,
            }}
          />
        )}

        {/* The picture, cropped to the opening instead of to a card, a seat's
            width inside it so the cavity's dark shows round it. The dark fill
            underneath is what the opening reads as while the image is on its
            way, or if it never arrives */}
        <div
          style={{
            ...niche(PICTURE),
            overflow: "hidden",
            backgroundColor: theme.bezel,
            backgroundImage: `url("${artUrl(card.defId)}")`,
            backgroundSize: "cover",
            // A character's head is at the top of its picture and the dome is
            // where a head belongs, so the crop is anchored up there rather
            // than in the middle
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* The name is painted onto the board, not printed on a card: it says
              who stands in this niche. It is drawn whether or not the picture
              arrived, because a niche with a name in it reads as a window with
              someone in it either way, and a missing picture then leaves a
              labelled window rather than a hole */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: `${LINE}px ${TRIM}px`,
              backgroundImage: `linear-gradient(180deg, transparent, ${theme.bezel})`,
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              ...text("label"),
              color: theme.paint,
            }}
          >
            {cardShortName(card.defId)}
          </div>
        </div>
      </div>

      {/* The numbers, on the plates the station carries at each foot of the
          frame. Attack on the left and health on the right, the way they read
          on a card. Always both of them and always drawn even at zero. */}
      <StatPlate theme={theme} value={card.atk} box={stats[0]} seat={seat} />
      <StatPlate theme={theme} value={card.currentHp} hurt={hurt} box={stats[1]} seat={seat} />
    </div>
  );
}

// ── The numbers ──────────────────────────────────────────────────────────────

/**
 * One number, on the plate the board set into the station for it.
 *
 * There is no label on it. At this size a label would be smaller than it is
 * useful, and the two plates are always in the same two places, so position is
 * what says which is which. And there is no plate drawn here: the plate is a
 * hole in the stone with a brass lip, drawn by the board, and this is the
 * number painted onto its floor.
 */
function StatPlate({ theme, value, box, seat, hurt = false }: {
  theme: ArenaTheme;
  value: number;
  /** The plate the board cut for this number, on the stage. */
  box: { x: number; y: number; width: number; height: number };
  /** The window's own box, which this is placed relative to. */
  seat: { x: number; y: number };
  /** Health below its maximum. Attack never sets this. */
  hurt?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        top: box.y - seat.y,
        left: box.x - seat.x,
        width: box.width,
        height: box.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...text("data"),
        // A step up the type scale from the data size. These two numbers are
        // read from further away than anything else on the board, and the scale
        // has nothing between the two.
        fontSize: 18,
        color: hurt ? COLOR.signal : theme.gold.light,
        pointerEvents: "none",
      }}
    >
      {value}
    </div>
  );
}

// ── The dial ─────────────────────────────────────────────────────────────────

/**
 * The dial: a brass ring with a well in it, sitting in the socket the board
 * cut for it beside the leader.
 *
 * It is placed from the station rather than from the leader, because it is a
 * fitting in the board and not a part of the window. That is also why it takes
 * no FAR_SCALE: it has to land in a hole that was drawn full size. It throws
 * no shadow of its own: the socket it sits in is already dark round it, and a
 * ring with a shadow under it is a ring lying on the board.
 */
export function AbilityDial({ theme, end }: { theme: ArenaTheme; end: Side }): JSX.Element {
  const socket = station(end).ability;

  return (
    <div
      style={{
        position: "absolute",
        left: socket.cx - socket.dial / 2,
        top: socket.cy - socket.dial / 2,
        width: socket.dial,
        height: socket.dial,
        borderRadius: "50%",
        backgroundImage: `linear-gradient(160deg, ${theme.gold.light} 0%, ${theme.gold.mid} 45%, ${theme.gold.dark} 100%)`,
        // The lit top edge is a hairline of the brass ramp's own light, so the
        // ring reads as turned rather than as printed; the dark under-edge is
        // the bezel's own thickness against the socket floor.
        boxShadow: `inset 1px 1px 0 ${theme.gold.light}, inset -1px -1px 1px ${theme.gold.dark}, 1px 2px 3px rgba(0,0,0,0.5)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: STATION.dial - DIAL_RING * 2,
          height: STATION.dial - DIAL_RING * 2,
          borderRadius: "50%",
          border: `1px solid ${theme.gold.dark}`,
          // The empty glass is laid over an opaque dark, so the brass behind it
          // does not show through and muddy the lettering
          backgroundColor: theme.bezel,
          backgroundImage: `conic-gradient(${theme.gem.mid} ${ABILITY_PROGRESS * 360}deg, ${theme.gemEmpty} 0deg), radial-gradient(ellipse 70% 45% at 40% 22%, rgba(255,255,255,0.14), transparent 70%)`,
          boxShadow: `inset 0 ${LINE}px ${TRIM}px ${theme.shadow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...text("label"),
          color: theme.gold.light,
        }}
      >
        Ability
      </div>
    </div>
  );
}
