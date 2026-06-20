import { useState } from "react";
import { BG } from "../backgrounds";
import type { CardInstance, GameState, Intent, PlayerId } from "@cg/contracts";
import { DOMAIN_EFFECTS, DEFAULT_DOMAIN } from "@cg/engine";
import type { DomainEffectDef } from "@cg/engine";
import { domainDesc } from "../helpers";
import CharacterCard from "../components/CharacterCard";

// Top-level — avoids remount on LockedInScreen re-render
function MiniBoard({ pid, state, playerNames, getEffect, lip }: {
  pid: PlayerId; state: GameState;
  playerNames: Record<PlayerId, string>;
  getEffect: (pid: PlayerId) => DomainEffectDef;
  lip: NonNullable<GameState["lockedInPhase"]>;
}) {
  const zones = state.players[pid];
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  const slots: Array<{ label: string; card: CardInstance | null }> = [
    { label: "Leader",    card: zones.board.leader },
    { label: "Combat 1",  card: zones.board.combat[0] },
    { label: "Combat 2",  card: zones.board.combat[1] },
    { label: "Support 1", card: zones.board.support[0] },
    { label: "Support 2", card: zones.board.support[1] },
    { label: "Support 3", card: zones.board.support[2] },
  ];
  const effect = getEffect(pid);
  const decided = lip.decisions[pid];

  return (
    <div style={{ flex: 1, background: "rgba(8,8,15,0.42)", borderRadius: 12, padding: 14, border: `1px solid ${pColor}33`, backdropFilter: "blur(4px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: "bold", color: pColor, fontSize: 13 }}>{playerNames[pid]}</span>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#ffd700" }}>
          {zones.scorePreview.toLocaleString()}
        </span>
      </div>

      <div style={{
        marginBottom: 10, padding: "8px 12px", borderRadius: 8,
        background: decided === "ACTIVATE" ? "rgba(10,26,10,0.6)" : decided === "SKIP" ? "rgba(10,10,10,0.6)" : "rgba(12,8,20,0.6)",
        border: `1px solid ${decided === "ACTIVATE" ? "#33aa33" : decided === "SKIP" ? "#333" : "#2a1a4a"}`,
      }}>
        <div style={{ fontSize: 10, color: effect.type === "domain" ? "#9944cc88" : "#44669988", letterSpacing: 2, marginBottom: 2 }}>
          {effect.type === "domain" ? "DOMAIN EXPANSION" : "CURSED TECHNIQUE"}
        </div>
        <div style={{ fontSize: 11, fontWeight: "bold", color: decided === "ACTIVATE" ? "#44dd44" : "#888", marginBottom: 2 }}>
          {decided === "ACTIVATE" ? "✦ ACTIVATED" : decided === "SKIP" ? "— SKIPPED" : "⬡ AVAILABLE"}
        </div>
        <div style={{ fontSize: 13, color: "#ddd", fontWeight: "bold" }}>{effect.name}</div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>{effect.technique}</div>
        <div style={{ fontSize: 11, color: decided === "ACTIVATE" ? "#44cc44" : "#555" }}>{domainDesc(effect)}</div>
      </div>

      {/* Board layout: leader → combat → support (same as PlacementScreen) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {/* Leader */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {(() => {
            const card = zones.board.leader;
            const def = card ? state.cardDb[card.defId] : null;
            const aug = card ? (zones.augments[card.instanceId] ?? 0) : 0;
            return def && card
              ? <CharacterCard defId={card.defId} def={def} size="sm" equippedBonus={aug > 0 ? aug : undefined} />
              : <div style={{ width: 96, height: 136, borderRadius: 8, border: "1px solid #1a1a2a", background: "#060610", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, color: "#222" }}>—</span></div>;
          })()}
        </div>
        <div style={{ width: "80%", height: 1, background: "linear-gradient(90deg, transparent, #2a2a4a, transparent)" }} />
        {/* Combat */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[zones.board.combat[0], zones.board.combat[1]].map((card, i) => {
            const def = card ? state.cardDb[card.defId] : null;
            const aug = card ? (zones.augments[card.instanceId] ?? 0) : 0;
            return def && card
              ? <CharacterCard key={i} defId={card.defId} def={def} size="sm" equippedBonus={aug > 0 ? aug : undefined} />
              : <div key={i} style={{ width: 96, height: 136, borderRadius: 8, border: "1px solid #1a1a2a", background: "#060610", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, color: "#222" }}>—</span></div>;
          })}
        </div>
        {/* Support */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[zones.board.support[0], zones.board.support[1], zones.board.support[2]].map((card, i) => {
            const def = card ? state.cardDb[card.defId] : null;
            const aug = card ? (zones.augments[card.instanceId] ?? 0) : 0;
            return def && card
              ? <CharacterCard key={i} defId={card.defId} def={def} size="sm" equippedBonus={aug > 0 ? aug : undefined} />
              : <div key={i} style={{ width: 96, height: 136, borderRadius: 8, border: "1px solid #1a1a2a", background: "#060610", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, color: "#222" }}>—</span></div>;
          })}
        </div>
      </div>
    </div>
  );
}

export default function LockedInScreen({ state, onSend, playerNames }: {
  state: GameState; onSend: (i: Intent) => void; playerNames: Record<PlayerId, string>;
}) {
  const me = state.activePlayerId;
  const lip = state.lockedInPhase!;
  const [activating, setActivating] = useState(false);

  const getEffect = (pid: PlayerId): DomainEffectDef => {
    const leaderDefId = state.players[pid].board.leader?.defId;
    return leaderDefId ? (DOMAIN_EFFECTS[leaderDefId] ?? DEFAULT_DOMAIN) : DEFAULT_DOMAIN;
  };

  const myEffect = getEffect(me);
  const myDecision = lip.decisions[me];
  const alreadyDecided = myDecision !== null;

  const activate = () => {
    setActivating(true);
    setTimeout(() => {
      setActivating(false);
      onSend({ type: "ACTIVATE_DOMAIN", playerId: me });
    }, 1400);
  };

  const skip = () => onSend({ type: "SKIP_DOMAIN", playerId: me });

  return (
    <div style={{ minHeight: "100vh", background: "#04040a", backgroundImage: BG.lockedIn, backgroundSize: "cover", backgroundPosition: "center", color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 24, position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.48)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1 }}>
      {/* Top bar: player names top-left, LOCKED IN centered */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 20, position: "relative" }}>
        {/* Top-left: player info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: "#4a9eff", fontWeight: "bold", letterSpacing: 1 }}>
            {playerNames.P1}
            {lip.decisions.P1 && <span style={{ marginLeft: 6, fontSize: 9, color: lip.decisions.P1 === "ACTIVATE" ? "#44cc44" : "#555" }}>
              {lip.decisions.P1 === "ACTIVATE" ? "✦ Domain Active" : "— Skipped"}
            </span>}
          </div>
          <div style={{ fontSize: 11, color: "#ff6666", fontWeight: "bold", letterSpacing: 1 }}>
            {playerNames.P2}
            {lip.decisions.P2 && <span style={{ marginLeft: 6, fontSize: 9, color: lip.decisions.P2 === "ACTIVATE" ? "#44cc44" : "#555" }}>
              {lip.decisions.P2 === "ACTIVATE" ? "✦ Domain Active" : "— Skipped"}
            </span>}
          </div>
        </div>
        {/* Center: LOCKED IN title */}
        <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 26, fontWeight: "bold", letterSpacing: 5, color: "#fff" }}>LOCKED IN</div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#440044" }}>DOMAIN EXPANSION</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, maxWidth: 900, margin: "0 auto 24px" }}>
        <MiniBoard pid="P1" state={state} playerNames={playerNames} getEffect={getEffect} lip={lip} />
        <div style={{ width: 1, background: "#1a1a22", alignSelf: "stretch" }} />
        <MiniBoard pid="P2" state={state} playerNames={playerNames} getEffect={getEffect} lip={lip} />
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
        {!alreadyDecided ? (
          <>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
              <span style={{ color: "#4a9eff", fontWeight: "bold" }}>{playerNames[me]}</span> — activate your domain?
            </div>
            <div style={{
              padding: "14px 20px", borderRadius: 12, background: "#0c0814",
              border: "1px solid #3a1a5a", marginBottom: 18,
            }}>
              <div style={{ fontSize: 16, fontWeight: "bold", color: "#cc88ff", marginBottom: 4 }}>{myEffect.name}</div>
              <div style={{ fontSize: 11, color: "#665588", marginBottom: 8 }}>{myEffect.technique}</div>
              <div style={{ fontSize: 13, color: "#aaa" }}>{domainDesc(myEffect)}</div>
              {myEffect.enemyPct < 0 && (
                <div style={{ fontSize: 11, color: "#aa4444", marginTop: 4 }}>
                  ✦ Applies {myEffect.enemyPct}% to opponent
                </div>
              )}
              <div style={{ fontSize: 10, color: "#443344", marginTop: 6 }}>
                If opponent also activates: both bonuses reduced to 60%, penalties cancel
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={activate}
                disabled={activating}
                style={{
                  padding: "12px 32px",
                  background: "linear-gradient(135deg, #1a0028, #0a0018)",
                  border: "2px solid #9933cc",
                  borderRadius: 10, color: "#cc88ff", fontWeight: "bold",
                  cursor: "pointer", fontSize: 15, letterSpacing: 2,
                  boxShadow: "0 0 20px #9933cc44",
                  transition: "all 0.15s",
                  opacity: activating ? 0.6 : 1,
                }}
              >
                ✦ EXPAND DOMAIN
              </button>
              <button
                onClick={skip}
                style={{
                  padding: "12px 24px", background: "#080808",
                  border: "1px solid #333", borderRadius: 10,
                  color: "#555", fontWeight: "bold", cursor: "pointer",
                  fontSize: 13, letterSpacing: 1,
                }}
              >
                SKIP
              </button>
            </div>
          </>
        ) : (
          <div style={{ color: "#555", fontSize: 13, padding: 20 }}>
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              {me} — <span style={{ color: myDecision === "ACTIVATE" ? "#44cc44" : "#555" }}>
                {myDecision === "ACTIVATE" ? "✦ Domain activated" : "Skipped"}
              </span>
            </div>
            <div style={{ color: "#333" }}>Waiting for opponent...</div>
          </div>
        )}
      </div>

      {activating && (
        <div style={{
          position: "fixed", inset: 0, background: "#000000f8", zIndex: 300,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
          animation: "fadeIn 0.3s ease-out",
        }}>
          <div style={{ fontSize: 11, letterSpacing: 8, color: "#440044" }}>DOMAIN EXPANSION</div>
          <div style={{
            fontSize: 44, fontWeight: "bold", color: "#cc88ff",
            textShadow: "0 0 40px #cc88ffaa, 0 0 80px #9933cc66",
            letterSpacing: 3, textAlign: "center",
            animation: "domainExpand 0.8s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
          }}>
            {myEffect.name}
          </div>
          <div style={{ fontSize: 16, color: "#665588", letterSpacing: 2 }}>{myEffect.technique}</div>
        </div>
      )}

      </div> {/* end zIndex:1 wrapper */}

      <style>{`
        @keyframes domainExpand {
          0%   { transform: scale(0.3); opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
