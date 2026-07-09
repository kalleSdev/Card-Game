import { useState } from "react";
import { motion } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import type { Profile, SubDeck } from "../profiles";
import { getAscensionRarity } from "../profiles";
import { deriveStats } from "../battleEngine";
import type { PlayerDraftResult } from "./DraftBattleScreen";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";

interface Props {
  p1Profile: Profile;
  p2Profile: Profile;
  cardDb: Record<string, CardDef>;
  onBack: () => void;
  onStart: (p1Result: PlayerDraftResult, p2Result: PlayerDraftResult) => void;
}

function subDeckToDraftResult(deck: SubDeck): PlayerDraftResult {
  return {
    leaderId: deck.leaderId,
    combatIds: [],
    supportIds: [],
    extraIds: deck.cardIds,
    weaponIds: [],
  };
}

// ── Deck picker for one player ────────────────────────────────────────────────
function PlayerDeckPicker({
  profile, cardDb, color, label,
  selected, onSelect,
}: {
  profile: Profile; cardDb: Record<string, CardDef>;
  color: string; label: string;
  selected: SubDeck | null;
  onSelect: (d: SubDeck) => void;
}) {
  const hasDecks = profile.subDecks.length > 0;
  const hasEnough = profile.collection.length >= 10;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", gap: 14,
      padding: "20px", borderRadius: 18,
      background: "rgba(4,4,14,0.9)",
      border: `1px solid ${color}33`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: `2px solid ${color}66` }}>
          <PlayerIcon icon={profile.icon} size={40} style={{ display: "block" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{profile.name}</div>
          <div style={{ fontSize: 8, color, letterSpacing: 3 }}>{label}</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 9, color: "#445" }}>
          {profile.collection.length} cards collected
        </div>
      </div>

      {!hasEnough && (
        <div style={{
          padding: "14px", borderRadius: 10,
          background: "rgba(255,60,60,0.08)", border: "1px solid #ff334422",
          fontSize: 9, color: "#ff6666", letterSpacing: 2, textAlign: "center",
        }}>
          NEED AT LEAST 10 CARDS IN COLLECTION<br />
          <span style={{ color: "#ff444488" }}>({profile.collection.length}/10 collected)</span>
        </div>
      )}

      {hasEnough && !hasDecks && (
        <div style={{
          padding: "14px", borderRadius: 10,
          background: "rgba(170,136,255,0.08)", border: "1px solid #aa88ff22",
          fontSize: 9, color: "#aa88ff", letterSpacing: 2, textAlign: "center",
        }}>
          NO SUBDECKS — CREATE ONE IN YOUR PROFILE DECK
        </div>
      )}

      {hasDecks && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 8, color: "#445", letterSpacing: 3, marginBottom: 2 }}>SELECT A DECK</div>
          {profile.subDecks.map(deck => {
            const leaderDef = cardDb[deck.leaderId];
            const cc = profile.collection.find(c => c.defId === deck.leaderId);
            const leaderRarity = cc ? getAscensionRarity(cc) : "S";
            const isSelected = selected?.id === deck.id;
            const validDeck = deck.cardIds.length === 10 && deck.leaderId;
            return (
              <motion.div key={deck.id}
                onClick={() => validDeck && onSelect(deck)}
                whileHover={validDeck ? { x: 4, scale: 1.02 } : {}}
                whileTap={validDeck ? { scale: 0.98 } : {}}
                style={{
                  padding: "12px 14px",
                  background: isSelected ? `rgba(${color === "#4a9eff" ? "20,50,100" : "100,30,30"},0.35)` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isSelected ? color + "77" : "#1a1a2e"}`,
                  borderRadius: 10, cursor: validDeck ? "pointer" : "default",
                  display: "flex", alignItems: "center", gap: 10, opacity: validDeck ? 1 : 0.45,
                  boxShadow: isSelected ? `0 0 16px ${color}22` : "none",
                }}
              >
                {leaderDef && (
                  <div style={{ transform: "scale(0.55)", transformOrigin: "left center", flexShrink: 0, width: 54 }}>
                    <CharacterCard defId={deck.leaderId} def={leaderDef} size="sm" rarityOverride={leaderRarity} costOverride={0} noHover />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? "#fff" : "#aaa" }}>{deck.name}</div>
                  <div style={{ fontSize: 8, color: "#445", letterSpacing: 1, marginTop: 2 }}>
                    {leaderDef?.name} · {deck.cardIds.length}/10 cards
                  </div>
                </div>
                {isSelected && (
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>✓</div>
                )}
                {!validDeck && (
                  <div style={{ fontSize: 8, color: "#ff6644", letterSpacing: 1 }}>INCOMPLETE</div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Preview of selected deck cards */}
      {selected && (
        <div style={{ borderTop: "1px solid #0e0e22", paddingTop: 12 }}>
          <div style={{ fontSize: 8, color: "#445", letterSpacing: 3, marginBottom: 8 }}>DECK PREVIEW</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {selected.cardIds.map(id => {
              const def = cardDb[id];
              const cc = profile.collection.find(c => c.defId === id);
              return def ? (
                <div key={id} style={{ transform: "scale(0.48)", transformOrigin: "left center" }}>
                  <CharacterCard defId={id} def={def} size="xs"
                    rarityOverride={cc ? getAscensionRarity(cc) : "S"}
                    costOverride={deriveStats(def).cost} noHover />
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NormalModeSetupScreen({ p1Profile, p2Profile, cardDb, onBack, onStart }: Props) {
  const [p1Deck, setP1Deck] = useState<SubDeck | null>(null);
  const [p2Deck, setP2Deck] = useState<SubDeck | null>(null);

  const canStart = p1Deck !== null && p2Deck !== null;

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.90)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <div style={{ position: "relative", zIndex: 3, width: "100%", maxWidth: 900, padding: "32px 24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{
            padding: "7px 16px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#556", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit",
          }}>← BACK</button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 10, color: "#334", letterSpacing: 5, marginBottom: 4 }}>NORMAL MODE</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>
              SELECT YOUR DECKS
            </div>
          </div>
        </div>

        {/* Two player pickers side by side */}
        <div style={{ display: "flex", gap: 18 }}>
          <PlayerDeckPicker
            profile={p1Profile} cardDb={cardDb}
            color="#4a9eff" label="PLAYER 1"
            selected={p1Deck} onSelect={setP1Deck}
          />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, flexShrink: 0 }}>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontSize: 22, fontWeight: 900, color: "#ff3333" }}
            >VS</motion.div>
          </div>

          <PlayerDeckPicker
            profile={p2Profile} cardDb={cardDb}
            color="#ff6666" label="PLAYER 2"
            selected={p2Deck} onSelect={setP2Deck}
          />
        </div>

        {/* Start button */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <motion.button
            whileHover={canStart ? { scale: 1.05, y: -3 } : {}}
            whileTap={canStart ? { scale: 0.97 } : {}}
            onClick={() => {
              if (!canStart || !p1Deck || !p2Deck) return;
              onStart(subDeckToDraftResult(p1Deck), subDeckToDraftResult(p2Deck));
            }}
            animate={canStart ? { boxShadow: ["0 0 20px #44ff8844", "0 0 40px #44ff8888", "0 0 20px #44ff8844"] } : {}}
            transition={canStart ? { duration: 1.6, repeat: Infinity } : {}}
            style={{
              padding: "14px 60px",
              background: canStart ? "linear-gradient(135deg, #0a2a12, #1a5a24)" : "rgba(255,255,255,0.04)",
              border: `2px solid ${canStart ? "#44ff8877" : "#252535"}`,
              borderRadius: 14,
              color: canStart ? "#44ff88" : "#334",
              fontSize: 14, fontWeight: 900, letterSpacing: 6,
              cursor: canStart ? "pointer" : "default", fontFamily: "inherit",
            }}
          >{canStart ? "START BATTLE" : "SELECT BOTH DECKS"}</motion.button>
        </div>
      </div>
    </div>
  );
}
