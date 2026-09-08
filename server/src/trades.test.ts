import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db.js";
import { copiesOf, moveCurrency, walletOf } from "./packs.js";
import {
  openTrade, joinTrade, cancelTrade, setOffer, confirmTrade, openTradeFor, historyFor,
} from "./trades.js";

let seq = 0;
function freshUser(name?: string): string {
  const id = `t${++seq}-${Math.random().toString(36).slice(2)}`;
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, name ?? id, "x", Date.now());
  return id;
}

/** Puts cards straight into the binder, so a test does not need a pack. */
function give(userId: string, cardId: string, print: string, copies = 1): void {
  db.prepare(
    `INSERT INTO prints (user_id, card_id, print_id, copies, first_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, card_id, print_id) DO UPDATE SET copies = copies + excluded.copies`,
  ).run(userId, cardId, print, copies, Date.now());
}

let ann: string;
let bo: string;

beforeEach(() => {
  ann = freshUser();
  bo = freshUser();
});

/** Two people at one table, which is the starting point for most of these. */
function seated(): string {
  const trade = openTrade(ann);
  joinTrade(bo, trade.code);
  return trade.id;
}

describe("opening a table", () => {
  it("hands out a code and seats nobody else yet", () => {
    const trade = openTrade(ann);
    expect(trade.code).toHaveLength(5);
    expect(trade.them).toBeNull();
    expect(trade.you.offer).toEqual({ prints: [], berries: 0 });
  });

  it("only lets a player have one going at a time", () => {
    openTrade(ann);
    expect(() => openTrade(ann)).toThrow(/already have a trade/i);
  });

  it("takes a code however it is typed", () => {
    const trade = openTrade(ann);
    const joined = joinTrade(bo, `  ${trade.code.toLowerCase()} `);
    expect(joined.id).toBe(trade.id);
    expect(joined.them?.userId).toBe(ann);
  });

  it("refuses a code that is wrong, taken, or your own", () => {
    const trade = openTrade(ann);
    expect(() => joinTrade(bo, "ZZZZZ")).toThrow(/no trade with that code/i);

    joinTrade(bo, trade.code);
    expect(() => joinTrade(freshUser(), trade.code)).toThrow(/already at that table/i);

    // The host walking into their own code is caught before anything else,
    // since they are already sitting at it
    const alone = openTrade(freshUser());
    const host = db.prepare("SELECT a_user FROM trades WHERE id = ?").get(alone.id) as { a_user: string };
    expect(() => joinTrade(host.a_user, alone.code)).toThrow(/already have a trade/i);
  });

  it("shows each side its own half", () => {
    const id = seated();
    give(ann, "gojo", "foil");
    setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 1 }], berries: 0 });

    expect(openTradeFor(ann)?.you.offer.prints).toHaveLength(1);
    expect(openTradeFor(bo)?.them?.offer.prints).toHaveLength(1);
    expect(openTradeFor(bo)?.you.offer.prints).toHaveLength(0);
  });

  it("keeps a stranger out of the table entirely", () => {
    const id = seated();
    const nosy = freshUser();
    expect(() => setOffer(nosy, id, { prints: [], berries: 0 })).toThrow(/not yours/i);
    expect(() => cancelTrade(nosy, id)).toThrow(/not yours/i);
  });
});

describe("staging an offer", () => {
  it("refuses cards the player does not hold", () => {
    const id = seated();
    expect(() =>
      setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 1 }], berries: 0 }),
    ).toThrow(/no longer owns/i);
  });

  it("refuses more copies than are held", () => {
    const id = seated();
    give(ann, "gojo", "foil", 2);
    expect(() =>
      setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 3 }], berries: 0 }),
    ).toThrow(/no longer owns/i);
  });

  it("refuses Berries the player does not have", () => {
    const id = seated();
    moveCurrency(ann, "berries", 50, "matchReward");
    expect(() => setOffer(ann, id, { prints: [], berries: 51 })).toThrow(/Berries/i);
  });

  it("folds the same card offered twice into one line", () => {
    const id = seated();
    give(ann, "gojo", "foil", 3);
    const trade = setOffer(ann, id, {
      prints: [
        { cardId: "gojo", print: "foil", count: 1 },
        { cardId: "gojo", print: "foil", count: 2 },
      ],
      berries: 0,
    });
    expect(trade.you.offer.prints).toEqual([{ cardId: "gojo", print: "foil", count: 3 }]);
  });

  it("refuses a print that does not exist", () => {
    const id = seated();
    expect(() =>
      setOffer(ann, id, { prints: [{ cardId: "gojo", print: "sparkly" as never, count: 1 }], berries: 0 }),
    ).toThrow(/not a card you can offer/i);
  });
});

describe("the confirmation reset", () => {
  it("clears both sides whenever either offer changes", () => {
    const id = seated();
    give(ann, "gojo", "foil");
    give(bo, "sukuna", "base");

    confirmTrade(ann, id);
    let trade = confirmTrade(bo, id);
    // Both empty offers, so that pair went through
    expect(trade.state).toBe("done");

    // A second table, this time edited between the confirmations
    const next = openTrade(ann);
    joinTrade(bo, next.code);
    setOffer(ann, next.id, { prints: [{ cardId: "gojo", print: "foil", count: 1 }], berries: 0 });
    confirmTrade(ann, next.id);
    expect(openTradeFor(ann)?.you.confirmed).toBe(true);

    // Bo changes their side: Ann's confirmation must not survive it
    setOffer(bo, next.id, { prints: [{ cardId: "sukuna", print: "base", count: 1 }], berries: 0 });
    trade = openTradeFor(ann) as NonNullable<ReturnType<typeof openTradeFor>>;
    expect(trade.you.confirmed).toBe(false);
    expect(trade.them?.confirmed).toBe(false);
    expect(trade.state).toBe("open");
  });

  it("waits for the other side before it swaps anything", () => {
    const id = seated();
    give(ann, "gojo", "foil");
    setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 1 }], berries: 0 });

    const trade = confirmTrade(ann, id);
    expect(trade.state).toBe("open");
    expect(copiesOf(ann, "gojo", "foil")).toBe(1);
  });

  it("will not confirm at a table nobody has joined", () => {
    const trade = openTrade(ann);
    expect(() => confirmTrade(ann, trade.id)).toThrow(/nobody has joined/i);
  });
});

describe("the swap", () => {
  it("moves cards and Berries both ways at once", () => {
    const id = seated();
    give(ann, "gojo", "foil", 2);
    give(bo, "sukuna", "secret");
    moveCurrency(bo, "berries", 300, "matchReward");

    setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 2 }], berries: 0 });
    setOffer(bo, id, { prints: [{ cardId: "sukuna", print: "secret", count: 1 }], berries: 120 });
    confirmTrade(ann, id);
    const done = confirmTrade(bo, id);

    expect(done.state).toBe("done");
    expect(copiesOf(ann, "gojo", "foil")).toBe(0);
    expect(copiesOf(bo, "gojo", "foil")).toBe(2);
    expect(copiesOf(ann, "sukuna", "secret")).toBe(1);
    expect(copiesOf(bo, "sukuna", "secret")).toBe(0);
    expect(walletOf(ann).berries).toBe(120);
    expect(walletOf(bo).berries).toBe(180);
  });

  it("stacks onto what the other side already owned", () => {
    const id = seated();
    give(ann, "gojo", "base", 1);
    give(bo, "gojo", "base", 4);

    setOffer(bo, id, { prints: [{ cardId: "gojo", print: "base", count: 3 }], berries: 0 });
    confirmTrade(ann, id);
    confirmTrade(bo, id);

    expect(copiesOf(ann, "gojo", "base")).toBe(4);
    expect(copiesOf(bo, "gojo", "base")).toBe(1);
  });

  it("takes nothing at all if either side can no longer back its offer", () => {
    const id = seated();
    give(ann, "gojo", "foil");
    give(bo, "sukuna", "base");
    setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 1 }], berries: 0 });
    setOffer(bo, id, { prints: [{ cardId: "sukuna", print: "base", count: 1 }], berries: 0 });
    confirmTrade(ann, id);

    // Ann's card goes somewhere else between the two confirmations
    db.prepare("UPDATE prints SET copies = 0 WHERE user_id = ? AND card_id = ?").run(ann, "gojo");

    expect(() => confirmTrade(bo, id)).toThrow(/no longer owns/i);
    expect(copiesOf(bo, "sukuna", "base")).toBe(1);
    expect(copiesOf(ann, "sukuna", "base")).toBe(0);
    expect(openTradeFor(ann)?.state).toBe("open");
  });

  it("writes the trade down, from both people's point of view", () => {
    const id = seated();
    give(ann, "gojo", "foil");
    moveCurrency(bo, "berries", 200, "matchReward");
    setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 1 }], berries: 0 });
    setOffer(bo, id, { prints: [], berries: 200 });
    confirmTrade(ann, id);
    confirmTrade(bo, id);

    const [forAnn] = historyFor(ann);
    expect(forAnn.gave.prints).toHaveLength(1);
    expect(forAnn.got.berries).toBe(200);

    const [forBo] = historyFor(bo);
    expect(forBo.gave.berries).toBe(200);
    expect(forBo.got.prints).toHaveLength(1);
    expect(forBo.id).toBe(forAnn.id);
  });

  it("closes the table, and frees both people to open another", () => {
    const id = seated();
    confirmTrade(ann, id);
    confirmTrade(bo, id);

    expect(openTradeFor(ann)).toBeNull();
    expect(openTradeFor(bo)).toBeNull();
    expect(() => confirmTrade(ann, id)).toThrow(/already closed/i);
    expect(() => openTrade(ann)).not.toThrow();
  });
});

describe("cancelling", () => {
  it("closes the table without moving anything", () => {
    const id = seated();
    give(ann, "gojo", "foil");
    setOffer(ann, id, { prints: [{ cardId: "gojo", print: "foil", count: 1 }], berries: 0 });

    cancelTrade(bo, id);
    expect(openTradeFor(ann)).toBeNull();
    expect(copiesOf(ann, "gojo", "foil")).toBe(1);
    expect(historyFor(ann)).toHaveLength(0);
    expect(() => setOffer(ann, id, { prints: [], berries: 0 })).toThrow(/already closed/i);
  });
});
