import { useState } from "react";
import { PLAYER_ICON_EMOJI } from "../constants";

/**
 * Renders a player icon. Accepts either:
 *  - a "player-N" key (loads /players/player-N.PNG, falls back to emoji)
 *  - a raw emoji string (renders directly for backward compat)
 *
 * Drop your PNG files in:  client/apps/web/public/players/
 *   player-1.PNG  →  Lightning / Thunder character
 *   player-2.PNG  →  Skull character
 *   player-3.PNG  →  Eye / Six Eyes character
 *   player-4.PNG  →  Sword / Warrior character
 *   player-5.PNG  →  Flame / Fire character
 *   player-6.PNG  →  Blood / Curse character
 */
export default function PlayerIcon({
  icon,
  size = 40,
  style,
}: {
  icon: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isPngKey = icon.startsWith("player-");
  const emoji = PLAYER_ICON_EMOJI[icon] ?? icon;

  if (isPngKey && !imgFailed) {
    return (
      <img
        src={`/players/${icon}.jpg`}
        alt={emoji}
        onError={() => setImgFailed(true)}
        style={{ width: size, height: Math.round(size * 1.4), objectFit: "cover", borderRadius: 6, flexShrink: 0, display: "block", ...style }}
      />
    );
  }
  return (
    <span style={{ fontSize: size * 0.72, lineHeight: 1, flexShrink: 0, ...style }}>
      {emoji}
    </span>
  );
}
