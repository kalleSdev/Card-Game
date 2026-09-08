import { describe, it, expect } from "vitest";
import { LobbyBook, normaliseCode } from "./lobbies.js";
import type { PlayerDraftResult } from "@cg/contracts";

const draft = {
  leaderId: "gojo-base", combatIds: ["yuji"], supportIds: ["todo"], extraIds: [], weaponIds: [],
} as PlayerDraftResult;

describe("lobby codes", () => {
  it("gives out a code of a readable length", () => {
    const book = new LobbyBook<string>();
    const lobby = book.create("host", "Host", draft, "jjk");
    expect(lobby.code).toMatch(/^[A-Z0-9]{5}$/);
  });

  it("leaves out characters that are easy to misread", () => {
    const book = new LobbyBook<string>();
    for (let i = 0; i < 200; i++) {
      const code = book.create(`host${i}`, "Host", draft, "jjk").code;
      expect(code).not.toMatch(/[OIU01E]/);
    }
  });

  it("finds a lobby however the code was typed", () => {
    const book = new LobbyBook<string>();
    const code = book.create("host", "Host", draft, "jjk").code;
    expect(book.find(code.toLowerCase())).toBeDefined();
    expect(book.find(` ${code} `)).toBeDefined();
    expect(book.find(code.split("").join("-"))).toBeDefined();
  });

  it("returns nothing for a code that was never handed out", () => {
    const book = new LobbyBook<string>();
    expect(book.find("ZZZZZ")).toBeUndefined();
  });

  it("only lets a host hold one lobby at a time", () => {
    const book = new LobbyBook<string>();
    const first = book.create("host", "Host", draft, "jjk");
    const second = book.create("host", "Host", draft, "jjk");
    expect(book.find(first.code)).toBeUndefined();
    expect(book.find(second.code)).toBeDefined();
    expect(book.size).toBe(1);
  });

  it("closes a lobby once it is used", () => {
    const book = new LobbyBook<string>();
    const code = book.create("host", "Host", draft, "jjk").code;
    book.close(code);
    expect(book.find(code)).toBeUndefined();
  });

  it("remembers which universe the lobby was opened for", () => {
    const book = new LobbyBook<string>();
    expect(book.create("host", "Host", draft, "jjk").universe).toBe("jjk");
  });

  it("strips anything that is not part of a code", () => {
    expect(normaliseCode(" ab-3d e ")).toBe("AB3DE");
  });
});
