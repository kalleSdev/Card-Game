import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db.js";
import { FEED_TIER, post, postPull, recent } from "./feed.js";

let seq = 0;
function freshUser(): { id: string; username: string } {
  const id = `f${++seq}-${Math.random().toString(36).slice(2)}`;
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, id, "x", Date.now());
  return { id, username: id };
}

let user: { id: string; username: string };

beforeEach(() => {
  db.exec("DELETE FROM feed");
  user = freshUser();
});

describe("the feed", () => {
  it("gives the newest first", () => {
    post("match", user, { opponent: "one", won: true, turns: 6 });
    post("match", user, { opponent: "two", won: false, turns: 8 });

    const entries = recent();
    expect(entries).toHaveLength(2);
    expect(entries[0].body.opponent).toBe("two");
    expect(entries[0].at).toBeGreaterThanOrEqual(entries[1].at);
  });

  it("keeps the name as it was written", () => {
    post("streak", user, { streak: 4 });
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run("somebodyElse", user.id);

    expect(recent()[0].username).toBe(user.username);
  });

  it("only reports prints worth reporting", () => {
    postPull(user, "gojo", "base");
    postPull(user, "gojo", "foil");
    postPull(user, "gojo", "altArt");
    postPull(user, "gojo", "holoOne");

    const entries = recent();
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.body.print).sort()).toEqual(["altArt", "holoOne"]);
    for (const entry of entries) expect(entry.body.tier as number).toBeGreaterThanOrEqual(FEED_TIER);
  });

  it("caps how much it will hand over at once", () => {
    for (let i = 0; i < 12; i++) post("match", user, { opponent: "x", won: true, turns: 5 });
    expect(recent(5)).toHaveLength(5);
    expect(recent(0)).toHaveLength(1);
    expect(recent(500).length).toBeLessThanOrEqual(100);
  });

  it("survives a row it cannot read", () => {
    db.prepare("INSERT INTO feed (id, kind, user_id, username, body, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("bad", "match", user.id, user.username, "{not json", Date.now());
    expect(recent()[0].body).toEqual({});
  });
});
