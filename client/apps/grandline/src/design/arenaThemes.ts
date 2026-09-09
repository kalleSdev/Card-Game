import { useCallback, useEffect, useState } from "react";

/**
 * What the arena is made of.
 *
 * The board is a painted object — a frame, a surface, two banners and some
 * brass — and none of that belongs in the app's palette. The app palette is for
 * screens you read; this is for a table you play on, and it is allowed to be
 * warm, loud, or almost black as long as the cards on top of it stay legible.
 *
 * Three of them ship. They differ in mood, not in layout: every measurement is
 * shared, so switching one for another only ever repaints.
 *
 * The rules each theme has to keep, because the cards sit on top of it:
 *   · the surface stays mid-to-dark enough for white card art to read on it
 *   · the two banners are told apart by hue, not only by brightness
 *   · the accent is the brightest thing on the board, so the eye finds the
 *     button that ends a turn without being told where it is
 */

export interface ArenaTheme {
  id: ArenaThemeId;
  name: string;
  blurb: string;
  /** The painted frame around everything. */
  frame: {
    face: string;
    edge: string;
    inlay: string;
    shadow: string;
  };
  /** The playing surface in the middle, and the seam across it. */
  felt: string;
  feltEdge: string;
  seam: string;
  /** The big panels either side of each leader. */
  wing: string;
  wingEdge: string;
  /** The colour behind a leader, which is how you tell the sides apart. */
  banner: { you: string; them: string };
  bannerEdge: { you: string; them: string };
  /** The brightest thing on the board. */
  accent: string;
  accentInk: string;
  /** Lettering painted onto the frame. */
  ink: string;
  inkSoft: string;
  /** What an empty slot and a live drop target look like on this surface. */
  slot: string;
  slotLive: string;
  /** The glass in the energy rail and the ability dial. */
  gem: string;
  gemDim: string;
}

export type ArenaThemeId = "harbour" | "deepwater" | "carnival";

export const ARENA_THEMES: Record<ArenaThemeId, ArenaTheme> = {
  // Bone, brass and sun-bleached parchment. The one the board was drawn as.
  harbour: {
    id: "harbour",
    name: "Harbour",
    blurb: "Bone and parchment, warm brass",
    frame: {
      face: "linear-gradient(160deg, #E9E1D6 0%, #CFC3B4 38%, #A99C8D 100%)",
      edge: "#7C6E60",
      inlay: "#F4EEE4",
      shadow: "rgba(38,26,16,0.55)",
    },
    felt: "radial-gradient(120% 140% at 50% 0%, #EFC79A 0%, #E0AC77 42%, #C98F5C 100%)",
    feltEdge: "#8A6038",
    seam: "rgba(120,79,44,0.42)",
    wing: "linear-gradient(180deg, #EDE6DB 0%, #D5CABB 100%)",
    wingEdge: "#8E8073",
    banner: { you: "#2F4C93", them: "#9C2B22" },
    bannerEdge: { you: "#7FA0DD", them: "#E08C6A" },
    accent: "#F2C245",
    accentInk: "#4A3308",
    ink: "#3A2C1E",
    inkSoft: "rgba(58,44,30,0.62)",
    slot: "rgba(105,68,36,0.20)",
    slotLive: "rgba(242,194,69,0.40)",
    gem: "#5FA8E8",
    gemDim: "rgba(95,168,232,0.22)",
  },

  // The same table, left out in the cold. Slate, steel and deep water.
  deepwater: {
    id: "deepwater",
    name: "Deepwater",
    blurb: "Slate and cold green water",
    frame: {
      face: "linear-gradient(160deg, #C3D2DC 0%, #8DA2B2 40%, #5C7182 100%)",
      edge: "#3A4C5A",
      inlay: "#DDE8EF",
      shadow: "rgba(6,18,26,0.62)",
    },
    felt: "radial-gradient(120% 140% at 50% 0%, #2A6B6B 0%, #1D5157 44%, #123539 100%)",
    feltEdge: "#0C2A2E",
    seam: "rgba(180,232,232,0.20)",
    wing: "linear-gradient(180deg, #C9D8E2 0%, #9DB0BF 100%)",
    wingEdge: "#4C6070",
    banner: { you: "#2C6FA8", them: "#5B4B9E" },
    bannerEdge: { you: "#93CBEC", them: "#B3A6EC" },
    accent: "#7FE3D0",
    accentInk: "#06302B",
    ink: "#1A2A34",
    inkSoft: "rgba(26,42,52,0.62)",
    slot: "rgba(210,240,240,0.14)",
    slotLive: "rgba(127,227,208,0.36)",
    gem: "#8FD8FF",
    gemDim: "rgba(143,216,255,0.20)",
  },

  // Loud on purpose. Sunset felt, candy frame, everything turned up.
  carnival: {
    id: "carnival",
    name: "Carnival",
    blurb: "Sunset felt and candy brass",
    frame: {
      face: "linear-gradient(160deg, #FFD7F0 0%, #E183C8 40%, #9A44A6 100%)",
      edge: "#5E1E63",
      inlay: "#FFF0FA",
      shadow: "rgba(46,6,48,0.6)",
    },
    felt: "linear-gradient(155deg, #FF9A4D 0%, #FF5F8E 44%, #8B4BFF 100%)",
    feltEdge: "#4B1C6B",
    seam: "rgba(255,255,255,0.45)",
    wing: "linear-gradient(180deg, #FFE9F7 0%, #F3B9E2 100%)",
    wingEdge: "#8B3E86",
    banner: { you: "#00B3B0", them: "#C6197A" },
    bannerEdge: { you: "#7DF7EF", them: "#FF86C4" },
    accent: "#FFE14D",
    accentInk: "#5A3C00",
    ink: "#4A1046",
    inkSoft: "rgba(74,16,70,0.62)",
    slot: "rgba(74,16,70,0.22)",
    slotLive: "rgba(255,225,77,0.46)",
    gem: "#6BF0FF",
    gemDim: "rgba(107,240,255,0.22)",
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
