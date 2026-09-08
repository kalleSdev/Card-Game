import { COLOR, RADIUS } from "../design/tokens";

/**
 * The back of a card: a compass rose on the hull, drawn rather than loaded.
 *
 * One component for every face-down card in the game — the pack opening, the
 * Score table, anything later — so a card you cannot see always looks like the
 * same object.
 */
export default function CardBack({
  width,
  height,
  dim = false,
}: {
  width: number;
  height: number;
  /** For a card that is out of play rather than merely unknown. */
  dim?: boolean;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLOR.rope}`,
        background: `
          radial-gradient(ellipse 70% 50% at 50% 50%, rgba(62,143,160,0.14), transparent 70%),
          linear-gradient(160deg, #121D2B, #0A121B)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        opacity: dim ? 0.4 : 1,
      }}
    >
      <svg viewBox="0 0 100 100" width="58%" style={{ aspectRatio: "1", opacity: 0.5 }} aria-hidden>
        <circle cx="50" cy="50" r="34" fill="none" stroke={COLOR.current} strokeWidth="1" opacity="0.7" />
        <circle cx="50" cy="50" r="26" fill="none" stroke={COLOR.current} strokeWidth="0.5" opacity="0.5" />
        <path d="M50 6 L57 43 L50 50 L43 43 Z" fill={COLOR.signal} opacity="0.85" />
        <path d="M50 94 L43 57 L50 50 L57 57 Z" fill={COLOR.foam} opacity="0.5" />
        <path d="M6 50 L43 43 L50 50 L43 57 Z" fill={COLOR.foam} opacity="0.3" />
        <path d="M94 50 L57 57 L50 50 L57 43 Z" fill={COLOR.foam} opacity="0.3" />
        <circle cx="50" cy="50" r="2.4" fill={COLOR.doubloon} />
      </svg>
    </div>
  );
}
