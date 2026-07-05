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

function MiniCard({ id, cardDb }: { id: string; cardDb: Record<string, CardDef> }) {
  const def = cardDb[id];
  if (!def) return null;
  return (
    <div style={{ transform: "scale(0.48)", transformOrigin: "center top" }}>
      <CharacterCard defId={id} def={def} size="sm" />
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
  const allCards = [...draft.combatIds, ...draft.supportIds, ...draft.extraIds];
  const wins = (profile.quickStats?.wins ?? 0) + (profile.draftStats?.wins ?? 0);
  const losses = (profile.quickStats?.losses ?? 0) + (profile.draftStats?.losses ?? 0);
  const wl = losses > 0 ? (wins / (wins + losses) * 100).toFixed(0) + "%" : wins > 0 ? "100%" : "—";

  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      style={{
        flex: 1, maxWidth: 340,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        padding: "28px 24px", borderRadius: 20,
        background: isWinner
          ? `radial-gradient(ellipse at 50% 0%, ${color}18, rgba(4,4,10,0.95))`
          : "rgba(4,4,10,0.88)",
        border: `2px solid ${isWinner ? color + "66" : "#1a1a2a"}`,
        boxShadow: isWinner ? `0 0 60px ${color}22` : "none",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Winner glow pulse */}
      {isWinner && (
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${color}18, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Winner / Loser badge */}
      <div style={{
        padding: "4px 16px", borderRadius: 20,
        background: isWinner ? color : "rgba(255,255,255,0.05)",
        border: `1px solid ${isWinner ? color : "#2a2a3a"}`,
        fontSize: 9, fontWeight: 900, letterSpacing: 4,
        color: isWinner ? "#000" : "#334",
      }}>
        {isWinner ? "🏆 WINNER" : "DEFEATED"}
      </div>

      {/* Avatar */}
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        border: `3px solid ${color}`,
        overflow: "hidden",
        boxShadow: isWinner ? `0 0 28px ${color}66` : "none",
      }}>
        <PlayerIcon icon={profile.icon} size={72} style={{ display: "block" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{profile.name}</div>
        <div style={{ fontSize: 9, color: color, letterSpacing: 3 }}>PLAYER {color === "#4a9eff" ? "1" : "2"}</div>
      </div>

      {/* Leader card */}
      {leaderDef && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 8, color: "#334", letterSpacing: 3, marginBottom: 2 }}>LEADER</div>
          <div style={{ transform: "scale(0.85)", transformOrigin: "center top" }}>
            <CharacterCard defId={draft.leaderId} def={leaderDef} size="lg" />
          </div>
        </div>
      )}

      {/* Deck composition */}
      <div style={{ width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "#334", letterSpacing: 3, marginBottom: 8 }}>DRAFTED DECK</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
          {allCards.map((id, i) => <MiniCard key={`${id}-${i}`} id={id} cardDb={cardDb} />)}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: "flex", gap: 16, justifyContent: "center", width: "100%",
        borderTop: "1px solid #1a1a2a", paddingTop: 12,
      }}>
        {[
          { label: "DRAFT W", value: String(profile.draftStats?.wins ?? 0) },
          { label: "DRAFT L", value: String(profile.draftStats?.losses ?? 0) },
          { label: "WIN RATE", value: wl },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{value}</div>
            <div style={{ fontSize: 7, color: "#334", letterSpacing: 2 }}>{label}</div>
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.88)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <div style={{
        position: "relative", zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "40px 24px 32px", gap: 32, width: "100%", maxWidth: 820,
      }}>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center" }}
        >
          <motion.div
            animate={{ textShadow: [`0 0 40px ${winnerColor}66`, `0 0 80px ${winnerColor}aa`, `0 0 40px ${winnerColor}66`] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ fontSize: 42, fontWeight: 900, letterSpacing: 6, color: winnerColor, marginBottom: 8 }}
          >
            BATTLE OVER
          </motion.div>
          <div style={{ fontSize: 14, color: "#fff", fontWeight: 700, letterSpacing: 2 }}>
            {winnerProfile.name} claims victory
          </div>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 3, marginTop: 6 }}>
            {turnCount} TURNS PLAYED · DRAFT BATTLE
          </div>
        </motion.div>

        {/* Player panels side by side */}
        <div style={{ display: "flex", gap: 20, width: "100%", alignItems: "flex-start" }}>
          <PlayerPanel
            profile={p1Profile} draft={p1Draft} cardDb={cardDb}
            isWinner={winner === "P1"} color="#4a9eff" side="left"
          />

          {/* Center divider */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 80 }}>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ fontSize: 28, fontWeight: 900, color: "#ff3333" }}
            >VS</motion.div>
            <div style={{ width: 2, height: 120, background: "linear-gradient(to bottom, transparent, #ff333344, transparent)" }} />
          </div>

          <PlayerPanel
            profile={p2Profile} draft={p2Draft} cardDb={cardDb}
            isWinner={winner === "P2"} color="#ff6666" side="right"
          />
        </div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          style={{ display: "flex", gap: 16 }}
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onPlayAgain}
            style={{
              padding: "13px 40px",
              background: `linear-gradient(135deg, ${winnerColor}99, ${winnerColor})`,
              border: "none", borderRadius: 12,
              color: "#000", fontSize: 13, fontWeight: 900, letterSpacing: 5,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: `0 0 32px ${winnerColor}44`,
            }}
          >PLAY AGAIN</motion.button>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onMenu}
            style={{
              padding: "13px 40px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid #2a2a3a", borderRadius: 12,
              color: "#667", fontSize: 13, fontWeight: 700, letterSpacing: 5,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >MAIN MENU</motion.button>
        </motion.div>
      </div>
    </div>
  );
}
