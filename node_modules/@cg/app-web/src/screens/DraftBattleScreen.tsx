import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef, PlayerId } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { ROULETTE_ITEM_MAP } from "@cg/engine";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import { rc } from "../helpers";
import type { Profile } from "../profiles";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PlayerDraftResult {
  leaderId: string;
  combatIds: string[];   // 2 cards
  supportIds: string[];  // 3 cards
  weaponIds: string[];   // 2 weapons
}

type DraftStage =
  | { kind: "LEADER_PICK" }
  | { kind: "CARD_DRAFT"; pickIndex: number }   // 0-4, alternates C/S/C/S/S
  | { kind: "EQUIPMENT" };

// Pick order: C C S S S  (fills 2 combat + 3 support)
const PICK_AFFINITY: Array<"COMBAT" | "SUPPORT"> = ["COMBAT", "COMBAT", "SUPPORT", "SUPPORT", "SUPPORT"];
const PICK_LABELS = ["1st Combat", "2nd Combat", "1st Support", "2nd Support", "3rd Support"];

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
  const leaders = Object.entries(cardDb)
    .filter(([, def]) => def.affinity === "LEADER")
    .map(([id]) => id);
  return shuffle(leaders).slice(0, 3);
}

function getCardOptions(
  cardDb: Record<string, CardDef>,
  affinity: "COMBAT" | "SUPPORT",
  exclude: string[],
): string[] {
  const pool = Object.entries(cardDb)
    .filter(([id, def]) => def.affinity === affinity && !exclude.includes(id))
    .map(([id]) => id);
  return shuffle(pool).slice(0, 3);
}

function getWeaponPool(exclude: string[]): string[] {
  const all = Object.keys(ROULETTE_ITEM_MAP).filter(id => !exclude.includes(id));
  return shuffle(all).slice(0, 5);
}

// ── Rarity color helper ───────────────────────────────────────────────────────
function RarityBadge({ rarity }: { rarity: string }) {
  return (
    <div style={{
      position: "absolute", top: 6, right: 6,
      fontSize: 9, fontWeight: 900, letterSpacing: 2,
      background: rc(rarity), color: "#000",
      padding: "2px 7px", borderRadius: 4,
      boxShadow: `0 0 8px ${rc(rarity)}88`,
    }}>{rarity}</div>
  );
}

// ── Leader pick phase ─────────────────────────────────────────────────────────
function LeaderPickPhase({
  pid, profile, color, options, cardDb, onPick,
}: {
  pid: PlayerId; profile: Profile; color: string;
  options: string[]; cardDb: Record<string, CardDef>; onPick: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}
    >
      {/* Player header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 6 }}>
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
        <div style={{ fontSize: 10, color: "#667", letterSpacing: 2 }}>
          Your leader's domain unlocks mid-battle · Determines your starting synergy
        </div>
      </div>

      {/* Three leader cards */}
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        {options.map((id) => {
          const def = cardDb[id];
          if (!def) return null;
          const isSelected = selected === id;
          return (
            <motion.div
              key={id}
              onClick={() => setSelected(id)}
              whileHover={{ y: -8, scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{
                cursor: "pointer", position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              }}
            >
              {/* Selection ring */}
              <motion.div
                animate={isSelected
                  ? { boxShadow: [`0 0 0 3px ${color}, 0 0 40px ${color}88`, `0 0 0 3px ${color}, 0 0 60px ${color}cc`] }
                  : { boxShadow: "0 0 0 0px transparent" }}
                transition={isSelected ? { duration: 1, repeat: Infinity, repeatType: "reverse" } : {}}
                style={{ borderRadius: 14, position: "relative" }}
              >
                <div style={{ transform: "scale(1.25)", transformOrigin: "top center" }}>
                  <CharacterCard defId={id} def={def} size="lg" />
                </div>
                <RarityBadge rarity={def.rarity} />
              </motion.div>

              {/* Leader info */}
              <div style={{ textAlign: "center", width: 130 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? "#fff" : "#aaa" }}>{def.name}</div>
                <div style={{ fontSize: 8, color: isSelected ? color : "#445", letterSpacing: 2, marginTop: 2 }}>
                  {isSelected ? "✓ SELECTED" : "CLICK TO SELECT"}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Confirm */}
      <motion.button
        whileHover={selected ? { scale: 1.05, y: -2 } : {}}
        whileTap={selected ? { scale: 0.97 } : {}}
        onClick={() => { if (selected) onPick(selected); }}
        style={{
          padding: "13px 56px",
          background: selected ? `linear-gradient(135deg, ${color}cc, ${color})` : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected ? color : "#2a2a3a"}`,
          borderRadius: 12, color: selected ? "#000" : "#334",
          fontSize: 13, fontWeight: 900, letterSpacing: 6,
          cursor: selected ? "pointer" : "default", fontFamily: "inherit",
          boxShadow: selected ? `0 0 32px ${color}55` : "none",
        }}
      >CONFIRM LEADER</motion.button>
    </motion.div>
  );
}

// ── Card draft phase ──────────────────────────────────────────────────────────
function CardDraftPhase({
  pid, profile, color, pickIndex, options, cardDb, pickedSoFar, onPick,
}: {
  pid: PlayerId; profile: Profile; color: string;
  pickIndex: number; options: string[]; cardDb: Record<string, CardDef>;
  pickedSoFar: string[]; onPick: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const affinity = PICK_AFFINITY[pickIndex];
  const label = PICK_LABELS[pickIndex];

  return (
    <motion.div
      key={pickIndex}
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          <PlayerIcon icon={profile.icon} size={28} style={{ display: "block", borderRadius: 6, border: `2px solid ${color}55`, overflow: "hidden" }} />
          <span style={{ fontSize: 11, color: color, letterSpacing: 3, fontWeight: 700 }}>{profile.name}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, color: "#fff", marginBottom: 4 }}>
          PICK YOUR {affinity} CARD
        </div>
        <div style={{ fontSize: 9, color: "#556", letterSpacing: 2 }}>
          {label} · {pickIndex + 1} of 5
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          {PICK_AFFINITY.map((aff, i) => (
            <div key={i} style={{
              width: i < pickIndex ? 24 : 8, height: 8, borderRadius: 4,
              background: i < pickIndex
                ? (aff === "COMBAT" ? "#4a9eff" : "#ff9922")
                : i === pickIndex ? color : "#2a2a3a",
              transition: "all 0.3s",
              boxShadow: i === pickIndex ? `0 0 8px ${color}` : "none",
            }} />
          ))}
        </div>
      </div>

      {/* Three card options */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {options.map((id) => {
          const def = cardDb[id];
          if (!def) return null;
          const isSelected = selected === id;
          return (
            <motion.div
              key={id}
              onClick={() => setSelected(id)}
              whileHover={{ y: -8, scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{ cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
            >
              <motion.div
                animate={isSelected ? { boxShadow: [`0 0 0 3px ${color}, 0 0 40px ${color}88`] } : { boxShadow: "none" }}
                style={{ borderRadius: 14, position: "relative" }}
              >
                <div style={{ transform: "scale(1.2)", transformOrigin: "top center" }}>
                  <CharacterCard defId={id} def={def} size="lg" />
                </div>
                <RarityBadge rarity={def.rarity} />
              </motion.div>
              <div style={{ textAlign: "center", width: 130 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#fff" : "#aaa" }}>{def.name}</div>
                <div style={{ fontSize: 8, color: isSelected ? color : "#445", letterSpacing: 2, marginTop: 2 }}>
                  {isSelected ? "✓ SELECTED" : def.affinity}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Already picked preview */}
      {pickedSoFar.length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#445", letterSpacing: 2, marginRight: 4 }}>PICKED:</span>
          {pickedSoFar.map(id => {
            const def = cardDb[id];
            return def ? (
              <div key={id} style={{ transform: "scale(0.6)", transformOrigin: "left center" }}>
                <CharacterCard defId={id} def={def} size="sm" />
              </div>
            ) : null;
          })}
        </div>
      )}

      <motion.button
        whileHover={selected ? { scale: 1.05, y: -2 } : {}}
        whileTap={selected ? { scale: 0.97 } : {}}
        onClick={() => { if (selected) onPick(selected); setSelected(null); }}
        style={{
          padding: "12px 52px",
          background: selected ? `linear-gradient(135deg, ${color}cc, ${color})` : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected ? color : "#2a2a3a"}`,
          borderRadius: 12, color: selected ? "#000" : "#334",
          fontSize: 12, fontWeight: 900, letterSpacing: 6,
          cursor: selected ? "pointer" : "default", fontFamily: "inherit",
          boxShadow: selected ? `0 0 28px ${color}55` : "none",
        }}
      >PICK CARD</motion.button>
    </motion.div>
  );
}

// ── Equipment phase ───────────────────────────────────────────────────────────
function EquipmentPhase({
  pid, profile, color, weaponPool, leaderId, combatIds, supportIds, cardDb, onPick,
}: {
  pid: PlayerId; profile: Profile; color: string;
  weaponPool: string[]; leaderId: string;
  combatIds: string[]; supportIds: string[]; cardDb: Record<string, CardDef>;
  onPick: (weaponIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id)
      : prev.length < 2   ? [...prev, id]
      : prev
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          <PlayerIcon icon={profile.icon} size={28} style={{ display: "block", borderRadius: 6, border: `2px solid ${color}55`, overflow: "hidden" }} />
          <span style={{ fontSize: 11, color: color, letterSpacing: 3, fontWeight: 700 }}>{profile.name}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, color: "#fff", marginBottom: 4 }}>
          EQUIP YOUR CURSED TOOLS
        </div>
        <div style={{ fontSize: 9, color: "#556", letterSpacing: 2 }}>
          Choose 2 weapons · {selected.length}/2 selected
        </div>
      </div>

      {/* Deck summary */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 540 }}>
        {[leaderId, ...combatIds, ...supportIds].map(id => {
          const def = cardDb[id];
          return def ? (
            <div key={id} style={{ transform: "scale(0.65)", transformOrigin: "center center" }}>
              <CharacterCard defId={id} def={def} size="sm" />
            </div>
          ) : null;
        })}
      </div>

      {/* Weapon pool */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
        {weaponPool.map((id) => {
          const weapon = ROULETTE_ITEM_MAP[id];
          if (!weapon) return null;
          const isSelected = selected.includes(id);
          const isDisabled = !isSelected && selected.length >= 2;
          return (
            <motion.div
              key={id}
              onClick={() => { if (!isDisabled) toggle(id); }}
              whileHover={!isDisabled ? { y: -4, scale: 1.04 } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              style={{
                width: 160, padding: "16px 18px", borderRadius: 12,
                background: isSelected ? `rgba(${color === "#4a9eff" ? "20,50,100" : "100,30,30"},0.6)` : "rgba(10,10,22,0.88)",
                border: `2px solid ${isSelected ? color : isDisabled ? "#1a1a2a" : color + "33"}`,
                cursor: isDisabled ? "default" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
                boxShadow: isSelected ? `0 0 24px ${color}44` : "none",
                textAlign: "center", position: "relative",
              }}
            >
              {isSelected && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  width: 16, height: 16, borderRadius: "50%",
                  background: color, fontSize: 9, fontWeight: 900, color: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✓</div>
              )}
              <div style={{ fontSize: 24, marginBottom: 8 }}>⚔</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#fff" : "#ccc", marginBottom: 4 }}>
                {weapon.name}
              </div>
              <div style={{ fontSize: 9, color: "#44ff88", fontWeight: 700 }}>
                +{weapon.baseBonus.toLocaleString()} base
              </div>
              {weapon.conditionalDesc && (
                <div style={{ fontSize: 8, color: "#667", marginTop: 3 }}>{weapon.conditionalDesc}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.button
        whileHover={selected.length === 2 ? { scale: 1.05, y: -2 } : {}}
        whileTap={selected.length === 2 ? { scale: 0.97 } : {}}
        onClick={() => { if (selected.length === 2) onPick(selected); }}
        style={{
          padding: "13px 56px",
          background: selected.length === 2 ? `linear-gradient(135deg, ${color}cc, ${color})` : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected.length === 2 ? color : "#2a2a3a"}`,
          borderRadius: 12, color: selected.length === 2 ? "#000" : "#334",
          fontSize: 13, fontWeight: 900, letterSpacing: 6,
          cursor: selected.length === 2 ? "pointer" : "default", fontFamily: "inherit",
          boxShadow: selected.length === 2 ? `0 0 32px ${color}55` : "none",
        }}
      >CONFIRM LOADOUT</motion.button>
    </motion.div>
  );
}

// ── Handoff screen between players ───────────────────────────────────────────
function PlayerHandoff({ nextPlayer, profile, color, onReady }: {
  nextPlayer: PlayerId; profile: Profile; color: string; onReady: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}
    >
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}33, transparent)`,
        border: `3px solid ${color}66`,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        <PlayerIcon icon={profile.icon} size={72} style={{ display: "block" }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: color, letterSpacing: 5, marginBottom: 6 }}>{PLAYER_LABEL[nextPlayer]}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
          {profile.name}, your turn
        </div>
        <div style={{ fontSize: 10, color: "#556", letterSpacing: 2 }}>
          Hand the device over · Press ready when set
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.05, y: -3 }}
        whileTap={{ scale: 0.97 }}
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
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, textAlign: "center" }}
    >
      <motion.div
        animate={{ textShadow: ["0 0 40px #ff990088", "0 0 80px #ff9900cc", "0 0 40px #ff990088"] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        style={{ fontSize: 48, fontWeight: 900, letterSpacing: 4, color: "#ff9900" }}
      >
        DECKS READY
      </motion.div>

      <div style={{ display: "flex", gap: 48, alignItems: "center" }}>
        {([["P1", p1Profile, "#4a9eff"], ["P2", p2Profile, "#ff6666"]] as const).map(([pid, prof, clr]) => (
          <div key={pid} style={{ textAlign: "center" }}>
            <div style={{
              borderRadius: "50%", border: `3px solid ${clr}`,
              overflow: "hidden", width: 64, height: 64, margin: "0 auto 10px",
              boxShadow: `0 0 24px ${clr}55`,
            }}>
              <PlayerIcon icon={prof.icon} size={64} style={{ display: "block" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{prof.name}</div>
            <div style={{ fontSize: 9, color: clr, letterSpacing: 3, marginTop: 2 }}>READY</div>
          </div>
        ))}

        <div style={{ fontSize: 32, color: "#ff3333", fontWeight: 900 }}>VS</div>
      </div>

      <div style={{ fontSize: 10, color: "#556", letterSpacing: 2 }}>
        Battle system coming soon · Your drafts have been saved
      </div>

      <motion.button
        whileHover={{ scale: 1.05, y: -3 }}
        whileTap={{ scale: 0.97 }}
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
    | { step: "EQUIPMENT"; pid: PlayerId }
    | { step: "HANDOFF_P2" }
    | { step: "DONE" };

  const [phase, setPhase] = useState<Phase>({ step: "HANDOFF_P1" });

  // Draft state per player
  const [p1Draft, setP1Draft] = useState<Partial<PlayerDraftResult>>({});
  const [p2Draft, setP2Draft] = useState<Partial<PlayerDraftResult>>({});

  // Card pick options — regenerated each pick
  const [leaderOptions, setLeaderOptions] = useState<string[]>(() => getLeaderOptions(cardDb));
  const [cardOptions, setCardOptions]     = useState<string[]>([]);
  const [weaponPool, setWeaponPool]       = useState<string[]>([]);

  const getDraft = (pid: PlayerId) => pid === "P1" ? p1Draft : p2Draft;
  const setDraft = (pid: PlayerId, update: Partial<PlayerDraftResult>) =>
    pid === "P1" ? setP1Draft(d => ({ ...d, ...update })) : setP2Draft(d => ({ ...d, ...update }));

  const getProfile = (pid: PlayerId) => pid === "P1" ? p1Profile : p2Profile;
  const getColor   = (pid: PlayerId) => PLAYER_COLOR[pid];

  const startPlayerDraft = (pid: PlayerId) => {
    setLeaderOptions(getLeaderOptions(cardDb));
    setPhase({ step: "LEADER_PICK", pid });
  };

  const advanceAfterEquipment = (pid: PlayerId) => {
    if (pid === "P1") {
      setPhase({ step: "HANDOFF_P2" });
    } else {
      setPhase({ step: "DONE" });
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      backgroundImage: BG.home,
      backgroundSize: "cover",
      backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,0.78)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      {/* Back */}
      <button
        onClick={onBack}
        style={{
          position: "fixed", top: 18, left: 18, zIndex: 10,
          padding: "7px 16px", background: "rgba(255,255,255,0.04)",
          border: "1px solid #2a2a3a", borderRadius: 8,
          color: "#556", cursor: "pointer", fontSize: 11,
          letterSpacing: 2, fontFamily: "inherit",
        }}
      >← BACK</button>

      {/* Phase label */}
      {phase.step !== "DONE" && phase.step !== "HANDOFF_P1" && phase.step !== "HANDOFF_P2" && (
        <div style={{
          position: "fixed", top: 18, right: 18, zIndex: 10,
          fontSize: 9, color: "#445", letterSpacing: 3,
        }}>
          DRAFT BATTLE · {
            phase.step === "LEADER_PICK" ? "LEADER PICK" :
            phase.step === "CARD_DRAFT"  ? `PICK ${phase.pickIndex + 1}/5` :
            "EQUIPMENT"
          }
        </div>
      )}

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 3,
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "60px 40px",
      }}>
        <AnimatePresence mode="wait">

          {phase.step === "HANDOFF_P1" && (
            <PlayerHandoff
              key="handoff-p1"
              nextPlayer="P1"
              profile={p1Profile}
              color={PLAYER_COLOR.P1}
              onReady={() => startPlayerDraft("P1")}
            />
          )}

          {phase.step === "LEADER_PICK" && (
            <LeaderPickPhase
              key="leader"
              pid={phase.pid}
              profile={getProfile(phase.pid)}
              color={getColor(phase.pid)}
              options={leaderOptions}
              cardDb={cardDb}
              onPick={(id) => {
                setDraft(phase.pid, { leaderId: id, combatIds: [], supportIds: [] });
                const affinity = PICK_AFFINITY[0];
                const exclude = [id];
                setCardOptions(getCardOptions(cardDb, affinity, exclude));
                setPhase({ step: "CARD_DRAFT", pid: phase.pid, pickIndex: 0 });
              }}
            />
          )}

          {phase.step === "CARD_DRAFT" && (() => {
            const { pid, pickIndex } = phase;
            const draft = getDraft(pid);
            const picked = [...(draft.combatIds ?? []), ...(draft.supportIds ?? [])];
            return (
              <CardDraftPhase
                key={`draft-${pickIndex}`}
                pid={pid}
                profile={getProfile(pid)}
                color={getColor(pid)}
                pickIndex={pickIndex}
                options={cardOptions}
                cardDb={cardDb}
                pickedSoFar={picked}
                onPick={(id) => {
                  const affinity = PICK_AFFINITY[pickIndex];
                  const newDraft = { ...getDraft(pid) };
                  if (affinity === "COMBAT") {
                    newDraft.combatIds = [...(newDraft.combatIds ?? []), id];
                  } else {
                    newDraft.supportIds = [...(newDraft.supportIds ?? []), id];
                  }
                  setDraft(pid, newDraft);

                  const nextIndex = pickIndex + 1;
                  if (nextIndex < PICK_AFFINITY.length) {
                    const nextAff = PICK_AFFINITY[nextIndex];
                    const allPicked = [
                      newDraft.leaderId ?? "",
                      ...(newDraft.combatIds ?? []),
                      ...(newDraft.supportIds ?? []),
                      id,
                    ];
                    setCardOptions(getCardOptions(cardDb, nextAff, allPicked));
                    setPhase({ step: "CARD_DRAFT", pid, pickIndex: nextIndex });
                  } else {
                    // Move to equipment
                    const allPicked = [
                      newDraft.leaderId ?? "",
                      ...(newDraft.combatIds ?? []),
                      ...(newDraft.supportIds ?? []),
                    ];
                    setWeaponPool(getWeaponPool([]));
                    setPhase({ step: "EQUIPMENT", pid });
                  }
                }}
              />
            );
          })()}

          {phase.step === "EQUIPMENT" && (() => {
            const { pid } = phase;
            const draft = getDraft(pid);
            return (
              <EquipmentPhase
                key="equipment"
                pid={pid}
                profile={getProfile(pid)}
                color={getColor(pid)}
                weaponPool={weaponPool}
                leaderId={draft.leaderId ?? ""}
                combatIds={draft.combatIds ?? []}
                supportIds={draft.supportIds ?? []}
                cardDb={cardDb}
                onPick={(weaponIds) => {
                  setDraft(pid, { weaponIds });
                  advanceAfterEquipment(pid);
                }}
              />
            );
          })()}

          {phase.step === "HANDOFF_P2" && (
            <PlayerHandoff
              key="handoff-p2"
              nextPlayer="P2"
              profile={p2Profile}
              color={PLAYER_COLOR.P2}
              onReady={() => startPlayerDraft("P2")}
            />
          )}

          {phase.step === "DONE" && (
            <DraftCompleteSplash
              key="done"
              p1Profile={p1Profile}
              p2Profile={p2Profile}
              onStartBattle={() => {
                onBattleStart(
                  p1Draft as PlayerDraftResult,
                  p2Draft as PlayerDraftResult,
                );
              }}
            />
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
