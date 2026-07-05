import { useState } from "react";
import { motion } from "framer-motion";
import type { PlayerId } from "@cg/contracts";
import { P1_ICON_OPTIONS, P2_ICON_OPTIONS } from "../constants";
import type { PlayerIcons, PlayerNames } from "../types";
import { BG } from "../backgrounds";
import PlayerIcon from "../components/PlayerIcon";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";

function PlayerPanel({ pid, name, icon, onNameChange, onIconChange, color, iconOptions }: {
  iconOptions: string[];
  pid: PlayerId; name: string; icon: string;
  onNameChange: (v: string) => void; onIconChange: (v: string) => void;
  color: string;
}) {
  const [inputFocused, setInputFocused] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut", delay: pid === "P1" ? 0.1 : 0.22 }}
      style={{
        flex: 1, background: "rgba(8,8,18,0.86)", borderRadius: 20, padding: "32px 28px",
        border: `1px solid ${color}33`,
        backdropFilter: "blur(10px)",
        boxShadow: `0 0 60px ${color}0e, 0 8px 32px rgba(0,0,0,0.6)`,
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Subtle corner accent */}
      <div style={{
        position: "absolute", top: 0, [pid === "P1" ? "left" : "right"]: 0,
        width: 80, height: 80,
        background: `radial-gradient(circle at ${pid === "P1" ? "0% 0%" : "100% 0%"}, ${color}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ fontSize: 12, letterSpacing: 6, color: color + "99", marginBottom: 24, textAlign: "center", fontWeight: "bold" }}>
        {pid === "P1" ? "PLAYER 1" : "PLAYER 2"}
      </div>

      {/* Selected icon display */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <motion.div
          animate={{ boxShadow: [`0 0 28px ${color}44, 0 0 56px ${color}22`, `0 0 44px ${color}66, 0 0 80px ${color}33`, `0 0 28px ${color}44, 0 0 56px ${color}22`] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ borderRadius: 14, border: `3px solid ${color}88`, overflow: "hidden" }}
        >
          <PlayerIcon icon={icon} size={120} style={{ display: "block" }} />
        </motion.div>
      </div>

      {/* Name input */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: "#445", letterSpacing: 3, marginBottom: 8 }}>NAME</div>
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          maxLength={16}
          style={{
            width: "100%", background: "#08081a",
            border: `1px solid ${inputFocused ? color + "cc" : color + "33"}`,
            borderRadius: 10, color: "#eee", fontSize: 20, fontWeight: "bold",
            padding: "13px 18px", outline: "none", fontFamily: "inherit",
            boxSizing: "border-box",
            boxShadow: inputFocused ? `0 0 20px ${color}44, inset 0 0 12px ${color}0a` : "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        />
      </div>

      {/* Icon grid */}
      <div style={{ fontSize: 10, color: "#445", letterSpacing: 3, marginBottom: 12 }}>CHOOSE ICON</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {iconOptions.map(ic => (
          <motion.div
            key={ic}
            whileHover={{ scale: 1.06, borderColor: color + "88" }}
            whileTap={{ scale: 0.94 }}
            onMouseDown={e => { e.preventDefault(); onIconChange(ic); }}
            style={{
              padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 12, cursor: "pointer", userSelect: "none",
              background: icon === ic ? `${color}22` : "#0a0a1a",
              border: `2px solid ${icon === ic ? color + "aa" : "#1a1a30"}`,
              boxShadow: icon === ic ? `0 0 18px ${color}44` : "none",
              transition: "background 0.12s, box-shadow 0.12s",
            }}
          >
            <PlayerIcon icon={ic} size={44} style={{ display: "block" }} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function SetupScreen({ onStart, onHome, initialNames, initialIcons }: {
  onStart: (names: PlayerNames, icons: PlayerIcons) => void;
  onHome: () => void;
  initialNames?: PlayerNames;
  initialIcons?: PlayerIcons;
}) {
  const [p1Name, setP1Name] = useState(initialNames?.P1 ?? "Player 1");
  const [p2Name, setP2Name] = useState(initialNames?.P2 ?? "Player 2");
  const [p1Icon, setP1Icon] = useState(initialIcons?.P1 ?? "player-1");
  const [p2Icon, setP2Icon] = useState(initialIcons?.P2 ?? "player-7");

  const canStart = p1Name.trim().length > 0 && p2Name.trim().length > 0;
  const p1Color = "#4a9eff";
  const p2Color = "#ff6666";

  return (
    <div style={{
      minHeight: "100vh", background: "#04040b",
      backgroundImage: BG.setup, backgroundSize: "cover", backgroundPosition: "center", animation: "bgPan 60s ease-in-out infinite",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 48px",
      position: "relative", overflow: "hidden",
    }}>
      <AmbientCanvas theme="energy" />
      <AmbientOverlay theme="blue" />
      {/* Dark overlay */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,12,0.52)", pointerEvents: "none" }} />

      {/* Vignette */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at center, transparent 35%, rgba(2,2,8,0.72) 100%)",
      }} />

      {/* Home button — top left */}
      <button
        onClick={onHome}
        style={{
          position: "fixed", top: 18, left: 18, zIndex: 10,
          padding: "8px 18px", background: "rgba(255,255,255,0.04)",
          border: "1px solid #2a2a3a", borderRadius: 8,
          color: "#666", cursor: "pointer", fontSize: 11,
          letterSpacing: 2, fontFamily: "inherit",
        }}
      >
        ← BACK
      </button>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{ textAlign: "center", marginBottom: 48 }}
        >
          <div style={{ fontSize: 11, letterSpacing: 7, color: "#445566", marginBottom: 8 }}>JJK CARD BATTLE</div>
          <div style={{ fontSize: 36, fontWeight: "bold", letterSpacing: 5, color: "#fff",
            textShadow: "0 2px 24px rgba(0,0,0,0.9), 0 0 40px rgba(80,120,255,0.15)" }}>
            PLAYER SETUP
          </div>
          {/* Accent line */}
          <motion.div
            animate={{ scaleX: [0.6, 1, 0.6], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              height: 1, width: 200, margin: "14px auto 0",
              background: "linear-gradient(90deg, transparent, #4a9eff66, rgba(255,255,255,0.4), #ff666666, transparent)",
            }}
          />
        </motion.div>

        {/* Player panels */}
        <div style={{ display: "flex", gap: 32, width: "100%", marginBottom: 48, alignItems: "stretch" }}>
          <PlayerPanel pid="P1" name={p1Name} icon={p1Icon} color={p1Color}
            onNameChange={setP1Name} onIconChange={setP1Icon} iconOptions={P1_ICON_OPTIONS} />

          {/* VS separator */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 8 }}>
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4], scaleY: [0.95, 1.05, 0.95] }}
              transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
              style={{
                fontSize: 28, fontWeight: "bold", color: "#334",
                textShadow: "0 0 20px rgba(100,100,200,0.3)",
                letterSpacing: 2,
              }}
            >
              VS
            </motion.div>
            <motion.div
              animate={{ scaleY: [1, 1.06, 1], opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 1, height: 60, background: "linear-gradient(180deg, #4a9eff44, #ff666644)" }}
            />
          </div>

          <PlayerPanel pid="P2" name={p2Name} icon={p2Icon} color={p2Color}
            onNameChange={setP2Name} onIconChange={setP2Icon} iconOptions={P2_ICON_OPTIONS} />
        </div>

        {/* Start button */}
        <motion.button
          onClick={() => canStart && onStart({ P1: p1Name.trim(), P2: p2Name.trim() }, { P1: p1Icon, P2: p2Icon })}
          disabled={!canStart}
          whileHover={canStart ? { scale: 1.04, y: -3 } : undefined}
          whileTap={canStart ? { scale: 0.97 } : undefined}
          animate={canStart
            ? { boxShadow: ["0 0 32px #9933ff22, 0 0 60px #cc44ff0a", "0 0 52px #9933ff55, 0 0 100px #cc44ff22", "0 0 32px #9933ff22, 0 0 60px #cc44ff0a"] }
            : { boxShadow: "none" }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            padding: "18px 80px",
            background: canStart
              ? "linear-gradient(135deg, #1a0828, #12061a)"
              : "#080808",
            border: `2px solid ${canStart ? "#9933ffcc" : "#1a1a1a"}`,
            borderRadius: 14,
            color: canStart ? "#cc88ff" : "#333",
            fontWeight: "bold", cursor: canStart ? "pointer" : "not-allowed",
            fontSize: 20, letterSpacing: 5, fontFamily: "inherit",
            transition: "border-color 0.2s, background 0.2s, color 0.2s",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Scan sweep on the button */}
          {canStart && (
            <motion.div
              animate={{ left: ["-50%", "150%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: 0.8 }}
              style={{
                position: "absolute", top: 0, bottom: 0, width: "40%",
                background: "linear-gradient(90deg, transparent, rgba(180,100,255,0.12), rgba(255,255,255,0.08), rgba(180,100,255,0.12), transparent)",
                transform: "skewX(-14deg)", pointerEvents: "none",
              }}
            />
          )}
          START BATTLE
        </motion.button>
      </div>
    </div>
  );
}
