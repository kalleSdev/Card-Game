// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE SETTINGS
//
// Change the extension per screen here.
// Supported: "PNG" | "JPG" | "JPEG" | "WebP" | "avif" (case-insensitive)
//
// All files go in:  public/backgrounds/
// ─────────────────────────────────────────────────────────────────────────────

const bg = (name: string, ext: string) => `url('/backgrounds/${name}.${ext}')`;

// Preload all backgrounds, player icons, and card images immediately on import
// so every phase transition and SetupScreen render is instant.
const BG_FILES = [
  "splash","home","setup","vow","coinflip","draft","reveal","placement","augment","locked-in","resolution",
];
for (const name of BG_FILES) { const i = new Image(); i.src = `/backgrounds/${name}.jpg`; }

// Player icons
for (let n = 1; n <= 12; n++) { const i = new Image(); i.src = `/players/player-${n}.jpg`; }

// Card artwork
const CARD_NAMES = [
  "gojo-base","megumi","maki","toji","nanami","choso","yuta","kirara","higuruma",
  "kashimo","takaba","gakuganji","mechamaru","miwa","miguel","mahito","jogo",
  "hanami","dagon","panda","naoya","mahoraga","ryu","kurourushi","jinichi",
  "dabura","geto","todo","yuji","inumaki","hakari","nobara","sukuna","uro",
  "card-back",
];
for (const name of CARD_NAMES) {
  const i = new Image();
  i.src = `/cards/${name}.PNG`;
}

// Weapon images — preload only if the folder exists (add PNGs to public/weapons/)
// Files expected: playful-cloud.PNG, split-soul-katana.PNG, etc.
// Preload is commented out until weapon images are added to public/weapons/
// const WEAPON_NAMES = ["playful-cloud","split-soul-katana","inverted-spear","higuruma-gavel","festering-life","dragon-bone","nobara-hammer","electric-guitar","black-rope","miwa-sword"];
// for (const name of WEAPON_NAMES) { const i = new Image(); i.src = `/weapons/${name}.PNG`; }

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
