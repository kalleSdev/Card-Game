import type { BattleState, BattleEvent, BattleIntent } from "@cg/battle";
import type { ScoreIntent, ScorePlayer, ScoreState } from "@cg/score";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import type { UniverseId } from "./universes.js";

// Messages on the wire. Kept in one file so the client can import the same
// types later and the two sides cannot drift.

export type ClientMessage =
  // Sent first. The socket does nothing else until it is authenticated.
  | { type: "auth"; token: string }
  // Open a private room and get a code to pass to a friend
  | { type: "createLobby"; draft: PlayerDraftResult; universe?: UniverseId }
  | { type: "joinLobby"; code: string; draft: PlayerDraftResult }
  | { type: "cancelLobby" }
  // Play the computer instead of waiting for someone
  | { type: "practice"; draft: PlayerDraftResult; universe?: UniverseId }
  // The same, for a Score match. It brings no deck: the table is dealt here.
  | { type: "createScoreLobby"; universe?: UniverseId }
  | { type: "joinScoreLobby"; code: string }
  | { type: "scoreIntent"; intent: ScoreIntent }
  | { type: "intent"; intent: BattleIntent }
  | { type: "surrender" }
  | { type: "leave" };

export type ServerMessage =
  | { type: "authed"; username: string }
  | { type: "lobbyOpen"; code: string }
  | { type: "matched"; matchId: string; you: PlayerId; opponentName: string }
  // Full state, already redacted for the receiving player
  | { type: "state"; state: BattleState; events: BattleEvent[] }
  | { type: "scoreMatched"; matchId: string; you: ScorePlayer; opponentName: string }
  // The table, with every card still face down blanked out
  | { type: "scoreState"; state: ScoreState }
  | { type: "opponentLeft" }
  // What the finished match paid: packs to open, and Berries
  | {
      type: "rewards";
      packs: { id: string; packId: string }[];
      berries: number;
      /** What the match did to your place on the ladder. */
      rank: { before: number; after: number; delta: number; rankedUp: boolean; rankName: string; streak: number } | null;
    }
  // The opponent dropped but has a little while to come back
  | { type: "opponentDisconnected"; seconds: number }
  | { type: "opponentReturned" }
  // Ended by something other than the rules: a surrender, a drop, or a stall
  | { type: "matchOver"; winner: PlayerId; reason: string }
  | { type: "error"; reason: string };
