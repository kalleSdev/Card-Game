import { useEffect, useState } from "react";
import { BG } from "../backgrounds";
import type { CardInstance, GameState, PlayerId } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import { SYNERGY_LABEL } from "../constants";
import type { PlayerIcons, PlayerNames } from "../types";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";

type RevealStage = "idle" | "p1" | "p2" | "winner";

// Top-level — avoids remount on ResolutionScreen re-render
function PlayerReveal({ pid, score, active, state, playerNames, playerIcons, maxScore }: {
  pid: PlayerId; score: number; active: boolean;
  state: GameState; playerNames: PlayerNames; playerIcons: PlayerIcons; maxScore: number;
}) {
  const zones = state.players[pid];
  const slots: Array<{ label: string; card: CardInstance | null }> = [
    { label: "Leader",    card: zones.board.leader },
    { label: "Combat 1",  card: zones.board.combat[0] },
    { label: "Combat 2",  card: zones.board.combat[1] },
    { label: "Support 1", card: zones.board.support[0] },
    { label: "Support 2", card: zones.board.support[1] },
    { label: "Support 3", card: zones.board.support[2] },
  ];

  return (
    <div style={{
      flex: 1,
      opacity: active ? 1 : 0.35,
      transition: "opacity 0.6s",
      padding: "0 12px",
    }}>
      <div style={{ fontSize: 18, fontWeight: "bold", color: pid === "P1" ? "#4a9eff" : "#ff6666", marginBottom: 12, letterSpacing: 2, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ borderRadius: 8, overflow: "hidden", border: `2px solid ${pid === "P1" ? "#4a9eff44" : "#ff666644"}`, flexShrink: 0 }}>
          <PlayerIcon icon={playerIcons[pid]} size={52} style={{ display: "block" }} />
        </div>
        <span>{playerNames[pid]}</span>
      </div>

      <div style={{
        fontSize: 48, fontWeight: "bold",
        color: active ? "#ffd700" : "#444",
        letterSpacing: -1, lineHeight: 1, marginBottom: 4,
        fontVariantNumeric: "tabular-nums",
        transition: "color 0.4s",
      }}>
        {score.toLocaleString()}
      </div>

      <div style={{ height: 4, background: "#111", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${(score / maxScore) * 100}%`,
          background: active ? "#ffd700" : "#333",
          borderRadius: 2,
          transition: "width 0.05s linear, background 0.4s",
        }} />
      </div>

      {(() => {
        const domain = state.domainOutcome?.[pid];
        if (!domain) return null;
        return (
          <div style={{
            marginBottom: 8, padding: "5px 10px",
            background: domain.activated ? "#0a0a1a" : "#080808",
            border: `1px solid ${domain.activated ? "#662299" : "#222"}`,
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: domain.activated ? "#cc88ff" : "#444" }}>
              {domain.activated ? "✦" : "○"} {domain.name}
              {domain.clashed && <span style={{ fontSize: 10, color: "#774488", marginLeft: 6 }}>(clash)</span>}
            </span>
            {domain.activated && (
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#cc88ff", marginLeft: 10 }}>
                +{domain.pct}%
              </span>
            )}
          </div>
        );
      })()}

      {state.vowsChosen[pid] && (() => {
        const vowId = state.vowsChosen[pid]!;
        const vow = VOW_DEFS[vowId];
        const outcome = state.vowOutcome?.[pid];
        return (
          <div style={{
            marginBottom: 8, padding: "5px 10px",
            background: "#120800", border: "1px solid #443300", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: "#cc9900" }}>{vow.icon} {vow.name}</span>
            {outcome && outcome.pct !== 0 && (
              <span style={{
                fontSize: 13, fontWeight: "bold",
                color: outcome.pct > 0 ? "#44dd44" : "#dd4444",
                marginLeft: 10,
              }}>
                {outcome.pct > 0 ? "+" : ""}{outcome.pct}%
              </span>
            )}
            {outcome && outcome.pct === 0 && (
              <span style={{ fontSize: 11, color: "#555" }}>—</span>
            )}
          </div>
        );
      })()}

      {zones.activeSynergies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
          {zones.activeSynergies.map(s => (
            <span key={s} style={{ fontSize: 10, color: "#9b59ff", background: "#0f0a1a", border: "1px solid #2a1a4a", borderRadius: 4, padding: "2px 6px" }}>
              {SYNERGY_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {slots.map(({ label, card }) => {
          const def = card ? state.cardDb[card.defId] : null;
          return (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              {def && card ? (
                <CharacterCard defId={card.defId} def={def} size="sm" />
              ) : (
                <div style={{ width: 96, height: 136, borderRadius: 8, border: "1px solid #1a1a2a", background: "#060610", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, color: "#222" }}>—</span>
                </div>
              )}
              <span style={{ fontSize: 8, color: "#444" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResolutionScreen({ state, onRestart, playerNames, playerIcons }: {
  state: GameState; onRestart: () => void; playerNames: PlayerNames; playerIcons: PlayerIcons;
}) {
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [stage, setStage] = useState<RevealStage>("idle");

  const p1Final = state.players.P1.scorePreview;
  const p2Final = state.players.P2.scorePreview;
  const winner: PlayerId | "DRAW" = p1Final > p2Final ? "P1" : p2Final > p1Final ? "P2" : "DRAW";
  const maxScore = Math.max(p1Final, p2Final, 1);

  useEffect(() => {
    const t = setTimeout(() => setStage("p1"), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (stage !== "p1") return;
    let step = 0;
    const totalSteps = 108;
    const id = setInterval(() => {
      step++;
      const progress = 1 - Math.pow(1 - step / totalSteps, 3);
      setP1Score(Math.round(p1Final * progress));
      if (step >= totalSteps) {
        setP1Score(p1Final);
        clearInterval(id);
        setTimeout(() => setStage("p2"), 600);
      }
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [stage, p1Final]);

  useEffect(() => {
    if (stage !== "p2") return;
    let step = 0;
    const totalSteps = 108;
    const id = setInterval(() => {
      step++;
      const progress = 1 - Math.pow(1 - step / totalSteps, 3);
      setP2Score(Math.round(p2Final * progress));
      if (step >= totalSteps) {
        setP2Score(p2Final);
        clearInterval(id);
        setTimeout(() => setStage("winner"), 700);
      }
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [stage, p2Final]);

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.resolution, backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: 32, position: "relative",
    }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.52)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: 11, letterSpacing: 6, color: "#555", marginBottom: 4, textTransform: "uppercase" }}>
        Final Round
      </div>
      <div style={{ fontSize: 28, fontWeight: "bold", letterSpacing: 4, color: "#fff", marginBottom: 32 }}>
        RESOLUTION
      </div>

      <div style={{
        display: "flex", width: "100%", maxWidth: 900, gap: 16,
        marginBottom: 32,
      }}>
        <div style={{ flex: 1, background: "rgba(8,8,18,0.62)", borderRadius: 16, border: "1px solid #1a1a3a", backdropFilter: "blur(6px)", padding: "20px 16px" }}>
          <PlayerReveal pid="P1" score={p1Score} active={stage !== "idle"}
            state={state} playerNames={playerNames} playerIcons={playerIcons} maxScore={maxScore} />
        </div>
        <div style={{ flex: 1, background: "rgba(8,8,18,0.62)", borderRadius: 16, border: "1px solid #1a1a3a", backdropFilter: "blur(6px)", padding: "20px 16px" }}>
          <PlayerReveal pid="P2" score={p2Score} active={stage === "p2" || stage === "winner"}
            state={state} playerNames={playerNames} playerIcons={playerIcons} maxScore={maxScore} />
        </div>
      </div>

      {stage === "winner" && (
        <div style={{ textAlign: "center", animation: "fadeIn 0.6s ease-out" }}>
          {winner === "DRAW" ? (
            <div style={{ fontSize: 32, color: "#888", letterSpacing: 4 }}>DRAW</div>
          ) : (
            <>
              <div style={{ fontSize: 13, letterSpacing: 4, color: "#555", marginBottom: 8 }}>WINNER</div>
              <div style={{
                fontSize: 48, fontWeight: "bold", color: "#ffd700",
                textShadow: "0 0 32px #ffd70088, 0 0 64px #ffd70044",
                letterSpacing: 4,
                display: "flex", alignItems: "center", gap: 12, justifyContent: "center",
              }}>
                <PlayerIcon icon={playerIcons[winner as PlayerId]} size={48} />
                {playerNames[winner as PlayerId].toUpperCase()}
              </div>
              <div style={{ fontSize: 18, color: "#888", marginTop: 8 }}>
                {winner === "P1" ? p1Final.toLocaleString() : p2Final.toLocaleString()} pts
              </div>
            </>
          )}
          <button
            onClick={onRestart}
            style={{
              marginTop: 32, padding: "10px 28px",
              background: "#0a0a0a", border: "1px solid #333",
              borderRadius: 8, color: "#888", fontWeight: "bold",
              cursor: "pointer", fontSize: 13, letterSpacing: 2,
            }}
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      </div> {/* end zIndex:1 wrapper */}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
