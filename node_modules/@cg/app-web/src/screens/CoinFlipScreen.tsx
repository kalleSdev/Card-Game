import { useState } from "react";
import type { PlayerId } from "@cg/contracts";
import type { PlayerIcons, PlayerNames } from "../types";
import { BG } from "../backgrounds";
import PlayerIcon from "../components/PlayerIcon";

function PlayerSide({ pid, playerNames, playerIcons, isWinner, isLoser }: {
  pid: PlayerId; playerNames: PlayerNames; playerIcons: PlayerIcons;
  isWinner: boolean; isLoser: boolean;
}) {
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: pid === "P1" ? "flex-start" : "flex-end",
      padding: "0 32px",
      opacity: isLoser ? 0.25 : 1,
      transition: "opacity 0.6s, filter 0.6s",
      filter: isWinner ? `drop-shadow(0 0 24px ${pColor}88)` : "none",
    }}>
      {/* Icon */}
      <div style={{
        marginBottom: 12,
        borderRadius: 10,
        border: `2px solid ${isWinner ? pColor : "#1a1a28"}`,
        boxShadow: isWinner ? `0 0 32px ${pColor}88, 0 0 64px ${pColor}44` : "none",
        transition: "all 0.6s",
        overflow: "hidden",
        background: isWinner ? `${pColor}11` : "transparent",
      }}>
        <PlayerIcon icon={playerIcons[pid]} size={56} />
      </div>

      {/* Name */}
      <div style={{
        fontSize: 20, fontWeight: 900,
        color: isWinner ? pColor : "#444",
        letterSpacing: 2,
        textShadow: isWinner ? `0 0 20px ${pColor}` : "none",
        transition: "all 0.6s",
        textAlign: pid === "P1" ? "left" : "right",
      }}>
        {playerNames[pid].toUpperCase()}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 9, color: "#333", letterSpacing: 3, marginTop: 4,
        textAlign: pid === "P1" ? "left" : "right",
      }}>
        {pid}
      </div>

      {isWinner && (
        <div style={{
          marginTop: 12, fontSize: 11, letterSpacing: 3,
          color: pColor, fontWeight: "bold",
          animation: "fadeUp 0.5s ease-out both",
        }}>
          PICKS FIRST ✦
        </div>
      )}
    </div>
  );
}

export default function CoinFlipScreen({ onFlip, playerNames, playerIcons }: {
  onFlip: (firstPicker: PlayerId) => void;
  playerNames: PlayerNames;
  playerIcons: PlayerIcons;
}) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing" | "done">("idle");
  const [result, setResult] = useState<PlayerId | null>(null);

  const flip = () => {
    if (phase !== "idle") return;
    setPhase("spinning");
    const winner: PlayerId = Math.random() < 0.5 ? "P1" : "P2";
    setTimeout(() => { setResult(winner); setPhase("landing"); }, 1800);
    setTimeout(() => setPhase("done"), 2500);
  };

  const pColor = result === "P1" ? "#4a9eff" : result === "P2" ? "#ff6666" : "#ffd700";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      backgroundImage: BG.coinflip, backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>

      {/* Light fade overlay — same as BindingVow */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.45)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: 7, color: "#2a2a2a", marginBottom: 8 }}>
          BEFORE THE DRAFT
        </div>
        <div style={{ fontSize: 28, fontWeight: "bold", letterSpacing: 5, color: "#fff" }}>
          COIN FLIP
        </div>
      </div>

      {/* Main row: P1 | coin area | P2 */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", maxWidth: 860, gap: 0,
      }}>

        {/* P1 */}
        <PlayerSide
          pid="P1"
          playerNames={playerNames}
          playerIcons={playerIcons}
          isWinner={phase === "done" && result === "P1"}
          isLoser={phase === "done" && result === "P2"}
        />

        {/* Center — coin on table */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 0, flexShrink: 0, width: 200,
        }}>
          {/* Coin */}
          <div style={{
            fontSize: 84,
            lineHeight: 1,
            userSelect: "none",
            animation: phase === "spinning"
              ? "coinSpin 0.25s linear infinite"
              : phase === "landing"
                ? "coinLand 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards"
                : "none",
            filter: phase === "done" && result
              ? `drop-shadow(0 0 16px ${pColor}) drop-shadow(0 0 32px ${pColor}66)`
              : phase === "spinning"
                ? "drop-shadow(0 0 8px #ffd70055)"
                : "none",
            transition: "filter 0.5s",
            cursor: phase === "idle" ? "pointer" : "default",
            marginBottom: 0,
          }}
            onClick={phase === "idle" ? flip : undefined}
          >
            🪙
          </div>

          {/* Table surface */}
          <div style={{
            width: 140, height: 8, borderRadius: "50%",
            background: "radial-gradient(ellipse at center, #3a2a18 0%, #1a0e08 50%, transparent 100%)",
            margin: "2px 0 4px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }} />
          <div style={{
            width: "100%", height: 3,
            background: "linear-gradient(90deg, transparent, #3a2a1a 20%, #5a4028 50%, #3a2a1a 80%, transparent)",
            borderRadius: 2,
            boxShadow: "0 1px 8px rgba(0,0,0,0.8)",
          }} />

          {/* Flip prompt / status */}
          <div style={{ marginTop: 20, textAlign: "center", minHeight: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {phase === "idle" && (
              <div style={{ animation: "fadeUp 0.4s ease-out" }}>
                <div style={{ fontSize: 11, color: "#333", marginBottom: 14, letterSpacing: 1 }}>
                  click the coin — or
                </div>
                <button onClick={flip} style={{
                  padding: "10px 36px",
                  background: "linear-gradient(135deg, #0d0d24, #0a0a1e)",
                  border: "1px solid #4a4a88",
                  borderRadius: 10, color: "#8888cc", fontWeight: "bold", cursor: "pointer",
                  fontSize: 14, letterSpacing: 3,
                  boxShadow: "0 0 14px #4a4a8833",
                }}>
                  FLIP
                </button>
              </div>
            )}
            {phase === "spinning" && (
              <div style={{ fontSize: 13, color: "#2a2a2a", letterSpacing: 4, animation: "blink 0.4s linear infinite" }}>
                FLIPPING...
              </div>
            )}
            {(phase === "landing" || phase === "done") && result && (
              <div style={{ animation: "revealResult 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both" }}>
                {phase === "done" && (
                  <button
                    onClick={() => onFlip(result)}
                    style={{
                      padding: "10px 36px",
                      background: "linear-gradient(135deg, #0a1800, #051000)",
                      border: `2px solid ${pColor}88`,
                      borderRadius: 10, color: pColor, fontWeight: "bold", cursor: "pointer",
                      fontSize: 13, letterSpacing: 3,
                      boxShadow: `0 0 18px ${pColor}33`,
                      animation: "fadeUp 0.4s 0.1s ease-out both",
                    }}
                  >
                    START DRAFT →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* P2 */}
        <PlayerSide
          pid="P2"
          playerNames={playerNames}
          playerIcons={playerIcons}
          isWinner={phase === "done" && result === "P2"}
          isLoser={phase === "done" && result === "P1"}
        />
      </div>

      <style>{`
        @keyframes coinSpin {
          0%   { transform: rotateY(0deg) scaleX(1); }
          25%  { transform: rotateY(90deg) scaleX(0.05); }
          50%  { transform: rotateY(180deg) scaleX(1); }
          75%  { transform: rotateY(270deg) scaleX(0.05); }
          100% { transform: rotateY(360deg) scaleX(1); }
        }
        @keyframes coinLand {
          0%   { transform: rotateY(720deg) scaleX(1) translateY(-10px); }
          60%  { transform: rotateY(20deg) scaleX(1) translateY(4px); }
          80%  { transform: rotateY(-8deg) scaleX(1) translateY(0px); }
          100% { transform: rotateY(0deg) scaleX(1) translateY(0px); }
        }
        @keyframes fadeUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes blink { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes revealResult { from { transform: scale(0.7) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
