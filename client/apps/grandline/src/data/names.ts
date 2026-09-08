/**
 * Short names, for cards too small to carry a full one.
 *
 * There is no rule that derives these, because the name a character is actually
 * called by is not reliably the first word or the last: Ryomen Sukuna is
 * Sukuna, Maki Zenin is Maki, Yuta Okkotsu is Yuta. So the used name is written
 * down per card, and an initial is added only where it earns its place —
 * Toji F. and Takaba F. keep theirs because that is how they read.
 *
 * Anything not listed falls back to the first word of its full name, which is
 * right often enough that a new card is never broken, only slightly generic
 * until someone writes its short name here.
 */
const SHORT: Record<string, string> = {
  "gojo-base": "Gojo",
  yuji: "Yuji",
  toji: "Toji F.",
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
  takaba: "Takaba F.",
  ryu: "Ryu",
  uro: "Uro",
  kurourushi: "Kurourushi",
  jinichi: "Jinichi",
  dabura: "Dabura",
};

export function shortNameFor(id: string, fullName: string): string {
  return SHORT[id] ?? fullName.split(" ")[0];
}
