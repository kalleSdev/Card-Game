import Fastify from "fastify";
import { WebSocketServer, type WebSocket } from "ws";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import { cardsFor } from "./universes.js";
import {
  createMatch, validateDraft, runBotIfItsTurn, getMatch, endMatch, broadcast, submitIntent,
  forfeit, rebindSeat, forceEndTurn, type Match,
} from "./matches.js";
import {
  register, login, logout, userForToken, getCollection, recordResult,
  AuthError, type PublicUser,
} from "./auth.js";

const PORT = Number(process.env.PORT ?? 8787);
const cardDb = cardsFor();

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

// How long a player gets to come back before they lose the match, and how long
// a turn can sit untouched before the server ends it for them.
const RECONNECT_SECONDS = 45;
const TURN_SECONDS = 90;
const MAX_MISSED_TURNS = 3;

const conns = new Map<WebSocket, Conn>();
// Lets a returning player find the match they dropped out of
const seatOfUser = new Map<string, { matchId: string; playerId: PlayerId }>();
const dropTimers = new Map<string, NodeJS.Timeout>();
const turnTimers = new Map<string, { timer: NodeJS.Timeout; pid: PlayerId }>();
const missedTurns = new Map<string, { pid: PlayerId; count: number }>();
let waiting: { conn: Conn; draft: PlayerDraftResult } | null = null;
const liveMatchIds = new Set<string>();

const send = (ws: WebSocket, msg: ServerMessage) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

function startMatch(a: { conn: Conn; draft: PlayerDraftResult }, b: { conn: Conn; draft: PlayerDraftResult }) {
  try {
    pairUp(a, b);
  } catch (err) {
    // Neither player should be left staring at an empty queue if this ever throws
    const reason = err instanceof Error ? err.message : "Could not start the match";
    send(a.conn.socket, { type: "error", reason });
    send(b.conn.socket, { type: "error", reason });
  }
}

function pairUp(a: { conn: Conn; draft: PlayerDraftResult }, b: { conn: Conn; draft: PlayerDraftResult }) {
  const nameOf = (c: Conn) => c.user?.username ?? "Player";
  const match = createMatch(
    cardDb,
    { seat: { name: nameOf(a.conn), send: m => send(a.conn.socket, m as ServerMessage) }, draft: a.draft },
    { seat: { name: nameOf(b.conn), send: m => send(b.conn.socket, m as ServerMessage) }, draft: b.draft },
  );
  liveMatchIds.add(match.id);

  a.conn.matchId = match.id; a.conn.playerId = "P1";
  b.conn.matchId = match.id; b.conn.playerId = "P2";

  if (a.conn.user) seatOfUser.set(a.conn.user.id, { matchId: match.id, playerId: "P1" });
  if (b.conn.user) seatOfUser.set(b.conn.user.id, { matchId: match.id, playerId: "P2" });

  send(a.conn.socket, { type: "matched", matchId: match.id, you: "P1", opponentName: nameOf(b.conn) });
  send(b.conn.socket, { type: "matched", matchId: match.id, you: "P2", opponentName: nameOf(a.conn) });
  broadcast(match);
  armTurnTimer(match);
}

// A practice match: the player takes P1, the computer takes P2 with a deck
// thrown together from whatever is in the card pool.
function startPractice(conn: Conn, draft: PlayerDraftResult) {
  const nothing = () => {};
  const match = createMatch(
    cardDb,
    { seat: { name: conn.user?.username ?? "Player", send: m => send(conn.socket, m as ServerMessage) }, draft },
    { seat: { name: "Computer", send: nothing }, draft: randomDraft() },
  );
  match.botSeat = "P2";
  liveMatchIds.add(match.id);
  conn.matchId = match.id;
  conn.playerId = "P1";
  if (conn.user) seatOfUser.set(conn.user.id, { matchId: match.id, playerId: "P1" });
  send(conn.socket, { type: "matched", matchId: match.id, you: "P1", opponentName: "Computer" });
  broadcast(match);
  runBotIfItsTurn(match);
  armTurnTimer(match);
}

function randomDraft(): PlayerDraftResult {
  const ids = Object.keys(cardDb);
  const pool = [...ids].sort(() => Math.random() - 0.5);
  const of = (affinity: string, n: number) =>
    pool.filter(id => cardDb[id].affinity === affinity).slice(0, n);
  const combat = of("COMBAT", 5);
  const support = of("SUPPORT", 4);
  const rest = pool.filter(id => !combat.includes(id) && !support.includes(id)).slice(0, 3);
  return {
    leaderId: pool[0],
    combatIds: combat,
    supportIds: support,
    extraIds: rest,
    weaponIds: [],
  };
}

// Gives whoever is to move a deadline. A player who lets it run out has their
// turn ended for them, and loses if they keep doing it.
function armTurnTimer(match: Match) {
  const existing = turnTimers.get(match.id);
  const pid = match.state.activePlayer;
  if (existing?.pid === pid) return;
  if (existing) clearTimeout(existing.timer);
  if (match.state.winner || match.botSeat === pid) { turnTimers.delete(match.id); return; }

  const timer = setTimeout(() => {
    const live = getMatch(match.id);
    if (!live || live.state.winner) return;
    const missed = missedTurns.get(live.id);
    const count = missed?.pid === pid ? missed.count + 1 : 1;
    missedTurns.set(live.id, { pid, count });
    if (count >= MAX_MISSED_TURNS) {
      finishMatch(live, forfeit(live, pid, "Ran out of time"));
      return;
    }
    forceEndTurn(live);
    runBotIfItsTurn(live);
    armTurnTimer(live);
  }, TURN_SECONDS * 1000);

  turnTimers.set(match.id, { timer, pid });
}

// Clears everything a match was holding on to.
function finishMatch(match: Match, _winner: PlayerId) {
  settle(match);
  const t = turnTimers.get(match.id);
  if (t) clearTimeout(t.timer);
  turnTimers.delete(match.id);
  missedTurns.delete(match.id);
  const d = dropTimers.get(match.id);
  if (d) clearTimeout(d);
  dropTimers.delete(match.id);
  for (const [userId, seat] of seatOfUser) if (seat.matchId === match.id) seatOfUser.delete(userId);
  liveMatchIds.delete(match.id);
  endMatch(match.id);
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
    send(conn.socket, { type: "authed", username: user.username });
    return resumeMatch(conn);
  }

  // Everything past this point needs a signed in user
  if (!conn.user) return send(conn.socket, { type: "error", reason: "Sign in first" });

  switch (msg.type) {
    case "queue": {
      const bad = validateDraft(msg.draft, cardDb);
      if (bad) return send(conn.socket, { type: "error", reason: bad });
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

    case "practice": {
      const bad = validateDraft(msg.draft, cardDb);
      if (bad) return send(conn.socket, { type: "error", reason: bad });
      if (waiting && waiting.conn.socket === conn.socket) waiting = null;
      return startPractice(conn, msg.draft);
    }

    case "intent": {
      const match = conn.matchId ? getMatch(conn.matchId) : undefined;
      if (!match || !conn.playerId) return send(conn.socket, { type: "error", reason: "You are not in a match" });
      const rejected = submitIntent(match, conn.playerId, msg.intent);
      if (rejected) return send(conn.socket, { type: "error", reason: rejected });
      missedTurns.delete(match.id);
      if (match.state.winner) finishMatch(match, match.state.winner);
      else armTurnTimer(match);
      return;
    }

    case "surrender": {
      const match = conn.matchId ? getMatch(conn.matchId) : undefined;
      if (!match || !conn.playerId) return send(conn.socket, { type: "error", reason: "You are not in a match" });
      return finishMatch(match, forfeit(match, conn.playerId, "Surrendered"));
    }

    case "leave":
      return dropFromMatch(conn);
  }
}

// Puts a player who dropped back into their seat, if the match is still going.
function resumeMatch(conn: Conn) {
  if (!conn.user) return;
  const seat = seatOfUser.get(conn.user.id);
  if (!seat) return;
  const match = getMatch(seat.matchId);
  if (!match || match.state.winner) { seatOfUser.delete(conn.user.id); return; }

  const drop = dropTimers.get(match.id);
  if (drop) { clearTimeout(drop); dropTimers.delete(match.id); }

  conn.matchId = match.id;
  conn.playerId = seat.playerId;
  rebindSeat(match, seat.playerId, m => send(conn.socket, m as ServerMessage));

  const other: PlayerId = seat.playerId === "P1" ? "P2" : "P1";
  send(conn.socket, {
    type: "matched",
    matchId: match.id,
    you: seat.playerId,
    opponentName: match.seats[other].name,
  });
  broadcast(match);
  match.seats[other].send({ type: "opponentReturned" });
  armTurnTimer(match);
}

// A dropped socket does not end the match straight away. The player gets a
// short window to come back before the win is handed over.
function handleDisconnect(conn: Conn) {
  if (waiting && waiting.conn.socket === conn.socket) waiting = null;
  const match = conn.matchId ? getMatch(conn.matchId) : undefined;
  if (!match || !conn.playerId || match.state.winner) return;

  const gone = conn.playerId;
  const other: PlayerId = gone === "P1" ? "P2" : "P1";
  match.seats[other].send({ type: "opponentDisconnected", seconds: RECONNECT_SECONDS });
  // Nothing to send to a seat nobody is holding
  rebindSeat(match, gone, () => {});

  const timer = setTimeout(() => {
    const live = getMatch(match.id);
    if (!live || live.state.winner) return;
    finishMatch(live, forfeit(live, gone, "Left the match"));
  }, RECONNECT_SECONDS * 1000);
  dropTimers.set(match.id, timer);
}

function dropFromMatch(conn: Conn) {
  if (waiting && waiting.conn.socket === conn.socket) waiting = null;
  const match: Match | undefined = conn.matchId ? getMatch(conn.matchId) : undefined;
  if (!match || !conn.playerId) return;
  const other: PlayerId = conn.playerId === "P1" ? "P2" : "P1";
  match.seats[other].send({ type: "opponentLeft" });
  if (conn.user) seatOfUser.delete(conn.user.id);
  finishMatch(match, forfeit(match, conn.playerId, "Left the match"));
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
    handleDisconnect(conn);
    conns.delete(socket);
  });
});

await app.listen({ port: PORT, host: "0.0.0.0" });
app.server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});

console.log(`server listening on ${PORT}`);
