// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE SETTINGS
//
// Change the extension per screen here.
// Supported: "PNG" | "JPG" | "JPEG" | "WebP" | "avif" (case-insensitive)
//
// All files go in:  public/backgrounds/
// ─────────────────────────────────────────────────────────────────────────────

const bg = (name: string, ext: string) => `url('/backgrounds/${name}.${ext}')`;

export const BG = {
  home:       bg("home",       "jpg"),
  setup:      bg("setup",      "jpg"),
  vow:        bg("vow",        "jpg"),
  coinflip:   bg("coinflip",   "jpg"),
  draft:      bg("draft",      "jpg"),
  reveal:     bg("reveal",     "jpg"),
  placement:  bg("placement",  "jpg"),
  augment:    bg("augment",    "jpg"),
  lockedIn:   bg("locked-in",  "jpg"),
  resolution: bg("resolution", "jpg"),
};
