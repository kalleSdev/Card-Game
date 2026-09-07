import Fastify from "fastify";
import { WebSocketServer, type WebSocket } from "ws";
import { createEngine, createInitialState } from "@cg/engine";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import { createMatch, getMatch, endMatch, broadcast, submitIntent, type Match } from "./matches.js";

const PORT = Number(process.env.PORT ?? 8787);

// Card definitions come from the same place the client gets them
const cardDb = createEngine(createInitialState()).getState().cardDb;

const app = Fastify({ logger: false });
app.get("/health", async () => ({ ok: true, matches: liveMatches() }));

// ── Connection state ─────────────────────────────────────────────────────────
interface Conn {
  socket: WebSocket;
  name: string;
  matchId?: string;
  playerId?: PlayerId;
}

const conns = new Map<WebSocket, Conn>();
let waiting: { conn: Conn; draft: PlayerDraftResult } | null = null;
const liveMatchIds = new Set<string>();
const liveMatches = () => liveMatchIds.size;

const send = (ws: WebSocket, msg: ServerMessage) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

function startMatch(a: { conn: Conn; draft: PlayerDraftResult }, b: { conn: Conn; draft: PlayerDraftResult }) {
  const match = createMatch(
    cardDb,
    { seat: { name: a.conn.name, send: m => send(a.conn.socket, m as ServerMessage) }, draft: a.draft },
    { seat: { name: b.conn.name, send: m => send(b.conn.socket, m as ServerMessage) }, draft: b.draft },
  );
  liveMatchIds.add(match.id);

  a.conn.matchId = match.id; a.conn.playerId = "P1";
  b.conn.matchId = match.id; b.conn.playerId = "P2";

  send(a.conn.socket, { type: "matched", matchId: match.id, you: "P1", opponentName: b.conn.name });
  send(b.conn.socket, { type: "matched", matchId: match.id, you: "P2", opponentName: a.conn.name });
  broadcast(match);
}

function handle(conn: Conn, msg: ClientMessage) {
  switch (msg.type) {
    case "queue": {
      conn.name = msg.name || "Player";
      if (waiting && waiting.conn.socket !== conn.socket) {
        const opponent = waiting;
        waiting = null;
        startMatch(opponent, { conn, draft: msg.draft });
      } else {
        waiting = { conn, draft: msg.draft };
        send(conn.socket, { type: "queued" });
      }
      return;
    }

    case "intent": {
      const match = conn.matchId ? getMatch(conn.matchId) : undefined;
      if (!match || !conn.playerId) return send(conn.socket, { type: "error", reason: "You are not in a match" });
      const rejected = submitIntent(match, conn.playerId, msg.intent);
      if (rejected) send(conn.socket, { type: "error", reason: rejected });
      if (match.state.winner) liveMatchIds.delete(match.id);
      return;
    }

    case "leave":
      return dropFromMatch(conn);
  }
}

function dropFromMatch(conn: Conn) {
  if (waiting && waiting.conn.socket === conn.socket) waiting = null;
  const match: Match | undefined = conn.matchId ? getMatch(conn.matchId) : undefined;
  if (!match || !conn.playerId) return;
  const other: PlayerId = conn.playerId === "P1" ? "P2" : "P1";
  match.seats[other].send({ type: "opponentLeft" });
  liveMatchIds.delete(match.id);
  endMatch(match.id);
  conn.matchId = undefined;
  conn.playerId = undefined;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket: WebSocket) => {
  const conn: Conn = { socket, name: "Player" };
  conns.set(socket, conn);

  socket.on("message", raw => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw)) as ClientMessage;
    } catch {
      return send(socket, { type: "error", reason: "Bad message" });
    }
    try {
      handle(conn, msg);
    } catch (err) {
      send(socket, { type: "error", reason: err instanceof Error ? err.message : "Server error" });
    }
  });

  socket.on("close", () => {
    dropFromMatch(conn);
    conns.delete(socket);
  });
});

await app.listen({ port: PORT, host: "0.0.0.0" });
app.server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});

console.log(`server listening on ${PORT}`);
