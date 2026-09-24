import type { PlayerId } from "@cg/contracts";
import type { BattleCard, BattleEvent, BattleState } from "@cg/battle";

/**
 * Turns engine events into short local animations. Nothing moves across the
 * board: an attacker nudges towards its target, the target recoils and
 * flashes, a dead card fades where it lay.
 */

/** A batch of events from the engine, with an id so the same batch plays once. */
export interface EventFeed {
  id: number;
  list: BattleEvent[];
}

export type Dir = "up" | "down";

export type Cue =
  | { kind: "enter"; at: number }
  | { kind: "strike"; at: number; dir: Dir }
  | { kind: "hit"; at: number; dir: Dir; damage: number }
  | { kind: "die"; at: number };

/** A card that died this batch, drawn in its old slot while it fades. */
export interface Ghost {
  pid: PlayerId;
  slot: number;
  card: BattleCard;
}

export interface CueSet {
  id: number;
  /** Cues by card or leader instanceId. */
  byId: Record<string, Cue[]>;
  ghosts: Ghost[];
  /** When the last cue has finished, in ms. */
  end: number;
}

export const NO_CUES: CueSet = { id: 0, byId: {}, ghosts: [], end: 0 };

/** Timings, in ms. */
export const CUE = {
  enter: 280,
  strike: 280,
  /** Attacker to impact. */
  impact: 150,
  hit: 420,
  die: 460,
  /** Gap between one action and the next in a batch. */
  step: 520,
} as const;

export function buildCues(feed: EventFeed, before: BattleState, after: BattleState, bottom: PlayerId): CueSet {
  const byId: Record<string, Cue[]> = {};
  const ghosts: Ghost[] = [];
  const add = (id: string, cue: Cue) => { (byId[id] ??= []).push(cue); };
  // Bottom side strikes up the screen, top side strikes down
  const dirOf = (pid: PlayerId): Dir => (pid === bottom ? "up" : "down");

  let t = 0;
  let lastHit = 0;
  let end = 0;

  for (const e of feed.list) {
    switch (e.type) {
      case "CARD_PLAYED":
        add(e.instanceId, { kind: "enter", at: t });
        end = Math.max(end, t + CUE.enter);
        t += CUE.enter;
        break;
      case "ATTACK_CARD": {
        const dir = dirOf(e.attackerPid);
        const hitAt = t + CUE.impact;
        add(e.attackerId, { kind: "strike", at: t, dir });
        add(e.targetId, { kind: "hit", at: hitAt, dir, damage: e.damage });
        if (e.counterDamage > 0) {
          add(e.attackerId, { kind: "hit", at: hitAt, dir: dir === "up" ? "down" : "up", damage: e.counterDamage });
        }
        lastHit = hitAt + CUE.hit;
        end = Math.max(end, lastHit);
        t += CUE.step;
        break;
      }
      case "ATTACK_LEADER": {
        const dir = dirOf(e.attackerPid);
        const defender: PlayerId = e.attackerPid === "P1" ? "P2" : "P1";
        const hitAt = t + CUE.impact;
        add(e.attackerId, { kind: "strike", at: t, dir });
        add(after.players[defender].leader.instanceId, { kind: "hit", at: hitAt, dir, damage: e.damage });
        lastHit = hitAt + CUE.hit;
        end = Math.max(end, lastHit);
        t += CUE.step;
        break;
      }
      case "CARD_DIED": {
        const at = Math.max(lastHit - CUE.hit / 2, 0);
        add(e.instanceId, { kind: "die", at });
        const ghost = findGhost(e.pid, e.instanceId, before, after);
        if (ghost) ghosts.push(ghost);
        end = Math.max(end, at + CUE.die);
        break;
      }
      default:
        break;
    }
  }

  return { id: feed.id, byId, ghosts, end };
}

/** Where a dead card was lying, from the state after if it is still there, else before. */
function findGhost(pid: PlayerId, id: string, before: BattleState, after: BattleState): Ghost | null {
  for (const s of [after, before]) {
    const slot = s.players[pid].board.findIndex(c => c?.instanceId === id);
    const card = s.players[pid].board[slot];
    if (slot >= 0 && card) return { pid, slot, card };
  }
  return null;
}

/** The CSS animation for a card or leader with these cues. Later entries win while running. */
export function cueAnimation(cues: Cue[] | undefined): string | undefined {
  if (!cues?.length) return undefined;
  const order = { die: 0, enter: 1, strike: 2, hit: 3 };
  return [...cues]
    .sort((a, b) => order[a.kind] - order[b.kind])
    .map(cue => {
      switch (cue.kind) {
        case "enter": return `ar-enter ${CUE.enter}ms cubic-bezier(0.2, 0, 0.2, 1) ${cue.at}ms both`;
        case "strike": return `ar-strike-${cue.dir} ${CUE.strike}ms ease-out ${cue.at}ms`;
        case "hit": return `ar-recoil-${cue.dir} ${CUE.hit}ms ease-out ${cue.at}ms`;
        case "die": return `ar-die ${CUE.die}ms ease-in ${cue.at}ms both`;
      }
    })
    .join(", ");
}

/** Keyframes for all of the above. Transform, opacity and filter only. */
export const CUE_CSS = `
@keyframes ar-enter {
  0% { opacity: 0; transform: scale(0.9); }
  60% { opacity: 1; transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ar-strike-up {
  0%, 100% { transform: none; filter: brightness(1); }
  45% { transform: translateY(-10px) scale(1.05); filter: brightness(1.3); }
}
@keyframes ar-strike-down {
  0%, 100% { transform: none; filter: brightness(1); }
  45% { transform: translateY(10px) scale(1.05); filter: brightness(1.3); }
}
@keyframes ar-recoil-up {
  0%, 100% { transform: none; }
  20% { transform: translateY(-6px) rotate(-1.5deg); }
  45% { transform: translateY(2px); }
}
@keyframes ar-recoil-down {
  0%, 100% { transform: none; }
  20% { transform: translateY(6px) rotate(1.5deg); }
  45% { transform: translateY(-2px); }
}
@keyframes ar-die {
  0% { opacity: 1; transform: none; filter: none; }
  100% { opacity: 0; transform: scale(0.86); filter: grayscale(1) brightness(0.6); }
}
@keyframes ar-flash {
  0% { opacity: 0; }
  15% { opacity: 0.8; }
  100% { opacity: 0; }
}
@keyframes ar-float {
  0% { opacity: 0; transform: translate(-50%, 0); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -28px); }
}
`;
