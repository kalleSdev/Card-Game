import { useEffect, useState } from "react";
import type { CardInstance, GameState, Intent, PlayerId } from "@cg/contracts";
import { DOMAIN_EFFECTS, DEFAULT_DOMAIN, ROULETTE_ITEM_MAP } from "@cg/engine";
import { rc } from "../helpers";
import { SYNERGY_LABEL } from "../constants";
import { BG } from "../backgrounds";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import type { PlayerIcons, PlayerNames } from "../types";
import { VowBadge } from "./PlacementScreen";

// ── Single augment slot cell — same visual footprint as PlacementScreen ───────
function AugSlot({
  inst, state, isMe, pending, spinning, equipped,
  onAssign, synergyGlow,
  showUnleashPicker, unleashHover, setUnleashHover, unleashPicked, onPickUnleash,
}: {
  inst: CardInstance | null; state: GameState; isMe: boolean;
  pending: string | null; spinning: boolean;
  equipped?: { itemId: string; bonus: number };
  onAssign: (instanceId: string) => void; synergyGlow: boolean;
  showUnleashPicker: boolean;
  unleashHover: string | null; setUnleashHover: (id: string | null) => void;
  unleashPicked: string | null; onPickUnleash: (defId: string) => void;
}) {
  const def = inst ? state.cardDb[inst.defId] : null;
  const equippedDef = equipped ? ROULETTE_ITEM_MAP[equipped.itemId] : undefined;
  const cardColor = def ? rc(def.rarity) : null;
  const canAssign = isMe && !!pending && !!inst && !spinning && !equipped;
  const canPickUnleash = showUnleashPicker && isMe && !!inst;
  const isHov = inst ? unleashHover === inst.defId : false;
  const isPicked = inst ? unleashPicked === inst.defId : false;
  const domain = inst ? (DOMAIN_EFFECTS[inst.defId] ?? DEFAULT_DOMAIN) : null;

  const handleClick = () => {
    if (canAssign && inst) { onAssign(inst.instanceId); return; }
    if (canPickUnleash && inst) { onPickUnleash(inst.defId); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
      <div
        onClick={handleClick}
        onMouseEnter={() => canPickUnleash && inst ? setUnleashHover(inst.defId) : undefined}
        onMouseLeave={() => setUnleashHover(null)}
        style={{
          position: "relative",
          width: 138, height: 194,
          borderRadius: 12,
          border: `2px solid ${
            isPicked ? "#ffd700" :
            canAssign && isHov ? "#ffd70099" :
            def ? (cardColor + "aa") : "#18182a"
          }`,
          background: def
            ? `linear-gradient(180deg, ${cardColor}0a 0%, #0a0a1e 100%)`
            : "rgba(6,6,18,0.8)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          cursor: (canAssign || canPickUnleash) ? "pointer" : "default",
          boxShadow: isPicked
            ? "0 0 20px #ffd70055"
            : def ? `0 0 14px ${cardColor}22` : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Top accent */}
        {def && cardColor && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: cardColor, opacity: 0.7, borderRadius: "12px 12px 0 0" }} />
        )}

        {def && inst ? (
          <CharacterCard
            defId={inst.defId} def={def} size="md"
            overlay={canAssign ? "EQUIP" : undefined}
          />
        ) : (
          <div style={{ fontSize: 22, opacity: 0.1 }}>—</div>
        )}

        {/* Picked check */}
        {isPicked && (
          <div style={{
            position: "absolute", top: -8, right: -8,
            background: "#ffd700", borderRadius: "50%",
            width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: "bold", color: "#000", zIndex: 3,
          }}>✓</div>
        )}

        {/* Unleash hover preview */}
        {isHov && domain && inst && (
          <div style={{
            position: "absolute", bottom: "105%", left: "50%", transform: "translateX(-50%)",
            background: "rgba(6,6,18,0.97)", border: "1px solid #2a1a4a",
            borderRadius: 8, padding: "8px 12px", minWidth: 130, zIndex: 30,
            backdropFilter: "blur(6px)", boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
            pointerEvents: "none",
          }}>
            <div style={{ fontSize: 11, fontWeight: "bold", color: "#e0e0e0", marginBottom: 4, textAlign: "center" }}>{domain.name}</div>
            <div style={{ fontSize: 10, color: "#44ee44", textAlign: "center" }}>+{domain.ownPct}% own</div>
            {domain.enemyPct < 0 && <div style={{ fontSize: 10, color: "#ee4444", textAlign: "center" }}>{domain.enemyPct}% enemy</div>}
          </div>
        )}
      </div>

      {/* Weapon badge — two separate boxes */}
      {equippedDef && equipped && (
        <div style={{ display: "flex", gap: 2, maxWidth: 138 }}>
          {/* Name box */}
          <div style={{
            flex: 1, minWidth: 0,
            display: "flex", alignItems: "center", gap: 3,
            background: "#0a140a", border: "1px solid #334422",
            borderRadius: "5px 0 0 5px", padding: "2px 5px",
          }}>
            <img
              src={`/weapons/${equipped.itemId}.PNG`}
              alt={equippedDef.name}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              style={{ width: 14, height: 14, objectFit: "contain", flexShrink: 0 }}
            />
            <span style={{ fontSize: 8, color: "#88cc66", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {equippedDef.name}
            </span>
          </div>
          {/* Points box */}
          <div style={{
            flexShrink: 0,
            background: "#0d1a0d", border: "1px solid #446633",
            borderRadius: "0 5px 5px 0", padding: "2px 5px",
            fontSize: 8, color: "#66ff44", fontWeight: "bold", whiteSpace: "nowrap",
          }}>
            +{equipped.bonus.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-player board (same layout as PlacementScreen) ────────────────────────
function AugmentBoardPanel({
  pid, state, me, pending, spinning, synergyGlow,
  onAssign, unleashHover, setUnleashHover, unleashPicked, onPickUnleash,
  showUnleashPicker, playerNames, playerIcons,
}: {
  pid: PlayerId; state: GameState; me: PlayerId;
  pending: string | null; spinning: boolean; synergyGlow: boolean;
  onAssign: (targetId: string) => void;
  unleashHover: string | null; setUnleashHover: (id: string | null) => void;
  unleashPicked: string | null; onPickUnleash: (defId: string) => void;
  showUnleashPicker: boolean;
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

  const slotProps = (inst: CardInstance | null) => ({
    inst, state, isMe,
    pending, spinning, equipped: getEq(inst),
    onAssign, synergyGlow,
    showUnleashPicker,
    unleashHover, setUnleashHover,
    unleashPicked, onPickUnleash,
  });

  return (
    <div style={{
      flex: 1,
      background: "rgba(6,6,14,0.4)",
      borderRadius: 16,
      border: `1px solid ${isMe ? pColor + "44" : "#1a1a22"}`,
      padding: "14px 12px",
      backdropFilter: "blur(6px)",
      boxShadow: isMe ? `0 0 24px ${pColor}18` : "none",
      transition: "box-shadow 0.3s",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PlayerIcon icon={playerIcons[pid]} size={20} />
          <span style={{ fontWeight: "bold", fontSize: 13, color: isMe ? pColor : "#444" }}>{playerNames[pid]}</span>
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

      {/* Synergies */}
      {zones.activeSynergies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {zones.activeSynergies.map(s => (
            <span key={s} style={{
              fontSize: 9,
              color: synergyGlow ? "#cc88ff" : "#9b59ff",
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

      {/* Board layout — identical structure to PlacementScreen */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        {/* Leader */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <AugSlot {...slotProps(zones.board.leader)} />
        </div>

        <div style={{ width: "80%", height: 1, background: "linear-gradient(90deg, transparent, #2a2a4a, transparent)" }} />

        {/* Combat */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <AugSlot {...slotProps(zones.board.combat[0])} />
          <AugSlot {...slotProps(zones.board.combat[1])} />
        </div>

        {/* Support */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <AugSlot {...slotProps(zones.board.support[0])} />
          <AugSlot {...slotProps(zones.board.support[1])} />
          <AugSlot {...slotProps(zones.board.support[2])} />
        </div>
      </div>
    </div>
  );
}

// ── Center spin / weapon column ───────────────────────────────────────────────
function SpinColumn({
  weaponQueue, pending, pendingDef, mySpins, onSpin, me, playerNames,
}: {
  weaponQueue: string[]; pending: string | null;
  pendingDef: (typeof ROULETTE_ITEM_MAP)[string] | null;
  mySpins: number; onSpin: () => void; me: PlayerId; playerNames: PlayerNames;
}) {
  const hasFired = weaponQueue.length > 0;
  const done = mySpins === 0 && !pending && !hasFired;

  if (done) return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 11, color: "#2a2a3a", letterSpacing: 2 }}>SPINS DONE</span>
    </div>
  );

  return (
    <div style={{
      width: 220, flexShrink: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 14, padding: "16px 12px",
      background: "rgba(10,10,20,0.45)",
      borderRadius: 14, border: "1px solid #2a1a00",
      backdropFilter: "blur(6px)",
    }}>
      <div style={{ fontSize: 9, color: "#443300", letterSpacing: 3, textAlign: "center" }}>
        {playerNames[me].toUpperCase()} · AUGMENTS
      </div>

      {/* Initial spin button — only before first click */}
      {!hasFired && mySpins > 0 && (
        <button
          onClick={onSpin}
          style={{
            padding: "14px 32px",
            background: "linear-gradient(135deg, #1a0a00, #0a1a00)",
            border: "1px solid #cc8800", borderRadius: 10,
            color: "#ffd700", fontWeight: "bold", cursor: "pointer",
            fontSize: 18, letterSpacing: 3,
            boxShadow: "0 0 24px #cc880033",
          }}
        >
          🎰 SPIN
        </button>
      )}

      {/* Show all weapons in queue */}
      {hasFired && (
        <>
          <div style={{ fontSize: 9, color: "#887700", letterSpacing: 2, textAlign: "center" }}>
            CHOOSE A WEAPON TO EQUIP
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
            {weaponQueue.map(itemId => {
              const def = ROULETTE_ITEM_MAP[itemId];
              if (!def) return null;
              const isCurrent = pending === itemId;
              return (
                <div key={itemId} style={{
                  background: isCurrent ? "rgba(18,14,0,0.9)" : "rgba(10,8,0,0.7)",
                  border: `2px solid ${isCurrent ? "#ffd700" : "#443300"}`,
                  borderRadius: 8, padding: "8px 10px",
                  display: "flex", alignItems: "center", gap: 8,
                  boxShadow: isCurrent ? "0 0 16px #ffd70033" : "none",
                  opacity: isCurrent ? 1 : 0.55,
                  transition: "all 0.2s",
                }}>
                  <img
                    src={`/weapons/${itemId}.PNG`} alt={def.name}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: "bold", color: isCurrent ? "#ffd700" : "#886600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      ⚔ {def.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#777" }}>+{def.baseBonus.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {pending && (
            <div style={{ fontSize: 10, color: "#666", textAlign: "center", lineHeight: 1.5 }}>
              ← Click a character<br/>to equip the highlighted weapon →
            </div>
          )}
        </>
      )}
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
  const myPool = aug.pool[me];

  const [weaponQueue, setWeaponQueue] = useState<string[]>([]);
  const [unleashHover, setUnleashHover] = useState<string | null>(null);
  const [unleashPicked, setUnleashPicked] = useState<string | null>(null);
  const [unleashConfirmed, setUnleashConfirmed] = useState(false);

  useEffect(() => {
    setUnleashPicked(null);
    setUnleashHover(null);
    setUnleashConfirmed(false);
    setWeaponQueue([]);
  }, [me]);

  // Auto-spin the next queued weapon when pendingItem becomes null
  useEffect(() => {
    if (!pending && weaponQueue.length > 0 && mySpins > 0) {
      const next = weaponQueue[weaponQueue.length - mySpins];
      if (next) onSend({ type: "SPIN_ROULETTE", playerId: me, result: next });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, mySpins]);

  const spinRoulette = () => {
    if (weaponQueue.length > 0 || mySpins <= 0) return;
    // Pick all spins at once — no duplicates
    const shuffled = [...myPool].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, mySpins);
    setWeaponQueue(picks);
    // Fire first spin immediately
    onSend({ type: "SPIN_ROULETTE", playerId: me, result: picks[0] });
  };

  const assignItem = (targetId: string) => {
    if (!pending) return;
    onSend({ type: "ASSIGN_ITEM", playerId: me, targetCardInstanceId: targetId });
  };

  const pendingDef = pending ? ROULETTE_ITEM_MAP[pending] : null;
  const mySpinsDone = mySpins === 0 && !pending && weaponQueue.length > 0;
  const showUnleashPicker = mySpinsDone;
  const pColor = me === "P1" ? "#4a9eff" : "#ff6666";

  const boardProps = (pid: PlayerId) => ({
    pid, state, me,
    pending, spinning: false,
    synergyGlow: mySpinsDone && pid === me,
    onAssign: assignItem,
    unleashHover, setUnleashHover,
    unleashPicked, onPickUnleash: setUnleashPicked,
    showUnleashPicker: showUnleashPicker && pid === me,
    playerNames, playerIcons,
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#05050b",
      backgroundImage: BG.augment, backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: 14, boxSizing: "border-box",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,11,0.42)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>

        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "6px 12px", background: "rgba(10,10,21,0.45)", borderRadius: 10,
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

        {/* ── Three columns: P1 board | spin panel | P2 board ── */}
        <div style={{ display: "flex", gap: 12, flex: 1, alignItems: "stretch" }}>
          <AugmentBoardPanel {...boardProps("P1")} />
          <SpinColumn
            weaponQueue={weaponQueue}
            pending={pending} pendingDef={pendingDef}
            mySpins={mySpins} onSpin={spinRoulette}
            me={me} playerNames={playerNames}
          />
          <AugmentBoardPanel {...boardProps("P2")} />
        </div>

        {/* ── Unleash picker section ── */}
        {showUnleashPicker && (
          <div style={{
            padding: "12px 14px",
            background: "rgba(8,8,22,0.45)", borderRadius: 12,
            border: `1px solid ${unleashPicked ? "#ffd70044" : "#2a1a4a"}`,
            backdropFilter: "blur(6px)", transition: "border-color 0.3s",
          }}>
            <div style={{ fontSize: 9, color: "#664488", letterSpacing: 2, marginBottom: 8 }}>
              {unleashPicked
                ? <span style={{ color: "#ffd700" }}>✓ UNLEASH SELECTED — confirm below or change selection</span>
                : <span>CHOOSE YOUR UNLEASH · hover to preview · click to select</span>}
            </div>

            {/* Active synergies glowing */}
            {state.players[me].activeSynergies.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {state.players[me].activeSynergies.map(s => (
                  <span key={s} style={{
                    fontSize: 9, color: "#cc88ff", background: "#1a0a2e",
                    border: "1px solid #7733cc", borderRadius: 4, padding: "2px 5px",
                    boxShadow: "0 0 8px #9933ff44",
                    animation: "synPulse 2s ease-in-out infinite",
                  }}>
                    {SYNERGY_LABEL[s] ?? s}
                  </span>
                ))}
              </div>
            )}

            {/* Character row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {([
                state.players[me].board.leader,
                state.players[me].board.combat[0],
                state.players[me].board.combat[1],
                state.players[me].board.support[0],
                state.players[me].board.support[1],
                state.players[me].board.support[2],
              ] as Array<import("@cg/contracts").CardInstance | null>).map((inst, i) => {
                if (!inst) return null;
                const def = state.cardDb[inst.defId];
                if (!def) return null;
                const domain = DOMAIN_EFFECTS[inst.defId] ?? DEFAULT_DOMAIN;
                const isHov = unleashHover === inst.defId;
                const isPicked = unleashPicked === inst.defId;
                return (
                  <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                    onMouseEnter={() => setUnleashHover(inst.defId)}
                    onMouseLeave={() => setUnleashHover(null)}
                    onClick={() => setUnleashPicked(inst.defId)}
                  >
                    <div style={{
                      cursor: "pointer", borderRadius: 10,
                      border: isPicked ? "2px solid #ffd700" : isHov ? "2px solid #884488" : "2px solid transparent",
                      boxShadow: isPicked ? "0 0 18px #ffd70055" : isHov ? "0 0 10px #88448844" : "none",
                      transition: "all 0.15s", position: "relative",
                    }}>
                      <CharacterCard defId={inst.defId} def={def} size="md" />
                      {isPicked && (
                        <div style={{
                          position: "absolute", top: -8, right: -8,
                          background: "#ffd700", borderRadius: "50%", width: 20, height: 20,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: "bold", color: "#000",
                        }}>✓</div>
                      )}
                    </div>
                    {isHov && (
                      <div style={{
                        position: "absolute", bottom: "105%", left: "50%", transform: "translateX(-50%)",
                        background: "rgba(6,6,18,0.97)", border: "1px solid #3a1a4a",
                        borderRadius: 8, padding: "8px 12px", minWidth: 140, zIndex: 20,
                        textAlign: "center", pointerEvents: "none",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: "bold", color: "#e0e0e0", marginBottom: 5 }}>{domain.name}</div>
                        <div style={{ fontSize: 11, color: "#44ee44" }}>+{domain.ownPct}% own</div>
                        {domain.enemyPct < 0 && <div style={{ fontSize: 11, color: "#ee4444" }}>{domain.enemyPct}% enemy</div>}
                      </div>
                    )}
                    <div style={{ fontSize: 8, color: isPicked ? "#ffd700" : "#444", letterSpacing: 1, textAlign: "center", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {domain.name}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirm */}
            {unleashPicked && !unleashConfirmed && (
              <div style={{ marginTop: 10, textAlign: "right" }}>
                <button
                  onClick={() => setUnleashConfirmed(true)}
                  style={{
                    padding: "8px 24px",
                    background: "rgba(13,26,0,0.9)", border: "1px solid #66ff44",
                    borderRadius: 8, color: "#66ff44",
                    fontWeight: "bold", cursor: "pointer", fontSize: 12, letterSpacing: 2,
                    boxShadow: "0 0 16px #66ff4433",
                  }}
                >
                  CONFIRM UNLEASH
                </button>
              </div>
            )}
            {unleashConfirmed && (
              <div style={{ marginTop: 10, textAlign: "right", fontSize: 11, color: "#44cc44", letterSpacing: 2 }}>
                ✓ UNLEASH LOCKED IN — awaiting activation phase
              </div>
            )}
          </div>
        )}

        {/* Waiting indicator */}
        {mySpins === 0 && !pending && !spinning && aug.spinsRemaining[me === "P1" ? "P2" : "P1"] > 0 && !showUnleashPicker && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#333", padding: "8px 0", letterSpacing: 2 }}>
            WAITING FOR {playerNames[me === "P1" ? "P2" : "P1"].toUpperCase()}...
          </div>
        )}
      </div>

      <style>{`
        @keyframes augPulse { from { opacity: 0.8; } to { opacity: 1; } }
        @keyframes augFadeIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes synPulse {
          0%,100% { box-shadow: 0 0 8px #9933ff44; }
          50%      { box-shadow: 0 0 18px #9933ff99; }
        }
      `}</style>
    </div>
  );
}
