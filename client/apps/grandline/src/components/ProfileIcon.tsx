import { PROFILE_ICONS } from "@cg/meta";
import { COLOR } from "../design/tokens";

/**
 * The placeholder profile icons.
 *
 * Drawn rather than loaded, and deliberately plain: icons become cosmetics of
 * their own once there is art for them, so nothing here should be worth
 * keeping. One flat symbol per id, on the same square, so swapping the whole
 * set later is one file.
 */

const PATHS: Record<string, JSX.Element> = {
  "icon.compass": (
    <>
      <circle cx="24" cy="24" r="15" />
      <path d="M30 18 L26 26 L18 30 L22 22 Z" fill="currentColor" stroke="none" />
    </>
  ),
  "icon.anchor": (
    <>
      <circle cx="24" cy="12" r="3.5" />
      <path d="M24 15.5 V36" />
      <path d="M17 20 H31" />
      <path d="M13 28 a11 11 0 0 0 22 0" />
    </>
  ),
  "icon.wheel": (
    <>
      <circle cx="24" cy="24" r="9" />
      <circle cx="24" cy="24" r="3.2" />
      <path d="M24 8 V15 M24 33 V40 M8 24 H15 M33 24 H40" />
      <path d="M13 13 L18 18 M35 35 L30 30 M35 13 L30 18 M13 35 L18 30" />
    </>
  ),
  "icon.skull": (
    <>
      <path d="M14 22 a10 10 0 0 1 20 0 v5 a5 5 0 0 1 -3 4.6 V36 h-14 v-4.4 A5 5 0 0 1 14 27 Z" />
      <circle cx="19.5" cy="23" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="28.5" cy="23" r="2.6" fill="currentColor" stroke="none" />
    </>
  ),
  "icon.sail": (
    <>
      <path d="M24 8 V36" />
      <path d="M24 11 C33 15 35 24 33 31 H24 Z" />
      <path d="M24 14 C17 17 15 25 16.5 31 H24 Z" />
      <path d="M14 38 H34" />
    </>
  ),
  "icon.lantern": (
    <>
      <path d="M19 14 h10 v3 l3 4 v13 l-3 4 h-10 l-3 -4 V21 l3 -4 Z" />
      <path d="M24 8 v6" />
      <circle cx="24" cy="27" r="4" />
    </>
  ),
  "icon.wave": (
    <>
      <path d="M9 20 q5 -6 10 0 t10 0 t10 0" />
      <path d="M9 28 q5 -6 10 0 t10 0 t10 0" />
      <path d="M9 36 q5 -6 10 0 t10 0 t10 0" />
    </>
  ),
  "icon.star": (
    <>
      <path d="M24 9 L27.5 20 L39 20 L29.7 26.8 L33.2 38 L24 31 L14.8 38 L18.3 26.8 L9 20 L20.5 20 Z" />
    </>
  ),
};

export const ICON_IDS = PROFILE_ICONS.map(icon => icon.id);

export function iconName(id: string | null): string {
  return PROFILE_ICONS.find(icon => icon.id === id)?.name ?? "No icon";
}

export default function ProfileIcon({
  id, size = 48, color = COLOR.foam,
}: {
  id: string | null;
  size?: number;
  color?: string;
}) {
  const glyph = id ? PATHS[id] : null;
  if (!glyph) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r="10" fill="none" stroke={COLOR.fathom} strokeWidth="1.6" strokeDasharray="3 4" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {glyph}
    </svg>
  );
}
