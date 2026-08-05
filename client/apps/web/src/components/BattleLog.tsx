import { motion, AnimatePresence } from "framer-motion";
import type { PlayerId } from "@cg/contracts";
import { COLOR } from "../theme";

/**
 * Rolling feed of what just happened, in the spirit of TFT's combat readout.
 *
 * Entries are pushed by the battle screen as engine events arrive and expire on
 * their own, so the log stays short and never needs scrolling. It is purely a
 * readout — nothing here feeds back into the engine.
 */

export interface LogEntry {
  id: number;
  pid: PlayerId | null;
  icon: string;
  text: string;
  tone: "attack" | "death" | "spell" | "domain" | "turn" | "perk";
}

const TONE_COLOR: Record<LogEntry["tone"], string> = {
  attack: "#ff8866",
  death: "#ff4455",
  spell: COLOR.cursed,
  domain: "#ffcc44",
  turn: "#8899aa",
  perk: "#ffcc44",
};

export default function BattleLog({ entries }: { entries: LogEntry[] }) {
  return (
    <div style={{
      position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
      width: 210, zIndex: 25, pointerEvents: "none",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <AnimatePresence initial={false}>
        {entries.map(e => {
          const color = TONE_COLOR[e.tone];
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -18, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: -12, height: 0, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 8px", borderRadius: 6,
                background: "rgba(4,4,12,0.72)",
                borderLeft: `2px solid ${color}`,
                backdropFilter: "blur(3px)",
                overflow: "hidden",
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>{e.icon}</span>
              <span style={{
                fontSize: 9, lineHeight: 1.35, color: "#cdd",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {e.text}
              </span>
              {e.pid && (
                <span style={{
                  marginLeft: "auto", flexShrink: 0,
                  width: 5, height: 5, borderRadius: "50%",
                  background: e.pid === "P1" ? COLOR.p1 : COLOR.p2,
                }} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
