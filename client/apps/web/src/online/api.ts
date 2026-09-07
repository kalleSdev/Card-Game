import type { PublicUser } from "./types";

const BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";
const TOKEN_KEY = "cg_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const socketUrl = () => BASE.replace(/^http/, "ws");

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong");
  return data as T;
}

interface AuthResponse { token: string; user: PublicUser }

export async function register(username: string, password: string): Promise<PublicUser> {
  const { token, user } = await post<AuthResponse>("/auth/register", { username, password });
  setToken(token);
  return user;
}

export async function login(username: string, password: string): Promise<PublicUser> {
  const { token, user } = await post<AuthResponse>("/auth/login", { username, password });
  setToken(token);
  return user;
}

export async function logout(): Promise<void> {
  const token = getToken();
  clearToken();
  if (!token) return;
  await fetch(`${BASE}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } })
    .catch(() => undefined);
}

export interface CollectionRow { def_id: string; dupes: number; kills: number }

// Returns null when there is no valid session, so the caller can show the login screen.
export async function fetchMe(): Promise<{ user: PublicUser; collection: CollectionRow[] } | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${BASE}/me`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) { clearToken(); return null; }
  return res.json();
}
