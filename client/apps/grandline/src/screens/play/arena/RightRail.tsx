import { useState } from "react";
import { MOTION, RIGHT, STAGE, WELL } from "../../../design/arenaStage";
import { buttonSocket, deckSocket } from "./board";
import { text } from "../../../design/tokens";
import type { ArenaTheme, Ramp } from "../../../design/arenaThemes";

/**
 * The right hand edge of the board: two decks, and the button that ends a turn.
 *
 * The decks lean out of the frame rather than lying flat on it, because a deck
 * is a physical stack and a flat rectangle would read as another card slot. The
 * button overhangs the surface for the opposite reason: it is the one control
 * on the board and it has to be found without being looked for.
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
      <DeckStack
        theme={theme}
        count={topDeck}
        colour={theme.banner.them}
        socket={deckSocket("far")}
      />

      <EndTurn
        theme={theme}
        yourTurn={yourTurn}
        attacking={attacking}
        onEndTurn={onEndTurn}
        onCancel={onCancel}
      />

      <DeckStack
        theme={theme}
        count={bottomDeck}
        colour={theme.banner.you}
        socket={deckSocket("near")}
      />
    </div>
  );
}

/** How few cards left before the count starts warning you about it. */
const NEARLY_OUT = 5;

/** How far each card in the stack is offset from the one below it. */
const LEAN = 4;

function DeckStack({ theme, count, colour, socket }: {
  theme: ArenaTheme;
  count: number;
  colour: Ramp;
  /** The recess in the rim this deck is sitting in. */
  socket: { x: number; y: number; w: number; h: number };
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
        left: socket.x + (socket.w - RIGHT.deckWidth) / 2 - LEAN,
        top: socket.y + (socket.h - RIGHT.deckHeight) / 2 + LEAN,
        width: RIGHT.deckWidth,
        height: RIGHT.deckHeight,
        // A stack in a hole is dark underneath and only just proud of the rim.
        filter: `drop-shadow(0 3px 5px rgba(0,0,0,0.7))`,
        transform: "rotate(-1.2deg)",
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
            boxShadow: `inset 0 1px 0 ${theme.gold.light}66, inset 0 -6px 10px rgba(0,0,0,0.34)`,
            outline: `1px solid ${theme.gold.dark}55`,
          }}
        />
      ))}

      {/* The count sits on a plate rather than on the card, so it stays legible
          whichever colour the deck is. */}
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

function EndTurn({ theme, yourTurn, attacking, onEndTurn, onCancel }: {
  theme: ArenaTheme;
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
        // It reaches back over the surface, out of its own rail, because the
        // eye is already on the middle of the board when the turn is over.
        left: buttonSocket().x + (buttonSocket().w - RIGHT.buttonWidth) / 2,
        top: WELL.seamY - RIGHT.buttonHeight / 2,
        width: RIGHT.buttonWidth,
        height: RIGHT.buttonHeight,
        pointerEvents: "auto",
        borderRadius: 13,
        cursor: live ? "pointer" : "default",
        border: `2px solid ${theme.frameEdge}`,
        background: live
          ? attacking
            ? `linear-gradient(180deg, ${theme.wing.light}, ${theme.wing.dark})`
            : `linear-gradient(180deg, ${theme.accent}, ${theme.gold.mid})`
          : `linear-gradient(180deg, ${theme.wing.mid}, ${theme.wing.dark})`,
        color: live && !attacking ? theme.accentInk : theme.inkSoft,
        boxShadow: live
          ? `inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.3), 0 ${lifted ? 9 : 5}px ${lifted ? 18 : 12}px ${theme.shadow}`
          : `inset 0 3px 8px rgba(0,0,0,0.35)`,
        transform: lifted ? "translateY(-2px)" : "none",
        transition: `transform ${MOTION.card}ms ease, box-shadow ${MOTION.card}ms ease`,
        ...text("label"),
        fontSize: 11,
      }}
    >
      {attacking ? "Cancel" : "End turn"}
    </button>
  );
}
