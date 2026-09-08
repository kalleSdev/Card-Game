import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleState, BattleEvent, BattleIntent } from "@cg/battle";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import { getToken, socketUrl } from "./api";
import type { ClientMessage, ServerMessage } from "./types";

export type OnlineStatus =
  | "connecting"
  | "ready"      // socket open and signed in
  | "hosting"    // lobby open, waiting for someone to use the code
  | "playing"
  | "opponentLeft"
  | "disconnected";

export interface OnlineMatch {
  status: OnlineStatus;
  error: string | null;
  /** Which seat I am, once matched. */
  you: PlayerId | null;
  opponentName: string | null;
  /** Already redacted by the server, so it never holds the opponent's hand. */
  state: BattleState | null;
  /** Events from the last update, for driving animations. */
  events: BattleEvent[];
  /** Set while the opponent is dropped but still has time to come back. */
  opponentAway: number | null;
  /** How the match ended, when it was not by the rules. */
  endedBecause: string | null;
  /** The code to pass to a friend, while hosting. */
  lobbyCode: string | null;
  /** Open a private lobby and get a code back. */
  host: (draft: PlayerDraftResult) => void;
  /** Join someone else's lobby with their code. */
  join: (code: string, draft: PlayerDraftResult) => void;
  /** Close the lobby you opened. */
  cancelHosting: () => void;
  /** Start a match against the computer instead of waiting. */
  practice: (draft: PlayerDraftResult) => void;
  send: (intent: BattleIntent) => void;
  /** Concede the match. */
  surrender: () => void;
  leave: () => void;
}

// Talks to the game server. The client never computes rules, it sends intents
// and renders whatever state comes back.
export function useOnlineMatch(enabled: boolean): OnlineMatch {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<OnlineStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [you, setYou] = useState<PlayerId | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [state, setState] = useState<BattleState | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [opponentAway, setOpponentAway] = useState<number | null>(null);
  const [endedBecause, setEndedBecause] = useState<string | null>(null);
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);

  const post = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) { setStatus("disconnected"); setError("Sign in first"); return; }

    // A dropped socket is not the end of the match. The server holds the seat
    // open for a short while, so keep trying to get back to it.
    let closed = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const ws = new WebSocket(socketUrl());
      socketRef.current = ws;
      setStatus("connecting");
      wire(ws, token);
    };

    const wire = (ws: WebSocket, token: string) => {
    ws.onopen = () => { attempt = 0; ws.send(JSON.stringify({ type: "auth", token } satisfies ClientMessage)); };

    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data as string) as ServerMessage;
      switch (msg.type) {
        case "authed":       setStatus("ready"); setError(null); break;
        case "lobbyOpen":
          setLobbyCode(msg.code);
          setStatus("hosting");
          break;
        case "matched":
          setEndedBecause(null);
          setOpponentAway(null);
          setYou(msg.you);
          setOpponentName(msg.opponentName);
          setLobbyCode(null);
          setStatus("playing");
          break;
        case "state":
          setState(msg.state);
          setEvents(msg.events);
          break;
        case "opponentLeft": setStatus("opponentLeft"); break;
        case "opponentDisconnected": setOpponentAway(msg.seconds); break;
        case "opponentReturned":     setOpponentAway(null); break;
        case "matchOver":            setEndedBecause(msg.reason); break;
        case "error":        setError(msg.reason); break;
      }
    };

    ws.onclose = () => {
      if (closed) return;
      setStatus("disconnected");
      // The server drops an open lobby when its host disconnects, so the code
      // on screen is no longer worth sharing
      setLobbyCode(prev => {
        if (prev) setError("Lost connection, so that lobby closed. Create a new one.");
        return null;
      });
      // Back off a little each time so a server that is down is not hammered
      const wait = Math.min(1000 * 2 ** attempt++, 8000);
      retry = setTimeout(connect, wait);
    };
    ws.onerror = () => setError("Lost connection to the server");
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [enabled]);

  return {
    status, error, you, opponentName, state, events, opponentAway, endedBecause, lobbyCode,
    host: useCallback((draft: PlayerDraftResult) => post({ type: "createLobby", draft }), [post]),
    join: useCallback((code: string, draft: PlayerDraftResult) => post({ type: "joinLobby", code, draft }), [post]),
    cancelHosting: useCallback(() => { post({ type: "cancelLobby" }); setLobbyCode(null); setStatus("ready"); }, [post]),
    practice: useCallback((draft: PlayerDraftResult) => post({ type: "practice", draft }), [post]),
    send:  useCallback((intent: BattleIntent) => post({ type: "intent", intent }), [post]),
    surrender: useCallback(() => post({ type: "surrender" }), [post]),
    leave: useCallback(() => post({ type: "leave" }), [post]),
  };
}
