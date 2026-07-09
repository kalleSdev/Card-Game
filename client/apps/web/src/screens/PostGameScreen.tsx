import { motion } from "framer-motion";
import type { PlayerId, CardDef } from "@cg/contracts";
import type { Profile } from "../profiles";
import type { PlayerDraftResult } from "./DraftBattleScreen";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";

interface Props {
  winner: PlayerId;
  p1Profile: Profile;
  p2Profile: Profile;
  p1Draft: PlayerDraftResult;
  p2Draft: PlayerDraftResult;
  cardDb: Record<string, CardDef>;
  turnCount: number;
  onPlayAgain: () => void;
  onMenu: () => void;
}

// Two rows of cards (up to 5 per row) at a reasonable size
function DeckGrid({ ids, cardDb, color }: { ids: string[]; cardDb: Record<string, CardDef>; color: string }) {
  const rows = [ids.slice(0, 5), ids.slice(5, 10)];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      {rows.map((row, ri) =>
        row.length > 0 ? (
          <div key={ri} style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {row.map((id, ci) => {
              const def = cardDb[id];
              if (!def) return null;
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (ri * 5 + ci) * 0.04 }}
                  style={{ transform: "scale(0.80)", transformOrigin: "center top" }}
                >
                  <CharacterCard defId={id} def={def} size="sm" />
                </motion.div>
              );
            })}
          </div>
        ) : null
      )}
    </div>
  );
}

function PlayerPanel({
  profile, draft, cardDb, isWinner, color, side,
}: {
  profile: Profile; draft: PlayerDraftResult; cardDb: Record<string, CardDef>;
  isWinner: boolean; color: string; side: "left" | "right";
}) {
  const leaderDef = cardDb[draft.leaderId];
  const deckIds   = [...draft.combatIds, ...draft.supportIds, ...draft.extraIds];
  const wins   = (profile.quickStats?.wins ?? 0) + (profile.draftStats?.wins ?? 0);
  const losses = (profile.quickStats?.losses ?? 0) + (profile.draftStats?.losses ?? 0);
  const wlPct  = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) + "%" : "—";

  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -50 : 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      style={{
        flex: 1, maxWidth: 480,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        padding: "20px 24px 18px", borderRadius: 20,
        background: isWinner
          ? `radial-gradient(ellipse at 50% 0%, ${color}25, rgba(4,4,12,0.97))`
          : "rgba(4,4,12,0.9)",
        border: `2px solid ${isWinner ? color + "88" : "#181828"}`,
        boxShadow: isWinner ? `0 0 90px ${color}33, 0 0 30px ${color}22, 0 8px 40px rgba(0,0,0,0.6)` : "0 4px 24px rgba(0,0,0,0.5)",
        position: "relative", overflow: "visible",
      }}
    >
      {/* Animated winner shimmer */}
      {isWinner && (
        <motion.div
          animate={{ opacity: [0.2, 0.55, 0.2] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${color}1a, transparent 65%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Result badge */}
      {isWinner ? (
        <motion.div
          animate={{ boxShadow: [`0 0 16px ${color}66`, `0 0 36px ${color}cc`, `0 0 16px ${color}66`] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{
            padding: "6px 24px", borderRadius: 20,
            background: color,
            fontSize: 11, fontWeight: 900, letterSpacing: 5,
            color: "#000",
          }}
        >🏆 WINNER</motion.div>
      ) : (
        <div style={{
          padding: "4px 18px", borderRadius: 20,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid #1a1a2a",
          fontSize: 9, fontWeight: 700, letterSpacing: 4, color: "#2a2a3a",
        }}>DEFEATED</div>
      )}

      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <motion.div
          animate={isWinner ? { boxShadow: [`0 0 20px ${color}55`, `0 0 40px ${color}88`, `0 0 20px ${color}55`] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            width: 64, height: 64, borderRadius: "50%",
            border: `3px solid ${color}`,
            overflow: "hidden",
          }}
        >
          <PlayerIcon icon={profile.icon} size={64} style={{ display: "block" }} />
        </motion.div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{profile.name}</div>
          <div style={{ fontSize: 8, color: color, letterSpacing: 3, marginTop: 2 }}>
            PLAYER {color === "#4a9eff" ? "1" : "2"}
          </div>
        </div>
      </div>

      {/* Leader + label */}
      {leaderDef && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: "#334", letterSpacing: 3 }}>LEADER</div>
          <div style={{ transform: "scale(0.70)", transformOrigin: "center top" }}>
            <CharacterCard defId={draft.leaderId} def={leaderDef} size="lg" />
          </div>
        </div>
      )}

      {/* Drafted deck in rows */}
      <div style={{ width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "#334", letterSpacing: 3, marginBottom: 10 }}>DRAFTED DECK</div>
        <DeckGrid ids={deckIds} cardDb={cardDb} color={color} />
      </div>

      {/* Stats */}
      <div style={{
        display: "flex", gap: 0, width: "100%",
        borderTop: "1px solid #1a1a2a", paddingTop: 14, marginTop: 2,
      }}>
        {[
          { label: "DRAFT WINS",   value: String(profile.draftStats?.wins ?? 0),   c: "#44ff88" },
          { label: "DRAFT LOSSES", value: String(profile.draftStats?.losses ?? 0),  c: "#ff4466" },
          { label: "WIN RATE",     value: wlPct,                                     c: color },
        ].map(({ label, value, c }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{value}</div>
            <div style={{ fontSize: 7, color: "#334", letterSpacing: 2, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function PostGameScreen({
  winner, p1Profile, p2Profile, p1Draft, p2Draft, cardDb, turnCount, onPlayAgain, onMenu,
}: Props) {
  const winnerProfile = winner === "P1" ? p1Profile : p2Profile;
  const winnerColor   = winner === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.90)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <div style={{
        position: "relative", zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "28px 24px 24px", gap: 20, width: "100%", maxWidth: 1060,
        overflowY: "auto",
      }}>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center" }}
        >
          <div style={{ fontSize: 10, letterSpacing: 5, color: "#334", marginBottom: 6 }}>BATTLE OVER</div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 3, color: "#778", marginBottom: 4 }}>
            Winner
          </div>
          <motion.div
            animate={{ textShadow: [`0 0 30px ${winnerColor}88`, `0 0 60px ${winnerColor}cc`, `0 0 30px ${winnerColor}88`] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ fontSize: 38, fontWeight: 900, letterSpacing: 3, color: winnerColor, marginBottom: 4 }}
          >
            {winnerProfile.name}
          </motion.div>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 3 }}>
            {turnCount} TURNS · DRAFT BATTLE
          </div>
        </motion.div>

        {/* Player panels */}
        <div style={{ display: "flex", gap: 18, width: "100%", alignItems: "flex-start" }}>
          <PlayerPanel
            profile={p1Profile} draft={p1Draft} cardDb={cardDb}
            isWinner={winner === "P1"} color="#4a9eff" side="left"
          />

          {/* Center divider */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 10, paddingTop: 90, flexShrink: 0,
          }}>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontSize: 26, fontWeight: 900, color: "#ff3333" }}
            >VS</motion.div>
            <div style={{ width: 2, height: 100, background: "linear-gradient(to bottom, transparent, #ff333444, transparent)" }} />
          </div>

          <PlayerPanel
            profile={p2Profile} draft={p2Draft} cardDb={cardDb}
            isWinner={winner === "P2"} color="#ff6666" side="right"
          />
        </div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ display: "flex", gap: 14 }}
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onPlayAgain}
            style={{
              padding: "12px 38px",
              background: `linear-gradient(135deg, ${winnerColor}88, ${winnerColor})`,
              border: "none", borderRadius: 12,
              color: "#000", fontSize: 12, fontWeight: 900, letterSpacing: 5,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: `0 0 28px ${winnerColor}44`,
            }}
          >PLAY AGAIN</motion.button>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onMenu}
            style={{
              padding: "12px 38px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid #252535", borderRadius: 12,
              color: "#556", fontSize: 12, fontWeight: 700, letterSpacing: 5,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >MAIN MENU</motion.button>
        </motion.div>
      </div>
    </div>
  );
}
