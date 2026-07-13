/**
 * Battle Engine — Hearthstone-style card combat for Draft Battle mode.
 *
 * Architecture:
 *   - All state is plain data (no classes, no mutation)
 *   - Every player action is a BattleIntent dispatched to applyIntent()
 *   - applyIntent() returns { state, events } — UI renders state, events drive animations
 *   - Stats are derived from existing CardDef (no schema changes to contracts)
 *   - Synergies use the same tag system as Quick Match
 *   - Domain effects are looked up by leaderId — add new entries to DOMAIN_BATTLE_EFFECTS
 *     to support One Piece or any future set without touching engine logic
 *
 * Scaling notes:
 *   - RARITY_STATS table controls base ATK/HP/cost per rarity tier — adjust for balance
 *   - AFFINITY_MOD controls role modifiers — extend for new affinities
 *   - SYNERGY_RULES drives all passive buffs — add new rules as tuples
 *   - DOMAIN_BATTLE_EFFECTS keys are leaderId strings — One Piece leaders just get new entries
 *   - Board size and draft constants (PICK_AFFINITY in DraftBattleScreen) are independent
 */

import type { CardDef, PlayerId } from "@cg/contracts";
import type { PlayerDraftResult } from "./screens/DraftBattleScreen";
import { ROULETTE_ITEM_MAP } from "@cg/engine";

// ─────────────────────────────────────────────────────────────────────────────
// Stat derivation — rarity × affinity → ATK, HP, cost
// Tweak this table to rebalance without touching any logic
// ─────────────────────────────────────────────────────────────────────────────

const RARITY_STATS: Record<string, { atk: number; hp: number; cost: number }> = {
  C:   { atk: 1, hp: 2,  cost: 0 },
  B:   { atk: 2, hp: 3,  cost: 1 },
  A:   { atk: 3, hp: 4,  cost: 2 },
  S:   { atk: 4, hp: 5,  cost: 3 },
  SS:  { atk: 6, hp: 6,  cost: 4 },
  SSS: { atk: 7, hp: 7,  cost: 5 },
  X:   { atk: 8, hp: 8,  cost: 7 },
};

export function deriveStats(def: CardDef): { atk: number; hp: number; cost: number } {
  // All cards use rarity stats — leader battle stats (2/30/free) are applied by buildPlayer
  const base = RARITY_STATS[def.rarity] ?? RARITY_STATS.B;
  return { atk: base.atk, hp: base.hp, cost: base.cost };
}

// ─────────────────────────────────────────────────────────────────────────────
// Spell cards — granted when a synergy activates; cast from hand area
// ─────────────────────────────────────────────────────────────────────────────

export type SpellEffect =
  | { kind: "DAMAGE_TARGET"; amount: number }              // deal damage to one enemy
  | { kind: "BUFF_BOARD_ATK"; amount: number; turns: number } // buff all own cards' ATK
  | { kind: "BUFF_BOARD_HP"; amount: number }              // heal/buff all own cards' HP
  | { kind: "DRAW"; count: number }                        // draw cards from deck
  | { kind: "STUN_ONE" }                                   // stun one enemy card for 1 turn
  | { kind: "TURN_BACK_SHEEP" }                            // restore one sheepified card
  | { kind: "GAIN_ENERGY"; amount: number }                // gain extra energy this turn
  | { kind: "PURPLE" }                                     // kill own + enemy card at same slot
  | { kind: "BUFF_ONE_HP"; amount: number }               // buff one own card's HP
  | { kind: "BUFF_ONE_ATK"; amount: number }              // buff one own card's ATK
  | { kind: "DESTROY_ONE" };                               // destroy any one enemy board card

export interface SpellCard {
  id: string;
  synergyId: string;
  name: string;
  description: string;
  effect: SpellEffect;
}

// ─────────────────────────────────────────────────────────────────────────────
// Synergy rules — tag combos → spell grants (more organic than flat stat bonuses)
// ─────────────────────────────────────────────────────────────────────────────

type SynergyRule = {
  id: string;
  tags: string[];
  minCount: number;
  label: string;
  spellName: string;
  spellDesc: string;
  spell: SpellEffect;
};

export const BATTLE_SYNERGY_RULES: SynergyRule[] = [
  { id: "strongest",     tags: ["strongest"],            minCount: 2, label: "The Strongest",       spellName: "Peak Pressure",     spellDesc: "Deal 4 damage to any enemy",              spell: { kind: "DAMAGE_TARGET", amount: 4 } },
  { id: "disaster",      tags: ["disaster-curse"],       minCount: 2, label: "Disaster Curses",     spellName: "Calamity Surge",    spellDesc: "All your cards gain +1 ATK for 2 turns",  spell: { kind: "BUFF_BOARD_ATK", amount: 1, turns: 2 } },
  { id: "jujutsu_high",  tags: ["jujutsu-high"],         minCount: 3, label: "Jujutsu High",        spellName: "School Spirit",     spellDesc: "All your cards gain +1 HP",               spell: { kind: "BUFF_BOARD_HP", amount: 1 } },
  { id: "zenin_clan",    tags: ["zenin-clan"],           minCount: 2, label: "Zenin Clan",          spellName: "Clan Mastery",      spellDesc: "Give one of your cards +3 ATK",           spell: { kind: "BUFF_ONE_ATK", amount: 3 } },
  { id: "brotherhood",   tags: ["brother"],              minCount: 2, label: "Brotherhood",         spellName: "Sworn Bond",        spellDesc: "All your cards gain +1 ATK for 1 turn",   spell: { kind: "BUFF_BOARD_ATK", amount: 1, turns: 1 } },
  { id: "heavenly",      tags: ["heavenly-restriction"], minCount: 2, label: "Heavenly Restriction", spellName: "Pure Body",        spellDesc: "All your cards gain +1 HP",               spell: { kind: "BUFF_BOARD_HP", amount: 1 } },
  { id: "culling_game",  tags: ["culling-game"],         minCount: 3, label: "Culling Game",        spellName: "Kill Score",        spellDesc: "Deal 3 damage to any enemy",              spell: { kind: "DAMAGE_TARGET", amount: 3 } },
  { id: "six_eyes",      tags: ["six-eyes"],             minCount: 2, label: "Six Eyes",            spellName: "Infinity",          spellDesc: "Stun one enemy card for 1 turn",          spell: { kind: "STUN_ONE" } },
  { id: "gojo_students", tags: ["gojo-student"],         minCount: 2, label: "Gojo's Students",     spellName: "Sensei's Guidance", spellDesc: "Give one of your cards +3 HP",            spell: { kind: "BUFF_ONE_HP", amount: 3 } },
  { id: "tokyo_senior",  tags: ["tokyo-senior"],         minCount: 3, label: "Tokyo Trio",          spellName: "Senior Formation",  spellDesc: "Deal 3 damage to any enemy",              spell: { kind: "DAMAGE_TARGET", amount: 3 } },
  { id: "stars",         tags: ["stars"],                minCount: 2, label: "Stars",                spellName: "Starfall",          spellDesc: "All your cards gain +1 HP",               spell: { kind: "BUFF_BOARD_HP", amount: 1 } },
  { id: "gojo_geto_bond", tags: ["gojo-geto"],           minCount: 2, label: "Destined Rivals",      spellName: "Hollow Purple",     spellDesc: "Deal 6 damage to any enemy",              spell: { kind: "DAMAGE_TARGET", amount: 6 } },
];

export function getSynergyLabel(id: string): string {
  return BATTLE_SYNERGY_RULES.find(r => r.id === id)?.label ?? id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain effects — keyed by leaderId, one entry per character
// Add entries for One Piece leaders without changing any engine logic
// ─────────────────────────────────────────────────────────────────────────────

export type DomainEffect =
  | { kind: "STUN_ENEMY_BOARD"; turns: number }          // enemy board can't attack for N turns
  | { kind: "DAMAGE_ALL_ENEMIES"; amount: number }       // split damage across enemy board
  | { kind: "BUFF_OWN_BOARD"; atkBonus: number; hpBonus: number; turns: number }
  | { kind: "HEAL_LEADER"; amount: number }              // restore leader HP
  | { kind: "DRAW_CARDS"; count: number }                // draw extra cards
  | { kind: "REDUCE_COSTS"; amount: number; turns: number } // all cards cheaper
  | { kind: "KILL_ALL_BOARD" }                           // Sukuna: remove all non-leader board cards
  | { kind: "SPAWN_ENTITIES"; count: number; atk: number; hp: number } // Geto
  | { kind: "GRANT_RANDOM_SPELLS"; count: number }       // Hakari
  | { kind: "PERMANENT_LEADER_ATK"; atk: number; counterDmg: number } // Kashimo
  | { kind: "CHOOSE_KILL_ENEMIES"; count: number }       // Dabura (interactive)
  | { kind: "COPY_ENEMY_CARD" }                          // Yuta (interactive)
  | { kind: "HEAL_AND_KILL_ONE"; healAmount: number }    // Mahoraga (interactive)
  | { kind: "SHEEPIFY_BOARD" }                           // Takaba: all board cards become 1/1
  | { kind: "SNEAK_ATTACK_DOMAIN"; amount: number }      // Maki (interactive, no counter)
  | { kind: "GRANT_SPELL"; spellName: string; spellDesc: string; spell: SpellEffect }; // grants a spell to caster

type DomainEntry = {
  name: string;
  effect: DomainEffect;
  grantSpell?: { name: string; desc: string; effect: SpellEffect };
};

export const DOMAIN_BATTLE_EFFECTS: Record<string, DomainEntry> = {
  "gojo-base": { name: "Infinite Void",              effect: { kind: "STUN_ENEMY_BOARD",   turns: 1 } }, // Gojo special-cased in applyDomainEffect to also grant Hollow Purple
  "sukuna":    { name: "Malevolent Shrine",           effect: { kind: "KILL_ALL_BOARD" },
    grantSpell: { name: "Dismantle", desc: "Destroy any 1 enemy board card", effect: { kind: "DESTROY_ONE" } } },
  "mahito":    { name: "Self-Embodiment of Perfection", effect: { kind: "BUFF_OWN_BOARD",  atkBonus: 25, hpBonus: 0, turns: 2 },
    grantSpell: { name: "Transfiguration", desc: "All your cards gain +2 ATK for 2 turns", effect: { kind: "BUFF_BOARD_ATK", amount: 2, turns: 2 } } },
  "yuta":      { name: "Rika Orimoto",               effect: { kind: "COPY_ENEMY_CARD" } },
  "geto":      { name: "Maximum: Uzumaki",            effect: { kind: "SPAWN_ENTITIES",    count: 3, atk: 3, hp: 3 } },
  "megumi":    { name: "Chimera Shadow Garden",       effect: { kind: "BUFF_OWN_BOARD",     atkBonus: 20, hpBonus: 15, turns: 3 },
    grantSpell: { name: "Shadow Strike", desc: "All your cards gain +2 ATK for 3 turns", effect: { kind: "BUFF_BOARD_ATK", amount: 2, turns: 3 } } },
  "hakari":    { name: "Idle Death Gamble",           effect: { kind: "GRANT_RANDOM_SPELLS", count: 3 } },
  "higuruma":  { name: "Deadly Sentencing",           effect: { kind: "STUN_ENEMY_BOARD",   turns: 1 },
    grantSpell: { name: "Judgeman's Verdict", desc: "Stun one enemy card for 1 turn", effect: { kind: "STUN_ONE" } } },
  "jogo":      { name: "Coffin of the Iron Mountain", effect: { kind: "DAMAGE_ALL_ENEMIES", amount: 30 },
    grantSpell: { name: "Ember Insects", desc: "Deal 5 damage to any enemy", effect: { kind: "DAMAGE_TARGET", amount: 5 } } },
  "dagon":     { name: "Horizon of the Captivating Skandha", effect: { kind: "DAMAGE_ALL_ENEMIES", amount: 20 },
    grantSpell: { name: "Tidal Surge", desc: "Deal 4 damage to any enemy", effect: { kind: "DAMAGE_TARGET", amount: 4 } } },
  "toji":      { name: "Heavenly Restriction Assault", effect: { kind: "GRANT_SPELL", spellName: "Toji Strike", spellDesc: "Deal 4 damage to any target", spell: { kind: "DAMAGE_TARGET", amount: 4 } } },
  "kashimo":   { name: "Mythological Beast Amber",   effect: { kind: "GRANT_SPELL", spellName: "Beast Amber", spellDesc: "Give any one of your cards +3 permanent ATK", spell: { kind: "BUFF_ONE_ATK", amount: 3 } } },
  "mahoraga":  { name: "Adaptation",                 effect: { kind: "HEAL_AND_KILL_ONE",  healAmount: 6 },
    grantSpell: { name: "Adaptation Strike", desc: "Destroy any 1 enemy board card", effect: { kind: "DESTROY_ONE" } } },
  "uro":       { name: "Shattered Heaven",           effect: { kind: "REDUCE_COSTS",        amount: 2, turns: 2 } },
  "dabura":    { name: "Demon Realm",                effect: { kind: "CHOOSE_KILL_ENEMIES", count: 2 },
    grantSpell: { name: "Demon King's Curse", desc: "Destroy any 1 enemy board card", effect: { kind: "DESTROY_ONE" } } },
  "naoya":     { name: "Projection Strike",          effect: { kind: "BUFF_OWN_BOARD",      atkBonus: 30, hpBonus: 0, turns: 1 },
    grantSpell: { name: "Projection Slash", desc: "All your cards gain +3 ATK for 1 turn", effect: { kind: "BUFF_BOARD_ATK", amount: 3, turns: 1 } } },
  "maki":      { name: "Heavenly Restriction Assault", effect: { kind: "SNEAK_ATTACK_DOMAIN", amount: 5 } },
  "takaba":    { name: "Comedian",                   effect: { kind: "SHEEPIFY_BOARD" } },
};

const DEFAULT_DOMAIN_EFFECT: { name: string; effect: DomainEffect } = {
  name: "Cursed Technique",
  effect: { kind: "BUFF_OWN_BOARD", atkBonus: 15, hpBonus: 10, turns: 1 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Battle card — a card on board or in hand with live combat stats
// ─────────────────────────────────────────────────────────────────────────────

export interface BattleCard {
  instanceId: string;
  defId: string;
  name: string;
  rarity: string;
  affinity: "LEADER" | "COMBAT" | "SUPPORT";
  tags: string[];
  // Base stats (from deriveStats, never change)
  baseAtk: number;
  baseHp: number;
  cost: number;
  // Live stats (affected by synergies and domain buffs)
  atk: number;
  currentHp: number;
  maxHp: number;
  // Taunt — COMBAT affinity cards protect the leader
  hasTaunt: boolean;
  // Turn-based flags
  canAttack: boolean;     // false on turn played (summoning sickness), true from next turn
  exhausted: boolean;     // true after attacking this turn, reset at turn start
  stunTurns: number;      // can't attack for N turns (domain effect)
  // Temporary buffs (expire after N turns)
  tempAtkBonus: number;
  tempHpBonus: number;
  tempBonusTurns: number;
  // Sheepify state (Takaba domain)
  preSheepAtk?: number;
  preSheepHp?: number;
  isSheep?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Player state within a battle
// ─────────────────────────────────────────────────────────────────────────────

export interface BattlePlayer {
  pid: PlayerId;
  leader: BattleCard;          // always on board; when leader.currentHp ≤ 0 → game over
  board: (BattleCard | null)[]; // up to 5 non-leader slots
  hand: BattleCard[];
  deck: BattleCard[];           // draw pile
  energy: number;
  maxEnergy: number;            // grows by 1 per turn, capped at 10
  domainMeter: number;          // 0–100; fills as you play cards and take damage
  domainActive: boolean;        // true during domain effect's active turns
  domainCooldown: number;       // turns until domain can be activated again (4 turns after use)
  activeSynergies: string[];    // synergy rule ids active based on draft deck composition
  spells: SpellCard[];          // spell cards in hand (usable immediately)
  spellPool: SpellCard[];       // pool of synergy spells available to draw (one per synergy, depletes)
  weaponIds: string[];          // equipped weapons (affect ATK calc)
  costReduction: number;        // from domain effects
  costReductionTurns: number;
  kashimoPassive: boolean;      // true after Kashimo's domain → counter 5 dmg when attacked
  kashimoAtk: number;           // 5 when domain active, else 0
  tojiBerserk: boolean;         // true when Toji is leader → can always attack enemy leader
  leaderBonusAttack: boolean;   // Takaba: next leader attack doesn't exhaust
  getoEntitiesPending: number;  // Geto: how many more entities to spawn when space opens
  cardPlayFrozen: number;       // Gojo domain: turns enemy can't play cards
  synergyDrawUsed: boolean;     // once per turn: spend 2 energy to draw a synergy spell
}

// ─────────────────────────────────────────────────────────────────────────────
// Battle state
// ─────────────────────────────────────────────────────────────────────────────

export type PendingDomainAction =
  | { kind: "CHOOSE_KILL_ENEMIES"; pid: PlayerId; remaining: number }
  | { kind: "COPY_ENEMY_CARD"; pid: PlayerId }
  | { kind: "HEAL_AND_KILL_ONE"; pid: PlayerId; healAmount: number }
  | { kind: "SNEAK_ATTACK_DOMAIN"; pid: PlayerId; amount: number };

export type BattlePhase = "DRAW" | "MAIN" | "GAME_OVER";

export interface BattleState {
  phase: BattlePhase;
  turn: number;
  activePlayer: PlayerId;
  players: Record<PlayerId, BattlePlayer>;
  winner: PlayerId | null;
  log: BattleEvent[];
  // Pending attack: set when player selects an attacker, cleared after attack
  pendingAttackerId: string | null;
  // Pending interactive domain action (requires DOMAIN_TARGET intents)
  pendingDomainAction: PendingDomainAction | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events — returned alongside new state; UI uses these to drive animations
// ─────────────────────────────────────────────────────────────────────────────

export type BattleEvent =
  | { type: "TURN_START"; pid: PlayerId; turn: number; drew: string | null }
  | { type: "CARD_PLAYED"; pid: PlayerId; instanceId: string; slot: number }
  | { type: "ATTACK_CARD"; attackerPid: PlayerId; attackerId: string; targetId: string; damage: number; counterDamage: number }
  | { type: "ATTACK_LEADER"; attackerPid: PlayerId; attackerId: string; damage: number; leaderHpLeft: number }
  | { type: "CARD_DIED"; pid: PlayerId; instanceId: string }
  | { type: "DOMAIN_ACTIVATED"; pid: PlayerId; name: string; effect: DomainEffect }
  | { type: "SYNERGY_UPDATE"; pid: PlayerId; active: string[] }
  | { type: "SPELL_CAST"; pid: PlayerId; spellId: string; synergyId: string }
  | { type: "TURN_END"; pid: PlayerId }
  | { type: "GAME_OVER"; winner: PlayerId }
  | { type: "DOMAIN_TARGET_DONE"; pid: PlayerId }
  | { type: "ILLEGAL"; reason: string };

// ─────────────────────────────────────────────────────────────────────────────
// Battle intents
// ─────────────────────────────────────────────────────────────────────────────

export type BattleIntent =
  | { type: "SELECT_ATTACKER"; pid: PlayerId; instanceId: string }
  | { type: "ATTACK_CARD";     pid: PlayerId; targetInstanceId: string }
  | { type: "ATTACK_LEADER";   pid: PlayerId }
  | { type: "PLAY_CARD";       pid: PlayerId; instanceId: string; slot: number }
  | { type: "ACTIVATE_DOMAIN"; pid: PlayerId }
  | { type: "CAST_SPELL";      pid: PlayerId; spellId: string; targetInstanceId?: string }
  | { type: "END_TURN";        pid: PlayerId }
  | { type: "CANCEL_ATTACK";        pid: PlayerId }
  | { type: "DOMAIN_TARGET";        pid: PlayerId; targetInstanceId: string }
  | { type: "DRAW_SYNERGY_SPELL";   pid: PlayerId };

// ─────────────────────────────────────────────────────────────────────────────
// Factory — build BattleCard from CardDef
// ─────────────────────────────────────────────────────────────────────────────

let _instanceCounter = 0;

export function makeBattleCard(defId: string, def: CardDef): BattleCard {
  const stats = deriveStats(def);
  return {
    instanceId: `bc-${defId}-${++_instanceCounter}`,
    defId,
    name: def.name,
    rarity: def.rarity,
    affinity: def.affinity as "LEADER" | "COMBAT" | "SUPPORT",
    tags: def.tags,
    baseAtk: stats.atk,
    baseHp: stats.hp,
    cost: stats.cost,
    atk: stats.atk,
    currentHp: stats.hp,
    maxHp: stats.hp,
    hasTaunt: def.affinity === "COMBAT",  // COMBAT cards protect the leader
    canAttack: false,
    exhausted: false,
    stunTurns: 0,
    tempAtkBonus: 0,
    tempHpBonus: 0,
    tempBonusTurns: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Synergy calculation
// Returns updated cards (with synergy bonuses applied) and active synergy ids
// ─────────────────────────────────────────────────────────────────────────────

// Calculate synergies from the full draft deck (not board state).
// Leader tags never count — only the drafted non-leader cards.
function calcDeckSynergies(deckCards: BattleCard[]): string[] {
  const activeIds: string[] = [];
  for (const rule of BATTLE_SYNERGY_RULES) {
    const count = deckCards.filter(c =>
      rule.tags.every(tag => (c.tags ?? []).includes(tag))
    ).length;
    if (count >= rule.minCount) activeIds.push(rule.id);
  }
  return activeIds;
}

// Build spell pool: one spell card per active synergy.
function buildSpellPool(activeIds: string[]): SpellCard[] {
  return activeIds.flatMap(id => {
    const rule = BATTLE_SYNERGY_RULES.find(r => r.id === id);
    if (!rule) return [];
    return [{
      id: `spell-pool-${id}-${++_instanceCounter}`,
      synergyId: id,
      name: rule.spellName,
      description: rule.spellDesc,
      effect: rule.spell,
    }];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Weapon ATK bonus (weapons boost a player's overall damage output slightly)
// ─────────────────────────────────────────────────────────────────────────────

function weaponAtkBonus(weaponIds: string[]): number {
  return weaponIds.reduce((sum, id) => {
    const w = ROULETTE_ITEM_MAP[id];
    return sum + Math.round((w?.baseBonus ?? 0) / 200); // scaled down for combat context
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build initial player state from draft result
// ─────────────────────────────────────────────────────────────────────────────

function buildPlayer(
  pid: PlayerId,
  draft: PlayerDraftResult,
  cardDb: Record<string, CardDef>,
): BattlePlayer {
  const leaderDef = cardDb[draft.leaderId];
  if (!leaderDef) throw new Error(`Leader ${draft.leaderId} not found in cardDb`);

  const leader = makeBattleCard(draft.leaderId, leaderDef);
  leader.canAttack = true;
  // Leaders: 2 ATK / 30 HP / cost 0. Toji: 1 ATK (attacks twice without counter)
  leader.atk = leaderDef.id === "toji" ? 1 : 2;
  leader.baseAtk = leader.atk;
  leader.currentHp = 30; leader.maxHp = 30; leader.baseHp = 30;
  leader.cost = 0;

  // Build deck — deriveStats now returns rarity-based stats for ALL cards (incl. LEADER affinity)
  const deckCards: BattleCard[] = [
    ...draft.combatIds,
    ...draft.supportIds,
    ...(draft.extraIds ?? []),
  ].map(id => {
    const def = cardDb[id];
    if (!def) throw new Error(`Card ${id} not found`);
    return makeBattleCard(id, def);
  });

  // Shuffle and deal opening hand of 5
  const shuffled = shuffle(deckCards);
  const hand = shuffled.slice(0, 5);
  const deck = shuffled.slice(5);

  const weaponBonus = weaponAtkBonus(draft.weaponIds);
  // Apply weapon bonus to leader and all cards
  const applyWeapon = (c: BattleCard): BattleCard => ({
    ...c, baseAtk: c.baseAtk + weaponBonus, atk: c.atk + weaponBonus,
  });

  // Default starting spells every player gets
  const defaultSpells: SpellCard[] = [
    {
      id: `spell-default-hp-${pid}-${++_instanceCounter}`,
      synergyId: "default",
      name: "+3 HP",
      description: "+3 HP",
      effect: { kind: "BUFF_ONE_HP", amount: 3 },
    },
    {
      id: `spell-default-atk-${pid}-${++_instanceCounter}`,
      synergyId: "default",
      name: "+3 ATK",
      description: "+3 ATK",
      effect: { kind: "BUFF_ONE_ATK", amount: 3 },
    },
  ];

  // Calculate synergies from the full deck (hand + remaining), not board state
  const allDeckCards = [...hand, ...deck].map(applyWeapon);
  const activeSynergies = calcDeckSynergies(allDeckCards);
  const spellPool = buildSpellPool(activeSynergies);

  const player: BattlePlayer = {
    pid,
    leader: applyWeapon(leader),
    board: [null, null, null, null, null],
    hand:  allDeckCards.slice(0, hand.length),
    deck:  allDeckCards.slice(hand.length),
    energy: 2,
    maxEnergy: 2,
    domainMeter: 0,
    domainActive: false,
    domainCooldown: 0,
    activeSynergies,
    spells: defaultSpells,
    spellPool,
    weaponIds: draft.weaponIds,
    costReduction: 0,
    costReductionTurns: 0,
    kashimoPassive: false,
    kashimoAtk: 0,
    tojiBerserk: leaderDef.id === "toji",
    leaderBonusAttack: leaderDef.id === "toji",
    getoEntitiesPending: 0,
    cardPlayFrozen: 0,
    synergyDrawUsed: false,
  };

  return player;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial state factory
// ─────────────────────────────────────────────────────────────────────────────

// mulliganHands: pre-computed hands after mulligan (instanceIds) — if provided,
// the engine restores these cards to hand (moving them from deck if needed)
export function createBattleState(
  p1Draft: PlayerDraftResult,
  p2Draft: PlayerDraftResult,
  cardDb: Record<string, CardDef>,
  mulliganHands?: { P1: string[]; P2: string[] },
): BattleState {
  _instanceCounter = 0;
  const p1 = buildPlayer("P1", p1Draft, cardDb);
  const p2 = buildPlayer("P2", p2Draft, cardDb);

  // Apply mulligan hands if provided — swap dealt cards for the player-chosen set
  const applyMulligan = (player: BattlePlayer, keptIds: string[]): BattlePlayer => {
    if (!keptIds.length) return player;
    const allCards = [...player.hand, ...player.deck];
    const kept = allCards.filter(c => keptIds.includes(c.instanceId));
    const rest  = shuffle(allCards.filter(c => !keptIds.includes(c.instanceId)));
    return { ...player, hand: kept, deck: rest };
  };

  const fp1 = mulliganHands ? applyMulligan(p1, mulliganHands.P1) : p1;
  const fp2 = mulliganHands ? applyMulligan(p2, mulliganHands.P2) : p2;

  // Coin flip: random first player
  const firstPlayer: PlayerId = Math.random() < 0.5 ? "P1" : "P2";
  const secondPlayer: PlayerId = firstPlayer === "P1" ? "P2" : "P1";

  // Second player gets a bonus energy spell to compensate going second
  const goSecondSpell: SpellCard = {
    id: `spell-go-second-${++_instanceCounter}`,
    synergyId: "go-second",
    name: "Going Second",
    description: "Gain +1 energy this turn",
    effect: { kind: "GAIN_ENERGY", amount: 1 },
  };
  const applyGoSecond = (player: BattlePlayer): BattlePlayer => ({
    ...player, spells: [...player.spells, goSecondSpell],
  });
  const final1 = firstPlayer === "P1" ? fp1 : applyGoSecond(fp1);
  const final2 = firstPlayer === "P2" ? fp2 : applyGoSecond(fp2);

  return {
    phase: "DRAW",
    turn: 1,
    activePlayer: firstPlayer,
    players: { P1: final1, P2: final2 },
    winner: null,
    log: [],
    pendingAttackerId: null,
    pendingDomainAction: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find a card anywhere (board or hand) for a player
// ─────────────────────────────────────────────────────────────────────────────

function findOnBoard(player: BattlePlayer, instanceId: string): BattleCard | null {
  if (player.leader.instanceId === instanceId) return player.leader;
  return player.board.find(c => c?.instanceId === instanceId) ?? null;
}

function findInHand(player: BattlePlayer, instanceId: string): BattleCard | null {
  return player.hand.find(c => c.instanceId === instanceId) ?? null;
}

function boardCards(player: BattlePlayer): BattleCard[] {
  return player.board.filter(Boolean) as BattleCard[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Geto entity spawning helper
// ─────────────────────────────────────────────────────────────────────────────

function spawnGetoEntities(player: BattlePlayer, atk: number, hp: number): BattlePlayer {
  let p = { ...player };
  while (p.getoEntitiesPending > 0) {
    const slot = p.board.findIndex(s => s === null);
    if (slot === -1) break; // board full — keep pending count
    const entity: BattleCard = {
      instanceId: `geto-entity-${++_instanceCounter}`,
      defId: "geto-entity",
      name: "Cursed Spirit",
      rarity: "B",
      affinity: "COMBAT",
      tags: [],
      baseAtk: atk, baseHp: hp,
      cost: 0,
      atk, currentHp: hp, maxHp: hp,
      hasTaunt: true,
      canAttack: true,
      exhausted: false,
      stunTurns: 0,
      tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
    };
    const newBoard = [...p.board] as BattlePlayer["board"];
    newBoard[slot] = entity;
    p = { ...p, board: newBoard, getoEntitiesPending: p.getoEntitiesPending - 1 };
  }
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply domain effect
// ─────────────────────────────────────────────────────────────────────────────

function applyDomainEffect(
  state: BattleState,
  pid: PlayerId,
  effect: DomainEffect,
): BattleState {
  const opp   = pid === "P1" ? "P2" : "P1";
  let p = { ...state.players[pid] };
  let o = { ...state.players[opp] };

  switch (effect.kind) {
    case "STUN_ENEMY_BOARD": {
      o = {
        ...o,
        leader: { ...o.leader, stunTurns: effect.turns },
        board:  o.board.map(c => c ? { ...c, stunTurns: effect.turns } : null),
        cardPlayFrozen: effect.turns, // also prevent card placement
      };
      // Gojo's domain additionally grants the "Purple" spell to the caster
      if (p.leader.defId === "gojo-base") {
        const purpleSpell: SpellCard = {
          id: `spell-purple-${++_instanceCounter}`,
          synergyId: "gojo-purple",
          name: "Hollow Purple",
          description: "Destroy any 1 enemy board card",
          effect: { kind: "DESTROY_ONE" },
        };
        p = { ...p, spells: [...p.spells, purpleSpell] };
      }
      break;
    }
    case "DAMAGE_ALL_ENEMIES": {
      const targets = [o.leader, ...boardCards(o)];
      const dmgEach = Math.floor(effect.amount / Math.max(targets.length, 1));
      o = {
        ...o,
        leader: { ...o.leader, currentHp: o.leader.currentHp - dmgEach },
        board:  o.board.map(c => c ? { ...c, currentHp: c.currentHp - dmgEach } : null),
      };
      // Remove dead board cards
      o = { ...o, board: o.board.map(c => c && c.currentHp > 0 ? c : null) };
      break;
    }
    case "BUFF_OWN_BOARD": {
      const applyBuff = (c: BattleCard): BattleCard => ({
        ...c,
        atk:            c.atk + effect.atkBonus,
        tempAtkBonus:   c.tempAtkBonus + effect.atkBonus,
        tempHpBonus:    c.tempHpBonus + effect.hpBonus,
        maxHp:          c.maxHp + effect.hpBonus,
        currentHp:      c.currentHp + effect.hpBonus,
        tempBonusTurns: effect.turns,
      });
      p = { ...p, leader: applyBuff(p.leader), board: p.board.map(c => c ? applyBuff(c) : null) };
      break;
    }
    case "HEAL_LEADER": {
      p = { ...p, leader: { ...p.leader, currentHp: Math.min(p.leader.currentHp + effect.amount, p.leader.maxHp) } };
      break;
    }
    case "DRAW_CARDS": {
      let drew = 0;
      while (drew < effect.count && p.deck.length > 0) {
        const [card, ...rest] = p.deck;
        p = { ...p, hand: [...p.hand, card], deck: rest };
        drew++;
      }
      break;
    }
    case "REDUCE_COSTS": {
      p = { ...p, costReduction: effect.amount, costReductionTurns: effect.turns };
      break;
    }
    case "KILL_ALL_BOARD": {
      // Remove all non-leader board cards from both players
      o = { ...o, board: o.board.map(() => null) };
      p = { ...p, board: p.board.map(() => null) };
      break;
    }
    case "SPAWN_ENTITIES": {
      // Spawn up to count entities in empty board slots; track remainder in getoEntitiesPending
      p = { ...p, getoEntitiesPending: p.getoEntitiesPending + effect.count };
      p = spawnGetoEntities(p, effect.atk, effect.hp);
      break;
    }
    case "GRANT_RANDOM_SPELLS": {
      // Pick count random spells from BATTLE_SYNERGY_RULES and add to player.spells with cost 1
      const shuffledRules = shuffle([...BATTLE_SYNERGY_RULES]);
      const picked = shuffledRules.slice(0, effect.count);
      const newSpells: SpellCard[] = picked.map(rule => ({
        id: `spell-hakari-${++_instanceCounter}`,
        synergyId: rule.id,
        name: rule.spellName,
        description: rule.spellDesc,
        effect: rule.spell,
      }));
      p = { ...p, spells: [...p.spells, ...newSpells] };
      break;
    }
    case "PERMANENT_LEADER_ATK": {
      p = {
        ...p,
        leader: { ...p.leader, atk: effect.atk, baseAtk: effect.atk },
        kashimoPassive: true,
        kashimoAtk: effect.counterDmg,
      };
      break;
    }
    case "CHOOSE_KILL_ENEMIES": {
      // Interactive — wait for DOMAIN_TARGET intents
      return {
        ...state,
        players: { ...state.players, [pid]: p, [opp]: o },
        pendingDomainAction: { kind: "CHOOSE_KILL_ENEMIES", pid, remaining: effect.count },
      };
    }
    case "COPY_ENEMY_CARD": {
      // Interactive — wait for DOMAIN_TARGET intent
      return {
        ...state,
        players: { ...state.players, [pid]: p, [opp]: o },
        pendingDomainAction: { kind: "COPY_ENEMY_CARD", pid },
      };
    }
    case "HEAL_AND_KILL_ONE": {
      // Heal immediately, then wait for kill target
      p = { ...p, leader: { ...p.leader, currentHp: Math.min(p.leader.currentHp + effect.healAmount, p.leader.maxHp) } };
      return {
        ...state,
        players: { ...state.players, [pid]: p, [opp]: o },
        pendingDomainAction: { kind: "HEAL_AND_KILL_ONE", pid, healAmount: 0 },
      };
    }
    case "SHEEPIFY_BOARD": {
      // Sheepify all non-null board cards on both players
      const sheepify = (c: BattleCard): BattleCard => ({
        ...c,
        preSheepAtk: c.atk,
        preSheepHp: c.currentHp,
        isSheep: true,
        atk: 1,
        baseAtk: 1,
        currentHp: 1,
        maxHp: 1,
      });
      o = { ...o, board: o.board.map(c => c ? sheepify(c) : null) };
      p = { ...p, board: p.board.map(c => c ? sheepify(c) : null) };
      // Takaba leader gets bonus attack and a Turn Back spell
      const turnBackSpell: SpellCard = {
        id: `spell-turnback-${++_instanceCounter}`,
        synergyId: "takaba-sheepify",
        name: "Turn Back",
        description: "Restore one sheepified card to its original stats",
        effect: { kind: "TURN_BACK_SHEEP" },
      };
      p = { ...p, leaderBonusAttack: true, spells: [...p.spells, turnBackSpell] };
      break;
    }
    case "SNEAK_ATTACK_DOMAIN": {
      // Interactive — wait for DOMAIN_TARGET intent
      return {
        ...state,
        players: { ...state.players, [pid]: p, [opp]: o },
        pendingDomainAction: { kind: "SNEAK_ATTACK_DOMAIN", pid, amount: effect.amount },
      };
    }
    case "GRANT_SPELL": {
      const grantedSpell: SpellCard = {
        id: `spell-domain-grant-${++_instanceCounter}`,
        synergyId: "domain",
        name: effect.spellName,
        description: effect.spellDesc,
        effect: effect.spell,
      };
      p = { ...p, spells: [...p.spells, grantedSpell] };
      break;
    }
  }

  // Grant bonus spell if the domain entry defines one
  const domainEntry = DOMAIN_BATTLE_EFFECTS[p.leader.defId];
  if (domainEntry?.grantSpell) {
    const gs = domainEntry.grantSpell;
    const bonusSpell: SpellCard = {
      id: `spell-domain-bonus-${++_instanceCounter}`,
      synergyId: "domain",
      name: gs.name,
      description: gs.desc,
      effect: gs.effect,
    };
    p = { ...p, spells: [...p.spells, bonusSpell] };
  }

  return { ...state, players: { ...state.players, [pid]: p, [opp]: o } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Turn start: draw, energy refill, reset card flags
// ─────────────────────────────────────────────────────────────────────────────

function processTurnStart(state: BattleState): { state: BattleState; drew: string | null } {
  const pid = state.activePlayer;
  let p = { ...state.players[pid] };

  // Energy
  const newMax = Math.min(p.maxEnergy + 1, 10);
  p = { ...p, maxEnergy: newMax, energy: newMax };

  // Cost reduction decay
  if (p.costReductionTurns > 0) {
    const newTurns = p.costReductionTurns - 1;
    p = { ...p, costReductionTurns: newTurns, costReduction: newTurns > 0 ? p.costReduction : 0 };
  }

  // Temp buff decay on all board cards
  const decayBuff = (c: BattleCard): BattleCard => {
    if (c.tempBonusTurns <= 0) return c;
    const newTurns = c.tempBonusTurns - 1;
    if (newTurns === 0) {
      return {
        ...c, tempBonusTurns: 0,
        atk: c.baseAtk, tempAtkBonus: 0, tempHpBonus: 0,
        maxHp: c.baseHp, currentHp: Math.min(c.currentHp, c.baseHp),
      };
    }
    return { ...c, tempBonusTurns: newTurns };
  };
  p = { ...p, leader: decayBuff(p.leader), board: p.board.map(c => c ? decayBuff(c) : null) };

  // Reset exhausted/stun/canAttack flags
  const resetFlags = (c: BattleCard): BattleCard => ({
    ...c,
    exhausted:  false,
    canAttack:  c.stunTurns <= 0,
    stunTurns:  Math.max(0, c.stunTurns - 1),
  });
  p = {
    ...p,
    leader: resetFlags(p.leader),
    board:  p.board.map(c => c ? resetFlags(c) : null),
    // Newly played cards become able to attack next turn — handled at play time
  };

  // Domain cooldown
  if (p.domainCooldown > 0) p = { ...p, domainCooldown: p.domainCooldown - 1 };

  // Card play freeze decay (Gojo domain)
  if (p.cardPlayFrozen > 0) p = { ...p, cardPlayFrozen: p.cardPlayFrozen - 1 };

  // Toji gets his bonus attack back each turn
  if (p.tojiBerserk) p = { ...p, leaderBonusAttack: true };

  // Reset synergy draw
  p = { ...p, synergyDrawUsed: false };

  // Draw a card
  let drew: string | null = null;
  if (p.deck.length > 0) {
    const [card, ...rest] = p.deck;
    drew = card.instanceId;
    p = { ...p, hand: [...p.hand, card], deck: rest };
  }

  return {
    state: { ...state, phase: "MAIN", players: { ...state.players, [pid]: p } },
    drew,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check win condition
// ─────────────────────────────────────────────────────────────────────────────

function checkWin(state: BattleState): BattleState {
  const p1Dead = state.players.P1.leader.currentHp <= 0;
  const p2Dead = state.players.P2.leader.currentHp <= 0;
  if (p1Dead || p2Dead) {
    const winner: PlayerId = p2Dead ? "P1" : "P2";
    return { ...state, phase: "GAME_OVER", winner };
  }
  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main intent handler
// ─────────────────────────────────────────────────────────────────────────────

export type BattleResult = { state: BattleState; events: BattleEvent[] };

export function applyBattleIntent(state: BattleState, intent: BattleIntent): BattleResult {
  const events: BattleEvent[] = [];
  const illegal = (reason: string): BattleResult => ({
    state, events: [{ type: "ILLEGAL", reason }],
  });

  // ── DRAW phase: auto-advance to MAIN ─────────────────────────────────────
  if (state.phase === "DRAW" && intent.type === "END_TURN") {
    // This intent triggers the draw phase processing
    const { state: s2, drew } = processTurnStart(state);
    events.push({ type: "TURN_START", pid: state.activePlayer, turn: state.turn, drew });
    return { state: s2, events };
  }

  if (state.phase === "GAME_OVER") return illegal("Game is already over");
  if (intent.pid !== state.activePlayer) return illegal("Not your turn");

  const pid = state.activePlayer;
  const opp = pid === "P1" ? "P2" : "P1";

  switch (intent.type) {

    // ── SELECT_ATTACKER ───────────────────────────────────────────────────
    case "SELECT_ATTACKER": {
      const card = findOnBoard(state.players[pid], intent.instanceId);
      if (!card) return illegal("Card not on board");
      if (!card.canAttack || card.exhausted) return illegal("Card cannot attack");
      return { state: { ...state, pendingAttackerId: intent.instanceId }, events };
    }

    case "CANCEL_ATTACK": {
      return { state: { ...state, pendingAttackerId: null }, events };
    }

    // ── ATTACK_CARD ───────────────────────────────────────────────────────
    case "ATTACK_CARD": {
      if (!state.pendingAttackerId) return illegal("No attacker selected");
      const attacker = findOnBoard(state.players[pid], state.pendingAttackerId);
      if (!attacker) return illegal("Attacker not found");
      if (!attacker.canAttack || attacker.exhausted) return illegal("Attacker cannot attack");

      const target = findOnBoard(state.players[opp], intent.targetInstanceId);
      if (!target) return illegal("Target not found");

      // Deal damage both ways (counterattack)
      const damage        = attacker.atk;
      const counterDamage = target.atk;

      let p = { ...state.players[pid] };
      let o = { ...state.players[opp] };

      // Is target the leader?
      const isLeaderTarget = target.instanceId === o.leader.instanceId;
      const isLeaderAttacker = attacker.instanceId === p.leader.instanceId;

      // Apply damage to target
      const updateTarget = (c: BattleCard): BattleCard => ({
        ...c, currentHp: c.currentHp - damage,
      });
      // Apply counter to attacker (Toji never takes counter damage)
      const tojiNoCounter = isLeaderAttacker && p.tojiBerserk;
      const actualCounter = tojiNoCounter ? 0 : counterDamage;
      // Kashimo self-damage: when Kashimo's leader attacks, leader takes kashimoAtk self-damage
      const kashimoSelf = (isLeaderAttacker && p.kashimoPassive) ? p.kashimoAtk : 0;
      const exhaustAttacker = (c: BattleCard): BattleCard => {
        if (isLeaderAttacker && p.leaderBonusAttack) return { ...c, currentHp: c.currentHp - actualCounter - kashimoSelf };
        return { ...c, currentHp: c.currentHp - actualCounter - kashimoSelf, exhausted: true };
      };

      if (isLeaderAttacker) {
        const wasBonus = p.leaderBonusAttack;
        p = { ...p, leader: exhaustAttacker(p.leader), leaderBonusAttack: wasBonus ? false : p.leaderBonusAttack };
      } else {
        p = { ...p, board: p.board.map(c => c?.instanceId === attacker.instanceId ? exhaustAttacker(c) : c) };
      }

      if (isLeaderTarget) {
        o = { ...o, leader: updateTarget(o.leader) };
      } else {
        o = { ...o, board: o.board.map(c => c?.instanceId === target.instanceId ? updateTarget(c) : c) };
      }

      // Domain meter boost on damage dealt
      p = { ...p, domainMeter: Math.min(100, p.domainMeter + 7) };
      o = { ...o, domainMeter: Math.min(100, o.domainMeter + Math.ceil(damage / 14)) };

      events.push({ type: "ATTACK_CARD", attackerPid: pid, attackerId: attacker.instanceId, targetId: target.instanceId, damage, counterDamage });

      // Remove dead non-leader board cards
      const removeDeadBoard = (player: BattlePlayer): BattlePlayer => ({
        ...player,
        board: player.board.map(c => (c && c.currentHp <= 0) ? null : c),
      });
      p = removeDeadBoard(p);
      o = removeDeadBoard(o);
      // Spawn any pending Geto entities after board space may have opened
      p = spawnGetoEntities(p, 3, 3);
      o = spawnGetoEntities(o, 3, 3);
      if (attacker.currentHp - actualCounter - kashimoSelf <= 0) events.push({ type: "CARD_DIED", pid, instanceId: attacker.instanceId });
      if (target.currentHp - damage <= 0)          events.push({ type: "CARD_DIED", pid: opp, instanceId: target.instanceId });

      let nextState: BattleState = { ...state, players: { ...state.players, [pid]: p, [opp]: o }, pendingAttackerId: null };
      nextState = checkWin(nextState);
      if (nextState.winner) events.push({ type: "GAME_OVER", winner: nextState.winner });
      return { state: nextState, events };
    }

    // ── ATTACK_LEADER ─────────────────────────────────────────────────────
    case "ATTACK_LEADER": {
      if (!state.pendingAttackerId) return illegal("No attacker selected");
      const attacker = findOnBoard(state.players[pid], state.pendingAttackerId);
      if (!attacker) return illegal("Attacker not found");
      if (!attacker.canAttack || attacker.exhausted) return illegal("Attacker cannot attack");
      // Any card on the board protects the leader — clear the board first (unless Toji berserk)
      const tauntGuards = boardCards(state.players[opp]);
      if (tauntGuards.length > 0 && !state.players[pid].tojiBerserk) return illegal("Defeat all enemy cards before targeting the leader!");

      const damage = attacker.atk;
      let p = { ...state.players[pid] };
      let o = { ...state.players[opp] };

      // Kashimo self-damage: when Kashimo's leader attacks, leader takes kashimoAtk self-damage
      const isLeaderAttacking = attacker.instanceId === p.leader.instanceId;
      const kashimoSelfLeader = (isLeaderAttacking && p.kashimoPassive) ? p.kashimoAtk : 0;
      if (isLeaderAttacking) {
        if (p.leaderBonusAttack) {
          p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp - kashimoSelfLeader }, leaderBonusAttack: false };
        } else {
          p = { ...p, leader: { ...p.leader, exhausted: true, currentHp: p.leader.currentHp - kashimoSelfLeader } };
        }
      } else {
        p = { ...p, board: p.board.map(c => c?.instanceId === attacker.instanceId ? { ...c, exhausted: true } : c) };
      }

      o = { ...o, leader: { ...o.leader, currentHp: o.leader.currentHp - damage } };
      p = { ...p, domainMeter: Math.min(100, p.domainMeter + 11) };
      o = { ...o, domainMeter: Math.min(100, o.domainMeter + Math.ceil(damage / 11)) };

      events.push({ type: "ATTACK_LEADER", attackerPid: pid, attackerId: attacker.instanceId, damage, leaderHpLeft: o.leader.currentHp });

      let nextState: BattleState = { ...state, players: { ...state.players, [pid]: p, [opp]: o }, pendingAttackerId: null };
      nextState = checkWin(nextState);
      if (nextState.winner) events.push({ type: "GAME_OVER", winner: nextState.winner });
      return { state: nextState, events };
    }

    // ── PLAY_CARD ─────────────────────────────────────────────────────────
    case "PLAY_CARD": {
      const card = findInHand(state.players[pid], intent.instanceId);
      if (!card) return illegal("Card not in hand");
      if (intent.slot < 0 || intent.slot > 4) return illegal("Invalid slot");

      let p = { ...state.players[pid] };
      if (p.board[intent.slot] !== null) return illegal("Slot occupied");
      if (p.cardPlayFrozen > 0) return illegal("You cannot play cards while frozen by domain!");

      const cost = Math.max(0, card.cost - p.costReduction);
      if (p.energy < cost) return illegal("Not enough energy");

      // Place card
      const playedCard: BattleCard = { ...card, canAttack: false, exhausted: false }; // summoning sickness
      const newBoard = [...p.board] as BattlePlayer["board"];
      newBoard[intent.slot] = playedCard;
      p = {
        ...p,
        hand:  p.hand.filter(c => c.instanceId !== card.instanceId),
        board: newBoard,
        energy: p.energy - cost,
        domainMeter: Math.min(100, p.domainMeter + 7),
      };
      events.push({ type: "CARD_PLAYED", pid, instanceId: card.instanceId, slot: intent.slot });

      return { state: { ...state, players: { ...state.players, [pid]: p } }, events };
    }

    // ── CAST_SPELL ────────────────────────────────────────────────────────
    case "CAST_SPELL": {
      const spell = state.players[pid].spells.find(s => s.id === intent.spellId);
      if (!spell) return illegal("Spell not found");

      let p = { ...state.players[pid], spells: state.players[pid].spells.filter(s => s.id !== intent.spellId) };
      let o = { ...state.players[opp] };
      const eff = spell.effect;

      switch (eff.kind) {
        case "DAMAGE_TARGET": {
          if (!intent.targetInstanceId) return illegal("Target required for damage spell");
          const tgt = findOnBoard(o, intent.targetInstanceId);
          if (!tgt) return illegal("Target not found");
          if (tgt.instanceId === o.leader.instanceId) {
            o = { ...o, leader: { ...o.leader, currentHp: o.leader.currentHp - eff.amount } };
          } else {
            o = { ...o, board: o.board.map(c => c?.instanceId === tgt.instanceId ? { ...c, currentHp: c.currentHp - eff.amount } : c) };
            o = { ...o, board: o.board.map(c => (c && c.currentHp <= 0) ? null : c) };
          }
          break;
        }
        case "BUFF_BOARD_ATK": {
          const buffAtk = (c: BattleCard): BattleCard => ({
            ...c, atk: c.atk + eff.amount, tempAtkBonus: c.tempAtkBonus + eff.amount,
            tempBonusTurns: Math.max(c.tempBonusTurns, eff.turns),
          });
          p = { ...p, board: p.board.map(c => c ? buffAtk(c) : null) };
          break;
        }
        case "BUFF_BOARD_HP": {
          const buffHp = (c: BattleCard): BattleCard => ({
            ...c, maxHp: c.maxHp + eff.amount, currentHp: c.currentHp + eff.amount,
            tempHpBonus: c.tempHpBonus + eff.amount, tempBonusTurns: Math.max(c.tempBonusTurns, 2),
          });
          p = { ...p, board: p.board.map(c => c ? buffHp(c) : null) };
          break;
        }
        case "DRAW": {
          let drew = 0;
          while (drew < eff.count && p.deck.length > 0) {
            const [card, ...rest] = p.deck;
            p = { ...p, hand: [...p.hand, card], deck: rest };
            drew++;
          }
          break;
        }
        case "STUN_ONE": {
          if (!intent.targetInstanceId) return illegal("Target required for stun spell");
          const tgt = findOnBoard(o, intent.targetInstanceId);
          if (!tgt) return illegal("Target not found");
          if (tgt.instanceId === o.leader.instanceId) {
            o = { ...o, leader: { ...o.leader, stunTurns: 1 } };
          } else {
            o = { ...o, board: o.board.map(c => c?.instanceId === tgt.instanceId ? { ...c, stunTurns: 1 } : c) };
          }
          break;
        }
        case "TURN_BACK_SHEEP": {
          if (!intent.targetInstanceId) return illegal("Select a card to restore");
          const tgtCard = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!tgtCard || !tgtCard.isSheep) return illegal("Card not found or not a sheep");
          const restored: BattleCard = {
            ...tgtCard,
            atk: tgtCard.preSheepAtk ?? tgtCard.baseAtk,
            baseAtk: tgtCard.preSheepAtk ?? tgtCard.baseAtk,
            currentHp: tgtCard.preSheepHp ?? tgtCard.baseHp,
            maxHp: tgtCard.preSheepHp ?? tgtCard.baseHp,
            isSheep: false,
            preSheepAtk: undefined,
            preSheepHp: undefined,
          };
          p = { ...p, board: p.board.map(c => c?.instanceId === intent.targetInstanceId ? restored : c) };
          break;
        }
        case "GAIN_ENERGY": {
          p = { ...p, energy: p.energy + eff.amount };
          break;
        }
        case "PURPLE": {
          if (!intent.targetInstanceId) return illegal("Select an enemy board card for Purple");
          const enemySlot = o.board.findIndex(c => c?.instanceId === intent.targetInstanceId);
          if (enemySlot === -1) return illegal("Target not on enemy board");
          // Kill enemy card at slot
          o = { ...o, board: o.board.map((c, i) => i === enemySlot ? null : c) };
          // Kill own card at same slot (if any)
          p = { ...p, board: p.board.map((c, i) => i === enemySlot ? null : c) };
          break;
        }
        case "DESTROY_ONE": {
          if (!intent.targetInstanceId) return illegal("Select an enemy card to destroy");
          const target = o.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!target) return illegal("Target not on enemy board");
          o = { ...o, board: o.board.map(c => c?.instanceId === intent.targetInstanceId ? null : c) };
          break;
        }
        case "BUFF_ONE_HP": {
          if (!intent.targetInstanceId) return illegal("Select one of your cards to buff HP");
          const isLeader = p.leader.instanceId === intent.targetInstanceId;
          const boardCard = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!isLeader && !boardCard) return illegal("Target not found on your side");
          if (isLeader) {
            p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp + eff.amount, maxHp: p.leader.maxHp + eff.amount } };
          } else {
            p = { ...p, board: p.board.map(c => c?.instanceId === intent.targetInstanceId ? { ...c, currentHp: c.currentHp + eff.amount, maxHp: c.maxHp + eff.amount } : c) };
          }
          break;
        }
        case "BUFF_ONE_ATK": {
          if (!intent.targetInstanceId) return illegal("Select one of your cards to buff ATK");
          const isLeader2 = p.leader.instanceId === intent.targetInstanceId;
          const boardCard2 = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!isLeader2 && !boardCard2) return illegal("Target not found on your side");
          if (isLeader2) {
            p = { ...p, leader: { ...p.leader, atk: p.leader.atk + eff.amount } };
          } else {
            p = { ...p, board: p.board.map(c => c?.instanceId === intent.targetInstanceId ? { ...c, atk: c.atk + eff.amount } : c) };
          }
          break;
        }
      }

      events.push({ type: "SPELL_CAST", pid, spellId: spell.id, synergyId: spell.synergyId });
      let spellState: BattleState = { ...state, players: { ...state.players, [pid]: p, [opp]: o } };
      spellState = checkWin(spellState);
      if (spellState.winner) events.push({ type: "GAME_OVER", winner: spellState.winner });
      return { state: spellState, events };
    }

    // ── ACTIVATE_DOMAIN ───────────────────────────────────────────────────
    case "ACTIVATE_DOMAIN": {
      const p0 = state.players[pid];
      if (p0.domainMeter < 100)    return illegal("Domain meter not full");
      if (p0.domainCooldown > 0)   return illegal("Domain on cooldown");

      const domainDef = DOMAIN_BATTLE_EFFECTS[p0.leader.defId] ?? DEFAULT_DOMAIN_EFFECT;
      let nextState = applyDomainEffect(state, pid, domainDef.effect);

      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [pid]: {
            ...nextState.players[pid],
            domainMeter:   0,
            domainActive:  true,
            domainCooldown: 4,
          },
        },
      };

      events.push({ type: "DOMAIN_ACTIVATED", pid, name: domainDef.name, effect: domainDef.effect });
      nextState = checkWin(nextState);
      if (nextState.winner) events.push({ type: "GAME_OVER", winner: nextState.winner });
      return { state: nextState, events };
    }

    // ── DRAW_SYNERGY_SPELL ────────────────────────────────────────────────
    case "DRAW_SYNERGY_SPELL": {
      let p = { ...state.players[pid] };
      if (p.synergyDrawUsed) return illegal("Synergy draw already used this turn");
      if (p.energy < 1) return illegal("Not enough energy (need 1)");
      if (p.spellPool.length === 0) return illegal("No spells left in pool");
      // Pick random spell from pool and remove it
      const poolIdx = Math.floor(Math.random() * p.spellPool.length);
      const drawnSpell = p.spellPool[poolIdx];
      const newPool = p.spellPool.filter((_, i) => i !== poolIdx);
      p = { ...p, energy: p.energy - 1, spells: [...p.spells, drawnSpell], spellPool: newPool, synergyDrawUsed: true };
      events.push({ type: "SPELL_CAST", pid, spellId: drawnSpell.id, synergyId: drawnSpell.synergyId });
      return { state: { ...state, players: { ...state.players, [pid]: p } }, events };
    }

    // ── END_TURN ──────────────────────────────────────────────────────────
    case "END_TURN": {
      events.push({ type: "TURN_END", pid });

      const nextPid = opp;
      const nextTurn = pid === "P2" ? state.turn + 1 : state.turn;

      const midState: BattleState = {
        ...state,
        phase: "DRAW",
        turn: nextTurn,
        activePlayer: nextPid,
        pendingAttackerId: null,
      };

      // Process draw phase for next player immediately
      const { state: s2, drew } = processTurnStart(midState);
      events.push({ type: "TURN_START", pid: nextPid, turn: nextTurn, drew });

      return { state: s2, events };
    }

    // ── DOMAIN_TARGET ─────────────────────────────────────────────────────
    case "DOMAIN_TARGET": {
      const pda = state.pendingDomainAction;
      if (!pda || pda.pid !== pid) return illegal("No pending domain action");

      switch (pda.kind) {
        case "CHOOSE_KILL_ENEMIES": {
          const tgt = findOnBoard(state.players[opp], intent.targetInstanceId);
          if (!tgt) return illegal("Target not found");
          if (tgt.instanceId === state.players[opp].leader.instanceId) return illegal("Cannot target leader with this effect");
          let o2 = { ...state.players[opp] };
          o2 = { ...o2, board: o2.board.map(c => c?.instanceId === tgt.instanceId ? null : c) };
          const remaining = pda.remaining - 1;
          const nextPda = remaining > 0 ? { ...pda, remaining } : null;
          events.push({ type: "DOMAIN_TARGET_DONE", pid });
          let ns: BattleState = { ...state, players: { ...state.players, [opp]: o2 }, pendingDomainAction: nextPda };
          ns = checkWin(ns);
          if (ns.winner) events.push({ type: "GAME_OVER", winner: ns.winner });
          return { state: ns, events };
        }
        case "COPY_ENEMY_CARD": {
          const tgt = findOnBoard(state.players[opp], intent.targetInstanceId);
          if (!tgt) return illegal("Target not found");
          if (tgt.instanceId === state.players[opp].leader.instanceId) return illegal("Cannot copy leader");
          let p2 = { ...state.players[pid] };
          const slot = p2.board.findIndex(s => s === null);
          if (slot === -1) return illegal("Your board is full");
          const copyAtk = Math.max(1, tgt.atk - 1);
          const copyHp = Math.max(1, tgt.currentHp - 1);
          const copy: BattleCard = {
            ...tgt,
            instanceId: `copy-${tgt.instanceId}-${++_instanceCounter}`,
            atk: copyAtk, baseAtk: copyAtk,
            currentHp: copyHp, maxHp: copyHp, baseHp: copyHp,
            canAttack: false, exhausted: false,
            tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
          };
          const newBoard2 = [...p2.board] as BattlePlayer["board"];
          newBoard2[slot] = copy;
          p2 = { ...p2, board: newBoard2 };
          events.push({ type: "DOMAIN_TARGET_DONE", pid });
          return { state: { ...state, players: { ...state.players, [pid]: p2 }, pendingDomainAction: null }, events };
        }
        case "HEAL_AND_KILL_ONE": {
          const tgt = findOnBoard(state.players[opp], intent.targetInstanceId);
          if (!tgt) return illegal("Target not found");
          if (tgt.instanceId === state.players[opp].leader.instanceId) return illegal("Cannot kill leader");
          let o2 = { ...state.players[opp] };
          o2 = { ...o2, board: o2.board.map(c => c?.instanceId === tgt.instanceId ? null : c) };
          events.push({ type: "DOMAIN_TARGET_DONE", pid });
          return { state: { ...state, players: { ...state.players, [opp]: o2 }, pendingDomainAction: null }, events };
        }
        case "SNEAK_ATTACK_DOMAIN": {
          const tgt = findOnBoard(state.players[opp], intent.targetInstanceId);
          if (!tgt) return illegal("Target not found");
          let o2 = { ...state.players[opp] };
          if (tgt.instanceId === o2.leader.instanceId) {
            o2 = { ...o2, leader: { ...o2.leader, currentHp: o2.leader.currentHp - pda.amount } };
          } else {
            o2 = { ...o2, board: o2.board.map(c => c?.instanceId === tgt.instanceId ? { ...c, currentHp: c.currentHp - pda.amount } : c) };
            o2 = { ...o2, board: o2.board.map(c => c && c.currentHp <= 0 ? null : c) };
          }
          events.push({ type: "DOMAIN_TARGET_DONE", pid });
          let ns: BattleState = { ...state, players: { ...state.players, [opp]: o2 }, pendingDomainAction: null };
          ns = checkWin(ns);
          if (ns.winner) events.push({ type: "GAME_OVER", winner: ns.winner });
          return { state: ns, events };
        }
      }
      return illegal("Unknown pending domain action");
    }

    default:
      return illegal("Unknown intent");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine wrapper — mirrors the Quick Match Engine interface
// ─────────────────────────────────────────────────────────────────────────────

export type BattleEngine = {
  getState(): BattleState;
  setState(s: BattleState): void;
  apply(intent: BattleIntent): BattleResult;
};

export function createBattleEngine(initial: BattleState): BattleEngine {
  let state = initial;
  return {
    getState: () => state,
    setState: (s) => { state = s; },
    apply: (intent) => {
      const result = applyBattleIntent(state, intent);
      state = result.state;
      return result;
    },
  };
}
