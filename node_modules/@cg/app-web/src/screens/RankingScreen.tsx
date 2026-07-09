import { motion } from "framer-motion";
import { BG } from "../backgrounds";
import type { Profile } from "../profiles";
import PlayerIcon from "../components/PlayerIcon";

function totalWins(p: Profile): number {
  return (p.quickStats?.wins ?? 0) + (p.draftStats?.wins ?? 0) + (p.normalStats?.wins ?? 0);
}

const MEDAL = ["🥇", "🥈", "🥉"] as const;
const MEDAL_COLOR = ["#ffd700", "#c0c0c0", "#cd7f32"] as const;
const MEDAL_GLOW  = ["#ffd70066", "#c0c0c066", "#cd7f3266"] as const;

export default function RankingScreen({ profiles, onBack }: { profiles: Profile[]; onBack: () => void }) {
  const sorted = [...profiles].sort((a, b) => totalWins(b) - totalWins(a));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      backgroundImage: BG.home,
      backgroundSize: "cover",
      backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflowY: "auto",
      position: "relative",
    }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(2,2,10,0.72)", pointerEvents: "none", zIndex: 0 }} />

      <button
        onClick={onBack}
        style={{
          position: "fixed", top: 18, left: 18, zIndex: 20,
          padding: "8px 18px", background: "rgba(255,255,255,0.04)",
          border: "1px solid #2a2a3a", borderRadius: 8,
          color: "#aaa", cursor: "pointer", fontSize: 11,
          letterSpacing: 2, fontFamily: "inherit",
        }}
      >
        ← BACK
      </button>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, paddingBottom: 60 }}>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.175, 0.885, 0.32, 1.275] }}
          style={{ textAlign: "center", marginBottom: 40 }}
        >
          <motion.div
            animate={{ textShadow: ["0 0 30px #ffd700aa, 0 0 80px #ffd70044", "0 0 60px #ffd700dd, 0 0 140px #ffd70088", "0 0 30px #ffd700aa, 0 0 80px #ffd70044"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: 52, fontWeight: 900, letterSpacing: 16, color: "#ffd700" }}
          >
            RANKING
          </motion.div>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "#806020", marginTop: 6 }}>GLOBAL LEADERBOARD</div>
          <motion.div
            animate={{ scaleX: [0.4, 1, 0.4], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              height: 1, width: 220, margin: "14px auto 0",
              background: "linear-gradient(90deg, transparent, #ffd70088, rgba(255,255,255,0.6), #ffd70088, transparent)",
              borderRadius: 1,
            }}
          />
        </motion.div>

        {/* Top 3 podium */}
        {top3.length > 0 && (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 40 }}>
            {/* Order: 2nd, 1st, 3rd for podium look */}
            {[top3[1], top3[0], top3[2]].map((profile, podiumIdx) => {
              if (!profile) return <div key={podiumIdx} style={{ width: 144 }} />;
              const rankIdx = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2;
              const wins = totalWins(profile);
              const isFirst = rankIdx === 0;
              const isThird = rankIdx === 2;
              const color = MEDAL_COLOR[rankIdx];
              const glow  = MEDAL_GLOW[rankIdx];
              const iconSize = isFirst ? 72 : 56;
              // Base card sizes, reduced ~10%
              const cardW = isFirst ? 162 : 140;
              const cardH = isFirst ? 198 : 162;

              return (
                <div key={profile.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: isThird ? 10 : 0 }}>
                  {/* Crown floats ABOVE first place panel only */}
                  {isFirst && (
                    <motion.div
                      animate={{
                        filter: [
                          "drop-shadow(0 0 6px #ffd700) drop-shadow(0 0 16px #ff4400)",
                          "drop-shadow(0 0 12px #ff00ff) drop-shadow(0 0 24px #0088ff)",
                          "drop-shadow(0 0 8px #00ff88) drop-shadow(0 0 20px #ffd700)",
                          "drop-shadow(0 0 6px #ffd700) drop-shadow(0 0 16px #ff4400)",
                        ],
                        y: [0, -4, 0],
                      }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      style={{ fontSize: 32, lineHeight: 1, marginBottom: 6, userSelect: "none" }}
                    >
                      👑
                    </motion.div>
                  )}
                  {!isFirst && <div style={{ height: 38 }} />}

                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 + rankIdx * 0.1, ease: "easeOut" }}
                    style={{
                      width: cardW,
                      height: cardH,
                      background: "rgba(10,8,20,0.88)",
                      border: `2px solid ${color}55`,
                      borderRadius: 16,
                      boxShadow: `0 0 32px ${glow}, 0 8px 40px rgba(0,0,0,0.7)`,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 8, padding: "14px 12px",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {/* Shimmer */}
                    <motion.div
                      animate={{ left: ["-50%", "150%"] }}
                      transition={{ duration: isFirst ? 1.8 : 2.6, repeat: Infinity, ease: "linear", delay: rankIdx * 0.4 }}
                      style={{
                        position: "absolute", top: 0, bottom: 0, width: "35%",
                        background: `linear-gradient(90deg, transparent, ${color}18, transparent)`,
                        transform: "skewX(-12deg)", pointerEvents: "none",
                      }}
                    />

                    {/* Medal */}
                    <div style={{ fontSize: isFirst ? 26 : 20, lineHeight: 1 }}>{MEDAL[rankIdx]}</div>

                    {/* Player icon */}
                    <div style={{ boxShadow: `0 0 18px ${glow}`, borderRadius: "50%" }}>
                      <PlayerIcon icon={profile.icon} size={iconSize} style={{ display: "block" }} />
                    </div>

                    {/* Name */}
                    <div style={{
                      fontSize: isFirst ? 13 : 11, fontWeight: 900, letterSpacing: 1,
                      color: color, textAlign: "center", maxWidth: "100%",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      width: "100%", padding: "0 6px",
                    }}>{profile.name}</div>

                    {/* Wins (smaller, below name) */}
                    <div style={{ fontSize: isFirst ? 18 : 15, fontWeight: 900, color: "#ffd700", lineHeight: 1 }}>
                      {wins}
                      <span style={{ fontSize: 9, color: "#806020", letterSpacing: 2, marginLeft: 4 }}>WINS</span>
                    </div>

                    {/* Breakdown */}
                    <div style={{ fontSize: 9, color: "#668", letterSpacing: 1, textAlign: "center", lineHeight: 1.7 }}>
                      Q:{profile.quickStats.wins} · D:{profile.draftStats.wins} · N:{profile.normalStats.wins}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rest of the list */}
        {rest.length > 0 && (
          <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#334", textAlign: "center", marginBottom: 8 }}>
              — MORE PLAYERS —
            </div>
            {rest.map((profile, i) => {
              const rank = i + 4;
              const wins = totalWins(profile);
              return (
                <motion.div
                  key={profile.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.05 * i, ease: "easeOut" }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    background: "rgba(10,8,20,0.75)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10, padding: "10px 16px",
                  }}
                >
                  <div style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 900, color: "#445", flexShrink: 0 }}>
                    #{rank}
                  </div>
                  <PlayerIcon icon={profile.icon} size={36} style={{ display: "block", flexShrink: 0, borderRadius: "50%" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#ccc" }}>{profile.name}</div>
                    <div style={{ fontSize: 9, color: "#445", letterSpacing: 1, marginTop: 2 }}>
                      Q:{profile.quickStats.wins} · D:{profile.draftStats.wins} · N:{profile.normalStats.wins}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#ffd700", flexShrink: 0 }}>
                    {wins}
                    <span style={{ fontSize: 8, color: "#806020", letterSpacing: 2, marginLeft: 4 }}>W</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {sorted.length === 0 && (
          <div style={{ color: "#445", fontSize: 13, letterSpacing: 4, marginTop: 40 }}>
            NO PROFILES YET
          </div>
        )}
      </div>
    </div>
  );
}
