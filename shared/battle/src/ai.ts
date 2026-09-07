import type { PlayerId } from "@cg/contracts";
import type { BattleState, BattleIntent, BattleCard, BattleEvent } from "./battleEngine";
import { applyBattleIntent } from "./battleEngine";

// A greedy opponent. It plays the same intents a person would send, so it goes
// through the engine's rules like everyone else and cannot cheat.
//
// Rather than mirroring every rule to work out what is legal, it proposes a move
// and lets the engine reject it. Anything rejected is simply skipped.

interface Try {
  state: BattleState;
  events: BattleEvent[];
  ok: boolean;
}

function attempt(state: BattleState, intent: BattleIntent): Try {
  const result = applyBattleIntent(state, intent);
  const illegal = result.events.some(e => e.type === "ILLEGAL");
  return { state: illegal ? state : result.state, events: result.events, ok: !illegal };
}

const alive = (c: BattleCard | null): c is BattleCard => !!c && c.currentHp > 0;

/** Cards that can swing this turn, leader included when it is able to. */
function readyAttackers(state: BattleState, pid: PlayerId): BattleCard[] {
  const p = state.players[pid];
  const ready = (c: BattleCard) => c.canAttack && !c.exhausted && c.stunTurns <= 0;
  const board = p.board.filter(alive).filter(ready);
  return ready(p.leader) ? [...board, p.leader] : board;
}

/** A kill that does not cost the attacker its own life, if one is going. */
function cleanKill(attacker: BattleCard, enemyBoard: BattleCard[]): BattleCard | null {
  const kills = enemyBoard
    .filter(c => attacker.atk >= c.currentHp && c.atk < attacker.currentHp)
    .sort((a, b) => b.atk - a.atk || b.currentHp - a.currentHp);
  return kills[0] ?? null;
}

/** Falls back to the biggest threat when there is nothing clean to take. */
function bestTrade(attacker: BattleCard, enemyBoard: BattleCard[]): BattleCard | null {
  if (!enemyBoard.length) return null;
  const kills = enemyBoard.filter(c => attacker.atk >= c.currentHp);
  const pool = kills.length ? kills : enemyBoard;
  return [...pool].sort((a, b) => b.atk - a.atk || b.currentHp - a.currentHp)[0];
}

/**
 * Plays one full turn for `pid` and returns the state once the turn is over,
 * along with every event produced so the client can animate it.
 */
export function playBotTurn(state: BattleState, pid: PlayerId): { state: BattleState; events: BattleEvent[] } {
  let s = state;
  const events: BattleEvent[] = [];
  const run = (intent: BattleIntent): boolean => {
    const t = attempt(s, intent);
    if (t.ok) { s = t.state; events.push(...t.events); }
    return t.ok;
  };

  if (s.activePlayer !== pid || s.winner) return { state: s, events };

  // A domain may be waiting on a target before anything else can happen
  if (s.pendingDomainAction) {
    const target = bestTrade(
      { atk: 99, currentHp: 99 } as BattleCard,
      s.players[pid === "P1" ? "P2" : "P1"].board.filter(alive),
    );
    if (target) run({ type: "DOMAIN_TARGET", pid, targetInstanceId: target.instanceId });
  }

  // Domain is a big swing, so take it as soon as it is available
  const me = () => s.players[pid];
  if (me().domainMeter >= 100 && me().domainCooldown <= 0 && !me().domainActive) {
    run({ type: "ACTIVATE_DOMAIN", pid });
    if (s.pendingDomainAction) {
      const target = s.players[pid === "P1" ? "P2" : "P1"].board.filter(alive)[0];
      if (target) run({ type: "DOMAIN_TARGET", pid, targetInstanceId: target.instanceId });
    }
  }

  // Develop the board, most expensive first so energy is not wasted on chaff
  for (let guard = 0; guard < 12; guard++) {
    const p = me();
    const slot = p.board.findIndex(c => c === null);
    if (slot < 0) break;
    const playable = p.hand
      .filter(c => c.cost <= p.energy)
      .sort((a, b) => b.cost - a.cost || b.atk - a.atk);
    if (!playable.length) break;
    if (!run({ type: "PLAY_CARD", pid, instanceId: playable[0].instanceId, slot })) break;
  }

  // Attack. Go face when it wins the game, trade otherwise.
  const oppId: PlayerId = pid === "P1" ? "P2" : "P1";
  for (let guard = 0; guard < 12; guard++) {
    const attackers = readyAttackers(s, pid);
    if (!attackers.length) break;
    const attacker = attackers[0];
    if (!run({ type: "SELECT_ATTACKER", pid, instanceId: attacker.instanceId })) break;

    const enemyBoard = s.players[oppId].board.filter(alive);
    const totalSwing = readyAttackers(s, pid).reduce((n, c) => n + c.atk, 0);
    const lethal = totalSwing >= s.players[oppId].leader.currentHp;

    // Take a free kill, otherwise push damage at the leader. Grinding every
    // card down instead just stalls the game out.
    let acted = lethal && run({ type: "ATTACK_LEADER", pid });
    if (!acted) {
      const free = cleanKill(attacker, enemyBoard);
      if (free) acted = run({ type: "ATTACK_CARD", pid, targetInstanceId: free.instanceId });
    }
    if (!acted) acted = run({ type: "ATTACK_LEADER", pid });
    if (!acted) {
      // Leader is behind a shield, so the shield has to go
      const target = bestTrade(attacker, enemyBoard);
      if (target) acted = run({ type: "ATTACK_CARD", pid, targetInstanceId: target.instanceId });
    }
    if (!acted) { run({ type: "CANCEL_ATTACK", pid }); break; }
    if (s.winner) break;
  }

  if (!s.winner) run({ type: "END_TURN", pid });
  return { state: s, events };
}
