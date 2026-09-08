import { describe, it, expect } from "vitest";
import {
  EMPTY_COLLECTION, addPull, countOf, owns, sparesOf, printsOwnedOf, bestPrintOf,
  removeSpares, scrapSpares, valueOfAllSpares, entriesOf, statsFor,
  DECK_RULES, emptyDeck, deckIsComplete, deckProblems, describeProblem, printForDeck,
  binderOrder, bestTierOf,
  DUPLICATE_VALUE, PRINTS,
  type Collection,
} from "./index";

const POOL = ["luffy", "zoro", "nami", "usopp"];
const NAMES: Record<string, string> = {
  luffy: "Monkey D. Luffy", zoro: "Roronoa Zoro", nami: "Nami", usopp: "Usopp",
};
const nameOf = (id: string) => NAMES[id] ?? id;

function build(entries: [string, string, number][]): Collection {
  const out: Collection = {};
  for (const [card, print, count] of entries) out[`${card}:${print}`] = count;
  return out;
}

describe("holding prints", () => {
  it("starts with nothing", () => {
    expect(countOf(EMPTY_COLLECTION, "luffy", "base")).toBe(0);
    expect(owns(EMPTY_COLLECTION, "luffy", "base")).toBe(false);
    expect(bestPrintOf(EMPTY_COLLECTION, "luffy")).toBeNull();
  });

  it("counts the first of a print as new and the rest as spares", () => {
    const first = addPull(EMPTY_COLLECTION, "luffy", "base");
    expect(first.isNew).toBe(true);
    expect(sparesOf(first.collection, "luffy", "base")).toBe(0);

    const second = addPull(first.collection, "luffy", "base");
    expect(second.isNew).toBe(false);
    expect(countOf(second.collection, "luffy", "base")).toBe(2);
    expect(sparesOf(second.collection, "luffy", "base")).toBe(1);
  });

  it("treats the same card in a different print as a different thing", () => {
    let c = addPull(EMPTY_COLLECTION, "luffy", "base").collection;
    c = addPull(c, "luffy", "secret").collection;
    expect(countOf(c, "luffy", "base")).toBe(1);
    expect(countOf(c, "luffy", "secret")).toBe(1);
    expect(printsOwnedOf(c, "luffy").map(e => e.print)).toEqual(["secret", "base"]);
  });

  it("shows the best print held", () => {
    const c = build([["luffy", "base", 3], ["luffy", "foil", 1], ["luffy", "signed", 1]]);
    expect(bestPrintOf(c, "luffy")).toBe("signed");
    expect(bestTierOf(c, "luffy")).toBe(6);
    expect(bestTierOf(c, "zoro")).toBeNull();
  });

  it("never leaves an entry it does not hold in the listing", () => {
    const c = build([["luffy", "base", 0], ["zoro", "foil", 2]]);
    expect(entriesOf(c).map(e => e.cardId)).toEqual(["zoro"]);
  });

  it("ignores a key naming a print that does not exist", () => {
    const c = { "luffy:sparkly": 4, "zoro:base": 1 } as Collection;
    expect(entriesOf(c).map(e => e.cardId)).toEqual(["zoro"]);
  });
});

describe("scrapping spares", () => {
  it("never removes the last copy", () => {
    const c = build([["luffy", "base", 1]]);
    const { collection, removed } = removeSpares(c, "luffy", "base", 5);
    expect(removed).toBe(0);
    expect(countOf(collection, "luffy", "base")).toBe(1);
  });

  it("removes no more spares than are there", () => {
    const c = build([["luffy", "base", 4]]);
    const { collection, removed } = removeSpares(c, "luffy", "base", 10);
    expect(removed).toBe(3);
    expect(countOf(collection, "luffy", "base")).toBe(1);
  });

  it("pays the print rate for dusting and for selling", () => {
    const c = build([["luffy", "altArt", 3]]);
    const dusted = scrapSpares(c, "luffy", "altArt", 2, "dust");
    expect(dusted.removed).toBe(2);
    expect(dusted.gained).toBe(DUPLICATE_VALUE.altArt.stardust * 2);

    const sold = scrapSpares(c, "luffy", "altArt", 2, "sell");
    expect(sold.gained).toBe(DUPLICATE_VALUE.altArt.berries * 2);
  });

  it("pays nothing and changes nothing when there is nothing spare", () => {
    const c = build([["luffy", "base", 1]]);
    const result = scrapSpares(c, "luffy", "base", 3, "dust");
    expect(result.gained).toBe(0);
    expect(result.collection).toBe(c);
  });

  it("values the whole pile of spares without counting the keepers", () => {
    const c = build([["luffy", "base", 3], ["zoro", "signed", 1], ["nami", "foil", 2]]);
    const value = valueOfAllSpares(c);
    expect(value.stardust).toBe(2 * DUPLICATE_VALUE.base.stardust + 1 * DUPLICATE_VALUE.foil.stardust);
    expect(value.berries).toBe(2 * DUPLICATE_VALUE.base.berries + 1 * DUPLICATE_VALUE.foil.berries);
  });
});

describe("collection stats", () => {
  it("counts cards, prints, copies and spares separately", () => {
    const c = build([
      ["luffy", "base", 3],
      ["luffy", "foil", 1],
      ["zoro", "secret", 2],
    ]);
    const stats = statsFor(c, POOL);
    expect(stats.cardsOwned).toBe(2);
    expect(stats.cardsTotal).toBe(4);
    expect(stats.printsOwned).toBe(3);
    expect(stats.printsTotal).toBe(4 * PRINTS.length);
    expect(stats.copiesHeld).toBe(6);
    expect(stats.spares).toBe(3);
  });

  it("reports completion against every print of every card", () => {
    const full: Collection = {};
    for (const card of POOL) for (const print of PRINTS) full[`${card}:${print}`] = 1;
    expect(statsFor(full, POOL).completion).toBe(1);
    expect(statsFor(EMPTY_COLLECTION, POOL).completion).toBe(0);
  });

  it("does not count a card that has left the pool", () => {
    const c = build([["retired", "signed", 1], ["luffy", "base", 1]]);
    const stats = statsFor(c, POOL);
    expect(stats.cardsOwned).toBe(1);
    expect(stats.printsOwned).toBe(1);
  });

  it("survives an empty pool without dividing by zero", () => {
    expect(statsFor(EMPTY_COLLECTION, []).completion).toBe(0);
  });
});

describe("decks", () => {
  const owned = (() => {
    const c: Collection = {};
    for (const card of POOL) c[`${card}:base`] = 1;
    return c;
  })();

  it("starts empty and incomplete", () => {
    const deck = emptyDeck("d1", "Straw Hats");
    expect(deck.cardIds).toEqual([]);
    expect(deckIsComplete(deck)).toBe(false);
  });

  it("asks for a leader and the right number of cards", () => {
    const deck = emptyDeck("d1", "Straw Hats");
    const problems = deckProblems(deck, owned);
    expect(problems.map(p => p.kind)).toContain("noLeader");
    expect(problems.map(p => p.kind)).toContain("wrongSize");
  });

  it("counts a full deck as complete", () => {
    const deck = {
      ...emptyDeck("d1", "Straw Hats"),
      leaderId: "luffy",
      cardIds: Array.from({ length: DECK_RULES.cards }, () => "zoro"),
    };
    expect(deckIsComplete(deck)).toBe(true);
  });

  it("objects to the same card twice", () => {
    const deck = { ...emptyDeck("d1", "x"), leaderId: "luffy", cardIds: ["zoro", "zoro"] };
    expect(deckProblems(deck, owned).some(p => p.kind === "duplicate")).toBe(true);
  });

  it("objects to a card that is not owned", () => {
    const deck = { ...emptyDeck("d1", "x"), leaderId: "luffy", cardIds: ["stranger"] };
    expect(deckProblems(deck, owned).some(p => p.kind === "notOwned")).toBe(true);
  });

  it("says what is wrong in words a player can act on", () => {
    expect(describeProblem({ kind: "noLeader" }, nameOf)).toBe("Pick a leader");
    expect(describeProblem({ kind: "wrongSize", have: 10, want: 12 }, nameOf)).toBe("Add 2 more cards");
    expect(describeProblem({ kind: "wrongSize", have: 13, want: 12 }, nameOf)).toBe("Remove 1 card");
    expect(describeProblem({ kind: "duplicate", cardId: "zoro" }, nameOf)).toContain("Roronoa Zoro");
    expect(describeProblem({ kind: "notOwned", cardId: "nami" }, nameOf)).toContain("Nami");
  });

  it("shows the chosen print, or falls back when it is no longer held", () => {
    const c = build([["luffy", "base", 1], ["luffy", "secret", 1]]);
    const deck = { ...emptyDeck("d1", "x"), prints: { luffy: "secret" as const } };
    expect(printForDeck(deck, c, "luffy")).toBe("secret");

    const gone = { ...emptyDeck("d1", "x"), prints: { luffy: "signed" as const } };
    expect(printForDeck(gone, c, "luffy")).toBe("secret");
  });
});

describe("binder order", () => {
  it("puts the best prints first and the missing cards last", () => {
    const c = build([["nami", "secret", 1], ["zoro", "base", 1]]);
    expect(binderOrder(c, POOL, nameOf)).toEqual(["nami", "zoro", "luffy", "usopp"]);
  });

  it("breaks a tie by name so the order never jitters", () => {
    const c = build([["luffy", "base", 1], ["zoro", "base", 1]]);
    const order = binderOrder(c, ["zoro", "luffy"], nameOf);
    expect(order).toEqual(["luffy", "zoro"]);
  });
});
