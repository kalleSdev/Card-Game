import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { CardDef, PlayerDraftResult } from "@cg/contracts";
import { useOnlineMatch } from "../online/useOnlineMatch";
import BattleBoardScreen from "./BattleBoardScreen";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import { COLOR } from "../theme";

// Queues you up, then hands the board a binding once the server pairs you.
export default function OnlineScreen({
  cardDb, draft, username, onLeave,
}: {
  cardDb: Record<string, CardDef>;
  draft: PlayerDraftResult;
  username: string;
  onLeave: () => void;
}) {
  const match = useOnlineMatch(true);
  const [queued, setQueued] = useState(false);

  // Queue as soon as the socket is authenticated
  useEffect(() => {
    if (match.status === "ready" && !queued) {
      match.queue(draft);
      setQueued(true);
    }
  }, [match, queued, draft]);

  if (match.status === "playing" && match.state && match.you) {
    return (
      <BattleBoardScreen
        online={{
          you: match.you,
          opponentName: match.opponentName ?? "Opponent",
          state: match.state,
          events: match.events,
          send: match.send,
        }}
        // The board still wants these for names and icons
        p1Draft={draft}
        p2Draft={draft}
        cardDb={cardDb}
        p1Name={match.you === "P1" ? username : match.opponentName ?? "Opponent"}
        p2Name={match.you === "P2" ? username : match.opponentName ?? "Opponent"}
        p1Icon="player-1"
        p2Icon="player-7"
        onGameOver={onLeave}
      />
    );
  }

  const message =
    match.status === "connecting"    ? "Connecting to the server"
    : match.status === "ready"       ? "Getting you in the queue"
    : match.status === "queued"      ? "Looking for an opponent"
    : match.status === "opponentLeft"? "Your opponent left the match"
    : "Not connected";

  return (
    <div style={{
      minHeight: "100vh", background: COLOR.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 20, fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden",
    }}>
      <AmbientCanvas intensity={0.35} />
      <AmbientOverlay />

      <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{ fontSize: 18, fontWeight: 900, letterSpacing: 4, color: "#fff" }}
        >
          {message.toUpperCase()}
        </motion.div>
        <div style={{ fontSize: 10, color: "#556", letterSpacing: 2, marginTop: 10 }}>
          Signed in as {username}
        </div>
        {match.error && (
          <div style={{ fontSize: 10, color: "#ff8888", marginTop: 14 }}>{match.error}</div>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={() => match.practice(draft)}
        disabled={match.status === "connecting"}
        style={{
          position: "relative", zIndex: 2, marginTop: 8,
          padding: "11px 30px", borderRadius: 9,
          background: "rgba(120,80,255,0.14)", border: "1px solid #6a4aff",
          color: "#cbb8ff", fontSize: 11, letterSpacing: 3, fontWeight: 800,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >PLAY THE COMPUTER</motion.button>

      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={() => { match.leave(); onLeave(); }}
        style={{
          position: "relative", zIndex: 2, marginTop: 2,
          padding: "9px 26px", borderRadius: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a3a",
          color: "#667", fontSize: 10, letterSpacing: 3,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >LEAVE</motion.button>
    </div>
  );
}
