import { useState } from "react";
import type { BattleCard } from "@cg/battle";
import { CARD, ENERGY, HAND, LEADER, MOTION } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { COLOR, MOTION as APP_MOTION, RADIUS, SPACE, text } from "../../../design/tokens";
import PrintCard from "../../../components/PrintCard";
import CardBack from "../../../components/CardBack";
import { cardFace } from "../../../data/pool";

/**
 * The two hands.
 *
 * Yours is a hand of real cards: the same collection card that goes on the
 * surface, at the same size, because it is the same object in both places and a
 * card that shrank on its way out of your hand would be a different card. Theirs
 * is a count. It carries nothing you are allowed to know, so it is drawn as
 * backs and the only question it has to answer is how many.
 *
 * Neither one places itself. Each returns a row sized to its content and the
 * board decides where the row goes, which is what keeps the two ends of the
 * table measured from the same middle rather than from each other.
 */

/**
 * How far each card turns away from the middle of the fan.
 *
 * A held hand splays from the wrist, so the cards cannot all stand upright: the
 * middle one is square on and every card after it leans a little further out.
 * One degree a step is the least tilt that still reads as a fan, and it keeps
 * even a hand at the energy cap inside five degrees at either end, which is
 * shallow enough that the art stays square to the eye.
 */
const TILT_PER_STEP = 0.7;

/**
 * How far the middle of the fan rides above its ends.
 *
 * A quarter of the hover lift. The camber has to stay well clear of the
 * smallest movement the board makes on purpose, or a hand sitting still looks
 * like a hand with a card already picked out of it.
 */
const CAMBER = CARD.hover / 7;

/**
 * A card's own two number boxes.
 *
 * The leader's plates are wider than half a card, so a card in hand keeps the
 * leader's shape and gives up its size: the same inset all round and the same
 * height for their width. One way of showing a number, at two sizes.
 */
const STAT_INSET = CARD.inset;
const STAT_WIDTH = (CARD.hand - STAT_INSET * 3) / 2;
const STAT_HEIGHT = Math.round(STAT_WIDTH * (LEADER.stat.height / LEADER.stat.width));

/** The cost plate is as tall as a stat box, so every number on a card is one size. */
const COST_SIZE = STAT_HEIGHT;

/**
 * The app's easing curve. The token scale packs a duration in with the curve and
 * the board keeps its own durations in MOTION, so only the curve is taken.
 */
const EASE = APP_MOTION.quick.slice(APP_MOTION.quick.indexOf(" ") + 1);

/** Where one card sits in the fan: how far it rises, and how far it turns. */
function fan(index: number, count: number): { rise: number; tilt: number } {
  const middle = (count - 1) / 2;
  const step = index - middle;
  // A hand of one is its own middle and has no ends to rise above.
  const reach = middle > 0 ? middle : 1;
  const away = step / reach;
  return {
    rise: middle > 0 ? Math.round(CAMBER * (1 - away * away)) : 0,
    tilt: step * TILT_PER_STEP,
  };
}

/**
 * Your hand: a fan held just below the board's near edge, whole.
 *
 * Every card is on screen from top to bottom. Pointing at one brings it up
 * out of the fan, and picking one up brings it further and straightens it,
 * which is what makes the card you are about to place impossible to mistake
 * for the rest.
 */
export function Hand({ theme, cards, energy, held, live, onHold }: {
  theme: ArenaTheme;
  cards: BattleCard[];
  /** What is left to spend, which decides what can be picked up. */
  energy: number;
  held: string | null;
  live: boolean;
  onHold: (instanceId: string) => void;
}): JSX.Element {
  const [pointed, setPointed] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", height: CARD.handHeight }}>
      {cards.map((card, i) => {
        const affordable = card.cost <= energy;
        const up = held === card.instanceId;
        // Checked against affordable rather than trusting the pointer alone: a
        // card that goes out of reach while the cursor is on it never gets a
        // mouse leave, since it stops taking the cursor at the same moment.
        const lifted = up || (affordable && pointed === card.instanceId);
        const { rise, tilt } = fan(i, cards.length);
        const lift = up ? CARD.lift : lifted ? CARD.hover : 0;

        return (
          <div
            key={card.instanceId}
            onClick={live && affordable ? () => onHold(card.instanceId) : undefined}
            onMouseEnter={() => setPointed(card.instanceId)}
            onMouseLeave={() => setPointed(null)}
            style={{
              position: "relative",
              marginLeft: i === 0 ? 0 : -CARD.handOverlap,
              // The lifted card has to clear the cards laid over it, and the
              // rest stack left to right the way a hand is gathered up.
              zIndex: lifted ? cards.length : i,
              cursor: live && affordable ? "pointer" : "default",
              pointerEvents: affordable ? "auto" : "none",
              // A card you have picked up has left the fan, so it comes upright
              // as it rises. The lift, the straightening and the shadow are
              // three signals for one state, which is what makes the card you
              // are about to place impossible to mistake for the rest.
              transform: `translateY(${-(rise + lift)}px) rotate(${up ? 0 : tilt}deg)`,
              // The pivot is the bottom edge, which is the end that stays put in
              // a real hand while the tops fan out.
              transformOrigin: "50% 100%",
              transition: `transform ${up ? MOTION.lift : MOTION.card}ms ${EASE}`,
              // Measured off the lift itself, so the shadow grows with the
              // card's distance from the board.
              filter: up ? `drop-shadow(0 ${CARD.lift / 8}px ${CARD.lift / 4}px ${theme.shadow})` : "none",
            }}
          >
            <PrintCard
              card={cardFace(card.defId)}
              print="base"
              width={CARD.hand}
              interactive={false}
              stats={false}
            />

            {/* A card you cannot pay for goes under the same dead glass the
                spent energy sockets are made of, so one colour means one thing
                across the whole board. It sits over the picture only: the
                numbers on top of it are the numbers you are reading to work out
                what you can afford next. */}
            {!affordable && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: RADIUS.lg,
                  background: theme.gemEmpty,
                  pointerEvents: "none",
                }}
              />
            )}

            <CostPlate theme={theme} value={card.cost} affordable={affordable} />
            <Vitals theme={theme} card={card} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Their hand: a fan held just above the board's far edge, whole.
 *
 * It used to hang off the top of the stage and lie over the far rim, which
 * was fine when the far rim was bare wood and is not now that the station
 * fills it; and a hand cut off by the top of the screen is a hand you cannot
 * count. So it is held in the stage's own room above the board, drawn
 * smaller than yours — a row of backs to be counted, not cards to be read —
 * and clear of the board's edge by the same gap yours is.
 *
 * Every card is its own object, with its own splay and its own shadow, so
 * what the eye gets is a row of overlapping cards at slightly different
 * angles rather than one dark box with a pattern on it. The fan pivots on
 * its top edge, so the middle card hangs lowest, which is what a hand held
 * out towards you does.
 *
 * The number of backs drawn stops at the energy cap. A hand can in principle run
 * longer than that, and a row of nineteen would walk off the side of the board,
 * so past the cap the last back carries the count instead.
 */
export function EnemyHand({ theme, count }: { theme: ArenaTheme; count: number }): JSX.Element {
  const shown = Math.min(count, ENERGY.sockets);
  const { tilt, overlap, width, height } = HAND.far;
  const middle = (shown - 1) / 2;

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {Array.from({ length: shown }, (_unused, i) => {
        const step = i - middle;

        return (
          <div
            key={i}
            style={{
              position: "relative",
              marginLeft: i === 0 ? 0 : -overlap,
              width,
              height,
              transform: `rotate(${step * tilt}deg)`,
              // The held end: the end that stays put while the fan opens out.
              transformOrigin: "50% 0%",
              zIndex: i,
              // Lit from the lamp like everything else, so the shadow falls
              // down and to the right and lands on the card next door. It is
              // what separates one back from the next.
              filter: `drop-shadow(2px 4px 5px ${theme.shadow})`,
            }}
          >
            {/* Turned to face them, as a hand held on the far side of the
                table is. */}
            <span style={{ display: "block", transform: "rotate(180deg)" }}>
              <CardBack width={width} height={height} />
            </span>

            {i === shown - 1 && count > shown && (
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 10,
                  transform: "translateX(-50%)",
                  padding: `${SPACE.xs}px ${SPACE.sm}px`,
                  borderRadius: RADIUS.pill,
                  background: COLOR.abyss,
                  border: `1px solid ${COLOR.cable}`,
                  color: COLOR.foam,
                  ...text("data"),
                }}
              >
                {count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * What a card costs, in the top right corner.
 *
 * Glass in a socket, the same glass the energy rail is made of, so the number
 * you are spending and the thing you are spending it out of are plainly the same
 * currency. The ramp is built here rather than stored on the theme, which is how
 * every painted surface on this board is put together.
 */
function CostPlate({ theme, value, affordable }: {
  theme: ArenaTheme;
  value: number;
  affordable: boolean;
}): JSX.Element {
  return (
    <span
      style={{
        position: "absolute",
        top: STAT_INSET,
        right: STAT_INSET,
        width: COST_SIZE,
        height: COST_SIZE,
        borderRadius: RADIUS.pill,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Lit from above, like everything else on the board.
        background: affordable
          ? `radial-gradient(circle at 50% 30%, ${theme.gem.light}, ${theme.gem.mid} 55%, ${theme.gem.dark})`
          : theme.gemEmpty,
        // Brass either way. The socket is part of the board, and the board's
        // fittings are brass whether there is anything live in them or not.
        border: `1px solid ${theme.gold.dark}`,
        // Cut out of the glass in the board's own near black. On a dead socket
        // it goes the other way round, pale paint on a dark plate, because the
        // cost of a card you cannot afford yet is still a number you read.
        color: affordable ? theme.bezel : theme.paint,
        ...text("data"),
        pointerEvents: "none",
      }}
    >
      {value}
    </span>
  );
}

/**
 * What a card is worth right now, along its bottom edge.
 *
 * The printed stats are turned off on the card itself and these stand in their
 * place, because what a card is worth in hand can already differ from what its
 * picture says and two sets of numbers on one card is one set too many.
 */
function Vitals({ theme, card }: { theme: ArenaTheme; card: BattleCard }): JSX.Element {
  const hurt = card.currentHp < card.maxHp;

  return (
    <span
      style={{
        position: "absolute",
        left: STAT_INSET,
        right: STAT_INSET,
        bottom: STAT_INSET,
        display: "flex",
        justifyContent: "space-between",
        pointerEvents: "none",
      }}
    >
      <StatBox theme={theme} value={card.atk} colour={theme.gold.light} />
      {/* Health that has been taken off goes to the board's one alarm colour. */}
      <StatBox
        theme={theme}
        value={card.currentHp}
        colour={hurt ? theme.warn : theme.paint}
      />
    </span>
  );
}

function StatBox({ theme, value, colour }: {
  theme: ArenaTheme;
  value: number;
  colour: string;
}): JSX.Element {
  return (
    <span
      style={{
        width: STAT_WIDTH,
        height: STAT_HEIGHT,
        borderRadius: RADIUS.sm,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Set into the board's dark with a brass hairline, the same way the
        // leader's boxes are set under its window.
        background: theme.bezel,
        border: `1px solid ${theme.gold.dark}`,
        color: colour,
        ...text("data"),
      }}
    >
      {value}
    </span>
  );
}

