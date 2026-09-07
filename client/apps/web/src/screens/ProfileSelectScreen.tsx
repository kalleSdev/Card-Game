import { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadProfiles, createProfile, deleteProfile, updateProfile, getTitle, getTitleColor, totalWins } from "../profiles";
import type { Profile } from "../profiles";
import { P1_ICON_OPTIONS, P2_ICON_OPTIONS } from "../constants";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";

const PLAYER_COLOR = { P1: "#4a9eff", P2: "#ff6666" };
const ALL_ICONS = [...P1_ICON_OPTIONS, ...P2_ICON_OPTIONS];

// ── Controller icon SVG ───────────────────────────────────────────────────────
function ControllerIcon({ color, active, size = 48 }: { color: string; active: boolean; size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 48 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="40" height="22" rx="11" fill={active ? color : "transparent"} stroke={color} strokeWidth="2.5" opacity={active ? 1 : 0.7} />
      {/* D-pad */}
      <rect x="11" y="15" width="3" height="9" rx="1.5" fill={active ? "#000" : color} opacity={active ? 0.8 : 0.6} />
      <rect x="8" y="18" width="9" height="3" rx="1.5" fill={active ? "#000" : color} opacity={active ? 0.8 : 0.6} />
      {/* Buttons */}
      <circle cx="35" cy="17" r="2" fill={active ? "#000" : color} opacity={active ? 0.8 : 0.5} />
      <circle cx="39" cy="20" r="2" fill={active ? "#000" : color} opacity={active ? 0.8 : 0.5} />
      <circle cx="35" cy="23" r="2" fill={active ? "#000" : color} opacity={active ? 0.8 : 0.5} />
      <circle cx="31" cy="20" r="2" fill={active ? "#000" : color} opacity={active ? 0.8 : 0.5} />
      {/* Start/Select */}
      <rect x="21" y="18" width="6" height="2" rx="1" fill={active ? "#000" : color} opacity={active ? 0.8 : 0.4} />
    </svg>
  );
}

// ── Win-rate helper ───────────────────────────────────────────────────────────
function wr(wins: number, matches: number) {
  return matches > 0 ? Math.round((wins / matches) * 100) : 0;
}

// ── Create / Edit form modal ──────────────────────────────────────────────────
function ProfileFormModal({
  editing, color, onDone, onCancel,
}: {
  editing: Profile | null;
  color: string;
  onDone: (p: Profile) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? ALL_ICONS[0]);
  const [focused, setFocused] = useState(false);
  const canSave = name.trim().length > 0;
  const isEdit = editing !== null;

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "rgba(8,8,22,0.98)", border: `2px solid ${color}55`,
          borderRadius: 20, padding: "32px", width: 480, maxWidth: "90vw",
          boxShadow: `0 0 60px ${color}22, 0 24px 60px rgba(0,0,0,0.8)`,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, borderRadius: "20px 20px 0 0" }} />

        <div style={{ fontSize: 11, color: color, letterSpacing: 5, fontWeight: 800, marginBottom: 24 }}>
          {isEdit ? "EDIT PROFILE" : "NEW PROFILE"}
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, marginBottom: 6 }}>NAME</div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === "Enter" && submit()}
              maxLength={20}
              placeholder="Enter name…"
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
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>
              {(name.trim() || "-").slice(0, 14)}
            </div>
            <div style={{ fontSize: 8, color: getTitleColor(0), letterSpacing: 2, marginTop: 3 }}>
              {getTitle(isEdit ? totalWins(editing!) : 0)}
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
            whileHover={canSave ? { scale: 1.04 } : {}}
            whileTap={canSave ? { scale: 0.96 } : {}}
            onClick={submit}
            style={{
              padding: "9px 28px",
              background: canSave ? color : "rgba(255,255,255,0.05)",
              border: "none", borderRadius: 9,
              color: canSave ? "#000" : "#334",
              fontSize: 12, fontWeight: 900, letterSpacing: 3,
              cursor: canSave ? "pointer" : "default", fontFamily: "inherit",
            }}>
            {isEdit ? "SAVE" : "CREATE"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Profile card in the grid ──────────────────────────────────────────────────
// forwardRef because AnimatePresence hands this a ref to measure it on exit
const ProfileCard = forwardRef<HTMLDivElement, {
  profile: Profile;
  assignedTo: "P1" | "P2" | null;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}>(function ProfileCard({ profile, assignedTo, onAssign, onEdit, onDelete }, ref) {
  const [confirmDel, setConfirmDel] = useState(false);
  const wins = totalWins(profile);
  const qWr = wr(profile.quickStats.wins, profile.quickStats.matches);
  const dWr = wr(profile.draftStats.wins, profile.draftStats.matches);
  const assignColor = assignedTo ? PLAYER_COLOR[assignedTo] : null;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={!confirmDel ? { y: -4, scale: 1.02 } : {}}
      onClick={() => { if (!confirmDel) onAssign(); }}
      style={{
        background: assignedTo ? `rgba(${assignedTo === "P1" ? "15,40,80" : "70,15,15"},0.85)` : "rgba(12,12,28,0.85)",
        border: `2px solid ${assignColor ? assignColor : "#2a2a4a"}`,
        borderRadius: 16, padding: "18px", cursor: confirmDel ? "default" : "pointer",
        position: "relative", overflow: "hidden", width: 290,
        boxShadow: assignColor ? `0 0 30px ${assignColor}33, 0 4px 20px rgba(0,0,0,0.6)` : "0 2px 12px rgba(0,0,0,0.4)",
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
        userSelect: "none",
      }}
    >
      {/* Assignment badge */}
      <AnimatePresence>
        {assignedTo && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            style={{
              position: "absolute", top: 8, right: 8,
              background: PLAYER_COLOR[assignedTo], borderRadius: "50%",
              width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 900, color: "#000", letterSpacing: 0,
            }}>
            {assignedTo}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ borderRadius: 10, border: `2px solid ${assignColor ?? "#2a2a4a"}`, overflow: "hidden", flexShrink: 0, transition: "border-color 0.2s" }}>
          <PlayerIcon icon={profile.icon} size={52} style={{ display: "block" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.name}
          </div>
          <div style={{ fontSize: 8, color: getTitleColor(wins), letterSpacing: 2, marginTop: 2 }}>
            {getTitle(wins)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "#99ccff", letterSpacing: 0.5 }}>
              Q: {profile.quickStats.wins}W {profile.quickStats.losses}L {qWr}%
            </span>
            <span style={{ fontSize: 9, color: "#ffcc77", letterSpacing: 0.5 }}>
              D: {profile.draftStats.wins}W {profile.draftStats.losses}L {dWr}%
            </span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <AnimatePresence>
        {confirmDel ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: 9, color: "#ff6666", flex: 1 }}>Delete this profile?</span>
            <button onClick={onDelete} style={{ padding: "3px 10px", background: "#ff2233", border: "none", borderRadius: 6, color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Yes</button>
            <button onClick={() => setConfirmDel(false)} style={{ padding: "3px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid #333", borderRadius: 6, color: "#888", fontSize: 9, cursor: "pointer" }}>No</button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 0 }} whileHover={{ opacity: 1 }}
            style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 6 }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={onEdit} style={{ background: "none", border: "none", color: "#88aacc", fontSize: 12, cursor: "pointer", padding: 3 }} title="Edit">✎</button>
            <button onClick={() => setConfirmDel(true)} style={{ background: "none", border: "none", color: "#ff6666", fontSize: 12, cursor: "pointer", padding: 3 }} title="Delete">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

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
  // Which slot is "active" — next click on a profile card assigns to this slot
  const [activeSlot, setActiveSlot] = useState<"P1" | "P2" | null>(null);
  const [formSlot, setFormSlot] = useState<"P1" | "P2" | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const refresh = () => setProfiles(loadProfiles());
  const canStart = p1 !== null && p2 !== null && p1.id !== p2.id;

  const assignProfile = (profile: Profile) => {
    if (!activeSlot) return;
    if (activeSlot === "P1") {
      if (p2?.id === profile.id) setP2(null);
      setP1(profile);
    } else {
      if (p1?.id === profile.id) setP1(null);
      setP2(profile);
    }
    setActiveSlot(null);
  };

  const getAssignment = (profile: Profile): "P1" | "P2" | null => {
    if (p1?.id === profile.id) return "P1";
    if (p2?.id === profile.id) return "P2";
    return null;
  };


  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,0.72)", zIndex: 0 }} />
      <AmbientCanvas intensity={0.35} />
      <AmbientOverlay />

      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", flex: 1, padding: "28px 40px" }}>

        {/* Back */}
        <button onClick={onBack} style={{
          alignSelf: "flex-start", padding: "7px 16px", background: "rgba(255,255,255,0.04)",
          border: "1px solid #2a2a3a", borderRadius: 8, color: "#556",
          cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit", marginBottom: 20,
        }}>← BACK</button>

        {/* Title */}
        <motion.div initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: 8, color: "#9966bb", fontWeight: 700, marginBottom: 6 }}>SELECT PROFILES</div>
          <div style={{ height: 1, width: 120, margin: "0 auto", background: "linear-gradient(90deg, transparent, #9933ff88, transparent)" }} />
        </motion.div>

        {/* Controller slots — text on side of controller, not below */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 28 }}
        >
          {(["P1", "P2"] as const).map(pid => {
            const color = PLAYER_COLOR[pid];
            const profile = pid === "P1" ? p1 : p2;
            const isActive = activeSlot === pid;
            const isP1 = pid === "P1";
            return (
              <motion.div
                key={pid}
                onClick={() => setActiveSlot(isActive ? null : pid)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: "flex",
                  flexDirection: isP1 ? "row" : "row-reverse",
                  alignItems: "center", gap: 14, cursor: "pointer",
                  padding: "14px 20px", borderRadius: 18,
                  background: isActive ? `${color}14` : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isActive ? color + "66" : "#1e1e30"}`,
                  transition: "background 0.2s, border-color 0.2s",
                  boxShadow: isActive ? `0 0 28px ${color}22` : "none",
                  minWidth: 240,
                }}
              >
                {/* Controller icon with glow ring */}
                <motion.div
                  animate={isActive ? { boxShadow: [`0 0 0 2px ${color}88`, `0 0 0 5px ${color}33`, `0 0 0 2px ${color}88`] } : { boxShadow: "none" }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  style={{ borderRadius: 12, padding: 8, background: isActive ? `${color}1a` : "transparent", flexShrink: 0, transition: "background 0.2s" }}
                >
                  <ControllerIcon color={color} active={isActive} size={58} />
                </motion.div>

                {/* Text + assigned badge — on the side */}
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: isP1 ? "flex-start" : "flex-end",
                  gap: 5, flex: 1, minWidth: 0,
                }}>
                  <div style={{ fontSize: 10, letterSpacing: 4, color: isActive ? color : "#556", fontWeight: 800, transition: "color 0.2s" }}>
                    {pid === "P1" ? "PLAYER 1" : "PLAYER 2"}
                  </div>
                  <AnimatePresence mode="wait">
                    {profile ? (
                      <motion.div
                        key={profile.id}
                        initial={{ opacity: 0, x: isP1 ? -8 : 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isP1 ? -4 : 4 }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          flexDirection: isP1 ? "row" : "row-reverse",
                          background: `${color}18`, border: `1px solid ${color}44`,
                          borderRadius: 20, padding: "4px 10px 4px 4px",
                        }}
                      >
                        <div style={{ borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${color}77`, flexShrink: 0 }}>
                          <PlayerIcon icon={profile.icon} size={26} style={{ display: "block" }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#eee", fontWeight: 700 }}>{profile.name.slice(0, 12)}</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: 9, color: isActive ? color + "aa" : "#2a2a4a", letterSpacing: 2 }}
                      >
                        {isActive ? "PICK A PROFILE ↓" : "NOT ASSIGNED"}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Active slot instruction banner */}
        <AnimatePresence>
          {activeSlot && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                textAlign: "center", marginBottom: 16,
                fontSize: 10, letterSpacing: 3, fontWeight: 700,
                color: PLAYER_COLOR[activeSlot],
              }}
            >
              ↓ CLICK A PROFILE BELOW TO ASSIGN TO {activeSlot === "P1" ? "PLAYER 1" : "PLAYER 2"} ↓
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "center",
            flex: 1,
            overflowY: "auto",
            paddingRight: 4,
            scrollbarWidth: "thin",
            maxHeight: "calc(100vh - 460px)",
            alignContent: "flex-start",
          }}
        >
          <AnimatePresence mode="popLayout">
            {profiles.map(profile => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                assignedTo={getAssignment(profile)}
                onAssign={() => assignProfile(profile)}
                onEdit={() => setEditingProfile(profile)}
                onDelete={() => {
                  deleteProfile(profile.id);
                  if (p1?.id === profile.id) setP1(null);
                  if (p2?.id === profile.id) setP2(null);
                  refresh();
                }}
              />
            ))}
          </AnimatePresence>

          {/* New profile button */}
          <motion.div
            whileHover={{ y: -3, borderColor: "#9933ff77" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setFormSlot("P1")}
            style={{
              border: "2px dashed #9933ff33", borderRadius: 16,
              padding: "20px", cursor: "pointer", textAlign: "center",
              color: "#9933ff77", fontSize: 12, letterSpacing: 2,
              transition: "border-color 0.2s", width: 290,
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>+</div>
            <div style={{ fontSize: 9, letterSpacing: 3 }}>NEW PROFILE</div>
          </motion.div>
        </motion.div>

        {/* Bottom: confirm button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid #1a1a2e" }}
        >
          {p1 && p2 && p1.id === p2.id && (
            <div style={{ fontSize: 10, color: "#ff4466", letterSpacing: 2, marginBottom: 8 }}>
              Both players cannot use the same profile
            </div>
          )}
          {!canStart && !activeSlot && (
            <div style={{ fontSize: 9, color: "#334", letterSpacing: 3, marginBottom: 10 }}>
              CLICK A CONTROLLER → SELECT A PROFILE FOR EACH PLAYER
            </div>
          )}
          <motion.button
            whileHover={canStart ? { scale: 1.05, y: -3 } : {}}
            whileTap={canStart ? { scale: 0.97 } : {}}
            onClick={() => { if (canStart) onStart(p1!, p2!); }}
            style={{
              padding: "14px 60px",
              background: canStart ? "linear-gradient(135deg, #6622cc, #9933ff)" : "rgba(255,255,255,0.04)",
              border: `2px solid ${canStart ? "#9933ff" : "#2a2a3a"}`,
              borderRadius: 12, color: canStart ? "#fff" : "#334",
              fontSize: 14, fontWeight: 900, letterSpacing: 6,
              cursor: canStart ? "pointer" : "default", fontFamily: "inherit",
              boxShadow: canStart ? "0 0 40px #6622cc66, 0 8px 24px rgba(0,0,0,0.5)" : "none",
            }}
          >
            START MATCH
          </motion.button>
        </motion.div>
      </div>

      {/* Profile form modal */}
      <AnimatePresence>
        {(formSlot || editingProfile) && (
          <ProfileFormModal
            editing={editingProfile}
            color={formSlot ? PLAYER_COLOR[formSlot] : editingProfile ? (getAssignment(editingProfile) ? PLAYER_COLOR[getAssignment(editingProfile)!] : "#9933ff") : "#9933ff"}
            onDone={p => {
              refresh();
              if (editingProfile) {
                if (p1?.id === p.id) setP1(p);
                if (p2?.id === p.id) setP2(p);
              }
              setFormSlot(null);
              setEditingProfile(null);
            }}
            onCancel={() => { setFormSlot(null); setEditingProfile(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
