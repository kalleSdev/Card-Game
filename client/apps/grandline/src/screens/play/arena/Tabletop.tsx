import type { ArenaTheme } from "../../../design/arenaThemes";
import { tableFor } from "./environment";

/**
 * The table, as a surface in the scene.
 *
 * One div, in the same layer as the board's shadow and under it, so it takes
 * the same pitch as everything else on the stage and the board's shadow lands
 * on it rather than beside it.
 *
 * It reaches well past the stage on every side. A pitched stage projects with
 * its far edge narrower than the screen, and a table that stopped at the
 * stage's edge would show the room through the far corners, which is a table
 * with corners cut off it. Reaching past also does the cropping: the picture
 * is drawn to cover this larger box, and the stage — the part of it that can
 * ever be on screen — is the middle of that, so the objects the painter left
 * along the picture's edges never come into view. Nothing here knows or cares
 * what those objects are.
 *
 * The reach is wider than it is tall because the picture is. Drawn to cover a
 * box wider than itself, the picture is fitted by width, so the sides of the
 * box are where the picture's own sides are cut off, and it is the sides that
 * have the most on them. Vertically there is picture to spare, and it is sat
 * low in the box so the spare is taken off the top, where the rest of the
 * clutter is, and the screen's top corners — the furthest the pitched stage
 * can show — land on clean wood. The values were found by painting the
 * picture's cluttered regions a colour and looking for it, with a margin, at
 * 1920×1080 and 1180×700.
 */
export default function Tabletop({ theme }: { theme: ArenaTheme }) {
  const table = tableFor(theme.id);
  if (!table) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "-20%",
        bottom: "-20%",
        left: "-42%",
        right: "-42%",
        pointerEvents: "none",
        // Dark wood under the picture for the moment before it has loaded,
        // which is the picture's own darkest tone.
        background: `#0B0806 url("${table}") 50% 72% / cover no-repeat`,
      }}
    />
  );
}
