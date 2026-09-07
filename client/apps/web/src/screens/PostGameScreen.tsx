import { motion } from "framer-motion";
import type { PlayerId, CardDef } from "@cg/contracts";
import type { Profile } from "../profiles";
import type { PlayerDraftResult } from "./DraftBattleScreen";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import { BATTLE_SYNERGY_RULES } from "@cg/battle";

interface Props {
  winner: PlayerId;
  p1Profile: Profile;
  p2Profile: Profile;
  p1Draft: PlayerDraftResult;
  p2Draft: PlayerDraftResult;
  cardDb: Record<string, CardDef>;
  turnCount: number;
  onPlayAgain: () => void;
  onMenu: () => void;
}

function computeSynergies(ids: string[], cardDb: Record<string, CardDef>): string[] {
  const active: string[] = [];
  for (const rule of BATTLE_SYNERGY_RULES) {
    const count = ids.filter(id => {
      const def = cardDb[id];
      return def && rule.tags.every(tag => (def.tags ?? []).includes(tag));
    }).length;
    if (count >= rule.minCount) active.push(rule.id);
  }
  return active;
}


function SynergyPanel({ synergies, color, side }: { synergies: string[]; color: string; side: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -24 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      style={{
        width: 148, flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 10px",
        borderRadius: 12,
        background: "rgba(4,4,12,0.88)",
        border: `1px solid ${color}22`,
        alignSelf: "flex-start",
      }}
    >
      <div style={{ fontSize: 7, letterSpacing: 3, color: `${color}88`, fontWeight: 700, textAlign: "center", marginBottom: 2 }}>
        SYNERGIES ACTIVATED
      </div>
      {synergies.length === 0 ? (
        <div style={{ fontSize: 8, color: "#2a2a3a", textAlign: "center", padding: "8px 0", letterSpacing: 1 }}>
          NONE
        </div>
      ) : (
        synergies.map((id, i) => {
          const rule = BATTLE_SYNERGY_RULES.find(r => r.id === id);
          if (!rule) return null;
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, x: side === "left" ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.07 }}
              style={{
                padding: "6px 8px", borderRadius: 8,
                background: `${color}0e`,
                border: `1px solid ${color}33`,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: 0.5, marginBottom: 2 }}>
                ✦ {rule.label}
              </div>
              <div style={{ fontSize: 7, color: "#556", letterSpacing: 0.3, lineHeight: 1.4 }}>
                {rule.spellName}
              </div>
            </motion.div>
          );
        })
      )}
    </motion.div>
  );
}

function PlayerPanel({
  profile, draft, cardDb, isWinner, color, side,
}: {
  profile: Profile; draft: PlayerDraftResult; cardDb: Record<string, CardDef>;
  isWinner: boolean; color: string; side: "left" | "right";
}) {
  const leaderDef = cardDb[draft.leaderId];
  const wins   = (profile.quickStats?.wins ?? 0) + (profile.draftStats?.wins ?? 0);
  const losses = (profile.quickStats?.losses ?? 0) + (profile.draftStats?.losses ?? 0);
  const wlPct  = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) + "%" : "-";

  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -50 : 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      style={{
        flex: 1, maxWidth: 280,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        padding: "12px 12px 10px", borderRadius: 14,
        background: isWinner
          ? `radial-gradient(ellipse at 50% 0%, ${color}25, rgba(4,4,12,0.97))`
          : "rgba(4,4,12,0.9)",
        border: `2px solid ${isWinner ? color + "88" : "#181828"}`,
        boxShadow: isWinner ? `0 0 90px ${color}33, 0 0 30px ${color}22, 0 8px 40px rgba(0,0,0,0.6)` : "0 4px 24px rgba(0,0,0,0.5)",
        position: "relative", overflow: "visible",
      }}
    >
      {/* Animated winner shimmer */}
      {isWinner && (
        <motion.div
          animate={{ opacity: [0.2, 0.55, 0.2] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${color}1a, transparent 65%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Result badge */}
      {isWinner ? (
        <motion.div
          animate={{ boxShadow: [`0 0 10px ${color}66`, `0 0 24px ${color}cc`, `0 0 10px ${color}66`] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{
            padding: "4px 16px", borderRadius: 14,
            background: color,
            fontSize: 8, fontWeight: 900, letterSpacing: 4, color: "#000",
          }}
        >🏆 WINNER</motion.div>
      ) : (
        <div style={{
          padding: "3px 12px", borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid #1a1a2a",
          fontSize: 7, fontWeight: 700, letterSpacing: 3, color: "#2a2a3a",
        }}>DEFEATED</div>
      )}

      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <motion.div
          animate={isWinner ? { boxShadow: [`0 0 14px ${color}55`, `0 0 28px ${color}88`, `0 0 14px ${color}55`] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ borderRadius: 10, border: `2px solid ${color}`, overflow: "hidden" }}
        >
          <PlayerIcon icon={profile.icon} size={60} style={{ display: "block" }} />
        </motion.div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>{profile.name}</div>
          <div style={{ fontSize: 7, color, letterSpacing: 3, marginTop: 2 }}>
            PLAYER {color === "#4a9eff" ? "1" : "2"}
          </div>
        </div>
      </div>

      {/* Leader card */}
      {leaderDef && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 6, color: "#334", letterSpacing: 3 }}>LEADER</div>
          <CharacterCard defId={draft.leaderId} def={leaderDef} size="lg" noHover hideAffinityAndCost />
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: "flex", gap: 0, width: "100%",
        borderTop: "1px solid #1a1a2a", paddingTop: 8, marginTop: 2,
      }}>
        {[
          { label: "DRAFT WINS",   value: String(profile.draftStats?.wins ?? 0),   c: "#44ff88" },
          { label: "DRAFT LOSSES", value: String(profile.draftStats?.losses ?? 0),  c: "#ff4466" },
          { label: "WIN RATE",     value: wlPct,                                     c: color },
        ].map(({ label, value, c }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: c }}>{value}</div>
            <div style={{ fontSize: 5, color: "#334", letterSpacing: 2, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function PostGameScreen({
  winner, p1Profile, p2Profile, p1Draft, p2Draft, cardDb, turnCount, onPlayAgain, onMenu,
}: Props) {
  const winnerProfile = winner === "P1" ? p1Profile : p2Profile;
  const winnerColor   = winner === "P1" ? "#4a9eff" : "#ff6666";

  const p1DeckIds = [...p1Draft.combatIds, ...p1Draft.supportIds, ...p1Draft.extraIds];
  const p2DeckIds = [...p2Draft.combatIds, ...p2Draft.supportIds, ...p2Draft.extraIds];
  const p1Synergies = computeSynergies([p1Draft.leaderId, ...p1DeckIds], cardDb);
  const p2Synergies = computeSynergies([p2Draft.leaderId, ...p2DeckIds], cardDb);

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.90)", zIndex: 0 }} />
      <AmbientCanvas intensity={0.3} />
      <AmbientOverlay />

      <div style={{
        position: "relative", zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "20px 16px 16px", gap: 14, width: "100%", maxWidth: 960,
        overflowY: "auto",
      }}>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center" }}
        >
          <div style={{ fontSize: 8, letterSpacing: 5, color: "#334", marginBottom: 4 }}>BATTLE OVER</div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 3, color: "#778", marginBottom: 3 }}>Winner</div>
          <motion.div
            animate={{ textShadow: [`0 0 20px ${winnerColor}88`, `0 0 42px ${winnerColor}cc`, `0 0 20px ${winnerColor}88`] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ fontSize: 27, fontWeight: 900, letterSpacing: 3, color: winnerColor, marginBottom: 3 }}
          >
            {winnerProfile.name}
          </motion.div>
          <div style={{ fontSize: 7, color: "#334", letterSpacing: 3 }}>
            {turnCount} TURNS · DRAFT BATTLE
          </div>
        </motion.div>

        {/* Main row: synergy | P1 | VS | P2 | synergy */}
        <div style={{ display: "flex", gap: 10, width: "100%", alignItems: "flex-start" }}>
          <SynergyPanel synergies={p1Synergies} color="#4a9eff" side="left" />

          <PlayerPanel
            profile={p1Profile} draft={p1Draft} cardDb={cardDb}
            isWinner={winner === "P1"} color="#4a9eff" side="left"
          />

          {/* Center divider */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 7, paddingTop: 56, flexShrink: 0,
          }}>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontSize: 18, fontWeight: 900, color: "#ff3333" }}
            >VS</motion.div>
            <div style={{ width: 2, height: 60, background: "linear-gradient(to bottom, transparent, #ff333444, transparent)" }} />
          </div>

          <PlayerPanel
            profile={p2Profile} draft={p2Draft} cardDb={cardDb}
            isWinner={winner === "P2"} color="#ff6666" side="right"
          />

          <SynergyPanel synergies={p2Synergies} color="#ff6666" side="right" />
        </div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ display: "flex", gap: 14 }}
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onPlayAgain}
            style={{
              padding: "8px 26px",
              background: `linear-gradient(135deg, ${winnerColor}88, ${winnerColor})`,
              border: "none", borderRadius: 8,
              color: "#000", fontSize: 9, fontWeight: 900, letterSpacing: 4,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: `0 0 20px ${winnerColor}44`,
            }}
          >PLAY AGAIN</motion.button>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onMenu}
            style={{
              padding: "8px 26px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid #252535", borderRadius: 8,
              color: "#556", fontSize: 9, fontWeight: 700, letterSpacing: 4,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >MAIN MENU</motion.button>
        </motion.div>
      </div>
    </div>
  );
}
