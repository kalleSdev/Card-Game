import { describe, it, expect, beforeEach } from "vitest";
import { PACKS, PRINTS, DUPLICATE_VALUE, craftCost, berriesForMatch } from "@cg/meta";
import { db } from "./db.js";
import {
  walletOf, moveCurrency, printsOf, copiesOf, unopenedPacks, grantPack,
  openOwnedPack, replayPack, buyPack, payOutMatch, scrapSpares, craftPrint,
} from "./packs.js";

// Runs against whatever DB_PATH points at, which vitest sets to :memory:. Each
// test gets a fresh user rather than a fresh database, so nothing leaks between
// them without needing to tear the schema down.
let seq = 0;
function freshUser(): string {
  const id = `u${++seq}-${Math.random().toString(36).slice(2)}`;
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, id, "x", Date.now());
  return id;
}

let user: string;
beforeEach(() => { user = freshUser(); });

describe("the wallet", () => {
  it("starts empty and creates itself on first look", () => {
    expect(walletOf(user)).toEqual({ berries: 0, stardust: 0 });
  });

  it("adds and spends, and writes every movement down", () => {
    moveCurrency(user, "berries", 500, "matchReward");
    moveCurrency(user, "berries", -170, "packPurchase", "goldCard");
    expect(walletOf(user).berries).toBe(330);

    const entries = db.prepare("SELECT amount, reason FROM ledger WHERE user_id = ? ORDER BY at, amount")
      .all(user) as { amount: number; reason: string }[];
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.reason).sort()).toEqual(["matchReward", "packPurchase"]);
  });

  it("refuses to go negative", () => {
    moveCurrency(user, "berries", 50, "matchReward");
    expect(() => moveCurrency(user, "berries", -100, "packPurchase")).toThrow(/Not enough/);
    expect(walletOf(user).berries).toBe(50);
  });

  it("keeps the two currencies apart", () => {
    moveCurrency(user, "stardust", 300, "duplicateDusted");
    expect(walletOf(user)).toEqual({ berries: 0, stardust: 300 });
  });
});

describe("earning and opening packs", () => {
  it("hands out a pack that is not yet rolled", () => {
    const pack = grantPack(user, "goldCard", "matchWin");
    const row = db.prepare("SELECT seed, contents, opened_at FROM packs WHERE id = ?").get(pack.id) as {
      seed: number | null; contents: string | null; opened_at: number | null;
    };
    // Nothing about the contents exists until the player opens it
    expect(row.seed).toBeNull();
    expect(row.contents).toBeNull();
    expect(row.opened_at).toBeNull();
  });

  it("rolls on opening and files what came out", () => {
    const pack = grantPack(user, "goldCard", "matchWin");
    const opened = openOwnedPack(user, pack.id);

    expect(opened.pulls).toHaveLength(PACKS.goldCard.pulls);
    const copies = printsOf(user).reduce((n, r) => n + r.copies, 0);
    expect(copies).toBe(PACKS.goldCard.pulls);
  });

  it("says which pulls were the first of their print", () => {
    const first = openOwnedPack(user, grantPack(user, "goldCard", "matchWin").id);
    expect(first.isNew.some(Boolean)).toBe(true);

    // Everything in the first pack is now held, so a replay of the same seed
    // would be all duplicates
    for (const pull of first.pulls) {
      if (pull.kind === "card") expect(copiesOf(user, pull.cardId, pull.print)).toBeGreaterThan(0);
    }
  });

  it("will not open the same pack twice", () => {
    const pack = grantPack(user, "silverCard", "matchLoss");
    openOwnedPack(user, pack.id);
    expect(() => openOwnedPack(user, pack.id)).toThrow(/already open/);
  });

  it("will not open somebody else's pack", () => {
    const other = freshUser();
    const pack = grantPack(other, "goldCard", "matchWin");
    expect(() => openOwnedPack(user, pack.id)).toThrow(/No such pack/);
    expect(printsOf(user)).toHaveLength(0);
  });

  it("drops an opened pack out of the unopened list", () => {
    const pack = grantPack(user, "goldCard", "matchWin");
    expect(unopenedPacks(user)).toHaveLength(1);
    openOwnedPack(user, pack.id);
    expect(unopenedPacks(user)).toHaveLength(0);
  });

  it("replays an opened pack to exactly what it was", () => {
    const pack = grantPack(user, "goldCard", "matchWin");
    const opened = openOwnedPack(user, pack.id);
    const again = replayPack(user, pack.id);
    expect(again?.seed).toBe(opened.seed);
    expect(again?.pulls).toEqual(opened.pulls);
  });

  it("has nothing to replay for a pack still sealed", () => {
    const pack = grantPack(user, "goldCard", "matchWin");
    expect(replayPack(user, pack.id)).toBeNull();
  });

  it("gives a cosmetic pack cosmetics rather than cards", () => {
    const opened = openOwnedPack(user, grantPack(user, "goldCosmetic", "matchWin").id);
    expect(opened.pulls.every(p => p.kind === "cosmetic")).toBe(true);
    // Cosmetics are not prints, so nothing lands in the binder yet
    expect(printsOf(user)).toHaveLength(0);
  });
});

describe("what a match pays", () => {
  it("pays the winner two packs and the win bonus", () => {
    const payout = payOutMatch(user, true);
    expect(payout.packs.map(p => p.packId)).toEqual(["goldCard", "goldCosmetic"]);
    expect(payout.berries).toBe(berriesForMatch(true));
    expect(walletOf(user).berries).toBe(berriesForMatch(true));
  });

  it("pays the loser one pack and the finish payout", () => {
    const payout = payOutMatch(user, false);
    expect(payout.packs.map(p => p.packId)).toEqual(["silverCard"]);
    expect(payout.berries).toBe(berriesForMatch(false));
  });

  it("stacks up over several matches", () => {
    payOutMatch(user, true);
    payOutMatch(user, false);
    expect(unopenedPacks(user)).toHaveLength(3);
  });
});

describe("buying packs", () => {
  it("takes the price and hands over the pack", () => {
    moveCurrency(user, "berries", 1000, "matchReward");
    const pack = buyPack(user, "diamondCard");
    expect(walletOf(user).berries).toBe(1000 - (PACKS.diamondCard.price as number));
    expect(unopenedPacks(user).map(p => p.id)).toContain(pack.id);
  });

  it("refuses when the money is not there, and hands over nothing", () => {
    moveCurrency(user, "berries", 10, "matchReward");
    expect(() => buyPack(user, "diamondCard")).toThrow(/Not enough/);
    expect(walletOf(user).berries).toBe(10);
    expect(unopenedPacks(user)).toHaveLength(0);
  });
});

describe("scrapping spares", () => {
  function give(cardId: string, print: (typeof PRINTS)[number], times: number) {
    for (let i = 0; i < times; i++) {
      db.prepare(
        `INSERT INTO prints (user_id, card_id, print_id, copies, first_at) VALUES (?, ?, ?, 1, ?)
         ON CONFLICT (user_id, card_id, print_id) DO UPDATE SET copies = copies + 1`,
      ).run(user, cardId, print, Date.now());
    }
  }

  it("pays the print rate and removes the spares", () => {
    give("luffy", "altArt", 4);
    const result = scrapSpares(user, "luffy", "altArt", 2, "dust");
    expect(result.removed).toBe(2);
    expect(result.gained).toBe(DUPLICATE_VALUE.altArt.stardust * 2);
    expect(copiesOf(user, "luffy", "altArt")).toBe(2);
    expect(walletOf(user).stardust).toBe(result.gained);
  });

  it("never takes the last copy, however many are asked for", () => {
    give("luffy", "base", 1);
    const result = scrapSpares(user, "luffy", "base", 99, "sell");
    expect(result.removed).toBe(0);
    expect(result.gained).toBe(0);
    expect(copiesOf(user, "luffy", "base")).toBe(1);
    expect(walletOf(user).berries).toBe(0);
  });

  it("sells for Berries and dusts for Stardust", () => {
    give("zoro", "secret", 3);
    scrapSpares(user, "zoro", "secret", 1, "sell");
    scrapSpares(user, "zoro", "secret", 1, "dust");
    expect(walletOf(user)).toEqual({
      berries: DUPLICATE_VALUE.secret.berries,
      stardust: DUPLICATE_VALUE.secret.stardust,
    });
    expect(copiesOf(user, "zoro", "secret")).toBe(1);
  });
});

describe("crafting", () => {
  it("spends the dust and adds the print", () => {
    const cost = craftCost("altArt") as number;
    moveCurrency(user, "stardust", cost, "duplicateDusted");
    craftPrint(user, "luffy", "altArt");
    expect(copiesOf(user, "luffy", "altArt")).toBe(1);
    expect(walletOf(user).stardust).toBe(0);
  });

  it("refuses a print with no price, and takes nothing", () => {
    moveCurrency(user, "stardust", 99999, "duplicateDusted");
    for (const print of PRINTS) {
      if (print === "altArt") continue;
      expect(() => craftPrint(user, "luffy", print)).toThrow(/cannot be crafted/);
    }
    expect(walletOf(user).stardust).toBe(99999);
  });

  it("refuses when the dust is short, and adds nothing", () => {
    moveCurrency(user, "stardust", 10, "duplicateDusted");
    expect(() => craftPrint(user, "luffy", "altArt")).toThrow(/Not enough/);
    expect(copiesOf(user, "luffy", "altArt")).toBe(0);
    expect(walletOf(user).stardust).toBe(10);
  });
});
