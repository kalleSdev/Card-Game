import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import type { CardDef, PlayerDraftResult } from "@cg/contracts";
import { useOnlineMatch } from "../online/useOnlineMatch";
import BattleBoardScreen from "./BattleBoardScreen";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import { COLOR } from "../theme";

function btn(border: string, color: string): CSSProperties {
  return {
    padding: "10px 24px", borderRadius: 9,
    background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`,
    color, fontSize: 10, letterSpacing: 3, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
  };
}

// Lobby. You either open a room and pass the code on, or type in a code you
// were given. There is no global queue, so you only ever play someone you asked.
export default function OnlineScreen({
  cardDb, draft, username, joinCode, onLeave,
}: {
  cardDb: Record<string, CardDef>;
  draft: PlayerDraftResult;
  username: string;
  /** Code lifted out of an invite link, if the player arrived through one. */
  joinCode?: string;
  onLeave: () => void;
}) {
  const match = useOnlineMatch(true);
  const [code, setCode] = useState(joinCode ?? "");
  const [copied, setCopied] = useState(false);
  const [autoJoined, setAutoJoined] = useState(false);

  // Arriving through an invite link should not need a second click
  useEffect(() => {
    if (joinCode && !autoJoined && match.status === "ready") {
      match.join(joinCode, draft);
      setAutoJoined(true);
    }
  }, [joinCode, autoJoined, match, draft]);

  if (match.status === "playing" && match.state && match.you) {
    return (
      <BattleBoardScreen
        online={{
          you: match.you,
          opponentName: match.opponentName ?? "Opponent",
          state: match.state,
          events: match.events,
          send: match.send,
          surrender: match.surrender,
          opponentAway: match.opponentAway,
        }}
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

  const inviteLink = match.lobbyCode
    ? `${window.location.origin}${window.location.pathname}?join=${match.lobbyCode}`
    : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const busy = match.status === "connecting" || match.status === "disconnected";

  return (
    <div style={{
      minHeight: "100vh", background: COLOR.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 22, fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden",
      padding: "40px 20px",
    }}>
      <AmbientCanvas intensity={0.35} />
      <AmbientOverlay />

      <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 5, color: "#fff" }}>PLAY A FRIEND</div>
        <div style={{ fontSize: 10, color: "#556", letterSpacing: 2, marginTop: 8 }}>
          Signed in as {username}{busy ? " · connecting" : ""}
        </div>
      </div>

      {/* One panel or the other. Not an AnimatePresence swap: a stalled exit
          would leave both on screen at once. */}
      {match.lobbyCode ? (
          <motion.div
            key="hosting"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: "relative", zIndex: 2, textAlign: "center",
              padding: "26px 34px", borderRadius: 14,
              background: "rgba(10,10,22,0.9)", border: "1px solid #2f2f4a",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            }}
          >
            <div style={{ fontSize: 9, color: "#667", letterSpacing: 3 }}>YOUR LOBBY CODE</div>
            <div style={{
              fontSize: 40, fontWeight: 900, letterSpacing: 12,
              color: "#fff", textShadow: "0 0 24px rgba(120,140,255,0.5)",
              paddingLeft: 12,
            }}>{match.lobbyCode}</div>

            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ fontSize: 10, color: "#8899bb", letterSpacing: 2 }}
            >WAITING FOR THEM TO JOIN</motion.div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={copyLink} style={btn("#6a4aff", "#cbb8ff")}>
                {copied ? "LINK COPIED" : "COPY INVITE LINK"}
              </button>
              <button onClick={match.cancelHosting} style={btn("#33334a", "#778")}>CANCEL</button>
            </div>
          </motion.div>
      ) : (
        <motion.div
          key="idle"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: "relative", zIndex: 2,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
            }}
          >
            <button
              onClick={() => match.host(draft)}
              disabled={busy}
              style={{ ...btn("#4a9eff", "#cfe6ff"), padding: "14px 40px", fontSize: 12 }}
            >CREATE A LOBBY</button>

            <div style={{ fontSize: 9, color: "#445", letterSpacing: 3 }}>OR JOIN WITH A CODE</div>

            <form
              onSubmit={e => { e.preventDefault(); if (code.trim()) match.join(code, draft); }}
              style={{ display: "flex", gap: 8 }}
            >
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="ABCDE"
                maxLength={8}
                style={{
                  width: 150, padding: "11px 14px", borderRadius: 9,
                  background: "rgba(255,255,255,0.04)", border: "1px solid #2f2f4a",
                  color: "#fff", fontSize: 16, letterSpacing: 6, textAlign: "center",
                  fontFamily: "inherit", fontWeight: 800, outline: "none",
                }}
              />
              <button type="submit" disabled={busy || !code.trim()} style={btn("#2f2f4a", "#aab")}>JOIN</button>
            </form>

            <div style={{ width: 220, height: 1, background: "#22223a", margin: "6px 0" }} />

            <button onClick={() => match.practice(draft)} disabled={busy} style={btn("#6a4aff", "#cbb8ff")}>
              PLAY THE COMPUTER
            </button>
        </motion.div>
      )}

      <div style={{ position: "relative", zIndex: 2, textAlign: "center", minHeight: 18 }}>
        {match.endedBecause && (
          <div style={{ fontSize: 10, color: "#889", letterSpacing: 2 }}>{match.endedBecause}</div>
        )}
        {match.status === "opponentLeft" && (
          <div style={{ fontSize: 10, color: "#889", letterSpacing: 2 }}>Your opponent left the match</div>
        )}
        {match.error && (
          <div style={{ fontSize: 10, color: "#ff8888" }}>{match.error}</div>
        )}
      </div>

      <button
        onClick={() => { match.leave(); onLeave(); }}
        style={{ ...btn("#26263a", "#667"), position: "relative", zIndex: 2 }}
      >BACK</button>
    </div>
  );
}
