import { useCallback, useEffect, useState, useRef, Component } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";

// ── ErrorBoundary — catches render crashes and shows the error ────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#04040a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
          <div style={{ color: "#ff4444", fontSize: 16, fontWeight: 900, letterSpacing: 2 }}>RENDER ERROR</div>
          <div style={{ color: "#ff8888", fontSize: 12, fontFamily: "monospace", background: "#110000", padding: 16, borderRadius: 8, maxWidth: 800, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {this.state.error.message}
          </div>
          <div style={{ color: "#ff6666", fontSize: 10, fontFamily: "monospace", background: "#110000", padding: 16, borderRadius: 8, maxWidth: 800, whiteSpace: "pre-wrap", wordBreak: "break-all", overflow: "auto", maxHeight: 300 }}>
            {this.state.error.stack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import type { PlayerId, CardDef } from "@cg/contracts";
import type { BattleState, BattleCard, BattlePlayer, BattleIntent, SpellCard, PendingDomainAction } from "../battleEngine";
import { createBattleEngine, createBattleState, DOMAIN_BATTLE_EFFECTS, BATTLE_SYNERGY_RULES, CARD_PERKS } from "../battleEngine";
import type { DomainEffect } from "../battleEngine";
import type { PlayerDraftResult } from "./DraftBattleScreen";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Shared tooltip bubble via portal ─────────────────────────────────────────
function HoverTooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return createPortal(
    <div style={{
      position: "fixed",
      left: Math.min(Math.max(8, x + 16), window.innerWidth - 360),
      top: Math.min(Math.max(10, y - 10), window.innerHeight - 320),
      zIndex: 9999, pointerEvents: "none", width: 340,
      background: "rgba(6,3,18,0.98)",
      border: "1px solid #7744ccaa", borderRadius: 14,
      padding: "16px 20px",
      boxShadow: "0 12px 48px rgba(0,0,0,0.9), 0 0 32px #7744cc33",
    }}>
      {children}
    </div>,
    document.body
  );
}

function buildDomainDesc(defId: string, d: { name: string; effect: DomainEffect; grantSpell?: { name: string; desc: string }; secondEffect?: DomainEffect }) {
  const e = d.effect;
  const grantSuffix = defId === "gojo-base"
    ? " Grants Hollow Purple (5 dmg), +5 energy, and unlimited GET SPELL this turn. Filling twice grants 2 Hollow Purples."
    : d.grantSpell ? ` Also grants "${d.grantSpell.name}" — ${d.grantSpell.desc}.` : "";
  let desc = "Activates a powerful cursed technique.";
  if (e.kind === "STUN_ENEMY_BOARD")       desc = `Fully immobilizes all enemies for ${e.turns} turn${e.turns > 1 ? "s" : ""} — no actions allowed.`;
  else if (e.kind === "DAMAGE_ALL_ENEMIES") desc = `Deals ${e.amount} damage split across all enemies.`;
  else if (e.kind === "BUFF_OWN_BOARD")     desc = `Gives own board +${e.atkBonus} ATK / +${e.hpBonus} HP for ${e.turns} turn${e.turns > 1 ? "s" : ""}.`;
  else if (e.kind === "SPAWN_ENTITIES")     desc = `Spawns ${e.count}× ${e.atk}/${e.hp} Cursed Spirits on your board.`;
  else if (e.kind === "GRANT_RANDOM_SPELLS") desc = `Grants ${e.count} random synergy spells.`;
  else if (e.kind === "REDUCE_COSTS")       desc = `All cards cost ${e.amount} less for ${e.turns} turn${e.turns > 1 ? "s" : ""}.`;
  else if (e.kind === "GRANT_SPELL")        desc = `Grants spell: "${e.spellName}" — ${e.spellDesc}.`;
  else if (e.kind === "BUFF_LEADER_PERMANENT") desc = e.atk > 0 && e.hp > 0 ? `Leader gains +${e.atk} ATK / +${e.hp} HP permanently.` : e.atk > 0 ? `Leader gains +${e.atk} ATK permanently.` : `Leader gains +${e.hp} HP permanently.`;
  else if (e.kind === "SHEEPIFY_ENEMY_CARDS") desc = `Choose ${e.count} enemy board cards to turn into 1/1 sheep.`;
  else if (e.kind === "SUKUNA_BOARD_MODE")  desc = "Wipes all board cards. Sukuna enters as a 4/17 playing card — always targetable. His death ends the match.";
  else if (e.kind === "MAHORAGA_BOARD_MODE") desc = "Mahoraga enters as a 1/25 board card. Gains +1 ATK each time he's hit. His death ends the match.";
  else if (e.kind === "SUMMON_RIKA_AND_COPY") desc = "Summons Rika (5/5 Cursed Spirit). Grants Cursed Copy — place a 3/3 copy of any board card.";
  else if (e.kind === "KILL_ALL_BOARD")     desc = "Destroys all non-leader cards on both sides.";
  let secondDesc: string | undefined;
  if (d.secondEffect) {
    const s = d.secondEffect;
    if (s.kind === "GRANT_SPELL") secondDesc = `2nd fill: grants "${s.spellName}" — ${s.spellDesc}.`;
    else if (s.kind === "BUFF_LEADER_PERMANENT") secondDesc = `2nd fill: leader gains +${s.atk} ATK / +${s.hp} HP permanently.`;
    else if (s.kind === "SUMMON_RIKA_AND_COPY") secondDesc = "2nd fill: summon Rika (5/5) again.";
    else if (s.kind === "SPAWN_ENTITIES") secondDesc = `2nd fill: spawns ${s.count}× ${s.atk}/${s.hp} entity.`;
    else if (s.kind === "GRANT_RANDOM_SPELLS") secondDesc = `2nd fill: grants ${s.count} more random spells.`;
    else if (s.kind === "SHEEPIFY_ENEMY_CARDS") secondDesc = `2nd fill: choose ${s.count} more enemy cards to sheepify.`;
  }
  return { desc: desc + grantSuffix, secondDesc };
}

// ── DomainBadge — hoverable 🌀 DOMAIN tag ────────────────────────────────────
function DomainBadge({ defId }: { defId: string }) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const d = DOMAIN_BATTLE_EFFECTS[defId];
  if (!d) return null;
  const { desc, secondDesc } = buildDomainDesc(defId, d);
  return (
    <>
      <div
        onMouseMove={ev => setTooltipPos({ x: ev.clientX, y: ev.clientY })}
        onMouseLeave={() => setTooltipPos(null)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
          color: "#dd55ff", background: "rgba(80,0,130,0.8)",
          border: "1px solid #cc44ff88", borderRadius: 5,
          padding: "2px 7px", cursor: "default", whiteSpace: "nowrap",
        }}
      >🌀 DOMAIN</div>
      {tooltipPos && (
        <HoverTooltip x={tooltipPos.x} y={tooltipPos.y}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#cc44ff", letterSpacing: 2, marginBottom: 8 }}>🌀 DOMAIN EXPANSION</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10, lineHeight: 1.2 }}>{d.name}</div>
          <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{desc}</div>
          {secondDesc && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #7744cc44", fontSize: 12, color: "#bb88ff", lineHeight: 1.6 }}>
              {secondDesc}
            </div>
          )}
        </HoverTooltip>
      )}
    </>
  );
}


// ── SynergyTag — hoverable synergy pill showing spell description ─────────────
function SynergyTag({ id }: { id: string }) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const rule = BATTLE_SYNERGY_RULES.find(r => r.id === id);
  if (!rule) return null;
  return (
    <>
      <div
        onMouseMove={ev => setHover({ x: ev.clientX, y: ev.clientY })}
        onMouseLeave={() => setHover(null)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
          color: "#44ff88", background: "rgba(0,60,30,0.75)",
          border: "1px solid #44ff8855", borderRadius: 5,
          padding: "2px 7px", cursor: "default", whiteSpace: "nowrap",
        }}
      >✦ {rule.label}</div>
      {hover && (
        <HoverTooltip x={hover.x} y={hover.y}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#44ff88", letterSpacing: 2, marginBottom: 8 }}>✦ SYNERGY ACTIVE</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10 }}>{rule.label}</div>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>Spell unlocked:</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#88ffbb", marginBottom: 6 }}>{rule.spellName}</div>
          <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{rule.spellDesc}</div>
        </HoverTooltip>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout overview:
//
//  ┌─────────────────────────────────────────┐
//  │  [Opponent Leader — centered, top]       │  oppLeader row
//  │  ──────────── opponent board ───────────  │  oppBoard row  (flex 1)
//  │  ═══════════ CENTER INFO BAR ═══════════  │  infoBar
//  │  ──────────── player board ─────────────  │  myBoard row   (flex 1)
//  │  [My Leader — centered, bottom]          │  myLeader row
//  │  [Hand]                                  │  hand row
//  └─────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  p1Draft: PlayerDraftResult;
  p2Draft: PlayerDraftResult;
  cardDb: Record<string, CardDef>;
  p1Name: string; p2Name: string;
  p1Icon: string; p2Icon: string;
  onGameOver: (winner: PlayerId, turnCount: number) => void;
}

// ── BoardCardView ─────────────────────────────────────────────────────────────
function BoardCardView({
  card, cardDb, selected, targetable, friendlyTarget, onClick,
  isHit, isFresh, floatingDmgs, isPinned, isLunging, lungeDir = "up",
}: {
  card: BattleCard; cardDb: Record<string, CardDef>;
  selected?: boolean; targetable?: boolean; friendlyTarget?: boolean; onClick?: (ev?: React.MouseEvent) => void;
  isHit?: boolean; isFresh?: boolean; floatingDmgs?: { key: number; amount: number }[];
  isPinned?: boolean;
  isLunging?: boolean; lungeDir?: "up" | "down";
}) {
  const def = cardDb[card.defId];

  return (
    <motion.div
      onClick={(ev) => onClick?.(ev)}
      animate={{
        scale: isLunging ? [1, 1.18, 1] : isHit ? [1, 1.08, 0.95, 1] : 1,
        y: isLunging ? (lungeDir === "up" ? [0, -26, 0] : [0, 26, 0]) : 0,
        rotate: isLunging ? (lungeDir === "up" ? [0, -4, 0] : [0, 4, 0]) : 0,
        filter: friendlyTarget
          ? "brightness(1.2) drop-shadow(0 0 8px #4aeecc)"
          : targetable
          ? "brightness(1.2) drop-shadow(0 0 8px #ff4444)"
          : isLunging
          ? "brightness(1.5) drop-shadow(0 0 14px #ffcc44)"
          : isHit
          ? "brightness(2.2)"
          : "brightness(1)",
      }}
      transition={isLunging
        ? { duration: 0.34, times: [0, 0.45, 1], ease: "easeOut" }
        : isHit
        ? { duration: 0.28, times: [0, 0.25, 0.7, 1] }
        : { type: "spring", stiffness: 400, damping: 22 }}
      whileHover={onClick ? { y: -8, scale: selected ? 1.1 : 1.07 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      style={{ position: "relative", cursor: onClick ? "pointer" : "default", userSelect: "none", zIndex: isLunging ? 40 : undefined }}
    >
      <CharacterCard defId={card.defId} def={def} size="xs" noHover hideInfo smallBadges
        dimmed={!friendlyTarget && !targetable && (card.exhausted || !card.canAttack || card.stunTurns > 0)}
        statsOverlay={{ name: def?.name, atk: card.atk, hp: card.currentHp, maxHp: card.maxHp }}
      />

      {/* Hit flash overlay */}
      {isHit && (
        <motion.div
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
          style={{
            position: "absolute", inset: 0, borderRadius: 10,
            background: "radial-gradient(circle at 50% 40%, rgba(255,80,0,0.9), rgba(255,0,0,0.5))",
            pointerEvents: "none", zIndex: 26, mixBlendMode: "screen",
          }}
        />
      )}

      {/* Impact spark burst — particles fly out when hit */}
      {isHit && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 27 }}>
          {[0, 1, 2, 3, 4, 5].map(i => {
            const ang = (i / 6) * Math.PI * 2 + 0.4;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(ang) * 34,
                  y: Math.sin(ang) * 34,
                  opacity: 0,
                  scale: 0.2,
                }}
                transition={{ duration: 0.42, ease: "easeOut" }}
                style={{
                  position: "absolute", top: "42%", left: "46%",
                  width: 5, height: 5, borderRadius: "50%",
                  background: i % 2 === 0 ? "#ffcc44" : "#ff6622",
                  boxShadow: "0 0 6px #ff8800",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Dynamic shield badge (for cards that gained hasTaunt via GRANT_BOARD_SHIELD, not from def tag) */}
      {/* Identical styling/position to CharacterCard's shield bubble at smallBadges size (bs=16) */}
      {card.hasTaunt && !def?.tags?.includes("shield") && (
        <div style={{
          position: "absolute",
          top: -(16 * 0.3) + 16 * 0.62, left: -(16 * 0.3) + 16 * 0.6,
          width: 10, height: 10, borderRadius: "50%",
          background: "linear-gradient(135deg, #1a3a6e 0%, #0a1a4a 100%)",
          border: "1.5px solid rgba(100,180,255,0.85)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 8px rgba(80,160,255,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 28, pointerEvents: "none",
        }}>
          <span style={{ fontSize: 6, lineHeight: 1 }}>🛡</span>
        </div>
      )}

      {/* Nobara Resonance pin — this card is linked; next damage echoes to its partner */}
      {isPinned && (
        <div
          style={{ position: "absolute", top: -6, right: -6, zIndex: 29 }}
          onMouseEnter={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".pin-tip");
            if (tip) tip.style.display = "block";
          }}
          onMouseLeave={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".pin-tip");
            if (tip) tip.style.display = "none";
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{
              width: 16, height: 16, borderRadius: "50%",
              background: "linear-gradient(135deg, #5a1a2e, #2a0a14)",
              border: "1.5px solid rgba(255,100,140,0.9)",
              boxShadow: "0 0 8px rgba(255,80,120,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9,
            }}
          >📌</motion.div>
          <div className="pin-tip" style={{
            display: "none", position: "absolute", bottom: 20, right: 0,
            background: "rgba(4,4,14,0.97)", border: "1px solid #6a2a3a",
            borderRadius: 8, padding: "7px 10px",
            width: 170, zIndex: 999, pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#ff88aa", marginBottom: 3 }}>📌 Resonance</div>
            <div style={{ fontSize: 9, color: "#fff", lineHeight: 1.5 }}>
              Pinned by Nobara. The next time this card or its linked partner takes damage, the other takes half that damage. One use.
            </div>
          </div>
        </div>
      )}

      {/* Entrance glow for newly placed card */}
      {isFresh && (
        <motion.div
          initial={{ opacity: 1, scale: 1.3 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{
            position: "absolute", inset: -5, borderRadius: 16,
            background: card.cost >= 5
              ? "radial-gradient(circle, rgba(255,200,50,0.95) 0%, rgba(255,100,0,0.6) 50%, transparent 75%)"
              : "radial-gradient(circle, rgba(80,200,255,0.7) 0%, rgba(50,100,255,0.3) 50%, transparent 75%)",
            pointerEvents: "none", zIndex: 27,
          }}
        />
      )}

      {/* Entrance shockwave ring — expands outward on placement */}
      {isFresh && (
        <motion.div
          initial={{ opacity: 0.9, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: card.cost >= 5 ? "3px solid rgba(255,190,60,0.9)" : "2px solid rgba(120,200,255,0.8)",
            pointerEvents: "none", zIndex: 27,
          }}
        />
      )}

      {/* Floating damage numbers */}
      <AnimatePresence>
        {floatingDmgs?.map(d => (
          <motion.div
            key={d.key}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -48, opacity: 0, scale: 1.3 }}
            exit={{}}
            transition={{ duration: 0.65, ease: "easeOut" }}
            style={{
              position: "absolute", top: "25%", left: "50%",
              transform: "translateX(-50%)",
              fontSize: d.amount >= 5 ? 18 : 14,
              fontWeight: 900,
              color: d.amount >= 5 ? "#ff2200" : "#ff6644",
              textShadow: "0 0 10px #ff0000cc, 0 2px 6px #000",
              pointerEvents: "none", zIndex: 50,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: -1,
            }}
          >
            -{d.amount}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Stun */}
      {card.stunTurns > 0 && (
        <div style={{
          position: "absolute", top: 3, right: 3,
          background: "#4488ff", borderRadius: 3,
          fontSize: 7, fontWeight: 900, padding: "1px 4px", color: "#fff",
        }}>STUN</div>
      )}

      {/* Leader card crown indicator (Sukuna/Mahoraga board mode) */}
      {card.isLeaderCard && (
        <div style={{
          position: "absolute", top: 3, left: 3,
          background: "rgba(255, 165, 0, 0.9)", borderRadius: 3,
          fontSize: 9, padding: "1px 3px",
        }}>👑</div>
      )}

      {/* Enemy target ring */}
      {targetable && !selected && !friendlyTarget && (
        <motion.div
          animate={{ boxShadow: ["0 0 0 3px #ff4444, 0 0 12px #ff444477", "0 0 0 3px #ff6666, 0 0 20px #ff4444aa"] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none" }}
        />
      )}

      {/* Friendly buff target ring */}
      {friendlyTarget && !selected && (
        <motion.div
          animate={{ boxShadow: ["0 0 0 3px #4aeecc, 0 0 12px #4aeecc77", "0 0 0 3px #4aeecc, 0 0 20px #4aeeccaa"] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none" }}
        />
      )}

      {/* Idle glow for ready cards */}
      {!card.exhausted && !selected && !targetable && !friendlyTarget && (
        <motion.div
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: -1, borderRadius: 12, pointerEvents: "none", zIndex: -1,
            boxShadow: "0 0 8px rgba(80,80,255,0.15)",
          }}
        />
      )}

      {/* Sheep overlay */}
      {card.isSheep && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10, zIndex: 5,
          background: "rgba(200,200,200,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>🐑</div>
      )}
    </motion.div>
  );
}

// ── HandCardView ──────────────────────────────────────────────────────────────
function HandCardView({
  card, cardDb, energy, costReduction, onPlay,
}: {
  card: BattleCard; cardDb: Record<string, CardDef>;
  energy: number; costReduction: number; onPlay: () => void;
}) {
  const def = cardDb[card.defId];
  const cost = Math.max(0, card.cost - costReduction);
  const canAfford = energy >= cost;
  const hpPct   = Math.max(0, Math.min(100, (card.currentHp / card.maxHp) * 100));
  const hpColor = hpPct > 60 ? "#44ff88" : hpPct > 30 ? "#ffcc00" : "#ff4444";

  return (
    <motion.div
      onClick={canAfford ? onPlay : undefined}
      whileHover={canAfford ? { y: -14, scale: 1.1 } : { y: -2, opacity: 0.7 }}
      whileTap={canAfford ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      style={{ position: "relative", cursor: canAfford ? "pointer" : "not-allowed", userSelect: "none", flexShrink: 0 }}
    >
      <CharacterCard defId={card.defId} def={def} size="sm" dimmed={!canAfford} hideInfo
        costOverride={cost}
        statsOverlay={{ name: def?.name, atk: card.atk, hp: card.currentHp, maxHp: card.maxHp }}
      />

    </motion.div>
  );
}

// ── SpellCardView — synergy-granted spell shown in spell panel ───────────────
function SpellCardView({
  spell, active, onClick,
}: {
  spell: SpellCard; active?: boolean; onClick?: () => void;
}) {
  const effKind = spell.effect.kind;
  const needsTarget = effKind === "DAMAGE_TARGET" || effKind === "STUN_ONE" || effKind === "PURPLE" || effKind === "SHEEPIFY_ONE" || effKind === "DAMAGE_AND_STUN";
  const needsOwnTarget = effKind === "BUFF_ONE_HP" || effKind === "BUFF_ONE_ATK" || effKind === "BUFF_ONE_BOTH";
  const color = effKind === "DAMAGE_TARGET" ? "#ff6644"
    : effKind === "DAMAGE_ALL"      ? "#ff4466"
    : effKind === "DAMAGE_AND_STUN" ? "#cc88ff"
    : effKind === "BUFF_ONE_BOTH"   ? "#66ffcc"
    : effKind === "BUFF_BOARD_ATK" ? "#ffcc00"
    : effKind === "BUFF_BOARD_HP"  ? "#44ff88"
    : effKind === "BUFF_ONE_ATK"   ? "#ffaa44"
    : effKind === "BUFF_ONE_HP"    ? "#44ffaa"
    : effKind === "DRAW"           ? "#4488ff"
    : effKind === "GAIN_ENERGY"    ? "#4aeecc"
    : effKind === "PURPLE"         ? "#bb44ff"
    : effKind === "SHEEPIFY_ONE"   ? "#88ff88"
    : effKind === "DESTROY_ONE"    ? "#ff44aa"
    : effKind === "COPY_BOARD_CARD"     ? "#44ddff"
    : effKind === "DAMAGE_TARGET_SELF"  ? "#ff6600"
    : "#cc44ff";
  const icon = effKind === "DAMAGE_TARGET" ? "💥" : effKind === "DAMAGE_ALL" ? "☄" : effKind === "DAMAGE_AND_STUN" ? "🌀" : effKind === "BUFF_ONE_BOTH" ? "✨" : effKind === "BUFF_BOARD_ATK" ? "⚔" : effKind === "BUFF_BOARD_HP" ? "💚" : effKind === "BUFF_ONE_ATK" ? "🗡" : effKind === "BUFF_ONE_HP" ? "💉" : effKind === "DRAW" ? "🃏" : effKind === "GAIN_ENERGY" ? "⚡" : effKind === "PURPLE" ? "🌌" : effKind === "DESTROY_ONE" ? "🗑" : effKind === "COPY_BOARD_CARD" ? "📋" : effKind === "DAMAGE_TARGET_SELF" ? "⚡" : effKind === "SHEEPIFY_ONE" ? "🐑" : "❄";

  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { y: -12, scale: 1.06 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      animate={active ? { boxShadow: [`0 0 0 2px ${color}, 0 0 18px ${color}88`, `0 0 0 2px ${color}, 0 0 32px ${color}cc`] } : {}}
      transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatType: "reverse" }}
      style={{
        width: 116, borderRadius: 12, padding: "14px 12px",
        background: `linear-gradient(180deg, ${color}22, rgba(4,4,12,0.97))`,
        border: `1px solid ${color}66`,
        cursor: onClick ? "pointer" : "default",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
        userSelect: "none", flexShrink: 0,
        boxShadow: `0 6px 20px rgba(0,0,0,0.7), 0 0 14px ${color}28`,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: 0.5, textAlign: "center", lineHeight: 1.3 }}>
        {spell.name}
      </div>
      <div style={{ fontSize: 10, color: `${color}cc`, textAlign: "center", lineHeight: 1.5 }}>
        {spell.description}
      </div>
      {needsTarget && onClick && (
        <div style={{ fontSize: 9, color: "#ffcc00", letterSpacing: 1, fontWeight: 900, marginTop: 2 }}>▶ TARGET</div>
      )}
      {needsOwnTarget && onClick && (
        <div style={{ fontSize: 9, color: "#88ffcc", letterSpacing: 1, fontWeight: 900, marginTop: 2 }}>▶ PICK CARD</div>
      )}
    </motion.div>
  );
}

// ── CenteredLeader — the leader shown at top or bottom of board ───────────────
function CenteredLeader({
  leader, cardDb, playerName, playerIcon,
  selected, targetable,
  energy, maxEnergy, domainMeter, showDomainBtn,
  onSelect, onDomainActivate,
  isTop, domainBadgeDefId, isVacant, isHit,
}: {
  leader: BattleCard; cardDb: Record<string, CardDef>;
  playerName: string; playerIcon: string;
  selected?: boolean; targetable?: boolean;
  energy?: number; maxEnergy?: number;
  domainMeter?: number; showDomainBtn?: boolean;
  onSelect?: () => void; onDomainActivate?: () => void;
  isTop: boolean; domainBadgeDefId?: string; isVacant?: boolean; isHit?: boolean;
}) {
  const def = cardDb[leader.defId];
  const hpPct   = Math.max(0, Math.min(100, (leader.currentHp / leader.maxHp) * 100));
  const hpColor = hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffcc00" : "#ff4444";
  const meterFull = (domainMeter ?? 0) >= 100;
  const isActivePlayer = energy !== undefined;

  return (
    <div style={{
      display: "flex",
      flexDirection: isTop ? "column" : "column-reverse",
      alignItems: "center",
      gap: 6,
      padding: isTop ? "8px 0 4px" : "4px 0 8px",
    }}>
      {/* Name + icon row (always above card for isTop, always below for bottom player) */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
          <PlayerIcon icon={playerIcon} size={22} style={{ display: "block" }} />
        </div>
        <span style={{ fontSize: 10, color: "#778", letterSpacing: 1, fontWeight: 600 }}>{playerName}</span>
        {/* Stats shown inline with name only for bottom player; top player gets them below the card */}
        {!isTop && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "2px 8px",
            border: `1px solid ${hpColor}44`,
          }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#ff8855" }}>⚔{leader.atk}</span>
            <span style={{ fontSize: 10, color: "#334" }}>·</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}/{leader.maxHp}</span>
          </div>
        )}
        {leader.stunTurns > 0 && (
          <div style={{ background: "#4488ff", borderRadius: 4, fontSize: 8, fontWeight: 900, padding: "1px 6px", color: "#fff" }}>
            STUN
          </div>
        )}
      </div>

      {/* Leader card + rings (+ right-side stats for top player) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Energy/Domain panel — only for active player, shown to the left of their leader */}
        {isActivePlayer && !isTop && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 110 }}>
            {/* Energy header */}
            <div style={{ fontSize: 9, color: "#4aeecc", fontWeight: 800, letterSpacing: 1 }}>
              ⚡ ENERGY {energy}/{maxEnergy}
            </div>

            {/* Crystal grid — always 10 slots; filled = available, empty = spent, locked = not yet unlocked */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
              {Array.from({ length: 10 }).map((_, i) => {
                const unlocked = i < (maxEnergy ?? 0);
                const filled   = i < (energy ?? 0);
                return (
                  <motion.div
                    key={i}
                    animate={filled ? { boxShadow: ["0 0 4px #4aeecc66", "0 0 10px #4aeecc", "0 0 4px #4aeecc66"] } : {}}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.07 }}
                    style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: filled
                        ? "linear-gradient(135deg, #2af 0%, #4aeecc 100%)"
                        : unlocked
                        ? "#111820"
                        : "#07070e",
                      border: `1px solid ${filled ? "#4aeecc" : unlocked ? "#1e2e38" : "#111116"}`,
                      opacity: unlocked ? 1 : 0.35,
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                  />
                );
              })}
            </div>

            {/* Domain meter */}
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 7, color: meterFull ? "#cc44ff" : "#2a2a3a", letterSpacing: 1 }}>DOMAIN</span>
                <span style={{ fontSize: 7, color: meterFull ? "#cc44ff" : "#2a2a3a" }}>{domainMeter ?? 0}%</span>
              </div>
              <div style={{ height: 7, background: "#090912", borderRadius: 4, overflow: "hidden", border: "1px solid #1a1a2e" }}>
                <motion.div
                  animate={{ width: `${domainMeter ?? 0}%` }} transition={{ duration: 0.4 }}
                  style={{
                    height: "100%",
                    background: meterFull
                      ? "linear-gradient(90deg, #cc44ff, #ff44cc)"
                      : "linear-gradient(90deg, #3a1070, #5a1eaa)",
                    borderRadius: 4,
                    boxShadow: meterFull ? "0 0 8px #cc44ffaa" : "none",
                  }}
                />
              </div>
              {showDomainBtn && meterFull && (
                <motion.button
                  onClick={onDomainActivate}
                  animate={{ boxShadow: ["0 0 10px #cc44ff77", "0 0 22px #cc44ffbb", "0 0 10px #cc44ff77"] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{
                    width: "100%", marginTop: 5,
                    background: "linear-gradient(135deg, #3a0066, #7700bb)",
                    border: "2px solid #cc44ff", borderRadius: 8,
                    color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: 2,
                    padding: "5px 0", cursor: "pointer", fontFamily: "inherit",
                  }}
                >✦ DOMAIN</motion.button>
              )}
            </div>
          </div>
        )}

        {/* The leader card itself (or vacant slot) */}
        {isVacant ? (
          <div style={{
            width: 92, height: 130, borderRadius: 8,
            border: "2px dashed #331144", background: "rgba(20,0,40,0.5)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <div style={{ fontSize: 18, opacity: 0.4 }}>⚔</div>
            <div style={{ fontSize: 7, color: "#553377", fontWeight: 900, letterSpacing: 1, textAlign: "center" }}>VACANT<br/>ON BOARD</div>
          </div>
        ) : (
        <motion.div
          onClick={onSelect}
          animate={isHit ? { scale: [1, 1.06, 0.97, 1], filter: ["brightness(1)", "brightness(2.4)", "brightness(1)"] } : { scale: 1 }}
          transition={isHit ? { duration: 0.28, times: [0, 0.2, 0.65, 1] } : { type: "spring", stiffness: 400, damping: 22 }}
          whileHover={onSelect ? { scale: 1.07, y: isTop ? 4 : -4 } : undefined}
          whileTap={onSelect ? { scale: 0.96 } : undefined}
          style={{ position: "relative", cursor: onSelect ? "pointer" : "default", userSelect: "none" }}
        >
          <CharacterCard defId={leader.defId} def={def} size="sm" hideAffinityAndCost />

          {/* Hit flash overlay */}
          <AnimatePresence>
            {isHit && (
              <motion.div key="leader-hit"
                initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.32 }}
                style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 26, mixBlendMode: "screen",
                  background: "radial-gradient(circle at 50% 40%, rgba(255,60,0,0.95), rgba(255,0,0,0.55))" }} />
            )}
          </AnimatePresence>

          {/* LEADER badge */}
          <div style={{
            position: "absolute", top: 4, left: 4,
            fontSize: 7, fontWeight: 900, letterSpacing: 1,
            background: "rgba(255,200,0,0.88)", color: "#000",
            padding: "1px 6px", borderRadius: 3,
          }}>LEADER</div>

          {/* HP bar at bottom of card */}
          <div style={{ position: "absolute", bottom: 2, left: 4, right: 4, height: 4, background: "#111", borderRadius: 2 }}>
            <motion.div
              animate={{ width: `${hpPct}%` }} transition={{ duration: 0.35 }}
              style={{ height: "100%", background: hpColor, borderRadius: 2 }}
            />
          </div>


          {/* Target ring */}
          {targetable && !selected && (
            <motion.div
              animate={{ boxShadow: ["0 0 0 3px #ff4444, 0 0 16px #ff444477", "0 0 0 3px #ff6666, 0 0 26px #ff4444aa"] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none" }}
            />
          )}
        </motion.div>
        )}{/* end isVacant conditional */}

        {/* Stats + domain badge to the RIGHT of card — only for top player */}
        {isTop && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            {!isVacant ? (
              <div style={{
                display: "flex", flexDirection: "column", gap: 4,
                background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "8px 12px",
                border: `1px solid ${hpColor}55`,
              }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#ff8855" }}>⚔ {leader.atk}</span>
                <div style={{ width: "100%", height: 1, background: "#222" }} />
                <span style={{ fontSize: 15, fontWeight: 900, color: hpColor }}>♥ {leader.currentHp}<span style={{ fontSize: 10, color: "#556", fontWeight: 600 }}>/{leader.maxHp}</span></span>
              </div>
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", gap: 4,
                background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "8px 12px",
                border: "1px solid #33334455",
              }}>
                <span style={{ fontSize: 11, color: "#444", fontWeight: 700, letterSpacing: 1 }}>ON BOARD</span>
              </div>
            )}
            {domainBadgeDefId && <DomainBadge defId={domainBadgeDefId} />}
          </div>
        )}

        {/* Spacer to balance the energy panel on the other side */}
        {isActivePlayer && !isTop && <div style={{ width: 110 }} />}
      </div>
    </div>
  );
}

// ── LeaderRightPanel — player's leader shown as a right-column panel ──────────
function LeaderRightPanel({
  leader, cardDb, playerName, playerIcon,
  selected, isVacant, isHit,
  domainMeter, domainCooldown, onDomainActivate,
  onSelect,
}: {
  leader: BattleCard; cardDb: Record<string, CardDef>;
  playerName: string; playerIcon: string;
  selected?: boolean; isVacant?: boolean; isHit?: boolean;
  domainMeter?: number; domainCooldown?: number; onDomainActivate?: () => void;
  onSelect: (ev?: React.MouseEvent) => void;
}) {
  const def = cardDb[leader.defId];
  const hpPct   = Math.max(0, Math.min(100, (leader.currentHp / leader.maxHp) * 100));
  const hpColor = hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffcc00" : "#ff4444";
  const meterFull = (domainMeter ?? 0) >= 100;

  return (
    <div style={{
      width: 252, flexShrink: 0,
      background: "rgba(4,4,16,0.88)", borderLeft: "1px solid #111128",
      display: "flex", flexDirection: "row", alignItems: "stretch",
      justifyContent: "center",
    }}>
      {/* Domain column on the left */}
      {domainMeter !== undefined && (
        <div style={{
          width: 77, flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6,
          padding: "10px 5px", borderRight: "1px solid #111128",
        }}>
          <DomainBadge defId={leader.defId} />
          {/* Vertical meter bar */}
          <div style={{ width: 12, height: 72, background: "#111", borderRadius: 5, overflow: "hidden", position: "relative" }}>
            <motion.div
              animate={{ height: `${domainMeter}%` }}
              transition={{ duration: 0.4 }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: meterFull ? "#c88fff" : "#4455aa", borderRadius: 5 }}
            />
          </div>
          {meterFull && domainCooldown === 0 && (
            <motion.button
              onClick={onDomainActivate}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
              style={{
                fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                background: "linear-gradient(135deg,#7733cc,#c88fff)",
                border: "none", borderRadius: 5, color: "#fff",
                padding: "4px 6px", cursor: "pointer", textAlign: "center",
              }}
            >Activate</motion.button>
          )}
          {meterFull && (domainCooldown ?? 0) > 0 && (
            <div style={{ fontSize: 8, color: "#c88fff", textAlign: "center", fontWeight: 700 }}>
              CD:{domainCooldown}T
            </div>
          )}
        </div>
      )}

      {/* Card + info column */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 12px", gap: 8, justifyContent: "center",
      }}>
      {/* Player name + icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
        <div style={{ borderRadius: 5, overflow: "hidden", border: "1px solid #333", flexShrink: 0 }}>
          <PlayerIcon icon={playerIcon} size={26} style={{ display: "block" }} />
        </div>
        <span style={{ fontSize: 11, color: "#778", letterSpacing: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playerName}</span>
      </div>

      {/* Leader card (or vacant slot when on board) */}
      {isVacant ? (
        <div style={{
          width: 130, height: 175, borderRadius: 8,
          border: "2px dashed #331144", background: "rgba(20,0,40,0.5)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          <div style={{ fontSize: 22, opacity: 0.4 }}>⚔</div>
          <div style={{ fontSize: 8, color: "#553377", fontWeight: 900, letterSpacing: 1, textAlign: "center" }}>VACANT<br/>ON BOARD</div>
        </div>
      ) : (
      <motion.div
        onClick={onSelect}
        animate={isHit ? { scale: [1, 1.06, 0.97, 1], filter: ["brightness(1)", "brightness(2.4)", "brightness(1)"] } : { scale: 1 }}
        transition={isHit ? { duration: 0.28, times: [0, 0.2, 0.65, 1] } : { type: "spring", stiffness: 400, damping: 22 }}
        whileHover={{ scale: 1.06, y: -4 }}
        whileTap={{ scale: 0.96 }}
        style={{ position: "relative", cursor: "pointer", userSelect: "none" }}
      >
        <CharacterCard defId={leader.defId} def={def} size="lg" hideAffinityAndCost />

        {/* Hit flash overlay */}
        <AnimatePresence>
          {isHit && (
            <motion.div key="panel-leader-hit"
              initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.32 }}
              style={{ position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none", zIndex: 26, mixBlendMode: "screen",
                background: "radial-gradient(circle at 50% 40%, rgba(255,60,0,0.95), rgba(255,0,0,0.55))" }} />
          )}
        </AnimatePresence>

        <div style={{
          position: "absolute", top: 5, left: 5,
          fontSize: 8, fontWeight: 900, letterSpacing: 1,
          background: "rgba(255,200,0,0.88)", color: "#000",
          padding: "1px 7px", borderRadius: 3,
        }}>LEADER</div>
        {/* HP bar */}
        <div style={{ position: "absolute", bottom: 3, left: 5, right: 5, height: 5, background: "#111", borderRadius: 2 }}>
          <motion.div animate={{ width: `${hpPct}%` }} transition={{ duration: 0.35 }}
            style={{ height: "100%", background: hpColor, borderRadius: 2 }} />
        </div>
        {leader.stunTurns > 0 && (
          <div style={{ position: "absolute", top: 5, right: 5, background: "#4488ff", borderRadius: 3, fontSize: 8, fontWeight: 900, padding: "1px 5px", color: "#fff" }}>STUN</div>
        )}
      </motion.div>
      )}

      {/* Stats row (only when not vacant) */}
      {!isVacant && (
      <div style={{
        display: "flex", gap: 8, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "5px 12px",
        border: `1px solid ${hpColor}33`, width: "100%", justifyContent: "center",
      }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: "#ff8855" }}>⚔{leader.atk}</span>
        <span style={{ fontSize: 15, color: "#334" }}>·</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}/{leader.maxHp}</span>
      </div>
      )}
      </div>{/* end card+info column */}
    </div>
  );
}

// ── Board row (5 slots) ───────────────────────────────────────────────────────
function BoardRow({
  board, cardDb, pendingId, targeting, myBoard, cardScale = 1,
  buffTargeting = false,
  isTargetable,
  onActivatePerk, perkActiveId, pinnedIds, lungeIds,
  onSelectCard, onTargetCard,
  hitIds, freshIds, floatingDmgMap,
}: {
  board: (BattleCard | null)[];
  cardDb: Record<string, CardDef>;
  pendingId: string | null; targeting: boolean; myBoard: boolean;
  buffTargeting?: boolean;
  isTargetable?: (card: BattleCard) => boolean;
  cardScale?: number;
  onActivatePerk?: (card: BattleCard) => void;
  perkActiveId?: string | null;
  pinnedIds?: Set<string>;
  lungeIds?: Set<string>;
  onSelectCard?: (id: string, ev: React.MouseEvent) => void; onTargetCard?: (id: string) => void;
  hitIds?: Set<string>; freshIds?: Set<string>;
  floatingDmgMap?: Record<string, { key: number; amount: number }[]>;
}) {
  const slotW = Math.round(72 * cardScale);
  const slotH = Math.round(103 * cardScale);
  return (
    <div style={{
      display: "flex", gap: Math.round(10 * cardScale), justifyContent: "center", alignItems: "center",
      flex: 1, minHeight: slotH + 10, padding: "0 8px",
    }}>
      {board.map((card, i) => (
        <div key={i} style={{ width: slotW, height: slotH, flexShrink: 0, position: "relative" }}>
          <AnimatePresence>
            {card && (
              /* Outer motion.div handles entrance/exit — no CSS transform here so framer owns it */
              <motion.div
                key={card.instanceId}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.45, filter: "brightness(3.5) saturate(0)", transition: { duration: 0.2, ease: "easeOut" } }}
                transition={{ type: "spring", stiffness: 480, damping: 30 }}
                style={{ position: "absolute", top: 0, left: 0, width: slotW, height: slotH, transformOrigin: "top left" }}
              >
                {/* Inner div applies the cardScale independently of framer animation */}
                <div style={{ transform: `scale(${cardScale})`, transformOrigin: "top left", width: 72, height: 103 }}>
                  <BoardCardView
                    card={card} cardDb={cardDb}
                    selected={pendingId === card.instanceId}
                    targetable={targeting && !myBoard && (isTargetable ? isTargetable(card) : true)}
                    friendlyTarget={buffTargeting === true && myBoard}
                    isHit={hitIds?.has(card.instanceId)}
                    isFresh={freshIds?.has(card.instanceId)}
                    floatingDmgs={floatingDmgMap?.[card.instanceId]}
                    isPinned={pinnedIds?.has(card.instanceId)}
                    isLunging={lungeIds?.has(card.instanceId)}
                    lungeDir={myBoard ? "up" : "down"}
                    onClick={(ev) => {
                      if (myBoard && onSelectCard) onSelectCard(card.instanceId, ev!);
                      else if (!myBoard && onTargetCard) onTargetCard(card.instanceId);
                    }}
                  />
                </div>
                {/* Perk activation button — centered right under the card */}
                {myBoard && onActivatePerk && CARD_PERKS[card.defId] && !card.perkUsed && (
                  <div style={{
                    position: "absolute", top: slotH + 2, left: 0, width: slotW,
                    display: "flex", justifyContent: "center", zIndex: 30,
                  }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={(e) => { e.stopPropagation(); onActivatePerk(card); }}
                      style={{
                        padding: "2px 8px", borderRadius: 6,
                        background: perkActiveId === card.instanceId
                          ? "linear-gradient(135deg, #ffcc44, #cc8800)"
                          : "linear-gradient(135deg, rgba(90,60,0,0.9), rgba(40,26,0,0.9))",
                        border: `1px solid ${perkActiveId === card.instanceId ? "#ffe088" : "#ffcc4466"}`,
                        color: perkActiveId === card.instanceId ? "#000" : "#ffcc44",
                        fontSize: 8, fontWeight: 900, letterSpacing: 1,
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 0 8px rgba(255,190,40,0.3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {CARD_PERKS[card.defId].icon} PERK
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {!card && (
            <div style={{
              width: slotW, height: slotH,
              border: `1px dashed ${myBoard ? "#1a2a1a" : "#1a1a2a"}`,
              borderRadius: Math.round(10 * cardScale), background: "rgba(255,255,255,0.005)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── BoardParticles ────────────────────────────────────────────────────────────
function BoardParticles() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            x: [0, (i % 2 === 0 ? 1 : -1) * 20],
            y: ["100%", "-10%"],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 4 + i * 0.7,
            repeat: Infinity,
            delay: i * 0.8,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            left: `${10 + i * 15}%`,
            width: 3, height: 3, borderRadius: "50%",
            background: `hsl(${260 + i * 20},80%,70%)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Handoff overlay ───────────────────────────────────────────────────────────
function HandoffOverlay({ name, icon, onReady }: { name: string; icon: string; onReady: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(2,2,10,0.97)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
      >
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#334" }}>TURN END</div>
        <motion.div
          animate={{ boxShadow: ["0 0 24px #ffcc0033", "0 0 48px #ffcc0077", "0 0 24px #ffcc0033"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ borderRadius: "50%", overflow: "hidden", border: "3px solid #ffcc0055" }}
        >
          <PlayerIcon icon={icon} size={80} style={{ display: "block" }} />
        </motion.div>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>PASS TO</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: "#ffcc00", letterSpacing: 2 }}>{name}</div>
        <div style={{ fontSize: 9, color: "#334", letterSpacing: 4 }}>COVER YOUR SCREEN, THEN CONTINUE</div>
      </motion.div>
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={onReady}
        style={{
          padding: "14px 52px",
          background: "linear-gradient(135deg, #1a1a3a, #2a1a4a)",
          border: "2px solid #4a4a7a", borderRadius: 12,
          color: "#aaa", fontSize: 13, fontWeight: 900, letterSpacing: 4,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >I'M READY →</motion.button>
    </motion.div>
  );
}

// ── Domain flash ──────────────────────────────────────────────────────────────
function DomainFlash({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.2, times: [0, 0.08, 0.85, 1] }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "radial-gradient(ellipse at center, #6600cc55 0%, transparent 70%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 1] }}
        transition={{ duration: 0.5, ease: "backOut" }}
        style={{ textAlign: "center" }}
      >
        <div style={{ fontSize: 10, letterSpacing: 8, color: "#cc44ff", marginBottom: 10 }}>DOMAIN EXPANSION</div>
        <div style={{
          fontSize: 42, fontWeight: 900, letterSpacing: 3, color: "#fff",
          textShadow: "0 0 40px #cc44ffcc, 0 0 80px #8800aa88",
        }}>{name}</div>
      </motion.div>
    </motion.div>
  );
}

// ── Game over overlay ─────────────────────────────────────────────────────────
function GameOverOverlay({ winnerName, winnerIcon, onDone }: {
  winnerName: string; winnerIcon: string; onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(2,2,10,0.95)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28,
      }}
    >
      <motion.div
        initial={{ scale: 0.6, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
      >
        <div style={{ fontSize: 11, letterSpacing: 8, color: "#444" }}>BATTLE OVER</div>
        <motion.div
          animate={{ boxShadow: ["0 0 24px #ffcc0044", "0 0 56px #ffcc0099", "0 0 24px #ffcc0044"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ borderRadius: "50%", overflow: "hidden", border: "3px solid #ffcc0088" }}
        >
          <PlayerIcon icon={winnerIcon} size={88} style={{ display: "block" }} />
        </motion.div>
        <div style={{
          fontSize: 52, fontWeight: 900, color: "#ffcc00", letterSpacing: 3,
          textShadow: "0 0 40px #ffcc0077",
        }}>{winnerName}</div>
        <div style={{ fontSize: 14, letterSpacing: 8, color: "#888" }}>WINS</div>
      </motion.div>
      <motion.button
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={onDone}
        style={{
          padding: "14px 52px",
          background: "linear-gradient(135deg, #2a1a00, #4a3000)",
          border: "2px solid #ffcc0077", borderRadius: 12,
          color: "#ffcc00", fontSize: 13, fontWeight: 900, letterSpacing: 4,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >CONTINUE</motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function BattleBoardScreen({
  p1Draft, p2Draft, cardDb,
  p1Name, p2Name, p1Icon, p2Icon,
  onGameOver,
}: Props) {
  // Mulligan phase: players swap cards before battle starts
  type MulliganStep = "P1" | "P2" | "BATTLE";
  type MulliganSubPhase = "SELECT" | "REPLACED";
  const [mulliganStep, setMulliganStep] = useState<MulliganStep>("P1");
  const [mulliganSubPhase, setMulliganSubPhase] = useState<MulliganSubPhase>("SELECT");
  const [mulliganReturning, setMulliganReturning] = useState<Set<string>>(new Set());
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
  const [goSecondSpellHover, setGoSecondSpellHover] = useState<{ x: number; y: number } | null>(null);

  const [initialState] = useState(() => createBattleState(p1Draft, p2Draft, cardDb));
  const [engine] = useState(() => createBattleEngine(initialState));
  const [battleState, setBattleState] = useState<BattleState>(() => engine.getState());
  const [domainFlash, setDomainFlash] = useState<string | null>(null);
  const [gameOverShown, setGameOverShown] = useState(false);
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null); // spell awaiting enemy target
  const [buffOneTargeting, setBuffOneTargeting] = useState<string | null>(null); // spell id for BUFF_ONE (own-card target)
  const [turnBackTargeting, setTurnBackTargeting] = useState(false);
  const [pendingShieldGrant, setPendingShieldGrant] = useState(false);
  // Perk activation flow — Mahito needs two targets (enemy first, then same-cost friendly)
  const [pendingPerk, setPendingPerk] = useState<{ instanceId: string; defId: string; enemyTargetId?: string } | null>(null);
  const [drewCardId, setDrewCardId] = useState<string | null>(null); // card drawn this turn (for animation)
  const [attackLineStart, setAttackLineStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Visual effect states ──────────────────────────────────────────────────
  const [hitIds, setHitIds] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [floatingDmgMap, setFloatingDmgMap] = useState<Record<string, { key: number; amount: number }[]>>({});
  const [leaderHitPid, setLeaderHitPid] = useState<PlayerId | null>(null);
  const [lungeIds, setLungeIds] = useState<Set<string>>(new Set());
  const [spellFlash, setSpellFlash] = useState<{ key: number; name: string } | null>(null);
  const [turnBanner, setTurnBanner] = useState<{ key: number; pid: PlayerId } | null>(null);
  const shakeControls = useAnimationControls();
  const dmgKeyRef = useRef(0);

  const doReplace = (pid: PlayerId) => {
    if (mulliganReturning.size === 0) return;
    const drawn: string[] = [];
    setBattleState(prev => {
      const p = { ...prev.players[pid] };
      const going  = p.hand.filter(c =>  mulliganReturning.has(c.instanceId));
      const kept   = p.hand.filter(c => !mulliganReturning.has(c.instanceId));
      // Draw from existing deck FIRST so returned cards cannot come back immediately
      const newCards = p.deck.slice(0, going.length);
      newCards.forEach(c => drawn.push(c.instanceId));
      // Returned cards go to the back of the remaining deck
      const rest = [...p.deck.slice(going.length), ...shuffle(going)];
      return { ...prev, players: { ...prev.players, [pid]: { ...p, hand: [...kept, ...newCards], deck: rest } } };
    });
    setNewCardIds(new Set(drawn));
    setMulliganReturning(new Set());
    setMulliganSubPhase("REPLACED");
  };

  const keepHand = (pid: PlayerId) => {
    setMulliganSubPhase("SELECT");
    setMulliganReturning(new Set());
    setNewCardIds(new Set());
    setMulliganStep(pid === "P1" ? "P2" : "BATTLE");
  };

  const dispatch = useCallback((intent: BattleIntent) => {
    // Spell splash — capture the spell's name before the engine consumes it
    if (intent.type === "CAST_SPELL") {
      const sp = engine.getState().players[intent.pid].spells.find(s => s.id === intent.spellId);
      if (sp) {
        const key = ++dmgKeyRef.current;
        setSpellFlash({ key, name: sp.name });
        setTimeout(() => setSpellFlash(prev => prev?.key === key ? null : prev), 950);
      }
    }
    const result = engine.apply(intent);
    setBattleState(result.state);
    for (const ev of result.events) {
      if (ev.type === "DOMAIN_ACTIVATED") setDomainFlash(ev.name);
      if (ev.type === "TURN_START" && ev.drew) { setDrewCardId(ev.drew); setTimeout(() => setDrewCardId(null), 700); }
      if (ev.type === "GAME_OVER") { setGameOverShown(true); return; }

      if (ev.type === "ATTACK_CARD") {
        const addHit = (id: string) => {
          setHitIds(p => new Set([...p, id]));
          setTimeout(() => setHitIds(p => { const n = new Set(p); n.delete(id); return n; }), 380);
        };
        const addDmg = (id: string, amount: number) => {
          const key = ++dmgKeyRef.current;
          setFloatingDmgMap(p => ({ ...p, [id]: [...(p[id] ?? []), { key, amount }] }));
          setTimeout(() => setFloatingDmgMap(p => ({ ...p, [id]: (p[id] ?? []).filter(d => d.key !== key) })), 750);
        };
        // Attacker lunges toward the target before the impact lands
        setLungeIds(p => new Set([...p, ev.attackerId]));
        setTimeout(() => setLungeIds(p => { const n = new Set(p); n.delete(ev.attackerId); return n; }), 380);
        addHit(ev.targetId);
        addDmg(ev.targetId, ev.damage);
        if (ev.counterDamage > 0) { addHit(ev.attackerId); addDmg(ev.attackerId, ev.counterDamage); }
      }

      if (ev.type === "ATTACK_LEADER") {
        const hitPid: PlayerId = ev.attackerPid === "P1" ? "P2" : "P1";
        setLeaderHitPid(hitPid);
        setTimeout(() => setLeaderHitPid(null), 480);
        // Attacker lunge + screen shake scaled to the blow
        setLungeIds(p => new Set([...p, ev.attackerId]));
        setTimeout(() => setLungeIds(p => { const n = new Set(p); n.delete(ev.attackerId); return n; }), 380);
        const mag = Math.min(14, 5 + ev.damage);
        shakeControls.start({
          x: [0, -mag, mag, -mag * 0.6, mag * 0.6, -mag * 0.25, 0],
          transition: { duration: 0.45, ease: "easeOut" },
        });
      }

      if (ev.type === "TURN_START") {
        const key = ++dmgKeyRef.current;
        setTurnBanner({ key, pid: ev.pid });
        setTimeout(() => setTurnBanner(prev => prev?.key === key ? null : prev), 1200);
      }

      if (ev.type === "CARD_PLAYED") {
        setFreshIds(p => new Set([...p, ev.instanceId]));
        setTimeout(() => setFreshIds(p => { const n = new Set(p); n.delete(ev.instanceId); return n; }), 600);
      }
    }
  }, [engine]);

  // Sync engine with post-mulligan React state when battle starts, then
  // advance past the DRAW phase so the first player draws their opening card.
  // doReplace() bypasses the engine, so we push the mulligan result in first.
  useEffect(() => {
    if (mulliganStep === "BATTLE") {
      engine.setState(battleState);
      if (battleState.phase === "DRAW") {
        dispatch({ type: "END_TURN", pid: battleState.activePlayer });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mulliganStep]);

  const handleEndTurn = () => {
    const pid = battleState.activePlayer;
    dispatch({ type: "END_TURN", pid });
  };

  const handlePlayCard = (instanceId: string) => {
    const pid = battleState.activePlayer;
    const slot = battleState.players[pid].board.findIndex(s => s === null);
    if (slot === -1) return;
    dispatch({ type: "PLAY_CARD", pid, instanceId, slot });
  };

  const handleSelectAttacker = (instanceId: string, ev?: React.MouseEvent) => {
    const pid = battleState.activePlayer;
    if (battleState.pendingAttackerId === instanceId) {
      dispatch({ type: "CANCEL_ATTACK", pid });
      setAttackLineStart(null);
    } else {
      dispatch({ type: "SELECT_ATTACKER", pid, instanceId });
      if (ev) {
        const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
        setAttackLineStart({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    }
  };

  // Track mouse for attack line
  useEffect(() => {
    if (!battleState.pendingAttackerId) { setAttackLineStart(null); return; }
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [battleState.pendingAttackerId]);

  const handleTargetCard   = (instanceId: string) => {
    const pid = battleState.activePlayer;
    if (!battleState.pendingAttackerId) return;
    dispatch({ type: "ATTACK_CARD", pid, targetInstanceId: instanceId });
  };

  const handleDomainTarget = (targetInstanceId: string) => {
    const pid = battleState.activePlayer;
    dispatch({ type: "DOMAIN_TARGET", pid, targetInstanceId });
  };

  const handleTargetLeader = () => {
    const pid = battleState.activePlayer;
    if (pendingSpellId) {
      dispatch({ type: "CAST_SPELL", pid, spellId: pendingSpellId, targetInstanceId: battleState.players[pid === "P1" ? "P2" : "P1"].leader.instanceId });
      setPendingSpellId(null);
      return;
    }
    if (battleState.pendingDomainAction?.kind === "SNEAK_ATTACK_DOMAIN") {
      handleDomainTarget(battleState.players[pid === "P1" ? "P2" : "P1"].leader.instanceId);
      return;
    }
    if (!battleState.pendingAttackerId) return;
    dispatch({ type: "ATTACK_LEADER", pid });
  };

  const handleSpellClick = (spell: SpellCard) => {
    const pid = battleState.activePlayer;
    const eff = spell.effect;
    if (eff.kind === "TURN_BACK_SHEEP") {
      setTurnBackTargeting(prev => !prev);
      return;
    }
    if (eff.kind === "BUFF_ONE_HP" || eff.kind === "BUFF_ONE_ATK" || eff.kind === "BUFF_ONE_BOTH") {
      // Needs own-board target
      dispatch({ type: "CANCEL_ATTACK", pid });
      setBuffOneTargeting(prev => prev === spell.id ? null : spell.id);
      return;
    }
    if (eff.kind === "DAMAGE_TARGET" || eff.kind === "STUN_ONE" || eff.kind === "PURPLE" || eff.kind === "DESTROY_ONE" || eff.kind === "COPY_BOARD_CARD" || eff.kind === "DAMAGE_TARGET_SELF" || eff.kind === "SHEEPIFY_ONE" || eff.kind === "DAMAGE_AND_STUN") {
      // Needs a target — enter spell targeting mode (deselect any attacker)
      dispatch({ type: "CANCEL_ATTACK", pid });
      setPendingSpellId(prev => prev === spell.id ? null : spell.id);
    } else {
      // No target needed — cast immediately
      dispatch({ type: "CAST_SPELL", pid, spellId: spell.id });
    }
  };

  const handleSpellTargetCard = (instanceId: string) => {
    const pid = battleState.activePlayer;
    if (!pendingSpellId) return;
    dispatch({ type: "CAST_SPELL", pid, spellId: pendingSpellId, targetInstanceId: instanceId });
    setPendingSpellId(null);
  };

  // ── Starting hand phase ─────────────────────────────────────────────────────
  if (mulliganStep !== "BATTLE") {
    const mPid    = mulliganStep as "P1" | "P2";
    const mPlayer = battleState.players[mPid];
    const mName   = mPid === "P1" ? p1Name : p2Name;
    const mIcon   = mPid === "P1" ? p1Icon : p2Icon;
    const mColor  = mPid === "P1" ? "#4a9eff" : "#ff6666";
    const isReplaced = mulliganSubPhase === "REPLACED";
    // Who goes first? — activePlayer is the coin-flip winner (always first in DRAW phase at start)
    const goesFirst = battleState.activePlayer === mPid;

    return (
      <div style={{
        minHeight: "100vh", background: "#04040a",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 28, padding: 32, fontFamily: "'Segoe UI', system-ui, sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, #0a0a1a, #04040a)", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          {/* Player header */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: `2px solid ${mColor}66` }}>
                <img src={`/players/${mIcon}.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontSize: 14, color: mColor, letterSpacing: 3, fontWeight: 700 }}>{mName}</span>
            </div>

            {isReplaced ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "#fff", marginBottom: 6 }}>
                  YOUR NEW HAND
                </div>
                <div style={{ fontSize: 10, color: "#fff", letterSpacing: 2 }}>
                  Cards highlighted in green were drawn as replacements
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "#fff", marginBottom: 6 }}>
                  YOUR STARTING HAND
                </div>
                <div style={{ fontSize: 10, color: "#fff", letterSpacing: 2 }}>
                  Select cards to send back and draw fresh replacements from your deck
                </div>
              </>
            )}
          </div>

          {/* Cards */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {mPlayer.hand.map(card => {
              const def = cardDb[card.defId];
              const returning  = !isReplaced && mulliganReturning.has(card.instanceId);
              const isNew      = isReplaced && newCardIds.has(card.instanceId);
              return (
                <motion.div key={card.instanceId}
                  initial={isNew ? { scale: 0.7, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={isNew ? { type: "spring", stiffness: 300, damping: 20 } : {}}
                  onClick={() => {
                    if (isReplaced) return;
                    setMulliganReturning(prev => {
                      const next = new Set(prev);
                      if (next.has(card.instanceId)) next.delete(card.instanceId);
                      else next.add(card.instanceId);
                      return next;
                    });
                  }}
                  whileHover={!isReplaced ? { y: -10, scale: 1.06 } : undefined}
                  whileTap={!isReplaced ? { scale: 0.97 } : undefined}
                  style={{ cursor: isReplaced ? "default" : "pointer", position: "relative" }}
                >
                  {def && (
                    <div style={{ position: "relative" }}>
                      <CharacterCard defId={card.defId} def={def} size="md" />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.92) 30%)",
                        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
                        padding: "18px 6px 6px",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#e8e8e8", letterSpacing: 0.3, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", paddingLeft: 4, paddingRight: 4 }}>
                          {def.name}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-around", width: "100%", padding: "1px 6px" }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#ff8855" }}>⚔{card.atk}</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#44ff88" }}>♥{card.currentHp}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selected-to-return overlay */}
                  {returning && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: 12,
                      border: "2px solid #ff4444",
                      background: "rgba(255,40,40,0.22)",
                      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                      padding: 6, pointerEvents: "none",
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: "#ff4444", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: "#fff", fontWeight: 900,
                      }}>↩</div>
                    </div>
                  )}

                </motion.div>
              );
            })}
          </div>

          {/* Status text */}
          <div style={{ fontSize: 10, color: "#667", letterSpacing: 2, textAlign: "center" }}>
            {isReplaced
              ? `${newCardIds.size} card${newCardIds.size !== 1 ? "s" : ""} replaced`
              : mulliganReturning.size > 0
                ? `${mulliganReturning.size} card${mulliganReturning.size > 1 ? "s" : ""} selected to return`
                : "Click cards to select them for replacement"}
          </div>

          {/* Leader preview — mirrors how it looks in-game */}
          <div style={{
            width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8, padding: "16px 0 0",
            borderTop: "1px solid #101024",
          }}>
            <div style={{ fontSize: 8, color: "#334", letterSpacing: 3 }}>YOUR LEADER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              {/* Energy + Domain panel */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 160 }}>
                <div style={{ fontSize: 13, color: "#4aeecc", fontWeight: 900, letterSpacing: 1 }}>
                  ⚡ ENERGY 2/2
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={i < 2 ? { boxShadow: ["0 0 4px #4aeecc66", "0 0 10px #4aeecc", "0 0 4px #4aeecc66"] } : {}}
                      transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.07 }}
                      style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: i < 2 ? "linear-gradient(135deg, #2af 0%, #4aeecc 100%)" : i < 10 ? "#07070e" : "#07070e",
                        border: `1px solid ${i < 2 ? "#4aeecc" : "#111116"}`,
                        opacity: i < 10 ? (i < 2 ? 1 : 0.35) : 0.35,
                      }}
                    />
                  ))}
                </div>
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#2a2a3a", letterSpacing: 1, fontWeight: 700 }}>DOMAIN</span>
                    <span style={{ fontSize: 11, color: "#2a2a3a" }}>0%</span>
                  </div>
                  <div style={{ height: 12, background: "#090912", borderRadius: 6, border: "1px solid #1a1a2e" }} />
                </div>
              </div>
              {/* Leader card */}
              <div style={{ position: "relative" }}>
                {cardDb[mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId] && (
                  <CharacterCard
                    defId={mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId}
                    def={cardDb[mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId]}
                    size="lg" noHover
                  />
                )}
                <div style={{
                  position: "absolute", top: 6, left: 6,
                  fontSize: 9, fontWeight: 900, letterSpacing: 1,
                  background: "rgba(255,200,0,0.88)", color: "#000",
                  padding: "2px 8px", borderRadius: 4,
                }}>LEADER</div>
                <div style={{
                  position: "absolute", bottom: 28, left: 0, right: 0,
                  display: "flex", justifyContent: "space-around", padding: "3px 6px",
                  background: "rgba(0,0,0,0.82)",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#ff8855" }}>⚔2</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#44ff88" }}>♥30/30</span>
                </div>
              </div>

              {/* FIRST / SECOND indicator — right of leader card */}
              {(() => {
                const goSecondSpell = mPlayer.spells.find(s => s.synergyId === "go-second");
                return (
                  <motion.div
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                    style={{
                      width: 160, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 14,
                      padding: "18px 16px", borderRadius: 14,
                      background: goesFirst ? "rgba(74,238,204,0.07)" : "rgba(204,68,255,0.07)",
                      border: `1.5px solid ${goesFirst ? "#4aeecc44" : "#cc44ff44"}`,
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: 9, letterSpacing: 3, fontWeight: 700, marginBottom: 8,
                        color: goesFirst ? "#4aeecc88" : "#cc44ff88",
                      }}>YOU GO</div>
                      <div style={{
                        fontSize: 28, fontWeight: 900, letterSpacing: 3,
                        color: goesFirst ? "#4aeecc" : "#cc44ff",
                        textShadow: `0 0 20px ${goesFirst ? "#4aeecc66" : "#cc44ff66"}`,
                      }}>
                        {goesFirst ? "FIRST" : "SECOND"}
                      </div>
                    </div>

                    {goesFirst ? (
                      <div style={{ fontSize: 10, color: "#4aeecc66", textAlign: "center", lineHeight: 1.4 }}>
                        You take the first turn
                      </div>
                    ) : goSecondSpell ? (
                      <>
                        <div
                          onMouseMove={ev => setGoSecondSpellHover({ x: ev.clientX, y: ev.clientY })}
                          onMouseLeave={() => setGoSecondSpellHover(null)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "5px 12px", borderRadius: 8, cursor: "default",
                            background: "rgba(204,68,255,0.15)",
                            border: "1px solid #cc44ff66",
                            fontSize: 11, fontWeight: 700, color: "#cc44ff",
                            letterSpacing: 0.5,
                          }}
                        >✦ {goSecondSpell.name}</div>
                        {goSecondSpellHover && (
                          <HoverTooltip x={goSecondSpellHover.x} y={goSecondSpellHover.y}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: "#cc44ff", letterSpacing: 2, marginBottom: 6 }}>✦ BONUS SPELL</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{goSecondSpell.name}</div>
                            <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{goSecondSpell.description}</div>
                          </HoverTooltip>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: "#cc44ff66", textAlign: "center", lineHeight: 1.4 }}>
                        + bonus spell on start
                      </div>
                    )}
                  </motion.div>
                );
              })()}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            {!isReplaced && (
              <motion.button
                whileHover={mulliganReturning.size > 0 ? { scale: 1.05, y: -2 } : {}}
                whileTap={mulliganReturning.size > 0 ? { scale: 0.97 } : {}}
                onClick={() => doReplace(mPid)}
                style={{
                  padding: "12px 36px",
                  background: mulliganReturning.size > 0
                    ? "linear-gradient(135deg, #994400, #ff6600)"
                    : "rgba(255,255,255,0.04)",
                  border: `2px solid ${mulliganReturning.size > 0 ? "#ff6600" : "#2a2a3a"}`,
                  borderRadius: 12,
                  color: mulliganReturning.size > 0 ? "#fff" : "#334",
                  fontSize: 12, fontWeight: 900, letterSpacing: 5,
                  cursor: mulliganReturning.size > 0 ? "pointer" : "default",
                  fontFamily: "inherit",
                  boxShadow: mulliganReturning.size > 0 ? "0 0 24px #ff660044" : "none",
                }}
              >REPLACE</motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={() => keepHand(mPid)}
              style={{
                padding: "12px 36px",
                background: `linear-gradient(135deg, ${mColor}aa, ${mColor})`,
                border: "none", borderRadius: 12,
                color: "#000", fontSize: 12, fontWeight: 900, letterSpacing: 5,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: `0 0 28px ${mColor}44`,
              }}
            >{isReplaced ? "NEXT →" : "KEEP HAND"}</motion.button>
          </div>
        </div>
      </div>
    );
  }

  if (!battleState || battleState.phase === "DRAW") {
    return (
      <div style={{ background: "#04040a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#445", letterSpacing: 4, fontSize: 12 }}>PREPARING BOARD…</div>
      </div>
    );
  }

  const pid    = battleState.activePlayer;
  const oppId: PlayerId = pid === "P1" ? "P2" : "P1";
  const player: BattlePlayer = battleState.players[pid];
  const opp:   BattlePlayer  = battleState.players[oppId];
  const name    = pid === "P1" ? p1Name : p2Name;
  const icon    = pid === "P1" ? p1Icon : p2Icon;
  const oppName = oppId === "P1" ? p1Name : p2Name;
  const oppIcon = oppId === "P1" ? p1Icon : p2Icon;
  // enemyTargeting highlights opponent cards; own-card buff targeting does NOT
  // Perk targeting stages: mahito = enemy→friendly; inumaki = 1 enemy; nobara = 2 enemies; gakuganji = 1 friendly
  const perkEnemyStage = pendingPerk !== null && (
    (pendingPerk.defId === "mahito" && !pendingPerk.enemyTargetId) ||
    pendingPerk.defId === "inumaki" ||
    pendingPerk.defId === "nobara"
  );
  const perkFriendStage = pendingPerk !== null && (
    (pendingPerk.defId === "mahito" && !!pendingPerk.enemyTargetId) ||
    pendingPerk.defId === "gakuganji"
  );
  const enemyTargeting = battleState.pendingAttackerId !== null || pendingSpellId !== null || battleState.pendingDomainAction !== null || perkEnemyStage;
  const targeting = enemyTargeting || buffOneTargeting !== null || pendingShieldGrant || perkFriendStage;

  // Leader is only a valid target in specific modes
  const oppBoardCards = opp.board.filter(c => c !== null);
  const pendingSpell  = pendingSpellId ? player.spells.find(s => s.id === pendingSpellId) ?? null : null;
  const oppHasShield = oppBoardCards.some(c => c.hasTaunt);
  const pendingAttackerCard = battleState.pendingAttackerId
    ? player.board.find(c => c?.instanceId === battleState.pendingAttackerId) ?? (player.leader.instanceId === battleState.pendingAttackerId ? player.leader : null)
    : null;
  const leaderTargetable =
    // Attack: when no enemy shields remain, or Toji berserk, or the attacker's Shield Breaker perk is active
    (battleState.pendingAttackerId !== null && (!oppHasShield || player.tojiBerserk || pendingAttackerCard?.ignoreShields === true)) ||
    // Damage spells hit the leader only when the enemy board is clear; stun spells can always target
    (pendingSpell !== null && (
      pendingSpell.effect.kind === "STUN_ONE" ||
      ((pendingSpell.effect.kind === "DAMAGE_TARGET" || pendingSpell.effect.kind === "DAMAGE_TARGET_SELF") && oppBoardCards.length === 0)
    )) ||
    // Domain action targets enemy (sheepify cannot target the leader)
    (battleState.pendingDomainAction !== null && battleState.pendingDomainAction.kind !== "SHEEPIFY_ENEMY_CARDS");

  const handleActivatePerk = (card: BattleCard) => {
    if (battleState.phase !== "MAIN") return;
    if (pendingPerk?.instanceId === card.instanceId) { setPendingPerk(null); return; } // toggle off
    // Perks that need target selection before dispatching
    if (["mahito", "inumaki", "gakuganji", "nobara"].includes(card.defId)) {
      setPendingPerk({ instanceId: card.instanceId, defId: card.defId });
      return;
    }
    dispatch({ type: "ACTIVATE_PERK", pid, instanceId: card.instanceId });
  };

  const handleOwnCardClick = (instanceId: string, ev?: React.MouseEvent) => {
    // Mahito perk stage 2: pick the same-cost friendly card
    if (pendingPerk?.defId === "mahito" && pendingPerk.enemyTargetId) {
      dispatch({
        type: "ACTIVATE_PERK", pid,
        instanceId: pendingPerk.instanceId,
        targetInstanceId: pendingPerk.enemyTargetId,
        friendlyTargetInstanceId: instanceId,
      });
      setPendingPerk(null);
      return;
    }
    // Gakuganji perk: pick the friendly card to buff
    if (pendingPerk?.defId === "gakuganji") {
      dispatch({
        type: "ACTIVATE_PERK", pid,
        instanceId: pendingPerk.instanceId,
        friendlyTargetInstanceId: instanceId,
      });
      setPendingPerk(null);
      return;
    }
    if (pendingShieldGrant) {
      dispatch({ type: "GRANT_BOARD_SHIELD", pid, targetInstanceId: instanceId });
      setPendingShieldGrant(false);
      return;
    }
    if (turnBackTargeting) {
      const spell = player.spells.find(s => s.effect.kind === "TURN_BACK_SHEEP");
      if (spell) {
        dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: spell.id, targetInstanceId: instanceId });
        setTurnBackTargeting(false);
      }
      return;
    }
    if (buffOneTargeting) {
      dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: buffOneTargeting, targetInstanceId: instanceId });
      setBuffOneTargeting(null);
      return;
    }
    // COPY_BOARD_CARD can target own board cards too
    if (pendingSpellId && pendingSpell?.effect.kind === "COPY_BOARD_CARD") {
      dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: pendingSpellId, targetInstanceId: instanceId });
      setPendingSpellId(null);
      return;
    }
    // Damage spells can now target own cards
    if (pendingSpellId && (pendingSpell?.effect.kind === "DAMAGE_TARGET" || pendingSpell?.effect.kind === "DAMAGE_TARGET_SELF")) {
      dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: pendingSpellId, targetInstanceId: instanceId });
      setPendingSpellId(null);
      return;
    }
    handleSelectAttacker(instanceId, ev);
  };

  const winnerName = battleState.winner ? (battleState.winner === "P1" ? p1Name : p2Name) : "";
  const winnerIcon = battleState.winner ? (battleState.winner === "P1" ? p1Icon : p2Icon) : "";

  return (
    <ErrorBoundary>
    {/* Static outer shell clips the shake so no scrollbars appear */}
    <div style={{
      minHeight: "100vh", maxHeight: "100vh",
      background: "linear-gradient(180deg, #020209 0%, #04021a 50%, #020209 100%)",
      overflow: "hidden", position: "relative",
    }}>
    <motion.div animate={shakeControls} style={{
      minHeight: "100vh", maxHeight: "100vh",
      display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden", position: "relative",
    }}>
      {/* Background image */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1920&q=80')",
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(6px) brightness(0.18) saturate(1.4)",
        transform: "scale(1.05)",
      }} />
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg,transparent,transparent 47px,#080818 48px)",
        opacity: 0.25,
      }} />

      {/* ── OPPONENT LEADER (top, centered) ──────────────────────────────── */}
      <div style={{
        background: "rgba(0,0,0,0.2)",
        position: "relative", zIndex: 1, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "visible",
      }}>
        <div style={{ transform: "scale(1.08)", transformOrigin: "center center" }}>
          <CenteredLeader
            leader={opp.leader} cardDb={cardDb}
            playerName={oppName} playerIcon={oppIcon}
            targetable={leaderTargetable}
            onSelect={leaderTargetable ? handleTargetLeader : undefined}
            isTop
            domainBadgeDefId={opp.leader.defId}
            isVacant={opp.sukunaBoardMode || opp.mahoragaBoardMode}
            isHit={leaderHitPid === oppId}
          />
        </div>
      </div>

      {/* ── OPPONENT BOARD ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", zIndex: 20,
        background: "rgba(0,0,0,0.1)",
        minHeight: 130,
      }}>
        <motion.div
          animate={{ opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, #6600aa22, transparent 70%)" }}
        />
        <BoardParticles />
        <div style={{ position: "absolute", top: 4, left: 14, fontSize: 8, letterSpacing: 4, color: "#1a1a2a", zIndex: 1, display: "flex", gap: 8, alignItems: "center" }}>
          OPPONENT
          {opp.turnFrozen > 0 && (
            <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ fontSize: 7, letterSpacing: 2, color: "#cc44ff", background: "rgba(204,68,255,0.12)", border: "1px solid #cc44ff44", borderRadius: 4, padding: "1px 5px" }}>
              🌌 VOID IMMOBILIZED {opp.turnFrozen}T
            </motion.div>
          )}
          {opp.cardPlayFrozen > 0 && opp.turnFrozen <= 0 && (
            <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ fontSize: 7, letterSpacing: 2, color: "#4488ff", background: "rgba(68,136,255,0.12)", border: "1px solid #4488ff44", borderRadius: 4, padding: "1px 5px" }}>
              ❄ FROZEN {opp.cardPlayFrozen}T
            </motion.div>
          )}
        </div>
        <BoardRow
          board={opp.board} cardDb={cardDb} cardScale={1.3}
          pendingId={null} targeting={enemyTargeting} myBoard={false}
          pinnedIds={player.resonance ? new Set([player.resonance.a, player.resonance.b]) : undefined}
          isTargetable={(c) =>
            // Attacks must respect shields; spells and domain actions can hit anything
            battleState.pendingAttackerId === null || player.tojiBerserk || !oppHasShield || c.hasTaunt
          }
          lungeIds={lungeIds}
          onTargetCard={(id) => {
            // Mahito perk stage 1: pick the enemy card
            if (perkEnemyStage && pendingPerk) {
              if (pendingPerk.defId === "inumaki") {
                dispatch({ type: "ACTIVATE_PERK", pid, instanceId: pendingPerk.instanceId, targetInstanceId: id });
                setPendingPerk(null);
              } else if (pendingPerk.defId === "nobara") {
                if (!pendingPerk.enemyTargetId) {
                  setPendingPerk({ ...pendingPerk, enemyTargetId: id });
                } else if (pendingPerk.enemyTargetId !== id) {
                  dispatch({ type: "ACTIVATE_PERK", pid, instanceId: pendingPerk.instanceId, targetInstanceId: pendingPerk.enemyTargetId, secondTargetInstanceId: id });
                  setPendingPerk(null);
                }
              } else {
                // Mahito stage 1
                setPendingPerk({ ...pendingPerk, enemyTargetId: id });
              }
              return;
            }
            if (pendingSpellId) handleSpellTargetCard(id);
            else if (battleState.pendingDomainAction) handleDomainTarget(id);
            else handleTargetCard(id);
          }}
          hitIds={hitIds} freshIds={freshIds} floatingDmgMap={floatingDmgMap}
        />
      </div>

      {/* ── CENTER INFO BAR ───────────────────────────────────────────────── */}
      <div style={{
        padding: "6px 24px", zIndex: 2,
        background: "rgba(0,0,0,0.7)",
        display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        borderTop: "1px solid #111128",
        flexShrink: 0,
      }}>
        {/* Left: turn counter only */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 8, color: "#2a2a3a", letterSpacing: 3 }}>TURN {battleState.turn}</div>
        </div>

        {/* Center: turn indicator + END TURN button side by side */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 2,
            color: pid === "P1" ? "#4a9eff" : "#ff6666",
            background: pid === "P1" ? "rgba(74,158,255,0.07)" : "rgba(255,102,102,0.07)",
            padding: "3px 12px", borderRadius: 6,
            border: `1px solid ${pid === "P1" ? "#4a9eff33" : "#ff666633"}`,
          }}>{name}'s TURN</div>
          <motion.button
            onClick={handleEndTurn}
            whileHover={{ scale: 1.05, boxShadow: "0 0 16px #44ff8844" }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: "7px 28px",
              background: "linear-gradient(135deg, #0a2a12, #0d3a16)",
              border: "1px solid #44ff8833",
              borderRadius: 8, color: "#44ff88", fontSize: 11, fontWeight: 900,
              letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
            }}
          >END TURN →</motion.button>
        </div>

        {/* Right: targeting / action badges */}
        <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "flex-end" }}>
          {pendingSpellId && (
            <div style={{
              fontSize: 7, padding: "2px 8px", borderRadius: 4,
              background: "rgba(204,68,255,0.12)", border: "1px solid #cc44ff66",
              color: "#cc44ff", letterSpacing: 1, fontWeight: 900,
            }}>✦ SELECT TARGET</div>
          )}
          {battleState.pendingDomainAction && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(204,68,255,0.15)", border: "1px solid #cc44ff88",
              color: "#cc44ff", letterSpacing: 1, fontWeight: 900,
            }}>
              {battleState.pendingDomainAction.kind === "CHOOSE_KILL_ENEMIES"
                ? `✦ SELECT ${battleState.pendingDomainAction.remaining} ENEMY CARD${battleState.pendingDomainAction.remaining > 1 ? "S" : ""} TO ELIMINATE`
                : battleState.pendingDomainAction.kind === "COPY_ENEMY_CARD"
                ? "✦ SELECT AN ENEMY CARD TO COPY"
                : battleState.pendingDomainAction.kind === "HEAL_AND_KILL_ONE"
                ? "✦ SELECT AN ENEMY CARD TO DESTROY"
                : "✦ SELECT ANY ENEMY TARGET"}
            </div>
          )}
          {turnBackTargeting && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(68,255,136,0.12)", border: "1px solid #44ff8866",
              color: "#44ff88", letterSpacing: 1, fontWeight: 900,
            }}>✦ SELECT A CARD TO RESTORE</div>
          )}
          {buffOneTargeting && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(74,158,255,0.12)", border: "1px solid #4a9eff66",
              color: "#4a9eff", letterSpacing: 1, fontWeight: 900,
            }}>✦ SELECT YOUR CARD TO BUFF</div>
          )}
          {pendingShieldGrant && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(68,136,255,0.14)", border: "1px solid #4488ff66",
              color: "#88bbff", letterSpacing: 1, fontWeight: 900,
            }}>🛡 SELECT YOUR CARD TO GIVE SHIELD</div>
          )}
          {perkEnemyStage && pendingPerk && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(255,190,40,0.14)", border: "1px solid #ffcc4466",
              color: "#ffcc44", letterSpacing: 1, fontWeight: 900,
            }}>
              {pendingPerk.defId === "mahito" ? "🖐 SELECT AN ENEMY CARD TO TRANSFIGURE"
                : pendingPerk.defId === "inumaki" ? "🗣 SELECT AN ENEMY CARD TO STUN"
                : pendingPerk.enemyTargetId ? "📌 SELECT THE SECOND ENEMY CARD TO PIN"
                : "📌 SELECT THE FIRST ENEMY CARD TO PIN"}
            </div>
          )}
          {perkFriendStage && pendingPerk && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(255,190,40,0.14)", border: "1px solid #ffcc4466",
              color: "#ffcc44", letterSpacing: 1, fontWeight: 900,
            }}>
              {pendingPerk.defId === "gakuganji" ? "🎸 SELECT YOUR CARD TO GIVE +1 ATK" : "🖐 SELECT YOUR CARD OF THE SAME COST"}
            </div>
          )}
        </div>

      </div>

      {/* ── MY BOARD + LEADER PANEL (row: board center, leader right) ───── */}
      <div style={{
        flex: 1.5, display: "flex", flexDirection: "row",
        position: "relative", zIndex: 20, minHeight: 200, overflow: "visible",
      }}>
        <motion.div
          animate={{ opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, #6600aa22, transparent 70%)" }}
        />
        <BoardParticles />
        {/* Board area */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ position: "absolute", top: 4, left: 14, fontSize: 8, letterSpacing: 4, color: "#1a1a2a", zIndex: 1 }}>YOUR BOARD</div>
          {player.activeSynergies.length > 0 && (() => {
            const obtainedSpellNames = new Set([
              ...player.spells.map(s => s.name),
              ...player.spellQueue.map(s => s.name),
            ]);
            const visibleSynergies = player.activeSynergies.filter(id => {
              const rule = BATTLE_SYNERGY_RULES.find(r => r.id === id);
              return rule && !obtainedSpellNames.has(rule.spellName);
            });
            return visibleSynergies.length > 0 ? (
              <div style={{
                position: "absolute", top: 18, left: 14, zIndex: 2,
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                {visibleSynergies.map(id => <SynergyTag key={id} id={id} />)}
              </div>
            ) : null;
          })()}
          <div style={{ marginLeft: 250, transform: "scale(1.2)", transformOrigin: "center center" }}>
            <BoardRow
              board={player.board} cardDb={cardDb} cardScale={1.5}
              pendingId={battleState.pendingAttackerId}
              targeting={pendingSpellId !== null && (pendingSpell?.effect.kind === "DAMAGE_TARGET" || pendingSpell?.effect.kind === "DAMAGE_TARGET_SELF")}
              buffTargeting={buffOneTargeting !== null || perkFriendStage} myBoard
              pinnedIds={opp.resonance ? new Set([opp.resonance.a, opp.resonance.b]) : undefined}
              onActivatePerk={handleActivatePerk}
              perkActiveId={pendingPerk?.instanceId ?? null}
              lungeIds={lungeIds}
              onSelectCard={handleOwnCardClick}
              hitIds={hitIds} freshIds={freshIds} floatingDmgMap={floatingDmgMap}
            />
          </div>
        </div>
        {/* Leader panel (right) — domain meter is now built-in on the left of the panel */}
        <div style={{ marginRight: 40 }}>
          <LeaderRightPanel
            isHit={leaderHitPid === pid}
            leader={player.leader} cardDb={cardDb}
            playerName={name} playerIcon={icon}
            isVacant={player.mahoragaBoardMode || player.sukunaBoardMode}
            selected={!player.mahoragaBoardMode && !player.sukunaBoardMode && battleState.pendingAttackerId === player.leader.instanceId}
            domainMeter={player.domainMeter}
            domainCooldown={player.domainCooldown}
            onDomainActivate={() => dispatch({ type: "ACTIVATE_DOMAIN", pid })}
            onSelect={(ev) => {
              if (buffOneTargeting) {
                dispatch({ type: "CAST_SPELL", pid, spellId: buffOneTargeting, targetInstanceId: player.leader.instanceId });
                setBuffOneTargeting(null);
                return;
              }
              if (pendingSpellId && (pendingSpell?.effect.kind === "DAMAGE_TARGET" || pendingSpell?.effect.kind === "DAMAGE_TARGET_SELF")) {
                dispatch({ type: "CAST_SPELL", pid, spellId: pendingSpellId, targetInstanceId: player.leader.instanceId });
                setPendingSpellId(null);
                return;
              }
              handleSelectAttacker(player.leader.instanceId, ev);
            }}
          />
        </div>
      </div>

      {/* ── HAND + SPELLS + DECK (bottom row) ───────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: "flex", flexDirection: "row",
        background: "rgba(0,0,0,0.35)", borderTop: "1px solid #0c0c1e",
        position: "relative", zIndex: 30, height: 185, overflow: "visible",
      }}>
        {/* Spells panel — absolutely positioned, fixed height matching hand row */}
        <div style={{
          position: "absolute", left: 0, bottom: 0, zIndex: 40,
          display: "flex", flexDirection: "row",
          background: "rgba(0,0,0,0.35)", borderTop: "1px solid #1a1a30",
        }}>
        {/* Spells grid */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "10px 12px", borderRight: "1px solid #1a1a30", gap: 8,
        }}>
          {/* Shield charges */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {Array.from({ length: 3 }).map((_, i) => {
              const available = i < player.shieldCharges;
              const isActive = pendingShieldGrant && available;
              return (
                <div key={i} style={{ position: "relative" }}
                  onMouseEnter={e => {
                    const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".shield-tip");
                    if (tip) tip.style.display = "block";
                  }}
                  onMouseLeave={e => {
                    const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".shield-tip");
                    if (tip) tip.style.display = "none";
                  }}
                >
                  <motion.button
                    onClick={() => { if (available && battleState.phase === "MAIN") setPendingShieldGrant(v => !v); }}
                    whileHover={available && battleState.phase === "MAIN" ? { scale: 1.15 } : {}}
                    whileTap={available && battleState.phase === "MAIN" ? { scale: 0.9 } : {}}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: available
                        ? isActive
                          ? "linear-gradient(135deg, #4488ff, #0044cc)"
                          : "linear-gradient(135deg, #1a3a6e, #0a1a4a)"
                        : "rgba(255,255,255,0.03)",
                      border: available
                        ? `2px solid ${isActive ? "#88bbff" : "rgba(100,180,255,0.6)"}`
                        : "2px solid #1a1a2a",
                      cursor: available && battleState.phase === "MAIN" ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14,
                      opacity: available ? 1 : 0.2,
                      boxShadow: isActive ? "0 0 14px #4488ffaa" : available ? "0 0 6px rgba(80,160,255,0.3)" : "none",
                      padding: 0,
                    }}
                  >
                    🛡
                  </motion.button>
                  <div className="shield-tip" style={{
                    display: "none", position: "absolute", bottom: 34, left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(4,4,14,0.97)", border: "1px solid #2a3a6a",
                    borderRadius: 8, padding: "7px 10px",
                    width: 180, zIndex: 999,
                    fontSize: 9, color: "#aac", lineHeight: 1.5, pointerEvents: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
                  }}>
                    Give Shield to a character. (Shield disallows targeting of other non-Shield Cards.)
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 9, color: "#556", letterSpacing: 3, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            SPELLS
            {player.spellQueue.length > 0 && (
              <span style={{
                color: "#ee66ff", fontWeight: 900, fontSize: 11,
                background: "rgba(180,50,255,0.15)", border: "1px solid #cc44ff55",
                borderRadius: 5, padding: "1px 8px", letterSpacing: 1,
              }}>+{player.spellQueue.length} QUEUED</span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const spell = player.spells[i];
              if (spell) {
                return (
                  <SpellCardView
                    key={spell.id}
                    spell={spell}
                    active={pendingSpellId === spell.id || buffOneTargeting === spell.id}
                    onClick={() => handleSpellClick(spell)}
                  />
                );
              }
              return (
                <div key={`empty-${i}`} style={{
                  borderRadius: 10, padding: "14px 10px",
                  background: "rgba(255,255,255,0.01)",
                  border: "1px dashed #1a1a2a",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 6, minHeight: 110, minWidth: 110,
                }}>
                  <div style={{ fontSize: 22, color: "#1a1a2a" }}>✦</div>
                  <div style={{ fontSize: 8, color: "#1a1a2a", letterSpacing: 1 }}>EMPTY</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GET SPELL button */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 10px", borderRight: "1px solid #1a1a30", gap: 6, minWidth: 80,
        }}>
          {(() => {
            const canDraw = player.spellPool.length > 0;
            // Gojo's domain lifts the once-per-turn limit this turn
            const disabled = !canDraw || (player.synergyDrawUsed && !player.unlimitedSpellDraw) || player.energy < 1;
            return (
              <motion.button
                whileHover={!disabled ? { scale: 1.07, y: -3, boxShadow: "0 0 22px #cc44ff88" } : {}}
                whileTap={!disabled ? { scale: 0.94 } : {}}
                onClick={() => { if (!disabled) dispatch({ type: "DRAW_SYNERGY_SPELL", pid }); }}
                disabled={disabled}
                style={{
                  width: 64, padding: "10px 6px", borderRadius: 12,
                  cursor: disabled ? "not-allowed" : "pointer",
                  background: disabled
                    ? "rgba(255,255,255,0.02)"
                    : "linear-gradient(160deg, rgba(180,60,255,0.18), rgba(100,20,180,0.14))",
                  border: `2px solid ${disabled ? "#1a1a30" : "#cc44ff88"}`,
                  color: disabled ? "#334" : "#cc44ff",
                  fontSize: 8, fontWeight: 900, letterSpacing: 1, fontFamily: "inherit",
                  opacity: disabled ? 0.3 : 1,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  boxShadow: !disabled ? "0 0 18px #cc44ff33" : "none",
                  transition: "opacity 0.2s",
                }}
              >
                <span style={{ fontSize: 16 }}>✦</span>
                <span style={{ lineHeight: 1.2, textAlign: "center" }}>GET<br/>SPELL</span>
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  color: disabled ? "#334" : "#4aeecc",
                  background: disabled ? "transparent" : "rgba(74,238,204,0.1)",
                  border: disabled ? "none" : "1px solid #4aeecc44",
                  borderRadius: 6, padding: "1px 5px",
                }}>1⚡</span>
                {player.synergyDrawUsed && (
                  <span style={{ fontSize: 6, color: "#556", letterSpacing: 0.5 }}>USED</span>
                )}
                {!player.synergyDrawUsed && (
                  <span style={{ fontSize: 6, color: canDraw ? "#666" : "#334", letterSpacing: 0.5 }}>
                    {player.spellPool.length} LEFT
                  </span>
                )}
              </motion.button>
            );
          })()}
        </div>

        </div>{/* close absolute spell+getspell wrapper */}

        {/* Spacer matching the absolute spell panel width so energy/hand/deck don't overlap */}
        <div style={{ flexShrink: 0, width: 370 }} />

        {/* Energy column — compact vertical strip between GET SPELL and hand cards */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 12px", borderRight: "1px solid #1a1a30",
          gap: 7, minWidth: 70,
        }}>
          <span style={{ fontSize: 14, color: "#4aeecc", fontWeight: 900, letterSpacing: 1, textAlign: "center" }}>
            ⚡ {player.energy}/{player.maxEnergy}
          </span>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const unlocked = i < player.maxEnergy;
              const filled   = i < player.energy;
              return (
                <motion.div key={i}
                  animate={filled ? { boxShadow: ["0 0 6px #4aeecc88", "0 0 16px #4aeecc", "0 0 6px #4aeecc88"] } : {}}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.06 }}
                  style={{
                    width: 20, height: 20, borderRadius: 5,
                    background: filled ? "linear-gradient(135deg, #1adfff 0%, #4aeecc 100%)" : unlocked ? "#111820" : "#07070e",
                    border: `1px solid ${filled ? "#4aeecc" : unlocked ? "#1e2e38" : "#111116"}`,
                    opacity: unlocked ? 1 : 0.35,
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Hand cards */}
        <div style={{ flex: 1, display: "flex", overflow: "visible", position: "relative", zIndex: 10 }}>
          <div style={{
            flex: 1, display: "flex", gap: 22, justifyContent: "center", alignItems: "center",
            padding: "8px 20px 8px", overflow: "visible", marginLeft: -300,
          }}>
            {player.hand.map(card => {
              const isDrawn = drewCardId === card.instanceId;
              return (
                <motion.div
                  key={card.instanceId}
                  initial={isDrawn ? { y: 60, opacity: 0 } : false}
                  animate={{ y: 0, opacity: 1 }}
                  transition={isDrawn ? { type: "spring", stiffness: 380, damping: 22 } : {}}
                  style={{ flexShrink: 0, position: "relative", zIndex: 10 }}
                >
                  <div style={{ transform: "scale(1.25)", transformOrigin: "bottom center" }}>
                    <HandCardView
                      card={card} cardDb={cardDb}
                      energy={player.energy} costReduction={player.costReduction}
                      onPlay={() => handlePlayCard(card.instanceId)}
                    />
                  </div>
                </motion.div>
              );
            })}
            {player.hand.length === 0 && (
              <div style={{ color: "#2a2a38", fontSize: 10, letterSpacing: 3, paddingBottom: 8, paddingTop: 8, alignSelf: "center" }}>
                NO CARDS IN HAND
              </div>
            )}
          </div>
        </div>

        {/* Deck (right column) */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 16px", borderLeft: "1px solid #1a1a30", gap: 5, minWidth: 80,
        }}>
          <div style={{ position: "relative", width: 52, height: 72 }}>
            {[4, 3, 2, 1, 0].map(offset => (
              <div key={offset} style={{
                position: "absolute",
                top: -offset * 2.2, left: offset * 0.8,
                width: 52, height: 72, borderRadius: 7,
                background: offset === 0 ? "rgba(20,20,60,0.96)" : "rgba(10,10,30,0.8)",
                border: `1px solid ${offset === 0 ? "#3a3a7a" : "#1e1e3a"}`,
                display: offset === 0 ? "flex" : "block",
                alignItems: "center", justifyContent: "center",
                fontSize: 22, color: "#446",
                boxShadow: offset === 0 ? "0 4px 18px rgba(0,0,0,0.7)" : "none",
              }}>
                {offset === 0 ? "🃏" : null}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#667", letterSpacing: 1, marginTop: 2 }}>
            {player.deck.length}
          </div>
          <div style={{ fontSize: 8, color: "#334", letterSpacing: 3 }}>DECK</div>
        </div>
      </div>

      {/* ── Attack line SVG overlay ──────────────────────────────────────── */}
      {attackLineStart && battleState.pendingAttackerId && (
        <svg style={{
          position: "fixed", inset: 0, width: "100vw", height: "100vh",
          pointerEvents: "none", zIndex: 8000,
        }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#ff2222" />
            </marker>
          </defs>
          <line
            x1={attackLineStart.x} y1={attackLineStart.y}
            x2={mousePos.x} y2={mousePos.y}
            stroke="#ff2222" strokeWidth="2.5" strokeDasharray="8 5"
            markerEnd="url(#arrowhead)"
            style={{ filter: "drop-shadow(0 0 6px #ff2222aa)" }}
          />
          <circle cx={attackLineStart.x} cy={attackLineStart.y} r="5" fill="#ff2222" opacity="0.8" />
        </svg>
      )}

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {domainFlash && (
          <DomainFlash key="domain" name={domainFlash} onDone={() => setDomainFlash(null)} />
        )}
      </AnimatePresence>

      {/* Spell cast splash — name sweeps up from the center, Hearthstone style */}
      <AnimatePresence>
        {spellFlash && (
          <motion.div
            key={`spell-${spellFlash.key}`}
            initial={{ opacity: 0, scale: 0.6, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.15, y: -26, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            style={{
              position: "fixed", top: "38%", left: 0, right: 0,
              display: "flex", justifyContent: "center",
              pointerEvents: "none", zIndex: 90,
            }}
          >
            <div style={{
              padding: "10px 34px", borderRadius: 14,
              background: "radial-gradient(ellipse at 50% 50%, rgba(90,20,140,0.92), rgba(30,5,60,0.95))",
              border: "1px solid #cc66ff88",
              boxShadow: "0 0 50px #aa44ff66, 0 0 18px #cc66ff44, inset 0 0 24px #7722cc55",
              fontSize: 17, fontWeight: 900, letterSpacing: 4, color: "#eeccff",
              textShadow: "0 0 16px #cc66ff",
            }}>
              ✦ {spellFlash.name.toUpperCase()} ✦
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn banner — sweeps across at every turn change */}
      <AnimatePresence>
        {turnBanner && (
          <motion.div
            key={`turn-${turnBanner.key}`}
            initial={{ opacity: 0, scaleX: 0.1 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            style={{
              position: "fixed", top: "46%", left: 0, right: 0,
              pointerEvents: "none", zIndex: 89,
              display: "flex", justifyContent: "center",
            }}
          >
            <div style={{
              width: "100%",
              padding: "10px 0", textAlign: "center",
              background: turnBanner.pid === "P1"
                ? "linear-gradient(90deg, transparent, rgba(30,80,180,0.55) 30%, rgba(30,80,180,0.55) 70%, transparent)"
                : "linear-gradient(90deg, transparent, rgba(180,40,50,0.55) 30%, rgba(180,40,50,0.55) 70%, transparent)",
              borderTop: `1px solid ${turnBanner.pid === "P1" ? "#4a9eff66" : "#ff666666"}`,
              borderBottom: `1px solid ${turnBanner.pid === "P1" ? "#4a9eff66" : "#ff666666"}`,
              fontSize: 19, fontWeight: 900, letterSpacing: 8,
              color: turnBanner.pid === "P1" ? "#aaccff" : "#ffbbbb",
              textShadow: `0 0 20px ${turnBanner.pid === "P1" ? "#4a9eff" : "#ff5555"}`,
            }}>
              ⚔ {(turnBanner.pid === "P1" ? p1Name : p2Name).toUpperCase()}'S TURN ⚔
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gameOverShown && battleState.winner && (
          <GameOverOverlay key="gameover" winnerName={winnerName} winnerIcon={winnerIcon} onDone={() => onGameOver(battleState.winner!, battleState.turn)} />
        )}
      </AnimatePresence>
    </motion.div>
    </div>
    </ErrorBoundary>
  );
}
