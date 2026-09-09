import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleIntent, BattleState } from "@cg/battle";
import type { PlayerDraftResult, PlayerId } from "@cg/contracts";
import { getToken, socketUrl } from "./api";
import type { ClientMessage, RankChange, ServerMessage } from "./protocol";

/**
 * The socket, and everything that comes down it.
 *
 * A match against another person is played on the server. The browser sends
 * intents and draws whatever state comes back — it never works out a rule for
 * itself, because the other player's browser would be free to disagree with it.
 * The state that arrives is already redacted, so it does not hold their hand.
 *
 * Two people find each other with a code: one hosts, the other joins. There is
 * no queue yet, which suits a game with a handful of players and costs nothing
 * to run.
 *
 * A dropped socket is not a lost match. The server keeps the seat warm for a
 * short while, so this reconnects on its own and backs off if the server is
 * simply not there.
 */

export type NetStatus =
  | "connecting"
  | "ready"        // signed in, nothing going on
  | "hosting"      // a code is out, waiting for someone to use it
  | "playing"
  | "opponentLeft"
  | "offline";

/** What the finished match paid, once the server has worked it out. */
export interface Rewards {
  packs: { id: string; packId: string }[];
  berries: number;
  rank: RankChange | null;
}

export interface Net {
  status: NetStatus;
  error: string | null;
  /** The code to pass to a friend, while hosting. */
  code: string | null;
  /** Which seat you are sitting in, once matched. */
  you: PlayerId | null;
  opponentName: string | null;
  state: BattleState | null;
  /** Seconds the opponent has left to come back, while they are dropped. */
  away: number | null;
  /** How the match ended, when it was not by the rules. */
  endedBecause: string | null;
  rewards: Rewards | null;
  host: (draft: PlayerDraftResult) => void;
  join: (code: string, draft: PlayerDraftResult) => void;
  cancel: () => void;
  send: (intent: BattleIntent) => void;
  surrender: () => void;
  leave: () => void;
}

/** How long to wait before trying the socket again, in ms. */
const BACKOFF_CAP = 8000;

export function useNet(enabled: boolean): Net {
  const socket = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<NetStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [you, setYou] = useState<PlayerId | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [state, setState] = useState<BattleState | null>(null);
  const [away, setAway] = useState<number | null>(null);
  const [endedBecause, setEndedBecause] = useState<string | null>(null);
  const [rewards, setRewards] = useState<Rewards | null>(null);

  const post = useCallback((msg: ClientMessage) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) {
      setStatus("offline");
      setError("Sign in to play online");
      return;
    }

    let done = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const ws = new WebSocket(socketUrl());
      socket.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        attempt = 0;
        ws.send(JSON.stringify({ type: "auth", token } satisfies ClientMessage));
      };

      ws.onmessage = ev => {
        const msg = JSON.parse(ev.data as string) as ServerMessage;
        switch (msg.type) {
          case "authed":
            setStatus("ready");
            setError(null);
            break;
          case "lobbyOpen":
            setCode(msg.code);
            setStatus("hosting");
            break;
          case "matched":
            setYou(msg.you);
            setOpponentName(msg.opponentName);
            setCode(null);
            setEndedBecause(null);
            setRewards(null);
            setAway(null);
            setStatus("playing");
            break;
          case "state":
            setState(msg.state);
            break;
          case "rewards":
            setRewards({ packs: msg.packs, berries: msg.berries, rank: msg.rank });
            break;
          case "opponentDisconnected": setAway(msg.seconds); break;
          case "opponentReturned":     setAway(null); break;
          case "opponentLeft":         setStatus("opponentLeft"); break;
          case "matchOver":            setEndedBecause(msg.reason); break;
          case "error":                setError(msg.reason); break;
        }
      };

      ws.onerror = () => setError("Lost the connection to the server");

      ws.onclose = () => {
        if (done) return;
        setStatus("offline");
        // The server closes an open lobby when its host drops, so the code on
        // screen is no longer worth passing to anyone.
        setCode(prev => {
          if (prev) setError("The connection dropped, so that lobby closed. Open a new one.");
          return null;
        });
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, BACKOFF_CAP));
      };
    };

    connect();

    return () => {
      done = true;
      if (retry) clearTimeout(retry);
      socket.current?.close();
    };
  }, [enabled]);

  return {
    status, error, code, you, opponentName, state, away, endedBecause, rewards,
    host: useCallback((draft: PlayerDraftResult) => post({ type: "createLobby", draft }), [post]),
    join: useCallback(
      (lobby: string, draft: PlayerDraftResult) => post({ type: "joinLobby", code: lobby.trim().toUpperCase(), draft }),
      [post],
    ),
    cancel: useCallback(() => { post({ type: "cancelLobby" }); setCode(null); setStatus("ready"); }, [post]),
    send: useCallback((intent: BattleIntent) => post({ type: "intent", intent }), [post]),
    surrender: useCallback(() => post({ type: "surrender" }), [post]),
    leave: useCallback(() => post({ type: "leave" }), [post]),
  };
}
