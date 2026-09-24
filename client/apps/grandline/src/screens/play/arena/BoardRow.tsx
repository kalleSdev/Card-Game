import type { BattleCard, BattlePlayer } from "@cg/battle";
import { CARD, LEADER, MOTION, STAGE, wellEdges } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { COLOR, RADIUS, text } from "../../../design/tokens";
import PrintCard from "../../../components/PrintCard";
import { cardFace } from "../../../data/pool";
import { cueAnimation, type CueSet, type Ghost } from "./cues";
import HitMarks from "./HitMarks";

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

/** The middle of the well, which the row centres on. */
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
const EDGE = Math.round(LEADER.trim / 3);

/**
 * A card's two stat boxes sit on its bottom edge with a card's own inset between
 * them and the same inset again at either end, which is what settles their
 * width. The height then follows the leader plate's proportions, so the numbers
 * on a card and the numbers beside a leader read as the same fitting at two
 * sizes.
 */
const STAT = {
  width: (CARD.play - CARD.inset * 3) / 2,
  height: Math.round(
    ((CARD.play - CARD.inset * 3) / 2) * (LEADER.stat.height / LEADER.stat.width),
  ),
  inset: CARD.inset,
  /** Nothing on a card sits flush with its edge, including these. */
  drop: CARD.inset,
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
  theme, band, align, player, attackable, selected, cues, ghosts, onCard, onSlot,
}: {
  theme: ArenaTheme;
  /** Which half of the surface this row occupies. */
  band: { top: number; height: number };
  align: "top" | "bottom";
  player: BattlePlayer;
  attackable: boolean;
  selected: string | null;
  cues: CueSet;
  /** Cards that just died on this side, still fading in their slot. */
  ghosts: Ghost[];
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
          const ghost = ghosts.find(g => g.slot === slot);
          if (ghost) {
            return (
              <BoardCard
                key={`ghost-${ghost.card.instanceId}`}
                theme={theme}
                card={ghost.card}
                selected={false}
                attackable={false}
                cues={cues}
              />
            );
          }
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
            cues={cues}
            onClick={() => onCard(card)}
          />
        );
      })}
    </div>
  );
}

function BoardCard({ theme, card, align = "bottom", selected, attackable, cues, onClick }: {
  theme: ArenaTheme;
  card: BattleCard;
  align?: "top" | "bottom";
  selected: boolean;
  attackable: boolean;
  cues: CueSet;
  /** Left out for a card that is only fading away. */
  onClick?: () => void;
}) {
  const spent = card.exhausted || card.stunTurns > 0;
  const hurt = card.currentHp < card.maxHp;
  const mine = cues.byId[card.instanceId];

  return (
    <div
      onClick={onClick}
      className={onClick ? "ar-board-card" : undefined}
      style={{
        position: "relative",
        width: CARD.play,
        flex: "0 0 auto",
        pointerEvents: onClick ? "auto" : "none",
        cursor: attackable ? "crosshair" : "pointer",
        // Selected cards grow a little in place, they never move
        transform: selected ? "scale(1.06)" : "none",
        transition: `transform ${CARD_MOVE}, filter ${CARD_MOVE}`,
        // Contact shadow straight down, a bit softer when picked up
        filter: `${spent ? `${SPENT} ` : ""}drop-shadow(0 ${selected ? 6 : 2}px ${selected ? 10 : CARD.gap / 3}px ${theme.shadow})`,
        zIndex: selected ? 1 : 0,
      }}
    >
      <div
        key={mine ? cues.id : 0}
        style={{ position: "relative", animation: cueAnimation(mine) }}
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
        <HitMarks cues={mine} shape={{ borderRadius: RADIUS.lg }} />
      </div>
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
