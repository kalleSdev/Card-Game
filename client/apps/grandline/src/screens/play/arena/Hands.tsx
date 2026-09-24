import type { BattleCard } from "@cg/battle";
import { CARD, ENERGY, HAND, LEADER } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { COLOR, RADIUS, SPACE, text } from "../../../design/tokens";
import PrintCard from "../../../components/PrintCard";
import CardBack from "../../../components/CardBack";
import { cardFace } from "../../../data/pool";
import { cueAnimation, type CueSet } from "./cues";

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
 * Your hand: a fan held just below the board's near edge.
 *
 * Each card is placed from the middle of the fan with a transform, so when
 * the hand changes size the cards slide to their new places instead of
 * jumping. Hover and pickup are CSS (see interaction.ts).
 */
export function Hand({ theme, cards, energy, held, live, cues, onHold }: {
  theme: ArenaTheme;
  cards: BattleCard[];
  /** What is left to spend, which decides what can be picked up. */
  energy: number;
  held: string | null;
  live: boolean;
  cues: CueSet;
  onHold: (instanceId: string) => void;
}): JSX.Element {
  const step = CARD.hand - CARD.handOverlap;
  const middle = (cards.length - 1) / 2;

  return (
    <div style={{ position: "relative", width: 0, height: CARD.handHeight }}>
      {cards.map((card, i) => {
        const affordable = card.cost <= energy;
        const up = held === card.instanceId;
        const { rise, tilt } = fan(i, cards.length);
        const x = (i - middle) * step - CARD.hand / 2;
        const mine = cues.byId[card.instanceId];

        return (
          <div
            key={card.instanceId}
            className="ar-hand-slot"
            data-held={up || undefined}
            onClick={live && affordable ? () => onHold(card.instanceId) : undefined}
            style={{
              width: CARD.hand,
              zIndex: i,
              cursor: live && affordable ? "pointer" : "default",
              // A picked up card comes upright
              transform: `translate(${x}px, ${-rise}px) rotate(${up ? 0 : tilt}deg)`,
            }}
          >
            <div className="ar-hand-lift">
              <span className="ar-hand-shadow" />
              <div
                key={mine ? cues.id : 0}
                style={{ position: "relative", isolation: "isolate", animation: cueAnimation(mine) }}
              >
                <PrintCard
                  card={cardFace(card.defId)}
                  print="base"
                  width={CARD.hand}
                  interactive={false}
                  stats={false}
                />
                {/* Greyed out when it cannot be paid for. The numbers sit above it. */}
                <span className="ar-dim" data-on={!affordable || undefined} />
                <span className="ar-shade" data-on={!affordable || undefined} />
                <CostPlate theme={theme} value={card.cost} />
                <Vitals theme={theme} card={card} />
              </div>
            </div>
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
              filter: `drop-shadow(0 3px 5px ${theme.shadow})`,
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

/** What a card costs, in the top right corner. Same plate as the stats. */
function CostPlate({ theme, value }: { theme: ArenaTheme; value: number }): JSX.Element {
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
        background: theme.bezel,
        border: `1px solid ${theme.gold.mid}`,
        color: theme.gold.light,
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

