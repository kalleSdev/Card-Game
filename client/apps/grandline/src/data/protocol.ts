import type { BattleState, BattleEvent, BattleIntent } from "@cg/battle";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";

/**
 * What goes over the socket.
 *
 * The same shapes the server declares. They are written out again here rather
 * than imported because the server's copy pulls in server-only types, and a
 * browser has no business importing those. If the two ever drift the socket
 * stops working loudly, which is the point of keeping them in one file each.
 */

export type ClientMessage =
  // Sent first. The socket does nothing else until it is authenticated.
  | { type: "auth"; token: string }
  // Open a private room and get a code to pass to a friend
  | { type: "createLobby"; draft: PlayerDraftResult }
  | { type: "joinLobby"; code: string; draft: PlayerDraftResult }
  | { type: "cancelLobby" }
  | { type: "intent"; intent: BattleIntent }
  | { type: "surrender" }
  | { type: "leave" };

/** What the ladder did with the match, when it counted for anything. */
export interface RankChange {
  before: number;
  after: number;
  delta: number;
  rankedUp: boolean;
  rankName: string;
  streak: number;
}

export type ServerMessage =
  | { type: "authed"; username: string }
  | { type: "lobbyOpen"; code: string }
  | { type: "matched"; matchId: string; you: PlayerId; opponentName: string }
  // Full state, already redacted for whoever is receiving it
  | { type: "state"; state: BattleState; events: BattleEvent[] }
  | { type: "opponentLeft" }
  | {
      type: "rewards";
      packs: { id: string; packId: string }[];
      berries: number;
      rank: RankChange | null;
    }
  // The opponent dropped but has a little while to come back
  | { type: "opponentDisconnected"; seconds: number }
  | { type: "opponentReturned" }
  // Ended by something other than the rules: a surrender, a drop, or a stall
  | { type: "matchOver"; winner: PlayerId; reason: string }
  | { type: "error"; reason: string };
