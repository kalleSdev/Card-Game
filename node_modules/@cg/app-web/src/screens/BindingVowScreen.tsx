import { useState } from "react";
import type { BindingVowId, GameState, Intent, PlayerId } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import { BG } from "../backgrounds";
import type { PlayerIcons, PlayerNames } from "../types";
import PlayerIcon from "../components/PlayerIcon";

/** Side panel showing a player's identity and their current vow status */
function PlayerStatusPanel({ pid, playerNames, playerIcons, vowChosen, isActive, isReady }: {
  pid: PlayerId; playerNames: PlayerNames; playerIcons: PlayerIcons;
  vowChosen: BindingVowId | null | undefined; isActive: boolean; isReady: boolean;
}) {
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  const vow = vowChosen ? VOW_DEFS[vowChosen] : null;

  return (
    <div style={{
      width: 220, flexShrink: 0,
      padding: "20px 16px",
      background: isActive ? `rgba(8,8,18,0.95)` : "rgba(5,5,12,0.85)",
      border: `1px solid ${isActive ? pColor + "55" : "#1a1a28"}`,
      borderRadius: 14,
      boxShadow: isActive ? `0 0 28px ${pColor}22` : "none",
      transition: "all 0.3s",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Player identity */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        flexDirection: pid === "P1" ? "row" : "row-reverse",
      }}>
        <PlayerIcon icon={playerIcons[pid]} size={42} />
        <div>
          <div style={{ fontSize: 13, fontWeight: "bold", color: isActive ? pColor : "#555" }}>
            {playerNames[pid]}
          </div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#333", marginTop: 2 }}>
            {pid === "P1" ? "PLAYER 1" : "PLAYER 2"}
          </div>
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div style={{
          fontSize: 9, color: pColor, letterSpacing: 3, fontWeight: "bold",
          background: `${pColor}11`, border: `1px solid ${pColor}33`,
          borderRadius: 6, padding: "4px 8px", textAlign: "center",
          animation: "pulseOpacity 1.2s ease-in-out infinite",
        }}>
          ✦ CHOOSING NOW
        </div>
      )}

      {/* Vow status */}
      <div style={{
        flex: 1, padding: "12px 10px",
        background: isReady ? "#0a0a08" : "#08080f",
        border: `1px solid ${isReady ? "#443300" : "#1a1a28"}`,
        borderRadius: 10, minHeight: 80,
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        gap: 6, textAlign: "center",
      }}>
        {isReady ? (
          vow ? (
            <>
              <div style={{ fontSize: 20 }}>{vow.icon}</div>
              <div style={{ fontSize: 12, color: "#cc9900", fontWeight: "bold" }}>{vow.name}</div>
              <div style={{ fontSize: 10, color: "#665544", lineHeight: 1.4 }}>{vow.description}</div>
              <div style={{ fontSize: 10, color: "#44aa44", marginTop: 4 }}>✓ {vow.reward}</div>
              <div style={{ fontSize: 10, color: "#aa4444" }}>✗ {vow.penalty}</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#443333", letterSpacing: 1 }}>— No vow —</div>
          )
        ) : (
          <div style={{ fontSize: 11, color: "#2a2a3a", letterSpacing: 2 }}>
            {isActive ? "deciding..." : "waiting..."}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BindingVowScreen({ state, onSend, playerNames, playerIcons }: {
  state: GameState; onSend: (i: Intent) => void;
  playerNames: PlayerNames; playerIcons: PlayerIcons;
}) {
  const me = state.activePlayerId;
  const [selected, setSelected] = useState<BindingVowId | null | "PASS">(null);
  const vowIds = Object.keys(VOW_DEFS) as BindingVowId[];

  const confirm = () => {
    if (selected === undefined) return;
    onSend({ type: "CHOOSE_VOW", playerId: me, vowId: selected === "PASS" ? null : selected });
    setSelected(null);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#07030a",
      backgroundImage: BG.vow, backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Fixed overlay */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(7,3,10,0.7)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 5, color: "#440022", marginBottom: 4 }}>PHASE 0</div>
          <div style={{ fontSize: 26, fontWeight: "bold", letterSpacing: 5, color: "#fff", marginBottom: 6 }}>
            BINDING VOW
          </div>
          <div style={{ fontSize: 12, color: "#554444" }}>
            Each player swears an oath — kept or broken at resolution
          </div>
        </div>

        {/* 3-column layout: P1 status | vow selection | P2 status */}
        <div style={{ display: "flex", gap: 16, flex: 1, alignItems: "flex-start" }}>

          {/* P1 side */}
          <PlayerStatusPanel
            pid="P1"
            playerNames={playerNames}
            playerIcons={playerIcons}
            vowChosen={state.vowsChosen.P1}
            isActive={me === "P1"}
            isReady={state.vowsReady.P1}
          />

          {/* Center — vow selection for active player */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: "#9966aa", textAlign: "center", letterSpacing: 1 }}>
              <span style={{ color: me === "P1" ? "#4a9eff" : "#ff6666", fontWeight: "bold" }}>
                {playerNames[me]}
              </span>
              {" — choose your oath"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {vowIds.map(vowId => {
                const vow = VOW_DEFS[vowId];
                const isSel = selected === vowId;
                return (
                  <div
                    key={vowId}
                    onClick={() => setSelected(isSel ? null : vowId)}
                    style={{
                      padding: 12, borderRadius: 10, cursor: "pointer", userSelect: "none",
                      border: `1px solid ${isSel ? "#aa5500" : "#2a1520"}`,
                      background: isSel ? "#180a00" : "#0c0408",
                      boxShadow: isSel ? "0 0 16px #aa550033" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 5 }}>{vow.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: isSel ? "#ffaa44" : "#ccc", marginBottom: 5 }}>
                      {vow.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#776666", marginBottom: 8, lineHeight: 1.4 }}>
                      {vow.description}
                    </div>
                    <div style={{ fontSize: 10, color: "#44aa44", marginBottom: 2 }}>✓ {vow.reward}</div>
                    <div style={{ fontSize: 10, color: "#aa4444" }}>✗ {vow.penalty}</div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
              <button
                onClick={() => setSelected(selected === "PASS" ? null : "PASS")}
                style={{
                  padding: "8px 20px",
                  background: selected === "PASS" ? "#0a0a0a" : "#080808",
                  border: `1px solid ${selected === "PASS" ? "#555" : "#222"}`,
                  borderRadius: 8, color: selected === "PASS" ? "#888" : "#444",
                  cursor: "pointer", fontSize: 12, letterSpacing: 1,
                }}
              >
                PASS — no vow
              </button>
              <button
                onClick={confirm}
                disabled={selected === null}
                style={{
                  padding: "10px 32px",
                  background: selected !== null ? "#200800" : "#080808",
                  border: `1px solid ${selected !== null ? "#cc5500" : "#1a1a1a"}`,
                  borderRadius: 8, color: selected !== null ? "#ff8844" : "#333",
                  fontWeight: "bold", cursor: selected !== null ? "pointer" : "not-allowed",
                  fontSize: 14, letterSpacing: 2,
                  boxShadow: selected !== null ? "0 0 16px #cc550033" : "none",
                  transition: "all 0.2s",
                }}
              >
                COMMIT
              </button>
            </div>
          </div>

          {/* P2 side */}
          <PlayerStatusPanel
            pid="P2"
            playerNames={playerNames}
            playerIcons={playerIcons}
            vowChosen={state.vowsChosen.P2}
            isActive={me === "P2"}
            isReady={state.vowsReady.P2}
          />
        </div>
      </div>

      <style>{`
        @keyframes pulseOpacity { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
