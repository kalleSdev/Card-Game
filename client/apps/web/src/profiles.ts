export interface ProfileStats {
  wins: number;
  losses: number;
  matches: number;
}

export interface MatchRecord {
  id: string;
  date: number;
  mode: "quick" | "draft";
  opponentId: string;
  opponentName: string;
  opponentIcon: string;
  result: "win" | "loss";
}

export interface Profile {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
  quickStats: ProfileStats;
  draftStats: ProfileStats;
  history: MatchRecord[];
  /** @deprecated kept for migration only */
  stats?: ProfileStats;
}

const KEY = "cg_profiles_v1";

const emptyStats = (): ProfileStats => ({ wins: 0, losses: 0, matches: 0 });

export function loadProfiles(): Profile[] {
  try {
    const raw: Profile[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return raw.map(p => ({
      ...p,
      quickStats: p.quickStats ?? p.stats ?? emptyStats(),
      draftStats: p.draftStats ?? emptyStats(),
      history: p.history ?? [],
    }));
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
    quickStats: emptyStats(),
    draftStats: emptyStats(),
    history: [],
  };
  saveProfiles([...loadProfiles(), profile]);
  return profile;
}

export function deleteProfile(id: string): void {
  saveProfiles(loadProfiles().filter(p => p.id !== id));
}

export function updateProfile(id: string, name: string, icon: string): void {
  saveProfiles(loadProfiles().map(p =>
    p.id === id ? { ...p, name: name.trim() || p.name, icon } : p
  ));
}

export function recordMatchResult(
  winnerProfileId: string,
  loserProfileId: string,
  mode: "quick" | "draft",
  winnerName: string,
  winnerIcon: string,
  loserName: string,
  loserIcon: string,
): void {
  const all = loadProfiles();
  const field = mode === "draft" ? "draftStats" : "quickStats";
  const matchId = crypto.randomUUID();
  const date = Date.now();
  for (const p of all) {
    if (p.id === winnerProfileId) {
      p[field].wins++;
      p[field].matches++;
      p.history = [
        { id: matchId, date, mode, opponentId: loserProfileId, opponentName: loserName, opponentIcon: loserIcon, result: "win" },
        ...p.history,
      ];
    }
    if (p.id === loserProfileId) {
      p[field].losses++;
      p[field].matches++;
      p.history = [
        { id: matchId, date, mode, opponentId: winnerProfileId, opponentName: winnerName, opponentIcon: winnerIcon, result: "loss" },
        ...p.history,
      ];
    }
  }
  saveProfiles(all);
}

export function totalWins(p: Profile): number {
  return (p.quickStats?.wins ?? 0) + (p.draftStats?.wins ?? 0);
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
