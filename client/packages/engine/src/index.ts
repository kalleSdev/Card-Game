import {
  BindingVowId,
  CardDef,
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
    description: "Your leader must be SS or SSS rarity at resolution.",
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
    description: "+2.5% for each Curse on your team, −1% for each non-Curse.",
    reward: "+2.5% per Curse card",
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
  "split-soul-katana":{ id: "split-soul-katana", name: "Split Soul Katana",         baseBonus: 1500 },
  "inverted-spear":   { id: "inverted-spear",    name: "Inverted Spear of Heaven",  baseBonus: 500,  conditionalDesc: "+3000 if enemy has Gojo" },
  "jet-black-blade":  { id: "jet-black-blade",   name: "Jet Black Blade",           baseBonus: 1000 },
  "higuruma-gavel":   { id: "higuruma-gavel",    name: "Higuruma's Gavel",          baseBonus: 500 },
  "festering-life":   { id: "festering-life",    name: "Festering Life Sword",      baseBonus: 1000 },
  "dragon-bone":      { id: "dragon-bone",        name: "Dragon Bone",               baseBonus: 1500 },
  "mei-battle-axe":   { id: "mei-battle-axe",    name: "Mei's Battle Axe",          baseBonus: 500 },
  "slaughter-demon":  { id: "slaughter-demon",   name: "Slaughter Demon",           baseBonus: 500 },
  "nobara-hammer":    { id: "nobara-hammer",      name: "Nobara's Hammer",           baseBonus: 500 },
  "electric-guitar":  { id: "electric-guitar",   name: "Electric Guitar",           baseBonus: 500,  conditionalDesc: "+1500 if on Gakuganji" },
  "black-rope":       { id: "black-rope",         name: "Black Rope",                baseBonus: 1000, conditionalDesc: "+2000 if on Miguel" },
};

const ALL_ROULETTE_IDS = Object.keys(ROULETTE_ITEM_MAP);

const computeItemBonus = (
  itemId: string,
  targetDefId: string,
  enemyZones: PlayerZones,
): number => {
  const def = ROULETTE_ITEM_MAP[itemId];
  if (!def) return 0;
  let bonus = def.baseBonus;
  const enemyBoard = [enemyZones.board.leader, ...enemyZones.board.combat, ...enemyZones.board.support].filter(Boolean);
  if (itemId === "inverted-spear" && enemyBoard.some(c => c?.defId === "gojo-base")) bonus += 3000;
  if (itemId === "electric-guitar" && targetDefId === "gakuganji") bonus += 1500;
  if (itemId === "black-rope"      && targetDefId === "miguel")     bonus += 2000;
  return bonus;
};

// ===== Card database =====
const CARD_DB: GameState["cardDb"] = {
  "gojo-base": {
    id: "gojo-base",
    name: "Gojo Satoru",
    rarity: "SSS",
    basePoints: 13000,
    affinity: "LEADER",
    tags: ["sorcerer", "jujutsu-high", "gojo-clan", "six-eyes"],
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
    basePoints: 11000,
    affinity: "COMBAT",
    tags: ["heavenly-restriction", "zenin-clan", "assassin"],
    offRolePenalties: { leader: 0.85, support: 0.6 },
    perks: { weaponEfficiency: "double" },
  },
  "maki": {
    id: "maki",
    name: "Maki Zenin",
    rarity: "A",
    basePoints: 10000,
    affinity: "COMBAT",
    tags: ["heavenly-restriction", "zenin-clan", "sorcerer"],
    offRolePenalties: { leader: 0.8, support: 0.8 },
    perks: { weaponEfficiency: "plus" },
  },
  "todo": {
    id: "todo",
    name: "Todo Aoi",
    rarity: "A",
    basePoints: 9500,
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
    tags: ["sorcerer", "jujutsu-high", "ratio"],
    offRolePenalties: { leader: 0.8, combat: 0.85 },
  },
  "geto": {
    id: "geto",
    name: "Geto Suguru",
    rarity: "S",
    basePoints: 10500,
    affinity: "SUPPORT",
    tags: ["sorcerer", "curse-spirit"],
    offRolePenalties: { leader: 0.8, combat: 0.75 },
  },
  "sukuna": {
    id: "sukuna",
    name: "Ryomen Sukuna",
    rarity: "SSS",
    basePoints: 13000,
    affinity: "LEADER",
    tags: ["curse", "king-of-curses", "malevolent-shrine"],
    offRolePenalties: { combat: 0.85, support: 0.7 },
  },
  "choso": {
    id: "choso",
    name: "Choso",
    rarity: "A",
    basePoints: 8500,
    affinity: "COMBAT",
    tags: ["curse", "kenjaku", "blood-manipulation", "brother"],
    offRolePenalties: { leader: 0.75, support: 0.9 },
  },
  "yuta": {
    id: "yuta",
    name: "Yuta Okkotsu",
    rarity: "SS",
    basePoints: 11500,
    affinity: "LEADER",
    tags: ["sorcerer", "jujutsu-high", "six-eyes", "rika"],
    offRolePenalties: { combat: 0.85, support: 0.7 },
  },
  "gakuganji": {
    id: "gakuganji",
    name: "Gakuganji",
    rarity: "B",
    basePoints: 7000,
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
    basePoints: 10500,
    affinity: "COMBAT",
    tags: ["curse", "idle-transfiguration", "disaster-curse"],
    offRolePenalties: { leader: 0.8, support: 0.75 },
  },
  "jogo": {
    id: "jogo",
    name: "Jogo",
    rarity: "S",
    basePoints: 10500,
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

  if (countTagOnBoard(state, p, "heavenly-restriction") >= 2) syn.push("ATTR_HEAVENLY_2");
  if (countTagOnBoard(state, p, "zenin-clan") >= 2)           syn.push("ATTR_ZENIN_2");
  if (countTagOnBoard(state, p, "jujutsu-high") >= 3)         syn.push("ATTR_JUJUTSU_3");

  // Brotherhood: Yuji + (Todo or Choso)
  const hasYuji = hasOnBoard(state, p, "yuji");
  if (hasYuji && (hasOnBoard(state, p, "todo") || hasOnBoard(state, p, "choso")))
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
  if (synergies.includes("ATTR_ZENIN_2"))       score *= 1.04;
  if (synergies.includes("ATTR_JUJUTSU_3"))     score *= 1.08;
  if (synergies.includes("REL_MEMORY_RES"))     score *= 1.05;
  if (synergies.includes("REL_BROTHERHOOD"))    score += 1500;
  if (synergies.includes("REL_GOJO_3STUDENTS"))      score *= 1.10;
  else if (synergies.includes("REL_GOJO_2STUDENTS")) score *= 1.05;
  if (synergies.includes("DISASTER_CURSE_4"))        score *= 1.08;
  else if (synergies.includes("DISASTER_CURSE_3"))   score *= 1.06;
  else if (synergies.includes("DISASTER_CURSE_2"))   score *= 1.04;
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
      const met = leaderDef?.rarity === "SS" || leaderDef?.rarity === "SSS";
      const pct = met ? 6 : -6;
      return { score: r(base * (1 + pct / 100)), outcome: { met, pct } };
    }
    case "BROTHERHOOD_PACT": {
      const met = synergies.includes("REL_BROTHERHOOD");
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
      const pct = Math.round((curses * 2.5 - nonCurses * 1) * 10) / 10;
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
      skipsRemaining: { P1: 2, P2: 2 },
      spellsRemaining: { P1: 3, P2: 3 },
      cardRevealUsed: { P1: false, P2: false },
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
        if (state.draft.cardRevealUsed[intent.playerId])
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
            cardRevealUsed: { ...state.draft.cardRevealUsed, [intent.playerId]: true },
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
        state = {
          ...state,
          draft: {
            ...state.draft,
            spellsRemaining: { ...state.draft.spellsRemaining, [intent.playerId]: state.draft.spellsRemaining[intent.playerId] - 1 },
            pool: updatePoolCard(state.draft.pool, intent.cardInstanceId, { shownRarity: realRarity }),
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

        const rarities = ["C", "B", "A", "S", "SS", "SSS"];
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
          const regenSpells = Math.min(3, state.draft.spellsRemaining[next] + 1);
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
        const regenSpells = Math.min(3, state.draft.spellsRemaining[next] + 1);
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
        const newRevealsThisTurn = state.revealPhase.revealsThisTurn + 1;
        const totalCards = state.players.P1.hand.length + state.players.P2.hand.length;

        if (newRevealed.length >= totalCards) {
          // All cards revealed → Placement
          state = { ...state, phase: "PLACEMENT", revealPhase: undefined };
        } else if (newRevealsThisTurn >= 3) {
          // This player's 3-card reveal done → switch
          state = {
            ...state,
            activePlayerId: otherPlayer(intent.playerId),
            turn: state.turn + 1,
            revealPhase: { revealed: newRevealed, revealsThisTurn: 0 },
          };
        } else {
          state = { ...state, revealPhase: { revealed: newRevealed, revealsThisTurn: newRevealsThisTurn } };
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

        const itemId = state.augmentPhase.pendingItem;
        const enemy = otherPlayer(intent.playerId);
        const bonus = computeItemBonus(itemId, target.defId, state.players[enemy]);

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
          const p1Res = applyVowToScore(state, "P1", state.players.P1.scorePreview);
          const p2Res = applyVowToScore(state, "P2", state.players.P2.scorePreview);
          state = {
            ...state,
            phase: "RESOLUTION",
            augmentPhase: undefined,
            vowOutcome: { P1: p1Res.outcome, P2: p2Res.outcome },
            players: {
              P1: { ...state.players.P1, scorePreview: p1Res.score },
              P2: { ...state.players.P2, scorePreview: p2Res.score },
            },
          };
        } else {
          // Switch to other player if they still have spins; otherwise keep current
          const next = otherPlayer(intent.playerId);
          if (state.augmentPhase!.spinsRemaining[next] > 0) {
            state = { ...state, activePlayerId: next };
          }
          // else same player still has spins
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
              spinsRemaining: { P1: 2, P2: 2 },
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

      default:
        return { state, events: [illegal(state.activePlayerId, "Unknown intent")] };
    }
  };

  return { getState: () => state, applyIntent };
};
