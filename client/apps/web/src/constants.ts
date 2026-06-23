// PNG icon ids — player-1..6 for P1, player-7..12 for P2
export const P1_ICON_OPTIONS = ["player-1", "player-2", "player-3", "player-4", "player-5", "player-6"];
export const P2_ICON_OPTIONS = ["player-7", "player-8", "player-9", "player-10", "player-11", "player-12"];
/** @deprecated use P1_ICON_OPTIONS / P2_ICON_OPTIONS */
export const PLAYER_ICON_OPTIONS = [...P1_ICON_OPTIONS, ...P2_ICON_OPTIONS];

// Emoji fallback shown when PNG hasn't been added yet
export const PLAYER_ICON_EMOJI: Record<string, string> = {
  "player-1":  "⚡",
  "player-2":  "💀",
  "player-3":  "👁",
  "player-4":  "⚔",
  "player-5":  "🔥",
  "player-6":  "🩸",
  "player-7":  "🌀",
  "player-8":  "☠",
  "player-9":  "🐉",
  "player-10": "🌑",
  "player-11": "⚰",
  "player-12": "🩻",
};

export const RARITY_COLOR: Record<string, string> = {
  C: "#aaaaaa", B: "#4488ff", A: "#8811cc",
  S: "#ffd700", SS: "#ff22cc", SSS: "#00ff88",
  X: "#ff2222",
};

export const RARITY_GLOW: Record<string, string> = {
  B:   "0 0 8px #4488ff66, 0 0 16px #2255cc33",
  A:   "0 0 8px #8811cc66, 0 0 16px #550088aa",
  S:   "0 0 8px #ffd70066, 0 0 16px #cc880033",
  SS:  "0 0 12px #ff22ccaa, 0 0 24px #cc0099aa",
  SSS: "0 0 18px #00ff88aa, 0 0 36px #00aa5555",
  X:   "0 0 20px #ff2222dd, 0 0 40px #aa000066, 0 0 70px #ff222233",
};

export const RARITY_DRAMATIC: Record<string, { glow: string; label: string }> = {
  C:   { glow: "0 0 40px #aaaaaa44, 0 0 80px #aaaaaa22",  label: "COMMON" },
  B:   { glow: "0 0 40px #4488ff88, 0 0 80px #2255cc33",  label: "RARE" },
  A:   { glow: "0 0 50px #8811cc99, 0 0 100px #550088aa", label: "ELITE" },
  S:   { glow: "0 0 60px #ffd700aa, 0 0 120px #cc880044", label: "SPECIAL" },
  SS:  { glow: "0 0 70px #ff22cccc, 0 0 140px #cc009955", label: "ULTRA" },
  SSS: { glow: "0 0 80px #00ff88aa, 0 0 160px #00aa5555, 0 0 240px #00ff8822", label: "LEGENDARY" },
  X:   { glow: "0 0 80px #ff2222ee, 0 0 160px #aa000066, 0 0 260px #ff222233, 0 0 380px #ff000011", label: "TRANSCENDENT" },
};

export const SYNERGY_LABEL: Record<string, string> = {
  ATTR_HEAVENLY_2:     "⛓ Heavenly ×2 (+5%)",
  ATTR_ZENIN_2:        "⚔ Zenin ×2 (+3%)",
  ATTR_JUJUTSU_3:      "🏫 JJH ×3 (+5%)",          // engine: 1.05
  REL_BROTHERHOOD:     "🤝 Brotherhood ×2 (+5%)",
  REL_BROTHERHOOD_3:   "🤝 Brotherhood ×3 (+8%)",
  TOKYO_TRIO_2:        "🐼 Tokyo Trio ×2 (+4%)",
  TOKYO_TRIO_3:        "🐼 Tokyo Trio ×3 (+6%)",
  THE_STRONGEST_2:     "🔥 The Strongest ×2 (+4%)",
  THE_STRONGEST_3:     "🔥 The Strongest ×3 (+5%)",
  THE_STRONGEST_4:     "💥 The Strongest ×4 (+6%)",
  THE_STRONGEST_5:     "🌌 THE STRONGEST ×5 (×9!!)",
  LUCKY_STAR:          "⭐ Lucky Star (+3%)",
  TRIPLE_DOMAIN_CLASH: "⚡ Triple Domain Clash (+7%)",
  ZENIN_ELDERS:        "⚔ Zenin Elders (+4%)",
  UNPREDICTABLE_DUO:   "🎰 Unpredictable Duo (+4%)",
  SIX_EYES:            "👁 Six Eyes (+4%)",
  CULLING_GAME_3:      "⚔ Culling Game ×3 (+5%)",
  CULLING_GAME_4:      "💀 Culling Game ×4 (+7%)",
  REL_MEMORY_RES:      "👁 Memory Resonance (+3%)",
  CURSE_LEADER_1:      "👿 Curse Leader ×1 (+3%)",
  CURSE_LEADER_2:      "👿 Curse Leader ×2 (+4.5%)",
  CURSE_LEADER_3:      "☠ Curse Leader ×3 (+6%)",
  REL_GOJO_2STUDENTS:  "🎓 Gojo ×2 Students (+5%)",
  REL_GOJO_3STUDENTS:  "🎓 Gojo ×3 Students (+80%)",  // engine: 1.8
  DISASTER_CURSE_2:    "💀 Disaster Curse ×2 (+4%)",
  DISASTER_CURSE_3:    "💀 Disaster Curse ×3 (+6%)",
  DISASTER_CURSE_4:    "💀 Disaster Curse ×4 (+10%)", // engine: 1.10
  AFROBEAT:            "🎵 Afrobeat (+5%)",
  KYOTO_2:             "🏯 Kyoto ×2 (+3%)",
  KYOTO_3:             "🏯 Kyoto ×3 (+5%)",
  YUTA_MAKI:           "⚡ Yuta × Maki (+5%)",
  HEAVEN_AND_HELL:     "☯ Heaven and Hell - Gojo x Toji (+4%)",
};
