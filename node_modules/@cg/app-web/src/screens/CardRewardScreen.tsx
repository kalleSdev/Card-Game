import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import type { Profile } from "../profiles";
import { deriveStats } from "../battleEngine";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";

interface Props {
  profile: Profile;
  options: string[];          // 5 cards for winner, 3 for loser
  cardDb: Record<string, CardDef>;
  isWinner: boolean;          // true = winner (picks 2), false = loser (picks 1)
  onDone: (chosen: string[]) => void;
}

export default function CardRewardScreen({ profile, options, cardDb, isWinner, onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pickCount = isWinner ? 2 : 1;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (next.size >= pickCount) return prev;
      next.add(id);
      return next;
    });
  };

  const canConfirm = selected.size === pickCount;

  const badgeColor = isWinner ? "#ffd700" : "#778899";
  const badgeText  = isWinner ? "WINNER"   : "RUNNER-UP";
  const badgeBg    = isWinner ? "rgba(255,215,0,0.14)" : "rgba(120,136,153,0.14)";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 20%, #0d0620, #04040a)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 32, padding: "40px 24px",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 0%, #6600aa22, transparent 55%)",
        }}
      />

      {/* Header */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Player icon + name + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid #cc44ff66" }}>
            <PlayerIcon icon={profile.icon} size={40} style={{ display: "block" }} />
          </div>
          <span style={{ fontSize: 14, color: "#cc44ff", letterSpacing: 3, fontWeight: 700 }}>{profile.name}</span>
          <div style={{
            padding: "3px 10px", borderRadius: 20,
            border: `1px solid ${badgeColor}`,
            background: badgeBg,
            color: badgeColor, fontSize: 9, fontWeight: 900, letterSpacing: 3,
          }}>{badgeText}</div>
        </div>

        {/* Title */}
        <motion.div
          animate={{ textShadow: ["0 0 30px #cc44ff66", "0 0 60px #cc44ffaa", "0 0 30px #cc44ff66"] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: 28, fontWeight: 900, letterSpacing: 5, color: "#fff", marginBottom: 6 }}
        >
          CARD REWARD
        </motion.div>

        {/* Subtitle */}
        <div style={{ fontSize: 10, color: "#cc44ff99", letterSpacing: 3 }}>
          {isWinner ? "SELECT 2 CARDS" : "SELECT 1 CARD"} TO ADD TO YOUR COLLECTION
        </div>
        <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, marginTop: 4 }}>
          {selected.size}/{pickCount} chosen
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", gap: options.length >= 5 ? 20 : 36, alignItems: "flex-start", position: "relative", zIndex: 1, flexWrap: "wrap", justifyContent: "center" }}>
        {options.map((id, i) => {
          const def = cardDb[id];
          if (!def) return null;
          const cost = deriveStats(def).cost;
          const isSelected = selected.has(id);
          const isDisabled = !isSelected && selected.size >= pickCount;

          const isNew = !profile.collection.some(c => c.defId === id);
          const aboutToAscend = profile.collection.find(c => c.defId === id)?.duplicateStars === 2;

          // Glow colours: selection > new (gold) > about-to-ascend (purple)
          const glowColor = isSelected
            ? "#cc44ff"
            : isNew
            ? "#ffd700"
            : aboutToAscend
            ? "#aa44ff"
            : null;

          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 30, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 280, damping: 20 }}
              onClick={() => !isDisabled && toggle(id)}
              whileHover={!isDisabled ? { y: -12, scale: 1.05 } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              style={{
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.38 : 1,
                position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              }}
            >
              {/* Glow ring: gold for new, purple for about-to-ascend, or selection ring */}
              {glowColor && (
                <motion.div
                  animate={{
                    boxShadow: isSelected
                      ? [`0 0 0 3px ${glowColor}, 0 0 24px ${glowColor}88`, `0 0 0 3px ${glowColor}, 0 0 48px ${glowColor}bb`]
                      : [`0 0 0 3px ${glowColor}88, 0 0 18px ${glowColor}66`, `0 0 0 3px ${glowColor}cc, 0 0 32px ${glowColor}99`],
                  }}
                  transition={{ duration: isNew ? 1.2 : 0.8, repeat: Infinity, repeatType: "reverse" }}
                  style={{ position: "absolute", inset: -4, borderRadius: 16, pointerEvents: "none", zIndex: 10 }}
                />
              )}

              {/* Checkmark badge */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    position: "absolute", top: 6, right: 6, zIndex: 20,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "#cc44ff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: "#fff", fontWeight: 900,
                  }}
                >✓</motion.div>
              )}

              {/* NEW badge */}
              {isNew && !isSelected && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  style={{
                    position: "absolute", top: 8, left: 8, zIndex: 20,
                    padding: "3px 8px", borderRadius: 6,
                    background: "#ffd700", color: "#000",
                    fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
                  }}
                >NEW</motion.div>
              )}

              {/* ASCEND badge */}
              {aboutToAscend && !isNew && !isSelected && (
                <motion.div
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{
                    position: "absolute", top: 8, left: 8, zIndex: 20,
                    padding: "3px 8px", borderRadius: 6,
                    background: "#aa44ff", color: "#fff",
                    fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
                  }}
                >ASCEND</motion.div>
              )}

              <div style={{ transform: "scale(1.1)", transformOrigin: "center top" }}>
                {/* Collection cards all start at S tier (the ascension ladder climbs from here),
                    so every reward card shows the golden S aura */}
                <CharacterCard defId={id} def={def} size="lg" costOverride={cost} rarityOverride="S" />
              </div>

              {/* Status info block below card */}
              {(() => {
                const collected = profile.collection.find(c => c.defId === id);
                const dupeStars = collected ? collected.duplicateStars : 0;
                if (isNew) return (
                  <div style={{
                    textAlign: "center", padding: "8px 14px", borderRadius: 10, width: "100%",
                    background: "rgba(255,215,0,0.12)", border: "1px solid #ffd70066",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#ffd700", letterSpacing: 1 }}>✦ NEW CARD</div>
                    <div style={{ fontSize: 10, color: "#ffd700aa", marginTop: 3 }}>Added to your collection</div>
                  </div>
                );
                if (aboutToAscend) return (
                  <div style={{
                    textAlign: "center", padding: "8px 14px", borderRadius: 10, width: "100%",
                    background: "rgba(170,68,255,0.14)", border: "1px solid #aa44ff88",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#cc88ff", letterSpacing: 1 }}>★ READY TO ASCEND</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 5 }}>
                      {Array.from({ length: 3 }).map((_, s) => (
                        <span key={s} style={{ fontSize: 12, color: s < dupeStars % 3 ? "#aa44ff" : "#333" }}>★</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: "#aa44ffaa", marginTop: 4 }}>Collecting will ascend this card</div>
                  </div>
                );
                return (
                  <div style={{
                    textAlign: "center", padding: "8px 14px", borderRadius: 10, width: "100%",
                    background: "rgba(100,100,180,0.1)", border: "1px solid #4455aa55",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#aabbff", letterSpacing: 1 }}>DUPLICATE</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 5 }}>
                      {Array.from({ length: 3 }).map((_, s) => (
                        <span key={s} style={{ fontSize: 12, color: s < dupeStars % 3 ? "#6688ff" : "#222" }}>★</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: "#6688ffaa", marginTop: 4 }}>{dupeStars % 3 + 1}/3 — +1 star on collect</div>
                  </div>
                );
              })()}
            </motion.div>
          );
        })}
      </div>

      {/* Confirm */}
      <motion.div style={{ position: "relative", zIndex: 1 }}>
        <motion.button
          whileHover={canConfirm ? { scale: 1.06, y: -3 } : {}}
          whileTap={canConfirm ? { scale: 0.97 } : {}}
          onClick={() => canConfirm && onDone([...selected])}
          animate={canConfirm ? { boxShadow: ["0 0 20px #cc44ff44", "0 0 40px #cc44ff88", "0 0 20px #cc44ff44"] } : {}}
          transition={canConfirm ? { duration: 1.4, repeat: Infinity } : {}}
          style={{
            padding: "14px 56px",
            background: canConfirm
              ? "linear-gradient(135deg, #6600aa, #cc44ff)"
              : "rgba(255,255,255,0.04)",
            border: `2px solid ${canConfirm ? "#cc44ff" : "#252535"}`,
            borderRadius: 14,
            color: canConfirm ? "#fff" : "#334",
            fontSize: 13, fontWeight: 900, letterSpacing: 6,
            cursor: canConfirm ? "pointer" : "default",
            fontFamily: "inherit",
          }}
        >
          {canConfirm ? "ADD TO COLLECTION" : `SELECT ${pickCount - selected.size} MORE`}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
