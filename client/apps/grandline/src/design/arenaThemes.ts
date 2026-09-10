import { useCallback, useEffect, useState } from "react";

/**
 * What the arena is made of.
 *
 * The board is a painted object — a plate, a bezel, panels, banners, brass and
 * a playing surface — and none of that belongs in the app's palette. The app
 * palette is for screens you read; this is for a table you play on, and it is
 * allowed to be warm, cold or loud as long as the cards on top of it stay
 * legible.
 *
 * Every colour is a flat value rather than a gradient string, because the board
 * is painted in SVG: the gradients, bevels and shadows are built from these
 * three-stop ramps at draw time. A theme that shipped CSS gradients could only
 * be used by the one element that pasted it in.
 *
 * The rules each theme has to keep, since the cards sit on top of it:
 *   · the surface stays mid-toned enough for card art to read against it
 *   · the two banners are told apart by hue, not only by brightness
 *   · the accent is the brightest thing on the board, so the eye finds the
 *     button that ends a turn without being told where it is
 */

/** A painted surface: the lit edge, the body, and the edge in shadow. */
export interface Ramp {
  light: string;
  mid: string;
  dark: string;
}

export interface ArenaTheme {
  id: ArenaThemeId;
  name: string;
  blurb: string;
  /** The plate the whole board is cut from. */
  frame: Ramp;
  frameEdge: string;
  frameInlay: string;
  /** The dark surround the panels are set into. */
  bezel: string;
  /** The two big panels either side of each leader. */
  wing: Ramp;
  wingEdge: string;
  /** The playing surface. */
  felt: Ramp;
  feltEdge: string;
  seam: string;
  /** Brass: the trim around a leader window, the ring of a dial. */
  gold: Ramp;
  /** The colour behind a leader, which is how you tell the sides apart. */
  banner: { you: Ramp; them: Ramp };
  bannerTrim: { you: string; them: string };
  /** The brightest thing on the board. */
  accent: string;
  accentInk: string;
  /** Lettering painted onto the frame. */
  ink: string;
  inkSoft: string;
  /** An empty place on the surface, and one a card can be dropped into. */
  slot: string;
  slotLive: string;
  /** The glass in the energy rail and the ability dial. */
  gem: Ramp;
  gemEmpty: string;
  /** What the board casts onto the table underneath it. */
  shadow: string;
  /** The dark the whole board sits on. */
  table: string;
}

export type ArenaThemeId = "harbour" | "deepwater" | "carnival";

export const ARENA_THEMES: Record<ArenaThemeId, ArenaTheme> = {
  // Bone, brass and sun-bleached parchment. The one the board was painted as.
  harbour: {
    id: "harbour",
    name: "Harbour",
    blurb: "Bone and parchment, warm brass",
    frame: { light: "#F3ECE1", mid: "#D3C7B7", dark: "#A2947F" },
    frameEdge: "#6F6252",
    frameInlay: "#FFFBF3",
    bezel: "#12100E",
    wing: { light: "#F2ECE1", mid: "#DCD2C4", dark: "#B6AA99" },
    wingEdge: "#7E7263",
    felt: { light: "#F0CB9C", mid: "#DFAB74", dark: "#BE8850" },
    feltEdge: "#7E552C",
    seam: "rgba(122,80,42,0.38)",
    gold: { light: "#F7DC9A", mid: "#D2A548", dark: "#8A6522" },
    banner: {
      you: { light: "#4E6FC4", mid: "#2F4C93", dark: "#1B2F63" },
      them: { light: "#C4483A", mid: "#9C2B22", dark: "#651612" },
    },
    bannerTrim: { you: "#D2A548", them: "#D2A548" },
    accent: "#F5C63F",
    accentInk: "#4A3308",
    ink: "#38291A",
    inkSoft: "rgba(56,41,26,0.6)",
    slot: "rgba(103,66,32,0.22)",
    slotLive: "rgba(245,198,63,0.42)",
    gem: { light: "#9BD4FF", mid: "#4E9BE6", dark: "#1F5C9E" },
    gemEmpty: "rgba(30,32,38,0.5)",
    shadow: "rgba(28,18,8,0.6)",
    table: "#17140F",
  },

  // The same table, left out in the cold. Slate, steel and deep water.
  deepwater: {
    id: "deepwater",
    name: "Deepwater",
    blurb: "Slate and cold green water",
    frame: { light: "#D6E2EA", mid: "#9CAFBD", dark: "#63788A" },
    frameEdge: "#33475A",
    frameInlay: "#EFF6FB",
    bezel: "#080D12",
    wing: { light: "#DCE7EE", mid: "#B4C4D0", dark: "#8496A6" },
    wingEdge: "#42576A",
    felt: { light: "#2F7A76", mid: "#1F5559", dark: "#123539" },
    feltEdge: "#0A2529",
    seam: "rgba(180,232,232,0.22)",
    gold: { light: "#DCEAF2", mid: "#93AFC2", dark: "#4E6070" },
    banner: {
      you: { light: "#4FA0D8", mid: "#2C6FA8", dark: "#17436A" },
      them: { light: "#8375D6", mid: "#5B4B9E", dark: "#352A63" },
    },
    bannerTrim: { you: "#B9D4E4", them: "#B9D4E4" },
    accent: "#7FE3D0",
    accentInk: "#05302B",
    ink: "#16242E",
    inkSoft: "rgba(22,36,46,0.6)",
    slot: "rgba(210,240,240,0.12)",
    slotLive: "rgba(127,227,208,0.36)",
    gem: { light: "#C6EEFF", mid: "#6FC6F2", dark: "#2A7CAE" },
    gemEmpty: "rgba(12,26,32,0.55)",
    shadow: "rgba(4,14,20,0.66)",
    table: "#0B1116",
  },

  // Loud on purpose. Sunset felt, candy plate, everything turned up.
  carnival: {
    id: "carnival",
    name: "Carnival",
    blurb: "Sunset felt and candy brass",
    frame: { light: "#FFE3F5", mid: "#EFA0DA", dark: "#A94FB0" },
    frameEdge: "#5B1B62",
    frameInlay: "#FFF4FC",
    bezel: "#1A0A20",
    wing: { light: "#FFEDF9", mid: "#F6C2E6", dark: "#D189C4" },
    wingEdge: "#7E3379",
    felt: { light: "#FFA85C", mid: "#F2648F", dark: "#7A45E0" },
    feltEdge: "#43156B",
    seam: "rgba(255,255,255,0.45)",
    gold: { light: "#FFF3A8", mid: "#FFD24D", dark: "#B87A12" },
    banner: {
      you: { light: "#4BE8DF", mid: "#00B3B0", dark: "#046C72" },
      them: { light: "#FF5FA8", mid: "#C6197A", dark: "#750B49" },
    },
    bannerTrim: { you: "#FFD24D", them: "#FFD24D" },
    accent: "#FFE14D",
    accentInk: "#5A3C00",
    ink: "#45103F",
    inkSoft: "rgba(69,16,63,0.6)",
    slot: "rgba(60,12,64,0.24)",
    slotLive: "rgba(255,225,77,0.46)",
    gem: { light: "#C9FBFF", mid: "#5FE3F5", dark: "#1B7FA8" },
    gemEmpty: "rgba(30,10,34,0.55)",
    shadow: "rgba(38,4,44,0.62)",
    table: "#16091A",
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
