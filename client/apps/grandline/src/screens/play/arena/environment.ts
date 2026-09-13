import type { ArenaThemeId } from "../../../design/arenaThemes";

/**
 * The painted table each board stands on.
 *
 * A table is painted once as a picture rather than built out of shapes,
 * because a large wooden surface is the one thing on this screen that is
 * better drawn than constructed. It is not a backdrop: it sits inside the
 * stage, under the board, and takes the same camera the board takes, so when
 * the board is pitched towards the viewer the table is pitched with it and the
 * two foreshorten as one surface. A table drawn flat behind a pitched board
 * would be a board floating in front of a picture of a table.
 *
 * The picture is larger than the stage on purpose. Its painter left things at
 * its edges — a lantern, books, a chart — and the board's own composition
 * keeps the middle of the picture on screen and the edges off it, so what
 * shows round the board is wood and the lamp's light across it and nothing
 * else. The table is the environment.
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
