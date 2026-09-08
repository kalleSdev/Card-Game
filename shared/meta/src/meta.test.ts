import { describe, it, expect } from "vitest";
import {
  PRINTS, PRINT_INFO, PRINTS_BY_TIER, printKey, parsePrintKey, printRank,
  STANDARD_RATES, DIAMOND_RATES, PACKS, openPack, effectiveRate, tierRates,
  CATEGORY_WEIGHTS, MATCH_REWARDS,
  DUPLICATE_VALUE, craftCost, isCraftable, berriesForMatch, applyToWallet, canAfford, EMPTY_WALLET,
  RANKS, rankForMmr, nextMmr, breakEvenWinRate, displayRank, leaderboardRank,
  makeRng, assertSumsTo100,
} from "./index";

const POOL = ["luffy", "zoro", "nami", "usopp", "sanji", "chopper", "robin", "franky"];

describe("prints", () => {
  it("has one standard and one variant for the tiers that split", () => {
    expect(PRINTS_BY_TIER[3]).toHaveLength(1);
    expect(PRINTS_BY_TIER[4]).toHaveLength(1);
    expect(PRINTS_BY_TIER[5]).toHaveLength(2);
    expect(PRINTS_BY_TIER[6]).toHaveLength(2);
  });

  it("marks exactly the second print of a split tier as the variant", () => {
    expect(PRINT_INFO.blackLabel.isVariant).toBe(true);
    expect(PRINT_INFO.signed.isVariant).toBe(true);
    expect(PRINT_INFO.altArt.isVariant).toBe(false);
    expect(PRINT_INFO.secret.isVariant).toBe(false);
  });

  it("round trips a print key, even for a card id with a colon in it", () => {
    const key = printKey("straw:hat", "signed");
    expect(parsePrintKey(key)).toEqual({ cardId: "straw:hat", print: "signed" });
  });

  it("returns nothing for a key naming a print that does not exist", () => {
    expect(parsePrintKey("luffy:holographic")).toBeNull();
    expect(parsePrintKey("luffy")).toBeNull();
  });

  it("orders prints worst to best", () => {
    const sorted = [...PRINTS].sort((a, b) => printRank(a) - printRank(b));
    expect(sorted).toEqual(["base", "foil", "altArt", "blackLabel", "secret", "signed"]);
  });
});

describe("rate tables", () => {
  it("sums both card tables to 100", () => {
    expect(() => assertSumsTo100("standard", Object.values(STANDARD_RATES))).not.toThrow();
    expect(() => assertSumsTo100("diamond", Object.values(DIAMOND_RATES))).not.toThrow();
  });

  it("sums every cosmetic category table to 100", () => {
    for (const [tier, weights] of Object.entries(CATEGORY_WEIGHTS)) {
      expect(() => assertSumsTo100(tier, Object.values(weights) as number[])).not.toThrow();
    }
  });

  it("makes diamond better than standard on every print above base", () => {
    for (const print of PRINTS) {
      if (print === "base") expect(DIAMOND_RATES[print]).toBeLessThan(STANDARD_RATES[print]);
      else expect(DIAMOND_RATES[print]).toBeGreaterThan(STANDARD_RATES[print]);
    }
  });

  it("quotes a rate straight off the table", () => {
    expect(effectiveRate("base", STANDARD_RATES)).toBe(90);
    expect(effectiveRate("altArt", STANDARD_RATES)).toBe(2);
    expect(effectiveRate("signed", STANDARD_RATES)).toBe(0.02);
    expect(effectiveRate("signed", DIAMOND_RATES)).toBe(0.1);
  });

  it("rolls the six print rates up into four tier rates", () => {
    const standard = tierRates(STANDARD_RATES);
    expect(standard[3]).toBeCloseTo(90, 6);
    expect(standard[4]).toBeCloseTo(7.5, 6);
    expect(standard[5]).toBeCloseTo(2.3, 6);
    expect(standard[6]).toBeCloseTo(0.2, 6);
    expect(Object.values(standard).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(Object.values(tierRates(DIAMOND_RATES)).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  it("keeps a variant rarer than the print it sits beside", () => {
    for (const rates of [STANDARD_RATES, DIAMOND_RATES]) {
      expect(rates.blackLabel).toBeLessThan(rates.altArt);
      expect(rates.signed).toBeLessThan(rates.secret);
    }
  });
});

describe("opening packs", () => {
  it("gives the advertised number of pulls", () => {
    for (const pack of Object.values(PACKS)) {
      expect(openPack(pack.id, POOL, 1).pulls).toHaveLength(pack.pulls);
    }
  });

  it("gives the same pack back for the same seed", () => {
    expect(openPack("goldCard", POOL, 12345)).toEqual(openPack("goldCard", POOL, 12345));
  });

  it("gives different packs for different seeds", () => {
    const a = JSON.stringify(openPack("goldCard", POOL, 1).pulls);
    const b = JSON.stringify(openPack("goldCard", POOL, 2).pulls);
    expect(a).not.toBe(b);
  });

  it("only ever pulls cards that are in the pool", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const pull of openPack("goldCard", POOL, seed).pulls) {
        if (pull.kind === "card") expect(POOL).toContain(pull.cardId);
      }
    }
  });

  it("refuses to open a card pack with nothing to pull from", () => {
    expect(() => openPack("goldCard", [], 1)).toThrow(/empty pool/);
  });

  it("only produces categories the tier is allowed to hold", () => {
    for (let seed = 1; seed <= 500; seed++) {
      for (const pull of openPack("diamondCosmetic", POOL, seed).pulls) {
        if (pull.kind !== "cosmetic") throw new Error("cosmetic pack gave a card");
        expect(Object.keys(CATEGORY_WEIGHTS[pull.tier])).toContain(pull.category);
      }
    }
  });

  it("never puts a finisher or an arena below 5 stars", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      for (const pull of openPack("goldCosmetic", POOL, seed).pulls) {
        if (pull.kind === "cosmetic" && (pull.category === "finisher" || pull.category === "arena")) {
          expect(pull.tier).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it("lands within a whisker of the published odds over a hundred thousand pulls", () => {
    const seen: Record<string, number> = {};
    let pulls = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      for (const pull of openPack("goldCard", POOL, seed).pulls) {
        if (pull.kind !== "card") continue;
        seen[pull.print] = (seen[pull.print] ?? 0) + 1;
        pulls++;
      }
    }
    expect(pulls).toBe(100_000);
    // Base and foil are common enough to pin tightly
    expect(((seen.base ?? 0) / pulls) * 100).toBeCloseTo(90, 0);
    expect(((seen.foil ?? 0) / pulls) * 100).toBeCloseTo(7.5, 0);
    // The rare prints get a wider window: a hundred thousand pulls only expects
    // about 20 signed cards, so exact agreement would be a fluke
    expect(((seen.altArt ?? 0) / pulls) * 100).toBeGreaterThan(1.7);
    expect(((seen.altArt ?? 0) / pulls) * 100).toBeLessThan(2.3);
    expect(seen.blackLabel ?? 0).toBeGreaterThan(200);
    expect(seen.secret ?? 0).toBeGreaterThan(100);
    expect(seen.signed ?? 0).toBeGreaterThan(5);
  });

  it("prices every pack, and bundles the diamond cosmetics", () => {
    for (const pack of Object.values(PACKS)) {
      expect(pack.price).not.toBeNull();
      expect(pack.price as number).toBeGreaterThan(0);
    }
    // Five single cosmetic packs cost more than the five pack, so the bundle is
    // the better buy on odds and on price
    expect((PACKS.goldCosmetic.price as number) * 5).toBeGreaterThan(PACKS.diamondCosmetic.price as number);
  });

  it("gives the winner two packs and the loser one", () => {
    expect(MATCH_REWARDS.winner).toEqual(["goldCard", "goldCosmetic"]);
    expect(MATCH_REWARDS.loser).toEqual(["silverCard"]);
  });
});

describe("duplicates and currency", () => {
  it("is worth more the better the print", () => {
    const order = PRINTS.map(p => DUPLICATE_VALUE[p].stardust);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });

  it("only prices the plain alt art for crafting", () => {
    expect(craftCost("altArt")).toBe(1500);
    for (const print of PRINTS) {
      if (print !== "altArt") expect(isCraftable(print)).toBe(false);
    }
  });

  it("pays a win more than a loss, and the first win of the day most", () => {
    expect(berriesForMatch(false)).toBe(40);
    expect(berriesForMatch(true)).toBe(150);
    expect(berriesForMatch(true, true)).toBe(300);
    expect(berriesForMatch(false, true)).toBe(40);
  });

  it("refuses to spend money that is not there", () => {
    const wallet = { berries: 100, stardust: 0 };
    expect(canAfford(wallet, "berries", 90)).toBe(true);
    expect(canAfford(wallet, "berries", 300)).toBe(false);
    expect(() => applyToWallet(wallet, "berries", -300)).toThrow(/Not enough/);
    expect(applyToWallet(wallet, "berries", -90)).toEqual({ berries: 10, stardust: 0 });
  });

  it("starts everyone at nothing", () => {
    expect(EMPTY_WALLET).toEqual({ berries: 0, stardust: 0 });
  });

  it("takes about fifteen gold packs of dusting to craft an alt art", () => {
    const perPack = 10 * PRINTS.reduce(
      (sum, print) => sum + (STANDARD_RATES[print] / 100) * DUPLICATE_VALUE[print].stardust,
      0,
    );
    const cost = craftCost("altArt");
    expect(cost).not.toBeNull();
    const packs = (cost as number) / perPack;
    expect(packs).toBeGreaterThan(12);
    expect(packs).toBeLessThan(18);
  });
});

describe("the ladder", () => {
  it("leaves no gap between ranks", () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].floor).toBe((RANKS[i - 1].ceiling ?? 0) + 1);
    }
    expect(RANKS[RANKS.length - 1].ceiling).toBeNull();
  });

  it("puts every MMR in exactly one rank", () => {
    expect(rankForMmr(0).id).toBe("iron");
    expect(rankForMmr(29).id).toBe("iron");
    expect(rankForMmr(30).id).toBe("bronze");
    expect(rankForMmr(119).id).toBe("gold");
    expect(rankForMmr(120).id).toBe("platinum");
    expect(rankForMmr(209).id).toBe("diamond");
    expect(rankForMmr(210).id).toBe("master");
    expect(rankForMmr(9999).id).toBe("master");
  });

  it("bites harder the higher you climb", () => {
    expect(nextMmr(100, false)).toBe(95);
    expect(nextMmr(130, false)).toBe(123);
    expect(nextMmr(250, false)).toBe(242);
    expect(nextMmr(100, true)).toBe(110);
  });

  it("never drops anyone below zero", () => {
    expect(nextMmr(0, false)).toBe(0);
    expect(nextMmr(3, false)).toBe(0);
  });

  it("needs a better win rate to hold station further up", () => {
    expect(breakEvenWinRate(50)).toBeCloseTo(1 / 3, 3);
    expect(breakEvenWinRate(130)).toBeCloseTo(7 / 17, 3);
    expect(breakEvenWinRate(250)).toBeCloseTo(8 / 18, 3);
  });

  it("hands the leaderboard ranks to the top five only", () => {
    expect(leaderboardRank(0, 300)).toBe("pirateKing");
    expect(leaderboardRank(1, 300)).toBe("emperor");
    expect(leaderboardRank(4, 300)).toBe("emperor");
    expect(leaderboardRank(5, 300)).toBeNull();
  });

  it("will not hand a leaderboard rank to someone below Master", () => {
    expect(leaderboardRank(0, 209)).toBeNull();
    expect(displayRank(209, 0).id).toBe("diamond");
  });

  it("shows the leaderboard rank ahead of the threshold rank", () => {
    expect(displayRank(400, 0).name).toBe("Pirate King");
    expect(displayRank(400, 2).name).toBe("Emperor");
    expect(displayRank(400, 9).name).toBe("Master");
    expect(displayRank(400, null).name).toBe("Master");
  });
});

describe("the roller itself", () => {
  it("produces the same stream for the same seed", () => {
    const a = makeRng(99);
    const b = makeRng(99);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it("stays inside zero and one", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it("rejects a table that does not sum to 100", () => {
    expect(() => assertSumsTo100("broken", [60, 30, 5, 1])).toThrow(/must sum to 100, got 96/);
  });
});
