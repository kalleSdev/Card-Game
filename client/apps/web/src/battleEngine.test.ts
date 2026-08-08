import { describe, it, expect, vi, afterEach } from "vitest";
import type { CardDef } from "@cg/contracts";
import type { BattleState, BattleCard, BattlePlayer, BattleIntent } from "./battleEngine";
import { createBattleState, applyBattleIntent, deriveStats, CARD_PERKS } from "./battleEngine";

// Tests for the combat engine. applyBattleIntent is pure so these just build a
// state, apply an intent and check what comes back.

// ── Fixtures ──────────────────────────────────────────────────────────────────

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    rarity: "B",
    basePoints: 1000,
    affinity: "COMBAT",
    tags: [],
    ...over,
  };
}

/** A deterministic card database covering every mechanic under test. */
const DB: Record<string, CardDef> = {
  // Leaders
  "gojo-base": card("gojo-base", { rarity: "X", affinity: "LEADER", tags: ["gojo-clan"] }),
  sukuna: card("sukuna", { rarity: "X", affinity: "LEADER" }),
  mahoraga: card("mahoraga", { rarity: "SSS", affinity: "COMBAT" }),
  higuruma: card("higuruma", { rarity: "S", affinity: "LEADER" }),
  // Board cards
  grunt: card("grunt"),
  grunt2: card("grunt2"),
  guard: card("guard", { tags: ["shield"] }),
  uro: card("uro", { rarity: "S" }),
  todo: card("todo", { rarity: "A" }),
  panda: card("panda", { rarity: "A" }),
  kurourushi: card("kurourushi", { rarity: "S", tags: ["shield"] }),
  yuji: card("yuji", { rarity: "S", tags: ["shield"] }),
};

const draft = (leaderId: string, cards: string[] = []) => ({
  leaderId,
  combatIds: cards.slice(0, 2),
  supportIds: cards.slice(2, 5),
  extraIds: cards.slice(5),
  weaponIds: [] as string[],
});

/** Build a battle where P1 acts first, with a known board layout. */
function setup(opts: {
  p1Leader?: string;
  p2Leader?: string;
  p1Board?: (string | null)[];
  p2Board?: (string | null)[];
} = {}): BattleState {
  const s = createBattleState(
    draft(opts.p1Leader ?? "gojo-base", ["grunt", "grunt2"]),
    draft(opts.p2Leader ?? "sukuna", ["grunt", "grunt2"]),
    DB,
  );

  let idc = 0;
  const place = (ids: (string | null)[] | undefined): (BattleCard | null)[] => {
    const row: (BattleCard | null)[] = [null, null, null, null, null];
    (ids ?? []).forEach((defId, i) => {
      if (!defId) return;
      const def = DB[defId];
      const st = deriveStats(def);
      row[i] = {
        instanceId: `t${++idc}-${defId}`,
        defId,
        name: def.name,
        rarity: def.rarity,
        affinity: "COMBAT",
        tags: def.tags,
        baseAtk: st.atk, baseHp: st.hp, cost: st.cost,
        atk: st.atk, currentHp: st.hp, maxHp: st.hp,
        hasTaunt: def.tags.includes("shield"),
        canAttack: true, exhausted: false, stunTurns: 0,
        tempAtkBonus: 0, tempHpBonus: 0, tempBonusTurns: 0,
      };
    });
    return row;
  };

  return {
    ...s,
    phase: "MAIN",
    activePlayer: "P1",
    players: {
      P1: { ...s.players.P1, board: place(opts.p1Board) as BattlePlayer["board"] },
      P2: { ...s.players.P2, board: place(opts.p2Board) as BattlePlayer["board"] },
    },
  };
}

const apply = (s: BattleState, i: BattleIntent) => applyBattleIntent(s, i);
const boardOf = (s: BattleState, pid: "P1" | "P2") => s.players[pid].board.filter(Boolean) as BattleCard[];
const isIllegal = (r: ReturnType<typeof apply>) => r.events.some(e => e.type === "ILLEGAL");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("setup and invariants", () => {
  it("gives both players a leader at 30 HP and a starting hand", () => {
    const s = setup();
    for (const pid of ["P1", "P2"] as const) {
      expect(s.players[pid].leader.currentHp).toBe(30);
      expect(s.players[pid].hand.length).toBeGreaterThan(0);
    }
  });

  it("does not mutate the input state", () => {
    const s = setup({ p2Board: ["grunt"] });
    const before = JSON.stringify(s);
    const target = boardOf(s, "P2")[0];
    const attacker = boardOf(s, "P1")[0] ?? s.players.P1.leader;
    const next = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: attacker.instanceId }).state;
    apply(next, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: target.instanceId });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("rejects intents from the player whose turn it is not", () => {
    const s = setup();
    expect(isIllegal(apply(s, { type: "END_TURN", pid: "P2" }))).toBe(true);
  });
});

describe("combat", () => {
  it("deals damage both ways and emits an ATTACK_CARD event", () => {
    const s = setup({ p1Board: ["grunt"], p2Board: ["grunt2"] });
    const atk = boardOf(s, "P1")[0];
    const def = boardOf(s, "P2")[0];

    const sel = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: atk.instanceId }).state;
    const res = apply(sel, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: def.instanceId });

    expect(res.events.some(e => e.type === "ATTACK_CARD")).toBe(true);
    const survivorHp = boardOf(res.state, "P2")[0]?.currentHp ?? 0;
    expect(survivorHp).toBeLessThan(def.currentHp);
  });

  it("exhausts the attacker so it cannot attack twice in a turn", () => {
    const s = setup({ p1Board: ["grunt"], p2Board: ["grunt2"] });
    const atk = boardOf(s, "P1")[0];
    const def = boardOf(s, "P2")[0];

    let st = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: atk.instanceId }).state;
    st = apply(st, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: def.instanceId }).state;

    expect(isIllegal(apply(st, { type: "SELECT_ATTACKER", pid: "P1", instanceId: atk.instanceId }))).toBe(true);
  });

  it("ends the game when a leader reaches 0 HP", () => {
    let s = setup({ p1Board: ["grunt"] });
    s = { ...s, players: { ...s.players, P2: { ...s.players.P2, leader: { ...s.players.P2.leader, currentHp: 1 } } } };
    const atk = boardOf(s, "P1")[0];

    const sel = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: atk.instanceId }).state;
    const res = apply(sel, { type: "ATTACK_LEADER", pid: "P1" });

    expect(res.state.winner).toBe("P1");
    expect(res.events.some(e => e.type === "GAME_OVER")).toBe(true);
  });
});

describe("shields (taunt)", () => {
  it("blocks attacks on the leader while a shield card is on the board", () => {
    const s = setup({ p1Board: ["grunt"], p2Board: ["guard"] });
    const atk = boardOf(s, "P1")[0];
    const sel = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: atk.instanceId }).state;

    expect(isIllegal(apply(sel, { type: "ATTACK_LEADER", pid: "P1" }))).toBe(true);
  });

  it("blocks attacks on non-shield cards while a shield card is present", () => {
    const s = setup({ p1Board: ["grunt"], p2Board: ["guard", "grunt2"] });
    const atk = boardOf(s, "P1")[0];
    const plain = boardOf(s, "P2").find(c => !c.hasTaunt)!;
    const sel = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: atk.instanceId }).state;

    expect(isIllegal(apply(sel, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: plain.instanceId }))).toBe(true);
  });

  it("allows the leader to be attacked once no shields remain", () => {
    const s = setup({ p1Board: ["grunt"], p2Board: ["grunt2"] });
    const atk = boardOf(s, "P1")[0];
    const sel = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: atk.instanceId }).state;

    const res = apply(sel, { type: "ATTACK_LEADER", pid: "P1" });
    expect(isIllegal(res)).toBe(false);
    expect(res.state.players.P2.leader.currentHp).toBeLessThan(30);
  });
});

describe("leader shields", () => {
  it("nullifies exactly one instance of damage per stack", () => {
    let s = setup({ p1Board: ["grunt", "grunt2"] });
    // Give P2 one leader shield
    s = { ...s, players: { ...s.players, P2: { ...s.players.P2, leaderShields: 1 } } };
    const [a1, a2] = boardOf(s, "P1");

    let st = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: a1.instanceId }).state;
    st = apply(st, { type: "ATTACK_LEADER", pid: "P1" }).state;

    // First hit is absorbed entirely
    expect(st.players.P2.leader.currentHp).toBe(30);
    expect(st.players.P2.leaderShields).toBe(0);

    st = apply(st, { type: "SELECT_ATTACKER", pid: "P1", instanceId: a2.instanceId }).state;
    st = apply(st, { type: "ATTACK_LEADER", pid: "P1" }).state;

    // Second hit lands
    expect(st.players.P2.leader.currentHp).toBeLessThan(30);
  });

  it("spends a shield charge when shielding the leader", () => {
    const s = setup();
    const before = s.players.P1.shieldCharges;
    const res = apply(s, { type: "GRANT_BOARD_SHIELD", pid: "P1", targetInstanceId: s.players.P1.leader.instanceId });

    expect(res.state.players.P1.leaderShields).toBe(1);
    expect(res.state.players.P1.shieldCharges).toBe(before - 1);
  });
});

describe("turn flow", () => {
  it("passes the turn and refills energy", () => {
    const s = setup();
    const res = apply(s, { type: "END_TURN", pid: "P1" });

    expect(res.state.activePlayer).toBe("P2");
    expect(res.state.players.P2.energy).toBe(res.state.players.P2.maxEnergy);
    expect(res.events.some(e => e.type === "TURN_START")).toBe(true);
  });

  it("expires an active domain when its caster's next turn begins", () => {
    let s = setup();
    s = { ...s, players: { ...s.players, P1: { ...s.players.P1, domainActive: true } } };

    // Opponent's reply turn — the domain is still up
    s = apply(s, { type: "END_TURN", pid: "P1" }).state;
    expect(s.players.P1.domainActive).toBe(true);

    // Back to the caster — it has run its course
    s = apply(s, { type: "END_TURN", pid: "P2" }).state;
    expect(s.players.P1.domainActive).toBe(false);
  });

  it("keeps a stunned card flagged for the turn it loses", () => {
    let s = setup({ p2Board: ["grunt"] });
    const victim = boardOf(s, "P2")[0];
    s = {
      ...s,
      players: {
        ...s.players,
        P2: {
          ...s.players.P2,
          board: s.players.P2.board.map(c =>
            c?.instanceId === victim.instanceId ? { ...c, stunTurns: 1, canAttack: false } : c,
          ) as BattlePlayer["board"],
        },
      },
    };

    // Hand over to P2 — the stun ticks down but the card still loses this turn
    const st = apply(s, { type: "END_TURN", pid: "P1" }).state;
    const after = boardOf(st, "P2")[0];

    expect(after.canAttack).toBe(false);
    expect(after.stunActive).toBe(true);
  });
});

describe("perks", () => {
  it("summons two spirits for Geto and marks the perk used", () => {
    const s = setup({ p1Board: ["grunt"] });
    // Re-label the board card as Geto so the perk switch matches
    const stub = boardOf(s, "P1")[0];
    const withGeto: BattleState = {
      ...s,
      players: {
        ...s.players,
        P1: {
          ...s.players.P1,
          board: s.players.P1.board.map(c =>
            c?.instanceId === stub.instanceId ? { ...c, defId: "geto" } : c,
          ) as BattlePlayer["board"],
        },
      },
    };

    const res = apply(withGeto, { type: "ACTIVATE_PERK", pid: "P1", instanceId: stub.instanceId });
    const board = boardOf(res.state, "P1");

    expect(board.filter(c => c.defId === "geto-entity")).toHaveLength(2);
    expect(board.find(c => c.instanceId === stub.instanceId)?.perkUsed).toBe(true);
    // Exactly one of the two spirits carries a Shield
    expect(board.filter(c => c.defId === "geto-entity" && c.hasTaunt)).toHaveLength(1);
  });

  it("refuses to activate the same perk twice", () => {
    const s = setup({ p1Board: ["grunt"] });
    const stub = boardOf(s, "P1")[0];
    const used: BattleState = {
      ...s,
      players: {
        ...s.players,
        P1: {
          ...s.players.P1,
          board: s.players.P1.board.map(c =>
            c?.instanceId === stub.instanceId ? { ...c, defId: "geto", perkUsed: true } : c,
          ) as BattlePlayer["board"],
        },
      },
    };

    expect(isIllegal(apply(used, { type: "ACTIVATE_PERK", pid: "P1", instanceId: stub.instanceId }))).toBe(true);
  });

  it("summoned entities cannot attack the turn they arrive", () => {
    const s = setup({ p1Board: ["grunt"] });
    const stub = boardOf(s, "P1")[0];
    const withGeto: BattleState = {
      ...s,
      players: {
        ...s.players,
        P1: {
          ...s.players.P1,
          board: s.players.P1.board.map(c =>
            c?.instanceId === stub.instanceId ? { ...c, defId: "geto" } : c,
          ) as BattlePlayer["board"],
        },
      },
    };

    const res = apply(withGeto, { type: "ACTIVATE_PERK", pid: "P1", instanceId: stub.instanceId });
    for (const spirit of boardOf(res.state, "P1").filter(c => c.defId === "geto-entity")) {
      expect(spirit.canAttack).toBe(false);
    }
  });
});

describe("content integrity", () => {
  it("every perk entry has an icon, a name and a description", () => {
    for (const [id, perk] of Object.entries(CARD_PERKS)) {
      expect(perk.icon, `${id} icon`).toBeTruthy();
      expect(perk.name, `${id} name`).toBeTruthy();
      expect(perk.desc.length, `${id} desc`).toBeGreaterThan(10);
    }
  });

  it("derives stats for every card in the database", () => {
    for (const def of Object.values(DB)) {
      const st = deriveStats(def);
      expect(st.atk).toBeGreaterThan(0);
      expect(st.hp).toBeGreaterThan(0);
      expect(st.cost).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("block tokens", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nullifies exactly one damage instance then clears", () => {
    let s = setup({ p1Board: ["grunt", "grunt2"], p2Board: ["guard"] });
    const guard = boardOf(s, "P2")[0];

    // P2 blocks their guard (do it directly, GRANT_BLOCK is P2's move)
    s = {
      ...s,
      players: {
        ...s.players,
        P2: {
          ...s.players.P2,
          board: s.players.P2.board.map(c => c ? { ...c, blocked: true } : c) as BattlePlayer["board"],
        },
      },
    };

    const [a1, a2] = boardOf(s, "P1");
    let st = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: a1.instanceId }).state;
    st = apply(st, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: guard.instanceId }).state;

    const afterFirst = boardOf(st, "P2")[0];
    expect(afterFirst.currentHp).toBe(guard.currentHp); // absorbed
    expect(afterFirst.blocked).toBe(false);             // consumed

    st = apply(st, { type: "SELECT_ATTACKER", pid: "P1", instanceId: a2.instanceId }).state;
    st = apply(st, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: guard.instanceId }).state;
    const afterSecond = boardOf(st, "P2")[0];
    expect((afterSecond?.currentHp ?? 0)).toBeLessThan(guard.currentHp); // second hit lands
  });

  it("spends a charge and refuses stacking", () => {
    const s = setup({ p1Board: ["grunt"] });
    const mine = boardOf(s, "P1")[0];
    const r1 = apply(s, { type: "GRANT_BLOCK", pid: "P1", targetInstanceId: mine.instanceId });
    expect(r1.state.players.P1.blockCharges).toBe(2);
    expect(boardOf(r1.state, "P1")[0].blocked).toBe(true);
    // Same card again while the block still stands: rejected
    expect(isIllegal(apply(r1.state, { type: "GRANT_BLOCK", pid: "P1", targetInstanceId: mine.instanceId }))).toBe(true);
  });
});

describe("cleansing heals", () => {
  it("a single target heal restores a sheepified card", () => {
    let s = setup({ p1Board: ["grunt"] });
    const mine = boardOf(s, "P1")[0];
    // Sheepify it by hand
    s = {
      ...s,
      players: {
        ...s.players,
        P1: {
          ...s.players.P1,
          board: s.players.P1.board.map(c => c ? {
            ...c, isSheep: true, preSheepAtk: c.atk, preSheepHp: c.currentHp,
            atk: 1, baseAtk: 1, currentHp: 1, maxHp: 1,
          } : c) as BattlePlayer["board"],
        },
      },
    };
    const healSpell = s.players.P1.spells.find(sp => sp.effect.kind === "BUFF_ONE_HP")!;
    const st = apply(s, { type: "CAST_SPELL", pid: "P1", spellId: healSpell.id, targetInstanceId: mine.instanceId }).state;
    const healed = boardOf(st, "P1")[0];
    expect(healed.isSheep).toBe(false);
    expect(healed.atk).toBe(mine.atk); // true form restored
  });

  it("also clears stun", () => {
    let s = setup({ p1Board: ["grunt"] });
    const mine = boardOf(s, "P1")[0];
    s = {
      ...s,
      players: {
        ...s.players,
        P1: {
          ...s.players.P1,
          board: s.players.P1.board.map(c => c ? { ...c, stunTurns: 1, canAttack: false, stunActive: true } : c) as BattlePlayer["board"],
        },
      },
    };
    const healSpell = s.players.P1.spells.find(sp => sp.effect.kind === "BUFF_ONE_HP")!;
    const st = apply(s, { type: "CAST_SPELL", pid: "P1", spellId: healSpell.id, targetInstanceId: mine.instanceId }).state;
    const healed = boardOf(st, "P1")[0];
    expect(healed.stunTurns).toBe(0);
    expect(healed.stunActive).toBe(false);
  });
});

describe("random strikes (Mahoraga)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("actually damages the leader it lands on", () => {
    const s = setup({ p1Board: ["mahoraga"] });
    const maho = boardOf(s, "P1")[0];
    // Pool with empty enemy board: [opp leader, own leader]. Force the own leader.
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const st = apply(s, { type: "ATTACK_RANDOM", pid: "P1", instanceId: maho.instanceId }).state;
    expect(st.players.P1.leader.currentHp).toBe(30 - maho.atk);
  });

  it("never targets a vacant leader slot (board mode)", () => {
    let s = setup({ p1Board: ["mahoraga"] });
    // Own side in Mahoraga board mode: the portrait slot is empty
    s = { ...s, players: { ...s.players, P1: { ...s.players.P1, mahoragaBoardMode: true } } };
    const maho = boardOf(s, "P1")[0];
    vi.spyOn(Math, "random").mockReturnValue(0.99); // last pool entry
    const st = apply(s, { type: "ATTACK_RANDOM", pid: "P1", instanceId: maho.instanceId }).state;
    // With the vacant own leader excluded, the last entry is the enemy leader
    expect(st.players.P1.leader.currentHp).toBe(30);
    expect(st.players.P2.leader.currentHp).toBe(30 - maho.atk);
  });
});

describe("Higuruma's sentence", () => {
  it("bound cards can strike each other straight through shields", () => {
    let s = setup({ p1Board: ["higuruma"], p2Board: ["grunt", "guard"] });
    const hig = boardOf(s, "P1")[0];
    const grunt = boardOf(s, "P2")[0];
    // Bind them, stuns already served
    const bind = (pl: BattlePlayer, id: string, withId: string): BattlePlayer => ({
      ...pl,
      board: pl.board.map(c => c?.instanceId === id ? { ...c, sentencedWith: withId } : c) as BattlePlayer["board"],
    });
    s = {
      ...s,
      players: {
        ...s.players,
        P1: bind(s.players.P1, hig.instanceId, grunt.instanceId),
        P2: bind(s.players.P2, grunt.instanceId, hig.instanceId),
      },
    };

    let st = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: hig.instanceId }).state;
    // The guard has a shield, but judgement does not care
    const res = apply(st, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: grunt.instanceId });
    expect(isIllegal(res)).toBe(false);
    // And anything else stays out of reach
    const guard = boardOf(s, "P2")[1];
    st = apply(s, { type: "SELECT_ATTACKER", pid: "P1", instanceId: hig.instanceId }).state;
    expect(isIllegal(apply(st, { type: "ATTACK_CARD", pid: "P1", targetInstanceId: guard.instanceId }))).toBe(true);
  });
});

describe("Higuruma's sentence lifecycle", () => {
  it("costs each card one turn, then frees them, and never locks up", () => {
    let s = setup({ p1Board: ["higuruma"], p2Board: ["grunt"] });
    const hig = boardOf(s, "P1")[0];
    const foe = boardOf(s, "P2")[0];

    s = apply(s, { type: "ACTIVATE_PERK", pid: "P1", instanceId: hig.instanceId, targetInstanceId: foe.instanceId }).state;
    expect(boardOf(s, "P1")[0].sentencedWith).toBe(foe.instanceId);
    expect(boardOf(s, "P2")[0].sentencedWith).toBe(hig.instanceId);

    // P2's turn: their card serves its stun
    s = apply(s, { type: "END_TURN", pid: "P1" }).state;
    expect(boardOf(s, "P2")[0].canAttack).toBe(false);

    // P1's turn: Higuruma serves his
    s = apply(s, { type: "END_TURN", pid: "P2" }).state;
    expect(boardOf(s, "P1")[0].canAttack).toBe(false);

    // P2 again: their card is free
    s = apply(s, { type: "END_TURN", pid: "P1" }).state;
    expect(boardOf(s, "P2")[0].canAttack).toBe(true);
    expect(boardOf(s, "P2")[0].stunTurns).toBe(0);

    // P1 again: Higuruma is free. The sentence persists but the stun is done.
    s = apply(s, { type: "END_TURN", pid: "P2" }).state;
    expect(boardOf(s, "P1")[0].canAttack).toBe(true);
    expect(boardOf(s, "P1")[0].stunTurns).toBe(0);
    expect(boardOf(s, "P1")[0].sentencedWith).toBe(foe.instanceId);
  });

  it("releases the survivor when its counterpart dies", () => {
    let s = setup({ p1Board: ["higuruma"], p2Board: ["grunt"] });
    const hig = boardOf(s, "P1")[0];
    const foe = boardOf(s, "P2")[0];
    s = apply(s, { type: "ACTIVATE_PERK", pid: "P1", instanceId: hig.instanceId, targetInstanceId: foe.instanceId }).state;

    // Wipe the bound enemy off the board
    s = {
      ...s,
      players: {
        ...s.players,
        P2: { ...s.players.P2, board: s.players.P2.board.map(() => null) as BattlePlayer["board"] },
      },
    };
    // Any intent runs checkWin, which releases broken sentences
    s = apply(s, { type: "END_TURN", pid: "P1" }).state;
    expect(boardOf(s, "P1")[0].sentencedWith).toBeUndefined();
  });
});
