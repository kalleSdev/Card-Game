/**
 * Short names, for cards too small to carry a full one.
 *
 * There is no rule that derives these, because the name a character is actually
 * called by is not reliably the first word or the last: Ryomen Sukuna is
 * Sukuna, Maki Zenin is Maki, Yuta Okkotsu is Yuta. So the used name is written
 * down per card. No initials and no abbreviations: the known name on its own,
 * or nothing.
 *
 * Anything not listed falls back to the first word of its full name, which is
 * right often enough that a new card is never broken, only slightly generic
 * until someone writes its short name here.
 */
const SHORT: Record<string, string> = {
  "gojo-base": "Gojo",
  yuji: "Yuji",
  toji: "Toji",
  maki: "Maki",
  todo: "Todo",
  megumi: "Megumi",
  nobara: "Nobara",
  nanami: "Nanami",
  geto: "Geto",
  sukuna: "Sukuna",
  choso: "Choso",
  yuta: "Yuta",
  higuruma: "Higuruma",
  gakuganji: "Gakuganji",
  miguel: "Miguel",
  mahito: "Mahito",
  jogo: "Jogo",
  hanami: "Hanami",
  dagon: "Dagon",
  panda: "Panda",
  inumaki: "Inumaki",
  hakari: "Hakari",
  kirara: "Kirara",
  mechamaru: "Mechamaru",
  miwa: "Miwa",
  naoya: "Naoya",
  kashimo: "Kashimo",
  mahoraga: "Mahoraga",
  takaba: "Takaba",
  ryu: "Ryu",
  uro: "Uro",
  kurourushi: "Kurourushi",
  jinichi: "Jinichi",
  dabura: "Dabura",
};

export function shortNameFor(id: string, fullName: string): string {
  return SHORT[id] ?? fullName.split(" ")[0];
}

/**
 * Names that do not fit a card's plate on one line.
 *
 * Measured rather than guessed: a card in the binder is 150px wide, which
 * leaves 128px of plate, and the name is set in Fraunces 700 at 15px. At that
 * size these six run from 123px to 141px, so they wrap onto a second line and
 * take up half the plate doing it. Everything else lands at 109px or under and
 * fits with room to spare.
 *
 * A wrapped name is worse than a short one: the character is called by their
 * known name anyway. Re-measure this list if the plate or the type changes.
 */
const SPILLS = new Set([
  "megumi",    // Megumi Fushiguro, 141px
  "higuruma",  // Higuruma Hiromi, 135px
  "takaba",    // Takaba Fumihiko, 131px
  "nobara",    // Nobara Kugisaki, 125px
  "kashimo",   // Hajime Kashimo, 125px
  "sukuna",    // Ryomen Sukuna, 123px
]);

/**
 * The name a card actually shows. Small cards always use the known name; large
 * ones use the full name unless it would wrap.
 */
export function displayNameFor(id: string, fullName: string, compact: boolean): string {
  if (compact || SPILLS.has(id)) return shortNameFor(id, fullName);
  return fullName;
}
