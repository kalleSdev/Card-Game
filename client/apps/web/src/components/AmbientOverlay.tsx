/**
 * AmbientOverlay — makes static background images feel alive.
 *
 * Layer A: Slow-drifting fog/mist blobs (CSS keyframe animations)
 * Layer C: The background itself gently pans (via a CSS animation on the
 *          parent container's background-position — caller must set
 *          `backgroundAttachment: "fixed"` is NOT needed; we animate
 *          background-position on the wrapper via a className).
 *
 * Usage:
 *   Wrap your screen's root div in a div with `position: relative` and add
 *   <AmbientOverlay theme="dark" /> as the first child (zIndex 0).
 *   The screen's own overlay (rgba tint) should sit at zIndex 1+.
 */

import React from "react";

type Theme = "dark" | "blue" | "red" | "gold" | "purple";

const THEME_COLORS: Record<Theme, { fog1: string; fog2: string; fog3: string }> = {
  dark:   { fog1: "rgba(10,10,20,0.55)",   fog2: "rgba(20,10,30,0.42)",  fog3: "rgba(8,8,16,0.48)"  },
  blue:   { fog1: "rgba(10,30,90,0.55)",   fog2: "rgba(20,50,120,0.42)", fog3: "rgba(8,24,70,0.48)" },
  red:    { fog1: "rgba(80,8,8,0.58)",     fog2: "rgba(60,4,4,0.46)",    fog3: "rgba(70,6,14,0.50)" },
  gold:   { fog1: "rgba(70,48,4,0.55)",    fog2: "rgba(55,38,4,0.44)",   fog3: "rgba(80,52,8,0.48)" },
  purple: { fog1: "rgba(45,8,80,0.55)",    fog2: "rgba(30,6,60,0.44)",   fog3: "rgba(36,4,72,0.48)" },
};

export default function AmbientOverlay({ theme = "dark" }: { theme?: Theme }) {
  const c = THEME_COLORS[theme];

  return (
    <>
      {/* ── Layer C: background pan is applied via CSS class on the caller's root ── */}
      {/* ── Layer A: drifting mist blobs ── */}

      {/* Blob 1 — large, slow drift upper-left */}
      <div style={{
        position: "fixed", pointerEvents: "none", zIndex: 0,
        width: "85vw", height: "65vh",
        top: "-15vh", left: "-20vw",
        borderRadius: "50%",
        background: `radial-gradient(ellipse at 40% 45%, ${c.fog1} 0%, transparent 68%)`,
        filter: "blur(32px)",
        animation: "fogDrift1 28s ease-in-out infinite",
        willChange: "transform",
      }} />

      {/* Blob 2 — medium, mid-right drift */}
      <div style={{
        position: "fixed", pointerEvents: "none", zIndex: 0,
        width: "68vw", height: "55vh",
        top: "28vh", right: "-16vw",
        borderRadius: "50%",
        background: `radial-gradient(ellipse at 55% 40%, ${c.fog2} 0%, transparent 68%)`,
        filter: "blur(36px)",
        animation: "fogDrift2 36s ease-in-out infinite",
        willChange: "transform",
      }} />

      {/* Blob 3 — bottom-center */}
      <div style={{
        position: "fixed", pointerEvents: "none", zIndex: 0,
        width: "60vw", height: "50vh",
        bottom: "-12vh", left: "14vw",
        borderRadius: "50%",
        background: `radial-gradient(ellipse at 50% 60%, ${c.fog3} 0%, transparent 68%)`,
        filter: "blur(30px)",
        animation: "fogDrift3 22s ease-in-out infinite",
        willChange: "transform",
      }} />

      {/* Blob 4 — large ambient top-right */}
      <div style={{
        position: "fixed", pointerEvents: "none", zIndex: 0,
        width: "72vw", height: "60vh",
        top: "-8vh", right: "-14vw",
        borderRadius: "50%",
        background: `radial-gradient(ellipse at 60% 35%, ${c.fog1} 0%, transparent 62%)`,
        filter: "blur(34px)",
        animation: "fogDrift4 44s ease-in-out infinite",
        willChange: "transform",
      }} />

      <style>{`
        @keyframes fogDrift1 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          33%      { transform: translate(40px, 28px) scale(1.06); }
          66%      { transform: translate(-20px, 18px) scale(0.96); }
        }
        @keyframes fogDrift2 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          40%      { transform: translate(-50px, -24px) scale(1.08); }
          70%      { transform: translate(28px, 36px) scale(0.94); }
        }
        @keyframes fogDrift3 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          50%      { transform: translate(34px, -20px) scale(1.05); }
        }
        @keyframes fogDrift4 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          30%      { transform: translate(-30px, 20px) scale(0.97); }
          65%      { transform: translate(22px, -16px) scale(1.04); }
        }
      `}</style>
    </>
  );
}

/**
 * BgPan — wraps a screen's root to add a slow background-position pan.
 * The background-image must be set on the returned div.
 */
export function BgPanWrapper({
  children,
  backgroundImage,
  style,
}: {
  children: React.ReactNode;
  backgroundImage: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      ...style,
      backgroundImage,
      backgroundSize: "110% auto",   // slightly oversize so pan has room
      backgroundPosition: "center",
      animation: "bgPan 60s ease-in-out infinite",
      position: "relative",
    }}>
      {children}
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
