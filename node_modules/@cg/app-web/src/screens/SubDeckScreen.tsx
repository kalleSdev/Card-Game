import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import type { Profile, SubDeck } from "../profiles";
import { saveSubDeck, deleteSubDeck, loadProfiles, getAscensionRarity } from "../profiles";
import { deriveStats } from "../battleEngine";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";

interface Props {
  profile: Profile;
  cardDb: Record<string, CardDef>;
  onBack: () => void;
  onProfileUpdate: (p: Profile) => void;
}

// ── Deck builder modal ────────────────────────────────────────────────────────
function DeckBuilderModal({
  profile, cardDb, existing, onDone, onCancel,
}: {
  profile: Profile;
  cardDb: Record<string, CardDef>;
  existing: SubDeck | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? `Deck ${profile.subDecks.length + 1}`);
  const [leaderId, setLeaderId] = useState<string | null>(existing?.leaderId ?? null);
  const [cardIds, setCardIds] = useState<string[]>(existing?.cardIds ?? []);

  const collectionMap = new Map(profile.collection.map(c => [c.defId, c]));
  const ownedCards = profile.collection.map(c => c.defId);
  const ownedLeaders  = ownedCards.filter(id => cardDb[id]?.affinity === "LEADER");
  const ownedNonLeaders = ownedCards.filter(id => cardDb[id]?.affinity !== "LEADER");

  const toggleCard = (id: string) => {
    setCardIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  };

  const canSave = name.trim() && leaderId && cardIds.length === 10;

  const save = () => {
    if (!canSave || !leaderId) return;
    const deck: SubDeck = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      leaderId,
      cardIds,
    };
    saveSubDeck(profile.id, deck);
    onDone();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: "rgba(4,4,14,0.98)", borderTop: "2px solid #aa88ff44",
          maxWidth: 860, margin: "40px auto", width: "100%",
          borderRadius: 20, boxShadow: "0 20px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: "20px 28px 16px",
          borderBottom: "1px solid #0e0e22",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a4a",
                borderRadius: 8, padding: "7px 12px", color: "#fff",
                fontSize: 15, fontWeight: 800, fontFamily: "inherit", outline: "none", width: "100%",
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: "#556", letterSpacing: 2 }}>
            {cardIds.length}/10 cards · {leaderId ? "leader set" : "no leader"}
          </div>
          <button onClick={onCancel} style={{
            padding: "6px 14px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#556", cursor: "pointer", fontSize: 11, fontFamily: "inherit",
          }}>Cancel</button>
          <motion.button
            whileHover={canSave ? { scale: 1.04 } : {}} whileTap={canSave ? { scale: 0.96 } : {}}
            onClick={save}
            style={{
              padding: "7px 22px",
              background: canSave ? "linear-gradient(135deg, #6600aa, #aa44ff)" : "rgba(255,255,255,0.04)",
              border: "none", borderRadius: 8,
              color: canSave ? "#fff" : "#334",
              fontSize: 11, fontWeight: 900, letterSpacing: 3,
              cursor: canSave ? "pointer" : "default", fontFamily: "inherit",
            }}
          >SAVE DECK</motion.button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 28px" }}>
          {/* Leader pick */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 8, color: "#ffd700", letterSpacing: 4, marginBottom: 12 }}>
              CHOOSE LEADER {leaderId ? "✓" : "(required)"}
            </div>
            {ownedLeaders.length === 0 ? (
              <div style={{ fontSize: 9, color: "#334", letterSpacing: 2 }}>
                No leaders in collection yet — earn them from card rewards
              </div>
            ) : (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {ownedLeaders.map(id => {
                  const def = cardDb[id];
                  const cc = collectionMap.get(id)!;
                  const rarity = getAscensionRarity(cc);
                  const isSelected = leaderId === id;
                  return (
                    <motion.div key={id} onClick={() => setLeaderId(id)}
                      whileHover={{ y: -4, scale: 1.05 }} whileTap={{ scale: 0.97 }}
                      style={{ position: "relative", cursor: "pointer" }}
                    >
                      {isSelected && (
                        <motion.div
                          animate={{ boxShadow: ["0 0 0 3px #ffd700", "0 0 0 3px #ffd700, 0 0 20px #ffd70088"] }}
                          transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
                          style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none", zIndex: 10 }}
                        />
                      )}
                      <CharacterCard defId={id} def={def} size="sm" rarityOverride={rarity} costOverride={0} noHover />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Non-leader pick */}
          <div>
            <div style={{ fontSize: 8, color: "#aa88ff", letterSpacing: 4, marginBottom: 12 }}>
              CHOOSE 10 CARDS ({cardIds.length}/10)
            </div>
            {ownedNonLeaders.length === 0 ? (
              <div style={{ fontSize: 9, color: "#334", letterSpacing: 2 }}>
                No cards yet — play matches to earn cards
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {ownedNonLeaders.map(id => {
                  const def = cardDb[id];
                  const cc = collectionMap.get(id)!;
                  const rarity = getAscensionRarity(cc);
                  const isSelected = cardIds.includes(id);
                  const isDisabled = !isSelected && cardIds.length >= 10;
                  const cost = deriveStats(def).cost;
                  return (
                    <motion.div key={id}
                      onClick={() => !isDisabled && toggleCard(id)}
                      whileHover={!isDisabled ? { y: -4, scale: 1.05 } : {}}
                      whileTap={!isDisabled ? { scale: 0.97 } : {}}
                      style={{ position: "relative", cursor: isDisabled ? "default" : "pointer", opacity: isDisabled ? 0.35 : 1 }}
                    >
                      {isSelected && (
                        <motion.div
                          animate={{ boxShadow: ["0 0 0 2px #aa88ff", "0 0 0 2px #aa88ff, 0 0 14px #aa88ff66"] }}
                          transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
                          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none", zIndex: 10 }}
                        />
                      )}
                      <CharacterCard defId={id} def={def} size="xs" rarityOverride={rarity} costOverride={cost} noHover />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SubDeckScreen({ profile, cardDb, onBack, onProfileUpdate }: Props) {
  const [editing, setEditing] = useState<SubDeck | null | "NEW">(null);

  const refresh = () => {
    const updated = loadProfiles().find(p => p.id === profile.id);
    if (updated) onProfileUpdate(updated);
  };

  const handleDelete = (id: string) => {
    deleteSubDeck(profile.id, id);
    refresh();
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      backgroundImage: BG.home, backgroundSize: "cover", backgroundPosition: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.88)", zIndex: 0 }} />
      <AmbientCanvas />
      <AmbientOverlay />

      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{
          padding: "20px 28px 14px",
          borderBottom: "1px solid #0e0e22",
          display: "flex", alignItems: "center", gap: 14,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        }}>
          <button onClick={onBack} style={{
            padding: "7px 16px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#556", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "inherit",
          }}>← BACK</button>

          <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "2px solid #aa88ff66" }}>
            <PlayerIcon icon={profile.icon} size={36} style={{ display: "block" }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{profile.name}</div>
            <div style={{ fontSize: 8, color: "#aa88ff", letterSpacing: 3 }}>SUBDECKS</div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={() => setEditing("NEW")}
            style={{
              marginLeft: "auto",
              padding: "8px 20px",
              background: "linear-gradient(135deg, #4400aa, #aa44ff)",
              border: "none", borderRadius: 10,
              color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: 3,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >+ NEW DECK</motion.button>
        </div>

        {/* Deck list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {profile.subDecks.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "80px 0",
              color: "#334", fontSize: 11, letterSpacing: 3,
            }}>
              NO SUBDECKS YET<br />
              <span style={{ fontSize: 9, color: "#223" }}>
                Create a deck from your collected cards
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {profile.subDecks.map(deck => {
                const leaderDef = cardDb[deck.leaderId];
                const cc = profile.collection.find(c => c.defId === deck.leaderId);
                const leaderRarity = cc ? getAscensionRarity(cc) : "S";
                return (
                  <motion.div key={deck.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: "rgba(8,8,22,0.9)", border: "1px solid #1a1a2e",
                      borderRadius: 14, padding: "16px 20px",
                      display: "flex", alignItems: "center", gap: 16,
                    }}
                  >
                    {leaderDef && (
                      <div style={{ transform: "scale(0.72)", transformOrigin: "left center", flexShrink: 0 }}>
                        <CharacterCard defId={deck.leaderId} def={leaderDef} size="sm" rarityOverride={leaderRarity} costOverride={0} noHover />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{deck.name}</div>
                      <div style={{ fontSize: 8, color: "#445", letterSpacing: 2 }}>
                        {deck.cardIds.length} / 10 cards · Leader: {leaderDef?.name ?? "?"}
                      </div>
                      {/* Mini card row */}
                      <div style={{ display: "flex", gap: 3, marginTop: 8, flexWrap: "wrap" }}>
                        {deck.cardIds.slice(0, 10).map(id => {
                          const d = cardDb[id];
                          const c = profile.collection.find(x => x.defId === id);
                          return d ? (
                            <div key={id} style={{ transform: "scale(0.42)", transformOrigin: "left center" }}>
                              <CharacterCard defId={id} def={d} size="xs"
                                rarityOverride={c ? getAscensionRarity(c) : "S"}
                                costOverride={deriveStats(d).cost} noHover />
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <motion.button
                        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                        onClick={() => setEditing(deck)}
                        style={{
                          padding: "7px 16px", background: "rgba(170,136,255,0.08)",
                          border: "1px solid #aa88ff33", borderRadius: 8,
                          color: "#aa88ff", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >✎ Edit</motion.button>
                      <motion.button
                        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                        onClick={() => handleDelete(deck.id)}
                        style={{
                          padding: "7px 14px", background: "rgba(255,40,40,0.06)",
                          border: "1px solid #ff333322", borderRadius: 8,
                          color: "#ff4444", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >✕</motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editing !== null && (
          <DeckBuilderModal
            profile={profile}
            cardDb={cardDb}
            existing={editing === "NEW" ? null : editing}
            onDone={() => { setEditing(null); refresh(); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
