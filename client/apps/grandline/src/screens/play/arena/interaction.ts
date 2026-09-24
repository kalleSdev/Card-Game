import { CARD } from "../../../design/arenaStage";
import { RADIUS } from "../../../design/tokens";

/**
 * Hover, pickup and selection for cards and leaders, done in CSS.
 *
 * Each card is split so no two things fight over one transform:
 * - slot: stays still, takes the pointer, holds the fan position and z-index
 * - lift: hover and pickup movement only
 * - cue: the combat and entrance animations only
 * - shadow and dim: their own elements, only their opacity changes
 *
 * Hover never goes through React, so moving the mouse over the hand does not
 * re-render anything.
 */

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/** How long a hover or pickup takes to move, in ms. */
export const LIFT_MS = 180;

export const INTERACTION_CSS = `
.ar-hand-slot {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 50% 100%;
  pointer-events: auto;
  transition: transform 240ms ${EASE}, z-index 0s linear ${LIFT_MS}ms;
}
.ar-hand-slot:hover, .ar-hand-slot[data-held] {
  z-index: 40 !important;
  transition: transform 240ms ${EASE}, z-index 0s;
}
/* While a card is up, its hit area reaches up to where the card is drawn */
.ar-hand-slot:hover::before, .ar-hand-slot[data-held]::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: ${CARD.hover}px;
}
.ar-hand-slot[data-held]::before { height: ${CARD.lift}px; }
.ar-hand-lift {
  position: relative;
  transition: transform ${LIFT_MS}ms ${EASE};
  will-change: transform;
}
.ar-hand-slot:hover .ar-hand-lift { transform: translateY(-${CARD.hover}px); }
.ar-hand-slot[data-held] .ar-hand-lift { transform: translateY(-${CARD.lift}px); }
.ar-hand-shadow {
  position: absolute;
  inset: 8px 6px -6px;
  border-radius: ${RADIUS.lg}px;
  box-shadow: 0 16px 24px rgba(0, 0, 0, 0.6);
  opacity: 0;
  transition: opacity ${LIFT_MS}ms ease-out;
}
.ar-hand-slot:hover .ar-hand-shadow { opacity: 0.7; }
.ar-hand-slot[data-held] .ar-hand-shadow { opacity: 1; }

/* A card that cannot be used: greyed and darkened, faded in and out */
.ar-dim, .ar-shade {
  position: absolute;
  inset: 0;
  border-radius: ${RADIUS.lg}px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 240ms ease-out;
}
.ar-dim { background: #808080; mix-blend-mode: saturation; }
.ar-shade { background: rgba(6, 8, 12, 0.5); }
.ar-dim[data-on], .ar-shade[data-on] { opacity: 1; }

.ar-field { position: relative; flex: 0 0 auto; }
.ar-field-lift {
  position: relative;
  transition: transform 160ms ${EASE};
}
.ar-field[data-live]:hover .ar-field-lift { transform: translateY(-3px); }
.ar-field[data-selected] .ar-field-lift { transform: translateY(-4px) scale(1.05); }
.ar-field-shadow, .ar-field-shadow-up {
  position: absolute;
  inset: 4px 3px -2px;
  border-radius: ${RADIUS.lg}px;
  pointer-events: none;
}
.ar-field-shadow { box-shadow: 0 3px 6px rgba(0, 0, 0, 0.55); }
.ar-field-shadow-up {
  box-shadow: 0 12px 18px rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 160ms ease-out;
}
.ar-field[data-live]:hover .ar-field-shadow-up { opacity: 0.6; }
.ar-field[data-selected] .ar-field-shadow-up { opacity: 1; }

/* Leaders: a pale ring on hover when clicking does something */
.ar-leader-hover {
  opacity: 0;
  transition: opacity 160ms ease-out;
  pointer-events: none;
}
.ar-leader-hit:hover .ar-leader-hover { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .ar-hand-slot, .ar-hand-lift, .ar-field-lift { transition: none; }
}
`;
