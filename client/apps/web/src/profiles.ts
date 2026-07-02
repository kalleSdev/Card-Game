export interface Profile {
  id: string;
  name: string;
  icon: string; // player-1..12
  createdAt: number;
  stats: {
    wins: number;
    losses: number;
    matches: number;
  };
}

const KEY = "cg_profiles_v1";

export function loadProfiles(): Profile[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(KEY, JSON.stringify(profiles));
}

export function createProfile(name: string, icon: string): Profile {
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: name.trim() || "Unnamed",
    icon,
    createdAt: Date.now(),
    stats: { wins: 0, losses: 0, matches: 0 },
  };
  saveProfiles([...loadProfiles(), profile]);
  return profile;
}

export function deleteProfile(id: string): void {
  saveProfiles(loadProfiles().filter(p => p.id !== id));
}

export function recordMatchResult(winnerProfileId: string, loserProfileId: string): void {
  const all = loadProfiles();
  for (const p of all) {
    if (p.id === winnerProfileId) { p.stats.wins++;   p.stats.matches++; }
    if (p.id === loserProfileId)  { p.stats.losses++; p.stats.matches++; }
  }
  saveProfiles(all);
}

export function getTitle(wins: number): string {
  if (wins >= 50) return "Special Grade";
  if (wins >= 25) return "Grade 1 Sorcerer";
  if (wins >= 10) return "Grade 2 Sorcerer";
  if (wins >= 3)  return "Grade 3 Sorcerer";
  return "Cursed User";
}

export function getTitleColor(wins: number): string {
  if (wins >= 50) return "#ff2222";
  if (wins >= 25) return "#ff22cc";
  if (wins >= 10) return "#ffd700";
  if (wins >= 3)  return "#4a9eff";
  return "#778899";
}
