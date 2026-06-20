import { useEffect, useRef, useState } from "react";
import type { CardInstance, GameState, Intent, PlayerId } from "@cg/contracts";
import { rc } from "../helpers";
import { RARITY_DRAMATIC } from "../constants";
import CharacterCard, { CardBack } from "../components/CharacterCard";
import { BG } from "../backgrounds";

/** 3×2 grid – revealed cards slot in, empty slots stay blank */
function HandGrid({ pId, revealedIds, state }: {
  pId: PlayerId; revealedIds: string[]; state: GameState;
}) {
  const hand = state.players[pId].hand;
  const pColor = pId === "P1" ? "#4a9eff" : "#ff6666";
  return (
    <div>
      <div style={{ fontSize: 10, color: pColor + "99", letterSpacing: 3, marginBottom: 12, textAlign: "center" }}>
        {pId} &nbsp;·&nbsp; {revealedIds.length} / 6 REVEALED
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "12px 10px",
        justifyItems: "center",
      }}>
        {/* Always render 6 slots; fill revealed ones, leave others empty */}
        {Array.from({ length: 6 }).map((_, i) => {
          const inst = hand[i] as CardInstance | undefined;
          const isRevealed = inst && revealedIds.includes(inst.instanceId);
          const def = inst ? state.cardDb[inst.defId] : null;

          if (isRevealed && def && inst) {
            return <CharacterCard key={inst.instanceId} defId={inst.defId} def={def} size="md" />;
          }
          // empty slot placeholder
          return (
            <div key={i} style={{
              width: 128, height: 182, borderRadius: 10,
              border: "1px dashed #1e1e30",
              background: "rgba(8,8,18,0.5)",
              flexShrink: 0,
            }} />
          );
        })}
      </div>
    </div>
  );
}

export default function RevealScreen({ state, onSend }: { state: GameState; onSend: (i: Intent) => void }) {
  const me = state.activePlayerId;
  const rp = state.revealPhase!;
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [animInst, setAnimInst] = useState<CardInstance | null>(null);
  const [animStep, setAnimStep] = useState<"pre" | "flip" | null>(null);

  const myHand = state.players[me].hand;
  const myUnrevealed = myHand.filter(c => !rp.revealed.includes(c.instanceId));
  const revealsLeft = myUnrevealed.length;

  const p1Revealed = rp.revealed.filter(id => state.players.P1.hand.some(c => c.instanceId === id));
  const p2Revealed = rp.revealed.filter(id => state.players.P2.hand.some(c => c.instanceId === id));

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  const clickCard = (inst: CardInstance) => {
    if (animInst || revealsLeft <= 0) return;
    setAnimInst(inst);
    setAnimStep("pre");
    const t1 = setTimeout(() => setAnimStep("flip"), 500);
    const t2 = setTimeout(() => {
      onSend({ type: "REVEAL_CARD", playerId: me, cardInstanceId: inst.instanceId });
      setAnimInst(null);
      setAnimStep(null);
    }, 2400);
    timeouts.current = [t1, t2];
  };

  const def = animInst ? state.cardDb[animInst.defId] : null;
  const dramatic = def ? RARITY_DRAMATIC[def.rarity] : null;

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.reveal, backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Dark overlay */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.4)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, padding: "20px 20px 12px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 5, color: "#2a2a2a" }}>PHASE 2</div>
          <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 5, color: "#fff", marginBottom: 4 }}>REVEAL</div>
          <div style={{ fontSize: 12, color: "#555" }}>
            <span style={{ color: "#4a9eff" }}>{me}</span>
            &nbsp;— reveal all your cards &nbsp;·&nbsp;
            <span style={{ color: revealsLeft > 0 ? "#ffd700" : "#44dd44" }}>{revealsLeft} remaining</span>
          </div>
        </div>

        {/* Both players' board grids — side by side */}
        <div style={{ display: "flex", gap: 20, marginBottom: 20, justifyContent: "center" }}>
          <div style={{
            flex: 1, maxWidth: 480,
            background: "rgba(8,8,18,0.35)", borderRadius: 14,
            border: "1px solid #1a1a33", padding: "16px 14px",
            backdropFilter: "blur(4px)",
          }}>
            <HandGrid pId="P1" revealedIds={p1Revealed} state={state} />
          </div>
          <div style={{ width: 1, background: "#111", alignSelf: "stretch" }} />
          <div style={{
            flex: 1, maxWidth: 480,
            background: "rgba(8,8,18,0.35)", borderRadius: 14,
            border: "1px solid #1a1a33", padding: "16px 14px",
            backdropFilter: "blur(4px)",
          }}>
            <HandGrid pId="P2" revealedIds={p2Revealed} state={state} />
          </div>
        </div>

        {/* Active player unrevealed hand — lg cards, centred below */}
        <div style={{
          background: "rgba(6,6,16,0.35)", borderRadius: 14,
          border: "1px solid #22224a", padding: "18px 20px",
          backdropFilter: "blur(4px)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 10, color: "#3a3a5a", letterSpacing: 3, marginBottom: 16 }}>
            YOUR HAND — click a card to reveal it
          </div>
          <div style={{ display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap" }}>
            {myUnrevealed.map(inst => (
              <div
                key={inst.instanceId}
                onClick={() => clickCard(inst)}
                style={{
                  cursor: animInst ? "default" : "pointer",
                  opacity: animInst ? 0.35 : 1,
                  transition: "opacity 0.2s, transform 0.15s",
                }}
                onMouseEnter={e => { if (!animInst) (e.currentTarget as HTMLElement).style.transform = "translateY(-10px) scale(1.05)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
              >
                <CardBack size="lg" shownRarity={inst.visibility?.shownRarity} />
              </div>
            ))}
            {myUnrevealed.length === 0 && (
              <div style={{ color: "#2a2a3a", fontSize: 13, padding: "20px 0" }}>
                All revealed — waiting for opponent...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dramatic overlay */}
      {animInst && animStep && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: def && dramatic
            ? `radial-gradient(ellipse at center, ${rc(def.rarity)}22 0%, #000000f8 55%)`
            : "#000000f8",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32,
        }}>
          {/* Particle ring behind card */}
          {animStep === "flip" && def && (
            <div style={{
              position: "absolute",
              width: 380, height: 380, borderRadius: "50%",
              border: `2px solid ${rc(def.rarity)}44`,
              boxShadow: `0 0 60px ${rc(def.rarity)}22, inset 0 0 60px ${rc(def.rarity)}11`,
              animation: "ringPulse 0.8s ease-out forwards",
            }} />
          )}

          <div style={{ fontSize: 11, letterSpacing: 7, color: "#2a2a2a" }}>{me} REVEALS</div>

          {animStep === "pre" && (
            <div style={{ animation: "riseUp 0.35s ease-out forwards" }}>
              <CardBack size="xl" shownRarity={animInst.visibility?.shownRarity} />
            </div>
          )}

          {animStep === "flip" && def && (
            <div style={{ animation: "dramaticReveal 0.7s cubic-bezier(0.175,0.885,0.32,1.275) forwards", position: "relative", zIndex: 1 }}>
              <CharacterCard defId={animInst.defId} def={def} size="xl" />
            </div>
          )}

          {animStep === "flip" && def && dramatic && (
            <>
              <div style={{
                fontSize: 15, letterSpacing: 8, color: rc(def.rarity),
                fontWeight: "bold",
                textShadow: `0 0 30px ${rc(def.rarity)}, 0 0 60px ${rc(def.rarity)}66`,
                animation: "fadeUp 0.5s 0.15s ease-out both",
              }}>
                {dramatic.label}
              </div>
              <div style={{
                fontSize: 11, color: rc(def.rarity) + "66", letterSpacing: 3,
                animation: "fadeUp 0.5s 0.35s ease-out both",
              }}>
                {def.name.toUpperCase()}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes riseUp { from { transform: translateY(28px) scale(0.95); opacity: 0.2; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes dramaticReveal {
          0%   { transform: rotateY(90deg) scale(0.4); opacity: 0; }
          50%  { transform: rotateY(-10deg) scale(1.18); opacity: 1; }
          75%  { transform: rotateY(4deg) scale(1.08); }
          100% { transform: rotateY(0deg) scale(1); }
        }
        @keyframes fadeUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes ringPulse { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1.6); opacity: 0; } }
      `}</style>
    </div>
  );
}
