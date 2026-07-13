import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import type { CardDef } from "@cg/contracts";
import { ROULETTE_ITEM_MAP } from "@cg/engine";
import { rc } from "../helpers";
import { SYNERGY_LABEL } from "../constants";
import { DOMAIN_BATTLE_EFFECTS } from "../battleEngine";
import CharacterCard from "../components/CharacterCard";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";
import { BG } from "../backgrounds";
import CardRevealCinematic from "./CardRevealCinematic";
import PickSideCinematic from "./PickSideCinematic";

// Weapon info split into global perks (shown as a single summary line)
// and specific per-weapon bonuses (shown with weapon icon + name)
interface GlobalPerk { kind: "global"; label: string; note: string }
interface SpecificBonus { kind: "specific"; itemId: string; name: string; extra: number }
type WeaponEntry = GlobalPerk | SpecificBonus;

function weaponBonusesForCard(defId: string, cardDef: CardDef): WeaponEntry[] {
  const result: WeaponEntry[] = [];

  // Global perks — single summary line, no individual weapon listing
  if (defId === "naoya") {
    result.push({ kind: "global", label: "+1,000 bonus with any weapon", note: "Projection Sorcery Perk" });
  }
  if (cardDef.perks?.weaponEfficiency) {
    const perk = cardDef.perks.weaponEfficiency;
    const label = perk === "double" ? "×2 multiplier on all weapon bonuses"
                : perk === "plus"   ? "+50% on all weapon bonuses"
                :                     "+35% on all weapon bonuses";
    result.push({ kind: "global", label, note: "Weapon Efficiency Perk" });
  }

  // Per-weapon specific bonuses (only for non-Naoya cards)
  if (defId !== "naoya") {
    const specificMap: Record<string, { extra: number; name?: string }> = {
      "split-soul-katana": defId === "toji"       ? { extra: 1000 } : { extra: 0 },
      "higuruma-gavel":    defId === "higuruma"   ? { extra: 1500 } : { extra: 0 },
      "festering-life":    defId === "kurourushi" ? { extra: 1000 } : { extra: 0 },
      "dragon-bone":       defId === "maki"       ? { extra: 1000 } : { extra: 0 },
      "nobara-hammer":     defId === "nobara"     ? { extra: 500  } : { extra: 0 },
      "electric-guitar":   defId === "gakuganji"  ? { extra: 1500 } : { extra: 0 },
      "black-rope":        defId === "miguel"     ? { extra: 2000 } : { extra: 0 },
      "miwa-sword":        defId === "miwa"       ? { extra: 500  } : { extra: 0 },
    };
    for (const [itemId, entry] of Object.entries(specificMap)) {
      if (entry.extra > 0) {
        const def = ROULETTE_ITEM_MAP[itemId];
        if (def) result.push({ kind: "specific", itemId, name: def.name, extra: entry.extra });
      }
    }
  }

  return result;
}

const DOMAIN_ELIGIBLE = new Set(["SS", "SSS", "X"]);

function getDomainDesc(defId: string): { name: string; desc: string; secondDesc?: string } | null {
  if (!DOMAIN_ELIGIBLE) return null; // guard for tree-shaking
  const d = DOMAIN_BATTLE_EFFECTS[defId];
  if (!d) return null;
  const e = d.effect;
  let desc = "";
  const grantSuffix = defId === "gojo-base"
    ? " Grants Hollow Purple (4 damage). Filling twice grants 2 Hollow Purples."
    : d.grantSpell ? ` Also grants "${d.grantSpell.name}" — ${d.grantSpell.desc}.` : "";
  switch (e.kind) {
    case "STUN_ENEMY_BOARD":      desc = `Fully immobilizes all enemies for ${e.turns} turn${e.turns > 1 ? "s" : ""} — no actions allowed.`; break;
    case "DAMAGE_ALL_ENEMIES":    desc = `Deals ${e.amount} damage split across all enemies.`; break;
    case "BUFF_OWN_BOARD":        desc = `Gives own board +${e.atkBonus} ATK / +${e.hpBonus} HP for ${e.turns} turn${e.turns > 1 ? "s" : ""}.`; break;
    case "KILL_ALL_BOARD":        desc = "Destroys all non-leader cards on both sides."; break;
    case "SPAWN_ENTITIES":        desc = `Spawns ${e.count}× ${e.atk}/${e.hp} Cursed Spirits on your board.`; break;
    case "GRANT_RANDOM_SPELLS":   desc = `Grants ${e.count} random synergy spells.`; break;
    case "REDUCE_COSTS":          desc = `All cards cost ${e.amount} less for ${e.turns} turn${e.turns > 1 ? "s" : ""}.`; break;
    case "GRANT_SPELL":           desc = `Grants spell: "${e.spellName}" — ${e.spellDesc}.`; break;
    case "BUFF_LEADER_PERMANENT": desc = e.atk > 0 && e.hp > 0
      ? `Leader gains +${e.atk} ATK / +${e.hp} HP permanently.`
      : e.atk > 0 ? `Leader gains +${e.atk} ATK permanently.`
      : `Leader gains +${e.hp} HP permanently.`; break;
    case "SHEEPIFY_BOARD":        desc = "All board cards become 1/1 sheep."; break;
    case "SHEEPIFY_ENEMY_CARDS":  desc = `Choose ${e.count} enemy board cards to turn into 1/1 sheep.`; break;
    case "SNEAK_ATTACK_DOMAIN":   desc = `Deal ${e.amount} damage to any target — no counter damage.`; break;
    case "SUKUNA_BOARD_MODE":     desc = "Wipes all board cards. Sukuna enters as a 4/17 playing card — always targetable. His death ends the match."; break;
    case "MAHORAGA_BOARD_MODE":   desc = "Mahoraga enters the board as a 1/25 card. Gains +1 ATK each time he's hit. His death ends the match."; break;
    case "SUMMON_RIKA_AND_COPY":  desc = "Summons Rika (5/5 Cursed Spirit). Grants Cursed Copy spell — place a 3/3 copy of any board card."; break;
    default:                      desc = "Activates a powerful cursed technique.";
  }
  let secondDesc: string | undefined;
  if (d.secondEffect) {
    const s = d.secondEffect;
    if (s.kind === "GRANT_SPELL") secondDesc = `2nd fill: grants "${s.spellName}" — ${s.spellDesc}.`;
    else if (s.kind === "BUFF_LEADER_PERMANENT") secondDesc = `2nd fill: leader gains +${s.atk} ATK / +${s.hp} HP permanently.`;
    else if (s.kind === "SHEEPIFY_ENEMY_LEADER") secondDesc = "2nd fill: enemy leader becomes a 1/7 sheep.";
    else if (s.kind === "SUMMON_RIKA_AND_COPY") secondDesc = "2nd fill: summon Rika (5/5) again.";
    else if (s.kind === "SPAWN_ENTITIES") secondDesc = `2nd fill: spawns ${s.count}× ${s.atk}/${s.hp} entity.`;
    else if (s.kind === "GRANT_RANDOM_SPELLS") secondDesc = `2nd fill: grants ${s.count} more random spells.`;
    else if (s.kind === "SHEEPIFY_ENEMY_CARDS") secondDesc = `2nd fill: choose ${s.count} more enemy cards to sheepify.`;
    else secondDesc = "2nd fill: activates a secondary effect.";
  }
  return { name: d.name, desc: desc + grantSuffix, secondDesc };
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
function DomainTooltip({ info, x, y }: { info: { name: string; desc: string; secondDesc?: string }; x: number; y: number }) {
  return createPortal(
    <div style={{
      position: "fixed",
      left: Math.min(x + 14, window.innerWidth - 320),
      top: Math.max(8, y - 8),
      zIndex: 9999,
      pointerEvents: "none",
      width: 300,
      background: "rgba(8,4,20,0.97)",
      border: "1px solid #7744cc88",
      borderRadius: 12,
      padding: "14px 16px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 0 24px #7744cc22",
    }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#cc44ff", letterSpacing: 2, marginBottom: 6 }}>
        🌀 DOMAIN EXPANSION
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{info.name}</div>
      <div style={{ fontSize: 11, color: "#bbb", lineHeight: 1.5 }}>{info.desc}</div>
      {info.secondDesc && (
        <div style={{
          marginTop: 10, paddingTop: 8,
          borderTop: "1px solid #7744cc33",
          fontSize: 10, color: "#aa77ff", lineHeight: 1.5,
        }}>
          {info.secondDesc}
        </div>
      )}
    </div>,
    document.body
  );
}

function CardDetail({ defId, def, onClose }: { defId: string; def: CardDef; onClose: () => void }) {
  const color = rc(def.rarity);
  const [scene, setScene] = useState<"reveal" | "pick-left" | "pick-right" | null>(null);
  const [domainHover, setDomainHover] = useState<{ x: number; y: number } | null>(null);
  const weapons = weaponBonusesForCard(defId, def);
  const cardSynergies = def.tags
    .filter(t => TAG_SYNERGY[t])
    .map(t => ({ tag: t, label: TAG_SYNERGY[t] }));
  if (MEMORY_RESONANCE_IDS.has(defId)) {
    cardSynergies.push({ tag: "memory-resonance", label: "👁 Memory Resonance +3% (w/ Gojo or Geto)" });
  }
  const domainInfo = DOMAIN_ELIGIBLE.has(def.rarity) ? getDomainDesc(defId) : null;

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
              {domainInfo && (
                <span
                  onMouseMove={e => setDomainHover({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setDomainHover(null)}
                  style={{
                    fontSize: 11, color: "#cc44ff", background: "rgba(100,30,180,0.18)",
                    border: "1px solid #7744cc88", borderRadius: 6, padding: "3px 9px",
                    fontWeight: "bold", cursor: "default", letterSpacing: 1,
                    boxShadow: "0 0 8px #7744cc22",
                  }}
                >
                  🌀 DOMAIN
                </span>
              )}
            </div>
          </div>
          {domainHover && domainInfo && <DomainTooltip info={domainInfo} x={domainHover.x} y={domainHover.y} />}

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
                {weapons.map((w, i) => w.kind === "global" ? (
                  /* Global perk — single clean summary row */
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(68,255,34,0.07)", borderRadius: 4,
                    padding: "5px 8px", border: "1px solid rgba(68,255,34,0.18)",
                  }}>
                    <span style={{ fontSize: 11, color: "#44ff22", fontWeight: "bold" }}>{w.label}</span>
                    <span style={{ fontSize: 9, color: "#44ff2288", marginLeft: "auto", whiteSpace: "nowrap" }}>{w.note}</span>
                  </div>
                ) : (
                  /* Specific weapon row with icon */
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={`/weapons/${w.itemId}.PNG`} alt={w.name}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 10, color: "#66cc44" }}>{w.name}</span>
                    <span style={{ fontSize: 10, color: "#44ff22", fontWeight: "bold", marginLeft: "auto" }}>
                      +{w.extra.toLocaleString()}
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
            ← BACK
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
