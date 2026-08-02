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

// Per-card stat overrides on top of the rarity table
const STAT_OVERRIDES: Record<string, Partial<{ atk: number; hp: number; cost: number }>> = {
  uro:       { atk: 2, hp: 4 },
  todo:      { atk: 2 },
  mechamaru: { atk: 1, hp: 4 },
  jinichi:   { atk: 4, hp: 2 },
  inumaki:   { atk: 1, hp: 4 },
  maki:      { atk: 7, hp: 5 },
  choso:     { atk: 5, hp: 5 },
  yuji:      { atk: 4, hp: 4 },
  sukuna:    { atk: 10, hp: 6 },
  dabura:    { atk: 9, hp: 7 },
  hakari:    { atk: 5, hp: 6 },
  kashimo:   { atk: 5, hp: 6 },
  megumi:    { atk: 2, hp: 3 },
  naoya:     { atk: 4, hp: 4 },
  mahito:    { atk: 5, hp: 2 },
  geto:      { atk: 5, hp: 5 },
  ryu:       { atk: 5, hp: 6 },
};

export function deriveStats(def: CardDef): { atk: number; hp: number; cost: number } {
  // All cards use rarity stats — leader battle stats (2/30/free) are applied by buildPlayer
  const base = RARITY_STATS[def.rarity] ?? RARITY_STATS.B;
  return { atk: base.atk, hp: base.hp, cost: base.cost, ...STAT_OVERRIDES[def.id] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Spell cards — granted when a synergy activates; cast from hand area
// ─────────────────────────────────────────────────────────────────────────────

export type SpellEffect =
  | { kind: "DAMAGE_TARGET"; amount: number }              // deal damage to one enemy
  | { kind: "DAMAGE_ALL"; amount: number }                 // damage every enemy card AND their leader
  | { kind: "DAMAGE_AND_STUN"; amount: number }            // damage + stun one enemy board card for 1 turn
  | { kind: "BUFF_BOARD_ATK"; amount: number; turns: number } // buff all own cards' ATK
  | { kind: "BUFF_BOARD_HP"; amount: number; includeLeader?: boolean } // heal/buff all own cards' HP
  | { kind: "BUFF_ONE_BOTH"; atk: number; hp: number }     // one board card gains ATK + HP permanently
  | { kind: "DRAW"; count: number }                        // draw cards from deck
  | { kind: "STUN_ONE" }                                   // stun one enemy card for 1 turn
  | { kind: "TURN_BACK_SHEEP" }                            // restore one sheepified card
  | { kind: "GAIN_ENERGY"; amount: number }                // gain extra energy this turn
  | { kind: "PURPLE" }                                     // kill own + enemy card at same slot
  | { kind: "BUFF_ONE_HP"; amount: number }               // buff one own card's HP
  | { kind: "BUFF_ONE_ATK"; amount: number }              // buff one own card's ATK
  | { kind: "DESTROY_ONE" }                                // destroy any one enemy board card
  | { kind: "COPY_BOARD_CARD" }                            // place a 3/3 copy of any board card
  | { kind: "DAMAGE_TARGET_SELF"; amount: number; selfAmount: number } // damage enemy + hurt self
  | { kind: "SHEEPIFY_ONE"; maxCost?: number }                         // turn one enemy board card into 1/1 sheep (optionally cost-capped)
  | { kind: "BEASTIFY_ONE" };                                          // turn any board card into an 8/8 Beast that loses 1 HP each turn

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
  { id: "strongest",     tags: ["strongest"],            minCount: 2, label: "The Strongest",       spellName: "Peak Pressure",     spellDesc: "Deal 3 damage to any enemy board card",   spell: { kind: "DAMAGE_TARGET", amount: 3 } },
  { id: "disaster",      tags: ["disaster-curse"],       minCount: 3, label: "Disaster Curses",     spellName: "Calamity Surge",    spellDesc: "Deal 1 damage to every enemy card and their leader", spell: { kind: "DAMAGE_ALL", amount: 1 } },
  { id: "jujutsu_high",  tags: ["jujutsu-high"],         minCount: 3, label: "Jujutsu High",        spellName: "School Spirit",     spellDesc: "All your cards gain +1 HP",               spell: { kind: "BUFF_BOARD_HP", amount: 1 } },
  { id: "zenin_clan",    tags: ["zenin-clan"],           minCount: 2, label: "Zenin Clan",          spellName: "Clan Mastery",      spellDesc: "Give one of your cards +2 ATK",           spell: { kind: "BUFF_ONE_ATK", amount: 2 } },
  { id: "brotherhood",   tags: ["brother"],              minCount: 2, label: "Brotherhood",         spellName: "Sworn Bond",        spellDesc: "All your cards gain +1 ATK for 1 turn",   spell: { kind: "BUFF_BOARD_ATK", amount: 1, turns: 1 } },
  { id: "heavenly",      tags: ["heavenly-restriction"], minCount: 2, label: "Heavenly Restriction", spellName: "Pure Body",        spellDesc: "Give one of your cards +1 ATK and +2 HP permanently", spell: { kind: "BUFF_ONE_BOTH", atk: 1, hp: 2 } },
  { id: "culling_game",  tags: ["culling-game"],         minCount: 3, label: "Culling Game",        spellName: "Kill Score",        spellDesc: "Deal 3 damage to any enemy",              spell: { kind: "DAMAGE_TARGET", amount: 3 } },
  { id: "gojo_clan",     tags: ["gojo-clan"],            minCount: 2, label: "Gojo Clan",           spellName: "Infinity",          spellDesc: "Stun one enemy card for 1 turn",          spell: { kind: "STUN_ONE" } },
  { id: "gojo_students", tags: ["gojo-student"],         minCount: 2, label: "Gojo's Students",     spellName: "Guidance",          spellDesc: "Give one of your cards +2 HP",            spell: { kind: "BUFF_ONE_HP", amount: 2 } },
  { id: "tokyo_senior",  tags: ["tokyo-senior"],         minCount: 3, label: "Tokyo Trio",          spellName: "Senior Formation",  spellDesc: "Deal 3 damage to any enemy",              spell: { kind: "DAMAGE_TARGET", amount: 3 } },
  { id: "stars",         tags: ["stars"],                minCount: 2, label: "Stars",                spellName: "Starfall",          spellDesc: "All your cards and your leader gain +1 HP", spell: { kind: "BUFF_BOARD_HP", amount: 1, includeLeader: true } },
  { id: "gojo_geto_bond", tags: ["gojo-geto"],           minCount: 2, label: "Destined Rivals",      spellName: "Memory",            spellDesc: "Deal 1 damage and stun an enemy card for 1 turn", spell: { kind: "DAMAGE_AND_STUN", amount: 1 } },
  { id: "dance",          tags: ["dance"],               minCount: 2, label: "Dance",                spellName: "Dance",             spellDesc: "Give a board card +2 ATK and +1 HP",      spell: { kind: "BUFF_ONE_BOTH", atk: 2, hp: 1 } },
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
  | { kind: "SHEEPIFY_BOARD" }                           // all board cards become 1/1 (unused by Takaba now)
  | { kind: "SHEEPIFY_ENEMY_CARDS"; count: number }      // Takaba: choose N enemy cards to become 1/1
  | { kind: "SNEAK_ATTACK_DOMAIN"; amount: number }      // Maki (interactive, no counter)
  | { kind: "GRANT_SPELL"; spellName: string; spellDesc: string; spell: SpellEffect } // grants a spell to caster
  | { kind: "SUKUNA_BOARD_MODE" }                        // wipe board + Sukuna enters as 4/17 board card
  | { kind: "MAHORAGA_BOARD_MODE" }                      // Mahoraga enters board as 1/25 adaptive card
  | { kind: "TAKABA_BOARD_MODE" }                        // all cards on both boards become 1/1 sheep; Takaba enters board as 1/20
  | { kind: "BUFF_LEADER_PERMANENT"; atk: number; hp: number } // permanent stat buff to leader
  | { kind: "SHEEPIFY_ENEMY_LEADER" }                    // Takaba: turn enemy leader into 1/7 sheep
  | { kind: "SUMMON_RIKA_AND_COPY" };                    // Yuta: summon Rika 5/5 + grant copy spell

type DomainEntry = {
  name: string;
  effect: DomainEffect;
  grantSpell?: { name: string; desc: string; effect: SpellEffect };
  secondEffect?: DomainEffect;
  secondGrantSpell?: { name: string; desc: string; effect: SpellEffect };
};

export const DOMAIN_BATTLE_EFFECTS: Record<string, DomainEntry> = {
  "gojo-base": { name: "Infinite Void",              effect: { kind: "STUN_ENEMY_BOARD",   turns: 1 } }, // Gojo special-cased: grants Hollow Purple (DAMAGE_TARGET 5), +5 energy, unlimited GET SPELL this turn; 2nd fill grants 2 purples
  "sukuna":    { name: "Malevolent Shrine",           effect: { kind: "SUKUNA_BOARD_MODE" },
    secondEffect: { kind: "GRANT_SPELL", spellName: "Dismantle", spellDesc: "Deal 6 damage to any enemy", spell: { kind: "DAMAGE_TARGET", amount: 6 } } },
  "mahito":    { name: "Self-Embodiment of Perfection", effect: { kind: "BUFF_OWN_BOARD",  atkBonus: 25, hpBonus: 0, turns: 2 },
    grantSpell: { name: "Transfiguration", desc: "All your cards gain +2 ATK for 2 turns", effect: { kind: "BUFF_BOARD_ATK", amount: 2, turns: 2 } } },
  "yuta":      { name: "Rika Orimoto",               effect: { kind: "SUMMON_RIKA_AND_COPY" },
    secondEffect: { kind: "SUMMON_RIKA_AND_COPY" } },
  "geto":      { name: "Maximum: Uzumaki",            effect: { kind: "SPAWN_ENTITIES",    count: 3, atk: 1, hp: 2 },
    secondEffect: { kind: "SPAWN_ENTITIES", count: 1, atk: 5, hp: 5 } },
  "megumi":    { name: "Chimera Shadow Garden",       effect: { kind: "BUFF_OWN_BOARD",     atkBonus: 20, hpBonus: 15, turns: 3 },
    grantSpell: { name: "Shadow Strike", desc: "All your cards gain +2 ATK for 3 turns", effect: { kind: "BUFF_BOARD_ATK", amount: 2, turns: 3 } } },
  "hakari":    { name: "Idle Death Gamble",           effect: { kind: "GRANT_RANDOM_SPELLS", count: 3 },
    secondEffect: { kind: "GRANT_RANDOM_SPELLS", count: 3 } },
  "higuruma":  { name: "Deadly Sentencing",           effect: { kind: "STUN_ENEMY_BOARD",   turns: 1 },
    grantSpell: { name: "Judgeman's Verdict", desc: "Stun one enemy card for 1 turn", effect: { kind: "STUN_ONE" } } },
  "jogo":      { name: "Coffin of the Iron Mountain", effect: { kind: "DAMAGE_ALL_ENEMIES", amount: 30 },
    grantSpell: { name: "Ember Insects", desc: "Deal 5 damage to any enemy", effect: { kind: "DAMAGE_TARGET", amount: 5 } } },
  "dagon":     { name: "Horizon of the Captivating Skandha", effect: { kind: "DAMAGE_ALL_ENEMIES", amount: 20 },
    grantSpell: { name: "Tidal Surge", desc: "Deal 4 damage to any enemy", effect: { kind: "DAMAGE_TARGET", amount: 4 } } },
  "toji":      { name: "Heavenly Restriction Assault", effect: { kind: "GRANT_SPELL", spellName: "Toji Strike", spellDesc: "Deal 4 damage to any target", spell: { kind: "DAMAGE_TARGET", amount: 4 } },
    secondEffect: { kind: "GRANT_SPELL", spellName: "Toji Strike", spellDesc: "Deal 4 damage to any target", spell: { kind: "DAMAGE_TARGET", amount: 4 } } },
  "kashimo":   { name: "Mythological Beast Amber",   effect: { kind: "BUFF_LEADER_PERMANENT", atk: 3, hp: 0 },
    grantSpell: { name: "Beast Amber", desc: "Deal 4 damage to any enemy (2 damage to yourself)", effect: { kind: "DAMAGE_TARGET_SELF", amount: 4, selfAmount: 2 } },
    secondEffect: { kind: "GRANT_SPELL", spellName: "Beast Amber II", spellDesc: "Deal 6 damage to any enemy (4 damage to yourself)", spell: { kind: "DAMAGE_TARGET_SELF", amount: 6, selfAmount: 4 } } },
  "mahoraga":  { name: "Adaptation",                 effect: { kind: "MAHORAGA_BOARD_MODE" },
    secondEffect: { kind: "GRANT_SPELL", spellName: "Adaptation Strike", spellDesc: "Give one of your cards +4 HP", spell: { kind: "BUFF_ONE_HP", amount: 4 } } },
  "uro":       { name: "Shattered Heaven",           effect: { kind: "REDUCE_COSTS",        amount: 2, turns: 2 } },
  // First fill: leader gains +1 ATK / +5 HP and ONE Demon King's Curse (via grantSpell)
  "dabura":    { name: "Demon Realm",                effect: { kind: "BUFF_LEADER_PERMANENT", atk: 1, hp: 5 },
    grantSpell: { name: "Demon King's Curse", desc: "Destroy any 1 enemy board card", effect: { kind: "DESTROY_ONE" } },
    secondEffect: { kind: "BUFF_LEADER_PERMANENT", atk: 3, hp: 6 } },
  "naoya":     { name: "Projection Strike",          effect: { kind: "BUFF_OWN_BOARD",      atkBonus: 30, hpBonus: 0, turns: 1 },
    grantSpell: { name: "Projection Slash", desc: "All your cards gain +3 ATK for 1 turn", effect: { kind: "BUFF_BOARD_ATK", amount: 3, turns: 1 } } },
  "maki":      { name: "Heavenly Restriction Assault", effect: { kind: "GRANT_SPELL", spellName: "Dragon Bone Strike", spellDesc: "Deal 5 damage to any target", spell: { kind: "DAMAGE_TARGET", amount: 5 } },
    secondEffect: { kind: "GRANT_SPELL", spellName: "Dragon Bone Strike", spellDesc: "Deal 5 damage to any target", spell: { kind: "DAMAGE_TARGET", amount: 5 } } },
  // First fill: 1 sheep spell + 1 Turn Beast spell. Second fill: sheepify everything, Takaba enters the board as a 1/20.
  "takaba":    { name: "Comedian",                   effect: { kind: "GRANT_SPELL", spellName: "Comedian's Curse", spellDesc: "Turn an enemy card costing 4 or less into a 1/1 sheep", spell: { kind: "SHEEPIFY_ONE", maxCost: 4 } },
    grantSpell: { name: "Turn Beast", desc: "Turn any board card into an 8/8 Beast — it loses 1 HP each turn", effect: { kind: "BEASTIFY_ONE" } },
    secondEffect: { kind: "TAKABA_BOARD_MODE" } },
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
  // Board mode: card represents the leader (Sukuna/Mahoraga) — immune to DESTROY_ONE
  isLeaderCard?: boolean;
  // Perk state (see CARD_PERKS)
  perkUsed?: boolean;       // each card's perk is once per game
  redirectNext?: boolean;   // Todo: next attack against this card is redirected to a random enemy card
  ignoreShields?: boolean;  // Toji: can attack past Shields until end of turn
  perkAtkTurn?: number;     // Yuji/Choso/Nanami: ATK granted by perk, removed at end of turn
  splashNext?: boolean;     // Jogo: next attack deals 1 dmg to all other enemy board cards
  pierceBoardOnly?: boolean;// Maki: permanently ignore shields for board targets (never the leader)
  reflectTurns?: number;    // Uro: attacks against this card damage the attacker instead
  silentStrike?: boolean;   // Naoya: this turn attacks take no counter but deal half damage
  regen?: boolean;          // Mahoraga: +1 HP after surviving damage
  rebirth?: boolean;        // Kurourushi: respawns as a 2/2 on death
  beastDecay?: boolean;     // Takaba's Turn Beast: loses 1 HP at its owner's turn start
}

// ─────────────────────────────────────────────────────────────────────────────
// Card perks — activatable once per game via a button under the board card
// ─────────────────────────────────────────────────────────────────────────────

export const CARD_PERKS: Record<string, { icon: string; name: string; desc: string }> = {
  mechamaru:  { icon: "🤖", name: "Ultimate Mechamaru", desc: "Summons a Robot — a 2/2 Shield entity." },
  todo:       { icon: "👏", name: "Boogie Woogie", desc: "The next time Todo is attacked, the damage is redirected to a random enemy card. The attacker takes no counter damage — only the redirected damage happens." },
  megumi:     { icon: "🐺", name: "Eight-Handled Sword", desc: "Summons Mahoraga (7/7) — Megumi dies and your leader takes 5 damage. If Mahoraga is in your deck or hand, that card is summoned instead and your leader takes no damage. If your leader is Mahoraga, summons Nue (2/2)." },
  geto:       { icon: "👿", name: "Cursed Spirit Manipulation", desc: "Summons 2 Cursed Spirits — a 1/2 Shield and a 2/1." },
  mahito:     { icon: "🖐", name: "Idle Transfiguration", desc: "Choose 1 enemy card and 1 friendly card of the same cost — both are destroyed." },
  toji:       { icon: "🗡", name: "Shield Breaker", desc: "This turn Toji can attack any target, ignoring Shields — including the enemy leader, who takes half damage." },
  yuji:       { icon: "⚡", name: "Black Flash", desc: "+2 ATK this turn." },
  choso:      { icon: "🩸", name: "Piercing Blood", desc: "+2 ATK this turn." },
  dagon:      { icon: "🐟", name: "Death Swarm", desc: "Spawns two 1/1 Fish entities." },
  takaba:     { icon: "🐑", name: "Comedy Gold", desc: "Grants a spell that turns any card costing 3 or less into a 1/1 sheep." },
  inumaki:    { icon: "🗣", name: "Cursed Speech", desc: "Stuns 1 enemy card for 1 turn — Inumaki becomes a 1/1 right after." },
  jogo:       { icon: "🌋", name: "Maximum Meteor", desc: "His next attack also deals 1 damage to every other enemy board card." },
  maki:       { icon: "🐉", name: "Dragon Bone", desc: "+2 ATK permanently. Can attack any board card regardless of Shields (but never the leader)." },
  kashimo:    { icon: "⚡", name: "Lightning Discharge", desc: "+3 ATK permanently, but HP drops to 1." },
  uro:        { icon: "🌀", name: "Sky Warp", desc: "For 2 turns, attacks aimed at her damage the attacker instead." },
  gakuganji:  { icon: "🎸", name: "Cursed Riff", desc: "Choose one of your cards to give +1 ATK permanently." },
  mahoraga:   { icon: "☸", name: "Adaptation", desc: "After surviving damage, Mahoraga recovers 1 HP (effectively takes 1 less from every hit)." },
  hakari:     { icon: "🎰", name: "Jackpot", desc: "Grants a random spell for free — it can be any spell." },
  naoya:      { icon: "💨", name: "Projection Rush", desc: "This turn his attack takes no counter damage, but deals half damage." },
  kurourushi: { icon: "🪳", name: "Cursed Rebirth", desc: "When Kurourushi dies, he respawns with half his highest ATK and HP." },
  nanami:     { icon: "⏱", name: "Overtime", desc: "+2 ATK this turn." },
  nobara:     { icon: "📌", name: "Resonance", desc: "Pin 2 enemy board cards. The next time one takes damage, the other takes half that damage. One use." },
};

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
  getoEntityAtk: number;       // Geto: ATK stat for pending entities
  getoEntityHp: number;        // Geto: HP stat for pending entities
  cardPlayFrozen: number;       // Gojo domain: turns enemy can't play cards
  turnFrozen: number;           // Gojo domain: turns enemy can't take any action
  synergyDrawUsed: boolean;     // once per turn: spend 2 energy to draw a synergy spell
  domainActivationCount: number; // how many times domain has been activated
  spellQueue: SpellCard[];       // overflow queue when spell slots (4) are full
  sukunaBoardMode: boolean;      // true when Sukuna entered board as 4/17
  mahoragaBoardMode: boolean;    // true when Mahoraga entered board as 1/25
  takabaBoardMode: boolean;      // true when Takaba entered board as 1/20
  mahoragaAdaptAtk: number;      // accumulated +ATK from Mahoraga adaptation hits
  shieldCharges: number;         // consumable shield grants (3 per game)
  unlimitedSpellDraw?: boolean;  // Gojo domain: GET SPELL has no once-per-turn limit this turn
  resonance?: { a: string; b: string } | null; // Nobara perk: linked enemy instanceIds — next damage to one hits the other for half
}

// ─────────────────────────────────────────────────────────────────────────────
// Battle state
// ─────────────────────────────────────────────────────────────────────────────

export type PendingDomainAction =
  | { kind: "CHOOSE_KILL_ENEMIES"; pid: PlayerId; remaining: number }
  | { kind: "COPY_ENEMY_CARD"; pid: PlayerId }
  | { kind: "HEAL_AND_KILL_ONE"; pid: PlayerId; healAmount: number }
  | { kind: "SNEAK_ATTACK_DOMAIN"; pid: PlayerId; amount: number }
  | { kind: "SHEEPIFY_ENEMY_CARDS"; pid: PlayerId; remaining: number };

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
  | { type: "DRAW_SYNERGY_SPELL";   pid: PlayerId }
  | { type: "GRANT_BOARD_SHIELD";   pid: PlayerId; targetInstanceId: string }
  | { type: "ACTIVATE_PERK";        pid: PlayerId; instanceId: string; targetInstanceId?: string; friendlyTargetInstanceId?: string; secondTargetInstanceId?: string }
  | { type: "ATTACK_RANDOM";        pid: PlayerId; instanceId: string }; // Mahoraga: strikes a random target anywhere on the board

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
    hasTaunt: def.tags.includes("shield"), // shield-tagged cards protect the leader
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
    maxEnergy: 1,
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
    getoEntityAtk: 1,
    getoEntityHp: 2,
    cardPlayFrozen: 0,
    turnFrozen: 0,
    synergyDrawUsed: false,
    domainActivationCount: 0,
    spellQueue: [],
    sukunaBoardMode: false,
    mahoragaBoardMode: false,
    takabaBoardMode: false,
    mahoragaAdaptAtk: 0,
    shieldCharges: 3,
  };

  return player;
}

// Give Mahoraga's board card +1 ATK if the card with hitInstanceId is Mahoraga and its HP dropped.
function adaptMahoragaIfHit(player: BattlePlayer, hitInstanceId: string, hpBefore: number, hpAfter: number): BattlePlayer {
  if (!player.mahoragaBoardMode) return player;
  if (hpAfter >= hpBefore) return player; // no damage taken
  const mCard = player.board.find(c => c?.isLeaderCard && c.instanceId === hitInstanceId);
  if (!mCard) return player;
  return {
    ...player,
    mahoragaAdaptAtk: player.mahoragaAdaptAtk + 1,
    board: player.board.map(c => c?.instanceId === hitInstanceId ? { ...c, atk: c.atk + 1 } : c),
  };
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
// Generic entity summon helper — spawns into the first empty slot (no-op if board full)
// ─────────────────────────────────────────────────────────────────────────────

function summonEntity(
  player: BattlePlayer,
  defId: string, name: string, atk: number, hp: number, shield: boolean,
): BattlePlayer {
  const slot = player.board.findIndex(s => s === null);
  if (slot === -1) return player;
  const entity: BattleCard = {
    instanceId: `${defId}-${++_instanceCounter}`,
    defId, name,
    rarity: "B",
    affinity: "COMBAT",
    tags: [],
    baseAtk: atk, baseHp: hp,
    cost: 0,
    atk, currentHp: hp, maxHp: hp,
    hasTaunt: shield,
    canAttack: false, exhausted: true,
    stunTurns: 0,
    tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
  };
  const newBoard = [...player.board] as BattlePlayer["board"];
  newBoard[slot] = entity;
  return { ...player, board: newBoard };
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
      canAttack: false, exhausted: true,
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
  activationCount = 0,
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
        turnFrozen: effect.turns,     // prevent all actions
      };
      // Gojo's domain grants Hollow Purple spell(s), +5 energy, and unlimited GET SPELL this turn
      if (p.leader.defId === "gojo-base") {
        const makePurple = (): SpellCard => ({
          id: `spell-purple-${++_instanceCounter}`,
          synergyId: "gojo-purple",
          name: "Hollow Purple",
          description: "Deal 5 damage to any enemy",
          effect: { kind: "DAMAGE_TARGET", amount: 5 },
        });
        const count = activationCount >= 1 ? 2 : 1;
        for (let i = 0; i < count; i++) p = addSpell(p, makePurple());
        p = { ...p, energy: Math.min(10, p.energy + 5), unlimitedSpellDraw: true };
      }
      break;
    }
    case "DAMAGE_ALL_ENEMIES": {
      const targets = [o.leader, ...boardCards(o)];
      const dmgEach = Math.floor(effect.amount / Math.max(targets.length, 1));
      // Track Mahoraga HP before damage for adaptation
      const mCardBefore = o.mahoragaBoardMode ? o.board.find(c => c?.isLeaderCard) : null;
      o = {
        ...o,
        leader: { ...o.leader, currentHp: o.leader.currentHp - dmgEach },
        board:  o.board.map(c => c ? { ...c, currentHp: c.currentHp - dmgEach } : null),
      };
      if (mCardBefore) o = adaptMahoragaIfHit(o, mCardBefore.instanceId, mCardBefore.currentHp, mCardBefore.currentHp - dmgEach);
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
      p = { ...p, getoEntitiesPending: p.getoEntitiesPending + effect.count, getoEntityAtk: effect.atk, getoEntityHp: effect.hp };
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
      for (const s of newSpells) p = addSpell(p, s);
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
    case "SUKUNA_BOARD_MODE": {
      // Wipe both boards; enemy leader card on board takes 3 damage but is not killed
      o = { ...o, board: o.board.map(c => {
        if (!c) return null;
        if (c.isLeaderCard) return { ...c, currentHp: Math.max(1, c.currentHp - 3) };
        return null;
      }) };
      p = { ...p, board: p.board.map(() => null) };
      const sukunaCard: BattleCard = {
        instanceId: `sukuna-board-${++_instanceCounter}`,
        defId: "sukuna",
        name: "Ryomen Sukuna",
        rarity: "X",
        affinity: "LEADER",
        tags: p.leader.tags,
        baseAtk: 4, baseHp: 17,
        cost: 0,
        atk: 4, currentHp: 17, maxHp: 17,
        hasTaunt: false,
        canAttack: true, exhausted: false,
        stunTurns: 0,
        tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
        isLeaderCard: true,
      };
      const sukunaSlot = p.board[2] === null ? 2 : p.board.findIndex(s => s === null); // prefer center slot
      if (sukunaSlot !== -1) {
        const nb = [...p.board] as BattlePlayer["board"];
        nb[sukunaSlot] = sukunaCard;
        p = { ...p, board: nb };
      }
      p = { ...p, sukunaBoardMode: true };
      break;
    }
    case "MAHORAGA_BOARD_MODE": {
      // Place Mahoraga as 1/25 board card with adaptation
      const mahoragaCard: BattleCard = {
        instanceId: `mahoraga-board-${++_instanceCounter}`,
        defId: "mahoraga",
        name: "Mahoraga",
        rarity: "X",
        affinity: "LEADER",
        tags: p.leader.tags,
        baseAtk: 1, baseHp: 25,
        cost: 0,
        atk: 1 + p.mahoragaAdaptAtk, currentHp: 25, maxHp: 25,
        hasTaunt: false,
        canAttack: true, exhausted: false,
        stunTurns: 0,
        tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
        isLeaderCard: true,
      };
      const mSlot = p.board[2] === null ? 2 : p.board.findIndex(s => s === null); // prefer center slot
      if (mSlot !== -1) {
        const nb = [...p.board] as BattlePlayer["board"];
        nb[mSlot] = mahoragaCard;
        p = { ...p, board: nb };
      }
      p = { ...p, mahoragaBoardMode: true };
      break;
    }
    case "TAKABA_BOARD_MODE": {
      // Comedy apocalypse: every card on BOTH boards becomes a 1/1 sheep (leader-cards immune)
      const sheepAll = (c: BattleCard): BattleCard => c.isLeaderCard ? c : ({
        ...c,
        preSheepAtk: c.atk, preSheepHp: c.currentHp,
        isSheep: true, atk: 1, baseAtk: 1, currentHp: 1, maxHp: 1,
      });
      o = { ...o, board: o.board.map(c => c ? sheepAll(c) : null) };
      p = { ...p, board: p.board.map(c => c ? sheepAll(c) : null) };
      // Takaba himself walks onto the board as a 1/20
      const takabaCard: BattleCard = {
        instanceId: `takaba-board-${++_instanceCounter}`,
        defId: "takaba",
        name: "Takaba Fumihiko",
        rarity: "X",
        affinity: "LEADER",
        tags: p.leader.tags,
        baseAtk: 1, baseHp: 20,
        cost: 0,
        atk: 1, currentHp: 20, maxHp: 20,
        hasTaunt: false,
        canAttack: true, exhausted: false,
        stunTurns: 0,
        tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
        isLeaderCard: true,
      };
      const tSlot = p.board[2] === null ? 2 : p.board.findIndex(s => s === null); // prefer center slot
      if (tSlot !== -1) {
        const nb = [...p.board] as BattlePlayer["board"];
        nb[tSlot] = takabaCard;
        p = { ...p, board: nb };
      }
      p = { ...p, takabaBoardMode: true };
      break;
    }
    case "BUFF_LEADER_PERMANENT": {
      p = { ...p, leader: {
        ...p.leader,
        atk: p.leader.atk + effect.atk,
        baseAtk: p.leader.baseAtk + effect.atk,
        currentHp: p.leader.currentHp + effect.hp,
        maxHp: p.leader.maxHp + effect.hp,
        baseHp: p.leader.baseHp + effect.hp,
      }};
      break;
    }
    case "SHEEPIFY_ENEMY_LEADER": {
      o = { ...o, leader: {
        ...o.leader,
        preSheepAtk: o.leader.atk,
        preSheepHp: o.leader.currentHp,
        isSheep: true,
        atk: 1, baseAtk: 1,
        currentHp: 7, maxHp: 7,
      }};
      break;
    }
    case "SUMMON_RIKA_AND_COPY": {
      // Spawn Rika 5/5 on board
      const rikaCard: BattleCard = {
        instanceId: `rika-${++_instanceCounter}`,
        defId: "rika-entity",
        name: "Rika Orimoto",
        rarity: "SS",
        affinity: "COMBAT",
        tags: [],
        baseAtk: 5, baseHp: 5,
        cost: 0,
        atk: 5, currentHp: 5, maxHp: 5,
        hasTaunt: activationCount >= 1, // second-fill Rika arrives with a Shield
        canAttack: false, exhausted: true,
        stunTurns: 0,
        tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
      };
      const rikaSlot = p.board.findIndex(s => s === null);
      if (rikaSlot !== -1) {
        const nb = [...p.board] as BattlePlayer["board"];
        nb[rikaSlot] = rikaCard;
        p = { ...p, board: nb };
      }
      // Every fill (including refills) grants a Cursed Copy spell
      {
        const copySpell: SpellCard = {
          id: `spell-rika-copy-${++_instanceCounter}`,
          synergyId: "yuta-copy",
          name: "Cursed Copy",
          description: "Place a 3/3 copy of any board card onto your board",
          effect: { kind: "COPY_BOARD_CARD" },
        };
        p = addSpell(p, copySpell);
      }
      break;
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
      p = addSpell({ ...p, leaderBonusAttack: true }, turnBackSpell);
      break;
    }
    case "SHEEPIFY_ENEMY_CARDS": {
      // Interactive — wait for DOMAIN_TARGET intents to pick which enemy cards to sheepify
      return {
        ...state,
        players: { ...state.players, [pid]: p, [opp]: o },
        pendingDomainAction: { kind: "SHEEPIFY_ENEMY_CARDS", pid, remaining: effect.count },
      };
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
      p = addSpell(p, grantedSpell);
      break;
    }
  }

  // Grant bonus spell if the domain entry defines one
  const domainEntry = DOMAIN_BATTLE_EFFECTS[p.leader.defId];
  const grantSpellDef = activationCount >= 1 ? domainEntry?.secondGrantSpell : domainEntry?.grantSpell;
  if (grantSpellDef) {
    const bonusSpell: SpellCard = {
      id: `spell-domain-bonus-${++_instanceCounter}`,
      synergyId: "domain",
      name: grantSpellDef.name,
      description: grantSpellDef.desc,
      effect: grantSpellDef.effect,
    };
    p = addSpell(p, bonusSpell);
  }

  return { ...state, players: { ...state.players, [pid]: p, [opp]: o } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Spell helpers
// ─────────────────────────────────────────────────────────────────────────────

// Add a spell to player — overflows into spellQueue when 4 slots are full
function addSpell(p: BattlePlayer, spell: SpellCard): BattlePlayer {
  if (p.spells.length >= 4) {
    return { ...p, spellQueue: [...p.spellQueue, spell] };
  }
  return { ...p, spells: [...p.spells, spell] };
}

// Domain meter gain with speed multiplier (12% faster first fill, 2× that for second+)
function domainGain(p: BattlePlayer, raw: number): number {
  const mult = p.domainActivationCount >= 1 ? 2.24 : 1.12;
  return Math.ceil(raw * mult);
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
    reflectTurns: Math.max(0, (c.reflectTurns ?? 0) - 1), // Uro perk decay
  });
  p = {
    ...p,
    leader: resetFlags(p.leader),
    board:  p.board.map(c => c ? resetFlags(c) : null),
    // Newly played cards become able to attack next turn — handled at play time
  };

  // Takaba's Turn Beast decay — beasts lose 1 HP at their owner's turn start (and can die from it)
  p = { ...p, board: p.board.map(c => c?.beastDecay ? { ...c, currentHp: c.currentHp - 1 } : c) };
  p = { ...p, board: p.board.map(c => (c && c.currentHp <= 0) ? null : c) };

  // Domain cooldown
  if (p.domainCooldown > 0) p = { ...p, domainCooldown: p.domainCooldown - 1 };

  // Card play / turn freeze decay (Gojo domain)
  if (p.cardPlayFrozen > 0) p = { ...p, cardPlayFrozen: p.cardPlayFrozen - 1 };
  if (p.turnFrozen > 0) p = { ...p, turnFrozen: p.turnFrozen - 1 };

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

function isPlayerDead(player: BattlePlayer): boolean {
  if (player.leader.currentHp <= 0) return true;
  // In board mode the leader card IS the leader — dying ends the game
  if (player.sukunaBoardMode && !player.board.some(c => c?.isLeaderCard)) return true;
  if (player.mahoragaBoardMode && !player.board.some(c => c?.isLeaderCard)) return true;
  if (player.takabaBoardMode && !player.board.some(c => c?.isLeaderCard)) return true;
  return false;
}

function checkWin(state: BattleState): BattleState {
  const p1Dead = isPlayerDead(state.players.P1);
  const p2Dead = isPlayerDead(state.players.P2);
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

  // Gojo stun: opponent is fully immobilized (can only end turn)
  if (state.players[state.activePlayer].turnFrozen > 0 && intent.type !== "END_TURN") {
    return illegal("You are immobilized by Infinite Void and cannot act!");
  }

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

    // ── ATTACK_RANDOM (Mahoraga) — strikes a random target anywhere ───────
    case "ATTACK_RANDOM": {
      const attacker = findOnBoard(state.players[pid], intent.instanceId);
      if (!attacker) return illegal("Attacker not found");
      if (!attacker.canAttack || attacker.exhausted) return illegal("Attacker cannot attack");

      let p = { ...state.players[pid] };
      let o = { ...state.players[opp] };

      // Pool: every card on both boards (except the attacker) + both leaders
      type RTarget = { side: "own" | "opp"; card: BattleCard; isLeader: boolean };
      const pool: RTarget[] = [
        ...boardCards(o).map(c => ({ side: "opp" as const, card: c, isLeader: false })),
        ...boardCards(p).filter(c => c.instanceId !== attacker.instanceId).map(c => ({ side: "own" as const, card: c, isLeader: false })),
        { side: "opp", card: o.leader, isLeader: true },
        { side: "own", card: p.leader, isLeader: true },
      ];
      if (pool.length === 0) return illegal("No targets");
      const picked = pool[Math.floor(Math.random() * pool.length)];

      const damage = attacker.atk;
      const counter = picked.isLeader ? 0 : picked.card.atk;

      // Exhaust attacker + apply counter (regen applies)
      const hurtAttacker = (c: BattleCard): BattleCard => {
        const hpA = c.currentHp - counter;
        return { ...c, currentHp: hpA + ((c.regen && counter > 0 && hpA > 0) ? 1 : 0), exhausted: true };
      };
      p = { ...p, board: p.board.map(c => c?.instanceId === attacker.instanceId ? hurtAttacker(c) : c) };
      if (p.leader.instanceId === attacker.instanceId) p = { ...p, leader: hurtAttacker(p.leader) };

      // Apply damage to the random victim
      const hurtTarget = (c: BattleCard): BattleCard => {
        const hpA = c.currentHp - damage;
        return { ...c, currentHp: hpA + ((c.regen && hpA > 0) ? 1 : 0) };
      };
      if (picked.isLeader) {
        if (picked.side === "opp") o = { ...o, leader: { ...o.leader, currentHp: o.leader.currentHp - damage } };
        else                       p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp - damage } };
        events.push({ type: "ATTACK_LEADER", attackerPid: picked.side === "opp" ? pid : opp, attackerId: attacker.instanceId, damage, leaderHpLeft: (picked.side === "opp" ? o : p).leader.currentHp });
      } else {
        if (picked.side === "opp") o = { ...o, board: o.board.map(c => c?.instanceId === picked.card.instanceId ? hurtTarget(c) : c) };
        else                       p = { ...p, board: p.board.map(c => c?.instanceId === picked.card.instanceId ? hurtTarget(c) : c) };
        events.push({ type: "ATTACK_CARD", attackerPid: pid, attackerId: attacker.instanceId, targetId: picked.card.instanceId, damage, counterDamage: counter });
        if (picked.card.currentHp - damage <= 0) events.push({ type: "CARD_DIED", pid: picked.side === "opp" ? opp : pid, instanceId: picked.card.instanceId });
      }
      if (attacker.currentHp - counter <= 0) events.push({ type: "CARD_DIED", pid, instanceId: attacker.instanceId });

      // Clean the dead + domain meter tick
      const clean = (pl: BattlePlayer): BattlePlayer => ({ ...pl, board: pl.board.map(c => (c && c.currentHp <= 0) ? null : c) });
      p = clean(p); o = clean(o);
      p = { ...p, domainMeter: Math.min(100, p.domainMeter + domainGain(p, 7)) };

      let nextState: BattleState = { ...state, players: { ...state.players, [pid]: p, [opp]: o }, pendingAttackerId: null };
      nextState = checkWin(nextState);
      if (nextState.winner) events.push({ type: "GAME_OVER", winner: nextState.winner });
      return { state: nextState, events };
    }

    // ── ATTACK_CARD ───────────────────────────────────────────────────────
    case "ATTACK_CARD": {
      if (!state.pendingAttackerId) return illegal("No attacker selected");
      const attacker = findOnBoard(state.players[pid], state.pendingAttackerId);
      if (!attacker) return illegal("Attacker not found");
      if (!attacker.canAttack || attacker.exhausted) return illegal("Attacker cannot attack");
      // Mahoraga strikes wherever the wheel turns — his attacks are always random
      if (attacker.defId === "mahoraga" || attacker.defId === "mahoraga-entity") {
        return applyBattleIntent({ ...state, pendingAttackerId: null }, { type: "ATTACK_RANDOM", pid, instanceId: attacker.instanceId });
      }

      const target = findOnBoard(state.players[opp], intent.targetInstanceId);
      if (!target) return illegal("Target not found");

      // Shield cards must be targeted first (Toji perk & Maki perk pierce them for board targets)
      const oppShieldCards = boardCards(state.players[opp]).filter(c => c.hasTaunt);
      if (oppShieldCards.length > 0 && !target.hasTaunt && !state.players[pid].tojiBerserk && !attacker.ignoreShields && !attacker.pierceBoardOnly) {
        return illegal("Must target Shield cards first!");
      }

      // Deal damage both ways (counterattack). Naoya perk: half damage but no counter.
      const damage        = attacker.silentStrike ? Math.ceil(attacker.atk / 2) : attacker.atk;
      const counterDamage = target.atk;

      let p = { ...state.players[pid] };
      let o = { ...state.players[opp] };

      // Is target the leader?
      const isLeaderTarget = target.instanceId === o.leader.instanceId;
      const isLeaderAttacker = attacker.instanceId === p.leader.instanceId;

      // Todo perk: redirect the incoming damage to a random card on the attacker's own board
      const redirect = !isLeaderTarget && target.redirectNext === true;
      let redirectVictimId: string | null = null;
      if (redirect) {
        const pool = boardCards(p);
        if (pool.length > 0) redirectVictimId = pool[Math.floor(Math.random() * pool.length)].instanceId;
      }

      // Uro perk: attacks aimed at her damage the attacker instead
      const reflect = !redirect && !isLeaderTarget && (target.reflectTurns ?? 0) > 0;

      // Apply damage to target (skipped if redirected or reflected).
      // Mahoraga perk: recovers 1 HP after surviving a hit.
      const updateTarget = (c: BattleCard): BattleCard => {
        if (redirect) return { ...c, redirectNext: false };
        if (reflect)  return c;
        const hpAfter = c.currentHp - damage;
        return { ...c, currentHp: hpAfter + ((c.regen && hpAfter > 0 && damage > 0) ? 1 : 0) };
      };
      // Apply counter to attacker (Toji never takes counter damage; Naoya's silent strike takes none;
      // a reflected attack sends the full attack damage back instead of a counter)
      const tojiNoCounter = isLeaderAttacker && p.tojiBerserk;
      // Todo's redirect fully absorbs the exchange — the attacker takes no counter damage from him
      const actualCounter = reflect ? damage : (tojiNoCounter || attacker.silentStrike || redirect) ? 0 : counterDamage;
      // Kashimo self-damage: when Kashimo's leader attacks, leader takes kashimoAtk self-damage
      const kashimoSelf = (isLeaderAttacker && p.kashimoPassive) ? p.kashimoAtk : 0;
      const exhaustAttacker = (c: BattleCard): BattleCard => {
        const taken = actualCounter + kashimoSelf;
        const hpAfter = c.currentHp - taken;
        const regenBonus = (c.regen && taken > 0 && hpAfter > 0) ? 1 : 0;
        // Jogo's splash is consumed by this attack
        const base = { ...c, currentHp: hpAfter + regenBonus, splashNext: false };
        if (isLeaderAttacker && p.leaderBonusAttack) return base;
        return { ...base, exhausted: true };
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

      // Apply redirected damage to the random victim on the attacker's side
      if (redirect && redirectVictimId) {
        const victim = p.board.find(c => c?.instanceId === redirectVictimId);
        p = { ...p, board: p.board.map(c => c?.instanceId === redirectVictimId ? { ...c, currentHp: c.currentHp - damage } : c) };
        if (victim && victim.currentHp - damage <= 0) events.push({ type: "CARD_DIED", pid, instanceId: redirectVictimId });
      }

      // Jogo perk: splash 1 damage to every other enemy board card
      if (attacker.splashNext && !redirect && !reflect) {
        o = {
          ...o,
          board: o.board.map(c => {
            if (!c || c.instanceId === target.instanceId) return c;
            const hpA = c.currentHp - 1;
            if (hpA <= 0) events.push({ type: "CARD_DIED", pid: opp, instanceId: c.instanceId });
            return { ...c, currentHp: hpA + ((c.regen && hpA > 0) ? 1 : 0) };
          }),
        };
      }

      // Nobara resonance: if the struck card is pinned, its linked partner takes half the damage
      if (!redirect && !reflect && !isLeaderTarget && p.resonance &&
          (target.instanceId === p.resonance.a || target.instanceId === p.resonance.b)) {
        const otherId = target.instanceId === p.resonance.a ? p.resonance.b : p.resonance.a;
        const echo = Math.ceil(damage / 2);
        const other = o.board.find(c => c?.instanceId === otherId);
        if (other) {
          const hpA = other.currentHp - echo;
          o = { ...o, board: o.board.map(c => c?.instanceId === otherId ? { ...c, currentHp: hpA + ((c.regen && hpA > 0) ? 1 : 0) } : c) };
          if (hpA <= 0) events.push({ type: "CARD_DIED", pid: opp, instanceId: otherId });
        }
        p = { ...p, resonance: null }; // one use
      }

      // Domain meter boost on damage dealt
      p = { ...p, domainMeter: Math.min(100, p.domainMeter + domainGain(p, 7)) };
      o = { ...o, domainMeter: Math.min(100, o.domainMeter + domainGain(o, Math.ceil(damage / 14))) };

      events.push({ type: "ATTACK_CARD", attackerPid: pid, attackerId: attacker.instanceId, targetId: redirect && redirectVictimId ? redirectVictimId : target.instanceId, damage, counterDamage });

      // Remove dead non-leader board cards (Kurourushi perk: respawns as a 2/2)
      const removeDeadBoard = (player: BattlePlayer): BattlePlayer => ({
        ...player,
        board: player.board.map(c => {
          if (!c || c.currentHp > 0) return c;
          if (c.rebirth) {
            // Respawns with half his highest ATK and HP (min 1)
            const rAtk = Math.max(1, Math.floor(c.atk / 2));
            const rHp  = Math.max(1, Math.floor(c.maxHp / 2));
            return {
              ...c, rebirth: false,
              atk: rAtk, baseAtk: rAtk, currentHp: rHp, maxHp: rHp, baseHp: rHp,
              canAttack: false, exhausted: true, stunTurns: 0,
              tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
              perkAtkTurn: 0, ignoreShields: false, silentStrike: false, splashNext: false,
            };
          }
          return null;
        }),
      });
      p = removeDeadBoard(p);
      o = removeDeadBoard(o);
      // Spawn any pending Geto entities after board space may have opened
      p = spawnGetoEntities(p, p.getoEntityAtk, p.getoEntityHp);
      o = spawnGetoEntities(o, o.getoEntityAtk, o.getoEntityHp);

      // Mahoraga adaptation: +1 ATK whenever Mahoraga's HP drops (as target OR as attacker taking counter)
      if (!isLeaderTarget) {
        o = adaptMahoragaIfHit(o, target.instanceId, target.currentHp, target.currentHp - damage);
      }
      if (!isLeaderAttacker) {
        p = adaptMahoragaIfHit(p, attacker.instanceId, attacker.currentHp, attacker.currentHp - actualCounter - kashimoSelf);
      }
      if (attacker.currentHp - actualCounter - kashimoSelf <= 0) events.push({ type: "CARD_DIED", pid, instanceId: attacker.instanceId });
      if (!redirect && target.currentHp - damage <= 0) events.push({ type: "CARD_DIED", pid: opp, instanceId: target.instanceId });

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
      // Mahoraga's attacks are always random
      if (attacker.defId === "mahoraga" || attacker.defId === "mahoraga-entity") {
        return applyBattleIntent({ ...state, pendingAttackerId: null }, { type: "ATTACK_RANDOM", pid, instanceId: attacker.instanceId });
      }
      // Only shield cards protect the leader — clear them first (unless Toji berserk)
      const tauntGuards = boardCards(state.players[opp]).filter(c => c.hasTaunt);
      if (tauntGuards.length > 0 && !state.players[pid].tojiBerserk && !attacker.ignoreShields) return illegal("Defeat all Shield cards before targeting the leader!");

      // Toji's Shield Breaker reaches the leader too, but at half damage
      const damage = attacker.ignoreShields ? Math.ceil(attacker.atk / 2) : attacker.atk;
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
      p = { ...p, domainMeter: Math.min(100, p.domainMeter + domainGain(p, 11)) };
      // Defender comeback boost — getting your leader hit fills your own domain meter
      o = { ...o, domainMeter: Math.min(100, o.domainMeter + domainGain(o, 6 + Math.ceil(damage / 2))) };

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
        domainMeter: Math.min(100, p.domainMeter + domainGain(p, 7)),
      };
      events.push({ type: "CARD_PLAYED", pid, instanceId: card.instanceId, slot: intent.slot });

      return { state: { ...state, players: { ...state.players, [pid]: p } }, events };
    }

    // ── CAST_SPELL ────────────────────────────────────────────────────────
    case "CAST_SPELL": {
      const spell = state.players[pid].spells.find(s => s.id === intent.spellId);
      if (!spell) return illegal("Spell not found");

      // Remove cast spell and pop from queue if available
      const castPlayerBase = state.players[pid];
      const newSpells = castPlayerBase.spells.filter(s => s.id !== intent.spellId);
      const queuedSpell = castPlayerBase.spellQueue.length > 0 ? castPlayerBase.spellQueue[0] : null;
      const newQueue = queuedSpell ? castPlayerBase.spellQueue.slice(1) : castPlayerBase.spellQueue;
      const spellsAfterCast = queuedSpell ? [...newSpells, queuedSpell] : newSpells;
      let p = { ...castPlayerBase, spells: spellsAfterCast, spellQueue: newQueue };
      let o = { ...state.players[opp] };
      const eff = spell.effect;

      switch (eff.kind) {
        case "DAMAGE_TARGET": {
          if (!intent.targetInstanceId) return illegal("Target required for damage spell");
          // Can target any card: enemy board/leader OR own board/leader
          const tgtOpp  = findOnBoard(o, intent.targetInstanceId);
          const tgtSelf = findOnBoard(p, intent.targetInstanceId);
          const tgt = tgtOpp ?? tgtSelf;
          if (!tgt) return illegal("Target not found");
          if (tgtOpp) {
            if (tgt.instanceId === o.leader.instanceId) {
              // Damage spells hit the leader only when the board is clear
              if (boardCards(o).length > 0) return illegal("Damage spells must target board cards first!");
              o = { ...o, leader: { ...o.leader, currentHp: o.leader.currentHp - eff.amount } };
            } else {
              const hpBefore = tgt.currentHp;
              o = { ...o, board: o.board.map(c => c?.instanceId === tgt.instanceId ? { ...c, currentHp: c.currentHp - eff.amount } : c) };
              o = adaptMahoragaIfHit(o, tgt.instanceId, hpBefore, hpBefore - eff.amount);
              o = { ...o, board: o.board.map(c => (c && c.currentHp <= 0) ? null : c) };
            }
          } else {
            if (tgt.instanceId === p.leader.instanceId) {
              if (boardCards(p).length > 0) return illegal("Damage spells must target board cards first!");
              p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp - eff.amount } };
            } else {
              p = { ...p, board: p.board.map(c => c?.instanceId === tgt.instanceId ? { ...c, currentHp: c.currentHp - eff.amount } : c) };
              p = { ...p, board: p.board.map(c => (c && c.currentHp <= 0) ? null : c) };
            }
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
          if (eff.includeLeader) {
            p = { ...p, leader: { ...p.leader, maxHp: p.leader.maxHp + eff.amount, currentHp: p.leader.currentHp + eff.amount } };
          }
          break;
        }
        case "BUFF_ONE_BOTH": {
          if (!intent.targetInstanceId) return illegal("Select one of your cards to buff");
          if (p.leader.instanceId === intent.targetInstanceId) return illegal("Buff spells cannot target the leader — board cards only");
          const bothCard = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!bothCard) return illegal("Target not found on your board");
          p = { ...p, board: p.board.map(c => c?.instanceId === intent.targetInstanceId
            ? { ...c, atk: c.atk + eff.atk, currentHp: c.currentHp + eff.hp, maxHp: c.maxHp + eff.hp }
            : c) };
          break;
        }
        case "DAMAGE_ALL": {
          // Hits every enemy board card AND the enemy leader
          o = {
            ...o,
            leader: { ...o.leader, currentHp: o.leader.currentHp - eff.amount },
            board: o.board.map(c => {
              if (!c) return c;
              const hpA = c.currentHp - eff.amount;
              return { ...c, currentHp: hpA + ((c.regen && hpA > 0) ? 1 : 0) };
            }),
          };
          o = { ...o, board: o.board.map(c => (c && c.currentHp <= 0) ? null : c) };
          break;
        }
        case "DAMAGE_AND_STUN": {
          if (!intent.targetInstanceId) return illegal("Select an enemy board card");
          const dsTgt = o.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!dsTgt) return illegal("Target not on enemy board");
          const hpBeforeDS = dsTgt.currentHp;
          o = { ...o, board: o.board.map(c => c?.instanceId === intent.targetInstanceId
            ? { ...c, currentHp: c.currentHp - eff.amount, stunTurns: Math.max(1, c.stunTurns), canAttack: false }
            : c) };
          o = adaptMahoragaIfHit(o, intent.targetInstanceId, hpBeforeDS, hpBeforeDS - eff.amount);
          o = { ...o, board: o.board.map(c => (c && c.currentHp <= 0) ? null : c) };
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
          if (target.isLeaderCard) return illegal("Destruction effects cannot target leader cards!");
          o = { ...o, board: o.board.map(c => c?.instanceId === intent.targetInstanceId ? null : c) };
          break;
        }
        case "SHEEPIFY_ONE": {
          if (!intent.targetInstanceId) return illegal("Select an enemy board card to sheepify");
          const sheepTgt = o.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!sheepTgt) return illegal("Target not on enemy board");
          if (sheepTgt.isLeaderCard) return illegal("Cannot sheepify the enemy leader");
          if (eff.maxCost !== undefined && sheepTgt.cost > eff.maxCost) return illegal(`Can only sheepify cards costing ${eff.maxCost} or less`);
          const sheepified: BattleCard = {
            ...sheepTgt,
            preSheepAtk: sheepTgt.atk, preSheepHp: sheepTgt.currentHp,
            isSheep: true, atk: 1, baseAtk: 1, currentHp: 1, maxHp: 1,
          };
          o = { ...o, board: o.board.map(c => c?.instanceId === intent.targetInstanceId ? sheepified : c) };
          break;
        }
        case "BEASTIFY_ONE": {
          if (!intent.targetInstanceId) return illegal("Select a board card to beastify");
          const beastOwn = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          const beastOpp = o.board.find(c => c?.instanceId === intent.targetInstanceId);
          const beastTgt = beastOwn ?? beastOpp;
          if (!beastTgt) return illegal("Target not found on any board");
          if (beastTgt.isLeaderCard) return illegal("Cannot beastify a leader card");
          const beastified: BattleCard = {
            ...beastTgt,
            atk: 8, baseAtk: 8, currentHp: 8, maxHp: 8, baseHp: 8,
            beastDecay: true, isSheep: false,
            tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
          };
          if (beastOwn) p = { ...p, board: p.board.map(c => c?.instanceId === intent.targetInstanceId ? beastified : c) };
          else          o = { ...o, board: o.board.map(c => c?.instanceId === intent.targetInstanceId ? beastified : c) };
          break;
        }
        case "BUFF_ONE_HP": {
          if (!intent.targetInstanceId) return illegal("Select one of your cards to buff HP");
          // HP buffs may target the leader; ATK buffs may not
          if (p.leader.instanceId === intent.targetInstanceId) {
            p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp + eff.amount, maxHp: p.leader.maxHp + eff.amount } };
            break;
          }
          const boardCard = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!boardCard) return illegal("Target not found on your board");
          p = { ...p, board: p.board.map(c => c?.instanceId === intent.targetInstanceId ? { ...c, currentHp: c.currentHp + eff.amount, maxHp: c.maxHp + eff.amount } : c) };
          break;
        }
        case "BUFF_ONE_ATK": {
          if (!intent.targetInstanceId) return illegal("Select one of your cards to buff ATK");
          if (p.leader.instanceId === intent.targetInstanceId) return illegal("Buff spells cannot target the leader — board cards only");
          const boardCard2 = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!boardCard2) return illegal("Target not found on your board");
          p = { ...p, board: p.board.map(c => c?.instanceId === intent.targetInstanceId ? { ...c, atk: c.atk + eff.amount } : c) };
          break;
        }
        case "DAMAGE_TARGET_SELF": {
          if (!intent.targetInstanceId) return illegal("Select a target");
          const tgtOppS  = findOnBoard(o, intent.targetInstanceId);
          const tgtSelfS = findOnBoard(p, intent.targetInstanceId);
          const tgtS = tgtOppS ?? tgtSelfS;
          if (!tgtS) return illegal("Target not found");
          if (tgtOppS) {
            if (tgtS.instanceId === o.leader.instanceId) {
              if (boardCards(o).length > 0) return illegal("Damage spells must target board cards first!");
              o = { ...o, leader: { ...o.leader, currentHp: o.leader.currentHp - eff.amount } };
            } else {
              const hpBefore = tgtS.currentHp;
              o = { ...o, board: o.board.map(c => c?.instanceId === tgtS.instanceId ? { ...c, currentHp: c.currentHp - eff.amount } : c) };
              o = adaptMahoragaIfHit(o, tgtS.instanceId, hpBefore, hpBefore - eff.amount);
              o = { ...o, board: o.board.map(c => (c && c.currentHp <= 0) ? null : c) };
            }
          } else {
            if (tgtS.instanceId === p.leader.instanceId) {
              if (boardCards(p).length > 0) return illegal("Damage spells must target board cards first!");
              p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp - eff.amount } };
            } else {
              p = { ...p, board: p.board.map(c => c?.instanceId === tgtS.instanceId ? { ...c, currentHp: c.currentHp - eff.amount } : c) };
              p = { ...p, board: p.board.map(c => (c && c.currentHp <= 0) ? null : c) };
            }
          }
          // Self-damage to caster's leader
          p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp - eff.selfAmount } };
          break;
        }
        case "COPY_BOARD_CARD": {
          if (!intent.targetInstanceId) return illegal("Select a card to copy");
          // Can target any board card (own or enemy)
          const srcOwn = p.board.find(c => c?.instanceId === intent.targetInstanceId);
          const srcOpp = o.board.find(c => c?.instanceId === intent.targetInstanceId);
          const srcCard = srcOwn ?? srcOpp;
          if (!srcCard) return illegal("Target card not found on any board");
          const copySlot = p.board.findIndex(s => s === null);
          if (copySlot === -1) return illegal("Your board is full");
          const copy3: BattleCard = {
            ...srcCard,
            instanceId: `copy3-${srcCard.instanceId}-${++_instanceCounter}`,
            atk: 3, baseAtk: 3,
            currentHp: 3, maxHp: 3, baseHp: 3,
            canAttack: false, exhausted: true,
            tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
            isLeaderCard: false,
            // Copies behave like the real unit — fresh perk, no leftover perk state
            perkUsed: false,
            redirectNext: false, ignoreShields: false, perkAtkTurn: 0,
            splashNext: false, pierceBoardOnly: false, reflectTurns: 0,
            silentStrike: false, regen: false, rebirth: false,
          };
          const nb = [...p.board] as BattlePlayer["board"];
          nb[copySlot] = copy3;
          p = { ...p, board: nb };
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
      const activationCount = p0.domainActivationCount;
      const isSecond = activationCount >= 1;
      const effectToApply = (isSecond && domainDef.secondEffect) ? domainDef.secondEffect : domainDef.effect;

      let nextState = applyDomainEffect(state, pid, effectToApply, activationCount);

      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [pid]: {
            ...nextState.players[pid],
            domainMeter:   0,
            domainActive:  true,
            domainCooldown: 4,
            domainActivationCount: activationCount + 1,
          },
        },
      };

      events.push({ type: "DOMAIN_ACTIVATED", pid, name: domainDef.name, effect: effectToApply });
      nextState = checkWin(nextState);
      if (nextState.winner) events.push({ type: "GAME_OVER", winner: nextState.winner });
      return { state: nextState, events };
    }

    // ── DRAW_SYNERGY_SPELL ────────────────────────────────────────────────
    case "DRAW_SYNERGY_SPELL": {
      let p = { ...state.players[pid] };
      if (p.synergyDrawUsed && !p.unlimitedSpellDraw) return illegal("Synergy draw already used this turn");
      if (p.energy < 1) return illegal("Not enough energy (need 1)");
      if (p.spellPool.length === 0) return illegal("No spells left in pool");
      // Pick random spell from pool and remove it
      const poolIdx = Math.floor(Math.random() * p.spellPool.length);
      const drawnSpell = p.spellPool[poolIdx];
      const newPool = p.spellPool.filter((_, i) => i !== poolIdx);
      p = addSpell({ ...p, energy: p.energy - 1, spellPool: newPool, synergyDrawUsed: true }, drawnSpell);
      events.push({ type: "SPELL_CAST", pid, spellId: drawnSpell.id, synergyId: drawnSpell.synergyId });
      return { state: { ...state, players: { ...state.players, [pid]: p } }, events };
    }

    // ── GRANT_BOARD_SHIELD ────────────────────────────────────────────────
    case "GRANT_BOARD_SHIELD": {
      let p = { ...state.players[pid] };
      if (p.shieldCharges <= 0) return illegal("No shield charges remaining");
      const cardIdx = p.board.findIndex(c => c?.instanceId === intent.targetInstanceId);
      if (cardIdx === -1) return illegal("Card not found on board");
      const card = p.board[cardIdx]!;
      const newBoard = [...p.board] as BattlePlayer["board"];
      newBoard[cardIdx] = { ...card, hasTaunt: true };
      p = { ...p, board: newBoard, shieldCharges: p.shieldCharges - 1 };
      return { state: { ...state, players: { ...state.players, [pid]: p } }, events };
    }

    // ── ACTIVATE_PERK ─────────────────────────────────────────────────────
    case "ACTIVATE_PERK": {
      let p = { ...state.players[pid] };
      let o = { ...state.players[opp] };
      const cardIdx = p.board.findIndex(c => c?.instanceId === intent.instanceId);
      if (cardIdx === -1) return illegal("Card not on board");
      const card = p.board[cardIdx]!;
      if (card.perkUsed) return illegal("Perk already used");
      if (!CARD_PERKS[card.defId]) return illegal("Card has no perk");

      const setCard = (player: BattlePlayer, idx: number, patch: Partial<BattleCard>): BattlePlayer => {
        const nb = [...player.board] as BattlePlayer["board"];
        nb[idx] = { ...nb[idx]!, ...patch };
        return { ...player, board: nb };
      };

      switch (card.defId) {
        case "mechamaru": {
          p = setCard(p, cardIdx, { perkUsed: true });
          p = summonEntity(p, "robot-entity", "Robot", 2, 2, true);
          break;
        }
        case "geto": {
          p = setCard(p, cardIdx, { perkUsed: true });
          p = summonEntity(p, "geto-entity", "Cursed Spirit", 1, 2, true);  // Shield spirit 1/2
          p = summonEntity(p, "geto-entity", "Cursed Spirit", 2, 1, false); // normal spirit 2/1
          break;
        }
        case "todo": {
          p = setCard(p, cardIdx, { perkUsed: true, redirectNext: true });
          break;
        }
        case "toji": {
          p = setCard(p, cardIdx, { perkUsed: true, ignoreShields: true });
          break;
        }
        case "yuji":
        case "choso": {
          p = setCard(p, cardIdx, { perkUsed: true, atk: card.atk + 2, perkAtkTurn: (card.perkAtkTurn ?? 0) + 2 });
          break;
        }
        case "mahito": {
          if (!intent.targetInstanceId || !intent.friendlyTargetInstanceId) return illegal("Perk needs targets");
          const enemyIdx = o.board.findIndex(c => c?.instanceId === intent.targetInstanceId);
          if (enemyIdx === -1) return illegal("Enemy target not found");
          const friendIdx = p.board.findIndex(c => c?.instanceId === intent.friendlyTargetInstanceId);
          if (friendIdx === -1) return illegal("Friendly target not found");
          const enemyCard = o.board[enemyIdx]!;
          const friendCard = p.board[friendIdx]!;
          if (enemyCard.cost !== friendCard.cost) return illegal("Cards must have the same cost");
          events.push({ type: "CARD_DIED", pid: opp, instanceId: enemyCard.instanceId });
          events.push({ type: "CARD_DIED", pid, instanceId: friendCard.instanceId });
          const ob = [...o.board] as BattlePlayer["board"]; ob[enemyIdx] = null;
          o = { ...o, board: ob };
          const pb = [...p.board] as BattlePlayer["board"]; pb[friendIdx] = null;
          p = { ...p, board: pb };
          // Mark Mahito used (his slot may have shifted only if he was the destroyed friendly card)
          const mIdx = p.board.findIndex(c => c?.instanceId === intent.instanceId);
          if (mIdx !== -1) p = setCard(p, mIdx, { perkUsed: true });
          break;
        }
        case "megumi": {
          if (p.leader.defId === "mahoraga") {
            p = setCard(p, cardIdx, { perkUsed: true });
            p = summonEntity(p, "nue-entity", "Nue", 2, 2, false);
            break;
          }
          // Megumi dies in both branches
          events.push({ type: "CARD_DIED", pid, instanceId: card.instanceId });
          // If the real Mahoraga card is in hand or deck, summon it — no leader damage
          const handIdx = p.hand.findIndex(c => c.defId === "mahoraga");
          const deckIdx = handIdx === -1 ? p.deck.findIndex(c => c.defId === "mahoraga") : -1;
          if (handIdx !== -1 || deckIdx !== -1) {
            const mahoCard = handIdx !== -1 ? p.hand[handIdx] : p.deck[deckIdx];
            if (handIdx !== -1) p = { ...p, hand: p.hand.filter((_, i) => i !== handIdx) };
            else                p = { ...p, deck: p.deck.filter((_, i) => i !== deckIdx) };
            const nbM = [...p.board] as BattlePlayer["board"];
            nbM[cardIdx] = { ...mahoCard, canAttack: false, exhausted: true };
            p = { ...p, board: nbM };
          } else {
            // No Mahoraga card owned — summon the entity; Megumi dies and the leader takes 5
            p = { ...p, leader: { ...p.leader, currentHp: p.leader.currentHp - 5 } };
            const nbM = [...p.board] as BattlePlayer["board"];
            nbM[cardIdx] = null;
            p = { ...p, board: nbM };
            p = summonEntity(p, "mahoraga-entity", "Mahoraga", 7, 7, false);
          }
          break;
        }
        case "dagon": {
          p = setCard(p, cardIdx, { perkUsed: true });
          p = summonEntity(p, "fish-entity", "Fish", 1, 1, false);
          p = summonEntity(p, "fish-entity", "Fish", 1, 1, false);
          break;
        }
        case "takaba": {
          p = setCard(p, cardIdx, { perkUsed: true });
          p = addSpell(p, {
            id: `spell-takaba-perk-${++_instanceCounter}`,
            synergyId: "takaba-perk",
            name: "Comedy Gold",
            description: "Turn an enemy card costing 3 or less into a 1/1 sheep",
            effect: { kind: "SHEEPIFY_ONE", maxCost: 3 },
          });
          break;
        }
        case "inumaki": {
          if (!intent.targetInstanceId) return illegal("Perk needs an enemy target");
          const stunIdx = o.board.findIndex(c => c?.instanceId === intent.targetInstanceId);
          if (stunIdx === -1) return illegal("Enemy target not found");
          const ob2 = [...o.board] as BattlePlayer["board"];
          ob2[stunIdx] = { ...ob2[stunIdx]!, stunTurns: Math.max(1, ob2[stunIdx]!.stunTurns), canAttack: false };
          o = { ...o, board: ob2 };
          // Inumaki's throat gives out — he becomes a 1/1
          p = setCard(p, cardIdx, { perkUsed: true, atk: 1, baseAtk: 1, currentHp: 1, maxHp: 1, baseHp: 1 });
          break;
        }
        case "jogo": {
          p = setCard(p, cardIdx, { perkUsed: true, splashNext: true });
          break;
        }
        case "maki": {
          p = setCard(p, cardIdx, { perkUsed: true, atk: card.atk + 2, pierceBoardOnly: true });
          break;
        }
        case "kashimo": {
          p = setCard(p, cardIdx, { perkUsed: true, atk: card.atk + 3, currentHp: 1 });
          break;
        }
        case "uro": {
          p = setCard(p, cardIdx, { perkUsed: true, reflectTurns: 2 });
          break;
        }
        case "gakuganji": {
          if (!intent.friendlyTargetInstanceId) return illegal("Perk needs a friendly target");
          const buffIdx = p.board.findIndex(c => c?.instanceId === intent.friendlyTargetInstanceId);
          if (buffIdx === -1) return illegal("Friendly target not found");
          p = setCard(p, buffIdx, { atk: p.board[buffIdx]!.atk + 1 });
          const gIdx = p.board.findIndex(c => c?.instanceId === intent.instanceId);
          if (gIdx !== -1) p = setCard(p, gIdx, { perkUsed: true });
          break;
        }
        case "mahoraga": {
          p = setCard(p, cardIdx, { perkUsed: true, regen: true });
          break;
        }
        case "hakari": {
          p = setCard(p, cardIdx, { perkUsed: true });
          const rule = BATTLE_SYNERGY_RULES[Math.floor(Math.random() * BATTLE_SYNERGY_RULES.length)];
          p = addSpell(p, {
            id: `spell-hakari-perk-${++_instanceCounter}`,
            synergyId: rule.id,
            name: rule.spellName,
            description: rule.spellDesc,
            effect: rule.spell,
          });
          break;
        }
        case "naoya": {
          p = setCard(p, cardIdx, { perkUsed: true, silentStrike: true });
          break;
        }
        case "kurourushi": {
          p = setCard(p, cardIdx, { perkUsed: true, rebirth: true });
          break;
        }
        case "nanami": {
          p = setCard(p, cardIdx, { perkUsed: true, atk: card.atk + 2, perkAtkTurn: (card.perkAtkTurn ?? 0) + 2 });
          break;
        }
        case "nobara": {
          if (!intent.targetInstanceId || !intent.secondTargetInstanceId) return illegal("Perk needs two enemy targets");
          if (intent.targetInstanceId === intent.secondTargetInstanceId) return illegal("Pick two different enemy cards");
          const aCard = o.board.find(c => c?.instanceId === intent.targetInstanceId);
          const bCard = o.board.find(c => c?.instanceId === intent.secondTargetInstanceId);
          if (!aCard || !bCard) return illegal("Enemy targets not found");
          p = setCard(p, cardIdx, { perkUsed: true });
          p = { ...p, resonance: { a: aCard.instanceId, b: bCard.instanceId } };
          break;
        }
        default:
          return illegal("Perk not implemented");
      }

      let nextState: BattleState = { ...state, players: { ...state.players, [pid]: p, [opp]: o } };
      nextState = checkWin(nextState);
      if (nextState.winner) events.push({ type: "GAME_OVER", winner: nextState.winner });
      return { state: nextState, events };
    }

    // ── END_TURN ──────────────────────────────────────────────────────────
    case "END_TURN": {
      events.push({ type: "TURN_END", pid });

      // Expire this-turn perk effects (Toji shield pierce, Yuji/Choso/Nanami +2 ATK, Naoya silent strike)
      const endingPlayer: BattlePlayer = {
        ...state.players[pid],
        unlimitedSpellDraw: false,
        board: state.players[pid].board.map(c => {
          if (!c) return c;
          if (!c.ignoreShields && !(c.perkAtkTurn && c.perkAtkTurn > 0) && !c.silentStrike) return c;
          return { ...c, ignoreShields: false, silentStrike: false, atk: c.atk - (c.perkAtkTurn ?? 0), perkAtkTurn: 0 };
        }) as BattlePlayer["board"],
      };

      const nextPid = opp;
      const nextTurn = pid === "P2" ? state.turn + 1 : state.turn;

      const midState: BattleState = {
        ...state,
        players: { ...state.players, [pid]: endingPlayer },
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
        case "SHEEPIFY_ENEMY_CARDS": {
          const tgt = state.players[opp].board.find(c => c?.instanceId === intent.targetInstanceId);
          if (!tgt) return illegal("Target not found on enemy board");
          if (tgt.isLeaderCard) return illegal("Cannot sheepify the enemy leader");
          const sheepified: BattleCard = {
            ...tgt,
            preSheepAtk: tgt.atk,
            preSheepHp: tgt.currentHp,
            isSheep: true,
            atk: 1, baseAtk: 1,
            currentHp: 1, maxHp: 1,
          };
          let o2 = { ...state.players[opp], board: state.players[opp].board.map(c => c?.instanceId === tgt.instanceId ? sheepified : c) };
          const remaining = pda.remaining - 1;
          const nextPda = remaining > 0 ? { ...pda, remaining } : null;
          events.push({ type: "DOMAIN_TARGET_DONE", pid });
          return { state: { ...state, players: { ...state.players, [opp]: o2 }, pendingDomainAction: nextPda }, events };
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
