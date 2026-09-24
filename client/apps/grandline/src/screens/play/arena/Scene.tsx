import { LAYER } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import Tabletop from "./Tabletop";

/**
 * The room the board sits in. It fills the window behind the board. If the
 * theme has a painted table it is laid over the gradients. The breath is one
 * slow opacity fade, nothing else moves.
 */

/** How long one breath takes, and how far the light swings. */
const BREATH = { seconds: 18, low: 0.55 };

const CSS = `
@keyframes ar-breath {
  0%   { opacity: ${BREATH.low}; }
  50%  { opacity: 1; }
  100% { opacity: ${BREATH.low}; }
}
.ar-breath {
  animation: ar-breath ${BREATH.seconds}s ease-in-out infinite;
  will-change: opacity;
}
@media (prefers-reduced-motion: reduce) {
  .ar-breath { animation: none; opacity: 0.78; }
}
`;

export default function Scene({ theme }: { theme: ArenaTheme }) {
  return (
    <div
      data-layer="scene"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: LAYER.scene,
        pointerEvents: "none",
        // A large table in a dark room, lit from high on the left, in
        // gradients. There is one darkening and it runs along the light: warm
        // where the lamp reaches, falling away to the room's own dark in the
        // far corner from it. From the top down: the lamp's warmth from the
        // upper left; two very broad, very faint bands across the table at a
        // slight angle; the near edge of the table and the floor beyond it;
        // the table itself, going dark away from the lamp.
        background: `
          linear-gradient(152deg, ${theme.lamp}2A 0%, ${theme.lamp}10 26%, transparent 50%),
          linear-gradient(97deg, transparent 0%, transparent 31%, rgba(255,255,255,0.03) 34%, transparent 38%, transparent 68%, rgba(0,0,0,0.18) 72%, transparent 77%),
          linear-gradient(180deg, transparent 0%, transparent 86%, rgba(0,0,0,0.55) 88.5%, #03040A 92%, #020308 100%),
          linear-gradient(148deg, ${theme.table} 0%, ${theme.table} 30%, #0A0C11 68%, #03050A 100%)`,
      }}
    >
      <style>{CSS}</style>
      {/* The breath: the lamp's colour from the window's corner, fading out
          before the middle of the room, so it lands on the hall and the table
          and never on the battlefield. */}
      <div
        className="ar-breath"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(150deg, ${theme.lamp}1C 0%, ${theme.lamp}0A 24%, transparent 46%)`,
        }}
      />
      <Tabletop theme={theme} />
    </div>
  );
}
