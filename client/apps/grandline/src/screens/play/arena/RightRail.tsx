import { useState } from "react";
import { MOTION, RIGHT, SIDE, STAGE, rightFittings, type Box } from "../../../design/arenaStage";
import { text } from "../../../design/tokens";
import type { ArenaTheme, Ramp } from "../../../design/arenaThemes";

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
      <DeckStack theme={theme} count={topDeck} colour={theme.deck} socket={seat.decks.far} />

      <EndTurn
        theme={theme}
        socket={seat.button}
        yourTurn={yourTurn}
        attacking={attacking}
        onEndTurn={onEndTurn}
        onCancel={onCancel}
      />

      <DeckStack theme={theme} count={bottomDeck} colour={theme.deck} socket={seat.decks.near} />
    </div>
  );
}

/** How few cards left before the count starts warning you about it. */
const NEARLY_OUT = 5;

/** How far each card in the stack is offset from the one below it. */
const LEAN = 3;

function DeckStack({ theme, count, colour, socket }: {
  theme: ArenaTheme;
  count: number;
  colour: Ramp;
  /** The recess in the housing this deck is sitting in. */
  socket: Box;
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
      {layers.map(layer => (
        <span
          key={layer}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${layer * LEAN}px, ${-layer * LEAN}px)`,
            borderRadius: 7,
            background: `linear-gradient(150deg, ${colour.light}, ${colour.mid} 45%, ${colour.dark})`,
            border: `1px solid ${theme.frameEdge}`,
            // The lamp on the top edge of each back, and the one below it in
            // its shadow: what separates one card in a stack from the next.
            boxShadow: `inset 1px 1px 0 ${theme.gold.light}55, inset 0 -6px 10px rgba(0,0,0,0.34)`,
          }}
        />
      ))}

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
        ...key(theme, live, attacking, lifted),
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
 * A key: a brass button standing in a recess the board cut for it.
 *
 * The same piece whether it ends a turn or leaves the table, so the two read
 * as the same fitting. Brass while it can be pressed, because brass is the
 * one thing on this board that asks to be touched; the rest of the time it is
 * the same dark plate as every other fitting, and it sits down. Its only
 * shadow is the lit top edge and the dark under-edge every raised brass piece
 * on the board has: the recess round it is already dark, and a key with a
 * shadow under it is a key lying on the board.
 */
export function key(theme: ArenaTheme, live: boolean, quiet = false, lifted = false) {
  return {
    borderRadius: 8,
    border: `1px solid ${theme.gold.dark}`,
    background: live
      ? quiet
        ? `linear-gradient(180deg, ${theme.wing.light}, ${theme.wing.dark})`
        : `linear-gradient(180deg, ${theme.accent}, ${theme.gold.mid})`
      : theme.bezel,
    color: live ? theme.accentInk : theme.gold.light,
    opacity: live ? 1 : 0.85,
    boxShadow: live
      ? `inset 1px 1px 0 rgba(255,255,255,0.45), inset 0 ${lifted ? -2 : -3}px 5px rgba(0,0,0,0.3)`
      : `inset 2px 2px 3px ${theme.shadow}`,
  } as const;
}
