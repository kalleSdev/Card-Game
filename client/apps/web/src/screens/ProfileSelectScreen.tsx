import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadProfiles, createProfile, deleteProfile, getTitle, getTitleColor } from "../profiles";
import type { Profile } from "../profiles";
import { P1_ICON_OPTIONS, P2_ICON_OPTIONS } from "../constants";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";

const PLAYER_COLOR = { P1: "#4a9eff", P2: "#ff6666" };
const ALL_ICONS = [...P1_ICON_OPTIONS, ...P2_ICON_OPTIONS];

// ── Live profile preview card ─────────────────────────────────────────────────
function ProfilePreviewCard({ name, icon, color }: { name: string; icon: string; color: string }) {
  const displayName = name.trim() || "—";
  const wins = 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: "rgba(8,8,20,0.95)",
        border: `2px solid ${color}55`,
        borderRadius: 16,
        padding: "20px 22px",
        width: 200,
        boxShadow: `0 0 40px ${color}22, 0 8px 32px rgba(0,0,0,0.7)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <motion.div
          animate={{ boxShadow: [`0 0 20px ${color}44`, `0 0 36px ${color}77`, `0 0 20px ${color}44`] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ borderRadius: 12, border: `2px solid ${color}66`, overflow: "hidden" }}
        >
          <PlayerIcon icon={icon} size={72} style={{ display: "block" }} />
        </motion.div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>
            {displayName.length > 14 ? displayName.slice(0, 13) + "…" : displayName}
          </div>
          <div style={{ fontSize: 9, color: getTitleColor(wins), letterSpacing: 3, marginTop: 3 }}>
            {getTitle(wins)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          {[["W", 0, "#44ff88"], ["L", 0, "#ff4466"], ["M", 0, "#888"]].map(([label, val, clr]) => (
            <div key={label as string} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: clr as string }}>{val}</div>
              <div style={{ fontSize: 8, color: "#445", letterSpacing: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Saved profile card ────────────────────────────────────────────────────────
function SavedProfileCard({
  profile, color, selected, onSelect, onDelete,
}: {
  profile: Profile; color: string; selected: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wr = profile.stats.matches > 0
    ? Math.round((profile.stats.wins / profile.stats.matches) * 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={!confirmDelete ? { y: -3 } : {}}
      onClick={() => { if (!confirmDelete) onSelect(); }}
      style={{
        background: selected ? `rgba(${color === PLAYER_COLOR.P1 ? "30,70,140" : "120,30,30"},0.55)` : "rgba(12,12,24,0.8)",
        border: `2px solid ${selected ? color : color + "22"}`,
        borderRadius: 14,
        padding: "14px 16px",
        cursor: confirmDelete ? "default" : "pointer",
        position: "relative",
        boxShadow: selected ? `0 0 28px ${color}44` : "none",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {/* Selected tick */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: "absolute", top: 8, right: 8,
            width: 18, height: 18, borderRadius: "50%",
            background: color, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 900, color: "#000",
          }}
        >✓</motion.div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          borderRadius: 10, border: `2px solid ${selected ? color : color + "44"}`,
          overflow: "hidden", flexShrink: 0,
        }}>
          <PlayerIcon icon={profile.icon} size={48} style={{ display: "block" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.name}
          </div>
          <div style={{ fontSize: 8, color: getTitleColor(profile.stats.wins), letterSpacing: 2, marginTop: 2 }}>
            {getTitle(profile.stats.wins)}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
            <span style={{ fontSize: 10, color: "#44ff88" }}>{profile.stats.wins}W</span>
            <span style={{ fontSize: 10, color: "#ff4466" }}>{profile.stats.losses}L</span>
            <span style={{ fontSize: 10, color: "#888" }}>{wr}% WR</span>
          </div>
        </div>
      </div>

      {/* Delete controls */}
      <AnimatePresence>
        {confirmDelete ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: 9, color: "#ff6666", flex: 1 }}>Delete this profile?</span>
            <button
              onClick={() => { onDelete(); }}
              style={{ padding: "3px 10px", background: "#ff2233", border: "none", borderRadius: 6, color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer" }}
            >Yes</button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ padding: "3px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid #333", borderRadius: 6, color: "#888", fontSize: 9, cursor: "pointer" }}
            >No</button>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            whileHover={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
            style={{
              position: "absolute", bottom: 8, right: 8,
              background: "none", border: "none",
              color: "#ff4466", fontSize: 11, cursor: "pointer", padding: 2,
            }}
          >✕</motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Create profile form ───────────────────────────────────────────────────────
function CreateForm({ color, onCreated, onCancel }: {
  color: string; onCreated: (p: Profile) => void; onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ALL_ICONS[0]);
  const [focused, setFocused] = useState(false);

  const canCreate = name.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{
        background: "rgba(6,6,16,0.97)",
        border: `1px solid ${color}44`,
        borderRadius: 16,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 10, color: color, letterSpacing: 4, fontWeight: 700 }}>NEW PROFILE</div>

      {/* Name + preview side by side */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          {/* Name input */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, marginBottom: 6 }}>NAME</div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={20}
              placeholder="Enter name…"
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: `1px solid ${focused ? color + "99" : "#2a2a3a"}`,
                borderRadius: 8, padding: "8px 12px",
                color: "#fff", fontSize: 13, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
                boxShadow: focused ? `0 0 12px ${color}33` : "none",
              }}
            />
          </div>

          {/* Icon grid */}
          <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, marginBottom: 6 }}>AVATAR</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_ICONS.map(ic => (
              <motion.div
                key={ic}
                onClick={() => setIcon(ic)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  borderRadius: 8, overflow: "hidden", cursor: "pointer",
                  border: `2px solid ${ic === icon ? color : "transparent"}`,
                  boxShadow: ic === icon ? `0 0 10px ${color}66` : "none",
                }}
              >
                <PlayerIcon icon={ic} size={32} style={{ display: "block" }} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <ProfilePreviewCard name={name} icon={icon} color={color} />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 18px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#667", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}
        >Cancel</button>
        <motion.button
          whileHover={canCreate ? { scale: 1.04 } : {}}
          whileTap={canCreate ? { scale: 0.97 } : {}}
          onClick={() => {
            if (!canCreate) return;
            const p = createProfile(name, icon);
            onCreated(p);
          }}
          style={{
            padding: "8px 22px",
            background: canCreate ? color : "rgba(255,255,255,0.05)",
            border: "none", borderRadius: 8,
            color: canCreate ? "#000" : "#334",
            fontSize: 11, fontWeight: 800, cursor: canCreate ? "pointer" : "default",
            fontFamily: "inherit", letterSpacing: 2,
          }}
        >CREATE</motion.button>
      </div>
    </motion.div>
  );
}

// ── Player column ─────────────────────────────────────────────────────────────
function PlayerColumn({
  pid, color, profiles, selected, onSelect, onRefresh,
}: {
  pid: "P1" | "P2";
  color: string;
  profiles: Profile[];
  selected: Profile | null;
  onSelect: (p: Profile | null) => void;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);

  const handleDelete = (id: string) => {
    deleteProfile(id);
    if (selected?.id === id) onSelect(null);
    onRefresh();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: color, fontWeight: 800, marginBottom: 2 }}>
          {pid === "P1" ? "PLAYER 1" : "PLAYER 2"}
        </div>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: 9, color: color + "99", letterSpacing: 2 }}
          >
            ✓ SELECTED
          </motion.div>
        )}
      </div>

      {/* Profile list */}
      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8,
        maxHeight: 380,
        paddingRight: 4,
        scrollbarWidth: "thin",
      }}>
        <AnimatePresence mode="popLayout">
          {profiles.map(p => (
            <SavedProfileCard
              key={p.id}
              profile={p}
              color={color}
              selected={selected?.id === p.id}
              onSelect={() => onSelect(selected?.id === p.id ? null : p)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </AnimatePresence>

        {profiles.length === 0 && !creating && (
          <div style={{ textAlign: "center", padding: "28px 0", color: "#334", fontSize: 11 }}>
            No profiles yet
          </div>
        )}
      </div>

      {/* Create form or button */}
      <AnimatePresence mode="wait">
        {creating ? (
          <CreateForm
            key="form"
            color={color}
            onCreated={p => {
              onRefresh();
              onSelect(p);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <motion.button
            key="btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ y: -2, borderColor: color + "99" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCreating(true)}
            style={{
              padding: "10px", background: "rgba(255,255,255,0.03)",
              border: `1px dashed ${color}44`, borderRadius: 10,
              color: color + "aa", fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: 2,
            }}
          >+ NEW PROFILE</motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileSelectScreen({
  onStart, onBack,
}: {
  onStart: (p1: Profile, p2: Profile) => void;
  onBack: () => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [p1, setP1] = useState<Profile | null>(null);
  const [p2, setP2] = useState<Profile | null>(null);

  const refresh = () => setProfiles(loadProfiles());
  const canStart = p1 !== null && p2 !== null && p1.id !== p2.id;

  // Auto-clear selection if same profile picked for both
  useEffect(() => {
    if (p1 && p2 && p1.id === p2.id) setP2(null);
  }, [p1, p2]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      backgroundImage: BG.home,
      backgroundSize: "cover",
      backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,0.72)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", flex: 1, padding: "28px 40px" }}>

        {/* Back */}
        <button
          onClick={onBack}
          style={{
            alignSelf: "flex-start",
            padding: "7px 16px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#556", cursor: "pointer", fontSize: 11,
            letterSpacing: 2, fontFamily: "inherit", marginBottom: 28,
          }}
        >← BACK</button>

        {/* Title */}
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{ textAlign: "center", marginBottom: 32 }}
        >
          <div style={{ fontSize: 11, letterSpacing: 8, color: "#9966bb", fontWeight: 700, marginBottom: 6 }}>
            SELECT PROFILES
          </div>
          <div style={{ height: 1, width: 120, margin: "0 auto", background: "linear-gradient(90deg, transparent, #9933ff88, transparent)" }} />
        </motion.div>

        {/* Two columns */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: "flex", gap: 32, flex: 1, alignItems: "flex-start" }}
        >
          <PlayerColumn pid="P1" color={PLAYER_COLOR.P1} profiles={profiles} selected={p1}
            onSelect={setP1} onRefresh={refresh} />

          {/* Divider */}
          <div style={{ width: 1, alignSelf: "stretch", background: "linear-gradient(to bottom, transparent, #2a2a4a, transparent)" }} />

          <PlayerColumn pid="P2" color={PLAYER_COLOR.P2} profiles={profiles} selected={p2}
            onSelect={setP2} onRefresh={refresh} />
        </motion.div>

        {/* Start button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ textAlign: "center", marginTop: 24 }}
        >
          {p1 && p2 && p1.id === p2.id && (
            <div style={{ fontSize: 10, color: "#ff4466", letterSpacing: 2, marginBottom: 8 }}>
              Both players cannot use the same profile
            </div>
          )}
          <motion.button
            whileHover={canStart ? { scale: 1.05, y: -3 } : {}}
            whileTap={canStart ? { scale: 0.97 } : {}}
            onClick={() => { if (canStart) onStart(p1!, p2!); }}
            style={{
              padding: "14px 60px",
              background: canStart
                ? "linear-gradient(135deg, #6622cc, #9933ff)"
                : "rgba(255,255,255,0.04)",
              border: `2px solid ${canStart ? "#9933ff" : "#2a2a3a"}`,
              borderRadius: 12,
              color: canStart ? "#fff" : "#334",
              fontSize: 14, fontWeight: 900, letterSpacing: 6,
              cursor: canStart ? "pointer" : "default",
              fontFamily: "inherit",
              boxShadow: canStart ? "0 0 40px #6622cc66, 0 8px 24px rgba(0,0,0,0.5)" : "none",
            }}
          >
            START MATCH
          </motion.button>
          {!canStart && (
            <div style={{ fontSize: 9, color: "#334", letterSpacing: 3, marginTop: 8 }}>
              BOTH PLAYERS MUST SELECT A PROFILE
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
