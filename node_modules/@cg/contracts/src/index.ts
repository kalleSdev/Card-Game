// ===== IDs =====
export type PlayerId = "P1" | "P2";
export type CardId = string;

export type Phase = "HOTSEAT_TURN";

export type SynergyId = "TAG_FIRE_2";

// ===== Slots =====
export type SlotType = "LEADER" | "COMBAT" | "SUPPORT" | "UNLEASH";

export type SlotRef =
  | { type: "LEADER"; index: 0 }
  | { type: "COMBAT"; index: 0 | 1 }
  | { type: "SUPPORT"; index: 0 | 1 | 2 }
  | { type: "UNLEASH"; index: 0 };

// ===== Card role affinity =====
export type RoleAffinity = "LEADER" | "COMBAT" | "SUPPORT";

// ===== Card definition (DB-backed later) =====
export type CardDef = {
  id: CardId;
  name: string;
  rarity: "C" | "B" | "A" | "S" | "SS" | "SSS";
  basePoints: number;
  affinity: RoleAffinity; // primary role
  tags: string[]; // attributes
};

// ===== Card instance in a match =====
export type CardInstance = {
  instanceId: string; // unique per match
  defId: CardId;
  owner: PlayerId;
};

// ===== Player zones =====
export type PlayerZones = {
  deck: CardInstance[];
  hand: CardInstance[];
  scorePreview: number;
  activeSynergies: SynergyId[];
  board: {
    leader: CardInstance | null;
    combat: [CardInstance | null, CardInstance | null];
    support: [CardInstance | null, CardInstance | null, CardInstance | null];
    unleashLocked: CardInstance | null;
  };
};


// ===== Game state =====
export type GameState = {
  version: 1;
  phase: Phase;
  turn: number;
  activePlayerId: PlayerId;
  cardDb: Record<CardId, CardDef>;
  players: Record<PlayerId, PlayerZones>;
};

// ===== Intents =====
export type Intent =
  | { type: "END_TURN"; playerId: PlayerId }
  | {
      type: "PLACE_CARD";
      playerId: PlayerId;
      cardInstanceId: string;
      target: SlotRef;
    };

// ===== Events =====
export type GameEvent =
  | { type: "SYNERGY_CHANGED"; by: PlayerId; synergies: SynergyId[] }
  | { type: "CARD_DRAWN"; by: PlayerId; cardInstanceId: string }
  | { type: "TURN_ENDED"; by: PlayerId; next: PlayerId }
  | {
      type: "CARD_PLACED";
      by: PlayerId;
      cardInstanceId: string;
      target: SlotRef;
    }
  | {
      type: "ILLEGAL_INTENT";
      by: PlayerId;
      reason: string;
    };

// ===== Utilities =====
export const otherPlayer = (p: PlayerId): PlayerId => (p === "P1" ? "P2" : "P1");

export const slotKey = (s: SlotRef): string => `${s.type}:${s.index}`;
