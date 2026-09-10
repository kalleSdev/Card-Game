import type { BattleCard, BattlePlayer } from "@cg/battle";
import {
  CARD, LEADER_STATS, LEADER_WINDOW, MOTION, STAGE, wellEdges,
} from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { COLOR, RADIUS, text } from "../../../design/tokens";
import PrintCard from "../../../components/PrintCard";
import { cardFace } from "../../../data/pool";

/**
 * One side's cards in play, lying on the parchment.
 *
 * A card in play is the same object as a card in a binder, so it is the same
 * component at the same size: the board does not print its own version of a
 * card, it just puts the card down and writes the live numbers on it.
 *
 * The row closes up. At rest only the cards that are actually there are drawn,
 * shoulder to shoulder in the middle, because a board with two cards on it
 * should read as a pair standing in front of its leader and not as two cards
 * stranded at one end of the table. That falls apart the moment someone is
 * holding a card, since a closed row cannot say which place a card would land
 * in, so while a card is being placed every empty slot appears where it really
 * is and the row admits its own order.
 *
 * The row knows nothing about the rules. It is told which of its cards may be
 * attacked and which one is picked up, and it reports clicks back.
 */

/**
 * Numbers this row needs that the stage does not name, each worked out from one
 * that it does.
 */

/**
 * The middle of the field is not the middle of the board: the left rail and the
 * right rail are different widths. Cards line up on the board's middle, since
 * that is what the leader niche below them and the seam between the halves are
 * centred on, so the row is pulled over by the difference.
 */
/**
 * A row sits in the middle of the well at its own depth.
 *
 * The well tapers, so "the middle" is not a fixed number: it is asked for at
 * the depth the row is actually drawn at. A row placed on the stage's middle
 * instead would drift off the surface as the board narrows.
 */
function wellCentre(y: number): number {
  const edges = wellEdges(y);
  return (edges.x0 + edges.x1) / 2;
}

/**
 * The bright rule on a picked-up card, the rim of an empty recess and the ring
 * around a target are all read from across the board rather than up close, so
 * they are painted trim rather than hairlines: the trim around a leader window,
 * thinned to a third of itself because it runs along a card instead of framing
 * a picture.
 */
const EDGE = Math.round(LEADER_WINDOW.trim / 3);

/**
 * A card's two stat boxes sit on its bottom edge with the leader's gap between
 * them and the same gap again at either end, which is what settles their width.
 * The height then follows the leader box's proportions, so the numbers on a
 * card and the numbers under a leader read as the same fitting at two sizes.
 */
const STAT = {
  width: (CARD.play - LEADER_STATS.gap * 3) / 2,
  height: Math.round(
    ((CARD.play - LEADER_STATS.gap * 3) / 2) * (LEADER_STATS.boxHeight / LEADER_STATS.boxWidth),
  ),
  inset: LEADER_STATS.gap,
  /** The leader's boxes hang this far clear of its window. These hang the same
      distance clear of the card's bottom edge, so nothing sits flush. */
  drop: LEADER_STATS.drop,
} as const;

/** The board's own duration, on the curve the rest of the app moves on. */
const CARD_MOVE = `${MOTION.card}ms cubic-bezier(0.2, 0, 0.2, 1)`;

/**
 * A card that has already acted. Dimmer and drained of some of its colour,
 * because "can this still do something" is the question a player asks of the
 * board more often than any other, and it should be answerable without reading
 * a single number.
 */
const SPENT = "saturate(0.5) brightness(0.76)";

export default function BoardRow({
  theme, band, align, player, attackable, selected, onCard, onSlot,
}: {
  theme: ArenaTheme;
  /** Which half of the surface this row occupies. */
  band: { top: number; height: number };
  align: "top" | "bottom";
  player: BattlePlayer;
  attackable: boolean;
  selected: string | null;
  onCard: (card: BattleCard) => void;
  /** Given only while a card is waiting to be put down. */
  onSlot?: (slot: number) => void;
}): JSX.Element {
  // Held in a local so the check below carries into the click handlers.
  const place = onSlot;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: STAGE.width,
        paddingLeft: (wellCentre(band.top + band.height / 2) - STAGE.width / 2) * 2,
        top: band.top,
        height: band.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: CARD.gap,
        // The row is as wide as the field but is mostly empty parchment. The
        // clicks belong to the cards, not to the space around them.
        pointerEvents: "none",
      }}
    >
      {player.board.map((card, slot) => {
        // A card at nothing hp is on its way off the board, and the space it
        // leaves is a space a card can be put in.
        if (card === null || card.currentHp <= 0) {
          if (place === undefined) return null;
          return (
            <EmptySlot
              key={`slot-${slot}`}
              theme={theme}
              live
              onClick={() => place(slot)}
            />
          );
        }
        return (
          <BoardCard
            key={card.instanceId}
            theme={theme}
            card={card}
            align={align}
            selected={selected === card.instanceId}
            attackable={attackable}
            onClick={() => onCard(card)}
          />
        );
      })}
    </div>
  );
}

function BoardCard({ theme, card, align, selected, attackable, onClick }: {
  theme: ArenaTheme;
  card: BattleCard;
  align: "top" | "bottom";
  selected: boolean;
  attackable: boolean;
  onClick: () => void;
}) {
  const spent = card.exhausted || card.stunTurns > 0;
  const hurt = card.currentHp < card.maxHp;
  // A picked-up card leans towards the seam, which is the way it is about to go.
  // The smaller of the two lifts: the long one belongs to a card coming out of a
  // hand, where there is room, and a card on the surface has half a board.
  const lean = align === "top" ? CARD.hover : -CARD.hover;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: CARD.play,
        flex: "0 0 auto",
        pointerEvents: "auto",
        cursor: attackable ? "crosshair" : "pointer",
        transform: selected ? `translateY(${lean}px)` : "none",
        transition: `transform ${CARD_MOVE}, filter ${CARD_MOVE}`,
        // Lit from above like everything else on this board, so the shadow drops
        // by the trim's thickness and spreads by the gap between two cards,
        // which keeps it off the card next door.
        filter: `${spent ? `${SPENT} ` : ""}drop-shadow(0 ${EDGE}px ${CARD.gap}px ${theme.shadow})`,
        // Only against its own neighbours: a leaning card passes over the card
        // beside it, and the board's layering is not this row's business.
        zIndex: selected ? 1 : 0,
      }}
    >
      <PrintCard
        card={cardFace(card.defId)}
        print="base"
        width={CARD.play}
        interactive={false}
        stats={false}
      />

      {/* What the card is worth right now, which is not what its print says. */}
      <span
        style={{
          position: "absolute",
          left: STAT.inset,
          right: STAT.inset,
          bottom: STAT.drop,
          display: "flex",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}
      >
        <StatBox theme={theme} value={card.atk} rim={theme.gold.mid} ink={theme.gold.light} />
        <StatBox
          theme={theme}
          value={card.currentHp}
          rim={hurt ? COLOR.signal : theme.gold.mid}
          ink={hurt ? COLOR.signal : theme.gold.light}
        />
      </span>

      <LeadingRule theme={theme} align={align} on={selected} />
      <TargetRing on={attackable} />
    </div>
  );
}

/**
 * One live number, in the same box the leader wears.
 *
 * Brass on near black, because the box has to hold its own over whatever the
 * picture behind it happens to be. A number that has been knocked down takes
 * the app's danger red rather than a colour from the board: the tables are
 * painted warm, cold and loud, and damage has to mean the same thing on all
 * three, so it is the one colour here that does not come from the theme.
 */
function StatBox({ theme, value, rim, ink }: {
  theme: ArenaTheme;
  value: number;
  rim: string;
  ink: string;
}) {
  return (
    <span
      style={{
        width: STAT.width,
        height: STAT.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: RADIUS.sm,
        background: theme.bezel,
        border: `1px solid ${rim}`,
        ...text("data"),
        color: ink,
        transition: `color ${CARD_MOVE}, border-color ${CARD_MOVE}`,
      }}
    >
      {value}
    </span>
  );
}

/**
 * The rule along the edge a picked-up card points at. It is drawn whether the
 * card is picked up or not and fades in, so a card that is chosen and a card
 * that is put back move the same way.
 */
function LeadingRule({ theme, align, on }: {
  theme: ArenaTheme;
  align: "top" | "bottom";
  on: boolean;
}) {
  return (
    <span
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...(align === "top" ? { bottom: 0 } : { top: 0 }),
        height: EDGE,
        borderRadius: RADIUS.sm,
        background: theme.accent,
        boxShadow: `0 0 ${CARD.gap}px ${theme.accent}`,
        opacity: on ? 1 : 0,
        transition: `opacity ${CARD_MOVE}`,
        pointerEvents: "none",
      }}
    />
  );
}

/** A ring around a card that can be hit right now. Sits outside the card's own
    border so it reads as something aimed at the card rather than part of it. */
function TargetRing({ on }: { on: boolean }) {
  return (
    <span
      style={{
        position: "absolute",
        inset: -EDGE,
        borderRadius: RADIUS.lg,
        border: `${EDGE}px solid ${COLOR.signal}`,
        boxShadow: `0 0 ${CARD.gap}px ${COLOR.signal}`,
        opacity: on ? 1 : 0,
        transition: `opacity ${CARD_MOVE}`,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * An empty place on the surface: a shallow recess pressed into the parchment,
 * exactly the size of a card so that dropping one into it moves nothing.
 *
 * At rest it is a dark dent with a dashed rim, which is what a place that
 * cannot take a card looks like. When it can, it lights up and asks.
 */
function EmptySlot({ theme, live, onClick }: {
  theme: ArenaTheme;
  live: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: CARD.play,
        height: CARD.playHeight,
        flex: "0 0 auto",
        pointerEvents: "auto",
        borderRadius: RADIUS.lg,
        background: live ? theme.slotLive : theme.slot,
        border: `${EDGE}px ${live ? "solid" : "dashed"} ${live ? theme.accent : theme.feltEdge}`,
        boxShadow: `inset 0 ${EDGE}px ${CARD.gap}px ${theme.shadow}`,
        cursor: live ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...text("label"),
        color: theme.accentInk,
        transition: `background ${CARD_MOVE}`,
      }}
    >
      {live && "Place"}
    </div>
  );
}
