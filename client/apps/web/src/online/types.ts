import type { BattleState, BattleEvent, BattleIntent } from "@cg/battle";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";

export interface PublicUser {
  id: string;
  username: string;
  wins: number;
  losses: number;
}

// Mirrors server/src/protocol.ts. The server package is not a client dependency,
// so these are declared again here rather than imported across that boundary.
export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "queue"; draft: PlayerDraftResult }
  | { type: "practice"; draft: PlayerDraftResult }
  | { type: "intent"; intent: BattleIntent }
  | { type: "leave" };

export type ServerMessage =
  | { type: "authed"; username: string }
  | { type: "queued" }
  | { type: "matched"; matchId: string; you: PlayerId; opponentName: string }
  | { type: "state"; state: BattleState; events: BattleEvent[] }
  | { type: "opponentLeft" }
  | { type: "error"; reason: string };
