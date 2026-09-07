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
  | "REL_BROTHERHOOD"      // Yuji + (Todo or Choso) → +5%
  | "REL_BROTHERHOOD_3"    // Yuji + Todo + Choso (all 3) → +8%
  | "REL_MEMORY_RES"       // Gojo + Geto → +5%
  | "REL_GOJO_2STUDENTS"   // Gojo + 2 students → +5%
  | "REL_GOJO_3STUDENTS"   // Gojo + 3 students → +10%
  | "DISASTER_CURSE_2"     // 2 of Mahito/Jogo/Hanami/Dagon → +4%
  | "DISASTER_CURSE_3"     // 3 of them → +6%
  | "DISASTER_CURSE_4"     // all 4 → +8%
  | "TOKYO_TRIO_2"         // Inumaki + Panda + Maki: 2 of 3 → +4%
  | "TOKYO_TRIO_3"         // all 3 → +6%
  | "THE_STRONGEST_2"      // 2 of [Gojo/Sukuna/Mahoraga/Dabura] → +6%
  | "THE_STRONGEST_3"      // 3 of above → +10%
  | "THE_STRONGEST_4"      // 4 of above → +12%
  | "THE_STRONGEST_5"      // 5 of above → ×9 (instant win)
  | "LUCKY_STAR"           // Hakari + Kirara → +5%
  | "TRIPLE_DOMAIN_CLASH"  // Uro + Ryu + Yuta (all 3) → +7%
  | "ZENIN_ELDERS"         // Naoya + Jinichi → +4%
  | "UNPREDICTABLE_DUO"    // Takaba + Hakari → +5%
  | "SIX_EYES"             // Gojo + Yuta (both six-eyes users) → +6%
  | "CULLING_GAME_2"       // 2 culling-game characters → +3%
  | "CULLING_GAME_3"       // 3+ culling-game characters → +5%
  | "CULLING_GAME_4"       // 4 culling-game characters → +7%
  | "AFROBEAT"             // Yuta + Miguel → +5%
  | "KYOTO_2"              // 2 Kyoto sorcerers (Todo/Miwa/Mechamaru) → +3%
  | "KYOTO_3"              // 3 Kyoto sorcerers → +5%
  | "YUTA_MAKI"            // Yuta + Maki → +5%
  | "HEAVEN_AND_HELL"      // Gojo + Toji → +4%
  | "CURSE_LEADER_1"       // Geto + 1 of (Mahito/Dagon/Jogo) → +3%
  | "CURSE_LEADER_2"       // Geto + 2 of them → +4.5%
  | "CURSE_LEADER_3";      // Geto + all 3 → +6%

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
  rarity: "C" | "B" | "A" | "S" | "SS" | "SSS" | "X";
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
  shownRole?: string;        // affinity shown alongside real RATE spell
};

// ===== Card instance in a match =====
export type CardInstance = {
  instanceId: string;
  defId: CardId;
  owner: PlayerId;
  visibility?: CardVisibility; // inherited from draft pool reveal state
};

// ===== LOCKED_IN phase =====
export type LockedInPhaseState = {
  decisions: Record<PlayerId, "ACTIVATE" | "SKIP" | null>;
};

export type DomainOutcomeEntry = {
  activated: boolean;
  name: string;
  pct: number;       // actual % applied (may be reduced if clashed)
  enemyPct: number;  // penalty applied to enemy (0 if clashed or none)
  clashed: boolean;
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
  shownRole?: string;         // affinity shown alongside real rate (RATE spell only)
  denied?: boolean;           // Deny: revealed + locked, cannot be picked
  frozenUntilTurn?: number;  // Freeze: revealed, unpickable until this turn
};

// ===== Draft state (only present during DRAFT phase) =====
export type DraftState = {
  coinFlipped: boolean;
  pool: DraftPoolCard[];
  skipsRemaining: Record<PlayerId, number>;
  spellsRemaining: Record<PlayerId, number>;        // 3 charges each
  cardRevealUsed: Record<PlayerId, number>;          // total Card Reveal uses (2 normally, 6 for special vows)
  cardRevealUsedThisTurn: Record<PlayerId, number>; // resets each turn (per-turn cap: 2 for special vow holders)
  deniesRemaining: Record<PlayerId, number>;          // 2 denies per player per draft
  lastDenyTurn: Record<PlayerId, number>;             // turn on which last deny was used (0 = never)
  freezesRemaining: Record<PlayerId, number>;         // 1 freeze per player per draft
  iceCharges: Record<PlayerId, number>;               // refills to 1 each turn
  extendsRemaining: Record<PlayerId, number>;         // 3 freeze-extends per player per draft
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
  domainOutcome?: Record<PlayerId, DomainOutcomeEntry | null>;
  draft?: DraftState;
  revealPhase?: RevealState;
  augmentPhase?: AugmentPhaseState;
  lockedInPhase?: LockedInPhaseState;
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
  | { type: "PLACE_CARD"; playerId: PlayerId; cardInstanceId: string; target: SlotRef }
  | { type: "ACTIVATE_DOMAIN"; playerId: PlayerId }
  | { type: "SKIP_DOMAIN"; playerId: PlayerId }
  | { type: "RETURN_CARD"; playerId: PlayerId; target: SlotRef }
  | { type: "DRAFT_DENY"; playerId: PlayerId; cardInstanceId: string }
  | { type: "DRAFT_FREEZE"; playerId: PlayerId; cardInstanceId: string }
  | { type: "DRAFT_EXTEND_FREEZE"; playerId: PlayerId; cardInstanceId: string }
  | { type: "DEBUG_REFILL_SPELLS"; playerId: PlayerId };

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

// The result of one player's draft: the leader plus everything they picked.
// Lives here because the battle engine needs it and must not depend on the UI.
export interface PlayerDraftResult {
  leaderId: string;
  combatIds: string[];
  supportIds: string[];
  extraIds: string[];
  weaponIds: string[];
}
