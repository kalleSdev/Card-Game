import type { PrintId, PrintTier, RankId } from "@cg/meta";

/**
 * The design language, in one file.
 *
 * Everything the app draws takes its colour, size and spacing from here. No
 * component invents a value of its own, which is the difference between a look
 * and a habit.
 *
 * The world is a sea chart drawn in ink: deep blue-black grounds, warm paper
 * whites, and one signal red doing all the shouting. Gold is reserved for value,
 * never for decoration.
 */

// ── Colour ───────────────────────────────────────────────────────────────────

export const COLOR = {
  /** Deepest ground. The page sits on this. */
  abyss: "#070C13",
  /** Panels and cards. */
  hull: "#0D1520",
  /** Raised surfaces inside a panel. */
  deck: "#141F2D",
  /** Hover and pressed states on a surface. */
  swell: "#1B283A",
  /** Hairlines and dividers. */
  rope: "#22303F",
  /** A stronger edge, for something the eye should follow. */
  cable: "#33465C",

  /** Primary text. Warm, so it reads as paper rather than screen. */
  foam: "#F2ECDF",
  /** Secondary text. */
  mist: "#93A3B4",
  /** Labels, captions, anything at rest. */
  fathom: "#5D6E7F",

  /** The one loud colour. Manga red, used for identity and for danger. */
  signal: "#D6412F",
  /** Value. Currency, rewards, anything you earned. */
  doubloon: "#E0A93B",
  /** Interactive. Links, focus, selection. */
  current: "#3E8FA0",
  /** Foil, and secondary emphasis. */
  marine: "#7B6BD9",
  /** Positive outcomes. */
  kelp: "#3FA46B",
} as const;

/** Print treatments. These have to be tellable apart at a glance across a table. */
export const PRINT_COLOR: Record<PrintId, string> = {
  base: "#8595A5",
  foil: "#7B6BD9",
  altArt: "#E0A93B",
  blackLabel: "#E8E2D4",
  secret: "#D6412F",
  signed: "#FF6A4D",
  holoOne: "#EDF3FF",
};

export const TIER_COLOR: Record<PrintTier, string> = {
  3: "#8595A5",
  4: "#7B6BD9",
  5: "#E0A93B",
  6: "#D6412F",
  7: "#EDF3FF",
};

export const RANK_COLOR: Record<RankId, string> = {
  iron: "#6E6A65",
  bronze: "#A9713F",
  silver: "#A8B4BC",
  gold: "#D9A441",
  platinum: "#4FBFA8",
  emerald: "#35A05F",
  diamond: "#6FC8DF",
  master: "#A87BE0",
  emperor: "#D6412F",
  pirateKing: "#F2ECDF",
};

// ── Type ─────────────────────────────────────────────────────────────────────

export const FONT = {
  /** Page titles and card names. Cut like a printed poster. */
  display: "'Fraunces', Georgia, serif",
  /** Everything you read or click. */
  ui: "'Archivo', system-ui, -apple-system, sans-serif",
  /** Numbers that line up: currency, stats, codes. */
  data: "'IBM Plex Mono', ui-monospace, Menlo, monospace",
} as const;

/** A fixed scale. If a size is not on it, it is the wrong size. */
export const TEXT = {
  display: { size: 44, height: 1.02, weight: 900, family: FONT.display, spacing: "-0.02em" },
  title:   { size: 28, height: 1.15, weight: 700, family: FONT.display, spacing: "-0.01em" },
  heading: { size: 19, height: 1.3,  weight: 700, family: FONT.ui,      spacing: "-0.005em" },
  body:    { size: 15, height: 1.55, weight: 400, family: FONT.ui,      spacing: "0" },
  small:   { size: 13, height: 1.5,  weight: 400, family: FONT.ui,      spacing: "0" },
  /** Uppercase, tracked out. For labels only, never for sentences. */
  label:   { size: 11, height: 1.2,  weight: 600, family: FONT.ui,      spacing: "0.14em" },
  data:    { size: 14, height: 1.2,  weight: 500, family: FONT.data,    spacing: "0" },
} as const;

export type TextRole = keyof typeof TEXT;

/** Spread a role onto an element. */
export function text(role: TextRole): React.CSSProperties {
  const t = TEXT[role];
  return {
    fontFamily: t.family,
    fontSize: t.size,
    lineHeight: t.height,
    fontWeight: t.weight,
    letterSpacing: t.spacing,
    ...(role === "label" ? { textTransform: "uppercase" as const } : null),
    ...(role === "data" ? { fontVariantNumeric: "tabular-nums" as const } : null),
  };
}

// ── Space, shape, depth ──────────────────────────────────────────────────────

/** A four-point scale. Gaps come from layout, never from stray margins. */
export const SPACE = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36, xxxl: 56,
} as const;

export const RADIUS = {
  /** Chips, badges, inputs. */
  sm: 4,
  /** Panels and buttons. */
  md: 8,
  /** Cards and large surfaces. */
  lg: 12,
  pill: 999,
} as const;

/**
 * Depth is spent, not sprinkled. Most surfaces are flat with a hairline; only
 * something genuinely lifted off the page gets a shadow.
 */
export const SHADOW = {
  none: "none",
  lifted: "0 8px 28px rgba(0,0,0,0.45)",
  floating: "0 18px 50px rgba(0,0,0,0.6)",
} as const;

// ── Motion ───────────────────────────────────────────────────────────────────

/**
 * Short and unfussy. The only place a long animation is allowed is opening a
 * pack, which is the one moment worth waiting for.
 */
export const MOTION = {
  instant: "90ms cubic-bezier(0.2, 0, 0.2, 1)",
  quick: "150ms cubic-bezier(0.2, 0, 0.2, 1)",
  settled: "220ms cubic-bezier(0.16, 1, 0.3, 1)",
  reveal: "600ms cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

// ── Cards ────────────────────────────────────────────────────────────────────

/**
 * Every card on screen is one of these five widths. Nothing picks its own
 * number, so a card in the binder and a card in a deck are recognisably the
 * same object at two sizes rather than two slightly different drawings.
 */
export const CARD_SIZE = {
  /** Thumbnails: a deck's leader on its tile, dense rows. */
  xs: 92,
  /** Deck building, and anywhere many cards are shown at once. */
  sm: 112,
  /** The binder grid, and the card sheet. */
  md: 150,
  /** Showcase rows and the design page. */
  lg: 168,
  /** One card carrying a moment on its own: a pack reveal. */
  xl: 220,
} as const;

export type CardSize = keyof typeof CARD_SIZE;

/**
 * At or below this width a card goes compact: short character names, short
 * print labels, one line rather than two. Deck building is the threshold, since
 * that is the first place cards are packed tightly enough for a full name to
 * wrap and take the row's baseline with it.
 */
export const CARD_COMPACT_MAX = CARD_SIZE.sm;

/**
 * How tall to reserve for a card of a given width.
 *
 * Prints differ in height on purpose — the 5★ and 6★ art breaks its frame — so
 * a row hangs them from a common baseline inside a slot this tall, sized for
 * the tallest of them.
 *
 * Not a flat ratio: the art scales with the width but the name plate does not,
 * since its padding and type are fixed. So it is the art, whose tallest aspect
 * is 5:5.4, plus a constant for the plate below it.
 */
const ART_RATIO = 5.4 / 5;
const PLATE_HEIGHT = 67;
const PLATE_HEIGHT_COMPACT = 35;

export function cardSlotHeight(width: number): number {
  const plate = width <= CARD_COMPACT_MAX ? PLATE_HEIGHT_COMPACT : PLATE_HEIGHT;
  return Math.ceil(width * ART_RATIO + plate);
}

// ── Layout ───────────────────────────────────────────────────────────────────

export const LAYOUT = {
  /** The left rail is always there; the app never hides its own navigation. */
  railWidth: 232,
  topBarHeight: 60,
  /** Reading measure for anything with sentences in it. */
  proseWidth: 680,
  contentWidth: 1180,
} as const;
