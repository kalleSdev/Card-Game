import type { PackId, PrintId, Pull, RankId, Wallet } from "@cg/meta";

/**
 * Talking to the server.
 *
 * The token lives in localStorage because that is where a browser can keep it
 * across reloads. Nothing else about the player is stored here: the collection,
 * the wallet and the packs all come from the server on every load, because a
 * balance the browser can edit is not a balance.
 */

const BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";
const TOKEN_KEY = "grandline.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A private window can refuse to store. The session still works until reload.
  }
}

export class ApiError extends Error {}

async function call<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is it running on port 8787?");
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`);
  return data;
}

// ── Account ──────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  username: string;
  wins: number;
  losses: number;
}

export async function register(username: string, password: string): Promise<Account> {
  const out = await call<{ token: string; user: Account }>("/auth/register", {
    method: "POST",
    body: { username, password },
  });
  setToken(out.token);
  return out.user;
}

export async function signIn(username: string, password: string): Promise<Account> {
  const out = await call<{ token: string; user: Account }>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  setToken(out.token);
  return out.user;
}

export async function signOut(): Promise<void> {
  try {
    await call("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}

/** The signed in account, or null when the token is missing or stale. */
export async function whoAmI(): Promise<Account | null> {
  if (!getToken()) return null;
  try {
    const out = await call<{ user: Account }>("/me");
    return out.user;
  } catch {
    setToken(null);
    return null;
  }
}

// ── Collection, packs, money ─────────────────────────────────────────────────

export interface PrintRow {
  card_id: string;
  print_id: PrintId;
  copies: number;
  first_at: number;
}

export interface OwnedPack {
  id: string;
  packId: PackId;
  source: string;
  earnedAt: number;
}

export interface Standing {
  userId: string;
  username: string;
  mmr: number;
  peakMmr: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  rank: RankId;
  rankName: string;
  /** Set only for the five seats the leaderboard decides. */
  topRank: RankId | null;
  position: number | null;
}

export interface Everything {
  prints: PrintRow[];
  wallet: Wallet;
  packs: OwnedPack[];
  decks: ServerDeck[];
  standing: Standing;
}

export interface ServerDeck {
  id: string;
  name: string;
  leaderId: string | null;
  cardIds: string[];
  prints: Record<string, PrintId>;
  updatedAt: number;
}

export const fetchEverything = () => call<Everything>("/collection");

/** The ladder is public, so this works signed out. */
export const fetchLeaderboard = () => call<{ standings: Standing[] }>("/leaderboard");

export const buyPack = (packId: PackId) =>
  call<OwnedPack>("/packs/buy", { method: "POST", body: { packId } });

export const openPack = (id: string) =>
  call<{ id: string; packId: PackId; seed: number; pulls: Pull[]; isNew: boolean[] }>(
    `/packs/${id}/open`,
    { method: "POST" },
  );

export const scrap = (cardId: string, print: PrintId, amount: number, action: "dust" | "sell") =>
  call<{ removed: number; gained: number; wallet: Wallet }>("/collection/scrap", {
    method: "POST",
    body: { cardId, print, amount, action },
  });

export const craft = (cardId: string, print: PrintId) =>
  call<{ wallet: Wallet }>("/collection/craft", { method: "POST", body: { cardId, print } });

export const saveDeck = (deck: ServerDeck) =>
  call<{ ok: true }>("/decks", { method: "POST", body: deck });

export const deleteDeck = (id: string) =>
  call<{ ok: true }>(`/decks/${id}`, { method: "DELETE" });
