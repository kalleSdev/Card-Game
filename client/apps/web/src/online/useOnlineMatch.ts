import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleState, BattleEvent, BattleIntent } from "@cg/battle";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import { getToken, socketUrl } from "./api";
import type { ClientMessage, ServerMessage } from "./types";

export type OnlineStatus =
  | "connecting"
  | "ready"      // socket open and signed in
  | "queued"
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
  queue: (draft: PlayerDraftResult) => void;
  /** Start a match against the computer instead of waiting. */
  practice: (draft: PlayerDraftResult) => void;
  send: (intent: BattleIntent) => void;
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

  const post = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) { setStatus("disconnected"); setError("Sign in first"); return; }

    const ws = new WebSocket(socketUrl());
    socketRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token } satisfies ClientMessage));

    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data as string) as ServerMessage;
      switch (msg.type) {
        case "authed":       setStatus("ready"); setError(null); break;
        case "queued":       setStatus("queued"); break;
        case "matched":
          setYou(msg.you);
          setOpponentName(msg.opponentName);
          setStatus("playing");
          break;
        case "state":
          setState(msg.state);
          setEvents(msg.events);
          break;
        case "opponentLeft": setStatus("opponentLeft"); break;
        case "error":        setError(msg.reason); break;
      }
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setError("Lost connection to the server");

    return () => ws.close();
  }, [enabled]);

  return {
    status, error, you, opponentName, state, events,
    queue: useCallback((draft: PlayerDraftResult) => post({ type: "queue", draft }), [post]),
    practice: useCallback((draft: PlayerDraftResult) => post({ type: "practice", draft }), [post]),
    send:  useCallback((intent: BattleIntent) => post({ type: "intent", intent }), [post]),
    leave: useCallback(() => post({ type: "leave" }), [post]),
  };
}
