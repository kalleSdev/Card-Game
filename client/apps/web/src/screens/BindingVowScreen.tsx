import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BindingVowId, GameState, Intent, PlayerId } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import { BG } from "../backgrounds";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";
import type { PlayerIcons, PlayerNames } from "../types";
import PlayerIcon from "../components/PlayerIcon";

function PlayerStatusPanel({ pid, playerNames, playerIcons, vowChosen, isActive, isReady }: {
  pid: PlayerId; playerNames: PlayerNames; playerIcons: PlayerIcons;
  vowChosen: BindingVowId | null | undefined; isActive: boolean; isReady: boolean;
}) {
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  const vow = vowChosen ? VOW_DEFS[vowChosen] : null;

  return (
    <motion.div
      animate={isActive
        ? { boxShadow: [`0 0 32px ${pColor}22`, `0 0 52px ${pColor}44`, `0 0 32px ${pColor}22`] }
        : { boxShadow: "none" }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: 310, flexShrink: 0,
        padding: "26px 22px",
        background: isActive ? `rgba(8,8,18,0.95)` : "rgba(5,5,12,0.85)",
        border: `1px solid ${isActive ? pColor + "55" : "#1a1a28"}`,
        borderRadius: 16,
        backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", gap: 16,
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        flexDirection: pid === "P1" ? "row" : "row-reverse",
      }}>
        <motion.div
          animate={isActive
            ? { boxShadow: [`0 0 16px ${pColor}44`, `0 0 28px ${pColor}77`, `0 0 16px ${pColor}44`] }
            : { boxShadow: "none" }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${isActive ? pColor + "88" : "#2a2a38"}`, flexShrink: 0 }}
        >
          <PlayerIcon icon={playerIcons[pid]} size={72} style={{ display: "block" }} />
        </motion.div>
        <div style={{ flex: 1, textAlign: pid === "P1" ? "left" : "right" }}>
          <div style={{ fontSize: 18, fontWeight: "bold", color: isActive ? pColor : "#555" }}>
            {playerNames[pid]}
          </div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#444", marginTop: 3 }}>
            {pid === "P1" ? "PLAYER 1" : "PLAYER 2"}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              fontSize: 10, color: pColor, letterSpacing: 3, fontWeight: "bold",
              background: `${pColor}11`, border: `1px solid ${pColor}33`,
              borderRadius: 8, padding: "6px 10px", textAlign: "center",
            }}
          >
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
            >
              ✦ CHOOSING NOW
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={isReady && vow
          ? { borderColor: "#cc880066", boxShadow: "0 0 20px #aa550022" }
          : { borderColor: "#1a1a28", boxShadow: "none" }}
        transition={{ duration: 0.5 }}
        style={{
          flex: 1, padding: "16px 14px",
          background: isReady ? "#0a0a08" : "#08080f",
          border: `1px solid ${isReady ? "#443300" : "#1a1a28"}`,
          borderRadius: 12, minHeight: 110,
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          gap: 8, textAlign: "center",
        }}
      >
        {isReady ? (
          vow ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            >
              <div style={{ fontSize: 28 }}>{vow.icon}</div>
              <div style={{ fontSize: 14, color: "#cc9900", fontWeight: "bold" }}>{vow.name}</div>
              <div style={{ fontSize: 11, color: "#665544", lineHeight: 1.5 }}>{vow.description}</div>
              <div style={{ fontSize: 11, color: "#44aa44", marginTop: 6 }}>✓ {vow.reward}</div>
              <div style={{ fontSize: 11, color: "#aa4444" }}>✗ {vow.penalty}</div>
            </motion.div>
          ) : (
            <div style={{ fontSize: 13, color: "#443333", letterSpacing: 1 }}>— No vow —</div>
          )
        ) : (
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: 12, color: "#2a2a3a", letterSpacing: 2 }}
          >
            {isActive ? "deciding..." : "waiting..."}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
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

  const pColor = me === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div style={{
      minHeight: "100vh", background: "#07030a",
      backgroundImage: BG.vow, backgroundSize: "cover", backgroundPosition: "center", animation: "bgPan 55s ease-in-out infinite",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      <AmbientCanvas theme="wisps" />
      <AmbientOverlay theme="red" />
      <div style={{ position: "fixed", inset: 0, background: "rgba(7,3,10,0.68)", pointerEvents: "none" }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(2,0,5,0.72) 100%)",
      }} />

      {/* Blood-red ambient aura at top */}
      <motion.div
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 4.0, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "fixed", top: -100, left: "50%", transform: "translateX(-50%)",
          width: 600, height: 300,
          background: "radial-gradient(ellipse, #660033aa 0%, transparent 70%)",
          filter: "blur(40px)", pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, padding: "32px 28px" }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ textAlign: "center", marginBottom: 36 }}
        >
          <div style={{ fontSize: 11, letterSpacing: 7, color: "#440022", marginBottom: 8 }}>PHASE 0</div>
          <motion.div
            animate={{ textShadow: ["0 0 30px #330011", "0 0 60px #660033, 0 0 90px #33001a", "0 0 30px #330011"] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: 44, fontWeight: "bold", letterSpacing: 7, color: "#fff", marginBottom: 10 }}
          >
            BINDING VOW
          </motion.div>
          <div style={{ fontSize: 13, color: "#665544", letterSpacing: 1 }}>
            Each player swears an oath — kept or broken at resolution
          </div>
          <motion.div
            animate={{ scaleX: [0.5, 1, 0.5], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              height: 1, width: 300, margin: "14px auto 0",
              background: "linear-gradient(90deg, transparent, #880033aa, rgba(200,80,80,0.5), #880033aa, transparent)",
            }}
          />
        </motion.div>

        {/* 3-column layout */}
        <div style={{ display: "flex", gap: 20, flex: 1, alignItems: "flex-start" }}>
          <PlayerStatusPanel pid="P1" playerNames={playerNames} playerIcons={playerIcons}
            vowChosen={state.vowsChosen.P1} isActive={me === "P1"} isReady={state.vowsReady.P1} />

          {/* Center — vow selection */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              style={{ fontSize: 14, color: "#9966aa", textAlign: "center", letterSpacing: 1 }}
            >
              <span style={{ color: pColor, fontWeight: "bold", fontSize: 16 }}>{playerNames[me]}</span>
              {" — choose your oath"}
            </motion.div>

            {(() => {
              const mainVows = vowIds.filter(id => id !== "BLIND_FAITH");
              const renderVowCard = (vowId: BindingVowId, i: number) => {
                const vow = VOW_DEFS[vowId];
                const isSel = selected === vowId;
                return (
                  <motion.div
                    key={vowId}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.07, ease: "easeOut" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelected(isSel ? null : vowId)}
                    style={{
                      padding: "18px 16px", borderRadius: 14, cursor: "pointer", userSelect: "none",
                      background: isSel ? "rgba(30,10,0,0.95)" : "rgba(12,4,8,0.9)",
                      border: `1px solid ${isSel ? "#cc5500cc" : "#2a1520"}`,
                      backdropFilter: "blur(6px)",
                      boxShadow: isSel ? `0 0 28px #cc550044, 0 8px 24px rgba(0,0,0,0.6)` : "0 4px 16px rgba(0,0,0,0.5)",
                      transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {isSel && (
                      <motion.div
                        animate={{ opacity: [0.06, 0.14, 0.06] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                          position: "absolute", inset: 0, borderRadius: 14,
                          background: "radial-gradient(ellipse at 50% 0%, #ff6600 0%, transparent 65%)",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{vow.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: "bold", color: isSel ? "#ffaa44" : "#ccc", marginBottom: 8 }}>
                      {vow.name}
                    </div>
                    <div style={{ fontSize: 13, color: "#e0d8cc", marginBottom: 12, lineHeight: 1.65 }}>
                      {vow.description}
                    </div>
                    <div style={{ fontSize: 11, color: "#55cc55", marginBottom: 4 }}>✓ {vow.reward}</div>
                    <div style={{ fontSize: 11, color: "#cc5555" }}>✗ {vow.penalty}</div>
                  </motion.div>
                );
              };
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {mainVows.map((vowId, i) => renderVowCard(vowId, i))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                    <div style={{ width: "calc(50% - 7px)" }}>
                      {renderVowCard("BLIND_FAITH", mainVows.length)}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 8 }}>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelected(selected === "PASS" ? null : "PASS")}
                style={{
                  padding: "12px 28px",
                  background: selected === "PASS" ? "#111" : "#080808",
                  border: `1px solid ${selected === "PASS" ? "#555" : "#222"}`,
                  borderRadius: 10, color: selected === "PASS" ? "#888" : "#444",
                  cursor: "pointer", fontSize: 14, letterSpacing: 1, fontFamily: "inherit",
                }}
              >
                PASS — no vow
              </motion.button>

              <motion.button
                whileHover={selected !== null ? { scale: 1.05, y: -2 } : undefined}
                whileTap={selected !== null ? { scale: 0.96 } : undefined}
                animate={selected !== null
                  ? { boxShadow: ["0 0 24px #cc550033, 0 4px 20px rgba(0,0,0,0.6)", "0 0 44px #cc550055, 0 4px 20px rgba(0,0,0,0.6)", "0 0 24px #cc550033, 0 4px 20px rgba(0,0,0,0.6)"] }
                  : { boxShadow: "none" }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                onClick={confirm}
                disabled={selected === null}
                style={{
                  padding: "14px 52px",
                  background: selected !== null ? "linear-gradient(135deg, #220800, #160400)" : "#080808",
                  border: `2px solid ${selected !== null ? "#cc5500cc" : "#1a1a1a"}`,
                  borderRadius: 10, color: selected !== null ? "#ff8844" : "#333",
                  fontWeight: "bold", cursor: selected !== null ? "pointer" : "not-allowed",
                  fontSize: 16, letterSpacing: 4, fontFamily: "inherit",
                  transition: "border-color 0.2s, background 0.2s, color 0.2s",
                  position: "relative", overflow: "hidden",
                }}
              >
                {selected !== null && (
                  <motion.div
                    animate={{ left: ["-50%", "150%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    style={{
                      position: "absolute", top: 0, bottom: 0, width: "35%",
                      background: "linear-gradient(90deg, transparent, rgba(255,140,60,0.12), transparent)",
                      transform: "skewX(-14deg)", pointerEvents: "none",
                    }}
                  />
                )}
                COMMIT
              </motion.button>
            </div>
          </div>

          <PlayerStatusPanel pid="P2" playerNames={playerNames} playerIcons={playerIcons}
            vowChosen={state.vowsChosen.P2} isActive={me === "P2"} isReady={state.vowsReady.P2} />
        </div>
      </div>
    </div>
  );
}
