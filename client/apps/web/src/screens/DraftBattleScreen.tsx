import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef, PlayerId } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import type { Profile } from "../profiles";
import { BATTLE_SYNERGY_RULES, DOMAIN_BATTLE_EFFECTS, deriveStats } from "../battleEngine";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PlayerDraftResult {
  leaderId: string;
  combatIds: string[];   // 2 drafted
  supportIds: string[];  // 3 drafted
  extraIds: string[];    // 5 random-affinity drafted
  weaponIds: string[];
}

// Pick specs: first 5 typed, next 5 any-affinity
type PickSpec =
  | { kind: "TYPED"; affinity: "COMBAT" | "SUPPORT"; label: string; nth: string }
  | { kind: "RANDOM"; label: string };

const PICK_SPECS: PickSpec[] = [
  { kind: "TYPED", affinity: "COMBAT",  label: "Combat Card",  nth: "1st" },
  { kind: "TYPED", affinity: "COMBAT",  label: "Combat Card",  nth: "2nd" },
  { kind: "TYPED", affinity: "SUPPORT", label: "Support Card", nth: "1st" },
  { kind: "TYPED", affinity: "SUPPORT", label: "Support Card", nth: "2nd" },
  { kind: "TYPED", affinity: "SUPPORT", label: "Support Card", nth: "3rd" },
  { kind: "RANDOM", label: "Free Pick" },
  { kind: "RANDOM", label: "Free Pick" },
  { kind: "RANDOM", label: "Free Pick" },
  { kind: "RANDOM", label: "Free Pick" },
  { kind: "RANDOM", label: "Free Pick" },
  { kind: "RANDOM", label: "Free Pick" },
  { kind: "RANDOM", label: "Free Pick" },
];

const PLAYER_COLOR: Record<PlayerId, string> = { P1: "#4a9eff", P2: "#ff6666" };
const PLAYER_LABEL: Record<PlayerId, string>  = { P1: "PLAYER 1", P2: "PLAYER 2" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getLeaderOptions(cardDb: Record<string, CardDef>): string[] {
  return shuffle(
    Object.entries(cardDb)
      .filter(([, def]) => ["SSS", "X"].includes(def.rarity))
      .map(([id]) => id)
  ).slice(0, 3);
}

function getTypedOptions(cardDb: Record<string, CardDef>, affinity: "COMBAT" | "SUPPORT", exclude: string[]): string[] {
  return shuffle(
    Object.entries(cardDb)
      .filter(([id, def]) => def.affinity === affinity && !exclude.includes(id))
      .map(([id]) => id)
  ).slice(0, 3);
}

function getRandomOptions(cardDb: Record<string, CardDef>, exclude: string[]): string[] {
  return shuffle(
    Object.entries(cardDb)
      // Include X rarity regardless of affinity (they're normally LEADER affinity, but appear in random picks)
      .filter(([id, def]) => (def.affinity !== "LEADER" || def.rarity === "X") && !exclude.includes(id))
      .map(([id]) => id)
  ).slice(0, 3);
}

// ── Synergy progress panel ─────────────────────────────────────────────────────
function SpellTooltip({ rule, active, mouseX, mouseY }: { rule: typeof BATTLE_SYNERGY_RULES[0]; active: boolean; mouseX: number; mouseY: number }) {
  const accentColor = active ? "#44ff88" : "#ffcc00";
  return createPortal(
    <div style={{
      position: "fixed", left: Math.max(8, mouseX - 262), top: Math.max(8, mouseY - 76),
      width: 240, padding: "12px 14px", borderRadius: 12, zIndex: 9999, pointerEvents: "none",
      background: "rgba(6,6,18,0.98)", border: `1px solid ${accentColor}66`,
      boxShadow: `0 6px 28px rgba(0,0,0,0.75), 0 0 16px ${accentColor}33`,
    }}>
      <div style={{ fontSize: 9, color: accentColor, letterSpacing: 3, fontWeight: 900, marginBottom: 6 }}>
        {active ? "✦ SPELL UNLOCKED" : "◆ SPELL REWARD"}
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 5 }}>{rule.spellName}</div>
      <div style={{ fontSize: 11, color: "#ccd", lineHeight: 1.55 }}>{rule.spellDesc}</div>
    </div>,
    document.body
  );
}

function SynergyTracker({ pickedIds, cardDb }: { pickedIds: string[]; cardDb: Record<string, CardDef> }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const defs = pickedIds.map(id => cardDb[id]).filter(Boolean);
  const activeSynergies = BATTLE_SYNERGY_RULES.filter(rule => {
    const count = defs.filter(def => rule.tags.every(t => (def?.tags ?? []).includes(t))).length;
    return count >= rule.minCount;
  });
  const progressSynergies = BATTLE_SYNERGY_RULES.filter(rule => {
    const count = defs.filter(def => rule.tags.every(t => (def?.tags ?? []).includes(t))).length;
    return count > 0 && count < rule.minCount;
  });
  if (activeSynergies.length === 0 && progressSynergies.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {activeSynergies.map(rule => (
        <div key={rule.id}
          style={{
            padding: "8px 10px", borderRadius: 8, cursor: "default", position: "relative",
            background: hoveredId === rule.id ? "rgba(100,255,150,0.18)" : "rgba(100,255,150,0.10)",
            border: `1px solid ${hoveredId === rule.id ? "#44ff88bb" : "#44ff8866"}`,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { setHoveredId(rule.id); setMouseX(e.clientX); setMouseY(e.clientY); }}
          onMouseMove={(e) => { setMouseX(e.clientX); setMouseY(e.clientY); }}
          onMouseLeave={() => setHoveredId(null)}
        >
          {hoveredId === rule.id && <SpellTooltip rule={rule} active={true} mouseX={mouseX} mouseY={mouseY} />}
          <div style={{ fontSize: 13, fontWeight: 900, color: "#44ff88", letterSpacing: 0.5 }}>✦ {rule.label}</div>
          <div style={{ fontSize: 11, color: "#44ff88aa", marginTop: 4 }}>→ {rule.spellName}</div>
        </div>
      ))}
      {progressSynergies.map(rule => {
        const count = defs.filter(def => rule.tags.every(t => (def?.tags ?? []).includes(t))).length;
        return (
          <div key={rule.id}
            style={{
              padding: "8px 10px", borderRadius: 8, cursor: "default", position: "relative",
              background: hoveredId === rule.id ? "rgba(255,200,50,0.14)" : "rgba(255,200,50,0.07)",
              border: `1px solid ${hoveredId === rule.id ? "#ffcc0088" : "#ffcc0044"}`,
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { setHoveredId(rule.id); setMouseX(e.clientX); setMouseY(e.clientY); }}
            onMouseMove={(e) => { setMouseX(e.clientX); setMouseY(e.clientY); }}
            onMouseLeave={() => setHoveredId(null)}
          >
            {hoveredId === rule.id && <SpellTooltip rule={rule} active={false} mouseX={mouseX} mouseY={mouseY} />}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#ffcc00cc", letterSpacing: 0.5 }}>{rule.label}</div>
              <div style={{
                fontSize: 13, fontWeight: 900, color: "#ffcc00",
                background: "rgba(255,200,50,0.15)", borderRadius: 6,
                padding: "1px 8px", letterSpacing: 0,
              }}>{count}/{rule.minCount}</div>
            </div>
            <div style={{ fontSize: 11, color: "#ffcc0077", marginTop: 4 }}>→ {rule.spellName}</div>
          </div>
        );
      })}
    </div>
  );
}

// Badges on pick cards indicating which synergies this card would help
function getSynergyBadges(def: CardDef, pickedIds: string[], cardDb: Record<string, CardDef>): { label: string; activates: boolean }[] {
  const pickedDefs = pickedIds.map(id => cardDb[id]).filter(Boolean);
  return BATTLE_SYNERGY_RULES.flatMap(rule => {
    const cardContributes = rule.tags.every(t => (def?.tags ?? []).includes(t));
    if (!cardContributes) return [];
    const currentCount = pickedDefs.filter(d => rule.tags.every(t => (d?.tags ?? []).includes(t))).length;
    const wouldActivate = currentCount + 1 >= rule.minCount;
    const alreadyActive = currentCount >= rule.minCount;
    if (alreadyActive) return [];
    return [{ label: rule.label, activates: wouldActivate }];
  });
}

// ── Domain effect human-readable description ─────────────────────────────────
function domainEffectDesc(defId: string): { name: string; desc: string } {
  // Toji has no traditional domain — describe his passive
  if (defId === "toji") return {
    name: "Heavenly Restriction",
    desc: "Passive: 1 ATK. Can attack any card on the board, never takes counter damage. Domain meter fills → grants Toji Strike (4 damage). Fills again → another Toji Strike.",
  };
  const d = DOMAIN_BATTLE_EFFECTS[defId];
  if (!d) return { name: "Cursed Technique", desc: "Buffs own board cards." };
  const e = d.effect;
  let desc = "";
  const bonusSpellSuffix = defId === "gojo-base"
    ? " Grants Hollow Purple (deal 5 damage to any enemy), +5 energy, and unlimited GET SPELL this turn. Filling meter twice gives 2 Hollow Purples."
    : d.grantSpell ? ` Also grants "${d.grantSpell.name}" — ${d.grantSpell.desc}.` : "";
  const secondSuffix = d.secondEffect
    ? (() => {
        const s = d.secondEffect;
        if (s.kind === "GRANT_SPELL") return ` 2nd fill: gains "${s.spellName}" — ${s.spellDesc}.`;
        if (s.kind === "BUFF_LEADER_PERMANENT") return ` 2nd fill: leader gains +${s.atk} ATK / +${s.hp} HP permanently.`;
        if (s.kind === "SHEEPIFY_ENEMY_LEADER") return " 2nd fill: enemy leader becomes a 1/7 sheep.";
        if (s.kind === "SUMMON_RIKA_AND_COPY") return " 2nd fill: summon Rika (5/5) again.";
        if (s.kind === "STUN_ENEMY_BOARD") return ` 2nd fill: stun enemy board again.`;
        if (s.kind === "SPAWN_ENTITIES") return ` 2nd fill: spawns ${s.count}× ${s.atk}/${s.hp} entity.`;
        if (s.kind === "GRANT_RANDOM_SPELLS") return ` 2nd fill: grants ${s.count} more random spells.`;
        if (s.kind === "SHEEPIFY_ENEMY_CARDS") return ` 2nd fill: choose ${s.count} more enemy cards to sheepify.`;
        return " 2nd fill: activates a secondary effect.";
      })()
    : "";
  switch (e.kind) {
    case "STUN_ENEMY_BOARD":       desc = `Fully immobilizes enemy for ${e.turns} turn${e.turns > 1 ? "s" : ""} (no actions allowed).`; break;
    case "DAMAGE_ALL_ENEMIES":     desc = `Deals ${e.amount} damage split across all enemies.`; break;
    case "BUFF_OWN_BOARD":         desc = `Gives own board +${e.atkBonus} ATK / +${e.hpBonus} HP for ${e.turns} turn${e.turns > 1 ? "s" : ""}.`; break;
    case "HEAL_LEADER":            desc = `Restores ${e.amount} HP to your leader.`; break;
    case "DRAW_CARDS":             desc = `Draw ${e.count} extra card${e.count > 1 ? "s" : ""}.`; break;
    case "REDUCE_COSTS":           desc = `All cards cost ${e.amount} less for ${e.turns} turn${e.turns > 1 ? "s" : ""}.`; break;
    case "KILL_ALL_BOARD":         desc = "Destroys all non-leader cards on both sides."; break;
    case "SPAWN_ENTITIES":         desc = `Spawns ${e.count}× ${e.atk}/${e.hp} Cursed Spirits on your board.`; break;
    case "GRANT_RANDOM_SPELLS":    desc = `Grants ${e.count} random synergy spells.`; break;
    case "PERMANENT_LEADER_ATK":   desc = `Leader gains +${e.atk} permanent ATK. Counter ${e.counterDmg} dmg whenever attacked.`; break;
    case "CHOOSE_KILL_ENEMIES":    desc = `Choose ${e.count} enemy board cards to instantly destroy.`; break;
    case "COPY_ENEMY_CARD":        desc = "Copy one enemy board card (−1 ATK, −1 HP) onto your board."; break;
    case "HEAL_AND_KILL_ONE":      desc = `Heal your leader for ${e.healAmount} HP, then destroy one enemy card.`; break;
    case "SHEEPIFY_BOARD":         desc = "All board cards become 1/1 sheep."; break;
    case "SHEEPIFY_ENEMY_CARDS":   desc = `Choose ${e.count} enemy board cards to turn into 1/1 sheep.`; break;
    case "SNEAK_ATTACK_DOMAIN":    desc = `Deal ${e.amount} damage to any target — no counter damage.`; break;
    case "GRANT_SPELL":            desc = `Grants spell: "${e.spellName}" — ${e.spellDesc}.`; break;
    case "BUFF_LEADER_PERMANENT":  desc = e.atk > 0 && e.hp > 0
      ? `Leader gains +${e.atk} ATK / +${e.hp} HP permanently.`
      : e.atk > 0 ? `Leader gains +${e.atk} ATK permanently.`
      : `Leader gains +${e.hp} HP permanently.`; break;
    case "SUKUNA_BOARD_MODE":      desc = "Wipes all board cards. Sukuna enters the board as a 4/17 playing card — always targetable. Leader death ends the match."; break;
    case "MAHORAGA_BOARD_MODE":    desc = "Mahoraga enters the board as a 1/25 card. Each hit he receives gives him +1 ATK (adaptation). Leader card death ends the match."; break;
    case "BUFF_LEADER_PERMANENT":  desc = `Permanently grants your leader +${e.atk} ATK / +${e.hp} HP.`; break;
    case "SHEEPIFY_ENEMY_LEADER":  desc = "Transforms the enemy leader into a 1/7 sheep."; break;
    case "SUMMON_RIKA_AND_COPY":   desc = "Summons Rika Orimoto (5/5 Cursed Spirit) onto your board. Grants Cursed Copy spell — place a 3/3 copy of any board card."; break;
    default:                       desc = "Activates a powerful cursed technique.";
  }
  return { name: d.name, desc: desc + bonusSpellSuffix + secondSuffix };
}

// ── Small corner checkmark on selected card ───────────────────────────────────
function SelectedBadge() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        position: "absolute", top: 7, right: 7, zIndex: 5,
        width: 26, height: 26, borderRadius: "50%",
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(8px)",
        border: "1.5px solid rgba(255,255,255,0.40)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: "rgba(255,255,255,0.92)", fontWeight: 900,
        boxShadow: "0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
        pointerEvents: "none",
      }}
    >✓</motion.div>
  );
}

// ── Leader pick ───────────────────────────────────────────────────────────────
function LeaderPickPhase({ pid, profile, color, options, cardDb, onPick }: {
  pid: PlayerId; profile: Profile; color: string;
  options: string[]; cardDb: Record<string, CardDef>; onPick: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 8 }}>
          <div style={{ borderRadius: 8, border: `2px solid ${color}66`, overflow: "hidden" }}>
            <PlayerIcon icon={profile.icon} size={36} style={{ display: "block" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{profile.name}</div>
            <div style={{ fontSize: 9, color: color, letterSpacing: 3 }}>{PLAYER_LABEL[pid]}</div>
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 4, color: "#fff", marginBottom: 4 }}>
          CHOOSE YOUR LEADER
        </div>
        <div style={{ fontSize: 10, color: "#556", letterSpacing: 2 }}>
          Your leader anchors your deck · Their domain activates mid-battle
        </div>
      </div>

      <div style={{ display: "flex", gap: 52, alignItems: "flex-start" }}>
        {options.map((id) => {
          const def = cardDb[id];
          if (!def) return null;
          const isSelected = selected === id;
          const domain = domainEffectDesc(id);
          return (
            <motion.div key={id} onClick={() => setSelected(id)}
              whileHover={{ y: -10, scale: 1.04 }} whileTap={{ scale: 0.97 }}
              style={{ cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
            >
              <div style={{ transform: "scale(1.25)", transformOrigin: "top center", position: "relative" }}>
                <CharacterCard defId={id} def={def} size="lg" hideAffinityAndCost />
                {isSelected && <SelectedBadge />}
              </div>
              <div style={{ textAlign: "center", width: 160, paddingTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? "#fff" : "#aaa" }}>{def.name}</div>
                <div style={{ fontSize: 8, color: isSelected ? color : "#334", letterSpacing: 2, marginTop: 3 }}>
                  {isSelected ? "✓ SELECTED" : "LEADER"}
                </div>
                {/* Domain info panel */}
                <div style={{
                  marginTop: 8, padding: "12px 12px", borderRadius: 10,
                  background: "rgba(102,0,170,0.2)", border: "1px solid #9933cc55",
                  textAlign: "left", boxShadow: "0 2px 14px rgba(102,0,170,0.18)",
                }}>
                  <div style={{ fontSize: 9, color: "#cc44ff", letterSpacing: 2, fontWeight: 900, marginBottom: 5 }}>
                    ✦ DOMAIN
                  </div>
                  <div style={{ fontSize: 13, color: "#fff", fontWeight: 800, marginBottom: 6, lineHeight: 1.25 }}>{domain.name}</div>
                  <div style={{ fontSize: 11, color: "#ddd", lineHeight: 1.55 }}>{domain.desc}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.button
        whileHover={selected ? { scale: 1.05, y: -2 } : {}} whileTap={selected ? { scale: 0.97 } : {}}
        onClick={() => { if (selected) onPick(selected); }}
        style={{
          padding: "13px 56px",
          background: selected ? `linear-gradient(135deg, ${color}cc, ${color})` : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected ? color : "#2a2a3a"}`, borderRadius: 12,
          color: selected ? "#000" : "#334",
          fontSize: 13, fontWeight: 900, letterSpacing: 6,
          cursor: selected ? "pointer" : "default", fontFamily: "inherit",
          boxShadow: selected ? `0 0 32px ${color}55` : "none",
        }}
      >CONFIRM LEADER</motion.button>
    </motion.div>
  );
}

// ── Card draft pick ───────────────────────────────────────────────────────────
function CardDraftPhase({ pid, profile, color, pickIndex, options, cardDb, pickedSoFar, leaderId, onPick }: {
  pid: PlayerId; profile: Profile; color: string;
  pickIndex: number; options: string[]; cardDb: Record<string, CardDef>;
  pickedSoFar: string[]; leaderId: string; onPick: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const spec = PICK_SPECS[pickIndex];
  const isRandom = spec.kind === "RANDOM";
  const affinityColor = spec.kind === "TYPED"
    ? (spec.affinity === "COMBAT" ? "#ff6644" : "#44aaff")
    : "#bb88ff";

  return (
    <motion.div
      key={pickIndex}
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 10 }}>
          <div style={{ borderRadius: 6, overflow: "hidden", border: `2px solid ${color}55` }}>
            <PlayerIcon icon={profile.icon} size={28} style={{ display: "block" }} />
          </div>
          <span style={{ fontSize: 11, color: color, letterSpacing: 3, fontWeight: 700 }}>{profile.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 8 }}>
          <div style={{
            padding: "3px 10px", borderRadius: 6,
            background: `${affinityColor}22`, border: `1px solid ${affinityColor}55`,
            fontSize: 9, fontWeight: 900, letterSpacing: 3, color: affinityColor,
          }}>
            {isRandom ? "FREE PICK" : (spec as { kind: "TYPED"; affinity: string }).affinity}
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, color: "#fff", marginBottom: 4 }}>
          {isRandom ? `PICK ANY CARD. CURRENT PICK: ${pickIndex + 1}` : `PICK YOUR ${(spec as { kind: "TYPED"; affinity: string }).affinity} CARD`}
        </div>
        <div style={{ fontSize: 9, color: "#445", letterSpacing: 2 }}>Pick {pickIndex + 1} of {PICK_SPECS.length}</div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 14 }}>
          {PICK_SPECS.map((s, i) => {
            const dotColor = s.kind === "TYPED"
              ? (s.affinity === "COMBAT" ? "#ff6644" : "#44aaff")
              : "#bb88ff";
            return (
              <div key={i} style={{
                width: i === pickIndex ? 20 : 8, height: 8, borderRadius: 4,
                background: i < pickIndex ? dotColor : i === pickIndex ? color : "#1e1e2e",
                transition: "all 0.3s",
                boxShadow: i === pickIndex ? `0 0 8px ${color}` : i < pickIndex ? `0 0 4px ${dotColor}66` : "none",
              }} />
            );
          })}
        </div>
      </div>

      {/* Cards + synergy tracker */}
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* Cards */}
        <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
          {options.map((id) => {
            const def = cardDb[id];
            if (!def) return null;
            const isSelected = selected === id;
            const badges = getSynergyBadges(def, pickedSoFar, cardDb);
            const rawStats = deriveStats(def);
            // Leader affinity cards only show 2/30 during the leader pick phase (before leaderId is set).
            // Once a leader is chosen, these cards appear as normal free picks with their real rarity stats.
            const stats = (def.affinity === "LEADER" && !leaderId) ? { atk: 2, hp: 30, cost: rawStats.cost } : rawStats;
            return (
              <motion.div key={id}
                onClick={() => setSelected(id === selected ? null : id)}
                onDoubleClick={() => { setSelected(id); onPick(id); }}
                whileHover={{ y: -10, scale: 1.05 }} whileTap={{ scale: 0.97 }}
                style={{ cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
              >
                <div style={{ transform: "scale(1.2)", transformOrigin: "top center", position: "relative", marginBottom: 50 }}>
                  <CharacterCard defId={id} def={def} size="lg" showStats={stats} />
                  {isSelected && <SelectedBadge />}
                </div>

                {/* Synergy badges */}
                {badges.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center", marginTop: 4 }}>
                    {badges.map(b => (
                      <div key={b.label} style={{
                        fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 6, letterSpacing: 0.5,
                        background: b.activates ? "rgba(68,255,136,0.15)" : "rgba(255,200,50,0.12)",
                        border: `1px solid ${b.activates ? "#44ff88aa" : "#ffcc0077"}`,
                        color: b.activates ? "#44ff88" : "#ffcc00",
                        boxShadow: b.activates ? "0 0 8px #44ff8833" : "0 0 8px #ffcc0022",
                        whiteSpace: "nowrap",
                      }}>
                        {b.activates ? "✦ " : "◆ "}{b.label}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>


      <motion.button
        whileHover={selected ? { scale: 1.05, y: -2 } : {}} whileTap={selected ? { scale: 0.97 } : {}}
        onClick={() => { if (selected) onPick(selected); }}
        style={{
          marginTop: 50,
          padding: "12px 52px",
          background: selected ? `linear-gradient(135deg, ${color}cc, ${color})` : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected ? color : "#2a2a3a"}`, borderRadius: 12,
          color: selected ? "#000" : "#334",
          fontSize: 12, fontWeight: 900, letterSpacing: 6,
          cursor: selected ? "pointer" : "default", fontFamily: "inherit",
          boxShadow: selected ? `0 0 28px ${color}55` : "none",
        }}
      >PICK CARD</motion.button>
    </motion.div>
  );
}

// ── Player handoff ─────────────────────────────────────────────────────────────
function PlayerHandoff({ nextPlayer, profile, color, onReady }: {
  nextPlayer: PlayerId; profile: Profile; color: string; onReady: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}
    >
      <div style={{ borderRadius: 14, overflow: "hidden", border: `2px solid ${color}55` }}>
        <PlayerIcon icon={profile.icon} size={80} style={{ display: "block" }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: color, letterSpacing: 5, marginBottom: 6 }}>{PLAYER_LABEL[nextPlayer]}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{profile.name}, your turn</div>
        <div style={{ fontSize: 10, color: "#556", letterSpacing: 2 }}>Hand the device over · Press ready when set</div>
      </div>
      <motion.button
        whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.97 }}
        onClick={onReady}
        style={{
          padding: "14px 56px",
          background: `linear-gradient(135deg, ${color}aa, ${color})`,
          border: "none", borderRadius: 12,
          color: "#000", fontSize: 14, fontWeight: 900, letterSpacing: 6,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: `0 0 40px ${color}55`,
        }}
      >I'M READY</motion.button>
    </motion.div>
  );
}

// ── Draft complete splash ─────────────────────────────────────────────────────
function DraftCompleteSplash({ p1Profile, p2Profile, onStartBattle }: {
  p1Profile: Profile; p2Profile: Profile; onStartBattle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, textAlign: "center" }}
    >
      <motion.div
        animate={{ textShadow: ["0 0 40px #ff990088", "0 0 80px #ff9900cc", "0 0 40px #ff990088"] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        style={{ fontSize: 48, fontWeight: 900, letterSpacing: 4, color: "#ff9900" }}
      >DECKS READY</motion.div>

      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        {/* P1 */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            borderRadius: "50%", border: "3px solid #4a9eff",
            overflow: "hidden", width: 72, height: 72, margin: "0 auto 10px",
            boxShadow: "0 0 28px #4a9eff55",
          }}>
            <PlayerIcon icon={p1Profile.icon} size={72} style={{ display: "block" }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{p1Profile.name}</div>
          <div style={{ fontSize: 9, color: "#4a9eff", letterSpacing: 3, marginTop: 2 }}>PLAYER 1</div>
        </div>

        {/* VS */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], textShadow: ["0 0 20px #ff333388", "0 0 40px #ff3333cc", "0 0 20px #ff333388"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ fontSize: 38, fontWeight: 900, color: "#ff3333", lineHeight: 1 }}
        >VS</motion.div>

        {/* P2 */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            borderRadius: "50%", border: "3px solid #ff6666",
            overflow: "hidden", width: 72, height: 72, margin: "0 auto 10px",
            boxShadow: "0 0 28px #ff666655",
          }}>
            <PlayerIcon icon={p2Profile.icon} size={72} style={{ display: "block" }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{p2Profile.name}</div>
          <div style={{ fontSize: 9, color: "#ff6666", letterSpacing: 3, marginTop: 2 }}>PLAYER 2</div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#445", letterSpacing: 2 }}>
        11-card decks ready · 4 card starting hand · Draw every turn
      </div>

      <motion.button
        whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.97 }}
        onClick={onStartBattle}
        style={{
          padding: "14px 64px",
          background: "linear-gradient(135deg, #cc4400, #ff6600)",
          border: "none", borderRadius: 12,
          color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: 6,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 0 40px #ff660055",
        }}
      >BEGIN BATTLE</motion.button>
    </motion.div>
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
export default function DraftBattleScreen({
  cardDb, p1Profile, p2Profile, onBack, onBattleStart,
}: {
  cardDb: Record<string, CardDef>;
  p1Profile: Profile;
  p2Profile: Profile;
  onBack: () => void;
  onBattleStart: (p1: PlayerDraftResult, p2: PlayerDraftResult) => void;
}) {
  type Phase =
    | { step: "HANDOFF_P1" }
    | { step: "LEADER_PICK"; pid: PlayerId }
    | { step: "CARD_DRAFT"; pid: PlayerId; pickIndex: number }
    | { step: "HANDOFF_P2" }
    | { step: "DONE" };

  const [phase, setPhase] = useState<Phase>({ step: "HANDOFF_P1" });
  const [p1Draft, setP1Draft] = useState<Partial<PlayerDraftResult>>({});
  const [p2Draft, setP2Draft] = useState<Partial<PlayerDraftResult>>({});
  const [leaderOptions, setLeaderOptions] = useState<string[]>(() => getLeaderOptions(cardDb));
  const [cardOptions, setCardOptions]     = useState<string[]>([]);

  const getDraft  = (pid: PlayerId) => pid === "P1" ? p1Draft : p2Draft;
  const setDraft  = (pid: PlayerId, update: Partial<PlayerDraftResult>) =>
    pid === "P1" ? setP1Draft(d => ({ ...d, ...update })) : setP2Draft(d => ({ ...d, ...update }));
  const getProfile = (pid: PlayerId) => pid === "P1" ? p1Profile : p2Profile;

  const getAllPicked = (draft: Partial<PlayerDraftResult>) =>
    [draft.leaderId ?? "", ...(draft.combatIds ?? []), ...(draft.supportIds ?? []), ...(draft.extraIds ?? [])].filter(Boolean);

  const getNextOptions = (draft: Partial<PlayerDraftResult>, nextIndex: number) => {
    const exclude = getAllPicked(draft);
    const spec = PICK_SPECS[nextIndex];
    if (!spec) return [];
    return spec.kind === "TYPED"
      ? getTypedOptions(cardDb, spec.affinity, exclude)
      : getRandomOptions(cardDb, exclude);
  };

  const applyPick = (pid: PlayerId, id: string, pickIndex: number): Partial<PlayerDraftResult> => {
    const spec = PICK_SPECS[pickIndex];
    const current = getDraft(pid);
    if (spec.kind === "TYPED" && spec.affinity === "COMBAT")
      return { combatIds: [...(current.combatIds ?? []), id] };
    if (spec.kind === "TYPED" && spec.affinity === "SUPPORT")
      return { supportIds: [...(current.supportIds ?? []), id] };
    return { extraIds: [...(current.extraIds ?? []), id] };
  };

  const startPlayerDraft = (pid: PlayerId) => {
    setLeaderOptions(getLeaderOptions(cardDb));
    setPhase({ step: "LEADER_PICK", pid });
  };

  const phaseLabel = useMemo(() => {
    if (phase.step === "LEADER_PICK") return "LEADER PICK";
    if (phase.step === "CARD_DRAFT")  return `PICK ${phase.pickIndex + 1}/${PICK_SPECS.length}`;
    return null;
  }, [phase]);

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,0.80)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <button onClick={onBack} style={{
        position: "fixed", top: 18, left: 18, zIndex: 10,
        padding: "7px 16px", background: "rgba(255,255,255,0.04)",
        border: "1px solid #2a2a3a", borderRadius: 8,
        color: "#556", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit",
      }}>← BACK</button>

      {phaseLabel && (
        <div style={{ position: "fixed", top: 18, right: 18, zIndex: 10, fontSize: 9, color: "#334", letterSpacing: 3 }}>
          QUICK DRAFT · {phaseLabel}
        </div>
      )}

      {/* ── LEFT PANEL — fixed overlay, does not affect page layout ── */}
      <AnimatePresence>
        {phase.step === "CARD_DRAFT" && (() => {
          const { pid } = phase;
          const draft = getDraft(pid);
          const leaderId = draft.leaderId ?? "";
          const leaderDef = cardDb[leaderId];
          const leaderDomain = leaderId ? domainEffectDesc(leaderId) : null;
          const pickedSoFar = getAllPicked(draft).filter(Boolean).slice(1);
          const color = PLAYER_COLOR[pid];
          return (
            <motion.div
              key="side-panel"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              style={{
                position: "fixed", left: 150, top: 100, bottom: 100, width: 380, zIndex: 5,
                display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12,
                padding: "140px 18px 24px",
                background: "rgba(4,4,12,0.92)", border: `1px solid ${color}22`, borderRadius: 14,
                backdropFilter: "blur(12px)",
                boxShadow: `0 8px 40px rgba(0,0,0,0.6)`,
                overflowY: "auto",
              }}
            >
              {leaderDef && leaderDomain ? (
                <>
                  <div style={{ fontSize: 7, color, letterSpacing: 3, fontWeight: 900, textAlign: "center" }}>YOUR LEADER</div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ transform: "scale(1.0)", transformOrigin: "top center", marginBottom: 4 }}>
                      <CharacterCard defId={leaderId} def={leaderDef} size="sm" noHover hideAffinityAndCost />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", textAlign: "center", letterSpacing: 0.5 }}>{leaderDef.name}</div>
                  <div style={{
                    width: "100%", padding: "10px 10px", borderRadius: 10,
                    background: "rgba(102,0,170,0.18)", border: "1px solid #9933cc44",
                  }}>
                    <div style={{ fontSize: 9, color: "#cc44ff", letterSpacing: 2, fontWeight: 900, marginBottom: 5 }}>✦ DOMAIN</div>
                    <div style={{ fontSize: 13, color: "#fff", fontWeight: 800, marginBottom: 6, lineHeight: 1.25 }}>{leaderDomain.name}</div>
                    <div style={{ fontSize: 11, color: "#ddd", lineHeight: 1.55, fontWeight: 500 }}>{leaderDomain.desc}</div>
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0" }} />
                </>
              ) : (
                <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, textAlign: "center", padding: "8px 0" }}>NO LEADER YET</div>
              )}
              <div style={{ fontSize: 7, color: "#334", letterSpacing: 3, textAlign: "center", fontWeight: 700 }}>
                DECK ({pickedSoFar.length}/{PICK_SPECS.length})
              </div>
              {pickedSoFar.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-start" }}>
                  {pickedSoFar.map(cid => {
                    const d = cardDb[cid];
                    return d ? (
                      <div key={cid} style={{ transform: "scale(0.65)", transformOrigin: "top left", width: 62, height: 80, flexShrink: 0, overflow: "visible" }}>
                        <CharacterCard defId={cid} def={d} size="sm" noHover />
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 8, color: "#222", textAlign: "center", padding: "6px 0" }}>—</div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── RIGHT PANEL — synergy tracker, fixed overlay ── */}
      <AnimatePresence>
        {phase.step === "CARD_DRAFT" && (() => {
          const { pid } = phase;
          const draft = getDraft(pid);
          const pickedSoFar = getAllPicked(draft).filter(Boolean).slice(1);
          const color = PLAYER_COLOR[pid];
          if (pickedSoFar.length === 0) return null;
          return (
            <motion.div
              key="right-panel"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              style={{
                position: "fixed", right: 150, top: 100, bottom: 100, width: 264, zIndex: 5,
                display: "flex", flexDirection: "column", gap: 10,
                padding: "180px 16px 24px",
                background: "rgba(4,4,12,0.92)", border: `1px solid ${color}22`, borderRadius: 14,
                backdropFilter: "blur(12px)",
                boxShadow: `0 8px 40px rgba(0,0,0,0.6)`,
                overflowY: "auto",
              }}
            >
              <div style={{ fontSize: 10, color: "#667", letterSpacing: 4, fontWeight: 800, textAlign: "center", paddingBottom: 2, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>SYNERGIES</div>
              <SynergyTracker pickedIds={pickedSoFar} cardDb={cardDb} />
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── MAIN CONTENT — centered on full page ── */}
      <div style={{
        position: "relative", zIndex: 3,
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "60px 40px",
      }}>
        <AnimatePresence mode="wait">

          {phase.step === "HANDOFF_P1" && (
            <PlayerHandoff key="handoff-p1" nextPlayer="P1" profile={p1Profile}
              color={PLAYER_COLOR.P1} onReady={() => startPlayerDraft("P1")} />
          )}

          {phase.step === "LEADER_PICK" && (
            <LeaderPickPhase key="leader" pid={phase.pid}
              profile={getProfile(phase.pid)} color={PLAYER_COLOR[phase.pid]}
              options={leaderOptions} cardDb={cardDb}
              onPick={(id) => {
                setDraft(phase.pid, { leaderId: id, combatIds: [], supportIds: [], extraIds: [] });
                setCardOptions(getTypedOptions(cardDb, "COMBAT", [id]));
                setPhase({ step: "CARD_DRAFT", pid: phase.pid, pickIndex: 0 });
              }}
            />
          )}

          {phase.step === "CARD_DRAFT" && (() => {
            const { pid, pickIndex } = phase;
            const draft = getDraft(pid);
            const pickedSoFar = getAllPicked(draft).filter(Boolean).slice(1); // exclude leader
            return (
              <CardDraftPhase key={`draft-${pid}-${pickIndex}`}
                pid={pid} profile={getProfile(pid)} color={PLAYER_COLOR[pid]}
                pickIndex={pickIndex} options={cardOptions}
                cardDb={cardDb} pickedSoFar={pickedSoFar}
                leaderId={getDraft(pid).leaderId ?? ""}
                onPick={(id) => {
                  const update = applyPick(pid, id, pickIndex);
                  setDraft(pid, update);
                  const nextIndex = pickIndex + 1;
                  if (nextIndex < PICK_SPECS.length) {
                    // Build merged draft for exclusion list
                    const merged = { ...getDraft(pid), ...update };
                    setCardOptions(getNextOptions(merged, nextIndex));
                    setPhase({ step: "CARD_DRAFT", pid, pickIndex: nextIndex });
                  } else {
                    // Skip weapon selection — weapons not used in Quick Draft
                    setDraft(pid, { weaponIds: [] });
                    if (pid === "P1") setPhase({ step: "HANDOFF_P2" });
                    else              setPhase({ step: "DONE" });
                  }
                }}
              />
            );
          })()}

          {phase.step === "HANDOFF_P2" && (
            <PlayerHandoff key="handoff-p2" nextPlayer="P2" profile={p2Profile}
              color={PLAYER_COLOR.P2} onReady={() => startPlayerDraft("P2")} />
          )}

          {phase.step === "DONE" && (
            <DraftCompleteSplash key="done"
              p1Profile={p1Profile} p2Profile={p2Profile}
              onStartBattle={() => onBattleStart(p1Draft as PlayerDraftResult, p2Draft as PlayerDraftResult)}
            />
          )}

        </AnimatePresence>
      </div>{/* end main content */}
    </div>
  );
}
