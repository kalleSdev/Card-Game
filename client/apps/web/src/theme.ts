/**
 * Shared visual tokens.
 *
 * These values were already being used consistently across the UI, just written
 * out as raw hex in every file. Naming them keeps new code consistent and makes
 * a palette change a single edit instead of a find-and-replace.
 *
 * Existing screens still use literals in places; new and touched code should use
 * these instead.
 */

export const COLOR = {
  // Players
  p1: "#4a9eff",
  p2: "#ff6666",

  // Cursed energy — the game's signature accent
  cursed: "#cc44ff",
  cursedDeep: "#9933ff",
  cursedSoft: "#aa44ff",

  // Feedback
  gold: "#ffd700",
  hpGood: "#44ff88",
  hpWarn: "#ffcc00",
  hpCrit: "#ff4444",
  energy: "#4aeecc",

  // Surfaces, darkest to lightest
  bg: "#04040a",
  panel: "rgba(4,4,16,0.88)",
  border: "#2a2a3a",
  textDim: "#556",
  textFaint: "#334",
  text: "#ffffff",
} as const;

/** Per-leader domain identity. Drives the arena flood while a domain is active. */
export const DOMAIN_COLOR: Record<string, string> = {
  "gojo-base": "#66ccff", // Infinite Void — cold blue-white
  sukuna: "#ff3322",      // Malevolent Shrine — blood red
  mahoraga: "#ffaa33",    // Adaptation — forge orange
  takaba: "#ffdd44",      // Comedian — absurd yellow
  yuta: "#ff66cc",        // Rika — pink
  geto: "#66ff99",        // Cursed spirits — sickly green
  jogo: "#ff7722",        // Flame
  dagon: "#33ccdd",       // Sea
  hanami: "#88dd55",      // Plants
  mahito: "#dd88ff",      // Idle Transfiguration
  dabura: "#cc2244",      // Demon Realm
  kashimo: "#ffee55",     // Lightning
  higuruma: "#ddccaa",    // Judgement — parchment
  uro: "#99bbff",         // Sky
  hakari: "#ff44aa",      // Jackpot
  toji: "#bbbbbb",        // No technique — steel
  maki: "#cceeff",
  naoya: "#aaffee",
  megumi: "#5566cc",
};

/** Fallback for leaders without a signature colour. */
export const DEFAULT_DOMAIN_COLOR = COLOR.cursed;
