import { useCallback, useEffect, useState } from "react";

/**
 * What the arena is made of.
 *
 * The board is one object. A dark wooden body with a stone frame let into it,
 * a band of brass let into the stone, and a parchment field let into that —
 * one manufactured thing, and it is the same thing whichever room it is
 * carried into. There used to be three boards: the same shapes painted bone,
 * slate and candy-pink, with a blue deck for you and a red one for them. Three
 * colourways of a board is three boards, and a board that changes colour is
 * not an object. So the materials are written once, here, and a theme is only
 * the room: the colour of its lamp, the air over the far end of the table,
 * and the dark the table stands in.
 *
 * Every colour is a flat value rather than a gradient string, because the board
 * is painted in SVG: the gradients, bevels and shadows are built from these
 * three-stop ramps at draw time. A theme that shipped CSS gradients could only
 * be used by the one element that pasted it in.
 *
 * The rules the board keeps, since the cards sit on top of it:
 *   · the field stays mid-toned enough for card art to read against it
 *   · the two sides are told apart by where they sit, not by paint
 *   · the accent is the brightest thing on the board, so the eye finds the
 *     button that ends a turn without being told where it is
 */

/** A painted surface: the lit edge, the body, and the edge in shadow. */
export interface Ramp {
  light: string;
  mid: string;
  dark: string;
}

/** The board itself: what it is built from. The same for every room. */
export interface BoardMaterial {
  /** The body the whole board is cut from: dark, old wood. */
  frame: Ramp;
  frameEdge: string;
  /** The lit hairline where a wooden edge catches the lamp. */
  frameInlay: string;
  /** The floor of every hole cut into the wood. */
  bezel: string;
  /** The stone frame let into the wood, and the blocks the leaders stand on. */
  wing: Ramp;
  wingEdge: string;
  /** The playing field. */
  felt: Ramp;
  feltEdge: string;
  seam: string;
  /** Brass: the inlay round the field, the trim on a fitting, the ring of a dial. */
  gold: Ramp;
  /** The backs of the two decks: the same dark leather at both ends. */
  deck: Ramp;
  /** The brightest thing on the board. */
  accent: string;
  accentInk: string;
  /** Lettering cut into stone. */
  ink: string;
  inkSoft: string;
  /** Lettering painted pale into a hole, or onto a dark plate. */
  paint: string;
  /** A number that has gone the wrong way. Not a material; an alarm. */
  warn: string;
  /** An empty place on the field, and one a card can be dropped into. */
  slot: string;
  slotLive: string;
  /** The glass in the energy rail and the ability dial. */
  gem: Ramp;
  gemEmpty: string;
  /** What the board casts onto the table underneath it. */
  shadow: string;
}

/** The room the board is in: everything about a theme that is not the board. */
export interface ArenaTheme extends BoardMaterial {
  id: ArenaThemeId;
  name: string;
  blurb: string;
  /** The dark the whole board sits on, where there is no table painted. */
  table: string;
  /**
   * The colour of the air over the far half of the board.
   *
   * This is what stops three rooms built round the same board reading as the
   * same room: cold air greys the far end, warm air yellows it, and the eye
   * reads those as different places rather than as different colour schemes.
   */
  hazeTint: string;
  /** The colour of the lamp hung over the board. */
  lamp: string;
}

export type ArenaThemeId = "harbour" | "deepwater" | "carnival";

/**
 * The board.
 *
 * Dark aged wood for the body; warm ivory going to aged stone for the frame
 * and the plinths; a brass that is warm rather than bright, since it is the
 * only metal here and it has to sit under the same lamp as everything else
 * without shouting; and a near-black charcoal for the floor of every hole.
 * The field is parchment, a shade quieter than the frame, so a card's own
 * colours are the loudest thing on it.
 */
export const BOARD_MATERIAL: BoardMaterial = {
  frame: { light: "#6A5340", mid: "#463527", dark: "#2A1D13" },
  frameEdge: "#150E08",
  frameInlay: "#A08865",
  bezel: "#0C0907",
  wing: { light: "#EFE6D6", mid: "#D6CAB6", dark: "#AE9F88" },
  wingEdge: "#6E6050",
  felt: { light: "#E8CBA3", mid: "#D3AC7E", dark: "#AE8759" },
  feltEdge: "#6E4B27",
  seam: "rgba(110,75,39,0.38)",
  gold: { light: "#E9CF8E", mid: "#B8913F", dark: "#6F4F1D" },
  deck: { light: "#4A3B31", mid: "#2E241D", dark: "#1A130E" },
  accent: "#F0D080",
  accentInk: "#3A2708",
  ink: "#2E2216",
  inkSoft: "rgba(46,34,22,0.6)",
  paint: "#EFE6D6",
  warn: "#C4483A",
  slot: "rgba(70,45,20,0.22)",
  slotLive: "rgba(240,208,128,0.42)",
  gem: { light: "#9BD4FF", mid: "#4E9BE6", dark: "#1F5C9E" },
  gemEmpty: "rgba(30,32,38,0.5)",
  shadow: "rgba(14,9,4,0.62)",
};

export const ARENA_THEMES: Record<ArenaThemeId, ArenaTheme> = {
  // A warm room with a lamp in it. The one the board was painted for.
  harbour: {
    ...BOARD_MATERIAL,
    id: "harbour",
    name: "Harbour",
    blurb: "Lamplight and old wood",
    table: "#17140F",
    hazeTint: "#EBD6AE",
    lamp: "#FFE6B8",
  },

  // The same board, left out in the cold.
  deepwater: {
    ...BOARD_MATERIAL,
    id: "deepwater",
    name: "Deepwater",
    blurb: "Cold light over deep water",
    table: "#0B1116",
    hazeTint: "#B9D8DE",
    lamp: "#CFEEFF",
  },

  // The same board, under coloured lanterns.
  carnival: {
    ...BOARD_MATERIAL,
    id: "carnival",
    name: "Carnival",
    blurb: "Lanterns and sunset air",
    table: "#16091A",
    hazeTint: "#FFC7EE",
    lamp: "#FFE6A8",
  },
};

export const ARENA_THEME_LIST: ArenaTheme[] = [
  ARENA_THEMES.harbour,
  ARENA_THEMES.deepwater,
  ARENA_THEMES.carnival,
];

const KEY = "grandline.arena";

function stored(): ArenaThemeId {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved in ARENA_THEMES) return saved as ArenaThemeId;
  } catch {
    // A private window can refuse to read. The default is fine.
  }
  return "harbour";
}

/** Which table you play on, remembered between matches. */
export function useArenaTheme(): [ArenaTheme, (id: ArenaThemeId) => void] {
  const [id, setId] = useState<ArenaThemeId>(stored);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Not worth telling anyone about: the board still works.
    }
  }, [id]);

  return [ARENA_THEMES[id], useCallback((next: ArenaThemeId) => setId(next), [])];
}
