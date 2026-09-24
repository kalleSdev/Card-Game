import { describe, it, expect } from "vitest";
import type { BattleCard, BattleState } from "@cg/battle";
import { CUE, buildCues, cueAnimation, hpAt } from "./cues";

// Just enough of a state for the cue builder: leaders and boards.
function stateWith(p1Board: (string | null)[], p2Board: (string | null)[]): BattleState {
  const card = (id: string) => ({ instanceId: id, currentHp: 3 }) as BattleCard;
  const side = (leader: string, board: (string | null)[]) => ({
    leader: card(leader),
    board: board.map(id => (id ? card(id) : null)),
  });
  return { players: { P1: side("L1", p1Board), P2: side("L2", p2Board) } } as unknown as BattleState;
}

describe("buildCues", () => {
  it("strikes up from the bottom and hits the target after impact", () => {
    const s = stateWith(["a"], ["b"]);
    const cues = buildCues(
      { id: 1, list: [{ type: "ATTACK_CARD", attackerPid: "P1", attackerId: "a", targetId: "b", damage: 2, counterDamage: 0 }] },
      s, s, "P1",
    );
    expect(cues.byId.a).toEqual([{ kind: "strike", at: 0, dir: "up" }]);
    expect(cues.byId.b).toEqual([{ kind: "hit", at: CUE.impact, dir: "up", damage: 2, from: 3, to: 1 }]);
  });

  it("hits the defending leader on a leader attack", () => {
    const s = stateWith([], []);
    const cues = buildCues(
      { id: 1, list: [{ type: "ATTACK_LEADER", attackerPid: "P2", attackerId: "L2", damage: 4, leaderHpLeft: 26 }] },
      s, s, "P1",
    );
    expect(cues.byId.L2?.[0]).toMatchObject({ kind: "strike", dir: "down" });
    expect(cues.byId.L1?.[0]).toMatchObject({ kind: "hit", damage: 4 });
  });

  it("keeps a dead card as a ghost in its old slot", () => {
    const before = stateWith([], [null, "b"]);
    const after = stateWith([], [null, null]);
    const cues = buildCues(
      { id: 1, list: [
        { type: "ATTACK_CARD", attackerPid: "P1", attackerId: "L1", targetId: "b", damage: 5, counterDamage: 1 },
        { type: "CARD_DIED", pid: "P2", instanceId: "b" },
      ] },
      before, after, "P1",
    );
    expect(cues.ghosts).toEqual([{ pid: "P2", slot: 1, card: expect.objectContaining({ instanceId: "b" }) }]);
    expect(cues.byId.b?.some(c => c.kind === "die")).toBe(true);
    // Counter damage recoils the attacker the other way
    expect(cues.byId.L1).toContainEqual(expect.objectContaining({ kind: "hit", dir: "down", damage: 1 }));
  });

  it("plays a batch one after another", () => {
    const s = stateWith(["x", "y"], []);
    const cues = buildCues(
      { id: 1, list: [
        { type: "CARD_PLAYED", pid: "P1", instanceId: "x", slot: 0 },
        { type: "CARD_PLAYED", pid: "P1", instanceId: "y", slot: 1 },
      ] },
      s, s, "P1",
    );
    expect(cues.byId.x?.[0].at).toBe(0);
    expect(cues.byId.y?.[0].at).toBe(CUE.enter);
    expect(cues.end).toBe(CUE.enter * 2);
  });

  it("ignores events that have nothing to show", () => {
    const s = stateWith([], []);
    const cues = buildCues({ id: 1, list: [{ type: "TURN_END", pid: "P1" }] }, s, s, "P1");
    expect(cues.end).toBe(0);
  });
});

describe("hp at impact", () => {
  it("counts a leader down hit by hit in one batch", () => {
    const s = stateWith([], []);
    const cues = buildCues(
      { id: 1, list: [
        { type: "ATTACK_LEADER", attackerPid: "P2", attackerId: "L2", damage: 2, leaderHpLeft: 1 },
        { type: "ATTACK_LEADER", attackerPid: "P2", attackerId: "L2", damage: 1, leaderHpLeft: 0 },
      ] },
      s, s, "P1",
    );
    const leader = cues.byId.L1;
    expect(hpAt(leader, 0, 0)).toBe(3);
    expect(hpAt(leader, 0, 1)).toBe(1);
    expect(hpAt(leader, 0, 2)).toBe(0);
  });

  it("shows the real value when nothing is hitting it", () => {
    expect(hpAt(undefined, 7, 0)).toBe(7);
  });
});

describe("draw", () => {
  it("gives the drawn card a draw cue", () => {
    const s = stateWith([], []);
    const cues = buildCues({ id: 1, list: [{ type: "TURN_START", pid: "P1", turn: 2, drew: "d" }] }, s, s, "P1");
    expect(cues.byId.d).toEqual([{ kind: "draw", at: 0 }]);
  });
});

describe("cueAnimation", () => {
  it("puts a death under the recoil so the recoil shows first", () => {
    const css = cueAnimation([
      { kind: "hit", at: 150, dir: "up", damage: 3, from: 5, to: 2 },
      { kind: "die", at: 360 },
    ]);
    expect(css?.indexOf("ar-die")).toBeLessThan(css?.indexOf("ar-recoil-up") ?? 0);
  });
});
