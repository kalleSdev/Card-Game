import {
  GameEvent,
  GameState,
  Intent,
  PlayerId,
  SlotRef,
  otherPlayer,
} from "@cg/contracts";

export type ApplyResult = {
  state: GameState;
  events: GameEvent[];
};

export type Engine = {
  getState(): GameState;
  applyIntent(intent: Intent): ApplyResult;
};

const illegal = (by: PlayerId, reason: string): GameEvent => ({
  type: "ILLEGAL_INTENT",
  by,
  reason,
});

const SLOT_MULTIPLIER: Record<"LEADER" | "COMBAT" | "SUPPORT", number> = {
  LEADER: 1.5,
  COMBAT: 1.0,
  SUPPORT: 0.8,
};

const OFF_ROLE_MULTIPLIER = 0.7;

const slotToAffinity = (slotType: "LEADER" | "COMBAT" | "SUPPORT"): "LEADER" | "COMBAT" | "SUPPORT" =>
  slotType;

const calcCardContribution = (state: GameState, card: { defId: string }, slotType: "LEADER" | "COMBAT" | "SUPPORT") => {
  const def = state.cardDb[card.defId];
  if (!def) return 0;

  const slotMul = SLOT_MULTIPLIER[slotType];
  const offRoleMul = def.affinity === slotToAffinity(slotType) ? 1.0 : OFF_ROLE_MULTIPLIER;

  return def.basePoints * slotMul * offRoleMul;
};

const calcPlayerScorePreview = (state: GameState, p: PlayerId): number => {
  const b = state.players[p].board;

  let total = 0;

  if (b.leader) total += calcCardContribution(state, b.leader, "LEADER");

  for (const c of b.combat) {
    if (c) total += calcCardContribution(state, c, "COMBAT");
  }

  for (const s of b.support) {
    if (s) total += calcCardContribution(state, s, "SUPPORT");
  }

  // Unleash is locked and excluded for now
  return Math.round(total * 100) / 100; // keep it readable
};


const listBoardCards = (state: GameState, p: PlayerId) => {
  const b = state.players[p].board;
  const cards = [
    b.leader,
    ...b.combat,
    ...b.support,
    // unleash excluded for now
  ].filter(Boolean) as Array<{ defId: string }>;
  return cards;
};

const countTagOnBoard = (state: GameState, p: PlayerId, tag: string): number => {
  const cards = listBoardCards(state, p);
  let count = 0;
  for (const c of cards) {
    const def = state.cardDb[c.defId];
    if (def?.tags?.includes(tag)) count++;
  }
  return count;
};

const calcSynergies = (state: GameState, p: PlayerId): Array<"TAG_FIRE_2"> => {
  const fireCount = countTagOnBoard(state, p, "fire");
  const synergies: Array<"TAG_FIRE_2"> = [];
  if (fireCount >= 2) synergies.push("TAG_FIRE_2");
  return synergies;
};

const applySynergyMultiplier = (baseScore: number, synergies: string[]): number => {
  let score = baseScore;
  // +10% total if fire synergy is active
  if (synergies.includes("TAG_FIRE_2")) score *= 1.1;
  return score;
};


const recomputeScores = (state: GameState): { state: GameState; events: GameEvent[] } => {
  const events: GameEvent[] = [];

  const p1Synergies = calcSynergies(state, "P1");
  const p2Synergies = calcSynergies(state, "P2");

  const p1Base = calcPlayerScorePreview(state, "P1");
  const p2Base = calcPlayerScorePreview(state, "P2");

  const p1Final = Math.round(applySynergyMultiplier(p1Base, p1Synergies) * 100) / 100;
  const p2Final = Math.round(applySynergyMultiplier(p2Base, p2Synergies) * 100) / 100;

  const prevP1 = state.players.P1.activeSynergies.join(",");
  const prevP2 = state.players.P2.activeSynergies.join(",");

  const nextP1 = p1Synergies.join(",");
  const nextP2 = p2Synergies.join(",");

  if (prevP1 !== nextP1) events.push({ type: "SYNERGY_CHANGED", by: "P1", synergies: p1Synergies });
  if (prevP2 !== nextP2) events.push({ type: "SYNERGY_CHANGED", by: "P2", synergies: p2Synergies });

  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      P1: { ...state.players.P1, scorePreview: p1Final, activeSynergies: p1Synergies },
      P2: { ...state.players.P2, scorePreview: p2Final, activeSynergies: p2Synergies },
    },
  };

  return { state: nextState, events };
};


const isSlotEmpty = (state: GameState, p: PlayerId, target: SlotRef): boolean => {
  const board = state.players[p].board;
  switch (target.type) {
    case "LEADER":
      return board.leader === null;
    case "COMBAT":
      return board.combat[target.index] === null;
    case "SUPPORT":
      return board.support[target.index] === null;
    case "UNLEASH":
      return board.unleashLocked === null;
    default: {
      const _x: never = target;
      return _x;
    }
  }
};

const drawOne = (state: GameState, p: PlayerId): { state: GameState; events: GameEvent[] } => {
  const zones = state.players[p];
  if (zones.deck.length === 0) return { state, events: [] };

  const [top, ...rest] = zones.deck;

  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [p]: {
        ...zones,
        deck: rest,
        hand: [...zones.hand, top],
      },
    },
  };

  return {
    state: nextState,
    events: [{ type: "CARD_DRAWN", by: p, cardInstanceId: top.instanceId }],
  };
};


const placeIntoSlot = (state: GameState, p: PlayerId, target: SlotRef, cardInstanceId: string): GameState => {
  const zones = state.players[p];

  const handIndex = zones.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (handIndex === -1) return state;

  const card = zones.hand[handIndex];

  const newHand = zones.hand.slice();
  newHand.splice(handIndex, 1);

  const newBoard = {
    ...zones.board,
    combat: [...zones.board.combat] as [typeof zones.board.combat[0], typeof zones.board.combat[1]],
    support: [...zones.board.support] as [typeof zones.board.support[0], typeof zones.board.support[1], typeof zones.board.support[2]],
  };

  switch (target.type) {
    case "LEADER":
      newBoard.leader = card;
      break;
    case "COMBAT":
      newBoard.combat[target.index] = card;
      break;
    case "SUPPORT":
      newBoard.support[target.index] = card;
      break;
    case "UNLEASH":
      newBoard.unleashLocked = card;
      break;
    default: {
      const _x: never = target;
      return _x;
    }
  }

  return {
    ...state,
    players: {
      ...state.players,
      [p]: {
        ...zones,
        hand: newHand,
        board: newBoard,
      },
    },
  };
};

// Initial state factory (one simple card each)
export const createInitialState = (): GameState => {
  const cardDb = {
    "c-001": {
      id: "c-001",
      name: "Ember Squire",
      rarity: "C",
      basePoints: 10,
      affinity: "COMBAT",
      tags: ["fire", "melee"],
    },
  } satisfies GameState["cardDb"];

  // 1) Build the base state
  let s: GameState = {
    version: 1,
    phase: "HOTSEAT_TURN",
    turn: 1,
    activePlayerId: "P1",
    cardDb,
    players: {
      P1: {
        deck: [
          { instanceId: "P1-1", defId: "c-001", owner: "P1" },
          { instanceId: "P1-2", defId: "c-001", owner: "P1" },
          { instanceId: "P1-3", defId: "c-001", owner: "P1" },
        ],
        scorePreview: 0,
        activeSynergies: [],
        hand: [],
        board: {
          leader: null,
          combat: [null, null],
          support: [null, null, null],
          unleashLocked: null,
        },
      },
      P2: {
        deck: [
          { instanceId: "P2-1", defId: "c-001", owner: "P2" },
          { instanceId: "P2-2", defId: "c-001", owner: "P2" },
          { instanceId: "P2-3", defId: "c-001", owner: "P2" },
        ],
        scorePreview: 0,
        activeSynergies: [],
        hand: [],
        board: {
          leader: null,
          combat: [null, null],
          support: [null, null, null],
          unleashLocked: null,
        },
      },
    },
  };

  // 2) Draw 1 for P1 so the game starts playable immediately
  s = drawOne(s, "P1").state;

  // 3) Compute initial score + synergies (ignore events at boot)
  s = recomputeScores(s).state;

  return s;

};


export const createEngine = (initialState: GameState = createInitialState()): Engine => {
  let state = initialState;

  const getState = () => state;

  const applyIntent = (intent: Intent): ApplyResult => {
    // Hotseat rule: only active player can act
    if (intent.playerId !== state.activePlayerId) {
      return { state, events: [illegal(intent.playerId, "Not your turn")] };
    }

    // Phase gate (only one phase exists right now)
    if (state.phase !== "HOTSEAT_TURN") {
      return { state, events: [illegal(intent.playerId, "Wrong phase")] };
    }

    switch (intent.type) {
      case "END_TURN": {
        const next = otherPlayer(state.activePlayerId);

        const baseEvents: GameEvent[] = [
          { type: "TURN_ENDED", by: state.activePlayerId, next },
        ];

        // switch active player + increment turn
        state = { ...state, activePlayerId: next, turn: state.turn + 1 };

        // auto-draw for the new active player
        const drawRes = drawOne(state, next);
        state = drawRes.state;

        // scores/synergies can change only when board changes, so we do NOT recompute here
        // (drawing doesn't affect board score)
        return { state, events: [...baseEvents, ...drawRes.events] };
      }

      case "PLACE_CARD": {
        // For now, UNLEASH is locked (can exist in state, but illegal to place)
        if (intent.target.type === "UNLEASH") {
          return { state, events: [illegal(intent.playerId, "Unleash slot is locked")] };
        }

        const zones = state.players[intent.playerId];
        const card = zones.hand.find((c) => c.instanceId === intent.cardInstanceId);
        if (!card) return { state, events: [illegal(intent.playerId, "Card not in your hand")] };

        if (!isSlotEmpty(state, intent.playerId, intent.target)) {
          return { state, events: [illegal(intent.playerId, "Target slot is already occupied")] };
        }

        // apply placement
        state = placeIntoSlot(state, intent.playerId, intent.target, intent.cardInstanceId);

        // recompute score + synergies, and capture any SYNERGY_CHANGED events
        const scoreRes = recomputeScores(state);
        state = scoreRes.state;

        const events: GameEvent[] = [
          {
            type: "CARD_PLACED",
            by: intent.playerId,
            cardInstanceId: intent.cardInstanceId,
            target: intent.target,
          },
          ...scoreRes.events,
        ];

        return { state, events };
      }

      default: {
        // if you removed the exhaustive check, it's fine:
        return { state, events: [illegal(state.activePlayerId, "Unknown intent")] };
      }
    }
  };

  return { getState, applyIntent };
};

