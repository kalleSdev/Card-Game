import type { ArenaThemeId } from "../../../design/arenaThemes";

/**
 * The painted table each board stands on.
 *
 * A table is painted once as a picture rather than built out of shapes,
 * because a large wooden surface with things on it is the one part of this
 * screen that is better drawn than constructed. It is the room: it fills the
 * window behind the stage, whole, and the board stands in front of it. The
 * painting was made from about the seat the board is pitched for, with a clear
 * middle for the board to cover and its lamp, books and clutter left round the
 * edges, and that is what shows round the board. The table is the environment.
 *
 * Not every board has a table yet. A board without one gets the room drawn in
 * gradients, which is what every board had until now.
 */
const TABLES: Partial<Record<ArenaThemeId, string>> = {
  harbour: "/arena/environment/harbour/tabletop.png",
};

/** The table under a board, if that board has one. */
export function tableFor(theme: ArenaThemeId): string | undefined {
  return TABLES[theme];
}
