import Fastify from "fastify";
import { WebSocketServer, type WebSocket } from "ws";
import { createEngine, createInitialState } from "@cg/engine";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import { createMatch, getMatch, endMatch, broadcast, submitIntent, type Match } from "./matches.js";
import {
  register, login, logout, userForToken, getCollection, recordResult,
  AuthError, type PublicUser,
} from "./auth.js";

const PORT = Number(process.env.PORT ?? 8787);
const cardDb = createEngine(createInitialState()).getState().cardDb;

const app = Fastify({ logger: false });

app.addHook("onSend", async (_req, reply) => {
  reply.header("access-control-allow-origin", process.env.CORS_ORIGIN ?? "*");
  reply.header("access-control-allow-headers", "content-type, authorization");
  reply.header("access-control-allow-methods", "GET, POST, OPTIONS");
});
app.options("/*", async (_req, reply) => reply.code(204).send());

const bearer = (auth?: string) => auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;

app.get("/health", async () => ({ ok: true, matches: liveMatchIds.size }));

app.post("/auth/register", async (req, reply) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  try {
    return register(username ?? "", password ?? "");
  } catch (err) {
    return reply.code(400).send({ error: err instanceof AuthError ? err.message : "Could not register" });
  }
});

app.post("/auth/login", async (req, reply) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  try {
    return login(username ?? "", password ?? "");
  } catch (err) {
    return reply.code(401).send({ error: err instanceof AuthError ? err.message : "Could not log in" });
  }
});

app.post("/auth/logout", async (req) => {
  const token = bearer(req.headers.authorization);
  if (token) logout(token);
  return { ok: true };
});

app.get("/me", async (req, reply) => {
  const user = userForToken(bearer(req.headers.authorization));
  if (!user) return reply.code(401).send({ error: "Not signed in" });
  return { user, collection: getCollection(user.id) };
});

// ── Sockets ──────────────────────────────────────────────────────────────────
interface Conn {
  socket: WebSocket;
  user?: PublicUser;
  matchId?: string;
  playerId?: PlayerId;
}

const conns = new Map<WebSocket, Conn>();
let waiting: { conn: Conn; draft: PlayerDraftResult } | null = null;
const liveMatchIds = new Set<string>();

const send = (ws: WebSocket, msg: ServerMessage) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

function startMatch(a: { conn: Conn; draft: PlayerDraftResult }, b: { conn: Conn; draft: PlayerDraftResult }) {
  const nameOf = (c: Conn) => c.user?.username ?? "Player";
  const match = createMatch(
    cardDb,
    { seat: { name: nameOf(a.conn), send: m => send(a.conn.socket, m as ServerMessage) }, draft: a.draft },
    { seat: { name: nameOf(b.conn), send: m => send(b.conn.socket, m as ServerMessage) }, draft: b.draft },
  );
  liveMatchIds.add(match.id);

  a.conn.matchId = match.id; a.conn.playerId = "P1";
  b.conn.matchId = match.id; b.conn.playerId = "P2";

  send(a.conn.socket, { type: "matched", matchId: match.id, you: "P1", opponentName: nameOf(b.conn) });
  send(b.conn.socket, { type: "matched", matchId: match.id, you: "P2", opponentName: nameOf(a.conn) });
  broadcast(match);
}

// Write the result down for both players once a match ends.
function settle(match: Match) {
  const winner = match.state.winner;
  if (!winner) return;
  for (const pid of ["P1", "P2"] as PlayerId[]) {
    const conn = [...conns.values()].find(c => c.matchId === match.id && c.playerId === pid);
    const opponent = match.seats[pid === "P1" ? "P2" : "P1"].name;
    if (conn?.user) recordResult(conn.user.id, opponent, winner === pid, match.state.turn);
  }
  liveMatchIds.delete(match.id);
}

function handle(conn: Conn, msg: ClientMessage) {
  if (msg.type === "auth") {
    const user = userForToken(msg.token);
    if (!user) return send(conn.socket, { type: "error", reason: "Session expired, sign in again" });
    conn.user = user;
    return send(conn.socket, { type: "authed", username: user.username });
  }

  // Everything past this point needs a signed in user
  if (!conn.user) return send(conn.socket, { type: "error", reason: "Sign in first" });

  switch (msg.type) {
    case "queue": {
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
      if (rejected) return send(conn.socket, { type: "error", reason: rejected });
      if (match.state.winner) settle(match);
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

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket: WebSocket) => {
  const conn: Conn = { socket };
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
