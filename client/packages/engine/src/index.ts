import {
  BindingVowId,
  CardDef,
  DomainOutcomeEntry,
  DraftPoolCard,
  EquippedItem,
  GameEvent,
  GameState,
  Intent,
  PlayerId,
  PlayerZones,
  SynergyId,
  otherPlayer,
} from "@cg/contracts";

// ===== Vow definitions (exported for UI) =====
export const VOW_DEFS: Record<BindingVowId, {
  name: string;
  description: string;
  reward: string;
  penalty: string;
  icon: string;
}> = {
  LEADERS_GAMBIT: {
    name: "Leader's Gambit",
    description: "Your leader must be SSS or X rarity at resolution.",
    reward: "+6% total score",
    penalty: "-6% total score",
    icon: "👑",
  },
  BROTHERHOOD_PACT: {
    name: "Brotherhood Pact",
    description: "Brotherhood synergy (Yuji + Todo or Choso) must be active at resolution.",
    reward: "+8% total score",
    penalty: "-6% total score",
    icon: "🤝",
  },
  BLIND_FAITH: {
    name: "Blind Faith",
    description: "You cannot use any spells during the draft.",
    reward: "+10% total score",
    penalty: "Spells are blocked (enforced)",
    icon: "🙈",
  },
  HEAVENLY_RESTRICTION_VOW: {
    name: "Heavenly Restriction",
    description: "Both Toji and Maki must be on your board at resolution.",
    reward: "+7% total score",
    penalty: "-4% total score",
    icon: "⛓",
  },
  KING_OF_CURSES_VOW: {
    name: "King of Curses",
    description: "+3% for each Curse on your team, −1% for each non-Curse.",
    reward: "+3% per Curse card",
    penalty: "−1% per non-Curse card",
    icon: "💀",
  },
};

export type ApplyResult = {
  state: GameState;
  events: GameEvent[];
};

export type Engine = {
  getState(): GameState;
  applyIntent(intent: Intent): ApplyResult;
};

// ===== Roulette items =====
export type RouletteItemDef = {
  id: string;
  name: string;
  baseBonus: number;
  conditionalDesc?: string;
};

export const ROULETTE_ITEM_MAP: Record<string, RouletteItemDef> = {
  "playful-cloud":    { id: "playful-cloud",    name: "Playful Cloud",             baseBonus: 2000 },
  "split-soul-katana":{ id: "split-soul-katana", name: "Split Soul Katana",         baseBonus: 1500,  conditionalDesc: "+ if on Toji" },
  "inverted-spear":   { id: "inverted-spear",    name: "Inverted Spear of Heaven",  baseBonus: 500,  conditionalDesc: "+ if enemy has Gojo" },
  "jet-black-blade":  { id: "jet-black-blade",   name: "Jet Black Blade",           baseBonus: 1000 },
  "higuruma-gavel":   { id: "higuruma-gavel",    name: "Higuruma's Gavel",          baseBonus: 500,  conditionalDesc: "+ if on Higuruma" },
  "festering-life":   { id: "festering-life",    name: "Festering Life Sword",      baseBonus: 1000, conditionalDesc: "+ if on Kurourushi" },
  "dragon-bone":      { id: "dragon-bone",        name: "Dragon Bone",               baseBonus: 1500, conditionalDesc: "+ if on Maki" },
  "mei-battle-axe":   { id: "mei-battle-axe",    name: "Mei's Battle Axe",          baseBonus: 500 },
  "slaughter-demon":  { id: "slaughter-demon",   name: "Slaughter Demon",           baseBonus: 500 },
  "nobara-hammer":    { id: "nobara-hammer",      name: "Nobara's Hammer",           baseBonus: 500,  conditionalDesc: "+ if on Nobara" },
  "electric-guitar":  { id: "electric-guitar",   name: "Electric Guitar",           baseBonus: 500,  conditionalDesc: "+ if on Gakuganji" },
  "black-rope":       { id: "black-rope",         name: "Black Rope",                baseBonus: 1000, conditionalDesc: "+ if on Miguel" },
};

const ALL_ROULETTE_IDS = Object.keys(ROULETTE_ITEM_MAP);

// ===== Domain / Unleash effects (LOCKED_IN phase) =====
export type DomainEffectDef = {
  name: string;
  technique: string;
  type: "domain" | "technique"; // domain = full expansion, technique = cursed technique unleash
  ownPct: number;
  enemyPct: number; // negative = penalty to enemy; 0 = none
};

export const DOMAIN_EFFECTS: Record<string, DomainEffectDef> = {
  // X tier
  "gojo-base": { name: "Infinite Void",                       technique: "Unlimited Void",                  type: "domain",    ownPct: 10, enemyPct: -6 },
  "sukuna":    { name: "Malevolent Shrine",                   technique: "Dismantle & Cleave",              type: "domain",    ownPct: 10, enemyPct: -6 },
  "dabura":    { name: "Demon Realm",                         technique: "Darkness Sword",                  type: "domain",    ownPct: 9,  enemyPct: -5 },
  // SS
  "yuta":      { name: "Rika Orimoto",                        technique: "True Love's Curse",               type: "domain",    ownPct: 6,  enemyPct: -2},
  "toji":      { name: "Heavenly Restriction Assault",        technique: "Pure Force",                      type: "technique", ownPct: 6,  enemyPct: -2 },
  // S
  "geto":      { name: "Maximum: Uzumaki",                    technique: "Cursed Spirit Manipulation",      type: "domain",    ownPct: 6,  enemyPct: -3 },
  "mahito":    { name: "Self-Embodiment of Perfection",       technique: "Idle Transfiguration",            type: "domain",    ownPct: 6,  enemyPct:  0 },
  "jogo":      { name: "Coffin of the Iron Mountain",         technique: "Disaster Flames",                 type: "domain",    ownPct: 6,  enemyPct: -2 },
  "hanami":    { name: "Disaster Plants",                     technique: "Wooden Field",                      type: "technique", ownPct: 5,  enemyPct:  0 },
  "dagon":     { name: "Horizon of the Captivating Skandha",  technique: "Disaster Sea",                    type: "domain",    ownPct: 5,  enemyPct: -2 },
  // A
  "higuruma":  { name: "Deadly Sentencing",                   technique: "Judgeman",                        type: "domain",    ownPct: 5,  enemyPct: -2 },
  "yuji":      { name: "Divergent Fist",                      technique: "Black Flash",                     type: "technique", ownPct: 5,  enemyPct:  0 },
  "maki":      { name: "Cursed Tools Arsenal",                technique: "Heavenly Restriction",            type: "technique", ownPct: 4,  enemyPct:  0 },
  "choso":     { name: "Piercing Blood",                      technique: "Blood Manipulation",              type: "technique", ownPct: 4,  enemyPct: -1 },
  "megumi":    { name: "Chimera Shadow Garden",               technique: "Ten Shadows Technique",           type: "domain",    ownPct: 4,  enemyPct:  0 },
  "todo":      { name: "Boogie Woogie",                       technique: "Clap Exchange",                   type: "technique", ownPct: 4,  enemyPct:  0 },
  "miguel":    { name: "Black Rope Counter",                  technique: "Anti-Cursed Tool",                type: "technique", ownPct: 4,  enemyPct:  0 },
  // B
  "nobara":    { name: "Resonance",                           technique: "Straw Doll Technique",            type: "technique", ownPct: 3,  enemyPct:  0 },
  "nanami":    { name: "Ratio Technique",                     technique: "Structural Weakness",             type: "technique", ownPct: 3,  enemyPct: -1 },
  "gakuganji": { name: "Cursed Song",                         technique: "Electric Guitar",                 type: "technique", ownPct: 3,  enemyPct:  0 },
  "miwa":      { name: "Simple Domain",                       technique: "New Shadow Style",                type: "technique", ownPct: 2,  enemyPct:  0 },
  // New roster
  "panda":     { name: "Blunt Force Rampage",                 technique: "Gorilla Mode",                    type: "technique", ownPct: 4,  enemyPct:  0 },
  "inumaki":   { name: "Cursed Speech Assault",               technique: "Cursed Speech",                   type: "technique", ownPct: 4,  enemyPct: -2 },
  "hakari":    { name: "Idle Death Gamble",                   technique: "Jackpot-Infinite Cursed Energy",   type: "domain",    ownPct: 7,  enemyPct: -2 },
  "kirara":    { name: "Star Map Navigation",                 technique: "Love Rendezvous",                  type: "technique", ownPct: 3,  enemyPct:  0 },
  "mechamaru": { name: "Puppet Siege",                        technique: "Ultimate Mechamaru Mode",          type: "technique", ownPct: 4,  enemyPct: -1 },
  "naoya":     { name: "Projection Strike",                   technique: "Projection Sorcery",               type: "technique", ownPct: 5,  enemyPct: -1 },
  "kashimo":   { name: "Mythological Beast Amber",            technique: "Giga Slash",                       type: "technique", ownPct: 6,  enemyPct: -2 },
  "mahoraga":  { name: "Adaptation",                          technique: "Eight-Handled Sword Divergent Sila", type: "technique", ownPct: 8, enemyPct: -3 },
  "takaba":    { name: "Comedian",                            technique: "Reality Alteration",               type: "technique", ownPct: 6,  enemyPct:  0 },
  "ryu":       { name: "Granite Blast",                       technique: "Cursed Energy Discharge",          type: "technique", ownPct: 5,  enemyPct: -2 },
  "uro":       { name: "Shattered Heaven",                    technique: "Sky Manipulation",                 type: "domain",    ownPct: 5,  enemyPct: -1 },
  "kurourushi":{ name: "Cursed Cockroach Swarm",              technique: "Supernaturally Large",             type: "technique", ownPct: 5,  enemyPct: -1 },
  "jinichi":   { name: "Water Discharge",                     technique: "Water Manipulation",               type: "technique", ownPct: 4,  enemyPct:  0 },
};

export const DEFAULT_DOMAIN: DomainEffectDef = {
  name: "Cursed Technique",
  technique: "Basic Output",
  type: "technique",
  ownPct: 3,
  enemyPct: 0,
};

const computeItemBonus = (
  itemId: string,
  targetDefId: string,
  enemyZones: PlayerZones,
  cardDb: Record<string, CardDef>,
): number => {
  const itemDef = ROULETTE_ITEM_MAP[itemId];
  if (!itemDef) return 0;

  let bonus = itemDef.baseBonus;

  // Character-specific conditionals
  const enemyBoard = [enemyZones.board.leader, ...enemyZones.board.combat, ...enemyZones.board.support].filter(Boolean);
  if (itemId === "inverted-spear"  && enemyBoard.some(c => c?.defId === "gojo-base")) bonus += 3000;
  if (itemId === "electric-guitar" && targetDefId === "gakuganji")  bonus += 1500;
  if (itemId === "black-rope"      && targetDefId === "miguel")      bonus += 2000;
  if (itemId === "higuruma-gavel"  && targetDefId === "higuruma")    bonus += 1500; 
  if (itemId === "nobara-hammer"   && targetDefId === "nobara")       bonus += 500;  
  if (itemId === "dragon-bone"     && targetDefId === "maki")         bonus += 1000;
  if (itemId === "festering-life"  && targetDefId === "kurourushi")   bonus += 1000;
  if (itemId === "split-soul-katana" && targetDefId === "toji")       bonus += 1000;
  // Naoya appreciates any weapon — +1000 flat bonus on all weapons
  if (targetDefId === "naoya") bonus += 1000;

  // Weapon perk scaling — Toji doubles, Maki +50%, Todo +35%
  const targetCardDef = cardDb[targetDefId];
  switch (targetCardDef?.perks?.weaponEfficiency) {
    case "double": bonus = Math.round(bonus * 2);    break;
    case "plus":   bonus = Math.round(bonus * 1.5);  break;
    case "base":   bonus = Math.round(bonus * 1.35); break;
  }

  return bonus;
};

// ===== Card database =====
const CARD_DB: GameState["cardDb"] = {
  "gojo-base": {
    id: "gojo-base",
    name: "Gojo Satoru",
    rarity: "X",
    basePoints: 15000,
    affinity: "LEADER",
    tags: ["sorcerer", "jujutsu-high", "gojo-clan", "six-eyes", "strongest"],
    offRolePenalties: { combat: 0.8, support: 0.7 },
  },
  "yuji": {
    id: "yuji",
    name: "Yuji Itadori",
    rarity: "A",
    basePoints: 10000,
    affinity: "COMBAT",
    tags: ["sorcerer", "curse", "jujutsu-high", "kenjaku", "brother", "gojo-student"],
    offRolePenalties: { leader: 0.8, support: 0.7 },
  },
  "toji": {
    id: "toji",
    name: "Toji Fushiguro",
    rarity: "SS",
    basePoints: 13000,
    affinity: "COMBAT",
    tags: ["heavenly-restriction", "zenin-clan", "assassin"],
    offRolePenalties: { leader: 0.85, support: 0.6 },
    perks: { weaponEfficiency: "double" },
  },
  "maki": {
    id: "maki",
    name: "Maki Zenin",
    rarity: "SS",
    basePoints: 12500,
    affinity: "COMBAT",
    tags: ["heavenly-restriction", "zenin-clan", "sorcerer", "tokyo-senior"],
    offRolePenalties: { leader: 0.8, support: 0.8 },
    perks: { weaponEfficiency: "plus" },
  },
  "todo": {
    id: "todo",
    name: "Todo Aoi",
    rarity: "A",
    basePoints: 9000,
    affinity: "SUPPORT",
    tags: ["kyoto", "brother", "sorcerer"],
    offRolePenalties: { leader: 0.8, combat: 0.85 },
    perks: { weaponEfficiency: "base" },
  },
  "megumi": {
    id: "megumi",
    name: "Megumi Fushiguro",
    rarity: "A",
    basePoints: 9000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "jujutsu-high", "zenin-clan", "ten-shadows", "gojo-student"],
    offRolePenalties: { leader: 0.75, combat: 0.85 },
  },
  "nobara": {
    id: "nobara",
    name: "Nobara Kugisaki",
    rarity: "B",
    basePoints: 8000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "jujutsu-high", "straw-doll", "gojo-student"],
    offRolePenalties: { leader: 0.7, combat: 0.8 },
  },
  "nanami": {
    id: "nanami",
    name: "Nanami Kento",
    rarity: "B",
    basePoints: 8500,
    affinity: "SUPPORT",
    tags: ["sorcerer", "ratio"],
    offRolePenalties: { leader: 0.9, combat: 0.85 },
  },
  "geto": {
    id: "geto",
    name: "Geto Suguru",
    rarity: "SS",
    basePoints: 12000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "curse-spirit"],
    offRolePenalties: { leader: 0.8, combat: 0.75 },
  },
  "sukuna": {
    id: "sukuna",
    name: "Ryomen Sukuna",
    rarity: "X",
    basePoints: 15000,
    affinity: "LEADER",
    tags: ["curse", "king-of-curses", "malevolent-shrine", "strongest"],
    offRolePenalties: { combat: 0.85, support: 0.7 },
  },
  "choso": {
    id: "choso",
    name: "Choso",
    rarity: "A",
    basePoints: 10000,
    affinity: "SUPPORT",
    tags: ["curse", "kenjaku", "blood-manipulation", "brother"],
    offRolePenalties: { leader: 0.75, support: 0.9 },
  },
  "yuta": {
    id: "yuta",
    name: "Yuta Okkotsu",
    rarity: "SS",
    basePoints: 12500,
    affinity: "LEADER",
    tags: ["sorcerer", "jujutsu-high", "six-eyes", "rika"],
    offRolePenalties: { combat: 0.85, support: 0.7 },
  },
  "higuruma": {
    id: "higuruma",
    name: "Higuruma Hiromi",
    rarity: "A",
    basePoints: 9000,
    affinity: "LEADER",
    tags: ["sorcerer", "judgeman"],
    offRolePenalties: { combat: 0.8, support: 0.75 },
  },
  "gakuganji": {
    id: "gakuganji",
    name: "Gakuganji",
    rarity: "B",
    basePoints: 8000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "kyoto", "elder"],
    offRolePenalties: { leader: 0.7, combat: 0.75 },
  },
  "miguel": {
    id: "miguel",
    name: "Miguel",
    rarity: "A",
    basePoints: 9500,
    affinity: "COMBAT",
    tags: ["sorcerer", "miguel-rope"],
    offRolePenalties: { leader: 0.8, support: 0.8 },
  },
  "mahito": {
    id: "mahito",
    name: "Mahito",
    rarity: "S",
    basePoints: 11500,
    affinity: "COMBAT",
    tags: ["curse", "idle-transfiguration", "disaster-curse"],
    offRolePenalties: { leader: 0.8, support: 0.75 },
  },
  "jogo": {
    id: "jogo",
    name: "Jogo",
    rarity: "S",
    basePoints: 11000,
    affinity: "COMBAT",
    tags: ["curse", "disaster-flame", "disaster-curse"],
    offRolePenalties: { leader: 0.75, support: 0.8 },
  },
  "hanami": {
    id: "hanami",
    name: "Hanami",
    rarity: "S",
    basePoints: 10000,
    affinity: "SUPPORT",
    tags: ["curse", "disaster-plant", "disaster-curse"],
    offRolePenalties: { leader: 0.75, combat: 0.85 },
  },
  "dagon": {
    id: "dagon",
    name: "Dagon",
    rarity: "S",
    basePoints: 10000,
    affinity: "SUPPORT",
    tags: ["curse", "disaster-sea", "disaster-curse"],
    offRolePenalties: { leader: 0.7, combat: 0.8 },
  },

  // ===== New roster =====
  "panda": {
    id: "panda",
    name: "Panda",
    rarity: "A",
    basePoints: 9000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "jujutsu-high", "cursed-corpse", "tokyo-senior"],
    offRolePenalties: { leader: 0.8, combat: 0.8 },
  },
  "inumaki": {
    id: "inumaki",
    name: "Inumaki Toge",
    rarity: "A",
    basePoints: 9500,
    affinity: "SUPPORT",
    tags: ["sorcerer", "jujutsu-high", "cursed-speech", "inumaki-clan", "tokyo-senior"],
    offRolePenalties: { leader: 0.75, combat: 0.85 },
  },
  "hakari": {
    id: "hakari",
    name: "Hakari Kinji",
    rarity: "SS",
    basePoints: 12000,
    affinity: "COMBAT",
    tags: ["sorcerer", "gambler"],
    offRolePenalties: { leader: 0.9, support: 0.7 },
  },
  "kirara": {
    id: "kirara",
    name: "Kirara Hoshi",
    rarity: "A",
    basePoints: 9000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "star-map"],
    offRolePenalties: { leader: 0.7, combat: 0.7 },
  },
  "mechamaru": {
    id: "mechamaru",
    name: "Mechamaru",
    rarity: "S",
    basePoints: 10000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "puppet", "heavenly-restriction", "kyoto"],
    offRolePenalties: { leader: 0.8, combat: 0.9 },
  },
  "miwa": {
    id: "miwa",
    name: "Miwa Kasumi",
    rarity: "B",
    basePoints: 8000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "jujutsu-high", "kyoto"],
    offRolePenalties: { leader: 0.7, combat: 0.8 },
  },
  "naoya": {
    id: "naoya",
    name: "Naoya Zenin",
    rarity: "S",
    basePoints: 10500,
    affinity: "COMBAT",
    tags: ["sorcerer", "zenin-clan", "zenin-elder", "projection"],
    offRolePenalties: { leader: 0.8, support: 0.8 },
  },
  "kashimo": {
    id: "kashimo",
    name: "Hajime Kashimo",
    rarity: "SS",
    basePoints: 12500,
    affinity: "COMBAT",
    tags: ["sorcerer", "ancient", "culling-game", "mythological-beast"],
    offRolePenalties: { leader: 0.8, support: 0.65 },
  },
  "mahoraga": {
    id: "mahoraga",
    name: "Mahoraga",
    rarity: "SSS",
    basePoints: 14000,
    affinity: "COMBAT",
    tags: ["curse", "shikigami", "ten-shadows", "strongest"],
    offRolePenalties: { leader: 0.85, support: 0.6 },
  },
  "takaba": {
    id: "takaba",
    name: "Takaba Fumihiko",
    rarity: "SSS",
    basePoints: 13500,
    affinity: "SUPPORT",
    tags: ["sorcerer", "culling-game", "comedian"],
    offRolePenalties: { leader: 0.9, combat: 0.9 },
  },
  "ryu": {
    id: "ryu",
    name: "Ryu Ishigori",
    rarity: "S",
    basePoints: 11000,
    affinity: "COMBAT",
    tags: ["sorcerer", "culling-game", "granite-blast"],
    offRolePenalties: { leader: 0.8, support: 0.7 },
  },
  "uro": {
    id: "uro",
    name: "Takako Uro",
    rarity: "S",
    basePoints: 10500,
    affinity: "SUPPORT",
    tags: ["sorcerer", "culling-game", "sky-manipulation"],
    offRolePenalties: { leader: 0.8, support: 0.75 },
  },
  "kurourushi": {
    id: "kurourushi",
    name: "Kurourushi",
    rarity: "S",
    basePoints: 11000,
    affinity: "COMBAT",
    tags: ["curse", "special-grade", "culling-game", "strongest"],
    offRolePenalties: { leader: 0.9, support: 1 },
  },
  "jinichi": {
    id: "jinichi",
    name: "Jinichi Zenin",
    rarity: "S",
    basePoints: 10000,
    affinity: "SUPPORT",
    tags: ["sorcerer", "zenin-clan", "zenin-elder"],
    offRolePenalties: { leader: 0.75, combat: 0.85 },
  },
  "dabura": {
    id: "dabura",
    name: "Dabura",
    rarity: "X",
    basePoints: 15000,
    affinity: "LEADER",
    tags: ["curse", "demon-king", "strongest"],
    offRolePenalties: { combat: 0.85, support: 0.7 },
  },
};

// ===== Scoring =====

const SLOT_MULTIPLIER: Record<"LEADER" | "COMBAT" | "SUPPORT", number> = {
  LEADER: 1.5,
  COMBAT: 1.0,
  SUPPORT: 0.8,
};

const getOffRoleMul = (def: CardDef, slotType: "LEADER" | "COMBAT" | "SUPPORT"): number => {
  if (def.affinity === slotType) return 1.0;
  const p = def.offRolePenalties;
  if (!p) return 0.7;
  switch (slotType) {
    case "LEADER":  return p.leader  ?? 0.7;
    case "COMBAT":  return p.combat  ?? 0.7;
    case "SUPPORT": return p.support ?? 0.7;
  }
};

const calcCardContribution = (
  state: GameState,
  card: { defId: string },
  slotType: "LEADER" | "COMBAT" | "SUPPORT"
): number => {
  const def = state.cardDb[card.defId];
  if (!def) return 0;
  return def.basePoints * SLOT_MULTIPLIER[slotType] * getOffRoleMul(def, slotType);
};

// ===== Helpers =====

const listBoardCards = (state: GameState, p: PlayerId) => {
  const b = state.players[p].board;
  return [b.leader, ...b.combat, ...b.support].filter(Boolean) as Array<{ defId: string }>;
};

const countTagOnBoard = (state: GameState, p: PlayerId, tag: string): number =>
  listBoardCards(state, p).filter(c => state.cardDb[c.defId]?.tags?.includes(tag)).length;

const hasOnBoard = (state: GameState, p: PlayerId, defId: string): boolean =>
  listBoardCards(state, p).some(c => c.defId === defId);

// ===== Synergies =====

const calcSynergies = (state: GameState, p: PlayerId): SynergyId[] => {
  const syn: SynergyId[] = [];

  // Heavenly Restriction: specifically Maki + Toji (not Mechamaru)
  if (hasOnBoard(state, p, "maki") && hasOnBoard(state, p, "toji")) syn.push("ATTR_HEAVENLY_2");
  if (countTagOnBoard(state, p, "zenin-clan") >= 2)           syn.push("ATTR_ZENIN_2");
  if (countTagOnBoard(state, p, "jujutsu-high") >= 3)         syn.push("ATTR_JUJUTSU_3");

  // Brotherhood: all 3 = +8%, any 2 = +5%
  const hasYuji  = hasOnBoard(state, p, "yuji");
  const hasTodo  = hasOnBoard(state, p, "todo");
  const hasChoso = hasOnBoard(state, p, "choso");
  if (hasYuji && hasTodo && hasChoso)
    syn.push("REL_BROTHERHOOD_3");
  else if (hasYuji && (hasTodo || hasChoso))
    syn.push("REL_BROTHERHOOD");

  if (hasOnBoard(state, p, "gojo-base") && hasOnBoard(state, p, "geto"))
    syn.push("REL_MEMORY_RES");

  // Gojo student boost — scales with student count
  if (hasOnBoard(state, p, "gojo-base")) {
    const studentCount = countTagOnBoard(state, p, "gojo-student");
    if (studentCount >= 3)      syn.push("REL_GOJO_3STUDENTS");
    else if (studentCount >= 2) syn.push("REL_GOJO_2STUDENTS");
  }

  // Disaster Curse combo — Mahito, Jogo, Hanami, Dagon
  const disasterCount = ["mahito", "jogo", "hanami", "dagon"].filter(id => hasOnBoard(state, p, id)).length;
  if (disasterCount >= 4)      syn.push("DISASTER_CURSE_4");
  else if (disasterCount >= 3) syn.push("DISASTER_CURSE_3");
  else if (disasterCount >= 2) syn.push("DISASTER_CURSE_2");

  // Tokyo Trio — Inumaki + Panda + Maki (via "tokyo-senior" tag)
  const tokyoCount = countTagOnBoard(state, p, "tokyo-senior");
  if (tokyoCount >= 3)      syn.push("TOKYO_TRIO_3");
  else if (tokyoCount >= 2) syn.push("TOKYO_TRIO_2");

  // The Strongest — Gojo, Sukuna, Kurourushi, Mahoraga, Dabura (via "strongest" tag)
  const strongestCount = countTagOnBoard(state, p, "strongest");
  if (strongestCount >= 4)      syn.push("THE_STRONGEST_4");
  else if (strongestCount >= 3) syn.push("THE_STRONGEST_3");
  else if (strongestCount >= 2) syn.push("THE_STRONGEST_2");

  // Lucky Star — Hakari + Kirara
  if (hasOnBoard(state, p, "hakari") && hasOnBoard(state, p, "kirara"))
    syn.push("LUCKY_STAR");

  // Triple Domain Clash — Uro + Ryu + Yuta (all 3)
  if (hasOnBoard(state, p, "uro") && hasOnBoard(state, p, "ryu") && hasOnBoard(state, p, "yuta"))
    syn.push("TRIPLE_DOMAIN_CLASH");

  // Zenin Elders — Naoya + Jinichi
  if (hasOnBoard(state, p, "naoya") && hasOnBoard(state, p, "jinichi"))
    syn.push("ZENIN_ELDERS");

  // Unpredictable Duo — Takaba + Hakari (both RNG/chaos-based powers)
  if (hasOnBoard(state, p, "takaba") && hasOnBoard(state, p, "hakari"))
    syn.push("UNPREDICTABLE_DUO");

  // Six Eyes — Gojo + Yuta (the only two six-eyes bearers)
  if (hasOnBoard(state, p, "gojo-base") && hasOnBoard(state, p, "yuta"))
    syn.push("SIX_EYES");

  // Culling Game — characters who fought in the culling game
  const cullingCount = countTagOnBoard(state, p, "culling-game");
  if (cullingCount >= 4)      syn.push("CULLING_GAME_4");
  else if (cullingCount >= 3) syn.push("CULLING_GAME_3");

  // Afrobeat — Yuta + Miguel
  if (hasOnBoard(state, p, "yuta") && hasOnBoard(state, p, "miguel"))
    syn.push("AFROBEAT");
  if (hasOnBoard(state, p, "yuta") && hasOnBoard(state, p, "maki")) syn.push("YUTA_MAKI");

  // Kyoto sorcerers — Todo, Miwa, Mechamaru (all tagged "kyoto")
  const kyotoCount = countTagOnBoard(state, p, "kyoto");
  if (kyotoCount >= 3)      syn.push("KYOTO_3");
  else if (kyotoCount >= 2) syn.push("KYOTO_2");

  return syn;
};

const calcPlayerScorePreview = (state: GameState, p: PlayerId): number => {
  const b = state.players[p].board;
  const aug = state.players[p].augments;
  let total = 0;
  if (b.leader) {
    total += calcCardContribution(state, b.leader, "LEADER");
    total += aug[b.leader.instanceId] ?? 0;
  }
  for (const c of b.combat) if (c) {
    total += calcCardContribution(state, c, "COMBAT");
    total += aug[c.instanceId] ?? 0;
  }
  for (const s of b.support) if (s) {
    total += calcCardContribution(state, s, "SUPPORT");
    total += aug[s.instanceId] ?? 0;
  }
  return total;
};

const applySynergyBonus = (base: number, synergies: SynergyId[]): number => {
  let score = base;
  if (synergies.includes("ATTR_HEAVENLY_2"))    score *= 1.05;
  if (synergies.includes("ATTR_ZENIN_2"))       score *= 1.03;
  if (synergies.includes("ATTR_JUJUTSU_3"))     score *= 1.05;
  if (synergies.includes("REL_MEMORY_RES"))     score *= 1.05;
  if (synergies.includes("REL_BROTHERHOOD_3"))  score *= 1.08;
  else if (synergies.includes("REL_BROTHERHOOD")) score *= 1.05;
  if (synergies.includes("REL_GOJO_3STUDENTS"))      score *= 1.8;
  else if (synergies.includes("REL_GOJO_2STUDENTS")) score *= 1.05;
  if (synergies.includes("DISASTER_CURSE_4"))        score *= 1.10;
  else if (synergies.includes("DISASTER_CURSE_3"))   score *= 1.06;
  else if (synergies.includes("DISASTER_CURSE_2"))   score *= 1.04;
  if (synergies.includes("TOKYO_TRIO_3"))            score *= 1.06;
  else if (synergies.includes("TOKYO_TRIO_2"))       score *= 1.04;
  if (synergies.includes("THE_STRONGEST_4"))         score *= 5.00;  // instant win
  else if (synergies.includes("THE_STRONGEST_3"))    score *= 1.10;
  else if (synergies.includes("THE_STRONGEST_2"))    score *= 1.06;
  if (synergies.includes("LUCKY_STAR"))              score *= 1.05;
  if (synergies.includes("TRIPLE_DOMAIN_CLASH"))     score *= 1.07;
  if (synergies.includes("ZENIN_ELDERS"))            score *= 1.04;
  if (synergies.includes("UNPREDICTABLE_DUO"))       score *= 1.04;
  if (synergies.includes("SIX_EYES"))                score *= 1.06;
  if (synergies.includes("CULLING_GAME_4"))          score *= 1.07;
  else if (synergies.includes("CULLING_GAME_3"))     score *= 1.05;
  if (synergies.includes("AFROBEAT"))                score *= 1.05;
  if (synergies.includes("KYOTO_3"))                 score *= 1.05;
  else if (synergies.includes("KYOTO_2"))            score *= 1.03;
  if (synergies.includes("YUTA_MAKI"))               score *= 1.05;
  return Math.round(score * 100) / 100;
};

const recomputeScores = (state: GameState): { state: GameState; events: GameEvent[] } => {
  const events: GameEvent[] = [];
  const p1Syn = calcSynergies(state, "P1");
  const p2Syn = calcSynergies(state, "P2");

  const p1Score = Math.round(applySynergyBonus(calcPlayerScorePreview(state, "P1"), p1Syn) * 100) / 100;
  const p2Score = Math.round(applySynergyBonus(calcPlayerScorePreview(state, "P2"), p2Syn) * 100) / 100;

  if (state.players.P1.activeSynergies.join(",") !== p1Syn.join(","))
    events.push({ type: "SYNERGY_CHANGED", by: "P1", synergies: p1Syn });
  if (state.players.P2.activeSynergies.join(",") !== p2Syn.join(","))
    events.push({ type: "SYNERGY_CHANGED", by: "P2", synergies: p2Syn });

  return {
    state: {
      ...state,
      players: {
        P1: { ...state.players.P1, scorePreview: p1Score, activeSynergies: p1Syn },
        P2: { ...state.players.P2, scorePreview: p2Score, activeSynergies: p2Syn },
      },
    },
    events,
  };
};

// ===== Board helpers =====

const isSlotEmpty = (state: GameState, p: PlayerId, target: import("@cg/contracts").SlotRef): boolean => {
  const b = state.players[p].board;
  switch (target.type) {
    case "LEADER":  return b.leader === null;
    case "COMBAT":  return b.combat[target.index] === null;
    case "SUPPORT": return b.support[target.index] === null;
    case "UNLEASH": return b.unleashLocked === null;
    default: { const _x: never = target; return _x; }
  }
};

const placeIntoSlot = (
  state: GameState,
  p: PlayerId,
  target: import("@cg/contracts").SlotRef,
  cardInstanceId: string
): GameState => {
  const zones = state.players[p];
  const handIndex = zones.hand.findIndex(c => c.instanceId === cardInstanceId);
  if (handIndex === -1) return state;

  const card = zones.hand[handIndex];
  const newHand = zones.hand.filter((_, i) => i !== handIndex);
  const newBoard = {
    ...zones.board,
    combat: [...zones.board.combat] as typeof zones.board.combat,
    support: [...zones.board.support] as typeof zones.board.support,
  };

  switch (target.type) {
    case "LEADER":  newBoard.leader = card; break;
    case "COMBAT":  newBoard.combat[target.index] = card; break;
    case "SUPPORT": newBoard.support[target.index] = card; break;
    case "UNLEASH": newBoard.unleashLocked = card; break;
    default: { const _x: never = target; return _x; }
  }

  return {
    ...state,
    players: { ...state.players, [p]: { ...zones, hand: newHand, board: newBoard } },
  };
};

const drawOne = (state: GameState, p: PlayerId): { state: GameState; events: GameEvent[] } => {
  const zones = state.players[p];
  if (zones.deck.length === 0) return { state, events: [] };
  const [top, ...rest] = zones.deck;
  return {
    state: {
      ...state,
      players: { ...state.players, [p]: { ...zones, deck: rest, hand: [...zones.hand, top] } },
    },
    events: [{ type: "CARD_DRAWN", by: p, cardInstanceId: top.instanceId }],
  };
};

// ===== Vow scoring =====

const isBoardFull = (zones: PlayerZones): boolean =>
  zones.board.leader !== null &&
  zones.board.combat.every(c => c !== null) &&
  zones.board.support.every(s => s !== null);

type VowResult = { score: number; outcome: { met: boolean; pct: number } };

const applyVowToScore = (state: GameState, p: PlayerId, base: number): VowResult => {
  const vow = state.vowsChosen[p];
  if (!vow) return { score: base, outcome: { met: true, pct: 0 } };

  const board = state.players[p].board;
  const synergies = state.players[p].activeSynergies;
  const r = (n: number) => Math.round(n * 100) / 100;

  switch (vow) {
    case "LEADERS_GAMBIT": {
      const leaderDef = board.leader ? state.cardDb[board.leader.defId] : null;
      const met = leaderDef?.rarity === "SSS" || leaderDef?.rarity === "X";
      const pct = met ? 6 : -6;
      return { score: r(base * (1 + pct / 100)), outcome: { met, pct } };
    }
    case "BROTHERHOOD_PACT": {
      const met = synergies.includes("REL_BROTHERHOOD") || synergies.includes("REL_BROTHERHOOD_3");
      const pct = met ? 8 : -6;
      return { score: r(base * (1 + pct / 100)), outcome: { met, pct } };
    }
    case "BLIND_FAITH": {
      return { score: r(base * 1.10), outcome: { met: true, pct: 10 } };
    }
    case "HEAVENLY_RESTRICTION_VOW": {
      const met = hasOnBoard(state, p, "maki") && hasOnBoard(state, p, "toji");
      const pct = met ? 7 : -4;
      return { score: r(base * (1 + pct / 100)), outcome: { met, pct } };
    }
    case "KING_OF_CURSES_VOW": {
      const cards = listBoardCards(state, p);
      let curses = 0, nonCurses = 0;
      for (const c of cards) {
        state.cardDb[c.defId]?.tags?.includes("curse") ? curses++ : nonCurses++;
      }
      const pct = Math.round((curses * 3 - nonCurses * 1) * 10) / 10;
      const met = pct >= 0;
      return { score: r(base * (1 + pct / 100)), outcome: { met, pct } };
    }
    default: return { score: base, outcome: { met: true, pct: 0 } };
  }
};

// ===== Draft helpers =====

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const emptyZones = (): PlayerZones => ({
  deck: [],
  hand: [],
  scorePreview: 0,
  activeSynergies: [],
  augments: {},
  board: {
    leader: null,
    combat: [null, null],
    support: [null, null, null],
    unleashLocked: null,
  },
});

const updatePoolCard = (
  pool: DraftPoolCard[],
  instanceId: string,
  patch: Partial<DraftPoolCard>
): DraftPoolCard[] =>
  pool.map(c => c.instanceId === instanceId ? { ...c, ...patch } : c);


// ===== Initial state =====

export const createInitialState = (): GameState => {
  const draftPool: DraftPoolCard[] = shuffle(
    Object.keys(CARD_DB).map(defId => ({
      instanceId: `pool-${defId}`,
      defId,
      identityRevealed: false,
      shownRarity: undefined,
    }))
  );

  return {
    version: 1,
    phase: "BINDING_VOW",
    turn: 1,
    activePlayerId: "P1",
    lockedIn: { P1: false, P2: false },
    vowsChosen: { P1: null, P2: null },
    vowsReady: { P1: false, P2: false },
    draft: {
      coinFlipped: false,
      pool: draftPool,
      skipsRemaining: { P1: 999, P2: 999 },
      spellsRemaining: { P1: 3, P2: 3 },
      cardRevealUsed: { P1: 0, P2: 0 },
    },
    cardDb: CARD_DB,
    players: { P1: emptyZones(), P2: emptyZones() },
  };
};

// ===== Engine =====

export const createEngine = (initialState: GameState = createInitialState()): Engine => {
  let state = initialState;

  const illegal = (by: PlayerId, reason: string): GameEvent => ({ type: "ILLEGAL_INTENT", by, reason });

  const applyIntent = (intent: Intent): ApplyResult => {

    // Binding vow — active player commits their oath
    if (intent.type === "CHOOSE_VOW") {
      if (state.phase !== "BINDING_VOW")
        return { state, events: [illegal(intent.playerId, "Not in binding vow phase")] };
      if (intent.playerId !== state.activePlayerId)
        return { state, events: [illegal(intent.playerId, "Not your turn to choose")] };

      const nextVows = { ...state.vowsChosen, [intent.playerId]: intent.vowId };
      const nextReady = { ...state.vowsReady, [intent.playerId]: true };
      const next = otherPlayer(intent.playerId);

      // If both are ready, advance to DRAFT
      if (nextReady.P1 && nextReady.P2) {
        state = { ...state, vowsChosen: nextVows, vowsReady: nextReady, phase: "DRAFT" };
      } else {
        state = { ...state, vowsChosen: nextVows, vowsReady: nextReady, activePlayerId: next };
      }
      return { state, events: [] };
    }

    // Coin flip — anyone can trigger, no active-player check
    if (intent.type === "FLIP_COIN") {
      if (!state.draft || state.draft.coinFlipped)
        return { state, events: [illegal(state.activePlayerId, "Coin already flipped")] };
      state = {
        ...state,
        activePlayerId: intent.firstPicker,
        draft: { ...state.draft, coinFlipped: true },
      };
      return { state, events: [] };
    }

    // All other intents require it to be the sender's turn
    if (intent.playerId !== state.activePlayerId)
      return { state, events: [illegal(intent.playerId, "Not your turn")] };

    switch (intent.type) {

      // ===== DRAFT SPELLS (don't consume the turn) =====

      case "SPELL_CARD_REVEAL": {
        if (state.phase !== "DRAFT" || !state.draft)
          return { state, events: [illegal(intent.playerId, "Not in draft phase")] };
        if (state.vowsChosen[intent.playerId] === "BLIND_FAITH")
          return { state, events: [illegal(intent.playerId, "Binding Vow: Blind Faith — spells are forbidden")] };
        if (state.draft.cardRevealUsed[intent.playerId] >= 2)
          return { state, events: [illegal(intent.playerId, "Card Reveal already used this draft")] };
        if (state.draft.spellsRemaining[intent.playerId] <= 0)
          return { state, events: [illegal(intent.playerId, "No spell charges remaining")] };
        const card = state.draft.pool.find(c => c.instanceId === intent.cardInstanceId);
        if (!card || card.identityRevealed)
          return { state, events: [illegal(intent.playerId, "Invalid target")] };

        state = {
          ...state,
          draft: {
            ...state.draft,
            spellsRemaining: { ...state.draft.spellsRemaining, [intent.playerId]: state.draft.spellsRemaining[intent.playerId] - 1 },
            cardRevealUsed: { ...state.draft.cardRevealUsed, [intent.playerId]: state.draft.cardRevealUsed[intent.playerId] + 1 },
            pool: updatePoolCard(state.draft.pool, intent.cardInstanceId, { identityRevealed: true }),
          },
        };
        return { state, events: [{ type: "DRAFT_PICKED", by: intent.playerId, defId: card.defId }] };
      }

      case "SPELL_GLOBAL_RATE": {
        if (state.phase !== "DRAFT" || !state.draft)
          return { state, events: [illegal(intent.playerId, "Not in draft phase")] };
        if (state.vowsChosen[intent.playerId] === "BLIND_FAITH")
          return { state, events: [illegal(intent.playerId, "Binding Vow: Blind Faith — spells are forbidden")] };
        if (state.draft.spellsRemaining[intent.playerId] <= 0)
          return { state, events: [illegal(intent.playerId, "No spell charges remaining")] };
        const card = state.draft.pool.find(c => c.instanceId === intent.cardInstanceId);
        if (!card || card.identityRevealed || card.shownRarity)
          return { state, events: [illegal(intent.playerId, "Invalid target")] };

        const realRarity = state.cardDb[card.defId]?.rarity ?? "C";
        const realRole   = state.cardDb[card.defId]?.affinity ?? undefined;
        state = {
          ...state,
          draft: {
            ...state.draft,
            spellsRemaining: { ...state.draft.spellsRemaining, [intent.playerId]: state.draft.spellsRemaining[intent.playerId] - 1 },
            pool: updatePoolCard(state.draft.pool, intent.cardInstanceId, { shownRarity: realRarity, shownRole: realRole }),
          },
        };
        return { state, events: [{ type: "DRAFT_SKIPPED", by: intent.playerId, skipsLeft: state.draft.spellsRemaining[intent.playerId] }] };
      }

      case "SPELL_FAKE_REVEAL": {
        if (state.phase !== "DRAFT" || !state.draft)
          return { state, events: [illegal(intent.playerId, "Not in draft phase")] };
        if (state.vowsChosen[intent.playerId] === "BLIND_FAITH")
          return { state, events: [illegal(intent.playerId, "Binding Vow: Blind Faith — spells are forbidden")] };
        if (state.draft.spellsRemaining[intent.playerId] <= 0)
          return { state, events: [illegal(intent.playerId, "No spell charges remaining")] };
        const card = state.draft.pool.find(c => c.instanceId === intent.cardInstanceId);
        if (!card || card.identityRevealed || card.shownRarity)
          return { state, events: [illegal(intent.playerId, "Invalid target")] };

        const rarities = ["C", "B", "A", "S", "SS", "SSS", "X"];
        const fakeRarity = rarities[Math.floor(Math.random() * rarities.length)];
        state = {
          ...state,
          draft: {
            ...state.draft,
            spellsRemaining: { ...state.draft.spellsRemaining, [intent.playerId]: state.draft.spellsRemaining[intent.playerId] - 1 },
            pool: updatePoolCard(state.draft.pool, intent.cardInstanceId, { shownRarity: fakeRarity }),
          },
        };
        return { state, events: [{ type: "DRAFT_SKIPPED", by: intent.playerId, skipsLeft: state.draft.spellsRemaining[intent.playerId] }] };
      }

      // ===== DRAFT PICK / SKIP (consume the turn) =====

      case "DRAFT_PICK": {
        if (state.phase !== "DRAFT" || !state.draft)
          return { state, events: [illegal(intent.playerId, "Not in draft phase")] };

        if (state.players[intent.playerId].hand.length >= 6)
          return { state, events: [illegal(intent.playerId, "Already have 6 cards")] };

        const poolCard = state.draft.pool.find(c => c.instanceId === intent.cardInstanceId);
        if (!poolCard)
          return { state, events: [illegal(intent.playerId, "Card not in pool")] };

        const picked = {
          instanceId: `${intent.playerId}-${poolCard.defId}`,
          defId: poolCard.defId,
          owner: intent.playerId,
          visibility: {
            identityRevealed: poolCard.identityRevealed,
            shownRarity: poolCard.shownRarity,
            shownRole: poolCard.shownRole,
          },
        };

        const newPool = state.draft.pool.filter(c => c.instanceId !== intent.cardInstanceId);
        const zones = state.players[intent.playerId];

        state = {
          ...state,
          draft: { ...state.draft, pool: newPool },
          players: {
            ...state.players,
            [intent.playerId]: { ...zones, hand: [...zones.hand, picked] },
          },
        };

        const bothHaveSix = state.players.P1.hand.length >= 6 && state.players.P2.hand.length >= 6;
        if (newPool.length === 0 || bothHaveSix) {
          // Draft done → Reveal phase (leftover pool cards are discarded)
          state = {
            ...state,
            phase: "REVEAL",
            draft: undefined,
            revealPhase: { revealed: [], revealsThisTurn: 0 },
          };
        } else {
          // Switch turn + regen 1 spell for the next player (max 3)
          const next = otherPlayer(intent.playerId);
          const regenSpells = Math.min(3, state.draft.spellsRemaining[next] + 2);
          state = {
            ...state,
            activePlayerId: next,
            turn: state.turn + 1,
            draft: { ...state.draft, spellsRemaining: { ...state.draft.spellsRemaining, [next]: regenSpells } },
          };
        }

        return { state, events: [{ type: "DRAFT_PICKED", by: intent.playerId, defId: picked.defId }] };
      }

      case "DRAFT_SKIP": {
        if (state.phase !== "DRAFT" || !state.draft)
          return { state, events: [illegal(intent.playerId, "Not in draft phase")] };
        if (state.draft.skipsRemaining[intent.playerId] <= 0)
          return { state, events: [illegal(intent.playerId, "No skips remaining")] };

        const newSkips = {
          ...state.draft.skipsRemaining,
          [intent.playerId]: state.draft.skipsRemaining[intent.playerId] - 1,
        };
        const next = otherPlayer(intent.playerId);
        const regenSpells = Math.min(3, state.draft.spellsRemaining[next] + 2);
        state = {
          ...state,
          activePlayerId: next,
          turn: state.turn + 1,
          draft: {
            ...state.draft,
            skipsRemaining: newSkips,
            spellsRemaining: { ...state.draft.spellsRemaining, [next]: regenSpells },
          },
        };
        return { state, events: [{ type: "DRAFT_SKIPPED", by: intent.playerId, skipsLeft: newSkips[intent.playerId] }] };
      }

      // ===== REVEAL PHASE =====

      case "REVEAL_CARD": {
        if (state.phase !== "REVEAL" || !state.revealPhase)
          return { state, events: [illegal(intent.playerId, "Not in reveal phase")] };

        const hand = state.players[intent.playerId].hand;
        const card = hand.find(c => c.instanceId === intent.cardInstanceId);
        if (!card)
          return { state, events: [illegal(intent.playerId, "Card not in hand")] };
        if (state.revealPhase.revealed.includes(intent.cardInstanceId))
          return { state, events: [illegal(intent.playerId, "Card already revealed")] };

        const newRevealed = [...state.revealPhase.revealed, intent.cardInstanceId];
        const totalCards = state.players.P1.hand.length + state.players.P2.hand.length;
        const myHandSize = state.players[intent.playerId].hand.length;
        const myRevealedCount = newRevealed.filter(id =>
          state.players[intent.playerId].hand.some(c => c.instanceId === id)
        ).length;

        if (newRevealed.length >= totalCards) {
          // All cards revealed → Placement
          state = { ...state, phase: "PLACEMENT", revealPhase: undefined };
        } else if (myRevealedCount >= myHandSize) {
          // This player revealed all their cards → switch to other player
          state = {
            ...state,
            activePlayerId: otherPlayer(intent.playerId),
            turn: state.turn + 1,
            revealPhase: { revealed: newRevealed, revealsThisTurn: 0 },
          };
        } else {
          state = { ...state, revealPhase: { ...state.revealPhase, revealed: newRevealed } };
        }

        return { state, events: [{ type: "CARD_REVEALED", by: intent.playerId, cardInstanceId: intent.cardInstanceId, defId: card.defId }] };
      }

      // ===== AUGMENT PHASE (roulette) =====

      case "SPIN_ROULETTE": {
        if (state.phase !== "AUGMENT" || !state.augmentPhase)
          return { state, events: [illegal(intent.playerId, "Not in augment phase")] };
        if (state.augmentPhase.spinsRemaining[intent.playerId] <= 0)
          return { state, events: [illegal(intent.playerId, "No spins remaining")] };
        if (state.augmentPhase.pendingItem !== null)
          return { state, events: [illegal(intent.playerId, "Assign your current item first")] };
        if (!state.augmentPhase.pool[intent.playerId].includes(intent.result))
          return { state, events: [illegal(intent.playerId, "Invalid roulette result")] };

        state = {
          ...state,
          augmentPhase: {
            ...state.augmentPhase,
            pool: {
              ...state.augmentPhase.pool,
              [intent.playerId]: state.augmentPhase.pool[intent.playerId].filter(id => id !== intent.result),
            },
            spinsRemaining: {
              ...state.augmentPhase.spinsRemaining,
              [intent.playerId]: state.augmentPhase.spinsRemaining[intent.playerId] - 1,
            },
            pendingItem: intent.result,
          },
        };
        return { state, events: [] };
      }

      case "ASSIGN_ITEM": {
        if (state.phase !== "AUGMENT" || !state.augmentPhase)
          return { state, events: [illegal(intent.playerId, "Not in augment phase")] };
        if (!state.augmentPhase.pendingItem)
          return { state, events: [illegal(intent.playerId, "No item pending")] };

        const board = state.players[intent.playerId].board;
        const allBoardCards = [board.leader, ...board.combat, ...board.support].filter(Boolean);
        const target = allBoardCards.find(c => c?.instanceId === intent.targetCardInstanceId);
        if (!target)
          return { state, events: [illegal(intent.playerId, "Card not on your board")] };

        // One weapon per card
        const alreadyHasWeapon = state.augmentPhase.equipped[intent.playerId]
          .some(eq => eq.targetCardInstanceId === intent.targetCardInstanceId);
        if (alreadyHasWeapon)
          return { state, events: [illegal(intent.playerId, "That card already has a weapon equipped")] };

        const itemId = state.augmentPhase.pendingItem;
        const enemy = otherPlayer(intent.playerId);
        const bonus = computeItemBonus(itemId, target.defId, state.players[enemy], state.cardDb);

        const zones = state.players[intent.playerId];
        const equippedItem: EquippedItem = { itemId, targetCardInstanceId: intent.targetCardInstanceId, bonus };

        state = {
          ...state,
          augmentPhase: {
            ...state.augmentPhase,
            pendingItem: null,
            equipped: {
              ...state.augmentPhase.equipped,
              [intent.playerId]: [...state.augmentPhase.equipped[intent.playerId], equippedItem],
            },
          },
          players: {
            ...state.players,
            [intent.playerId]: {
              ...zones,
              augments: {
                ...zones.augments,
                [intent.targetCardInstanceId]: (zones.augments[intent.targetCardInstanceId] ?? 0) + bonus,
              },
            },
          },
        };

        const scoreRes = recomputeScores(state);
        state = scoreRes.state;

        // Check if all spins done for both players
        const p1Done = state.augmentPhase!.spinsRemaining.P1 === 0 && state.augmentPhase!.pendingItem === null;
        const p2Done = state.augmentPhase!.spinsRemaining.P2 === 0 && state.augmentPhase!.pendingItem === null;

        if (p1Done && p2Done) {
          state = {
            ...state,
            phase: "LOCKED_IN",
            augmentPhase: undefined,
            activePlayerId: "P1",
            lockedInPhase: { decisions: { P1: null, P2: null } },
          };
        } else {
          // Current player goes first until their spins are exhausted,
          // then hand off to the other player.
          const currentSpinsLeft = state.augmentPhase!.spinsRemaining[intent.playerId];
          if (currentSpinsLeft === 0) {
            const next = otherPlayer(intent.playerId);
            if (state.augmentPhase!.spinsRemaining[next] > 0) {
              state = { ...state, activePlayerId: next };
            }
          }
          // else same player still has spins — stay on them
        }

        return { state, events: [] };
      }

      // ===== PLACEMENT PHASE =====

      case "LOCK_IN": {
        if (state.phase !== "PLACEMENT")
          return { state, events: [illegal(intent.playerId, "Wrong phase")] };

        const nextLocked = { ...state.lockedIn, [intent.playerId]: true };

        if (nextLocked.P1 && nextLocked.P2) {
          state = {
            ...state,
            lockedIn: nextLocked,
            phase: "AUGMENT",
            activePlayerId: "P1",
            augmentPhase: {
              pool: { P1: [...ALL_ROULETTE_IDS], P2: [...ALL_ROULETTE_IDS] },
              spinsRemaining: { P1: 3, P2: 3 },
              pendingItem: null,
              equipped: { P1: [], P2: [] },
            },
          };
          return { state, events: [] };
        }

        const nextPlayer = otherPlayer(state.activePlayerId);
        state = { ...state, lockedIn: nextLocked, activePlayerId: nextPlayer, turn: state.turn + 1 };
        const drawAfterLock = drawOne(state, nextPlayer);
        state = drawAfterLock.state;
        return {
          state,
          events: [{ type: "TURN_ENDED", by: intent.playerId, next: nextPlayer }, ...drawAfterLock.events],
        };
      }

      case "END_TURN": {
        if (state.phase !== "PLACEMENT")
          return { state, events: [illegal(intent.playerId, "Wrong phase")] };
        const next = otherPlayer(state.activePlayerId);
        state = { ...state, activePlayerId: next, turn: state.turn + 1 };
        const drawRes = drawOne(state, next);
        state = drawRes.state;
        return {
          state,
          events: [{ type: "TURN_ENDED", by: intent.playerId, next }, ...drawRes.events],
        };
      }

      case "RETURN_CARD": {
        if (state.phase !== "PLACEMENT")
          return { state, events: [illegal(intent.playerId, "Wrong phase")] };
        const zones = state.players[intent.playerId];
        let returnCard: import("@cg/contracts").CardInstance | null = null;
        switch (intent.target.type) {
          case "LEADER":  returnCard = zones.board.leader; break;
          case "COMBAT":  returnCard = zones.board.combat[intent.target.index]; break;
          case "SUPPORT": returnCard = zones.board.support[intent.target.index]; break;
          case "UNLEASH": returnCard = zones.board.unleashLocked; break;
          default: { const _x: never = intent.target; void _x; }
        }
        if (!returnCard) return { state, events: [illegal(intent.playerId, "Slot is already empty")] };
        const newBoard2 = {
          ...zones.board,
          combat: [...zones.board.combat] as typeof zones.board.combat,
          support: [...zones.board.support] as typeof zones.board.support,
        };
        switch (intent.target.type) {
          case "LEADER":  newBoard2.leader = null; break;
          case "COMBAT":  newBoard2.combat[intent.target.index] = null; break;
          case "SUPPORT": newBoard2.support[intent.target.index] = null; break;
          case "UNLEASH": newBoard2.unleashLocked = null; break;
          default: { const _x: never = intent.target; void _x; }
        }
        state = {
          ...state,
          players: { ...state.players, [intent.playerId]: { ...zones, hand: [...zones.hand, returnCard], board: newBoard2 } },
        };
        const retScore = recomputeScores(state);
        state = retScore.state;
        return { state, events: retScore.events };
      }

      case "PLACE_CARD": {
        if (state.phase !== "PLACEMENT")
          return { state, events: [illegal(intent.playerId, "Wrong phase")] };
        if (intent.target.type === "UNLEASH")
          return { state, events: [illegal(intent.playerId, "Unleash slot is locked until Phase 6")] };

        const card = state.players[intent.playerId].hand.find(c => c.instanceId === intent.cardInstanceId);
        if (!card)
          return { state, events: [illegal(intent.playerId, "Card not in your hand")] };
        if (!isSlotEmpty(state, intent.playerId, intent.target))
          return { state, events: [illegal(intent.playerId, "Slot already occupied")] };

        state = placeIntoSlot(state, intent.playerId, intent.target, intent.cardInstanceId);
        const scoreRes = recomputeScores(state);
        state = scoreRes.state;

        return {
          state,
          events: [
            { type: "CARD_PLACED", by: intent.playerId, cardInstanceId: intent.cardInstanceId, target: intent.target },
            ...scoreRes.events,
          ],
        };
      }

      // ===== LOCKED_IN PHASE (domain activation) =====

      case "ACTIVATE_DOMAIN":
      case "SKIP_DOMAIN": {
        if (state.phase !== "LOCKED_IN" || !state.lockedInPhase)
          return { state, events: [illegal(intent.playerId, "Not in locked-in phase")] };

        const decision = intent.type === "ACTIVATE_DOMAIN" ? "ACTIVATE" : "SKIP";
        const nextDecisions = { ...state.lockedInPhase.decisions, [intent.playerId]: decision };

        if (nextDecisions.P1 !== null && nextDecisions.P2 !== null) {
          // Both decided — resolve domain effects
          const bothActivated = nextDecisions.P1 === "ACTIVATE" && nextDecisions.P2 === "ACTIVATE";
          const clashMul = bothActivated ? 0.6 : 1.0;

          let p1Score = state.players.P1.scorePreview;
          let p2Score = state.players.P2.scorePreview;

          const getDomainEffect = (pid: PlayerId) => {
            const leaderDefId = state.players[pid].board.leader?.defId;
            return leaderDefId ? (DOMAIN_EFFECTS[leaderDefId] ?? DEFAULT_DOMAIN) : DEFAULT_DOMAIN;
          };

          const p1Effect = getDomainEffect("P1");
          const p2Effect = getDomainEffect("P2");

          const domainOutcome: Record<string, DomainOutcomeEntry | null> = { P1: null, P2: null };

          if (nextDecisions.P1 === "ACTIVATE") {
            const pct = Math.round(p1Effect.ownPct * clashMul * 10) / 10;
            p1Score = Math.round(p1Score * (1 + pct / 100));
            const enemyPct = bothActivated ? 0 : p1Effect.enemyPct;
            if (enemyPct < 0) p2Score = Math.round(p2Score * (1 + enemyPct / 100));
            domainOutcome.P1 = { activated: true, name: p1Effect.name, pct, enemyPct, clashed: bothActivated };
          } else {
            domainOutcome.P1 = { activated: false, name: p1Effect.name, pct: 0, enemyPct: 0, clashed: false };
          }

          if (nextDecisions.P2 === "ACTIVATE") {
            const pct = Math.round(p2Effect.ownPct * clashMul * 10) / 10;
            p2Score = Math.round(p2Score * (1 + pct / 100));
            const enemyPct = bothActivated ? 0 : p2Effect.enemyPct;
            if (enemyPct < 0) p1Score = Math.round(p1Score * (1 + enemyPct / 100));
            domainOutcome.P2 = { activated: true, name: p2Effect.name, pct, enemyPct, clashed: bothActivated };
          } else {
            domainOutcome.P2 = { activated: false, name: p2Effect.name, pct: 0, enemyPct: 0, clashed: false };
          }

          // Apply vow outcomes on top of domain-modified scores
          const stateWithDomainScores = {
            ...state,
            players: {
              P1: { ...state.players.P1, scorePreview: p1Score },
              P2: { ...state.players.P2, scorePreview: p2Score },
            },
          };
          const p1VowRes = applyVowToScore(stateWithDomainScores, "P1", p1Score);
          const p2VowRes = applyVowToScore(stateWithDomainScores, "P2", p2Score);

          state = {
            ...stateWithDomainScores,
            phase: "RESOLUTION",
            lockedInPhase: undefined,
            domainOutcome,
            vowOutcome: { P1: p1VowRes.outcome, P2: p2VowRes.outcome },
            players: {
              P1: { ...stateWithDomainScores.players.P1, scorePreview: p1VowRes.score },
              P2: { ...stateWithDomainScores.players.P2, scorePreview: p2VowRes.score },
            },
          };
        } else {
          // First player decided — switch to other
          state = {
            ...state,
            activePlayerId: otherPlayer(intent.playerId),
            lockedInPhase: { decisions: nextDecisions },
          };
        }
        return { state, events: [] };
      }

      case "DEBUG_REFILL_SPELLS": {
        if (state.phase !== "DRAFT" || !state.draft) return { state, events: [] };
        state = {
          ...state,
          draft: {
            ...state.draft,
            spellsRemaining: { ...state.draft.spellsRemaining, [intent.playerId]: 99 },
            cardRevealUsed:  { ...state.draft.cardRevealUsed,  [intent.playerId]: 0 },
          },
        };
        return { state, events: [] };
      }

      default:
        return { state, events: [illegal(state.activePlayerId, "Unknown intent")] };
    }
  };

  return { getState: () => state, applyIntent };
};
