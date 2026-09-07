import { describe, it, expect, beforeAll } from "vitest";

// Point the data layer at memory before anything imports it
process.env.DB_PATH = ":memory:";

const mod = await import("./auth.js");
const { register, login, logout, userForToken, getCollection, addCards, recordResult, AuthError } = mod;

describe("registration", () => {
  it("creates an account and signs you straight in", () => {
    const { token, user } = register("alpha_one", "hunter2hunter");
    expect(user.username).toBe("alpha_one");
    expect(userForToken(token)?.id).toBe(user.id);
  });

  it("refuses a username that is already taken, ignoring case", () => {
    register("dupecheck", "hunter2hunter");
    expect(() => register("DupeCheck", "hunter2hunter")).toThrow(AuthError);
  });

  it("refuses short usernames, odd characters and short passwords", () => {
    expect(() => register("ab", "hunter2hunter")).toThrow(AuthError);
    expect(() => register("bad name!", "hunter2hunter")).toThrow(AuthError);
    expect(() => register("okayname", "short")).toThrow(AuthError);
  });

  it("never stores the password itself", async () => {
    const { user } = register("plaintext", "supersecret123");
    const { db } = await import("./db.js");
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string };
    expect(row.password_hash).not.toContain("supersecret123");
    expect(row.password_hash.startsWith("$2")).toBe(true);
  });
});

describe("logging in", () => {
  beforeAll(() => { register("loginuser", "hunter2hunter"); });

  it("works with the right password", () => {
    expect(login("loginuser", "hunter2hunter").user.username).toBe("loginuser");
  });

  it("gives the same message for a wrong password and a missing user", () => {
    const a = (() => { try { login("loginuser", "wrongpass1"); } catch (e) { return (e as Error).message; } })();
    const b = (() => { try { login("ghostuser", "wrongpass1"); } catch (e) { return (e as Error).message; } })();
    expect(a).toBe(b);
  });

  it("drops the session on logout", () => {
    const { token } = login("loginuser", "hunter2hunter");
    expect(userForToken(token)).not.toBeNull();
    logout(token);
    expect(userForToken(token)).toBeNull();
  });

  it("rejects a made up token", () => {
    expect(userForToken("nonsense")).toBeNull();
    expect(userForToken(undefined)).toBeNull();
  });
});

describe("collection", () => {
  it("adds cards and counts duplicates instead of repeating rows", () => {
    const { user } = register("collector", "hunter2hunter");
    addCards(user.id, ["yuji", "toji"]);
    addCards(user.id, ["yuji"]);

    const rows = getCollection(user.id);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.def_id === "yuji")?.dupes).toBe(1);
    expect(rows.find(r => r.def_id === "toji")?.dupes).toBe(0);
  });

  it("keeps collections separate between accounts", () => {
    const a = register("owner_a", "hunter2hunter").user;
    const b = register("owner_b", "hunter2hunter").user;
    addCards(a.id, ["gojo-base"]);
    expect(getCollection(a.id)).toHaveLength(1);
    expect(getCollection(b.id)).toHaveLength(0);
  });
});

describe("results", () => {
  it("tallies wins and losses onto the profile", () => {
    const { user, token } = register("fighter", "hunter2hunter");
    recordResult(user.id, "someone", true, 12);
    recordResult(user.id, "someone", true, 9);
    recordResult(user.id, "someone", false, 15);

    const refreshed = userForToken(token)!;
    expect(refreshed.wins).toBe(2);
    expect(refreshed.losses).toBe(1);
  });

  it("starts a new account on zero", () => {
    const { token } = register("rookie", "hunter2hunter");
    const u = userForToken(token)!;
    expect(u.wins).toBe(0);
    expect(u.losses).toBe(0);
  });
});
