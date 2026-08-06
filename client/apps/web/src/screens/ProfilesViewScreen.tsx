import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadProfiles, createProfile, deleteProfile, updateProfile,
  getTitle, totalWins,
} from "../profiles";
import type { Profile, MatchRecord } from "../profiles";
import { P1_ICON_OPTIONS, P2_ICON_OPTIONS } from "../constants";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import CardCollectionScreen from "./CardCollectionScreen";

// Thin wrapper so the collection screen can render inside this file's AnimatePresence
const CardCollectionScreenInline = CardCollectionScreen;

const ALL_ICONS = [...P1_ICON_OPTIONS, ...P2_ICON_OPTIONS];

// ── Rank tiers matching card rarity colors ────────────────────────────────────
interface RankStyle {
  color: string;
  glow: string;
  label: string;
  borderWidth: number;
  borderStyle: string;
}

function getRankStyle(wins: number): RankStyle {
  if (wins >= 50) return { color: "#ff3322", glow: "#ff332255", label: "X",   borderWidth: 2, borderStyle: "solid" };
  if (wins >= 30) return { color: "#00ff88", glow: "#00ff8844", label: "SSS", borderWidth: 2, borderStyle: "solid" };
  if (wins >= 18) return { color: "#ff22cc", glow: "#ff22cc44", label: "SS",  borderWidth: 2, borderStyle: "solid" };
  if (wins >= 10) return { color: "#ffd700", glow: "#ffd70044", label: "S",   borderWidth: 2, borderStyle: "solid" };
  if (wins >= 5)  return { color: "#cc44ff", glow: "#cc44ff33", label: "A",   borderWidth: 1, borderStyle: "solid" };
  if (wins >= 2)  return { color: "#4a9eff", glow: "#4a9eff22", label: "B",   borderWidth: 1, borderStyle: "solid" };
  return             { color: "#556677", glow: "transparent",  label: "C",   borderWidth: 1, borderStyle: "dashed" };
}

function wr(wins: number, matches: number) {
  return matches > 0 ? Math.round((wins / matches) * 100) : 0;
}

function WinRateBar({ wins, matches, color }: { wins: number; matches: number; color: string }) {
  const pct = wr(wins, matches);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", background: color, borderRadius: 2 }}
        />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 700, minWidth: 30 }}>{pct}%</span>
    </div>
  );
}

// ── Profile form modal (shared with edit/create) ──────────────────────────────
function ProfileFormModal({
  editing, onDone, onCancel,
}: {
  editing: Profile | null;
  onDone: (p: Profile) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? ALL_ICONS[0]);
  const [focused, setFocused] = useState(false);
  const canSave = name.trim().length > 0;
  const isEdit = editing !== null;
  const color = "#9933ff";

  const submit = () => {
    if (!canSave) return;
    if (isEdit) {
      updateProfile(editing!.id, name, icon);
      const updated = loadProfiles().find(p => p.id === editing!.id)!;
      onDone(updated);
    } else {
      const p = createProfile(name, icon);
      onDone(p);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(8px)",
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "rgba(8,8,22,0.98)", border: `2px solid ${color}55`,
          borderRadius: 20, padding: "32px", width: 480, maxWidth: "90vw",
          boxShadow: `0 0 60px ${color}22, 0 24px 60px rgba(0,0,0,0.8)`,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, borderRadius: "20px 20px 0 0" }} />

        <div style={{ fontSize: 11, color, letterSpacing: 5, fontWeight: 800, marginBottom: 24 }}>
          {isEdit ? "EDIT PROFILE" : "NEW PROFILE"}
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, marginBottom: 6 }}>NAME</div>
            <input
              autoFocus value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === "Enter" && submit()}
              maxLength={20} placeholder="Enter name…"
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: `1px solid ${focused ? color + "99" : "#2a2a3a"}`,
                borderRadius: 8, padding: "9px 13px",
                color: "#fff", fontSize: 14, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
                boxShadow: focused ? `0 0 14px ${color}33` : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />
            <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, margin: "16px 0 8px" }}>AVATAR</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_ICONS.map(ic => (
                <motion.div key={ic} onClick={() => setIcon(ic)}
                  whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.93 }}
                  style={{
                    borderRadius: 8, overflow: "hidden", cursor: "pointer",
                    border: `2px solid ${ic === icon ? color : "transparent"}`,
                    boxShadow: ic === icon ? `0 0 10px ${color}66` : "none",
                  }}>
                  <PlayerIcon icon={ic} size={34} style={{ display: "block" }} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div style={{
            background: "rgba(6,6,18,0.9)", border: `1px solid ${color}33`,
            borderRadius: 14, padding: "18px 16px", width: 140, flexShrink: 0, textAlign: "center",
          }}>
            <div style={{ borderRadius: 10, border: `2px solid ${color}55`, overflow: "hidden", display: "inline-block", marginBottom: 10 }}>
              <PlayerIcon icon={icon} size={64} style={{ display: "block" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
              {(name.trim() || "-").slice(0, 14)}
            </div>
            <div style={{ fontSize: 8, color: color, letterSpacing: 2, marginTop: 3 }}>
              {isEdit ? getTitle(totalWins(editing!)) : getTitle(0)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onCancel} style={{
            padding: "9px 20px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 9,
            color: "#667", fontSize: 11, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1,
          }}>Cancel</button>
          <motion.button
            whileHover={canSave ? { scale: 1.04 } : {}} whileTap={canSave ? { scale: 0.96 } : {}}
            onClick={submit}
            style={{
              padding: "9px 28px",
              background: canSave ? color : "rgba(255,255,255,0.05)",
              border: "none", borderRadius: 9,
              color: canSave ? "#000" : "#334",
              fontSize: 12, fontWeight: 900, letterSpacing: 3,
              cursor: canSave ? "pointer" : "default", fontFamily: "inherit",
            }}
          >{isEdit ? "SAVE" : "CREATE"}</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Profile detail card ───────────────────────────────────────────────────────
function ProfileDetailCard({
  profile, rank, onEdit, onDelete, onHistory, onDeck,
}: {
  profile: Profile;
  rank: number;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
  onDeck: () => void;
}) {
  const wins = totalWins(profile);
  const rs = getRankStyle(wins);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ delay: Math.min(rank * 0.05, 0.4) }}
      style={{
        background: "rgba(8,8,20,0.92)",
        border: `${rs.borderWidth}px ${rs.borderStyle} ${rs.color}55`,
        borderRadius: 18, padding: "22px", position: "relative", overflow: "hidden",
        boxShadow: `0 0 28px ${rs.glow}, 0 6px 24px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Rank-colored top accent */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${rs.color}, transparent)`,
        opacity: 0.85,
      }} />

      {/* Rank badge — top right */}
      <div style={{
        position: "absolute", top: 12, right: 12,
        background: `${rs.color}18`, border: `1px solid ${rs.color}77`,
        borderRadius: 8, padding: "3px 9px",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: rs.color, letterSpacing: 2 }}>{rs.label}</span>
        <span style={{ fontSize: 9, color: "#445", letterSpacing: 1 }}>#{rank}</span>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Avatar with rank-colored ring */}
        <div style={{ flexShrink: 0 }}>
          <motion.div
            animate={{ boxShadow: [`0 0 12px ${rs.color}44`, `0 0 24px ${rs.color}88`, `0 0 12px ${rs.color}44`] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{
              borderRadius: 14,
              border: `2px solid ${rs.color}88`,
              overflow: "hidden",
            }}
          >
            <PlayerIcon icon={profile.icon} size={72} style={{ display: "block" }} />
          </motion.div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 0.5, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.name}
          </div>
          <div style={{ fontSize: 9, color: rs.color, letterSpacing: 3, marginBottom: 14 }}>
            {getTitle(wins)}
          </div>

          {/* Quick match */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 8, color: "#4a9eff", letterSpacing: 3, marginBottom: 5, fontWeight: 700 }}>QUICK MATCH</div>
            <div style={{ display: "flex", gap: 14, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#44ff88" }}>{profile.quickStats.wins}W</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#ff4466" }}>{profile.quickStats.losses}L</span>
              <span style={{ fontSize: 10, color: "#445" }}>{profile.quickStats.matches} played</span>
            </div>
            <WinRateBar wins={profile.quickStats.wins} matches={profile.quickStats.matches} color="#4a9eff" />
          </div>

          {/* Draft */}
          <div>
            <div style={{ fontSize: 8, color: "#ff9922", letterSpacing: 3, marginBottom: 5, fontWeight: 700 }}>QUICK DRAFT</div>
            <div style={{ display: "flex", gap: 14, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#44ff88" }}>{profile.draftStats.wins}W</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#ff4466" }}>{profile.draftStats.losses}L</span>
              <span style={{ fontSize: 10, color: "#445" }}>{profile.draftStats.matches} played</span>
            </div>
            <WinRateBar wins={profile.draftStats.wins} matches={profile.draftStats.matches} color="#ff9922" />
          </div>
        </div>
      </div>

      {/* Action row */}
      <AnimatePresence>
        {confirmDel ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: "rgba(255,30,30,0.08)", borderRadius: 8, border: "1px solid #ff334422" }}
          >
            <span style={{ fontSize: 10, color: "#ff6666", flex: 1 }}>Delete "{profile.name}"?</span>
            <button onClick={onDelete} style={{ padding: "5px 14px", background: "#ff2233", border: "none", borderRadius: 6, color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Delete</button>
            <button onClick={() => setConfirmDel(false)} style={{ padding: "5px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid #333", borderRadius: 6, color: "#888", fontSize: 10, cursor: "pointer" }}>Cancel</button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${rs.color}22` }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={onDeck}
              style={{
                padding: "5px 10px", background: "rgba(255,215,0,0.06)",
                border: "1px solid #ffd70033", borderRadius: 8,
                color: "#ffd700", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
              }}
              title="Card Collection"
            >🃏</motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={onHistory}
              style={{
                padding: "5px 10px", background: "rgba(255,255,255,0.04)",
                border: "1px solid #2a2a3a", borderRadius: 8,
                color: "#667", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
              }}
              title="Match History"
            >📋</motion.button>
            <motion.button
              whileHover={{ scale: 1.05, borderColor: rs.color + "88" }} whileTap={{ scale: 0.95 }}
              onClick={onEdit}
              style={{
                padding: "5px 10px", background: "rgba(255,255,255,0.04)",
                border: `1px solid ${rs.color}33`, borderRadius: 8,
                color: rs.color + "cc", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                transition: "border-color 0.15s", lineHeight: 1,
              }}
              title="Edit"
            >✎</motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setConfirmDel(true)}
              style={{
                padding: "5px 10px", background: "rgba(255,30,30,0.06)",
                border: "1px solid #ff334422", borderRadius: 8,
                color: "#ff6666", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
              }}
              title="Delete"
            >✕</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Match history modal ───────────────────────────────────────────────────────
function MatchHistoryModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const wins = totalWins(profile);
  const rs = getRankStyle(wins);
  const history: MatchRecord[] = profile.history ?? [];

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(10px)",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "rgba(6,6,18,0.98)", border: `2px solid ${rs.color}44`,
          borderRadius: 22, width: 520, maxWidth: "92vw", maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          boxShadow: `0 0 60px ${rs.color}18, 0 24px 60px rgba(0,0,0,0.8)`,
          position: "relative", overflow: "hidden",
        }}
      >
        {/* top accent */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${rs.color}, transparent)`, flexShrink: 0 }} />

        {/* header */}
        <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", border: `2px solid ${rs.color}66` }}>
            <PlayerIcon icon={profile.icon} size={48} style={{ display: "block" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{profile.name}</div>
            <div style={{ fontSize: 9, color: rs.color, letterSpacing: 3, marginTop: 2 }}>MATCH HISTORY · {history.length} RECORDED</div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: "auto", padding: "4px 10px",
            background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a3a",
            borderRadius: 6, color: "#556", cursor: "pointer", fontSize: 11, fontFamily: "inherit",
          }}>✕</button>
        </div>

        {/* match list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 12, color: "#334", letterSpacing: 3 }}>NO MATCHES YET</div>
              <div style={{ fontSize: 9, color: "#223", letterSpacing: 2, marginTop: 6 }}>Play a game to see results here</div>
            </div>
          ) : (
            history.map((m, i) => {
              const isWin = m.result === "win";
              const modeColor = m.mode === "draft" ? "#ff9922" : "#4a9eff";
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 12,
                    background: isWin ? "rgba(20,60,30,0.55)" : "rgba(50,10,10,0.55)",
                    border: `1px solid ${isWin ? "#44ff8833" : "#ff444433"}`,
                  }}
                >
                  {/* Result badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: isWin ? "rgba(30,200,80,0.18)" : "rgba(200,40,40,0.18)",
                    border: `2px solid ${isWin ? "#44ff8866" : "#ff444466"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                  }}>{isWin ? "🏆" : "💀"}</div>

                  {/* Opponent avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                    <PlayerIcon icon={m.opponentIcon} size={32} style={{ display: "block" }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isWin ? "Defeated" : "Lost to"} <span style={{ color: "#fff" }}>{m.opponentName}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#445", marginTop: 2 }}>{formatDate(m.date)}</div>
                  </div>

                  {/* Mode tag */}
                  <div style={{
                    padding: "2px 8px", borderRadius: 6, flexShrink: 0,
                    background: `${modeColor}18`, border: `1px solid ${modeColor}44`,
                    fontSize: 8, fontWeight: 800, color: modeColor, letterSpacing: 2,
                  }}>{m.mode.toUpperCase()}</div>

                  {/* Result text */}
                  <div style={{
                    fontSize: 10, fontWeight: 900, letterSpacing: 2, flexShrink: 0,
                    color: isWin ? "#44ff88" : "#ff4466",
                  }}>{isWin ? "WIN" : "LOSS"}</div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfilesViewScreen({ onBack, cardDb }: { onBack: () => void; cardDb: Record<string, import("@cg/contracts").CardDef> }) {
  const [profiles, setProfiles] = useState<Profile[]>(() =>
    loadProfiles().sort((a, b) => totalWins(b) - totalWins(a))
  );
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [historyProfile, setHistoryProfile] = useState<Profile | null>(null);
  const [deckProfile, setDeckProfile] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () =>
    setProfiles(loadProfiles().sort((a, b) => totalWins(b) - totalWins(a)));

  const handleDelete = (id: string) => {
    deleteProfile(id);
    refresh();
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,0.75)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <div style={{
        position: "relative", zIndex: 3, display: "flex", flexDirection: "column", flex: 1,
        padding: "28px 40px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box",
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <button onClick={onBack} style={{
            padding: "7px 16px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8, color: "#556",
            cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit",
          }}>← BACK</button>

          <motion.button
            whileHover={{ scale: 1.05, borderColor: "#9933ffaa" }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setCreating(true)}
            style={{
              padding: "8px 20px", background: "rgba(80,20,140,0.18)",
              border: "1px solid #9933ff55", borderRadius: 9,
              color: "#cc88ff", fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", letterSpacing: 2,
            }}
          >+ NEW PROFILE</motion.button>
        </div>

        {/* Title */}
        <motion.div initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#d8aaff", letterSpacing: 2, marginBottom: 4 }}>PROFILES</div>
          <div style={{ fontSize: 10, color: "#9966bb", letterSpacing: 6 }}>RANKINGS · STATS</div>
          <div style={{ height: 1, width: 160, margin: "12px auto 0", background: "linear-gradient(90deg, transparent, #9933ff88, transparent)" }} />
        </motion.div>

        {/* Rank legend */}
        {profiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}
          >
            {([
              { label: "X", color: "#ff3322", wins: "50+" },
              { label: "SSS", color: "#00ff88", wins: "30+" },
              { label: "SS",  color: "#ff22cc", wins: "18+" },
              { label: "S",   color: "#ffd700", wins: "10+" },
              { label: "A",   color: "#cc44ff", wins: "5+" },
              { label: "B",   color: "#4a9eff", wins: "2+" },
              { label: "C",   color: "#556677", wins: "0" },
            ] as const).map(tier => (
              <div key={tier.label} style={{
                display: "flex", alignItems: "center", gap: 4,
                background: `${tier.color}11`, border: `1px solid ${tier.color}44`,
                borderRadius: 6, padding: "3px 8px",
              }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: tier.color, letterSpacing: 1 }}>{tier.label}</span>
                <span style={{ fontSize: 7, color: "#445" }}>{tier.wins}W</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Grid */}
        <AnimatePresence mode="popLayout">
          {profiles.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", marginTop: 80 }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
              <div style={{ fontSize: 14, color: "#334", letterSpacing: 3 }}>NO PROFILES YET</div>
              <div style={{ fontSize: 10, color: "#223", letterSpacing: 2, marginTop: 8 }}>
                Click <strong style={{ color: "#9933ff" }}>+ NEW PROFILE</strong> above to get started
              </div>
            </motion.div>
          ) : (
            <div
              key="grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 18, overflowY: "auto", scrollbarWidth: "thin",
              }}
            >
              {profiles.map((p, i) => (
                <ProfileDetailCard
                  key={p.id}
                  profile={p}
                  rank={i + 1}
                  onEdit={() => setEditingProfile(p)}
                  onDelete={() => handleDelete(p.id)}
                  onHistory={() => setHistoryProfile(p)}
                  onDeck={() => setDeckProfile(p)}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Match history modal */}
      <AnimatePresence>
        {historyProfile && (
          <MatchHistoryModal
            key="history"
            profile={historyProfile}
            onClose={() => setHistoryProfile(null)}
          />
        )}
      </AnimatePresence>

      {/* Form modal */}
      <AnimatePresence>
        {(creating || editingProfile) && (
          <ProfileFormModal
            key="form"
            editing={editingProfile}
            onDone={p => {
              setCreating(false);
              setEditingProfile(null);
              refresh();
              void p;
            }}
            onCancel={() => { setCreating(false); setEditingProfile(null); }}
          />
        )}
      </AnimatePresence>

      {/* Card collection overlay */}
      <AnimatePresence>
        {deckProfile && (
          <motion.div
            key="deck"
            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
            style={{ position: "fixed", inset: 0, zIndex: 400 }}
          >
            <CardCollectionScreenInline
              profile={deckProfile}
              cardDb={cardDb}
              onBack={() => setDeckProfile(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
