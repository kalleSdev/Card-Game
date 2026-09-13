import type { ArenaThemeId } from "../../../design/arenaThemes";

/**
 * The painted room behind each table.
 *
 * A plate is the far end of the arena: the hall the board is standing in,
 * painted once as a picture rather than built out of shapes, because a hall
 * is the one thing on this screen that is better drawn than constructed. It
 * sits behind everything, fills the window, and is opaque, so whatever it
 * shows at the edges is the room and whatever the board covers is simply not
 * seen.
 *
 * Not every table has one yet. A table without a plate gets the room drawn in
 * gradients, which is what every table had until now.
 */
const PLATES: Partial<Record<ArenaThemeId, string>> = {
  harbour: "/arena/environment/harbour/distant-hall.png",
};

/** The plate behind a table, if that table has one. */
export function plateFor(theme: ArenaThemeId): string | undefined {
  return PLATES[theme];
}
