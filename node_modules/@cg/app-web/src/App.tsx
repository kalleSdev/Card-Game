import { useEffect, useMemo, useRef, useState } from "react";
import type { BindingVowId, CardDef, CardInstance, DraftPoolCard, GameState, Intent, PlayerId, PlayerZones, SlotRef } from "@cg/contracts";
import { createEngine, createInitialState, VOW_DEFS, ROULETTE_ITEM_MAP } from "@cg/engine";

// ===== Styling constants =====
const RARITY_COLOR: Record<string, string> = {
  C: "#4a9eff", B: "#9b59ff", A: "#ffd700",
  S: "#ff3333", SS: "#ff88cc", SSS: "#e8e8ff",
};
const RARITY_GLOW: Record<string, string> = {
  S: "0 0 8px #ff333355", SS: "0 0 12px #ff88cc77",
  SSS: "0 0 18px #ffffffaa, 0 0 36px #aaaaff55",
};
const SYNERGY_LABEL: Record<string, string> = {
  ATTR_HEAVENLY_2:     "⛓ Heavenly ×2 (+5%)",
  ATTR_ZENIN_2:        "⚔ Zenin ×2 (+5%)",
  ATTR_JUJUTSU_3:      "🏫 JJH ×3 (+10%)",
  REL_BROTHERHOOD:     "🤝 Brotherhood (+1500)",
  REL_MEMORY_RES:      "👁 Memory Resonance (+5%)",
  REL_GOJO_2STUDENTS:  "🎓 Gojo ×2 Students (+5%)",
  REL_GOJO_3STUDENTS:  "🎓 Gojo ×3 Students (+10%)",
  DISASTER_CURSE_2:    "💀 Disaster Curse ×2 (+4%)",
  DISASTER_CURSE_3:    "💀 Disaster Curse ×3 (+6%)",
  DISASTER_CURSE_4:    "💀 Disaster Curse ×4 (+8%)",
};

const rc = (r: string) => RARITY_COLOR[r] ?? "#888";
const rg = (r: string) => RARITY_GLOW[r] ?? "none";

// ===== Helpers =====
const slotLabel = (s: SlotRef) => {
  if (s.type === "LEADER")  return "Leader";
  if (s.type === "COMBAT")  return `Combat ${s.index + 1}`;
  if (s.type === "SUPPORT") return `Support ${s.index + 1}`;
  return "Unleash";
};

const getBoardCard = (zones: PlayerZones, slot: SlotRef): CardInstance | null => {
  if (slot.type === "LEADER")  return zones.board.leader;
  if (slot.type === "COMBAT")  return zones.board.combat[slot.index];
  if (slot.type === "SUPPORT") return zones.board.support[slot.index];
  return zones.board.unleashLocked;
};

const isBoardFull = (zones: PlayerZones) =>
  zones.board.leader !== null &&
  zones.board.combat.every(c => c !== null) &&
  zones.board.support.every(s => s !== null);

// Cubic ease-out count-up animation
const countUp = (target: number, setter: (n: number) => void, onDone: () => void) => {
  const duration = 1800;
  const fps = 60;
  const totalSteps = Math.round((duration / 1000) * fps);
  let step = 0;
  const id = setInterval(() => {
    step++;
    const progress = 1 - Math.pow(1 - step / totalSteps, 3); // ease-out cubic
    setter(Math.round(target * progress));
    if (step >= totalSteps) {
      setter(target);
      clearInterval(id);
      onDone();
    }
  }, 1000 / fps);
  return id;
};

// ===== Resolution screen =====
type RevealStage = "idle" | "p1" | "p2" | "winner";

function ResolutionScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [stage, setStage] = useState<RevealStage>("idle");

  const p1Final = state.players.P1.scorePreview;
  const p2Final = state.players.P2.scorePreview;
  const winner: PlayerId | "DRAW" = p1Final > p2Final ? "P1" : p2Final > p1Final ? "P2" : "DRAW";

  // Kick off after mount
  useEffect(() => {
    const t = setTimeout(() => setStage("p1"), 500);
    return () => clearTimeout(t);
  }, []);

  // P1 count-up
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

  // P2 count-up
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

  const maxScore = Math.max(p1Final, p2Final, 1);

  const PlayerReveal = ({ pid, score, final, active }: {
    pid: PlayerId; score: number; final: number; active: boolean;
  }) => {
    const zones = state.players[pid];
    const slots: Array<{ label: string; card: CardInstance | null }> = [
      { label: "Leader", card: zones.board.leader },
      { label: "Combat 1", card: zones.board.combat[0] },
      { label: "Combat 2", card: zones.board.combat[1] },
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
        <div style={{ fontSize: 13, color: "#666", marginBottom: 8, letterSpacing: 2, textTransform: "uppercase" }}>
          {pid === "P1" ? "Player 1" : "Player 2"}
        </div>

        {/* Score counter */}
        <div style={{
          fontSize: 48,
          fontWeight: "bold",
          color: active ? "#ffd700" : "#444",
          letterSpacing: -1,
          lineHeight: 1,
          marginBottom: 4,
          fontVariantNumeric: "tabular-nums",
          transition: "color 0.4s",
        }}>
          {score.toLocaleString()}
        </div>

        {/* Score bar */}
        <div style={{ height: 4, background: "#111", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${(score / maxScore) * 100}%`,
            background: active ? "#ffd700" : "#333",
            borderRadius: 2,
            transition: "width 0.05s linear, background 0.4s",
          }} />
        </div>

        {/* Vow + outcome */}
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

        {/* Synergies */}
        {zones.activeSynergies.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {zones.activeSynergies.map(s => (
              <span key={s} style={{ fontSize: 10, color: "#9b59ff", background: "#0f0a1a", border: "1px solid #2a1a4a", borderRadius: 4, padding: "2px 6px" }}>
                {SYNERGY_LABEL[s] ?? s}
              </span>
            ))}
          </div>
        )}

        {/* Card list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {slots.map(({ label, card }) => {
            const def = card ? state.cardDb[card.defId] : null;
            return (
              <div key={label} style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                background: def ? "#0c0c1a" : "#060608",
                borderRadius: 6,
                border: `1px solid ${def ? rc(def.rarity) + "44" : "#111"}`,
              }}>
                <span style={{ fontSize: 10, color: "#444", width: 60, flexShrink: 0 }}>{label}</span>
                {def ? (
                  <>
                    <span style={{ fontSize: 11, color: rc(def.rarity), fontWeight: "bold", width: 28 }}>{def.rarity}</span>
                    <span style={{ fontSize: 12, color: "#ddd", flex: 1 }}>{def.name}</span>
                    <span style={{ fontSize: 11, color: "#666" }}>{def.basePoints.toLocaleString()}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: "#333" }}>— empty —</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: 32,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 6, color: "#333", marginBottom: 4, textTransform: "uppercase" }}>
        Final Round
      </div>
      <div style={{ fontSize: 28, fontWeight: "bold", letterSpacing: 4, color: "#fff", marginBottom: 32 }}>
        RESOLUTION
      </div>

      {/* Two-player reveal */}
      <div style={{
        display: "flex",
        width: "100%",
        maxWidth: 860,
        gap: 24,
        borderTop: "1px solid #111",
        paddingTop: 24,
        marginBottom: 32,
      }}>
        <PlayerReveal pid="P1" score={p1Score} final={p1Final} active={stage !== "idle"} />
        <div style={{ width: 1, background: "#1a1a22" }} />
        <PlayerReveal pid="P2" score={p2Score} final={p2Final} active={stage === "p2" || stage === "winner"} />
      </div>

      {/* Winner banner */}
      {stage === "winner" && (
        <div style={{
          textAlign: "center",
          animation: "fadeIn 0.6s ease-out",
        }}>
          {winner === "DRAW" ? (
            <div style={{ fontSize: 32, color: "#888", letterSpacing: 4 }}>DRAW</div>
          ) : (
            <>
              <div style={{ fontSize: 13, letterSpacing: 4, color: "#555", marginBottom: 8 }}>WINNER</div>
              <div style={{
                fontSize: 52,
                fontWeight: "bold",
                color: "#ffd700",
                textShadow: "0 0 32px #ffd70088, 0 0 64px #ffd70044",
                letterSpacing: 4,
              }}>
                {winner === "P1" ? "PLAYER 1" : "PLAYER 2"}
              </div>
              <div style={{ fontSize: 18, color: "#888", marginTop: 8 }}>
                {winner === "P1" ? p1Final.toLocaleString() : p2Final.toLocaleString()} pts
              </div>
            </>
          )}
          <button
            onClick={onRestart}
            style={{
              marginTop: 32,
              padding: "10px 28px",
              background: "#0a0a0a",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#888",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: 13,
              letterSpacing: 2,
            }}
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ===== Reveal screen =====
const RARITY_DRAMATIC: Record<string, { glow: string; label: string }> = {
  C:   { glow: "0 0 40px #4a9eff88, 0 0 80px #4a9eff33",  label: "COMMON" },
  B:   { glow: "0 0 40px #9b59ff88, 0 0 80px #9b59ff33",  label: "RARE" },
  A:   { glow: "0 0 50px #ffd70099, 0 0 100px #ffd70044", label: "ELITE" },
  S:   { glow: "0 0 60px #ff333399, 0 0 120px #ff333333", label: "SPECIAL" },
  SS:  { glow: "0 0 70px #ff88ccaa, 0 0 140px #ff88cc44", label: "ULTRA" },
  SSS: { glow: "0 0 80px #ffffffaa, 0 0 160px #aaaaff55, 0 0 240px #ffffff22", label: "LEGENDARY" },
};

// What a card looks like based on its draft visibility (before true reveal)
function CardDraftFace({ inst, cardDb, small }: { inst: CardInstance; cardDb: Record<string, CardDef>; small?: boolean }) {
  const vis = inst.visibility;
  const def = cardDb[inst.defId];
  const w = small ? 72 : 90;
  const h = small ? 96 : 120;

  if (vis?.identityRevealed && def) {
    return (
      <div style={{ width: w, height: h, borderRadius: 9, border: `2px solid ${rc(def.rarity)}88`, background: "#0c0c1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
        <div style={{ fontSize: 9, color: rc(def.rarity), fontWeight: "bold" }}>{def.rarity}</div>
        <div style={{ fontSize: small ? 9 : 11, color: "#ddd", fontWeight: "bold", textAlign: "center", padding: "0 5px", lineHeight: 1.3 }}>{def.name}</div>
        <div style={{ fontSize: 9, color: "#666" }}>{def.affinity}</div>
      </div>
    );
  } else if (vis?.shownRarity) {
    return (
      <div style={{ width: w, height: h, borderRadius: 9, border: `2px solid ${rc(vis.shownRarity)}55`, background: "#08080e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ fontSize: 14, color: rc(vis.shownRarity), fontWeight: "bold" }}>{vis.shownRarity}</div>
        <div style={{ fontSize: 20, color: "#141428" }}>?</div>
      </div>
    );
  } else {
    return (
      <div style={{ width: w, height: h, borderRadius: 9, border: "2px solid #1a1a2a", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 26, color: "#101020" }}>?</div>
      </div>
    );
  }
}

function RevealScreen({ state, onSend }: { state: GameState; onSend: (i: Intent) => void }) {
  const me = state.activePlayerId;
  const rp = state.revealPhase!;
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // animating: null = idle, else the card currently flipping
  const [animInst, setAnimInst] = useState<CardInstance | null>(null);
  const [animStep, setAnimStep] = useState<"pre" | "flip" | null>(null); // pre=showing draft face, flip=true reveal

  const p1Hand = state.players.P1.hand;
  const p2Hand = state.players.P2.hand;
  const myHand = state.players[me].hand;
  const myUnrevealed = myHand.filter(c => !rp.revealed.includes(c.instanceId));
  const revealsLeft = 3 - rp.revealsThisTurn;

  const p1Revealed = rp.revealed.filter(id => p1Hand.some(c => c.instanceId === id));
  const p2Revealed = rp.revealed.filter(id => p2Hand.some(c => c.instanceId === id));

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  const clickCard = (inst: CardInstance) => {
    if (animInst || revealsLeft <= 0) return;
    setAnimInst(inst);
    setAnimStep("pre");

    const t1 = setTimeout(() => setAnimStep("flip"), 600);
    const t2 = setTimeout(() => {
      onSend({ type: "REVEAL_CARD", playerId: me, cardInstanceId: inst.instanceId });
      setAnimInst(null);
      setAnimStep(null);
    }, 2000);
    timeouts.current = [t1, t2];
  };

  const RevealedRow = ({ pId, revealedIds }: { pId: PlayerId; revealedIds: string[] }) => {
    const hand = state.players[pId].hand;
    const pColor = pId === "P1" ? "#4a9eff" : "#ff6666";
    return (
      <div>
        <div style={{ fontSize: 10, color: pColor + "88", letterSpacing: 3, marginBottom: 8 }}>
          {pId} — {revealedIds.length}/6 REVEALED
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hand.map(inst => {
            const def = state.cardDb[inst.defId];
            const isRevealed = revealedIds.includes(inst.instanceId);
            const color = def ? rc(def.rarity) : "#333";
            return (
              <div key={inst.instanceId} style={{
                width: 80, height: 108, borderRadius: 9,
                border: `2px solid ${isRevealed ? color : "#111"}`,
                background: isRevealed ? "#0c0c1e" : "#050509",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                boxShadow: isRevealed ? `0 0 14px ${color}44` : "none",
                transition: "all 0.4s",
              }}>
                {isRevealed && def ? (
                  <>
                    <div style={{ fontSize: 8, color, fontWeight: "bold", letterSpacing: 1 }}>{def.rarity}</div>
                    <div style={{ fontSize: 10, color: "#ddd", fontWeight: "bold", textAlign: "center", padding: "0 5px", lineHeight: 1.3 }}>{def.name}</div>
                    <div style={{ fontSize: 9, color: "#555" }}>{def.affinity}</div>
                    <div style={{ fontSize: 9, color: "#888" }}>{def.basePoints.toLocaleString()}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 20, color: "#0d0d18" }}>?</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const def = animInst ? state.cardDb[animInst.defId] : null;
  const dramatic = def ? RARITY_DRAMATIC[def.rarity] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#04040a", color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 24 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 5, color: "#333" }}>PHASE 2</div>
        <div style={{ fontSize: 24, fontWeight: "bold", letterSpacing: 5, color: "#fff", marginBottom: 6 }}>REVEAL</div>
        <div style={{ fontSize: 13, color: "#555" }}>
          <span style={{ color: "#4a9eff" }}>{me}</span>
          &nbsp;— click a card to reveal &nbsp;·&nbsp;
          <span style={{ color: revealsLeft > 0 ? "#ffd700" : "#444" }}>{revealsLeft} left this turn</span>
        </div>
      </div>

      {/* Both revealed boards */}
      <div style={{ display: "flex", gap: 32, marginBottom: 24, justifyContent: "center" }}>
        <div style={{ flex: 1, maxWidth: 500 }}><RevealedRow pId="P1" revealedIds={p1Revealed} /></div>
        <div style={{ width: 1, background: "#111" }} />
        <div style={{ flex: 1, maxWidth: 500 }}><RevealedRow pId="P2" revealedIds={p2Revealed} /></div>
      </div>

      {/* Active player's unrevealed hand — click to reveal one at a time */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#333", letterSpacing: 3, marginBottom: 12 }}>
          YOUR HAND — click a card to reveal it
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {myUnrevealed.map(inst => (
            <div
              key={inst.instanceId}
              onClick={() => clickCard(inst)}
              style={{
                cursor: animInst ? "default" : "pointer",
                opacity: animInst ? 0.5 : 1,
                transform: "none",
                transition: "opacity 0.2s",
              }}
            >
              <CardDraftFace inst={inst} cardDb={state.cardDb} />
            </div>
          ))}
          {myUnrevealed.length === 0 && revealsLeft === 0 && (
            <div style={{ color: "#333", fontSize: 13 }}>Waiting for opponent...</div>
          )}
          {myUnrevealed.length === 0 && revealsLeft > 0 && (
            <div style={{ color: "#333", fontSize: 13 }}>All your cards have been revealed</div>
          )}
        </div>
      </div>

      {/* Dramatic single-card reveal overlay */}
      {animInst && animStep && (
        <div style={{
          position: "fixed", inset: 0, background: "#000000f2", zIndex: 200,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 6, color: "#2a2a2a" }}>{me} REVEALS</div>

          {/* The card — shows draft face in "pre", flips to true identity in "flip" */}
          {animStep === "pre" && (
            <div style={{ animation: "riseUp 0.4s ease-out forwards" }}>
              <CardDraftFace inst={animInst} cardDb={state.cardDb} />
            </div>
          )}

          {animStep === "flip" && def && (
            <div style={{
              width: 170, height: 236, borderRadius: 16,
              border: `3px solid ${rc(def.rarity)}`,
              background: "#0e0e22",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: dramatic?.glow ?? "none",
              animation: "dramaticReveal 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
            }}>
              <div style={{ fontSize: 11, color: rc(def.rarity), letterSpacing: 5, fontWeight: "bold" }}>
                {dramatic?.label}
              </div>
              <div style={{ fontSize: 13, color: rc(def.rarity), fontWeight: "bold" }}>{def.rarity}</div>
              <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center", padding: "0 14px", lineHeight: 1.3 }}>
                {def.name}
              </div>
              <div style={{ fontSize: 13, color: "#666" }}>{def.affinity}</div>
              <div style={{ fontSize: 16, color: "#aaa" }}>{def.basePoints.toLocaleString()} pts</div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes riseUp {
          from { transform: translateY(20px); opacity: 0.4; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes dramaticReveal {
          0%   { transform: rotateY(90deg) scale(0.6); opacity: 0; }
          55%  { transform: rotateY(-6deg) scale(1.12); opacity: 1; }
          80%  { transform: rotateY(2deg) scale(1.06); }
          100% { transform: rotateY(0deg) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ===== Vow badge (shown in other phases) =====
function VowBadge({ playerId, vowId }: { playerId: PlayerId; vowId: BindingVowId | null }) {
  if (!vowId) return <span style={{ fontSize: 10, color: "#333" }}>No vow</span>;
  const vow = VOW_DEFS[vowId];
  return (
    <span style={{
      fontSize: 10, color: "#cc9900", background: "#1a1100",
      border: "1px solid #443300", borderRadius: 4, padding: "2px 6px",
    }}>
      {vow.icon} {vow.name}
    </span>
  );
}

// ===== Binding vow screen =====
function BindingVowScreen({ state, onSend }: { state: GameState; onSend: (i: Intent) => void }) {
  const me = state.activePlayerId;
  const other = me === "P1" ? "P2" : "P1";
  const [selected, setSelected] = useState<BindingVowId | null | "PASS">(null);
  const otherVow = state.vowsReady[other] ? state.vowsChosen[other] : undefined;

  const vowIds = Object.keys(VOW_DEFS) as BindingVowId[];

  const confirm = () => {
    if (selected === undefined) return;
    onSend({ type: "CHOOSE_VOW", playerId: me, vowId: selected === "PASS" ? null : selected });
    setSelected(null);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#07030a", color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 28,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 5, color: "#440022", marginBottom: 4 }}>PHASE 0</div>
        <div style={{ fontSize: 28, fontWeight: "bold", letterSpacing: 5, color: "#fff", marginBottom: 8 }}>
          BINDING VOW
        </div>
        <div style={{ fontSize: 13, color: "#665555", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
          Choose an oath before the draft. Your vow is public, both players see each other's commitment.
          Oaths cannot be broken without consequence.
        </div>
      </div>

      {/* Other player's vow (if already chosen) */}
      {state.vowsReady[other] && (
        <div style={{
          textAlign: "center", marginBottom: 20, padding: "10px 20px",
          background: "#0a0008", border: "1px solid #330022", borderRadius: 8,
          maxWidth: 500, margin: "0 auto 20px",
        }}>
          <div style={{ fontSize: 10, color: "#554444", letterSpacing: 2, marginBottom: 6 }}>{other} HAS SWORN</div>
          {otherVow ? (
            <div style={{ fontSize: 14, color: "#cc9900" }}>
              {VOW_DEFS[otherVow].icon} {VOW_DEFS[otherVow].name}
              <div style={{ fontSize: 11, color: "#665544", marginTop: 4 }}>{VOW_DEFS[otherVow].description}</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#443333" }}>Passed — No vow taken</div>
          )}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#9966aa", textAlign: "center", marginBottom: 20, letterSpacing: 1 }}>
        <span style={{ color: "#4a9eff", fontWeight: "bold" }}>{me}</span> — choose your oath
      </div>

      {/* Vow grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 860, margin: "0 auto 20px" }}>
        {vowIds.map(vowId => {
          const vow = VOW_DEFS[vowId];
          const isSel = selected === vowId;
          return (
            <div
              key={vowId}
              onClick={() => setSelected(isSel ? null : vowId)}
              style={{
                padding: 14, borderRadius: 10, cursor: "pointer", userSelect: "none",
                border: `1px solid ${isSel ? "#aa5500" : "#2a1520"}`,
                background: isSel ? "#180a00" : "#0c0408",
                boxShadow: isSel ? "0 0 20px #aa550033" : "none",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{vow.icon}</div>
              <div style={{ fontSize: 13, fontWeight: "bold", color: isSel ? "#ffaa44" : "#ccc", marginBottom: 6 }}>
                {vow.name}
              </div>
              <div style={{ fontSize: 11, color: "#776666", marginBottom: 10, lineHeight: 1.5 }}>
                {vow.description}
              </div>
              <div style={{ fontSize: 11, color: "#44aa44", marginBottom: 3 }}>✓ {vow.reward}</div>
              <div style={{ fontSize: 11, color: "#aa4444" }}>✗ {vow.penalty}</div>
            </div>
          );
        })}
      </div>

      {/* Pass + Confirm */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
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
  );
}

// ===== Coin flip screen =====
function CoinFlipScreen({ onFlip }: { onFlip: (firstPicker: PlayerId) => void }) {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<PlayerId | null>(null);

  const flip = () => {
    if (flipping || result) return;
    setFlipping(true);
    const winner: PlayerId = Math.random() < 0.5 ? "P1" : "P2";
    setTimeout(() => {
      setResult(winner);
      setFlipping(false);
    }, 1600);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#05050b", color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 5, color: "#333" }}>BEFORE THE DRAFT</div>
      <div style={{ fontSize: 26, fontWeight: "bold", letterSpacing: 4, color: "#fff" }}>COIN FLIP</div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>Who picks first?</div>

      {/* Coin */}
      <div
        onClick={flip}
        style={{
          fontSize: 80,
          cursor: flipping || result ? "default" : "pointer",
          userSelect: "none",
          animation: flipping ? "spin 0.3s linear infinite" : "none",
          transition: "transform 0.1s",
        }}
      >
        🪙
      </div>

      {!result && !flipping && (
        <button onClick={flip} style={{
          padding: "10px 32px", background: "#0a0a18", border: "1px solid #4a4a88",
          borderRadius: 8, color: "#8888cc", fontWeight: "bold", cursor: "pointer",
          fontSize: 14, letterSpacing: 2,
        }}>
          FLIP
        </button>
      )}

      {flipping && (
        <div style={{ fontSize: 13, color: "#444", letterSpacing: 2 }}>flipping...</div>
      )}

      {result && (
        <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-out" }}>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8, letterSpacing: 2 }}>RESULT</div>
          <div style={{ fontSize: 36, fontWeight: "bold", color: "#ffd700", letterSpacing: 3 }}>
            {result === "P1" ? "PLAYER 1" : "PLAYER 2"}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4, marginBottom: 20 }}>picks first</div>
          <button onClick={() => onFlip(result)} style={{
            padding: "10px 32px", background: "#0a1800", border: "1px solid #44aa22",
            borderRadius: 8, color: "#66cc44", fontWeight: "bold", cursor: "pointer",
            fontSize: 13, letterSpacing: 2,
          }}>
            START DRAFT
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ===== Pool card component =====
function PoolCard({
  card, cardDb, selected, isMyTurn, cardRevealUsed,
  onSelect, onPick, onSpellCardReveal, onSpellGlobalRate, onSpellFakeReveal,
  spellsLeft,
}: {
  card: DraftPoolCard;
  cardDb: Record<string, CardDef>;
  selected: boolean;
  isMyTurn: boolean;
  cardRevealUsed: boolean;
  onSelect: () => void;
  onPick: () => void;
  onSpellCardReveal: () => void;
  onSpellGlobalRate: () => void;
  onSpellFakeReveal: () => void;
  spellsLeft: number;
}) {
  const def = cardDb[card.defId];
  const shownColor = card.shownRarity ? rc(card.shownRarity) : "#2a2a4a";
  const borderColor = selected ? "#ffd700" : card.identityRevealed ? rc(def?.rarity ?? "C") : shownColor;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {/* Card face */}
      <div
        onClick={isMyTurn ? onSelect : undefined}
        style={{
          width: 82, height: 116, borderRadius: 10, cursor: isMyTurn ? "pointer" : "default",
          border: `2px solid ${borderColor}`,
          background: card.identityRevealed
            ? "linear-gradient(135deg, #0e0e22, #0a0a18)"
            : "linear-gradient(135deg, #0c0c20, #080816)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 3, userSelect: "none", position: "relative",
          boxShadow: selected ? "0 0 0 2px #ffd70088" : card.identityRevealed ? `0 0 8px ${rc(def?.rarity ?? "C")}44` : "none",
          transition: "border-color 0.15s, transform 0.12s",
          transform: selected ? "translateY(-4px)" : "none",
        }}
      >
        {card.identityRevealed && def ? (
          <>
            <div style={{ fontSize: 9, color: rc(def.rarity), fontWeight: "bold" }}>{def.rarity}</div>
            <div style={{ fontSize: 10, color: "#ddd", fontWeight: "bold", textAlign: "center", padding: "0 4px", lineHeight: 1.3 }}>{def.name}</div>
            <div style={{ fontSize: 10, color: "#888" }}>{def.affinity}</div>
          </>
        ) : card.shownRarity ? (
          <>
            <div style={{ fontSize: 16, color: rc(card.shownRarity), fontWeight: "bold" }}>{card.shownRarity}</div>
            <div style={{ fontSize: 20, color: "#1a1a3a" }}>?</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, color: "#1e1e40" }}>?</div>
            <div style={{ fontSize: 8, color: "#1a1a30", letterSpacing: 1 }}>UNKNOWN</div>
          </>
        )}
      </div>

      {/* Spell action panel — only shown when selected on your turn */}
      {selected && isMyTurn && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 82 }}>
          <button onClick={onPick} style={{
            padding: "4px 0", background: "#0a1800", border: "1px solid #44aa22",
            borderRadius: 5, color: "#66cc44", fontWeight: "bold", cursor: "pointer", fontSize: 10,
          }}>PICK</button>

          {!card.identityRevealed && !cardRevealUsed && (
            <button onClick={onSpellCardReveal} disabled={spellsLeft <= 0} style={{
              padding: "3px 0", background: spellsLeft > 0 ? "#180a00" : "#060606",
              border: `1px solid ${spellsLeft > 0 ? "#cc6600" : "#1a1a1a"}`,
              borderRadius: 5, color: spellsLeft > 0 ? "#ff9944" : "#333",
              fontWeight: "bold", cursor: spellsLeft > 0 ? "pointer" : "not-allowed", fontSize: 9,
            }}>🃏 REVEAL CARD</button>
          )}

          {!card.shownRarity && !card.identityRevealed && (
            <>
              <button onClick={onSpellGlobalRate} disabled={spellsLeft <= 0} style={{
                padding: "3px 0", background: spellsLeft > 0 ? "#180018" : "#060606",
                border: `1px solid ${spellsLeft > 0 ? "#882299" : "#1a1a1a"}`,
                borderRadius: 5, color: spellsLeft > 0 ? "#cc44ee" : "#333",
                fontWeight: "bold", cursor: spellsLeft > 0 ? "pointer" : "not-allowed", fontSize: 9,
              }}>📢 GLOBAL RATE</button>

              <button onClick={onSpellFakeReveal} disabled={spellsLeft <= 0} style={{
                padding: "3px 0", background: spellsLeft > 0 ? "#1a0010" : "#060606",
                border: `1px solid ${spellsLeft > 0 ? "#aa2266" : "#1a1a1a"}`,
                borderRadius: 5, color: spellsLeft > 0 ? "#ee4499" : "#333",
                fontWeight: "bold", cursor: spellsLeft > 0 ? "pointer" : "not-allowed", fontSize: 9,
              }}>🎭 FAKE REVEAL</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Draft screen =====
function DraftScreen({ state, onSend }: { state: GameState; onSend: (i: Intent) => void }) {
  const me = state.activePlayerId;
  const draft = state.draft!;
  const skipsLeft = draft.skipsRemaining[me];
  const spellsLeft = draft.spellsRemaining[me];
  const totalPicks = state.players.P1.hand.length + state.players.P2.hand.length;
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const select = (instanceId: string) =>
    setSelectedCard(prev => prev === instanceId ? null : instanceId);

  return (
    <div style={{
      minHeight: "100vh", background: "#05050b", color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 20,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#444", marginBottom: 4 }}>PHASE 1</div>
        <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 3, color: "#fff" }}>DRAFT</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
          <span style={{ color: "#4a9eff", fontWeight: "bold" }}>{me}</span>'s turn
          &nbsp;·&nbsp; {totalPicks}/12 picked
          &nbsp;·&nbsp; Skips: <span style={{ color: skipsLeft > 0 ? "#aaa" : "#444" }}>{skipsLeft}</span>
          &nbsp;·&nbsp; Spells: <span style={{ color: spellsLeft > 0 ? "#ff9944" : "#444" }}>{'⚡'.repeat(spellsLeft)}{'·'.repeat(3 - spellsLeft)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>
          Click a card to select → then PICK, or use a spell
        </div>
      </div>

      {/* Card pool */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", alignItems: "flex-start" }}>
          {draft.pool.map(card => (
            <PoolCard
              key={card.instanceId}
              card={card}
              cardDb={state.cardDb}
              selected={selectedCard === card.instanceId}
              isMyTurn={true}
              cardRevealUsed={draft.cardRevealUsed[me]}
              onSelect={() => select(card.instanceId)}
              onPick={() => { onSend({ type: "DRAFT_PICK", playerId: me, cardInstanceId: card.instanceId }); setSelectedCard(null); }}
              onSpellCardReveal={() => { onSend({ type: "SPELL_CARD_REVEAL", playerId: me, cardInstanceId: card.instanceId }); setSelectedCard(null); }}
              onSpellGlobalRate={() => { onSend({ type: "SPELL_GLOBAL_RATE", playerId: me, cardInstanceId: card.instanceId }); setSelectedCard(null); }}
              onSpellFakeReveal={() => { onSend({ type: "SPELL_FAKE_REVEAL", playerId: me, cardInstanceId: card.instanceId }); setSelectedCard(null); }}
              spellsLeft={spellsLeft}
            />
          ))}
        </div>
      </div>

      {/* Picks so far — shown as draft board visibility, not actual cards */}
      <div style={{ display: "flex", gap: 24, marginBottom: 16, justifyContent: "center" }}>
        {(["P1", "P2"] as const).map(pid => {
          const picks = state.players[pid].hand;
          const isMe = pid === me;
          const vowId = state.vowsChosen[pid];
          const vowDef = vowId ? VOW_DEFS[vowId] : null;
          return (
            <div key={pid} style={{ flex: 1, maxWidth: 380 }}>
              {/* Vow badge */}
              <div style={{ marginBottom: 4, minHeight: 18 }}>
                {vowDef ? (
                  <span style={{ fontSize: 10, color: "#cc9900", background: "#1a1100", border: "1px solid #443300", borderRadius: 4, padding: "2px 6px" }}>
                    {vowDef.icon} {vowDef.name}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: "#333" }}>No vow</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: isMe ? "#4a9eff" : "#555", letterSpacing: 2, marginBottom: 6 }}>
                {pid} ({picks.length}/6){isMe ? " — YOUR PICKS" : " — OPPONENT"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {picks.map(inst => {
                  const vis = inst.visibility;
                  const def = state.cardDb[inst.defId];
                  if (vis?.identityRevealed && def) {
                    return (
                      <div key={inst.instanceId} style={{
                        padding: "3px 7px", borderRadius: 5,
                        border: `1px solid ${rc(def.rarity)}55`, background: "#0c0c18", fontSize: 11,
                      }}>
                        <span style={{ color: rc(def.rarity), fontSize: 9, fontWeight: "bold" }}>{def.rarity} </span>
                        <span style={{ color: "#ccc" }}>{def.name}</span>
                      </div>
                    );
                  } else if (vis?.shownRarity) {
                    return (
                      <div key={inst.instanceId} style={{
                        padding: "3px 7px", borderRadius: 5,
                        border: `1px solid ${rc(vis.shownRarity)}44`, background: "#080810", fontSize: 11,
                      }}>
                        <span style={{ color: rc(vis.shownRarity), fontWeight: "bold" }}>{vis.shownRarity}</span>
                        <span style={{ color: "#333" }}> ?</span>
                      </div>
                    );
                  } else {
                    return (
                      <div key={inst.instanceId} style={{
                        padding: "3px 7px", borderRadius: 5,
                        border: "1px solid #1a1a28", background: "#060610", fontSize: 11, color: "#252535",
                      }}>?</div>
                    );
                  }
                })}
                {picks.length === 0 && <span style={{ fontSize: 11, color: "#2a2a3a" }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Skip */}
      <div style={{ textAlign: "center" }}>
        <button
          disabled={skipsLeft === 0}
          onClick={() => { onSend({ type: "DRAFT_SKIP", playerId: me }); setSelectedCard(null); }}
          style={{
            padding: "7px 22px", background: skipsLeft > 0 ? "#0a0a18" : "#060608",
            border: `1px solid ${skipsLeft > 0 ? "#4a4a88" : "#1a1a22"}`,
            borderRadius: 8, color: skipsLeft > 0 ? "#8888cc" : "#333",
            fontWeight: "bold", cursor: skipsLeft > 0 ? "pointer" : "not-allowed",
            fontSize: 12, letterSpacing: 1,
          }}
        >
          SKIP TURN ({skipsLeft} left)
        </button>
      </div>
    </div>
  );
}

// ===== Augment screen — roulette =====
function AugmentScreen({ state, onSend }: { state: GameState; onSend: (i: Intent) => void }) {
  const me = state.activePlayerId;
  const aug = state.augmentPhase!;
  const mySpins = aug.spinsRemaining[me];
  const pending = aug.pendingItem;
  const myPool = aug.pool[me];

  const [spinning, setSpinning] = useState(false);
  const [displayItem, setDisplayItem] = useState<string | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  const spinRoulette = () => {
    if (spinning || mySpins <= 0 || pending) return;
    const winner = myPool[Math.floor(Math.random() * myPool.length)];
    setSpinning(true);

    const allIds = Object.keys(ROULETTE_ITEM_MAP);
    let idx = 0;
    let elapsed = 0;

    const cycle = () => {
      idx = (idx + 1) % allIds.length;
      setDisplayItem(allIds[idx]);
      const delay = elapsed < 1200 ? 55 : elapsed < 2000 ? 110 : elapsed < 2600 ? 200 : 340;
      elapsed += delay;
      if (elapsed < 3000) {
        const t = setTimeout(cycle, delay);
        timeouts.current.push(t);
      } else {
        setDisplayItem(winner);
        const t = setTimeout(() => {
          setSpinning(false);
          onSend({ type: "SPIN_ROULETTE", playerId: me, result: winner });
        }, 900);
        timeouts.current.push(t);
      }
    };
    cycle();
  };

  const assignItem = (targetId: string) => {
    if (!pending) return;
    onSend({ type: "ASSIGN_ITEM", playerId: me, targetCardInstanceId: targetId });
  };

  const pendingDef = pending ? ROULETTE_ITEM_MAP[pending] : null;

  // Board slots for both players
  const BothBoards = () => (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      {(["P1", "P2"] as const).map(pid => {
        const pZones = state.players[pid];
        const pBoard = pZones.board;
        const pAug = pZones.augments;
        const isMe = pid === me;
        const equippedItems = aug.equipped[pid];
        const pSlots: Array<{ label: string; inst: CardInstance | null }> = [
          { label: "Leader",    inst: pBoard.leader },
          { label: "Combat 1",  inst: pBoard.combat[0] },
          { label: "Combat 2",  inst: pBoard.combat[1] },
          { label: "Support 1", inst: pBoard.support[0] },
          { label: "Support 2", inst: pBoard.support[1] },
          { label: "Support 3", inst: pBoard.support[2] },
        ];
        return (
          <div key={pid} style={{ flex: 1, border: `1px solid ${isMe ? "#333" : "#1a1a22"}`, borderRadius: 12, padding: 12, background: "#08080f" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: isMe ? "#fff" : "#555" }}>
                {pid} {isMe && <span style={{ fontSize: 10, color: "#ffd700", background: "#1a1400", borderRadius: 4, padding: "2px 5px", marginLeft: 4 }}>YOUR TURN</span>}
              </span>
              <span style={{ fontSize: 15, fontWeight: "bold", color: "#ffd700" }}>{pZones.scorePreview.toLocaleString()}</span>
            </div>
            {equippedItems.length > 0 && (
              <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {equippedItems.map((eq, i) => {
                  const itemDef = ROULETTE_ITEM_MAP[eq.itemId];
                  const targetInst = pSlots.find(s => s.inst?.instanceId === eq.targetCardInstanceId);
                  const targetName = targetInst?.inst ? (state.cardDb[targetInst.inst.defId]?.name ?? "?") : "?";
                  return (
                    <span key={i} style={{ fontSize: 10, color: "#44cc44", background: "#001400", border: "1px solid #224422", borderRadius: 4, padding: "2px 6px" }}>
                      ⚔ {itemDef?.name} → {targetName} (+{eq.bonus.toLocaleString()})
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {pSlots.map(({ label, inst }) => {
                const def = inst ? state.cardDb[inst.defId] : null;
                const bonus = inst ? (pAug[inst.instanceId] ?? 0) : 0;
                const canAssign = isMe && !!pending && !!inst && !spinning;
                return (
                  <div
                    key={label}
                    onClick={canAssign ? () => assignItem(inst!.instanceId) : undefined}
                    style={{
                      padding: "6px 10px", borderRadius: 7, display: "flex", justifyContent: "space-between", alignItems: "center",
                      border: `1px solid ${canAssign ? "#ffd70066" : def ? rc(def.rarity) + "33" : "#111"}`,
                      background: canAssign ? "#181400" : def ? "#0c0c18" : "#060610",
                      cursor: canAssign ? "pointer" : "default",
                      transition: "border-color 0.12s",
                      boxShadow: canAssign ? "0 0 8px #ffd70022" : "none",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 9, color: "#444", marginRight: 6 }}>{label}</span>
                      {def ? (
                        <>
                          <span style={{ fontSize: 10, color: rc(def.rarity), fontWeight: "bold", marginRight: 5 }}>{def.rarity}</span>
                          <span style={{ fontSize: 12, color: "#ddd" }}>{def.name}</span>
                        </>
                      ) : <span style={{ fontSize: 11, color: "#222" }}>—</span>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {def && <div style={{ fontSize: 11, color: "#666" }}>{def.basePoints.toLocaleString()}</div>}
                      {bonus > 0 && <div style={{ fontSize: 11, color: "#44cc44", fontWeight: "bold" }}>+{bonus.toLocaleString()}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#05050b", color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#444" }}>PHASE 4</div>
        <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 3, color: "#fff", marginBottom: 4 }}>AUGMENTS</div>
        <div style={{ fontSize: 12, color: "#555" }}>
          <span style={{ color: "#4a9eff" }}>{me}</span>
          {` · Spins left: `}
          <span style={{ color: mySpins > 0 ? "#ffd700" : "#444" }}>{aug.spinsRemaining.P1}</span>/{aug.spinsRemaining.P2}
        </div>
      </div>

      <BothBoards />

      {/* Roulette panel */}
      <div style={{ padding: 16, background: "#09091a", borderRadius: 12, border: "1px solid #1a1a2e", textAlign: "center" }}>
        {!pending && !spinning && mySpins > 0 && (
          <>
            <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, marginBottom: 14 }}>{me} — SPIN THE ROULETTE</div>
            <button
              onClick={spinRoulette}
              style={{
                padding: "12px 40px",
                background: "linear-gradient(135deg, #1a0a00, #0a1a00)",
                border: "1px solid #cc8800",
                borderRadius: 10, color: "#ffd700", fontWeight: "bold",
                cursor: "pointer", fontSize: 16, letterSpacing: 3,
                boxShadow: "0 0 20px #cc880033",
              }}
            >
              🎰 SPIN
            </button>
          </>
        )}

        {spinning && displayItem && (
          <>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: 3, marginBottom: 12 }}>SPINNING...</div>
            <div style={{
              fontSize: 20, fontWeight: "bold", color: "#ffd700",
              background: "#120d00", border: "2px solid #cc8800",
              borderRadius: 10, padding: "16px 32px", display: "inline-block",
              minWidth: 280, animation: "pulse 0.1s ease-in-out infinite alternate",
            }}>
              {ROULETTE_ITEM_MAP[displayItem]?.name ?? displayItem}
            </div>
          </>
        )}

        {pending && pendingDef && !spinning && (
          <>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 3, marginBottom: 10 }}>YOU WON</div>
            <div style={{
              fontSize: 18, fontWeight: "bold", color: "#ffd700",
              background: "#120d00", border: "2px solid #ffd700",
              borderRadius: 10, padding: "14px 28px", display: "inline-block", marginBottom: 12,
              boxShadow: "0 0 24px #ffd70044",
              animation: "fadeIn 0.4s ease-out",
            }}>
              ⚔ {pendingDef.name}
              <span style={{ fontSize: 14, color: "#aaa", marginLeft: 10 }}>+{pendingDef.baseBonus.toLocaleString()}</span>
              {pendingDef.conditionalDesc && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{pendingDef.conditionalDesc}</div>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>Click a card on your board to equip it</div>
          </>
        )}

        {mySpins === 0 && !pending && (
          <div style={{ fontSize: 13, color: "#444" }}>
            {aug.spinsRemaining[me === "P1" ? "P2" : "P1"] > 0
              ? "Waiting for opponent..."
              : "All spins complete — resolving..."}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { from { opacity: 0.8; } to { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

// ===== Hand card =====
function HandCard({ instance, def, selected, onClick }: {
  instance: CardInstance; def: CardDef; selected: boolean; onClick: () => void;
}) {
  const color = rc(def.rarity);
  return (
    <div onClick={onClick} style={{
      border: `2px solid ${selected ? color : "#2a2a3a"}`,
      borderRadius: 8, padding: "8px 12px", cursor: "pointer",
      background: selected ? "#12122a" : "#0c0c18",
      boxShadow: selected ? `0 0 0 2px ${color}, ${rg(def.rarity)}` : rg(def.rarity),
      minWidth: 110, userSelect: "none", transition: "all 0.12s",
    }}>
      <div style={{ fontSize: 10, fontWeight: "bold", color, marginBottom: 2 }}>{def.rarity}</div>
      <div style={{ fontSize: 13, fontWeight: "bold", color: "#f0f0f0" }}>{def.name}</div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{def.affinity}</div>
      <div style={{ fontSize: 12, color: "#aaa", marginTop: 1 }}>{def.basePoints.toLocaleString()} pts</div>
      {def.perks?.weaponEfficiency && (
        <div style={{ fontSize: 10, color: "#ffd700", marginTop: 2 }}>⚔ Weapon {def.perks.weaponEfficiency}</div>
      )}
    </div>
  );
}

// ===== Board slot =====
function SlotCell({ slot, instance, def, canPlace, onClick }: {
  slot: SlotRef; instance: CardInstance | null; def: CardDef | undefined;
  canPlace: boolean; onClick: () => void;
}) {
  const isUnleash = slot.type === "UNLEASH";
  const color = def ? rc(def.rarity) : canPlace ? "#444" : "#1e1e2a";
  return (
    <div onClick={canPlace ? onClick : undefined} style={{
      border: `1px solid ${color}`, borderRadius: 8, padding: "8px 10px", minHeight: 76,
      cursor: canPlace ? "pointer" : "default", background: def ? "#0e0e1e" : "#060610",
      opacity: isUnleash ? 0.45 : 1, transition: "border-color 0.12s",
    }}>
      <div style={{ fontSize: 9, color: "#555", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>
        {slotLabel(slot)}{isUnleash ? " 🔒" : ""}
      </div>
      {def ? (
        <>
          <div style={{ fontSize: 10, color: rc(def.rarity), fontWeight: "bold" }}>{def.rarity}</div>
          <div style={{ fontSize: 12, color: "#e0e0e0", fontWeight: "bold", lineHeight: 1.3 }}>{def.name}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{def.basePoints.toLocaleString()}</div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: canPlace ? "#444" : "#222", marginTop: 4 }}>
          {canPlace ? "↑ Place here" : "—"}
        </div>
      )}
    </div>
  );
}

// ===== Board panel =====
function BoardPanel({ title, playerId, zones, cardDb, isActive, selectedCard, onSlotClick }: {
  title: string; playerId: PlayerId; zones: PlayerZones; cardDb: Record<string, CardDef>;
  isActive: boolean; selectedCard: string | null; onSlotClick: (slot: SlotRef) => void;
}) {
  const canPlace = isActive && !!selectedCard;
  const full = isBoardFull(zones);

  const slot = (s: SlotRef) => {
    const inst = getBoardCard(zones, s);
    const def = inst ? cardDb[inst.defId] : undefined;
    return (
      <SlotCell key={`${s.type}-${s.index}`} slot={s} instance={inst} def={def}
        canPlace={canPlace && inst === null && s.type !== "UNLEASH"}
        onClick={() => onSlotClick(s)}
      />
    );
  };

  return (
    <div style={{
      flex: 1, border: `1px solid ${isActive ? "#333" : "#1a1a22"}`,
      borderRadius: 12, padding: 14, background: "#08080f",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <span style={{ fontWeight: "bold", fontSize: 14, color: isActive ? "#fff" : "#555" }}>{title}</span>
          {isActive && (
            <span style={{ marginLeft: 8, fontSize: 10, color: "#ffd700", background: "#1a1400", borderRadius: 4, padding: "2px 6px", fontWeight: "bold" }}>
              YOUR TURN
            </span>
          )}
          {full && isActive && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "#4a9eff", background: "#0a1020", borderRadius: 4, padding: "2px 6px" }}>
              BOARD FULL
            </span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 17, fontWeight: "bold", color: "#ffd700" }}>{zones.scorePreview.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: "#444" }}>score preview</div>
        </div>
      </div>

      {zones.activeSynergies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {zones.activeSynergies.map(s => (
            <span key={s} style={{ fontSize: 10, color: "#9b59ff", background: "#0f0a1a", border: "1px solid #2a1a4a", borderRadius: 4, padding: "2px 6px" }}>
              {SYNERGY_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>{slot({ type: "LEADER", index: 0 })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {slot({ type: "COMBAT", index: 0 })}{slot({ type: "COMBAT", index: 1 })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        {slot({ type: "SUPPORT", index: 0 })}{slot({ type: "SUPPORT", index: 1 })}{slot({ type: "SUPPORT", index: 2 })}
      </div>
      {slot({ type: "UNLEASH", index: 0 })}

      <div style={{ marginTop: 8, fontSize: 10, color: "#333" }}>Hand: {zones.hand.length} · Deck: {zones.deck.length}</div>
    </div>
  );
}

// ===== Main App =====
export default function App() {
  const [key, setKey] = useState(0); // bump to restart
  const engine = useMemo(() => createEngine(createInitialState()), [key]);
  const [state, setState] = useState<GameState>(engine.getState());

  // Sync state when engine is recreated (on restart)
  useMemo(() => { setState(engine.getState()); }, [engine]);
  const [log, setLog] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const send = (intent: Intent) => {
    const res = engine.applyIntent(intent);
    setState(res.state);
    setLog(prev => [
      ...res.events.map(e => {
        if (e.type === "CARD_PLACED")    return `${e.by} → ${e.target.type} ${e.target.index}`;
        if (e.type === "SYNERGY_CHANGED") return `${e.by} synergy: ${e.synergies.join(", ") || "none"}`;
        if (e.type === "TURN_ENDED")     return `Turn ended → ${e.next}`;
        if (e.type === "ILLEGAL_INTENT") return `⚠ ${e.reason}`;
        return e.type;
      }),
      ...prev,
    ].slice(0, 30));
  };

  // Binding vow phase
  if (state.phase === "BINDING_VOW") {
    return <BindingVowScreen state={state} onSend={send} />;
  }

  // Coin flip (pre-draft)
  if (state.phase === "DRAFT" && state.draft && !state.draft.coinFlipped) {
    return (
      <CoinFlipScreen
        onFlip={(firstPicker) => send({ type: "FLIP_COIN", firstPicker })}
      />
    );
  }

  // Draft phase
  if (state.phase === "DRAFT") {
    return <DraftScreen state={state} onSend={send} />;
  }

  // Reveal phase
  if (state.phase === "REVEAL") {
    return <RevealScreen state={state} onSend={send} />;
  }

  // Augment phase
  if (state.phase === "AUGMENT") {
    return <AugmentScreen state={state} onSend={send} />;
  }

  // Show resolution screen
  if (state.phase === "RESOLUTION") {
    return <ResolutionScreen state={state} onRestart={() => { setKey(k => k + 1); setLog([]); setSelectedCard(null); }} />;
  }

  const me = state.activePlayerId;
  const myZones = state.players[me];
  const boardFull = isBoardFull(myZones);

  const handleSlotClick = (slot: SlotRef) => {
    if (!selectedCard) return;
    send({ type: "PLACE_CARD", playerId: me, cardInstanceId: selectedCard, target: slot });
    setSelectedCard(null);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#05050b", color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 16, boxSizing: "border-box",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", background: "#0a0a15", borderRadius: 10,
        border: "1px solid #1a1a2e", marginBottom: 14,
      }}>
        <div style={{ fontWeight: "bold", fontSize: 16, letterSpacing: 3, color: "#fff" }}>JJK CARD BATTLE</div>
        <div style={{ fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Turn <span style={{ color: "#fff" }}>{state.turn}</span></span>
          <span>·</span>
          <span>Phase: <span style={{ color: "#ffd700" }}>{state.phase}</span></span>
          <span>·</span>
          <VowBadge playerId="P1" vowId={state.vowsChosen.P1} />
          <span style={{ color: "#333" }}>vs</span>
          <VowBadge playerId="P2" vowId={state.vowsChosen.P2} />
          {state.lockedIn.P1 && <span style={{ color: "#4a9eff" }}>P1 ✓</span>}
          {state.lockedIn.P2 && <span style={{ color: "#4a9eff" }}>P2 ✓</span>}
        </div>
        <div style={{ fontSize: 12 }}>
          Active: <span style={{ color: "#4a9eff", fontWeight: "bold" }}>{me}</span>
        </div>
      </div>

      {/* Boards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <BoardPanel title="Player 1" playerId="P1" zones={state.players.P1} cardDb={state.cardDb}
          isActive={me === "P1"} selectedCard={me === "P1" ? selectedCard : null} onSlotClick={handleSlotClick} />
        <BoardPanel title="Player 2" playerId="P2" zones={state.players.P2} cardDb={state.cardDb}
          isActive={me === "P2"} selectedCard={me === "P2" ? selectedCard : null} onSlotClick={handleSlotClick} />
      </div>

      {/* Hand */}
      <div style={{ padding: 12, background: "#09091a", borderRadius: 10, border: "1px solid #1a1a2e", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>
          {me}'S HAND
          {selectedCard
            ? <span style={{ color: "#ffd700", marginLeft: 8 }}>— select a slot to place</span>
            : <span style={{ marginLeft: 8 }}>— click a card to select</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {myZones.hand.map(inst => {
            const def = state.cardDb[inst.defId];
            if (!def) return null;
            return (
              <HandCard key={inst.instanceId} instance={inst} def={def}
                selected={selectedCard === inst.instanceId}
                onClick={() => setSelectedCard(selectedCard === inst.instanceId ? null : inst.instanceId)} />
            );
          })}
          {myZones.hand.length === 0 && (
            <span style={{ color: "#333", fontSize: 13 }}>All cards placed</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => { setSelectedCard(null); send({ type: "END_TURN", playerId: me }); }}
          style={{
            padding: "8px 18px", background: "#0a0a0a", border: "1px solid #333",
            borderRadius: 8, color: "#666", fontWeight: "bold", cursor: "pointer", fontSize: 12, letterSpacing: 1,
          }}
        >
          PASS TURN
        </button>

        <button
          onClick={() => { setSelectedCard(null); send({ type: "LOCK_IN", playerId: me }); }}
          style={{
            padding: "8px 20px",
            background: boardFull ? "#0d1a00" : "#080808",
            border: `1px solid ${boardFull ? "#66ff44" : "#2a2a2a"}`,
            borderRadius: 8,
            color: boardFull ? "#66ff44" : "#333",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: 13,
            letterSpacing: 1,
            boxShadow: boardFull ? "0 0 12px #66ff4433" : "none",
            transition: "all 0.2s",
          }}
        >
          LOCK IN ({me})
        </button>

        <div style={{ flex: 1, fontSize: 11, color: "#333", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {log[0] ?? ""}
        </div>
      </div>

      {log.length > 0 && (
        <div style={{
          marginTop: 12, padding: "8px 12px", background: "#060610", borderRadius: 8,
          border: "1px solid #111", maxHeight: 90, overflowY: "auto",
          fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#444",
        }}>
          {log.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  );
}
