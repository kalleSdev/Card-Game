import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import type { Profile, CollectedCard } from "../profiles";
import { getAscensionRarity, addCardsToCollection, addKillStar, resetCard, loadProfiles } from "../profiles";
import { deriveStats } from "@cg/battle";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";

interface Props {
  profile: Profile;
  cardDb: Record<string, CardDef>;
  onBack: () => void;
}

// ── Single collection card ────────────────────────────────────────────────────
function CollectionCardSlot({
  defId, def, collected, onDevClick,
}: {
  defId: string;
  def: CardDef | undefined;
  collected: CollectedCard | null;
  onDevClick?: (defId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (!def) return null;

  const cost = deriveStats(def).cost;
  const rarityOverride = collected ? getAscensionRarity(collected) : undefined;

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -8, scale: 1.06 }}
      onClick={() => onDevClick && onDevClick(defId)}
      style={{ position: "relative", cursor: onDevClick ? "pointer" : "default", zIndex: hovered ? 100 : "auto" }}
    >
      {/* Locked overlay for uncollected */}
      {!collected && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 12, zIndex: 40,
          background: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(2px)",
        }}>
          <div style={{ fontSize: 22, opacity: 0.4 }}>🔒</div>
        </div>
      )}

      <CharacterCard
        defId={defId} def={def} size="sm"
        rarityOverride={collected ? (rarityOverride ?? "S") : "S"}
        costOverride={cost}
        dupeStars={collected?.duplicateStars ?? 0}
        killStars={collected?.killStars ?? 0}
        noHover
      />

      {/* Tooltip on hover */}
      <AnimatePresence>
        {hovered && collected && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute", bottom: "105%", left: "50%", transform: "translateX(-50%)",
              background: "rgba(4,4,12,0.97)", border: "1px solid #2a2a4a",
              borderRadius: 8, padding: "6px 10px", zIndex: 9999,
              whiteSpace: "nowrap", fontSize: 8, color: "#aaa", letterSpacing: 1,
              boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ color: "#fff", fontWeight: 700, marginBottom: 2 }}>{def.name}</div>
            <div>⭐ {collected.duplicateStars} dupe stars · Ascension {Math.floor(collected.duplicateStars / 3)}</div>
            <div style={{ color: "#ff6666" }}>☠ {collected.killStars} kill stars</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CardCollectionScreen({ profile, cardDb, onBack }: Props) {
  const [filter, setFilter] = useState<"ALL" | "OWNED" | "MISSING">("ALL");
  const [devMode, setDevMode] = useState<null | "ADD_CARD" | "ADD_KILL" | "RESET">(null);
  const [localCollection, setLocalCollection] = useState(profile.collection);

  const refreshCollection = () => {
    const updated = loadProfiles().find(p => p.id === profile.id);
    if (updated) setLocalCollection(updated.collection);
  };

  const handleDevClick = (defId: string) => {
    if (!devMode) return;
    if (devMode === "ADD_CARD") {
      addCardsToCollection(profile.id, [defId]);
    } else if (devMode === "ADD_KILL") {
      addKillStar(profile.id, defId);
    } else if (devMode === "RESET") {
      resetCard(profile.id, defId);
    }
    refreshCollection();
  };

  const allDefIds = Object.keys(cardDb);
  const collectionMap = new Map(localCollection.map(c => [c.defId, c]));
  const ownedCount = localCollection.length;

  const filtered = allDefIds.filter(id => {
    const owned = collectionMap.has(id);
    if (filter === "OWNED") return owned;
    if (filter === "MISSING") return !owned;
    return true;
  });

  // Separate leaders from non-leaders for display order
  const leaders    = filtered.filter(id => cardDb[id]?.affinity === "LEADER");
  const nonLeaders = filtered.filter(id => cardDb[id]?.affinity !== "LEADER");

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.88)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{
          padding: "20px 28px 14px",
          borderBottom: "1px solid #0e0e22",
          display: "flex", alignItems: "center", gap: 16,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        }}>
          <button onClick={onBack} style={{
            padding: "7px 16px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#556", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit",
          }}>← BACK</button>

          <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", border: "2px solid #ffd70066" }}>
            <PlayerIcon icon={profile.icon} size={38} style={{ display: "block" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{profile.name}</div>
            <div style={{ fontSize: 8, color: "#ffd700", letterSpacing: 3 }}>CARD COLLECTION</div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 10, color: "#ffd700", fontWeight: 900 }}>{ownedCount}</div>
            <div style={{ fontSize: 8, color: "#445", letterSpacing: 2 }}>/ {allDefIds.length} CARDS</div>
          </div>

          {/* Filter */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["ALL", "OWNED", "MISSING"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 12px",
                background: filter === f ? "#ffd700" : "rgba(255,255,255,0.04)",
                border: `1px solid ${filter === f ? "#ffd700" : "#2a2a3a"}`,
                borderRadius: 6, color: filter === f ? "#000" : "#556",
                fontSize: 9, fontWeight: filter === f ? 900 : 400,
                cursor: "pointer", letterSpacing: 2, fontFamily: "inherit",
              }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Collection grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {ownedCount === 0 && filter === "OWNED" ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#334", fontSize: 12, letterSpacing: 3 }}>
              NO CARDS YET — PLAY MATCHES TO EARN CARDS
            </div>
          ) : (
            <>
              {leaders.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 8, color: "#ffd700", letterSpacing: 4, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                    LEADERS
                    <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #ffd70044, transparent)" }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                    {leaders.map(id => (
                      <CollectionCardSlot
                        key={id} defId={id}
                        def={cardDb[id]}
                        collected={collectionMap.get(id) ?? null}
                        onDevClick={devMode ? handleDevClick : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}

              {nonLeaders.length > 0 && (
                <div>
                  <div style={{ fontSize: 8, color: "#aa88ff", letterSpacing: 4, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                    CARDS
                    <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #aa88ff44, transparent)" }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                    {nonLeaders.map(id => (
                      <CollectionCardSlot
                        key={id} defId={id}
                        def={cardDb[id]}
                        collected={collectionMap.get(id) ?? null}
                        onDevClick={devMode ? handleDevClick : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Legend */}
        <div style={{
          padding: "10px 28px",
          borderTop: "1px solid #0e0e22",
          background: "rgba(0,0,0,0.6)",
          display: "flex", gap: 24, alignItems: "center",
          fontSize: 8, color: "#334", letterSpacing: 2,
        }}>
          <span>⭐ <span style={{ color: "#ffd700" }}>Gold stars</span> = duplicates · every 3 ascends card</span>
          <span>★ <span style={{ color: "#ff4444" }}>Red stars</span> = kills with card · every 3 = ✕ mark</span>
          <span style={{ color: "#445" }}>Cards unlock at S-tier visuals in your collection</span>
        </div>
      </div>

      {/* Dev Tool */}
      <div style={{
        position: "fixed", bottom: 16, right: 16, zIndex: 200,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
      }}>
        {devMode && (
          <div style={{
            background: "rgba(4,4,12,0.95)", border: "1px solid #2a2a3a",
            borderRadius: 10, padding: "8px 14px", fontSize: 8, color: "#cc44ff",
            letterSpacing: 2, backdropFilter: "blur(8px)",
          }}>
            {devMode === "ADD_CARD" ? "CLICK A CARD TO ADD IT" : devMode === "ADD_KILL" ? "CLICK A CARD TO ADD KILL" : "CLICK A CARD TO RESET IT"}
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {devMode ? (
            <>
              <button
                onClick={() => setDevMode("ADD_CARD")}
                style={{
                  padding: "7px 14px", background: devMode === "ADD_CARD" ? "rgba(170,68,255,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${devMode === "ADD_CARD" ? "#aa44ff" : "#2a2a3a"}`,
                  borderRadius: 8, color: devMode === "ADD_CARD" ? "#cc44ff" : "#556",
                  cursor: "pointer", fontSize: 9, letterSpacing: 2, fontFamily: "inherit",
                }}
              >ADD CARD</button>
              <button
                onClick={() => setDevMode("ADD_KILL")}
                style={{
                  padding: "7px 14px", background: devMode === "ADD_KILL" ? "rgba(255,68,68,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${devMode === "ADD_KILL" ? "#ff4444" : "#2a2a3a"}`,
                  borderRadius: 8, color: devMode === "ADD_KILL" ? "#ff4444" : "#556",
                  cursor: "pointer", fontSize: 9, letterSpacing: 2, fontFamily: "inherit",
                }}
              >ADD KILL</button>
              <button
                onClick={() => setDevMode("RESET")}
                style={{
                  padding: "7px 14px", background: devMode === "RESET" ? "rgba(255,165,0,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${devMode === "RESET" ? "#ffa500" : "#2a2a3a"}`,
                  borderRadius: 8, color: devMode === "RESET" ? "#ffa500" : "#556",
                  cursor: "pointer", fontSize: 9, letterSpacing: 2, fontFamily: "inherit",
                }}
              >RESET</button>
              <button
                onClick={() => setDevMode(null)}
                style={{
                  padding: "7px 12px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid #2a2a3a", borderRadius: 8,
                  color: "#556", cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                }}
              >✕</button>
            </>
          ) : (
            <button
              onClick={() => setDevMode("ADD_CARD")}
              style={{
                padding: "7px 14px", background: "rgba(255,255,255,0.04)",
                border: "1px solid #2a2a3a", borderRadius: 8,
                color: "#334", cursor: "pointer", fontSize: 9, letterSpacing: 2, fontFamily: "inherit",
              }}
            >⚙ DEV</button>
          )}
        </div>
      </div>
    </div>
  );
}
