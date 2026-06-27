import { useState } from "react";
import type { CardDef } from "@cg/contracts";
import { ROULETTE_ITEM_MAP } from "@cg/engine";
import { rc } from "../helpers";
import { SYNERGY_LABEL } from "../constants";
import CharacterCard from "../components/CharacterCard";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";
import { BG } from "../backgrounds";
import CardRevealCinematic from "./CardRevealCinematic";
import PickSideCinematic from "./PickSideCinematic";

// Which weapons give extra bonus to this card
function weaponBonusesForCard(defId: string, cardDef: CardDef): { itemId: string; name: string; extra: number; desc: string }[] {
  const result: { itemId: string; name: string; extra: number; desc: string }[] = [];
  const bonusMap: Record<string, { extra: number; desc: string }> = {
    "split-soul-katana": defId === "toji"       ? { extra: 1000, desc: "+1,000 bonus on Toji" } : { extra: 0, desc: "" },
    "higuruma-gavel":    defId === "higuruma"   ? { extra: 1500, desc: "+1,500 bonus on Higuruma" } : { extra: 0, desc: "" },
    "festering-life":    defId === "kurourushi" ? { extra: 1000, desc: "+1,000 bonus on Kurourushi" } : { extra: 0, desc: "" },
    "dragon-bone":       defId === "maki"       ? { extra: 1000, desc: "+1,000 bonus on Maki" } : { extra: 0, desc: "" },
    "nobara-hammer":     defId === "nobara"     ? { extra: 500,  desc: "+500 bonus on Nobara" } : { extra: 0, desc: "" },
    "electric-guitar":   defId === "gakuganji"  ? { extra: 1500, desc: "+1,500 bonus on Gakuganji" } : { extra: 0, desc: "" },
    "black-rope":        defId === "miguel"     ? { extra: 2000, desc: "+2,000 bonus on Miguel" } : { extra: 0, desc: "" },
    "miwa-sword":        defId === "miwa"       ? { extra: 500,  desc: "+500 bonus on Miwa" } : { extra: 0, desc: "" },
  };
  // Naoya bonus on all weapons
  if (defId === "naoya") {
    for (const [itemId, def] of Object.entries(ROULETTE_ITEM_MAP)) {
      result.push({ itemId, name: def.name, extra: 1000, desc: "+1,000 bonus (Naoya perk)" });
    }
    return result;
  }
  for (const [itemId, entry] of Object.entries(bonusMap)) {
    if (entry.extra > 0) {
      const def = ROULETTE_ITEM_MAP[itemId];
      if (def) result.push({ itemId, name: def.name, extra: entry.extra, desc: entry.desc });
    }
  }
  // Weapon efficiency perk
  if (cardDef.perks?.weaponEfficiency) {
    const perk = cardDef.perks.weaponEfficiency;
    const perkDesc = perk === "double" ? "×2 all weapon bonuses" : perk === "plus" ? "+50% all weapon bonuses" : "+35% all weapon bonuses";
    result.push({ itemId: "_perk", name: "Weapon Perk", extra: 0, desc: perkDesc });
  }
  return result;
}

// Synergy tags → display labels
const TAG_SYNERGY: Record<string, string> = {
  "strongest":      "🔥 The Strongest",
  "disaster-curse": "💀 Disaster Curse",
  "jujutsu-high":   "🏫 Jujutsu High",
  "brother":        "🤝 Brotherhood",
  "tokyo-senior":   "🐼 Tokyo Trio",
  "kyoto":          "🏯 Kyoto",
  "zenin-clan":     "⚔ Zenin Clan",
  "heavenly-restriction": "⛓ Heavenly Restriction",
  "six-eyes":       "👁 Six Eyes",
  "culling-game":   "⚔ Culling Game",
  "gojo-student":   "🎓 Gojo's Student",
  "gambler":        "🎰 Gambler",
  "star-map":       "⭐ Lucky Star",
  "miguel-rope":    "🔱 Miguel",
  "zenin-elder":    "⚔ Zenin Elders",
  "rika":              "💜 Rika Bond",
  "curse-leader-geto": "👿 Curse Leader (Geto)",
  "curse-subordinate": "👿 Curse Leader (sub)",
};

// Maps defId to memory-resonance partner for gallery display
const MEMORY_RESONANCE_IDS = new Set(["gojo-base", "geto"]);

const RARITY_ORDER = ["X", "SSS", "SS", "S", "A", "B", "C"];

// ── Card detail panel ─────────────────────────────────────────────────────────
function CardDetail({ defId, def, onClose }: { defId: string; def: CardDef; onClose: () => void }) {
  const color = rc(def.rarity);
  const [scene, setScene] = useState<"reveal" | "pick-left" | "pick-right" | null>(null);
  const weapons = weaponBonusesForCard(defId, def);
  const cardSynergies = def.tags
    .filter(t => TAG_SYNERGY[t])
    .map(t => ({ tag: t, label: TAG_SYNERGY[t] }));
  if (MEMORY_RESONANCE_IDS.has(defId)) {
    cardSynergies.push({ tag: "memory-resonance", label: "👁 Memory Resonance +3% (w/ Gojo or Geto)" });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(2,2,8,0.88)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: "flex", gap: 32, alignItems: "flex-start",
          background: "rgba(8,8,18,0.95)",
          border: `1px solid ${color}44`,
          borderRadius: 20, padding: "32px 36px",
          boxShadow: `0 0 60px ${color}22, 0 0 120px rgba(0,0,0,0.8)`,
          maxWidth: 700, width: "90vw",
        }}
      >
        {/* Card visual */}
        <div style={{ flexShrink: 0 }}>
          <CharacterCard defId={defId} def={def} size="lg" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff", letterSpacing: 1 }}>{def.name}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: color, background: color + "18", border: `1px solid ${color}44`, borderRadius: 6, padding: "3px 9px", fontWeight: "bold" }}>
                {def.rarity}
              </span>
              <span style={{ fontSize: 11, color: "#888", background: "#0a0a1a", border: "1px solid #2a2a3a", borderRadius: 6, padding: "3px 9px" }}>
                {def.affinity === "LEADER" ? "👑 Leader" : def.affinity === "COMBAT" ? "💥 Combat" : "✨ Support"}
              </span>
              <span style={{ fontSize: 11, color: "#ffd700", background: "#1a1400", border: "1px solid #443300", borderRadius: 6, padding: "3px 9px", fontWeight: "bold" }}>
                {def.basePoints.toLocaleString()} pts
              </span>
            </div>
          </div>

          {/* Synergy groups */}
          {cardSynergies.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#445", letterSpacing: 3, marginBottom: 8 }}>SYNERGY GROUPS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cardSynergies.map(s => (
                  <span key={s.tag} style={{ fontSize: 10, color: "#aa77ff", background: "#12082a", border: "1px solid #3a1a6a", borderRadius: 6, padding: "3px 8px" }}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weapon bonuses */}
          {weapons.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#445", letterSpacing: 3, marginBottom: 8 }}>WEAPON BONUSES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {weapons.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {w.itemId !== "_perk" && (
                      <img src={`/weapons/${w.itemId}.PNG`} alt={w.name}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }}
                      />
                    )}
                    <span style={{ fontSize: 10, color: "#66cc44" }}>{w.name}</span>
                    <span style={{ fontSize: 10, color: "#44ff22", fontWeight: "bold", marginLeft: "auto" }}>
                      {w.extra > 0 ? `+${w.extra.toLocaleString()}` : ""} {w.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <div style={{ fontSize: 10, color: "#445", letterSpacing: 3, marginBottom: 8 }}>TAGS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {def.tags.map(t => (
                <span key={t} style={{ fontSize: 9, color: "#556", background: "#0a0a14", border: "1px solid #1a1a28", borderRadius: 4, padding: "2px 6px" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Cinematic preview buttons */}
          {["X","SSS","SS","S","A"].includes(def.rarity) && (
            <div>
              <div style={{ fontSize: 10, color: "#445", letterSpacing: 3, marginBottom: 8 }}>CINEMATIC PREVIEW</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setScene("reveal")}
                  style={{
                    padding: "8px 18px", background: color + "18",
                    border: `1px solid ${color}55`, borderRadius: 8,
                    color, cursor: "pointer", fontSize: 11,
                    letterSpacing: 2, fontFamily: "inherit", fontWeight: "bold",
                  }}
                >
                  ▶ Reveal Scene
                </button>
                <button
                  onClick={() => setScene("pick-left")}
                  style={{
                    padding: "8px 18px", background: color + "10",
                    border: `1px solid ${color}33`, borderRadius: 8,
                    color: color + "cc", cursor: "pointer", fontSize: 11,
                    letterSpacing: 2, fontFamily: "inherit",
                  }}
                >
                  ▶ Pick Scene
                </button>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              marginTop: 4, padding: "10px 24px", alignSelf: "flex-start",
              background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a3a",
              borderRadius: 8, color: "#556", cursor: "pointer", fontSize: 11,
              letterSpacing: 2, fontFamily: "inherit",
            }}
          >
            ← BACK
          </button>
        </div>
      </div>

      {/* Cinematic overlays */}
      {scene === "reveal" && (
        <CardRevealCinematic defId={defId} def={def} onDone={() => setScene(null)} />
      )}
      {(scene === "pick-left" || scene === "pick-right") && (
        <PickSideCinematic
          defId={defId} def={def}
          side={scene === "pick-left" ? "left" : "right"}
          onDone={() => setScene(null)}
        />
      )}
    </div>
  );
}

// ── Main gallery ──────────────────────────────────────────────────────────────
type RarityFilter = "ALL" | "X" | "SSS" | "SS" | "S" | "A" | "B" | "C";
type RoleFilter   = "ALL" | "LEADER" | "COMBAT" | "SUPPORT";

export default function CardGallery({
  cardDb, onBack,
}: {
  cardDb: Record<string, CardDef>;
  onBack: () => void;
}) {
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("ALL");
  const [roleFilter, setRoleFilter]     = useState<RoleFilter>("ALL");
  const [selected, setSelected]         = useState<string | null>(null);
  const [search, setSearch]             = useState("");

  const entries = Object.entries(cardDb)
    .filter(([id]) => id !== "card-back")
    .sort(([, a], [, b]) => {
      const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
      if (ri !== 0) return ri;
      return b.basePoints - a.basePoints;
    })
    .filter(([id, def]) => {
      if (rarityFilter !== "ALL" && def.rarity !== rarityFilter) return false;
      if (roleFilter !== "ALL" && def.affinity !== roleFilter) return false;
      if (search && !def.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

  const selectedDef = selected ? cardDb[selected] : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040b",
      backgroundImage: BG.augment, backgroundSize: "cover", backgroundPosition: "center",
      animation: "bgPan 70s ease-in-out infinite",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      <AmbientCanvas theme="energy" />
      <AmbientOverlay theme="purple" />
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,12,0.60)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, padding: "16px 20px", gap: 14, overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              padding: "8px 18px", background: "rgba(255,255,255,0.04)",
              border: "1px solid #2a2a3a", borderRadius: 8,
              color: "#666", cursor: "pointer", fontSize: 11,
              letterSpacing: 2, fontFamily: "inherit",
            }}
          >
            ← HOME
          </button>

          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#445", letterSpacing: 5 }}>JJK CARD BATTLE</div>
            <div style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 4, color: "#fff" }}>CARD GALLERY</div>
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search cards..."
            style={{
              width: 160, padding: "8px 12px",
              background: "rgba(10,10,24,0.8)", border: "1px solid #2a2a3a",
              borderRadius: 8, color: "#ccc", fontSize: 11, outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          {/* Rarity filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["ALL", "X", "SSS", "SS", "S", "A", "B", "C"] as RarityFilter[]).map(r => (
              <button key={r} onClick={() => setRarityFilter(r)} style={{
                padding: "5px 11px", borderRadius: 6, cursor: "pointer", fontSize: 10,
                fontFamily: "inherit", fontWeight: "bold",
                background: rarityFilter === r ? (r === "ALL" ? "#1a1a2e" : rc(r) + "22") : "rgba(8,8,18,0.6)",
                border: `1px solid ${rarityFilter === r ? (r === "ALL" ? "#3a3a5a" : rc(r) + "88") : "#1a1a28"}`,
                color: rarityFilter === r ? (r === "ALL" ? "#aaa" : rc(r)) : "#444",
              }}>
                {r}
              </button>
            ))}
          </div>

          <div style={{ width: 1, background: "#1a1a2e", alignSelf: "stretch" }} />

          {/* Role filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["ALL", "LEADER", "COMBAT", "SUPPORT"] as RoleFilter[]).map(r => {
              const icon = r === "LEADER" ? "👑" : r === "COMBAT" ? "💥" : r === "SUPPORT" ? "✨" : "";
              return (
                <button key={r} onClick={() => setRoleFilter(r)} style={{
                  padding: "5px 11px", borderRadius: 6, cursor: "pointer", fontSize: 10,
                  fontFamily: "inherit",
                  background: roleFilter === r ? "rgba(255,215,0,0.12)" : "rgba(8,8,18,0.6)",
                  border: `1px solid ${roleFilter === r ? "rgba(255,215,0,0.35)" : "#1a1a28"}`,
                  color: roleFilter === r ? "#ffd700" : "#444",
                }}>
                  {icon} {r}
                </button>
              );
            })}
          </div>

          <div style={{ marginLeft: "auto", fontSize: 10, color: "#334", alignSelf: "center", letterSpacing: 1 }}>
            {entries.length} cards
          </div>
        </div>

        {/* Card grid */}
        <div style={{
          flex: 1, overflowY: "auto",
          display: "flex", flexWrap: "wrap",
          gap: 14, alignContent: "flex-start",
          paddingTop: 20, paddingBottom: 24,
        }}>
          {entries.map(([id, def]) => {
            const color = rc(def.rarity);
            return (
              <div
                key={id}
                onClick={() => setSelected(id)}
                style={{
                  cursor: "pointer", position: "relative",
                  borderRadius: 12,
                  border: `1px solid ${color}30`,
                  background: `rgba(8,6,16,0.7)`,
                  padding: 8,
                  transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
                  boxShadow: `0 0 12px ${color}10`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = color + "88";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 24px ${color}28`;
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = color + "30";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 12px ${color}10`;
                  (e.currentTarget as HTMLDivElement).style.transform = "none";
                }}
              >
                <CharacterCard defId={id} def={def} size="md" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail overlay */}
      {selected && selectedDef && (
        <CardDetail defId={selected} def={selectedDef} onClose={() => setSelected(null)} />
      )}

      <style>{`
        @keyframes bgPan {
          0%   { background-position: 50% 50%; }
          25%  { background-position: 52% 48%; }
          50%  { background-position: 48% 52%; }
          75%  { background-position: 51% 49%; }
          100% { background-position: 50% 50%; }
        }
      `}</style>
    </div>
  );
}
