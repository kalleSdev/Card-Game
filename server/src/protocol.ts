import type { BattleState, BattleEvent, BattleIntent } from "@cg/battle";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";

// Messages on the wire. Kept in one file so the client can import the same
// types later and the two sides cannot drift.

export type ClientMessage =
  | { type: "queue"; name: string; draft: PlayerDraftResult }
  | { type: "intent"; intent: BattleIntent }
  | { type: "leave" };

export type ServerMessage =
  | { type: "queued" }
  | { type: "matched"; matchId: string; you: PlayerId; opponentName: string }
  // Full state, already redacted for the receiving player
  | { type: "state"; state: BattleState; events: BattleEvent[] }
  | { type: "opponentLeft" }
  | { type: "error"; reason: string };
