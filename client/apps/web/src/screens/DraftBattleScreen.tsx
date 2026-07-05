import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef, PlayerId } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { ROULETTE_ITEM_MAP } from "@cg/engine";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import type { Profile } from "../profiles";

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
    Object.entries(cardDb).filter(([, def]) => def.affinity === "LEADER").map(([id]) => id)
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
      .filter(([id, def]) => def.affinity !== "LEADER" && !exclude.includes(id))
      .map(([id]) => id)
  ).slice(0, 3);
}

function getWeaponPool(exclude: string[]): string[] {
  return shuffle(Object.keys(ROULETTE_ITEM_MAP).filter(id => !exclude.includes(id))).slice(0, 5);
}

// ── Clear selection overlay on chosen card ────────────────────────────────────
function SelectedOverlay({ color }: { color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: "absolute", inset: 0, borderRadius: 14,
        background: `${color}22`,
        border: `3px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
        boxShadow: `0 0 32px ${color}88, inset 0 0 20px ${color}22`,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: color, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, color: "#000", fontWeight: 900,
        boxShadow: `0 0 20px ${color}cc`,
      }}>✓</div>
    </motion.div>
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
          return (
            <motion.div key={id} onClick={() => setSelected(id)}
              whileHover={{ y: -10, scale: 1.04 }} whileTap={{ scale: 0.97 }}
              style={{ cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
            >
              <div style={{ transform: "scale(1.25)", transformOrigin: "top center", position: "relative" }}>
                <CharacterCard defId={id} def={def} size="lg" />
                {isSelected && <SelectedOverlay color={color} />}
              </div>
              <div style={{ textAlign: "center", width: 140, paddingTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? "#fff" : "#aaa" }}>{def.name}</div>
                <div style={{ fontSize: 8, color: isSelected ? color : "#334", letterSpacing: 2, marginTop: 3 }}>
                  {isSelected ? "✓ SELECTED" : "LEADER"}
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
function CardDraftPhase({ pid, profile, color, pickIndex, options, cardDb, pickedSoFar, onPick }: {
  pid: PlayerId; profile: Profile; color: string;
  pickIndex: number; options: string[]; cardDb: Record<string, CardDef>;
  pickedSoFar: string[]; onPick: (id: string) => void;
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
          {isRandom ? "PICK ANY CARD" : `PICK YOUR ${(spec as { kind: "TYPED"; affinity: string }).affinity} CARD`}
        </div>
        <div style={{ fontSize: 9, color: "#445", letterSpacing: 2 }}>Pick {pickIndex + 1} of 10</div>

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

      {/* Cards — generous spacing */}
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        {options.map((id) => {
          const def = cardDb[id];
          if (!def) return null;
          const isSelected = selected === id;
          return (
            <motion.div key={id} onClick={() => setSelected(id)}
              whileHover={{ y: -10, scale: 1.05 }} whileTap={{ scale: 0.97 }}
              style={{ cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
            >
              <div style={{ transform: "scale(1.2)", transformOrigin: "top center", position: "relative" }}>
                <CharacterCard defId={id} def={def} size="lg" />
                {isSelected && <SelectedOverlay color={color} />}
              </div>
              <div style={{ textAlign: "center", width: 140, paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#fff" : "#aaa" }}>{def.name}</div>
                <div style={{ fontSize: 8, color: isSelected ? color : "#334", letterSpacing: 2, marginTop: 3 }}>
                  {isSelected ? "✓ SELECTED" : def.affinity}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Mini deck preview */}
      {pickedSoFar.length > 0 && (
        <div style={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: 8, color: "#334", letterSpacing: 2, marginRight: 6 }}>
            DECK ({pickedSoFar.length}/10):
          </span>
          {pickedSoFar.map(cid => {
            const def = cardDb[cid];
            return def ? (
              <div key={cid} style={{ transform: "scale(0.52)", transformOrigin: "left center" }}>
                <CharacterCard defId={cid} def={def} size="sm" />
              </div>
            ) : null;
          })}
        </div>
      )}

      <motion.button
        whileHover={selected ? { scale: 1.05, y: -2 } : {}} whileTap={selected ? { scale: 0.97 } : {}}
        onClick={() => { if (selected) onPick(selected); }}
        style={{
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

// ── Equipment phase ───────────────────────────────────────────────────────────
function EquipmentPhase({ pid, profile, color, weaponPool, leaderId, allPickedIds, cardDb, onPick }: {
  pid: PlayerId; profile: Profile; color: string;
  weaponPool: string[]; leaderId: string; allPickedIds: string[];
  cardDb: Record<string, CardDef>;
  onPick: (weaponIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          <div style={{ borderRadius: 6, overflow: "hidden", border: `2px solid ${color}55` }}>
            <PlayerIcon icon={profile.icon} size={28} style={{ display: "block" }} />
          </div>
          <span style={{ fontSize: 11, color: color, letterSpacing: 3, fontWeight: 700 }}>{profile.name}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, color: "#fff", marginBottom: 4 }}>
          EQUIP YOUR CURSED TOOLS
        </div>
        <div style={{ fontSize: 9, color: "#556", letterSpacing: 2 }}>
          Choose 2 weapons · {selected.length}/2 selected
        </div>
      </div>

      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
        {[leaderId, ...allPickedIds].map(id => {
          const def = cardDb[id];
          return def ? (
            <div key={id} style={{ transform: "scale(0.55)", transformOrigin: "center center" }}>
              <CharacterCard defId={id} def={def} size="sm" />
            </div>
          ) : null;
        })}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", maxWidth: 580 }}>
        {weaponPool.map((id) => {
          const weapon = ROULETTE_ITEM_MAP[id];
          if (!weapon) return null;
          const isSelected = selected.includes(id);
          const isDisabled = !isSelected && selected.length >= 2;
          return (
            <motion.div key={id}
              onClick={() => { if (!isDisabled) toggle(id); }}
              whileHover={!isDisabled ? { y: -4, scale: 1.04 } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              style={{
                width: 155, padding: "16px", borderRadius: 12,
                background: isSelected ? `rgba(${color === "#4a9eff" ? "20,50,100" : "100,30,30"},0.55)` : "rgba(10,10,22,0.88)",
                border: `2px solid ${isSelected ? color : isDisabled ? "#1a1a2a" : color + "33"}`,
                cursor: isDisabled ? "default" : "pointer", opacity: isDisabled ? 0.38 : 1,
                boxShadow: isSelected ? `0 0 24px ${color}44` : "none",
                textAlign: "center", position: "relative",
              }}
            >
              {isSelected && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  width: 18, height: 18, borderRadius: "50%",
                  background: color, fontSize: 10, fontWeight: 900, color: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✓</div>
              )}
              <div style={{ fontSize: 26, marginBottom: 8 }}>⚔</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#fff" : "#ccc", marginBottom: 4 }}>
                {weapon.name}
              </div>
              <div style={{ fontSize: 9, color: "#44ff88", fontWeight: 700 }}>
                +{weapon.baseBonus.toLocaleString()} base
              </div>
              {weapon.conditionalDesc && (
                <div style={{ fontSize: 8, color: "#556", marginTop: 3 }}>{weapon.conditionalDesc}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.button
        whileHover={selected.length === 2 ? { scale: 1.05, y: -2 } : {}} whileTap={selected.length === 2 ? { scale: 0.97 } : {}}
        onClick={() => { if (selected.length === 2) onPick(selected); }}
        style={{
          padding: "13px 56px",
          background: selected.length === 2 ? `linear-gradient(135deg, ${color}cc, ${color})` : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected.length === 2 ? color : "#2a2a3a"}`, borderRadius: 12,
          color: selected.length === 2 ? "#000" : "#334",
          fontSize: 13, fontWeight: 900, letterSpacing: 6,
          cursor: selected.length === 2 ? "pointer" : "default", fontFamily: "inherit",
          boxShadow: selected.length === 2 ? `0 0 32px ${color}55` : "none",
        }}
      >CONFIRM LOADOUT</motion.button>
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
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}33, transparent)`,
        border: `3px solid ${color}66`,
        overflow: "hidden",
      }}>
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
    | { step: "EQUIPMENT"; pid: PlayerId }
    | { step: "HANDOFF_P2" }
    | { step: "DONE" };

  const [phase, setPhase] = useState<Phase>({ step: "HANDOFF_P1" });
  const [p1Draft, setP1Draft] = useState<Partial<PlayerDraftResult>>({});
  const [p2Draft, setP2Draft] = useState<Partial<PlayerDraftResult>>({});
  const [leaderOptions, setLeaderOptions] = useState<string[]>(() => getLeaderOptions(cardDb));
  const [cardOptions, setCardOptions]     = useState<string[]>([]);
  const [weaponPool, setWeaponPool]       = useState<string[]>([]);

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
    if (phase.step === "CARD_DRAFT")  return `PICK ${phase.pickIndex + 1}/10`;
    if (phase.step === "EQUIPMENT")   return "EQUIPMENT";
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
          DRAFT BATTLE · {phaseLabel}
        </div>
      )}

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
            const all = getAllPicked(draft).filter(Boolean);
            return (
              <EquipmentPhase key="equipment"
                pid={pid} profile={getProfile(pid)} color={PLAYER_COLOR[pid]}
                weaponPool={weaponPool}
                leaderId={draft.leaderId ?? ""}
                allPickedIds={all.slice(1)}
                cardDb={cardDb}
                onPick={(weaponIds) => {
                  setDraft(pid, { weaponIds });
                  if (pid === "P1") setPhase({ step: "HANDOFF_P2" });
                  else              setPhase({ step: "DONE" });
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
      </div>
    </div>
  );
}
