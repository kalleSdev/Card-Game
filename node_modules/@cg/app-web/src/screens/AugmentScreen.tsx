import { useEffect, useRef, useState } from "react";
import type { CardInstance, GameState, Intent, PlayerId } from "@cg/contracts";
import { ROULETTE_ITEM_MAP } from "@cg/engine";
import { rc } from "../helpers";
import { SYNERGY_LABEL } from "../constants";
import { BG } from "../backgrounds";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import type { PlayerIcons, PlayerNames } from "../types";
import { VowBadge } from "./PlacementScreen";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";

const ALL_ITEM_IDS = Object.keys(ROULETTE_ITEM_MAP);

// Slot dimensions — used for both idle placeholder and landed result display
const SLOT_H = 72;

// ── Weapon preview bonus (mirrors engine) ────────────────────────────────────
function previewBonus(itemId: string, targetDefId: string, state: GameState, pid: PlayerId): number {
  const itemDef = ROULETTE_ITEM_MAP[itemId];
  if (!itemDef) return 0;
  const enemy = pid === "P1" ? "P2" : "P1";
  const enemyBoard = [
    state.players[enemy].board.leader,
    ...state.players[enemy].board.combat,
    ...state.players[enemy].board.support,
  ].filter(Boolean);
  let bonus = itemDef.baseBonus;
  if (itemId === "inverted-spear"    && enemyBoard.some(c => c?.defId === "gojo-base")) bonus += 3000;
  if (itemId === "electric-guitar"   && targetDefId === "gakuganji")  bonus += 1500;
  if (itemId === "black-rope"        && targetDefId === "miguel")      bonus += 2000;
  if (itemId === "higuruma-gavel"    && targetDefId === "higuruma")    bonus += 1500;
  if (itemId === "nobara-hammer"     && targetDefId === "nobara")      bonus += 500;
  if (itemId === "dragon-bone"       && targetDefId === "maki")        bonus += 1000;
  if (itemId === "festering-life"    && targetDefId === "kurourushi")  bonus += 1000;
  if (itemId === "split-soul-katana" && targetDefId === "toji")        bonus += 1000;
  if (itemId === "miwa-sword"        && targetDefId === "miwa")        bonus += 500;
  if (targetDefId === "naoya") bonus += 1000;
  const perk = state.cardDb[targetDefId]?.perks?.weaponEfficiency;
  if (perk === "double") bonus = Math.round(bonus * 2);
  else if (perk === "plus")  bonus = Math.round(bonus * 1.5);
  else if (perk === "base")  bonus = Math.round(bonus * 1.35);
  return bonus;
}

function weaponPerkLabel(targetDefId: string, state: GameState): string | null {
  const perk = state.cardDb[targetDefId]?.perks?.weaponEfficiency;
  if (perk === "double") return "×2 weapons";
  if (perk === "plus")   return "+50% weapons";
  if (perk === "base")   return "+35% weapons";
  if (targetDefId === "naoya") return "+1000 any";
  return null;
}

// Returns board cards for a player that get EXTRA bonus from this weapon (beyond base)
function bonusCards(
  itemId: string, state: GameState, pid: PlayerId
): { defId: string; name: string; bonus: number }[] {
  const base = ROULETTE_ITEM_MAP[itemId]?.baseBonus ?? 0;
  const cards = [
    state.players[pid].board.leader,
    ...state.players[pid].board.combat,
    ...state.players[pid].board.support,
  ].filter((c): c is CardInstance => !!c);
  return cards
    .map(c => ({ defId: c.defId, name: state.cardDb[c.defId]?.name ?? c.defId, bonus: previewBonus(itemId, c.defId, state, pid) }))
    .filter(c => c.bonus > base)
    .sort((a, b) => b.bonus - a.bonus);
}

// ── Weapon slot — fast-cycle then snap to result ─────────────────────────────
type SlotPhase = "idle" | "spinning" | "landed";

function WeaponSlot({
  resultId, phase, landDelay, onLanded, isActive, shake,
}: {
  resultId: string; phase: SlotPhase; landDelay: number;
  onLanded: () => void; isActive: boolean; shake: boolean;
}) {
  const [displayId, setDisplayId] = useState(ALL_ITEM_IDS[0]);
  const rafRef    = useRef(0);
  const calledRef = useRef(false);

  useEffect(() => {
    if (phase !== "spinning") return;
    calledRef.current = false;
    const duration  = (2 + landDelay) * 1000;
    const startTime = performance.now();
    let lastSwitch  = 0;

    const loop = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed >= duration) {
        setDisplayId(resultId);
        if (!calledRef.current) { calledRef.current = true; onLanded(); }
        return;
      }
      // Ease-out: starts at 55ms/switch, slows to 200ms as it nears landing
      const progress = elapsed / duration;
      const interval = 55 + progress * 145;
      if (now - lastSwitch >= interval) {
        setDisplayId(ALL_ITEM_IDS[Math.floor(Math.random() * ALL_ITEM_IDS.length)]);
        lastSwitch = now;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, resultId, landDelay]);

  useEffect(() => {
    if (phase === "idle") setDisplayId(ALL_ITEM_IDS[0]);
  }, [phase]);

  const def     = ROULETTE_ITEM_MAP[displayId] ?? ROULETTE_ITEM_MAP[ALL_ITEM_IDS[0]];
  const landed  = phase === "landed";
  const spinning = phase === "spinning";

  return (
    <div style={{
      width: "100%", height: SLOT_H,
      borderRadius: 10, position: "relative", overflow: "hidden",
      border: landed
        ? `1px solid ${isActive ? "rgba(255,215,0,0.65)" : "rgba(255,215,0,0.28)"}`
        : spinning ? "1px solid #3a2008" : "1px solid #160c00",
      background: landed
        ? isActive ? "rgba(22,15,0,0.97)" : "rgba(12,9,0,0.93)"
        : spinning ? "rgba(10,6,0,0.9)" : "rgba(5,3,0,0.88)",
      boxShadow: landed && isActive
        ? "0 0 20px rgba(255,215,0,0.18), inset 0 0 14px rgba(255,215,0,0.06)"
        : "none",
      animation: shake ? "drumShake 0.35s ease-out" : "none",
      transition: "border-color 0.25s, background 0.25s, box-shadow 0.25s",
      display: "flex", alignItems: "center", padding: "0 12px", gap: 10,
    }}>
      {/* Weapon icon — fixed size, brightness dims while spinning */}
      <img
        src={`/weapons/${displayId}.PNG`} alt={def.name}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={{
          width: 30, height: 30, objectFit: "contain", flexShrink: 0,
          filter: landed
            ? isActive
              ? "drop-shadow(0 0 6px #ffd700bb) drop-shadow(0 0 12px #ffaa0044) brightness(1.15)"
              : "drop-shadow(0 0 3px #bb990055) brightness(0.95)"
            : spinning
              ? "brightness(0.45) saturate(0.6)"
              : "grayscale(1) brightness(0.25)",
          transition: "filter 0.3s",
        }}
      />

      {/* Text block — identical structure and font at all times, only color varies */}
      <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
        <div style={{
          fontSize: 11, fontWeight: "bold",
          color: landed ? (isActive ? "#ffd700" : "#c8a030") : spinning ? "#7a5520" : "#1a0e00",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textShadow: landed && isActive ? "0 0 10px #ffd70077" : "none",
          transition: "color 0.25s, text-shadow 0.25s",
        }}>
          {def.name}
        </div>
        <div style={{
          fontSize: 9, marginTop: 2,
          color: landed ? (isActive ? "#997700" : "#5a4400") : spinning ? "#4a3010" : "#110800",
          transition: "color 0.25s",
        }}>
          +{def.baseBonus.toLocaleString()}
          {landed && def.conditionalDesc && (
            <span style={{ color: isActive ? "#776600" : "#4a3800", marginLeft: 4 }}>
              · {def.conditionalDesc}
            </span>
          )}
        </div>
      </div>

      {/* Gold accent line at bottom when landed */}
      {landed && (
        <div style={{
          position: "absolute", bottom: 0, left: "8%", right: "8%", height: 2,
          background: isActive
            ? "linear-gradient(90deg, transparent, #ffd700bb, transparent)"
            : "linear-gradient(90deg, transparent, #886600aa, transparent)",
          borderRadius: 1,
          animation: "slotLandLine 0.35s ease-out forwards",
        }} />
      )}
    </div>
  );
}

// ── Three-slot weapon panel ───────────────────────────────────────────────────
function DrumPanel({
  mySpins, myPool, pending, state, me, playerNames, onSpin,
}: {
  mySpins: number; myPool: string[]; pending: string | null;
  state: GameState; me: PlayerId; playerNames: PlayerNames;
  onSpin: (result: string) => void;
}) {
  const totalSlots = 3;
  const [globalPhase, setGlobalPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [results, setResults]         = useState<string[]>([]);
  const [landedCount, setLandedCount] = useState(0);
  const [shakes, setShakes]           = useState([false, false, false]);
  const [queueIdx, setQueueIdx]       = useState(0);
  const prevPendingRef = useRef<string | null>(null);
  const spinFiredRef   = useRef(false);

  // When pending clears, advance to the next weapon
  useEffect(() => {
    if (prevPendingRef.current !== null && pending === null) {
      setQueueIdx(q => q + 1);
    }
    prevPendingRef.current = pending;
  }, [pending]);

  // Auto-fire SPIN_ROULETTE for queued results
  useEffect(() => {
    if (queueIdx === 0 || queueIdx >= results.length) return;
    if (myPool.includes(results[queueIdx])) onSpin(results[queueIdx]);
  }, [queueIdx]);

  // Reset on player switch
  useEffect(() => {
    setGlobalPhase("idle");
    setResults([]);
    setLandedCount(0);
    setShakes([false, false, false]);
    setQueueIdx(0);
    spinFiredRef.current = false;
    prevPendingRef.current = null;
  }, [me]);

  const handleSpin = () => {
    if (globalPhase !== "idle" || mySpins <= 0 || pending || myPool.length < totalSlots) return;
    const shuffled = [...myPool].sort(() => Math.random() - 0.5);
    setResults(shuffled.slice(0, totalSlots));
    setLandedCount(0);
    setQueueIdx(0);
    setGlobalPhase("spinning");
    spinFiredRef.current = false;
  };

  const handleSlotLanded = (slotIdx: number) => {
    setShakes(s => { const n = [...s]; n[slotIdx] = true; return n; });
    setTimeout(() => setShakes(s => { const n = [...s]; n[slotIdx] = false; return n; }), 350);
    setLandedCount(c => {
      const next = c + 1;
      if (next >= totalSlots) {
        setGlobalPhase("done");
        if (!spinFiredRef.current && results[0]) {
          spinFiredRef.current = true;
          setTimeout(() => onSpin(results[0]), 150);
        }
      }
      return next;
    });
  };

  const slotPhase = (i: number): SlotPhase => {
    if (globalPhase === "idle") return "idle";
    return (landedCount > i || globalPhase === "done") ? "landed" : "spinning";
  };

  const allDone = mySpins === 0 && !pending && globalPhase === "done";

  if (mySpins === 0 && !pending && results.length === 0) {
    return (
      <div style={{ width: 220, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#333", letterSpacing: 2 }}>SPINS DONE</span>
      </div>
    );
  }

  return (
    <div style={{
      width: 220, flexShrink: 0,
      display: "flex", flexDirection: "column", gap: 8,
      padding: "12px 10px",
      background: "rgba(8,6,2,0.68)",
      borderRadius: 14, border: "1px solid #2a1a00",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ fontSize: 9, color: "#443300", letterSpacing: 3, textAlign: "center" }}>
        {playerNames[me].toUpperCase()} · WEAPON SPIN
      </div>

      {/* Three weapon slots */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[0, 1, 2].map(i => {
          const phase         = slotPhase(i);
          const isActive      = globalPhase === "done" && results[i] === pending;
          // Show bonuses as soon as this individual slot has landed (not waiting for all 3)
          const hasResult     = phase === "landed" && !!results[i];
          const bCards        = hasResult ? bonusCards(results[i], state, me) : [];
          const alreadyDone   = globalPhase === "done" && queueIdx > i;

          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Slot label */}
              <div style={{
                fontSize: 8, letterSpacing: 2, paddingLeft: 2,
                color: alreadyDone ? "#44aa44" : isActive ? "#ffd700" : "#332200",
              }}>
                {alreadyDone ? "✓ EQUIPPED" : isActive ? "▶ EQUIP NOW" : `SLOT ${i + 1}`}
              </div>

              {/* Idle placeholder */}
              {globalPhase === "idle" ? (
                <div style={{
                  height: SLOT_H, borderRadius: 10,
                  background: "rgba(4,3,0,0.8)", border: "1px solid #1a1200",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <div style={{ fontSize: 18, opacity: 0.07 }}>⚔</div>
                  <div style={{ fontSize: 9, color: "#1a1000", letterSpacing: 1 }}>SLOT {i + 1}</div>
                </div>
              ) : (
                <WeaponSlot
                  resultId={results[i] ?? ALL_ITEM_IDS[0]}
                  phase={phase}
                  landDelay={i}
                  onLanded={() => handleSlotLanded(i)}
                  isActive={isActive}
                  shake={shakes[i]}
                />
              )}

              {/* Bonus cards shown after landing */}
              {hasResult && bCards.length > 0 && (
                <div style={{
                  padding: "5px 8px",
                  background: "rgba(4,6,2,0.7)", borderRadius: 7,
                  border: `1px solid ${isActive ? "rgba(255,215,0,0.18)" : "#1a1800"}`,
                  opacity: alreadyDone ? 0.4 : 1,
                  transition: "opacity 0.3s",
                }}>
                  <div style={{ fontSize: 8, color: "#665500", letterSpacing: 1, marginBottom: 3 }}>
                    Bonus if equipped to:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {bCards.map(c => (
                      <div key={c.defId} style={{
                        fontSize: 8, padding: "2px 5px", borderRadius: 4,
                        background: "rgba(0,50,0,0.4)", border: "1px solid #1e3a1e",
                        color: "#55bb33",
                      }}>
                        {c.name} <span style={{ color: "#33ee11", fontWeight: "bold" }}>+{c.bonus.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SPIN button */}
      {globalPhase === "idle" && mySpins > 0 && !pending && (
        <button
          onClick={handleSpin}
          style={{
            width: "100%", padding: "12px 0",
            background: "linear-gradient(135deg, #1a0c00, #0d1400)",
            border: "2px solid #cc8800", borderRadius: 12,
            color: "#ffd700", fontWeight: "bold", cursor: "pointer",
            fontSize: 16, letterSpacing: 4, fontFamily: "inherit",
            boxShadow: "0 0 28px #cc880040", marginTop: 2,
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 44px #cc880066"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 28px #cc880040"; }}
        >
          ⚔ SPIN
        </button>
      )}

      {globalPhase === "spinning" && (
        <div style={{ textAlign: "center", fontSize: 10, color: "#443300", letterSpacing: 2, animation: "spinHintPulse 1s ease-in-out infinite" }}>
          spinning...
        </div>
      )}

      {globalPhase === "done" && pending && (
        <div style={{ textAlign: "center", fontSize: 10, color: "#887700", letterSpacing: 1 }}>
          ← click a card to equip →
        </div>
      )}

      {allDone && (
        <div style={{ textAlign: "center", fontSize: 10, color: "#44aa44", letterSpacing: 2 }}>
          ✓ all weapons equipped
        </div>
      )}
    </div>
  );
}

// ── Card slot on augment board ────────────────────────────────────────────────
function AugSlot({
  inst, state, isMe, pid, pending, equipped, onAssign,
}: {
  inst: CardInstance | null; state: GameState; isMe: boolean;
  pid: PlayerId; pending: string | null;
  equipped?: { itemId: string; bonus: number };
  onAssign: (instanceId: string) => void;
}) {
  const def = inst ? state.cardDb[inst.defId] : null;
  const equippedDef = equipped ? ROULETTE_ITEM_MAP[equipped.itemId] : undefined;
  const cardColor = def ? rc(def.rarity) : null;
  const canAssign = isMe && !!pending && !!inst && !equipped;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
      <div
        onClick={() => canAssign && inst && onAssign(inst.instanceId)}
        style={{
          position: "relative", width: 138, height: 194,
          borderRadius: 12,
          border: `2px solid ${canAssign ? "rgba(255,215,0,0.55)" : def ? (cardColor + "44") : "#18182a"}`,
          background: def ? `linear-gradient(180deg, ${cardColor}0a 0%, #0a0a1e 100%)` : "rgba(6,6,18,0.8)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          cursor: canAssign ? "pointer" : "default",
          boxShadow: canAssign ? "0 0 20px rgba(255,215,0,0.15)" : def ? `0 0 12px ${cardColor}14` : "none",
          animation: canAssign ? "slotPulse 1.6s ease-in-out infinite" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          overflow: "hidden", flexShrink: 0,
        }}
      >
        {def && cardColor && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: cardColor, opacity: 0.6, borderRadius: "12px 12px 0 0" }} />
        )}
        {def && inst ? (
          <>
            <CharacterCard defId={inst.defId} def={def} size="md" equippedBonus={equipped?.bonus} />
            {isMe && canAssign && pending && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "rgba(0,180,0,0.88)", borderRadius: "0 0 10px 10px",
                padding: "3px 0", textAlign: "center",
                fontSize: 11, fontWeight: "bold", color: "#fff", pointerEvents: "none", zIndex: 5,
              }}>
                +{previewBonus(pending, inst.defId, state, pid).toLocaleString()}
              </div>
            )}
            {isMe && !equipped && !pending && (() => {
              const label = weaponPerkLabel(inst.defId, state);
              return label ? (
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "rgba(0,140,80,0.8)", borderRadius: "0 0 10px 10px",
                  padding: "2px 0", textAlign: "center",
                  fontSize: 9, color: "#aaffcc", fontWeight: "bold", pointerEvents: "none", zIndex: 4,
                }}>
                  {label}
                </div>
              ) : null;
            })()}
          </>
        ) : (
          <div style={{ fontSize: 22, opacity: 0.1 }}>—</div>
        )}
      </div>

      {equippedDef && equipped && (
        <div style={{ display: "flex", gap: 2, maxWidth: 138 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 3, background: "#0a140a", border: "1px solid #334422", borderRadius: "5px 0 0 5px", padding: "2px 5px" }}>
            <img src={`/weapons/${equipped.itemId}.PNG`} alt={equippedDef.name}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              style={{ width: 14, height: 14, objectFit: "contain", flexShrink: 0 }}
            />
            <span style={{ fontSize: 8, color: "#88cc66", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{equippedDef.name}</span>
          </div>
          <div style={{ flexShrink: 0, background: "#0d1a0d", border: "1px solid #446633", borderRadius: "0 5px 5px 0", padding: "2px 5px", fontSize: 8, color: "#66ff44", fontWeight: "bold", whiteSpace: "nowrap" }}>
            +{equipped.bonus.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-player board panel ────────────────────────────────────────────────────
function AugmentBoardPanel({
  pid, state, me, pending, synergyGlow, onAssign, playerNames, playerIcons,
}: {
  pid: PlayerId; state: GameState; me: PlayerId;
  pending: string | null; synergyGlow: boolean;
  onAssign: (targetId: string) => void;
  playerNames: PlayerNames; playerIcons: PlayerIcons;
}) {
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  const isMe = pid === me;
  const zones = state.players[pid];
  const aug = state.augmentPhase!;
  const equipped = aug.equipped[pid];
  const mySpins = aug.spinsRemaining[pid];

  const getEq = (inst: CardInstance | null) =>
    inst ? equipped.find(e => e.targetCardInstanceId === inst.instanceId) : undefined;

  const slot = (inst: CardInstance | null) => (
    <AugSlot
      inst={inst} state={state} isMe={isMe} pid={pid}
      pending={pending} equipped={getEq(inst) as { itemId: string; bonus: number } | undefined}
      onAssign={onAssign}
    />
  );

  return (
    <div style={{
      flex: 1,
      background: isMe ? "rgba(8,8,18,0.55)" : "rgba(4,4,10,0.35)",
      borderRadius: 16,
      border: `${isMe ? "2px" : "1px"} solid ${isMe ? pColor + "55" : "#1a1a22"}`,
      padding: "14px 12px",
      backdropFilter: "blur(6px)",
      boxShadow: isMe ? `0 0 44px ${pColor}20, 0 0 80px ${pColor}0a` : "none",
      transition: "box-shadow 0.3s, border-color 0.3s",
      display: "flex", flexDirection: "column", gap: 8,
      opacity: isMe ? 1 : 0.6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PlayerIcon icon={playerIcons[pid]} size={20} />
          <span style={{ fontWeight: "bold", fontSize: 13, color: isMe ? pColor : "#555" }}>{playerNames[pid]}</span>
          {isMe && mySpins > 0 && (
            <span style={{ fontSize: 9, color: "#ffd700", background: "#1a1400", borderRadius: 4, padding: "2px 5px", letterSpacing: 1 }}>
              ×{mySpins} LEFT
            </span>
          )}
          {isMe && mySpins === 0 && (
            <span style={{ fontSize: 9, color: "#44cc44", background: "#0a1a0a", borderRadius: 4, padding: "2px 5px" }}>✓ DONE</span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#ffd700" }}>{zones.scorePreview.toLocaleString()}</div>
          <div style={{ fontSize: 8, color: "#333", letterSpacing: 1 }}>SCORE</div>
        </div>
      </div>

      {zones.activeSynergies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {zones.activeSynergies.map(s => (
            <span key={s} style={{
              fontSize: 9, color: synergyGlow ? "#cc88ff" : "#9b59ff",
              background: synergyGlow ? "#1a0a2e" : "#0f0a1a",
              border: `1px solid ${synergyGlow ? "#7733cc" : "#2a1a4a"}`,
              borderRadius: 4, padding: "2px 5px",
              boxShadow: synergyGlow ? "0 0 8px #9933ff55" : "none",
              transition: "all 0.4s",
              animation: synergyGlow ? "synPulse 2s ease-in-out infinite" : "none",
            }}>
              {SYNERGY_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>{slot(zones.board.leader)}</div>
        <div style={{ width: "80%", height: 1, background: "linear-gradient(90deg, transparent, #2a2a4a, transparent)" }} />
        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          {slot(zones.board.combat[0])}
          {slot(zones.board.combat[1])}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {slot(zones.board.support[0])}
          {slot(zones.board.support[1])}
          {slot(zones.board.support[2])}
        </div>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AugmentScreen({
  state, onSend, playerNames, playerIcons,
}: {
  state: GameState; onSend: (i: Intent) => void;
  playerNames: PlayerNames; playerIcons: PlayerIcons;
}) {
  const me = state.activePlayerId;
  const aug = state.augmentPhase!;
  const mySpins = aug.spinsRemaining[me];
  const pending = aug.pendingItem;
  const myPool  = aug.pool[me];

  const handleSpin = (result: string) => {
    onSend({ type: "SPIN_ROULETTE", playerId: me, result });
  };

  const handleAssign = (targetId: string) => {
    if (!pending) return;
    onSend({ type: "ASSIGN_ITEM", playerId: me, targetCardInstanceId: targetId });
  };

  const mySpinsDone = mySpins === 0 && !pending;

  return (
    <div style={{
      minHeight: "100vh", background: "#05050b",
      backgroundImage: BG.augment, backgroundSize: "cover", backgroundPosition: "center",
      animation: "bgPan 62s ease-in-out infinite",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: 14, boxSizing: "border-box",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative",
    }}>
      <AmbientCanvas theme="sparks" />
      <AmbientOverlay theme="dark" />
      <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,11,0.42)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "6px 12px", background: "rgba(10,10,21,0.55)", borderRadius: 10,
          border: "1px solid #1a1a2e", backdropFilter: "blur(4px)", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <PlayerIcon icon={playerIcons.P1} size={24} />
            <span style={{ fontWeight: "bold", fontSize: 12, color: me === "P1" ? "#4a9eff" : "#555" }}>{playerNames.P1}</span>
            <VowBadge vowId={state.vowsChosen.P1} />
          </div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#333", flexShrink: 0 }}>PHASE 4 · AUGMENTS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
            <VowBadge vowId={state.vowsChosen.P2} />
            <span style={{ fontWeight: "bold", fontSize: 12, color: me === "P2" ? "#ff6666" : "#555" }}>{playerNames.P2}</span>
            <PlayerIcon icon={playerIcons.P2} size={24} />
          </div>
        </div>

        {/* Three columns */}
        <div style={{ display: "flex", gap: 12, flex: 1, alignItems: "stretch" }}>
          <AugmentBoardPanel
            pid="P1" state={state} me={me} pending={pending}
            synergyGlow={mySpinsDone && me === "P1"}
            onAssign={handleAssign} playerNames={playerNames} playerIcons={playerIcons}
          />
          <DrumPanel
            mySpins={mySpins} myPool={myPool} pending={pending}
            state={state} me={me} playerNames={playerNames}
            onSpin={handleSpin}
          />
          <AugmentBoardPanel
            pid="P2" state={state} me={me} pending={pending}
            synergyGlow={mySpinsDone && me === "P2"}
            onAssign={handleAssign} playerNames={playerNames} playerIcons={playerIcons}
          />
        </div>

        {mySpinsDone && aug.spinsRemaining[me === "P1" ? "P2" : "P1"] > 0 && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#333", padding: "8px 0", letterSpacing: 2 }}>
            WAITING FOR {playerNames[me === "P1" ? "P2" : "P1"].toUpperCase()}...
          </div>
        )}
      </div>

      <style>{`
        @keyframes drumShake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-4px); }
          50%     { transform: translateX(4px); }
          75%     { transform: translateX(-2px); }
        }
        @keyframes slotPulse {
          0%,100% { box-shadow: 0 0 20px rgba(255,215,0,0.15); }
          50%     { box-shadow: 0 0 32px rgba(255,215,0,0.28); }
        }
        @keyframes slotLandLine {
          0%   { opacity: 0; transform: scaleX(0); }
          60%  { opacity: 1; transform: scaleX(1); }
          100% { opacity: 0.6; transform: scaleX(1); }
        }
        @keyframes spinHintPulse {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 1; }
        }
        @keyframes synPulse {
          0%,100% { box-shadow: 0 0 8px #9933ff44; }
          50%     { box-shadow: 0 0 18px #9933ff99; }
        }
        @keyframes bgPan {
          0%   { background-position: 50% 50%; }
          25%  { background-position: 52% 48%; }
          50%  { background-position: 48% 52%; }
          75%  { background-position: 51% 49%; }
          100% { background-position: 50% 50%; }
        }
      `}</style>
    </div>
  );
}
