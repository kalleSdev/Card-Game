import { describe, it, expect } from "vitest";
import type { CardDef } from "@cg/contracts";
import { createBattleState } from "./battleEngine";
import { viewFor } from "./stateView";

const card = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, name: id, rarity: "B", basePoints: 1000, affinity: "COMBAT", tags: [], ...over,
});

const DB: Record<string, CardDef> = {
  "gojo-base": card("gojo-base", { rarity: "X", affinity: "LEADER" }),
  sukuna: card("sukuna", { rarity: "X", affinity: "LEADER" }),
  a: card("a"), b: card("b"), c: card("c"), d: card("d"),
  e: card("e"), f: card("f"), g: card("g"), h: card("h"),
};

const draft = (leaderId: string) => ({
  leaderId,
  combatIds: ["a", "b"],
  supportIds: ["c", "d", "e"],
  extraIds: ["f", "g", "h"],
  weaponIds: [] as string[],
});

const base = () => createBattleState(draft("gojo-base"), draft("sukuna"), DB, undefined, 999);

describe("per player state views", () => {
  it("leaves my own hand alone", () => {
    const s = base();
    const mine = viewFor(s, "P1").players.P1;
    expect(mine.hand.map(c => c.defId)).toEqual(s.players.P1.hand.map(c => c.defId));
    expect(mine.hand.every(c => !c.hidden)).toBe(true);
  });

  it("hides what is in the opponent's hand but keeps the count", () => {
    const s = base();
    const theirs = viewFor(s, "P1").players.P2;
    expect(theirs.hand).toHaveLength(s.players.P2.hand.length);
    expect(theirs.hand.every(c => c.hidden)).toBe(true);
    expect(theirs.hand.every(c => c.defId === "hidden")).toBe(true);
  });

  it("does not leak a single opponent card id anywhere in the view", () => {
    const s = base();
    const realIds = new Set(s.players.P2.hand.concat(s.players.P2.deck).map(c => c.defId));
    const serialised = JSON.stringify(viewFor(s, "P1"));
    // P1 might legitimately hold the same defIds, so check only what P2 uniquely holds
    const p1Ids = new Set(s.players.P1.hand.concat(s.players.P1.deck).map(c => c.defId));
    for (const id of realIds) {
      if (p1Ids.has(id)) continue;
      expect(serialised.includes(`"defId":"${id}"`)).toBe(false);
    }
  });

  it("hides the deck contents but keeps the size", () => {
    const s = base();
    const theirs = viewFor(s, "P1").players.P2;
    expect(theirs.deck).toHaveLength(s.players.P2.deck.length);
    expect(theirs.deck.every(c => c.hidden)).toBe(true);
  });

  it("hides the rng seed so future rolls cannot be predicted", () => {
    const s = base();
    expect(viewFor(s, "P1").rngSeed).toBe(0);
    expect(viewFor(s, "P2").rngSeed).toBe(0);
  });

  it("keeps public information visible", () => {
    const s = base();
    const theirs = viewFor(s, "P1").players.P2;
    expect(theirs.leader.currentHp).toBe(s.players.P2.leader.currentHp);
    expect(theirs.energy).toBe(s.players.P2.energy);
    expect(theirs.domainMeter).toBe(s.players.P2.domainMeter);
    expect(theirs.board).toEqual(s.players.P2.board);
  });

  it("is symmetric, so P2 sees P1 redacted the same way", () => {
    const s = base();
    const view = viewFor(s, "P2");
    expect(view.players.P1.hand.every(c => c.hidden)).toBe(true);
    expect(view.players.P2.hand.every(c => !c.hidden)).toBe(true);
  });
});
