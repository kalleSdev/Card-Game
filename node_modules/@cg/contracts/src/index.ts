// ===== IDs =====
export type PlayerId = "P1" | "P2";
export type CardId = string;

// ===== Phases (0–7) =====
export type Phase =
  | "BINDING_VOW"  // Phase 0 – pick oaths
  | "DRAFT"        // Phase 1 – pick face-down cards
  | "REVEAL"       // Phase 2 – reveal 2 at a time
  | "PLACEMENT"    // Phase 3 – hidden board building
  | "AUGMENT"      // Phase 4 – action cards & augments
  | "LOCK_IN"      // Phase 5 – finalize board
  | "LOCKED_IN"    // Phase 6 – boards revealed, deploy Unleash
  | "RESOLUTION";  // Phase 7 – score, cutscene, winner

// ===== Binding Vows =====
export type BindingVowId =
  | "LEADERS_GAMBIT"           // Leader SS/SSS → +6% / -6%
  | "BROTHERHOOD_PACT"         // Brotherhood synergy → +8% / -6%
  | "BLIND_FAITH"              // No spells → +14% (enforced)
  | "HEAVENLY_RESTRICTION_VOW" // Maki + Toji on board → +10% / -4%
  | "KING_OF_CURSES_VOW";      // +2% per curse, -1% per non-curse

// ===== Synergies =====
export type SynergyId =
  | "ATTR_HEAVENLY_2"      // 2+ heavenly restriction → +5%
  | "ATTR_ZENIN_2"         // 2+ zenin clan → +4%
  | "ATTR_JUJUTSU_3"       // 3+ jujutsu high → +8%
  | "REL_BROTHERHOOD"      // Yuji + (Todo or Choso) → +1500 flat
  | "REL_MEMORY_RES"       // Gojo + Geto → +5%
  | "REL_GOJO_2STUDENTS"   // Gojo + 2 students → +5%
  | "REL_GOJO_3STUDENTS"   // Gojo + 3 students → +10%
  | "DISASTER_CURSE_2"     // 2 of Mahito/Jogo/Hanami/Dagon → +4%
  | "DISASTER_CURSE_3"     // 3 of them → +6%
  | "DISASTER_CURSE_4";    // all 4 → +8%

// ===== Slots =====
export type SlotType = "LEADER" | "COMBAT" | "SUPPORT" | "UNLEASH";

export type SlotRef =
  | { type: "LEADER"; index: 0 }
  | { type: "COMBAT"; index: 0 | 1 }
  | { type: "SUPPORT"; index: 0 | 1 | 2 }
  | { type: "UNLEASH"; index: 0 };

// ===== Role affinity =====
export type RoleAffinity = "LEADER" | "COMBAT" | "SUPPORT";

// ===== Perk tiers (for weapon-type augments) =====
export type WeaponPerkTier = "base" | "plus" | "double";

// ===== Per-card off-role penalties =====
// Multipliers: 0.8 = -20%, 0.7 = -30%, 1.0 = no penalty
export type OffRolePenalties = {
  leader?: number;
  combat?: number;
  support?: number;
};

// ===== Card definition =====
export type CardDef = {
  id: CardId;
  name: string;
  rarity: "C" | "B" | "A" | "S" | "SS" | "SSS";
  basePoints: number;
  affinity: RoleAffinity;
  tags: string[];
  offRolePenalties?: OffRolePenalties;
  perks?: {
    weaponEfficiency?: WeaponPerkTier;
  };
};

// ===== Draft visibility — what was revealed about a card during draft =====
export type CardVisibility = {
  identityRevealed: boolean; // Card Reveal spell was used
  shownRarity?: string;      // rate shown (real via Global Rate, or random via Fake Reveal)
};

// ===== Card instance in a match =====
export type CardInstance = {
  instanceId: string;
  defId: CardId;
  owner: PlayerId;
  visibility?: CardVisibility; // inherited from draft pool reveal state
};

// ===== Augments (Roulette system) =====
export type EquippedItem = {
  itemId: string;
  targetCardInstanceId: string;
  bonus: number; // computed at assignment, includes conditional bonuses
};

export type AugmentPhaseState = {
  pool: Record<PlayerId, string[]>;           // remaining item IDs for each player
  spinsRemaining: Record<PlayerId, number>;   // 2 each
  pendingItem: string | null;                 // item won, waiting to be assigned
  equipped: Record<PlayerId, EquippedItem[]>; // items assigned to board cards
};

// ===== Player zones =====
export type PlayerZones = {
  deck: CardInstance[];
  hand: CardInstance[];
  scorePreview: number;
  activeSynergies: SynergyId[];
  augments: Record<string, number>; // cardInstanceId → flat bonus points
  board: {
    leader: CardInstance | null;
    combat: [CardInstance | null, CardInstance | null];
    support: [CardInstance | null, CardInstance | null, CardInstance | null];
    unleashLocked: CardInstance | null;
  };
};

// ===== Draft pool card (face-down with optional reveals) =====
export type DraftPoolCard = {
  instanceId: string;
  defId: string;
  identityRevealed: boolean;  // Card Reveal: both see full card
  shownRarity?: string;       // rate shown to both — may be real (Global Rate) or random (Fake Reveal)
};

// ===== Draft state (only present during DRAFT phase) =====
export type DraftState = {
  coinFlipped: boolean;
  pool: DraftPoolCard[];
  skipsRemaining: Record<PlayerId, number>;
  spellsRemaining: Record<PlayerId, number>;      // 3 charges each
  cardRevealUsed: Record<PlayerId, boolean>;       // Card Reveal: once per player only
};

// ===== Reveal state (only present during REVEAL phase) =====
export type RevealState = {
  revealed: string[];       // instanceIds revealed so far (both players combined)
  revealsThisTurn: number;  // 0 or 1 — resets to 0 after 2nd reveal (turn switches)
};

// ===== Game state =====
export type GameState = {
  version: 1;
  phase: Phase;
  turn: number;
  activePlayerId: PlayerId;
  lockedIn: Record<PlayerId, boolean>;
  vowsChosen: Record<PlayerId, BindingVowId | null>;
  vowsReady: Record<PlayerId, boolean>;
  vowOutcome?: Record<PlayerId, { met: boolean; pct: number } | null>;
  draft?: DraftState;
  revealPhase?: RevealState;
  augmentPhase?: AugmentPhaseState;
  cardDb: Record<CardId, CardDef>;
  players: Record<PlayerId, PlayerZones>;
};

// ===== Intents =====
export type Intent =
  | { type: "END_TURN"; playerId: PlayerId }
  | { type: "LOCK_IN"; playerId: PlayerId }
  | { type: "CHOOSE_VOW"; playerId: PlayerId; vowId: BindingVowId | null }
  | { type: "FLIP_COIN"; firstPicker: PlayerId }
  | { type: "SPIN_ROULETTE"; playerId: PlayerId; result: string }
  | { type: "ASSIGN_ITEM"; playerId: PlayerId; targetCardInstanceId: string }
  | { type: "REVEAL_CARD"; playerId: PlayerId; cardInstanceId: string }
  | { type: "DRAFT_PICK"; playerId: PlayerId; cardInstanceId: string }
  | { type: "DRAFT_SKIP"; playerId: PlayerId }
  | { type: "SPELL_CARD_REVEAL"; playerId: PlayerId; cardInstanceId: string }
  | { type: "SPELL_GLOBAL_RATE"; playerId: PlayerId; cardInstanceId: string }
  | { type: "SPELL_FAKE_REVEAL"; playerId: PlayerId; cardInstanceId: string }
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
  | { type: "CARD_PLACED"; by: PlayerId; cardInstanceId: string; target: SlotRef }
  | { type: "DRAFT_PICKED"; by: PlayerId; defId: string }
  | { type: "DRAFT_SKIPPED"; by: PlayerId; skipsLeft: number }
  | { type: "CARD_REVEALED"; by: PlayerId; cardInstanceId: string; defId: string }
  | { type: "ILLEGAL_INTENT"; by: PlayerId; reason: string };

// ===== Utilities =====
export const otherPlayer = (p: PlayerId): PlayerId => (p === "P1" ? "P2" : "P1");
export const slotKey = (s: SlotRef): string => `${s.type}:${s.index}`;
