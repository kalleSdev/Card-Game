import { useState } from "react";
import { FELT, MOTION, RAIL, RIGHT, STAGE } from "../../../design/arenaStage";
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
        left: STAGE.width - RAIL.right,
        top: 0,
        width: RAIL.right,
        height: STAGE.height,
        zIndex: 15,
        pointerEvents: "none",
      }}
    >
      <DeckStack
        theme={theme}
        count={topDeck}
        colour={theme.banner.them}
        centre={FELT.middle - RIGHT.deckOffset}
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
        centre={FELT.middle + RIGHT.deckOffset}
      />
    </div>
  );
}

/** How few cards left before the count starts warning you about it. */
const NEARLY_OUT = 5;

/** How far each card in the stack is offset from the one below it. */
const LEAN = 4;

function DeckStack({ theme, count, colour, centre }: {
  theme: ArenaTheme;
  count: number;
  colour: Ramp;
  /** Where the middle of the stack sits, measured down the stage. */
  centre: number;
}) {
  const low = count <= NEARLY_OUT;
  // Four backs is enough thickness to read as a stack; more would just be more
  // edges to draw at this size.
  const layers = [3, 2, 1, 0];

  return (
    <div
      style={{
        position: "absolute",
        // The stack leans out past the edge of the board, the way a deck sits
        // half on the table beside you rather than squarely on it.
        left: RAIL.right - RIGHT.deckWidth + LEAN * 3,
        top: centre - RIGHT.deckHeight / 2,
        width: RIGHT.deckWidth,
        height: RIGHT.deckHeight,
        filter: `drop-shadow(0 6px 10px ${theme.shadow})`,
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
        left: RAIL.right - RIGHT.buttonWidth - 10,
        top: FELT.middle - RIGHT.buttonHeight / 2,
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
