import { useState } from "react";
import { MOTION, RIGHT, SIDE, STAGE, rightFittings, type Box } from "../../../design/arenaStage";
import CardBack from "../../../components/CardBack";
import { text } from "../../../design/tokens";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * What sits in the right hand fittings: two decks, and the button that ends
 * a turn.
 *
 * The three frames, their recesses and their lighting are the board's, drawn
 * with the structure. This puts the stacks and the key into them. A deck is a
 * physical stack, so it is drawn as four backs one on the other rather than
 * as a flat rectangle, which would read as another card slot; it throws no
 * shadow of its own, because the socket it sits in is already dark round it.
 */

export default function RightRail({
  theme, topDeck, bottomDeck, yourTurn, attacking, onEndTurn, onCancel,
}: {
  theme: ArenaTheme;
  /** How many cards are left in the far player's deck. */
  topDeck: number;
  bottomDeck: number;
  yourTurn: boolean;
  /** True while a card is picked up to attack, when the button cancels instead. */
  attacking: boolean;
  onEndTurn: () => void;
  onCancel: () => void;
}) {
  const seat = rightFittings();

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: STAGE.width,
        height: STAGE.height,
        pointerEvents: "none",
      }}
    >
      <DeckStack theme={theme} count={topDeck} socket={seat.decks.far} far />

      <EndTurn
        theme={theme}
        socket={seat.button}
        yourTurn={yourTurn}
        attacking={attacking}
        onEndTurn={onEndTurn}
        onCancel={onCancel}
      />

      <DeckStack theme={theme} count={bottomDeck} socket={seat.decks.near} />
    </div>
  );
}

/** How few cards left before the count starts warning you about it. */
const NEARLY_OUT = 5;

/** How far each card in the stack is offset from the one below it. */
const LEAN = 3;

function DeckStack({ theme, count, socket, far = false }: {
  theme: ArenaTheme;
  count: number;
  /** The recess in the housing this deck is sitting in. */
  socket: Box;
  /** Their deck, which faces them: the backs are turned the other way up. */
  far?: boolean;
}) {
  const low = count <= NEARLY_OUT;
  // Four backs is enough thickness to read as a stack; more would just be more
  // edges to draw at this size.
  const layers = [3, 2, 1, 0];


  return (
    <div
      style={{
        position: "absolute",
        // Sitting in its socket rather than beside it: the recess is a little
        // larger than the stack, and the stack sits in the middle of it.
        left: socket.x + (socket.width - RIGHT.deckWidth) / 2 - LEAN,
        top: socket.y + (socket.height - RIGHT.deckHeight) / 2 + LEAN,
        width: RIGHT.deckWidth,
        height: RIGHT.deckHeight,
      }}
    >
      {/* The stack: three backs' edges showing under the top one, each a
          little further up and right, each dropping its shadow on the one
          below. They are the same back as the top card, because a pile of
          cards is the same card over and over; painted as wood they read as
          a block the top card was lying on. */}
      {layers.slice(0, -1).map(layer => (
        <span
          key={layer}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${layer * LEAN}px, ${-layer * LEAN}px)${far ? " rotate(180deg)" : ""}`,
            borderRadius: 7,
            boxShadow: `2px 3px 4px rgba(0,0,0,0.5)`,
          }}
        >
          <CardBack width={RIGHT.deckWidth} height={RIGHT.deckHeight} />
        </span>
      ))}
      {/* The top card is the same back as every face-down card in the game,
          the right way up for the player it belongs to. */}
      <span style={{ position: "absolute", inset: 0, boxShadow: `2px 3px 5px rgba(0,0,0,0.55)`, borderRadius: 7, transform: far ? "rotate(180deg)" : "none" }}>
        <CardBack width={RIGHT.deckWidth} height={RIGHT.deckHeight} />
      </span>

      {/* The count sits on a plate rather than on the card, so it reads as a
          number on a fitting and not as a number on a card. */}
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          minWidth: 30,
          padding: "3px 7px",
          borderRadius: 6,
          textAlign: "center",
          background: "rgba(8,10,14,0.82)",
          border: `1px solid ${low ? theme.accent : theme.gold.mid}`,
          color: low ? theme.accent : theme.gold.light,
          ...text("data"),
          fontSize: 15,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function EndTurn({ theme, socket, yourTurn, attacking, onEndTurn, onCancel }: {
  theme: ArenaTheme;
  /** The recess in the housing the key sits in. */
  socket: Box;
  yourTurn: boolean;
  attacking: boolean;
  onEndTurn: () => void;
  onCancel: () => void;
}) {
  const [over, setOver] = useState(false);
  const live = yourTurn;
  const lifted = live && over;

  return (
    <button
      onClick={attacking ? onCancel : onEndTurn}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      disabled={!live}
      style={{
        position: "absolute",
        left: socket.x + SIDE.button.seat,
        top: socket.y + SIDE.button.seat,
        width: SIDE.button.width,
        height: SIDE.button.height,
        pointerEvents: "auto",
        cursor: live ? "pointer" : "default",
        ...key(theme, live ? (attacking ? "ivory" : "brass") : "dull", lifted),
        transform: lifted ? "translateY(-1px)" : "none",
        transition: `transform ${MOTION.card}ms ease, box-shadow ${MOTION.card}ms ease`,
        ...text("label"),
        fontSize: 10,
      }}
    >
      {attacking ? "Cancel" : "End turn"}
    </button>
  );
}

/**
 * A key: a plate standing a little proud of the recess the board cut for it.
 *
 * Two plates, as on the reference. The one that ends a turn is brass: bright
 * and pressable while it is your turn, the same brass gone dull while it is
 * not. The one that leaves is ivory with dark lettering. Both are lit the
 * way every raised piece on the board is — the lamp on the top and left
 * edges, the bottom and right in their own shadow, a hair of dark under the
 * plate where it meets the recess floor.
 */
export function key(theme: ArenaTheme, kind: "brass" | "dull" | "ivory", lifted = false) {
  const background = kind === "ivory"
    ? `linear-gradient(170deg, ${theme.wing.light}, ${theme.wing.mid})`
    : kind === "brass"
      ? `linear-gradient(170deg, ${theme.accent}, ${theme.gold.mid} 70%, ${theme.gold.dark})`
      : `linear-gradient(170deg, ${theme.gold.mid}, ${theme.gold.dark})`;
  const drop = lifted ? 1 : 2;
  return {
    borderRadius: 7,
    border: `1px solid ${theme.frameEdge}`,
    background,
    color: kind === "ivory" ? theme.ink : kind === "brass" ? theme.accentInk : theme.gold.light,
    opacity: kind === "dull" ? 0.9 : 1,
    boxShadow: `inset 1px 1px 0 rgba(255,255,255,${kind === "ivory" ? 0.6 : 0.4}), inset -1px -2px 3px rgba(0,0,0,0.35), ${drop}px ${drop + 1}px ${drop * 2}px rgba(0,0,0,0.55)`,
  } as const;
}
