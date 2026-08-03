import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import { rc, rg } from "../helpers";
import { deriveStats, CARD_PERKS } from "../battleEngine";
import "../card-effects.css";

// ─────────────────────────────────────────────────────────────────────────────
// CARD IMAGE SETTINGS
const CARD_EXT      = "PNG";
const CARD_BACK_EXT = "JPG";

const cardImageSrc     = (defId: string) => `/cards/${defId}.${CARD_EXT}`;
const cardBackImageSrc = ()              => `/cards/card-back.${CARD_BACK_EXT}`;

const _preload = new Image();
_preload.src = cardBackImageSrc();

export type CardSize = "xs" | "s" | "sm" | "md" | "mdl" | "lg" | "xl";

const DIMS: Record<CardSize, { w: number; h: number; nameFontSize: number; ptsFontSize: number; rarityFontSize: number }> = {
  xs:  { w: 72,  h: 102, nameFontSize: 9,  ptsFontSize: 9,  rarityFontSize: 8  },
  s:   { w: 92,  h: 130, nameFontSize: 9,  ptsFontSize: 9,  rarityFontSize: 8  },
  sm:  { w: 96,  h: 136, nameFontSize: 10, ptsFontSize: 10, rarityFontSize: 9  },
  md:  { w: 128, h: 182, nameFontSize: 12, ptsFontSize: 11, rarityFontSize: 10 },
  mdl: { w: 141, h: 200, nameFontSize: 12, ptsFontSize: 11, rarityFontSize: 10 },
  lg:  { w: 168, h: 238, nameFontSize: 14, ptsFontSize: 13, rarityFontSize: 11 },
  xl:  { w: 210, h: 294, nameFontSize: 16, ptsFontSize: 14, rarityFontSize: 12 },
};

const AFFINITY_ICON: Record<string, string> = {
  LEADER:  "👑",
  COMBAT:  "💥",
  SUPPORT: "✨",
};

// Rarity → idle overlay config
type RarityEffect = {
  color: string;
  animation: string;
  opacity: number;
  mixBlendMode?: React.CSSProperties["mixBlendMode"];
  shimmer?: boolean; // uses sweep instead of solid tint
};

const RARITY_EFFECT: Partial<Record<string, RarityEffect>> = {
  A: {
    color: "#cc44ff",
    animation: "aPulse 3.5s ease-in-out infinite",
    opacity: 0.08,
  },
  S: {
    color: "#ffd700",
    animation: "",      // S uses shimmer sweep, handled separately
    opacity: 0,
    shimmer: true,
  },
  SS: {
    color: "#ff66bb",
    animation: "ssBreathe 2.4s ease-in-out infinite",
    opacity: 0.10,
  },
  SSS: {
    color: "#00ff88",
    animation: "sssPulse 1.8s ease-in-out infinite",
    opacity: 0.14,
  },
  X: {
    color: "#ff2222",
    animation: "xFlicker 2.2s steps(1, end) infinite",
    opacity: 0.22,
  },
};

// ── Particle aura canvas ──────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 120, g: 80, b: 220 };
}

interface Spark { x: number; y: number; vx: number; vy: number; size: number; alpha: number; decay: number }

type AuraProfile = {
  maxParticles: number; spawnPer2: number;
  sizeMin: number; sizeDelta: number;
  alphaMin: number; alphaDelta: number;
  decayMin: number; decayDelta: number;
  vyMin: number; vyDelta: number;
  wobble: number;
  bottomBias: number;
  warmCore: number;
  secondColor?: [number,number,number];
  streak?: boolean;                        // draw as fast linear streaks instead of circles
};

const AURA_PROFILES: Partial<Record<string, AuraProfile>> = {
  // SS — fast electric, same style as SSS but pink
  SS: {
    maxParticles: 100, spawnPer2: 5,
    sizeMin: 0.6, sizeDelta: 2.8,
    alphaMin: 0.86, alphaDelta: 0.14,
    decayMin: 0.012, decayDelta: 0.015,
    vyMin: 2.8, vyDelta: 2.8,
    wobble: 0.04, bottomBias: 0.60,
    warmCore: 0.92,
  },
  // SSS — fast electric bolts shooting high, bright white core
  SSS: {
    maxParticles: 100, spawnPer2: 5,
    sizeMin: 0.6, sizeDelta: 2.8,
    alphaMin: 0.86, alphaDelta: 0.14,
    decayMin: 0.012, decayDelta: 0.015,
    vyMin: 2.8, vyDelta: 2.8,
    wobble: 0.04, bottomBias: 0.60,
    warmCore: 0.92,
  },
  // X — sharp comet-tail streaks, clean and fast
  X: {
    maxParticles: 44, spawnPer2: 3,
    sizeMin: 0.7, sizeDelta: 1.0,   // smaller, sharper
    alphaMin: 0.52, alphaDelta: 0.22, // less opaque
    decayMin: 0.016, decayDelta: 0.014, // faster fade = cleaner
    vyMin: 4.0, vyDelta: 3.0,
    wobble: 0.05, bottomBias: 0.72,
    warmCore: 0.80,
    secondColor: [255, 120, 0],
    streak: true,
  },
};

function CardAuraCanvas({ width, height, color, rarity, hovered }: {
  width: number; height: number; color: string; rarity: string; hovered: boolean;
}) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const sparksRef   = useRef<Spark[]>([]);
  const rafRef      = useRef(0);
  const tickRef     = useRef(0);
  const burstEndRef = useRef(0);   // ms timestamp when burst window ends
  const hoveredRef  = useRef(hovered);
  hoveredRef.current = hovered;
  const profile = AURA_PROFILES[rarity];
  const pad = 30;
  const cw  = width  + pad * 2;
  const ch  = height + pad * 2;
  const { r, g, b } = hexToRgb(color);

  React.useEffect(() => {
    if (hovered) burstEndRef.current = Date.now() + 300;
  }, [hovered]);

  React.useEffect(() => {
    if (!profile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = profile;

    const spawn = () => {
      const edge = Math.random();
      let x: number, y: number, vx: number, vy: number;
      if (edge < p.bottomBias) {
        x  = pad + Math.random() * width;
        y  = pad + height - 2;
        vx = (Math.random() - 0.5) * p.wobble * 8;
        vy = -(p.vyMin + Math.random() * p.vyDelta);
      } else if (edge < p.bottomBias + (1 - p.bottomBias) * 0.5) {
        x  = pad + 2 + Math.random() * 8;
        y  = pad + height * 0.25 + Math.random() * height * 0.75;
        vx = -(0.2 + Math.random() * 0.4);
        vy = -(p.vyMin * 0.7 + Math.random() * p.vyDelta * 0.7);
      } else {
        x  = pad + width - 2 - Math.random() * 8;
        y  = pad + height * 0.25 + Math.random() * height * 0.75;
        vx = (0.2 + Math.random() * 0.4);
        vy = -(p.vyMin * 0.7 + Math.random() * p.vyDelta * 0.7);
      }
      sparksRef.current.push({
        x, y, vx, vy,
        size:  p.sizeMin + Math.random() * p.sizeDelta,
        alpha: p.alphaMin + Math.random() * p.alphaDelta,
        decay: p.decayMin + Math.random() * p.decayDelta,
      });
    };

    const tick = () => {
      ctx.clearRect(0, 0, cw, ch);
      tickRef.current++;
      if (tickRef.current % 2 === 0) {
        const now = Date.now();
        const isBursting = now < burstEndRef.current;
        const isHov = hoveredRef.current;
        // Burst: 4× spawn; Normal hover: full spawn; Idle: tiny trickle (1/5)
        const spawnCount = isBursting ? p.spawnPer2 * 4 : isHov ? p.spawnPer2 : Math.ceil(p.spawnPer2 / 5);
        const cap = isBursting ? p.maxParticles * 2 : isHov ? p.maxParticles : Math.ceil(p.maxParticles / 4);
        for (let i = 0; i < spawnCount; i++) {
          if (sparksRef.current.length < cap) spawn();
        }
      }
      sparksRef.current = sparksRef.current.filter(s => s.alpha > 0.012);
      for (const s of sparksRef.current) {
        s.x    += s.vx;
        s.y    += s.vy;
        s.vx   += (Math.random() - 0.5) * p.wobble;
        s.vy   *= 0.986;
        s.alpha -= s.decay;

        const cr = Math.round(255 * p.warmCore + r * (1 - p.warmCore));
        const cg2 = Math.round(255 * p.warmCore + g * (1 - p.warmCore));
        const cb = Math.round(255 * p.warmCore + b * (1 - p.warmCore));

        if (p.streak) {
          // Draw as a comet-tail streak in the direction of travel
          const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
          const tailLen = s.size * 18 * (speed / 5);
          const nx = s.vx / speed, ny = s.vy / speed;
          const tailX = s.x - nx * tailLen, tailY = s.y - ny * tailLen;
          const lg = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
          lg.addColorStop(0, `rgba(${r},${g},${b},0)`);
          if (p.secondColor) {
            const [sr2, sg2, sb2] = p.secondColor;
            lg.addColorStop(0.55, `rgba(${sr2},${sg2},${sb2},${s.alpha * 0.55})`);
          }
          lg.addColorStop(0.82, `rgba(${cr},${cg2},${cb},${s.alpha * 0.9})`);
          lg.addColorStop(1, `rgba(255,255,255,${s.alpha})`);
          ctx.beginPath();
          ctx.strokeStyle = lg;
          ctx.lineWidth = s.size * 1.4;
          ctx.lineCap = "round";
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        } else {
          const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
          gr.addColorStop(0, `rgba(${cr},${cg2},${cb},${s.alpha})`);
          if (p.secondColor) {
            const [sr2, sg2, sb2] = p.secondColor;
            gr.addColorStop(0.4, `rgba(${sr2},${sg2},${sb2},${s.alpha * 0.8})`);
          }
          gr.addColorStop(p.secondColor ? 0.75 : 0.4, `rgba(${r},${g},${b},${s.alpha * 0.5})`);
          gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fillStyle = gr;
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); sparksRef.current = []; };
  }, [color, cw, ch]);

  if (!profile) return null;
  return (
    <canvas ref={canvasRef} width={cw} height={ch}
      style={{ position: "absolute", top: -pad, left: -pad, pointerEvents: "none", zIndex: 30 }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
interface CharacterCardProps {
  defId: string;
  def: CardDef | undefined;
  size?: CardSize;
  selected?: boolean;
  dimmed?: boolean;
  equippedBonus?: number;
  overlay?: string;
  /** Disable internal hover animation (use when parent handles hover/drag) */
  noHover?: boolean;
  /** When provided, show this number in the rarity badge slot instead of the rarity letter */
  costOverride?: number;
  /** When provided, override the visual rarity (border color, glow, aura) without changing the card def */
  rarityOverride?: string;
  /** Number of duplicate stars (0-based). 5+ triggers enhanced hover aura. */
  starLevel?: number;
  /** Hide the bottom info strip (name/affinity/cost) so a parent overlay can replace it */
  hideInfo?: boolean;
  /** Hide only the affinity + energy cost row, but keep the name */
  hideAffinityAndCost?: boolean;
  /** Shrink the rarity badge and affinity emoji (for scaled-up board cards) */
  smallBadges?: boolean;
  /** Show ATK/HP stats inside the card + cost badge on top-right (moves with card tilt) */
  showStats?: { atk: number; hp: number };
  /** Show an HP bar inside the card info strip */
  hpBar?: { current: number; max: number };
  /** Render name + ATK/HP + HP bar as an overlay inside the card (art stays full height) */
  statsOverlay?: { name?: string; atk: number; hp: number; maxHp: number };
  /** Gentle 3D tilt on hover even when noHover is set (used for board cards) */
  softTilt?: boolean;
  /** Duplicate stars from the profile collection — shown along the left border (3 per ascension) */
  dupeStars?: number;
  /** Kill stars from the profile collection — shown along the left border (3 per ✕ mark) */
  killStars?: number;
}

export default function CharacterCard({
  defId, def, size = "md", selected = false, dimmed = false,
  equippedBonus, overlay, noHover = false, costOverride, rarityOverride, starLevel = 0,
  hideInfo = false, hideAffinityAndCost = false, smallBadges = false, showStats, hpBar, statsOverlay,
  dupeStars = 0, killStars = 0, softTilt = false,
}: CharacterCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [sheenPos, setSheenPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  // Viewport-anchored tooltip positions (portaled to body so they never move with card tilt)
  const [perkTipPos, setPerkTipPos] = useState<{ x: number; y: number } | null>(null);
  const [shieldTipPos, setShieldTipPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Stable random phase offset so each card floats out-of-sync with neighbours
  const floatDelay = useRef(Math.random() * 3.2);

  // 3D tilt — firm spring, minimal wobble
  const rawRotX = useMotionValue(0);
  const rawRotY = useMotionValue(0);
  const rotX = useSpring(rawRotX, { stiffness: 500, damping: 40 });
  const rotY = useSpring(rawRotY, { stiffness: 500, damping: 40 });

  // Parallax offsets — badge/icon nearest viewer (+9 px swing); name/pts mid-depth (+4 px).
  const badgeX = useTransform(rotY, [-18, 18], [-9,  9]);
  const badgeY = useTransform(rotX, [-15, 15], [-8,  8]);
  const infoX  = useTransform(rotY, [-18, 18], [-4,  4]);
  const infoY  = useTransform(rotX, [-15, 15], [-3,  3]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top)  / rect.height;
    setSheenPos({ x: nx * 100, y: ny * 100 });
    if ((!noHover || softTilt) && !dimmed) {
      const ampY = noHover ? 7 : 16; // softTilt path is gentler
      const ampX = noHover ? 5 : 12;
      rawRotY.set((nx - 0.5) * ampY);
      rawRotX.set(-(ny - 0.5) * ampX);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    rawRotX.set(0);
    rawRotY.set(0);
  };

  const d = DIMS[size];
  const effectiveRarity = rarityOverride ?? def?.rarity;
  const color       = effectiveRarity ? rc(effectiveRarity) : "#333";
  const glowShadow  = effectiveRarity ? rg(effectiveRarity) : "none";
  const rarityEffect = effectiveRarity ? RARITY_EFFECT[effectiveRarity] : undefined;

  const borderColor = selected ? "#ffd700" : `${color}99`;
  const baseShadow  = selected
    ? `0 0 0 2px #ffd70066, 0 0 20px #ffd70033, ${glowShadow}`
    : glowShadow !== "none" ? glowShadow : `0 4px 14px #00000088`;

  const hoverShadow = selected
    ? `0 0 0 2px #ffd700aa, 0 0 36px #ffd70055, ${glowShadow}`
    : glowShadow !== "none"
      ? `0 -14px 38px ${color}55, 0 0 28px ${color}66, ${glowShadow}`
      : `0 -8px 24px rgba(0,0,0,0.7), 0 4px 18px #00000099`;

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        width: d.w, height: d.h,
        borderRadius: 10,
        boxShadow: baseShadow,
        position: "relative",
        flexShrink: 0,
        cursor: "inherit",
        transformPerspective: 700,
        willChange: "transform",
        rotateX: (!noHover || softTilt) && !dimmed ? rotX : undefined,
        rotateY: (!noHover || softTilt) && !dimmed ? rotY : undefined,
      }}
      animate={
        selected
          ? { y: -8, scale: 1.05 }
          : !noHover && !dimmed
            ? { y: [0, -3.5, 0], scale: 1 }
            : { y: 0, scale: 1 }
      }
      whileHover={!noHover && !dimmed ? {
        y: selected ? -8 : -6,
        scale: selected ? 1.05 : 1.03,
        boxShadow: hoverShadow,
        transition: { type: "spring", stiffness: 600, damping: 45 },
      } : undefined}
      transition={
        selected || noHover || dimmed
          ? { type: "spring", stiffness: 320, damping: 28 }
          : {
              y: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: floatDelay.current },
              scale: { type: "spring", stiffness: 320, damping: 28 },
            }
      }
    >
      {/* Particle aura — aura rarities always; any card with 5+ stars also gets aura */}
      {def && !dimmed && (AURA_PROFILES[effectiveRarity ?? ""] || starLevel >= 5) && (
        <CardAuraCanvas width={d.w} height={d.h} color={color} rarity={effectiveRarity && AURA_PROFILES[effectiveRarity] ? effectiveRarity : "SS"} hovered={isHovered} />
      )}

      {/* Backlight glow — persistent colored light emanating from behind the card on SS+ */}
      {def && !dimmed && ["SS","SSS","X"].includes(def.rarity) && (
        <motion.div
          animate={isHovered
            ? { opacity: [0.55, 0.85, 0.55], scale: [1, 1.06, 1] }
            : { opacity: [0.22, 0.38, 0.22], scale: 1 }}
          transition={{ duration: isHovered ? 0.9 : 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: -24,
            borderRadius: 28,
            background: `radial-gradient(ellipse at 50% 60%, ${color}55 0%, ${color}28 40%, transparent 70%)`,
            filter: `blur(${isHovered ? 14 : 10}px)`,
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
      )}

      {/* Inner clip — border, background, art, info, all overlays */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: 10,
        border: `2px solid ${borderColor}`,
        background: "#0a0a18",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>

      {/* ── Art area ── */}
      <div style={{ height: hideInfo ? "100%" : "80%", position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {!imgFailed ? (
          <img
            src={cardImageSrc(defId)}
            alt={def?.name ?? defId}
            draggable={false}
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(160deg, ${color}28 0%, #08081a 80%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: d.w * 0.38, fontWeight: 900, color, opacity: 0.18,
              userSelect: "none", lineHeight: 1,
            }}>
              {def?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}

        {/* Gradient fade */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "28%",
          background: "linear-gradient(transparent, #0a0a18ee)",
          pointerEvents: "none",
        }} />

        {/* SSS / X — diagonal shimmer sweep across the art itself */}
        {(def?.rarity === "SSS" || def?.rarity === "X") && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 4 }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, width: "55%",
              background: `linear-gradient(90deg, transparent, ${color}18, rgba(255,255,255,0.10), ${color}18, transparent)`,
              transform: "skewX(-14deg)",
              animation: `artShimmer ${def?.rarity === "X" ? "2.2" : "3.2"}s ease-in-out infinite`,
            }} />
          </div>
        )}

        {/* Cost bubble — pinned to top-left corner, outside the card clip */}

        {/* Affinity icon — same depth as badge */}
        {def?.affinity && (
          <motion.div style={{
            position: "absolute", top: 5, right: 5,
            fontSize: smallBadges ? 7 : d.rarityFontSize + 1,
            background: "#000000aa", borderRadius: 4, padding: smallBadges ? "1px 3px" : "2px 4px",
            backdropFilter: "blur(4px)",
            x: !noHover && !dimmed ? badgeX : 0,
            y: !noHover && !dimmed ? badgeY : 0,
            zIndex: 5,
          }}>
            {AFFINITY_ICON[def.affinity] ?? ""}
          </motion.div>
        )}

        {/* Top color strip */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: color, opacity: 0.8,
        }} />
      </div>

      {/* ── Info area — mid-depth layer ── */}
      <motion.div style={{
        flex: 1, padding: size === "xs" ? "2px 5px" : "4px 7px",
        display: hideInfo ? "none" : "flex", flexDirection: "column", justifyContent: "space-between",
        background: "linear-gradient(180deg, #0a0a18 0%, #070710 100%)",
        overflow: "hidden",
        x: !noHover && !dimmed ? infoX : 0,
        y: !noHover && !dimmed ? infoY : 0,
        position: "relative", zIndex: 4,
      }}>
        <div style={{
          fontSize: d.nameFontSize, fontWeight: "bold", color: "#e8e8e8",
          lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {def?.name ?? "Unknown"}
        </div>
        {showStats && (
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <span style={{ fontSize: d.ptsFontSize, fontWeight: 900, color: "#ff8855" }}>⚔{showStats.atk}</span>
            <span style={{ fontSize: d.ptsFontSize, fontWeight: 900, color: hpBar ? (hpBar.current / hpBar.max > 0.6 ? "#44ff88" : hpBar.current / hpBar.max > 0.3 ? "#ffcc00" : "#ff4444") : "#44ff88" }}>♥{showStats.hp}</span>
          </div>
        )}
        {hpBar && (
          <div style={{ width: "100%", height: 3, background: "#111", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${Math.max(0, Math.min(100, (hpBar.current / hpBar.max) * 100))}%`,
              background: hpBar.current / hpBar.max > 0.6 ? "#44ff88" : hpBar.current / hpBar.max > 0.3 ? "#ffcc00" : "#ff4444",
              transition: "width 0.3s",
            }} />
          </div>
        )}
        {equippedBonus !== undefined && (
          <div style={{ fontSize: d.rarityFontSize, color: "#44cc44", fontWeight: "bold" }}>
            ⚔ +{equippedBonus.toLocaleString()}
          </div>
        )}
      </motion.div>

      {/* ── Selected gold ring ── */}
      {selected && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10,
          border: "2px solid #ffd70066", pointerEvents: "none",
        }} />
      )}

      {/* ── Overlay text ── */}
      {overlay && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10,
          background: "#00000055",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{
            fontSize: d.nameFontSize, fontWeight: "bold", color: "#ffd700",
            letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 8px #ffd700",
          }}>
            {overlay}
          </span>
        </div>
      )}

      {/* ── Rarity idle effects (position:absolute overlays, pointerEvents:none) ── */}
      {rarityEffect && !dimmed && (
        <>
          {/* Solid tint pulse (A / SS / SSS / X) */}
          {!rarityEffect.shimmer && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 10,
              background: rarityEffect.color,
              opacity: rarityEffect.opacity,
              animation: rarityEffect.animation,
              pointerEvents: "none",
              zIndex: 8,
              mixBlendMode: "screen",
            }} />
          )}

          {/* S-tier shimmer sweep */}
          {rarityEffect.shimmer && (
            <div style={{
              position: "absolute", inset: 0, overflow: "hidden",
              borderRadius: 10, pointerEvents: "none", zIndex: 8,
            }}>
              <div style={{
                position: "absolute",
                top: 0, bottom: 0,
                width: "45%",
                background: "linear-gradient(90deg, transparent, rgba(255,220,100,0.09), rgba(255,255,200,0.16), rgba(255,220,100,0.09), transparent)",
                animation: "cardShimmer 2.8s ease-in-out infinite",
                transform: "skewX(-12deg)",
              }} />
            </div>
          )}

          {/* SSS extra border crackle */}
          {def?.rarity === "SSS" && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 10,
              border: "1px solid #00ff8828",
              boxShadow: "inset 0 0 10px #00ff8812",
              animation: "sssPulse 2.6s ease-in-out infinite",
              pointerEvents: "none", zIndex: 9,
            }} />
          )}

          {/* X extra border flicker */}
          {def?.rarity === "X" && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 10,
              border: "1px solid #ff222230",
              boxShadow: "inset 0 0 12px #ff222218",
              animation: "xFlicker 2.4s steps(1, end) infinite",
              pointerEvents: "none", zIndex: 9,
            }} />
          )}
        </>
      )}

      {/* ── Dim overlay — replaces opacity on parent so sheen can escape it ── */}
      {dimmed && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 9,
          background: "rgba(0,0,0,0.58)",
          pointerEvents: "none", zIndex: 18,
        }} />
      )}

      {/* ── Cursor-tracking light sheen (all rarities) ── */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 10,
        pointerEvents: "none", zIndex: 20,
        opacity: isHovered ? 1 : 0,
        transition: "opacity 0.18s",
        background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 38%, transparent 62%)`,
        mixBlendMode: "screen",
      }} />

      {/* ── Rainbow foil layer — all rarities on hover, stronger for higher stars ── */}
      {(() => {
        const boosted = starLevel >= 5;
        const isHighRarity = effectiveRarity === "SSS" || effectiveRarity === "X";
        const baseOpacity = isHighRarity ? 0.55 : 0.38;
        const boostOpacity = boosted ? 0.22 : 0;
        const foilOpacity = baseOpacity + boostOpacity;
        return (
          <div style={{
            position: "absolute", inset: boosted ? -2 : 0, borderRadius: boosted ? 12 : 10,
            pointerEvents: "none", zIndex: 21,
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.18s",
            background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%,
              hsla(${sheenPos.x * 3.6},        95%, 75%, ${foilOpacity}) 0%,
              hsla(${sheenPos.x * 3.6 + 80},   95%, 75%, ${foilOpacity * 0.72}) 30%,
              hsla(${sheenPos.x * 3.6 + 160},  95%, 75%, ${foilOpacity * 0.44}) 55%,
              transparent 78%)`,
            mixBlendMode: "color-dodge",
            ...(boosted && isHovered ? {
              boxShadow: `0 0 28px ${color}77, 0 0 56px ${color}33`,
            } : {}),
          }} />
        );
      })()}

      {/* ── Rarity aura ring — inset edge glow pulsing at rarity-specific speed ── */}
      {effectiveRarity && !dimmed && (
        effectiveRarity === "SS"  ? <motion.div animate={{ opacity: [0.15, 0.60, 0.15] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 23, boxShadow: `inset 0 0 0 2px ${color}bb, inset 0 0 14px ${color}44` }} /> :
        effectiveRarity === "SSS" ? <motion.div animate={{ opacity: [0.18, 0.72, 0.18] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 23, boxShadow: `inset 0 0 0 2px ${color}cc, inset 0 0 18px ${color}55` }} /> :
        effectiveRarity === "X"   ? <motion.div animate={{ opacity: [0.22, 0.85, 0.22] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 23, boxShadow: `inset 0 0 0 2px ${color}dd, inset 0 0 22px ${color}66` }} /> :
        null
      )}

      {/* ── Stats overlay — rendered inside the clip so it's bounded by the card ── */}
      {statsOverlay && (() => {
        const pct = Math.max(0, Math.min(1, statsOverlay.hp / statsOverlay.maxHp));
        const hpCol = pct > 0.6 ? "#44ff88" : pct > 0.3 ? "#ffcc00" : "#ff4444";
        const fs = size === "xs" ? 9 : size === "sm" ? 10 : 11;
        return (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.88) 28%)",
            borderBottomLeftRadius: 9, borderBottomRightRadius: 9,
            padding: `${size === "xs" ? 10 : 14}px 4px 4px`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            pointerEvents: "none",
          }}>
            {statsOverlay.name && (
              <div style={{ fontSize: fs - 1, fontWeight: 800, color: "#e8e8e8", letterSpacing: 0.3, textAlign: "center", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", paddingLeft: 3, paddingRight: 3 }}>
                {statsOverlay.name}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-around", width: "100%", padding: "1px 4px" }}>
              <span style={{ fontSize: fs + 2, fontWeight: 900, color: "#ff8855" }}>⚔{statsOverlay.atk}</span>
              <span style={{ fontSize: fs + 2, fontWeight: 900, color: hpCol }}>♥{statsOverlay.hp}</span>
            </div>
            <div style={{ width: "calc(100% - 8px)", height: 3, background: "#111", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct * 100}%`, background: hpCol, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          </div>
        );
      })()}

      </div> {/* end inner clip */}

      {/* ── Cursor-tracking sheen — outside the clip so dimmed cards still show it ── */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 10,
        pointerEvents: "none", zIndex: 30,
        opacity: isHovered ? 1 : 0,
        transition: "opacity 0.18s",
        background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%, rgba(255,255,255,${dimmed ? 0.40 : 0.22}) 0%, rgba(255,255,255,${dimmed ? 0.16 : 0.08}) 40%, transparent 68%)`,
        mixBlendMode: "screen",
      }} />

      {/* Cost bubble — outside the clip so it's fully visible, glued to top-left */}
      {!hideAffinityAndCost && (() => {
        const bs = smallBadges ? 16 : Math.round(d.w * 0.28);
        const fs = smallBadges ? 7 : Math.round(d.w * 0.14);
        const cost = costOverride !== undefined ? costOverride : (def ? deriveStats(def).cost : "?");
        const isShield = def?.tags?.includes("shield") ?? false;
        const sbs = Math.round(bs * 0.62); // shield icon bubble size
        const sfs = Math.round(fs * 0.85);
        return (
          <>
            <motion.div
              style={{
                position: "absolute",
                top: -(bs * 0.3), left: -(bs * 0.3),
                width: bs, height: bs, borderRadius: "50%",
                background: "linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)",
                border: "2px solid rgba(255,255,255,0.5)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.7), 0 0 6px rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10,
                x: !noHover && !dimmed ? badgeX : 0,
                y: !noHover && !dimmed ? badgeY : 0,
              }}
            >
              <span style={{
                fontSize: fs, fontWeight: 900, color: "#fff",
                lineHeight: 1, textShadow: "0 1px 4px rgba(0,0,0,0.9)",
              }}>{cost}</span>
            </motion.div>
            {isShield && (
              <div
                style={{
                  position: "absolute",
                  top: -(bs * 0.3) + bs * 0.62, left: -(bs * 0.3) + bs * 0.6,
                  zIndex: 11,
                }}
                onMouseEnter={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setShieldTipPos({ x: rect.left + rect.width / 2, y: rect.top });
                }}
                onMouseLeave={() => setShieldTipPos(null)}
              >
                <motion.div
                  style={{
                    width: sbs, height: sbs, borderRadius: "50%",
                    background: "linear-gradient(135deg, #1a3a6e 0%, #0a1a4a 100%)",
                    border: "1.5px solid rgba(100,180,255,0.85)",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 8px rgba(80,160,255,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    x: !noHover && !dimmed ? badgeX : 0,
                    y: !noHover && !dimmed ? badgeY : 0,
                  }}
                >
                  <span style={{ fontSize: sfs, lineHeight: 1 }}>🛡</span>
                </motion.div>
              </div>
            )}
          </>
        );
      })()}

      {/* Perk badge — always shown for cards with a perk, in every phase */}
      {def && CARD_PERKS[def.id] && (() => {
        const perk = CARD_PERKS[def.id];
        const bs = smallBadges ? 14 : Math.round(d.w * 0.22);
        return (
          <div
            style={{ position: "absolute", top: -(bs * 0.25), right: -(bs * 0.25), zIndex: 12 }}
            onMouseEnter={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setPerkTipPos({ x: rect.right, y: rect.top });
            }}
            onMouseLeave={() => setPerkTipPos(null)}
          >
            <motion.div
              style={{
                width: bs, height: bs, borderRadius: "50%",
                background: "linear-gradient(135deg, #4a3200 0%, #241800 100%)",
                border: "1.5px solid rgba(255,200,60,0.85)",
                boxShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 8px rgba(255,190,40,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                x: !noHover && !dimmed ? badgeX : 0,
                y: !noHover && !dimmed ? badgeY : 0,
              }}
            >
              <span style={{ fontSize: Math.round(bs * 0.55), lineHeight: 1 }}>{perk.icon}</span>
            </motion.div>
          </div>
        );
      })()}

      {/* Collection marks — subtle vertical column hugging the left border: gold dupe stars, red kill marks */}
      {(dupeStars > 0 || killStars > 0) && (() => {
        const ascLevel = Math.floor(dupeStars / 3);
        const dupeProg = dupeStars % 3;
        const killMarks = Math.floor(killStars / 3);
        const killProg = killStars % 3;
        const ascColor = ascLevel >= 3 ? "#ff4444" : ascLevel === 2 ? "#44ff88" : "#cc66ff";
        return (
          <div style={{
            position: "absolute", top: "16%", left: 1.5,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
            pointerEvents: "none", zIndex: 13,
          }}>
            {Array.from({ length: ascLevel }).map((_, i) => (
              <span key={`a${i}`} style={{
                fontSize: 7, lineHeight: 1, color: ascColor, fontWeight: 900,
                textShadow: `0 0 5px ${ascColor}, 0 1px 2px #000`,
              }}>◆</span>
            ))}
            {Array.from({ length: dupeProg }).map((_, i) => (
              <span key={`d${i}`} style={{
                fontSize: 7, lineHeight: 1, color: "#ffd700",
                textShadow: "0 0 5px #ffd700cc, 0 1px 2px #000",
              }}>★</span>
            ))}
            {(killMarks > 0 || killProg > 0) && (dupeStars > 0) && (
              <span style={{ height: 2 }} />
            )}
            {Array.from({ length: killMarks }).map((_, i) => (
              <span key={`k${i}`} style={{
                fontSize: 7, lineHeight: 1, color: "#ff4444", fontWeight: 900,
                textShadow: "0 0 5px #ff4444cc, 0 1px 2px #000",
              }}>✕</span>
            ))}
            {Array.from({ length: killProg }).map((_, i) => (
              <span key={`kp${i}`} style={{
                fontSize: 5, lineHeight: 1, color: "#ff6666cc",
                textShadow: "0 0 4px #ff444488",
              }}>●</span>
            ))}
          </div>
        );
      })()}

      {/* Portaled tooltips — anchored to the viewport so they stay perfectly still while the card animates */}
      {perkTipPos && def && CARD_PERKS[def.id] && createPortal(
        <div style={{
          position: "fixed", left: Math.max(8, perkTipPos.x - 190), top: perkTipPos.y - 8,
          transform: "translateY(-100%)",
          background: "rgba(4,4,14,0.98)", border: "1px solid #6a5a2a",
          borderRadius: 8, padding: "8px 11px",
          width: 190, zIndex: 9999, pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#ffcc44", letterSpacing: 0.5, marginBottom: 3 }}>
            {CARD_PERKS[def.id].icon} {CARD_PERKS[def.id].name}
          </div>
          <div style={{ fontSize: 10, color: "#fff", lineHeight: 1.55 }}>{CARD_PERKS[def.id].desc}</div>
        </div>,
        document.body
      )}
      {shieldTipPos && createPortal(
        <div style={{
          position: "fixed", left: Math.max(8, shieldTipPos.x - 90), top: shieldTipPos.y - 8,
          transform: "translateY(-100%)",
          background: "rgba(4,4,14,0.98)", border: "1px solid #2a3a6a",
          borderRadius: 8, padding: "8px 11px",
          width: 180, zIndex: 9999, pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#88bbff", letterSpacing: 0.5, marginBottom: 3 }}>
            🛡 Shield
          </div>
          <div style={{ fontSize: 10, color: "#fff", lineHeight: 1.55 }}>
            While a Shield card is on the board, the enemy can only target Shield cards — everything else, including the leader, is protected.
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}

// ── Card back (face-down) ─────────────────────────────────────────────────────
export function CardBack({
  size = "md", shownRarity, shownRole, noHover = false,
}: {
  size?: CardSize; shownRarity?: string; shownRole?: string; noHover?: boolean;
}) {
  const [backImgFailed, setBackImgFailed] = useState(false);
  const [sheenPos, setSheenPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const floatDelay = useRef(Math.random() * 3.2);

  const rawRotX = useMotionValue(0);
  const rawRotY = useMotionValue(0);
  const rotX = useSpring(rawRotX, { stiffness: 280, damping: 22 });
  const rotY = useSpring(rawRotY, { stiffness: 280, damping: 22 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top)  / rect.height;
    setSheenPos({ x: nx * 100, y: ny * 100 });
    if (!noHover) {
      rawRotY.set((nx - 0.5) * 16);
      rawRotX.set(-(ny - 0.5) * 12);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    rawRotX.set(0);
    rawRotY.set(0);
  };

  const d = DIMS[size];
  const color = shownRarity ? rc(shownRarity) : "#1e1e40";

  const ROLE_ICON: Record<string, string> = { LEADER: "👑", COMBAT: "💥", SUPPORT: "✨" };

  const hoverShadow = shownRarity
    ? `0 -10px 28px ${color}44, 0 0 20px ${color}55`
    : `0 -8px 20px rgba(0,0,0,0.7)`;

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        width: d.w, height: d.h, borderRadius: 10,
        border: `2px solid ${color}66`,
        background: "repeating-linear-gradient(135deg, #0a0a1e 0px, #0a0a1e 6px, #0d0d2a 6px, #0d0d2a 12px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 4, overflow: "hidden", flexShrink: 0,
        position: "relative",
        boxShadow: shownRarity ? `0 0 12px ${color}44` : "0 4px 12px #00000066",
        cursor: "inherit",
        transformPerspective: 700,
        willChange: "transform",
        rotateX: !noHover ? rotX : undefined,
        rotateY: !noHover ? rotY : undefined,
      }}
      animate={
        !noHover ? { y: [0, -3.5, 0] } : { y: 0 }
      }
      whileHover={!noHover ? {
        y: -10,
        scale: 1.06,
        boxShadow: hoverShadow,
        transition: { type: "spring", stiffness: 420, damping: 22 },
      } : undefined}
      transition={
        !noHover
          ? { y: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: floatDelay.current } }
          : { type: "spring", stiffness: 320, damping: 28 }
      }
    >
      {!backImgFailed && (
        <img
          src={cardBackImageSrc()}
          alt="card back"
          draggable={false}
          onError={() => setBackImgFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
        />
      )}
      {backImgFailed && (
        <>
          <div style={{ fontSize: d.w * 0.28, color: "#141430", fontWeight: "bold", lineHeight: 1, position: "relative", zIndex: 1 }}>呪</div>
          <div style={{ fontSize: d.rarityFontSize, color: "#1a1a38", letterSpacing: 3, position: "relative", zIndex: 1 }}>CURSED</div>
        </>
      )}

      {shownRarity && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          background: "rgba(0,0,0,0.55)", borderRadius: 8,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          <div style={{ fontSize: d.rarityFontSize, color: `${color}88`, letterSpacing: 2, fontWeight: "bold" }}>RATE</div>
          <div style={{
            fontSize: d.nameFontSize * 1.9, fontWeight: 900, color,
            letterSpacing: 2, textShadow: `0 0 14px ${color}aa`,
          }}>
            {shownRarity}
          </div>
          {shownRole && (
            <div style={{
              fontSize: d.rarityFontSize, color: `${color}cc`, letterSpacing: 1,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <span>{ROLE_ICON[shownRole] ?? ""}</span>
              <span>{shownRole}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.5, zIndex: 3 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.3, zIndex: 3 }} />

      {/* Cursor-tracking sheen */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 10,
        pointerEvents: "none", zIndex: 20,
        opacity: isHovered ? 1 : 0,
        transition: "opacity 0.18s",
        background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 38%, transparent 62%)`,
        mixBlendMode: "screen",
      }} />

      {/* Rainbow foil for rated rare backs */}
      {shownRarity && ["SS", "SSS", "X"].includes(shownRarity) && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10,
          pointerEvents: "none", zIndex: 21,
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.18s",
          background: `radial-gradient(circle at ${sheenPos.x}% ${sheenPos.y}%,
            hsla(${sheenPos.x * 3.6},       90%, 72%, 0.20) 0%,
            hsla(${sheenPos.x * 3.6 + 80},  90%, 72%, 0.12) 35%,
            transparent 65%)`,
          mixBlendMode: "color-dodge",
        }} />
      )}

      {/* Rarity aura ring on card back */}
      {shownRarity && (
        shownRarity === "SS"  ? <motion.div animate={{ opacity: [0.15, 0.60, 0.15] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 23, boxShadow: `inset 0 0 0 2px ${color}bb, inset 0 0 14px ${color}44` }} /> :
        shownRarity === "SSS" ? <motion.div animate={{ opacity: [0.18, 0.72, 0.18] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 23, boxShadow: `inset 0 0 0 2px ${color}cc, inset 0 0 18px ${color}55` }} /> :
        shownRarity === "X"   ? <motion.div animate={{ opacity: [0.22, 0.85, 0.22] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 23, boxShadow: `inset 0 0 0 2px ${color}dd, inset 0 0 22px ${color}66` }} /> :
        null
      )}
    </motion.div>
  );
}
