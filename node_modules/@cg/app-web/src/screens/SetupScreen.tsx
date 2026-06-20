import { useState } from "react";
import type { PlayerId } from "@cg/contracts";
import { PLAYER_ICON_OPTIONS } from "../constants";
import type { PlayerIcons, PlayerNames } from "../types";
import { BG } from "../backgrounds";
import PlayerIcon from "../components/PlayerIcon";


// Top-level — NOT inside SetupScreen — so React never remounts it on re-render
function PlayerPanel({ pid, name, icon, onNameChange, onIconChange, color }: {
  pid: PlayerId; name: string; icon: string;
  onNameChange: (v: string) => void; onIconChange: (v: string) => void;
  color: string;
}) {
  const [inputFocused, setInputFocused] = useState(false);
  return (
    <div style={{
      flex: 1, background: "#080810", borderRadius: 16, padding: 28,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 4, color: color + "88", marginBottom: 20, textAlign: "center" }}>
        {pid === "P1" ? "PLAYER 1" : "PLAYER 2"}
      </div>

      {/* Selected icon display */}
      <div style={{ textAlign: "center", marginBottom: 20, display: "flex", justifyContent: "center" }}>
        <PlayerIcon icon={icon} size={64} />
      </div>

      {/* Name input */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 6 }}>NAME</div>
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          maxLength={16}
          style={{
            width: "100%", background: "#0c0c1a",
            border: `1px solid ${inputFocused ? color + "99" : color + "33"}`,
            borderRadius: 8, color: "#ddd", fontSize: 16, fontWeight: "bold",
            padding: "10px 14px", outline: "none", fontFamily: "inherit",
            boxSizing: "border-box",
            boxShadow: inputFocused ? `0 0 10px ${color}33` : "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        />
      </div>

      {/* Icon selection */}
      <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 10 }}>CHOOSE ICON</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {PLAYER_ICON_OPTIONS.map(ic => {
          return (
          <div
            key={ic}
            onMouseDown={e => { e.preventDefault(); onIconChange(ic); }}
            onMouseEnter={e => { if (icon !== ic) { (e.currentTarget as HTMLElement).style.background = `${color}10`; (e.currentTarget as HTMLElement).style.borderColor = `${color}55`; }}}
            onMouseLeave={e => { if (icon !== ic) { (e.currentTarget as HTMLElement).style.background = "#0a0a14"; (e.currentTarget as HTMLElement).style.borderColor = "#1a1a28"; }}}
            style={{
              padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 10, cursor: "pointer", userSelect: "none",
              background: icon === ic ? `${color}18` : "#0a0a14",
              border: `1px solid ${icon === ic ? color + "88" : "#1a1a28"}`,
              boxShadow: icon === ic ? `0 0 12px ${color}33` : "none",
              transition: "all 0.12s",
            }}
          >
            <PlayerIcon icon={ic} size={28} />
          </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SetupScreen({ onStart }: { onStart: (names: PlayerNames, icons: PlayerIcons) => void }) {
  const [p1Name, setP1Name] = useState("Player 1");
  const [p2Name, setP2Name] = useState("Player 2");
  const [p1Icon, setP1Icon] = useState("player-1");
  const [p2Icon, setP2Icon] = useState("player-2");

  const canStart = p1Name.trim().length > 0 && p2Name.trim().length > 0;
  const p1Color = "#4a9eff";
  const p2Color = "#ff6666";

  return (
    <div style={{
      minHeight: "100vh", background: "#04040b",
      backgroundImage: BG.setup, backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 32,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 6, color: "#330044", marginBottom: 6 }}>JJK CARD BATTLE</div>
      <div style={{ fontSize: 28, fontWeight: "bold", letterSpacing: 4, color: "#fff", marginBottom: 40 }}>PLAYER SETUP</div>

      <div style={{ display: "flex", gap: 24, width: "100%", maxWidth: 680, marginBottom: 40 }}>
        <PlayerPanel pid="P1" name={p1Name} icon={p1Icon} color={p1Color}
          onNameChange={setP1Name} onIconChange={setP1Icon} />
        <div style={{ display: "flex", alignItems: "center", color: "#222", fontSize: 20, fontWeight: "bold" }}>VS</div>
        <PlayerPanel pid="P2" name={p2Name} icon={p2Icon} color={p2Color}
          onNameChange={setP2Name} onIconChange={setP2Icon} />
      </div>

      <button
        onClick={() => canStart && onStart({ P1: p1Name.trim(), P2: p2Name.trim() }, { P1: p1Icon, P2: p2Icon })}
        disabled={!canStart}
        style={{
          padding: "14px 48px",
          background: canStart ? "linear-gradient(135deg, #1a0030, #0a001a)" : "#080808",
          border: `2px solid ${canStart ? "#8833cc" : "#1a1a1a"}`,
          borderRadius: 12, color: canStart ? "#cc88ff" : "#333",
          fontWeight: "bold", cursor: canStart ? "pointer" : "not-allowed",
          fontSize: 16, letterSpacing: 4,
          boxShadow: canStart ? "0 0 24px #8833cc33" : "none",
          transition: "all 0.2s",
        }}
      >
        START BATTLE
      </button>
    </div>
  );
}
