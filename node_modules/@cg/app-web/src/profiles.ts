export interface ProfileStats {
  wins: number;
  losses: number;
  matches: number;
}

export interface MatchRecord {
  id: string;
  date: number;
  mode: "quick" | "draft" | "normal";
  opponentId: string;
  opponentName: string;
  opponentIcon: string;
  result: "win" | "loss";
}

export interface CollectedCard {
  defId: string;
  duplicateStars: number;  // each 3 = ascend one tier (S→SS→SSS→X)
  killStars: number;       // red stars from killing enemy leader; each 3 = 1 kill-X mark
}

export interface SubDeck {
  id: string;
  name: string;
  leaderId: string;
  cardIds: string[];  // exactly 10 non-leader cards
}

export interface Profile {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
  quickStats: ProfileStats;
  draftStats: ProfileStats;
  normalStats: ProfileStats;
  history: MatchRecord[];
  collection: CollectedCard[];
  subDecks: SubDeck[];
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
      quickStats:  p.quickStats  ?? p.stats ?? emptyStats(),
      draftStats:  p.draftStats  ?? emptyStats(),
      normalStats: p.normalStats ?? emptyStats(),
      history:     p.history     ?? [],
      collection:  p.collection  ?? [],
      subDecks:    p.subDecks    ?? [],
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
    quickStats:  emptyStats(),
    draftStats:  emptyStats(),
    normalStats: emptyStats(),
    history: [],
    collection: [],
    subDecks: [],
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
  mode: "quick" | "draft" | "normal",
  winnerName: string,
  winnerIcon: string,
  loserName: string,
  loserIcon: string,
): void {
  const all = loadProfiles();
  const field = mode === "draft" ? "draftStats" : mode === "normal" ? "normalStats" : "quickStats";
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

// ── Collection helpers ────────────────────────────────────────────────────────

export function addCardsToCollection(profileId: string, defIds: string[]): void {
  const all = loadProfiles();
  for (const p of all) {
    if (p.id !== profileId) continue;
    for (const defId of defIds) {
      const existing = p.collection.find(c => c.defId === defId);
      if (existing) {
        existing.duplicateStars++;
      } else {
        p.collection.push({ defId, duplicateStars: 0, killStars: 0 });
      }
    }
  }
  saveProfiles(all);
}

export function addKillStar(profileId: string, defId: string): void {
  const all = loadProfiles();
  for (const p of all) {
    if (p.id !== profileId) continue;
    const card = p.collection.find(c => c.defId === defId);
    if (card) card.killStars++;
  }
  saveProfiles(all);
}

export function resetCard(profileId: string, defId: string): void {
  const all = loadProfiles();
  for (const p of all) {
    if (p.id !== profileId) continue;
    const card = p.collection.find(c => c.defId === defId);
    if (card) { card.duplicateStars = 0; card.killStars = 0; }
  }
  saveProfiles(all);
}

export function saveSubDeck(profileId: string, deck: SubDeck): void {
  const all = loadProfiles();
  for (const p of all) {
    if (p.id !== profileId) continue;
    const idx = p.subDecks.findIndex(d => d.id === deck.id);
    if (idx >= 0) p.subDecks[idx] = deck;
    else p.subDecks.push(deck);
  }
  saveProfiles(all);
}

export function deleteSubDeck(profileId: string, deckId: string): void {
  const all = loadProfiles();
  for (const p of all) {
    if (p.id !== profileId) continue;
    p.subDecks = p.subDecks.filter(d => d.id !== deckId);
  }
  saveProfiles(all);
}

// ── Computed helpers ──────────────────────────────────────────────────────────

/** Returns the visual rarity tier for a collected card based on ascension level */
export function getAscensionRarity(card: CollectedCard): string {
  const level = Math.floor(card.duplicateStars / 3);
  if (level >= 3) return "X";
  if (level === 2) return "SSS";
  if (level === 1) return "SS";
  return "S";
}

export function totalWins(p: Profile): number {
  return (p.quickStats?.wins ?? 0) + (p.draftStats?.wins ?? 0) + (p.normalStats?.wins ?? 0);
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
