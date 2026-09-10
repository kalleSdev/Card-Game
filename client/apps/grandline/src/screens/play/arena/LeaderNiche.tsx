import type { CSSProperties } from "react";
import type { BattleCard } from "@cg/battle";
import {
  ABILITY, BAND, LEADER_STATS, LEADER_WINDOW, MOTION, STAGE,
} from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { COLOR, RADIUS, TEXT, text } from "../../../design/tokens";
import { artUrl, cardShortName } from "../../../data/pool";

/**
 * The niche a leader stands in: an arched window cut into the board, brass
 * around it, two numbers under it and a dial beside it.
 *
 * A leader is not a card. It is never picked up, never laid down and never put
 * back in a deck, so it is not drawn as one: its picture is set into an opening
 * in the board and cropped to that opening's outline. That is why every leader
 * is framed identically whatever its art does, and why nothing here draws a card
 * border or a printed statline. What changes about a leader during a match is
 * what it hits for and what is left of it, and those two numbers are set into
 * the board beneath it, which is where a person looks for a number.
 *
 * Everything is measured off the window. The moulding, the seat the picture sits
 * in, the stat plates and the dial are all offsets from one outline, so the
 * board carries one shape rather than several that nearly agree.
 */

// ── The one shape ────────────────────────────────────────────────────────────

const TRIM = LEADER_WINDOW.trim;

/**
 * The smallest step this niche takes: a third of the moulding. It is the
 * keyline of banner trim at the window's outer edge, the dark seat the picture
 * is set into, and the offset of every shadow. Anything finer stops reading once
 * the whole stage is scaled down to a laptop.
 */
const LINE = TRIM / 3;

/** How far in from the window's edge the picture starts: keyline, moulding, seat. */
const PICTURE = LINE + TRIM + LINE;

/** How far outside the window the target ring reaches, when there is one. */
const TARGET = TRIM;

/** The bottom corners of the picture, before each ring outside it widens them. */
const FOOT = LINE;

/**
 * The dial's ring is drawn twice the thickness of the window's moulding,
 * because it is the heavier of the two brass pieces standing on a banner.
 */
const DIAL_RING = TRIM * 2;

/**
 * The niche's outline, offset in or out, as one piece of geometry.
 *
 * `inset` is how far inside the window's own edge a layer sits: 0 is the window
 * as it is cut into the board, PICTURE is the picture, and a negative number
 * reaches outside it. Offsetting works evenly because the dome's radius is half
 * the window's width, so every layer shares the dome's centre and comes out the
 * same thickness the whole way round. Without that, a stack of these would read
 * as several rings rather than as one moulding.
 *
 * The shape is given twice, as a clip path and as a border radius, and the two
 * describe the same outline: the clip is what crops the picture and what the
 * glow is cast from, the radius is what clips a child and what the shape falls
 * back to anywhere a path clip is not honoured.
 */
function niche(inset: number): CSSProperties {
  const width = LEADER_WINDOW.width - inset * 2;
  const height = LEADER_WINDOW.height - inset * 2;
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

export default function LeaderNiche({ theme, side, facing, card, attackable, active, onClick }: {
  theme: ArenaTheme;
  /** Which banner this leader flies, which is only used for the trim colour. */
  side: "you" | "them";
  /** "down" for the far player at the top of the board, "up" for the near player. */
  facing: "up" | "down";
  card: BattleCard;
  attackable: boolean;
  active: boolean;
  onClick?: () => void;
}): JSX.Element {
  const hit = attackable && Boolean(onClick);
  const hurt = card.currentHp < card.maxHp;

  return (
    <div
      style={{
        position: "absolute",
        // Pushed left by half the dial's offset, so the window and the dial
        // together sit on the middle of the board rather than the window alone
        left: STAGE.width / 2 - ABILITY.offset / 2 - LEADER_WINDOW.width / 2,
        // The window is exactly as tall as a wing band, so it fills the band it
        // belongs to: hung from the top of that band up there, stood on the
        // bottom of it down here. Both are worked out as a top rather than one
        // as a bottom, so the two sides are measured the same way and neither
        // depends on how tall the thing it is rendered into turns out to be.
        top: facing === "down"
          ? BAND.enemyWing.top
          : BAND.yourWing.top + BAND.yourWing.height - LEADER_WINDOW.height,
        width: LEADER_WINDOW.width,
        height: LEADER_WINDOW.height,
        // In front of the banner it is set into, and its stat plates hang over
        // the playing surface
      }}
    >
      {/*
        The window, in layers from the outside in. The glow and the shadow live
        on this wrapper as filters rather than on the moulding as a box shadow,
        because a drop shadow is cast from the shape after it has been clipped
        and so follows the arch, while a box shadow only ever knows about the box.
      */}
      <div
        onClick={hit ? onClick : undefined}
        style={{
          position: "absolute",
          inset: 0,
          cursor: hit ? "crosshair" : "default",
          filter: [
            `drop-shadow(0 ${LINE}px ${TRIM}px ${theme.shadow})`,
            // Whose turn it is has to be readable from the leader on its own,
            // since that is the one thing on a side a player is already looking
            // at. Two passes, because one hard-edged halo reads as an outline.
            active ? `drop-shadow(0 0 ${TRIM}px ${theme.accent})` : "",
            active ? `drop-shadow(0 0 ${TRIM * 2}px ${theme.accent})` : "",
            attackable ? `drop-shadow(0 0 ${TRIM}px ${COLOR.signal})` : "",
          ].filter(Boolean).join(" "),
          transition: `filter ${MOTION.glow}ms ease-out`,
        }}
      >
        {/*
          The target ring, and only while this leader can actually be hit, so it
          reads as the answer to a question the player has just asked. Red comes
          from the app's palette rather than the table's: no theme owns a danger
          colour, and a table that had one would be arguing with the cards.
        */}
        {attackable && <div style={{ ...niche(-TARGET), background: COLOR.signal }} />}

        {/* The banner's trim line, carried round the window, so the niche reads
            as part of the banner it stands on rather than as something laid on it */}
        <div style={{ ...niche(0), background: theme.bannerTrim[side] }} />

        {/* The moulding. One light-to-dark ramp down the whole shape does the
            work of a round profile: every face that turns towards the top of the
            screen catches the light, every face that turns away sits in shadow,
            including the inside of the bottom rail, which is lighter than its
            outside for exactly that reason */}
        <div
          style={{
            ...niche(LINE),
            backgroundImage: `linear-gradient(180deg, ${theme.gold.light} 0%, ${theme.gold.mid} 40%, ${theme.gold.dark} 100%)`,
          }}
        />

        {/* The dark seat: what you would see looking into a real opening, where
            the picture sits a little below the brass around it */}
        <div style={{ ...niche(LINE + TRIM), background: theme.bezel }} />

        {/* The picture, cropped to the window instead of to a card. The dark
            fill underneath is what the opening reads as while the image is on
            its way, or if it never arrives */}
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
              color: theme.frame.light,
            }}
          >
            {cardShortName(card.defId)}
          </div>
        </div>
      </div>

      {/* The numbers, under the window for both players, because under is where
          the eye goes for one. Attack on the left, health on the right, always
          both of them and always drawn even at zero: a box that vanishes is a
          board that moves */}
      <div
        style={{
          position: "absolute",
          left: (LEADER_WINDOW.width - (LEADER_STATS.boxWidth * 2 + LEADER_STATS.gap)) / 2,
          top: LEADER_WINDOW.height + LEADER_STATS.drop,
          display: "flex",
          gap: LEADER_STATS.gap,
        }}
      >
        <StatPlate theme={theme} value={card.atk} />
        <StatPlate theme={theme} value={card.currentHp} hurt={hurt} />
      </div>

      <AbilityDial theme={theme} />
    </div>
  );
}

// ── The numbers ──────────────────────────────────────────────────────────────

/**
 * One number, on a plate set into the board.
 *
 * There is no label on it. At this size a label would be smaller than it is
 * useful, and the two plates are always in the same two places, so position is
 * what says which is which.
 */
function StatPlate({ theme, value, hurt = false }: {
  theme: ArenaTheme;
  value: number;
  /** Health below its maximum. Attack never sets this. */
  hurt?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        width: LEADER_STATS.boxWidth,
        height: LEADER_STATS.boxHeight,
        borderRadius: RADIUS.sm,
        background: theme.bezel,
        border: `1px solid ${theme.gold.mid}`,
        // Sunk, not raised: the shadow falls from the top inside edge, which is
        // what tells the eye the plate is below the board's surface. The second
        // one is what the plate drops onto whatever it is hanging over.
        boxShadow: `inset 0 ${LINE}px ${LINE}px ${theme.shadow}, 0 ${LINE}px ${LINE}px ${theme.shadow}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...text("data"),
        // A step up the type scale from the data size. These two numbers are
        // read from further away than anything else on the board, and the scale
        // has nothing between the two.
        fontSize: TEXT.heading.size,
        color: hurt ? COLOR.signal : theme.gold.light,
      }}
    >
      {value}
    </div>
  );
}

// ── The dial ─────────────────────────────────────────────────────────────────

/**
 * The dial beside the leader: a brass ring with a well in it.
 *
 * It is placed off the window's centre, which is what keeps it in the same spot
 * on both banners however the rest of the band is filled.
 */
function AbilityDial({ theme }: { theme: ArenaTheme }): JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        left: LEADER_WINDOW.width / 2 + ABILITY.offset - ABILITY.size / 2,
        top: LEADER_WINDOW.height / 2 - ABILITY.size / 2,
        width: ABILITY.size,
        height: ABILITY.size,
        borderRadius: "50%",
        backgroundImage: `linear-gradient(180deg, ${theme.gold.light} 0%, ${theme.gold.mid} 40%, ${theme.gold.dark} 100%)`,
        // The lit top edge is a hairline of the brass ramp's own light, so the
        // ring reads as turned rather than as printed
        boxShadow: `0 ${LINE}px ${TRIM}px ${theme.shadow}, inset 0 ${LINE}px 0 ${theme.gold.light}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: ABILITY.size - DIAL_RING * 2,
          height: ABILITY.size - DIAL_RING * 2,
          borderRadius: "50%",
          border: `1px solid ${theme.gold.dark}`,
          // The empty glass is laid over an opaque dark, so the brass behind it
          // does not show through and muddy the lettering
          backgroundColor: theme.bezel,
          backgroundImage: `conic-gradient(${theme.gem.mid} ${ABILITY_PROGRESS * 360}deg, ${theme.gemEmpty} 0deg)`,
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
