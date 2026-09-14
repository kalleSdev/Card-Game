import type { ArenaTheme } from "../../../design/arenaThemes";
import { tableFor } from "./environment";

/**
 * The table, as the room.
 *
 * One picture, filling the window behind the board. It is not on the stage
 * and does not take the stage's pitch: it is the environment the pitched
 * board stands in, the same way the room's gradients were, and it fills the
 * window the same way — edge to edge, its own proportions kept, trimmed only
 * by however much the window's shape differs from the picture's. On a wide
 * screen that trims a little off the top and bottom; on a squarer one, a
 * little off the sides. Either way what is on screen is the painting: the
 * table, its lamp, and the things left at its edges, with the board covering
 * the clear middle the painter left for it.
 */
export default function Tabletop({ theme }: { theme: ArenaTheme }) {
  const table = tableFor(theme.id);
  if (!table) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        // Dark wood under the picture for the moment before it has loaded,
        // which is the picture's own darkest tone.
        background: `#0B0806 url("${table}") center / cover no-repeat`,
      }}
    />
  );
}
