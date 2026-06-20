import { useState } from "react";
import { BG } from "../backgrounds";

export default function HomeScreen({ onSelect }: { onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      backgroundImage: BG.home,
      backgroundSize: "cover", backgroundPosition: "center",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden", position: "relative",
    }}>
      {/* Subtle dark overlay so text stays readable */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,0.35)", pointerEvents: "none" }} />

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 52, animation: "titleDrop 0.9s cubic-bezier(0.175,0.885,0.32,1.275) both", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 96, fontWeight: 900, letterSpacing: 14, lineHeight: 0.95,
          color: "#fff",
          textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          userSelect: "none",
        }}></div>
        <div style={{
          fontSize: 14, fontWeight: "bold", letterSpacing: 14, color: "#aaaacc",
          marginTop: 10, textTransform: "uppercase",
        }}>
          CARD BATTLE
        </div>
        <div style={{ height: 2, width: 120, margin: "14px auto 0", background: "linear-gradient(90deg, transparent, #ffffff44, transparent)", borderRadius: 1 }} />
      </div>

      {/* Mode select — two rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", animation: "fadeUp 0.6s 0.35s ease-out both", position: "relative", zIndex: 1 }}>

        {/* Row 1: JJK — active mode */}
        <div
          onClick={onSelect}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 260, padding: "24px 28px", borderRadius: 16, cursor: "pointer",
            background: hovered
              ? "rgba(30,30,50,0.82)"
              : "rgba(12,12,22,0.78)",
            border: `2px solid ${hovered ? "rgba(200,200,255,0.5)" : "rgba(80,80,120,0.4)"}`,
            backdropFilter: "blur(8px)",
            textAlign: "center", userSelect: "none",
            boxShadow: hovered
              ? "0 0 32px rgba(0,0,0,0.7), 0 8px 32px rgba(0,0,0,0.5)"
              : "0 4px 20px rgba(0,0,0,0.5)",
            transition: "all 0.2s",
            transform: hovered ? "translateY(-4px) scale(1.03)" : "none",
            position: "relative", overflow: "hidden",
            display: "flex", alignItems: "center", gap: 20,
          }}
        >
          {hovered && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #ffffff08 0%, transparent 60%)", pointerEvents: "none" }} />}
          <div style={{ fontSize: 40, filter: hovered ? "drop-shadow(0 0 8px rgba(255,255,255,0.4))" : "none", transition: "filter 0.2s", flexShrink: 0 }}>呪</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 20, fontWeight: "bold", color: hovered ? "#ffffff" : "#ccccdd", letterSpacing: 3 }}>JJK</div>
            <div style={{ fontSize: 10, color: hovered ? "#aaaacc" : "#666688", letterSpacing: 1, marginBottom: 8 }}>Jujutsu Kaisen</div>
            <div style={{ padding: "4px 14px", background: hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${hovered ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, display: "inline-block" }}>
              <span style={{ fontSize: 9, color: hovered ? "#ffffff" : "#888899", letterSpacing: 2 }}>PLAY</span>
            </div>
          </div>
        </div>

        {/* Row 2: locked mystery modes side by side */}
        <div style={{ display: "flex", gap: 14 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              width: 120, padding: "18px 16px", borderRadius: 12,
              background: "linear-gradient(160deg, #0d0a12aa 0%, #080608aa 100%)",
              backdropFilter: "blur(6px)",
              border: "1px solid #1e1428",
              textAlign: "center",
              boxShadow: "inset 0 0 20px #00000066",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8, color: "#2a1a3a", textShadow: "0 0 12px #441166", filter: "blur(0.5px)" }}>?</div>
              <div style={{ fontSize: 10, color: "#1a1020", letterSpacing: 1, marginBottom: 8 }}>SEALED</div>
              <div style={{ padding: "3px 10px", background: "#0a0810", border: "1px solid #181020", borderRadius: 20, display: "inline-block" }}>
                <span style={{ fontSize: 8, color: "#1e1228", letterSpacing: 2 }}>LOCKED</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 44, fontSize: 10, color: "#555566", letterSpacing: 4, animation: "fadeUp 0.6s 0.55s ease-out both", position: "relative", zIndex: 1 }}>
        SELECT A GAME MODE TO BEGIN
      </div>

      <style>{`
        @keyframes titleDrop { from { transform: translateY(-24px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
