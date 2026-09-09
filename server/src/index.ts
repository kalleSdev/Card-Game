import Fastify from "fastify";
import { WebSocketServer, type WebSocket } from "ws";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import { cardsFor, botFor, DEFAULT_UNIVERSE, type UniverseId } from "./universes.js";
import {
  walletOf, printsOf, copiesOf, unopenedPacks, openOwnedPack, replayPack, buyPack,
  payOutMatch, scrapSpares, craftPrint,
  decksOf, saveDeck, deleteDeck, grantStarter,
  cosmeticsOwned, profileOf, saveProfile,
  type ScrapAction, type StoredDeck, type Profile,
} from "./packs.js";
import { PACKS, PRINTS, RANKS, COSMETIC_BY_ID, isProfileIcon, type PackId, type PrintId } from "@cg/meta";
import { applyResult, leaderboard, standingOf } from "./ranking.js";
import { recent, postMatch, postStreak, postRank } from "./feed.js";
import { settleScoreMatch, settleBattleMatch, ReplayError } from "./practice.js";
import {
  createScoreGame, getScoreGame, endScoreGame, submitScoreIntent, playScoreFor,
  scoreViewFor, scoreTotals, rebindScoreSeat, liveScoreGames, type ScoreGame,
} from "./scoreMatches.js";
import type { ScorePlayer } from "@cg/score";
import { LobbyBook } from "./lobbies.js";
import {
  openTrade, joinTrade, cancelTrade, setOffer, confirmTrade, openTradeFor, historyFor,
  type Offer,
} from "./trades.js";
import {
  createMatch, validateDraft, runBotIfItsTurn, getMatch, endMatch, broadcast, submitIntent,
  forfeit, rebindSeat, forceEndTurn, type Match,
} from "./matches.js";
import {
  register, login, logout, userForToken, getCollection, recordResult,
  AuthError, type PublicUser,
} from "./auth.js";

const PORT = Number(process.env.PORT ?? 8787);


const app = Fastify({ logger: false });

app.addHook("onSend", async (_req, reply) => {
  reply.header("access-control-allow-origin", process.env.CORS_ORIGIN ?? "*");
  reply.header("access-control-allow-headers", "content-type, authorization");
  reply.header("access-control-allow-methods", "GET, POST, OPTIONS");
});
app.options("/*", async (_req, reply) => reply.code(204).send());

const bearer = (auth?: string) => auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;

// A POST with nothing to say is normal on routes that take no body, and fetch
// sends a JSON content type regardless. Fastify rejects an empty JSON body out
// of the box, which turns an ordinary call into a 400, so treat it as {}.
app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  const text = typeof body === "string" ? body.trim() : "";
  if (text === "") return done(null, {});
  try {
    done(null, JSON.parse(text));
  } catch {
    done(new Error("Body is not valid JSON"), undefined);
  }
});

app.get("/health", async () => ({
  ok: true,
  matches: liveMatchIds.size,
  scoreMatches: liveScoreGames(),
  lobbies: lobbies.size + scoreLobbies.size,
}));

app.post("/auth/register", async (req, reply) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  try {
    const out = register(username ?? "", password ?? "");
    grantStarter(out.user.id);
    return out;
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

// ── Collection, packs and money ──────────────────────────────────────────────
// Everything here is the player's own, so every route reads the user from the
// token rather than taking an id from the caller.

function requireUser(req: { headers: { authorization?: string } }) {
  const user = userForToken(bearer(req.headers.authorization));
  if (!user) throw new AuthError("Not signed in");
  return user;
}

/** Turns a thrown error into a status the client can act on. */
async function guarded<T>(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, run: () => T) {
  try {
    return run();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    if (err instanceof ReplayError) return reply.code(422).send({ error: message });
    return reply.code(err instanceof AuthError ? 401 : 400).send({ error: message });
  }
}

app.get("/collection", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    return {
      prints: printsOf(user.id),
      wallet: walletOf(user.id),
      packs: unopenedPacks(user.id),
      decks: decksOf(user.id),
      standing: standingOf(user.id),
      cosmetics: cosmeticsOwned(user.id),
      profile: profileOf(user.id),
    };
  }),
);

// The ladder is public: you can see where everyone stands without an account.
// Each standing carries what that player is wearing, so the list looks like the
// people on it rather than a spreadsheet of names.
app.get("/leaderboard", async () => {
  const standings = leaderboard(50);
  return {
    standings: standings.map(s => ({ ...s, profile: profileOf(s.userId) })),
    ranks: RANKS,
  };
});

// Public, like the ladder: the feed is the room, and you can watch it without
// having an account of your own.
app.get("/feed", async (req) => {
  const { limit } = (req.query ?? {}) as { limit?: string };
  return { entries: recent(Number(limit) || 50) };
});

// ── Practice matches ────────────────────────────────────────────────────────
// A game against the computer is played in the browser and submitted when it
// ends. Nothing about the result is taken on trust: the seed and every intent
// come with it, and the server replays the match through the same engine to
// find out who actually won before it pays anybody.

app.post("/practice/score", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const body = (req.body ?? {}) as Parameters<typeof settleScoreMatch>[1];
    return settleScoreMatch(user, body, DEFAULT_UNIVERSE);
  }),
);

app.post("/practice/battle", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const body = (req.body ?? {}) as Parameters<typeof settleBattleMatch>[1];
    return settleBattleMatch(user, body, DEFAULT_UNIVERSE);
  }),
);

// ── Trading ─────────────────────────────────────────────────────────────────
// One table at a time per player, opened with a code the way a lobby is. Every
// route reads the trade from the id and checks the caller is actually sitting
// at it, so nobody can look at or touch somebody else's table.

app.get("/trades", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    return { trade: openTradeFor(user.id), history: historyFor(user.id) };
  }),
);

app.post("/trades", async (req, reply) =>
  guarded(reply, () => ({ trade: openTrade(requireUser(req).id) })),
);

app.post("/trades/join", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { code } = (req.body ?? {}) as { code?: string };
    return { trade: joinTrade(user.id, code ?? "") };
  }),
);

app.post("/trades/:id/offer", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<Offer>;
    return {
      trade: setOffer(user.id, id, {
        prints: body.prints ?? [],
        berries: body.berries ?? 0,
      }),
    };
  }),
);

app.post("/trades/:id/confirm", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    return { trade: confirmTrade(user.id, id) };
  }),
);

app.post("/trades/:id/cancel", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    cancelTrade(user.id, id);
    return { ok: true };
  }),
);

/**
 * What a player is wearing. Only what is actually owned is accepted, so a
 * client cannot equip a title it never pulled by asking nicely.
 */
app.post("/profile", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const body = (req.body ?? {}) as Partial<Profile>;
    const owned = new Set(cosmeticsOwned(user.id));

    const wearable = (id: unknown, kind: "title" | "banner" | "border"): string | null => {
      if (typeof id !== "string" || id === "") return null;
      const def = COSMETIC_BY_ID[id];
      if (!def || def.kind !== kind) throw new Error("No such cosmetic");
      if (!owned.has(id)) throw new Error(`You do not own that ${kind}`);
      return id;
    };

    // Icons are the same short list for everyone until they become cosmetics
    let iconId: string | null = null;
    if (typeof body.iconId === "string" && body.iconId !== "") {
      if (!isProfileIcon(body.iconId)) throw new Error("No such icon");
      iconId = body.iconId;
    }

    const showcase = Array.isArray(body.showcase)
      ? body.showcase.filter(id => typeof id === "string").slice(0, 6)
      : [];

    saveProfile(user.id, {
      iconId,
      titleId: wearable(body.titleId, "title"),
      bannerId: wearable(body.bannerId, "banner"),
      borderId: wearable(body.borderId, "border"),
      showcase,
    });
    return { profile: profileOf(user.id) };
  }),
);

app.get("/packs", async (req, reply) =>
  guarded(reply, () => ({ packs: unopenedPacks(requireUser(req).id), catalogue: PACKS })),
);

app.post("/packs/:id/open", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    return openOwnedPack(user.id, id);
  }),
);

app.get("/packs/:id/replay", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const opened = replayPack(user.id, id);
    if (!opened) return reply.code(404).send({ error: "No opened pack with that id" });
    return opened;
  }),
);

app.post("/packs/buy", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { packId } = (req.body ?? {}) as { packId?: string };
    if (!packId || !(packId in PACKS)) throw new Error("No such pack");
    return buyPack(user.id, packId as PackId);
  }),
);

app.post("/collection/scrap", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { cardId, print, amount, action, includeLast } = (req.body ?? {}) as {
      cardId?: string; print?: string; amount?: number; action?: string; includeLast?: boolean;
    };
    if (!cardId) throw new Error("Which card?");
    if (!print || !(PRINTS as readonly string[]).includes(print)) throw new Error("No such print");
    if (action !== "dust" && action !== "sell") throw new Error("Dust it or sell it");
    const result = scrapSpares(
      user.id, cardId, print as PrintId, Math.max(1, amount ?? 1), action as ScrapAction,
      includeLast === true,
    );
    return { ...result, wallet: walletOf(user.id) };
  }),
);

app.post("/collection/craft", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const { cardId, print } = (req.body ?? {}) as { cardId?: string; print?: string };
    if (!cardId) throw new Error("Which card?");
    if (!print || !(PRINTS as readonly string[]).includes(print)) throw new Error("No such print");
    craftPrint(user.id, cardId, print as PrintId);
    return { wallet: walletOf(user.id) };
  }),
);

app.post("/decks", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    const deck = (req.body ?? {}) as Partial<StoredDeck>;
    if (!deck.id || typeof deck.name !== "string") throw new Error("That is not a deck");
    saveDeck(user.id, {
      id: deck.id,
      name: deck.name.slice(0, 60),
      leaderId: deck.leaderId ?? null,
      cardIds: Array.isArray(deck.cardIds) ? deck.cardIds.slice(0, 60) : [],
      prints: deck.prints ?? {},
      updatedAt: Date.now(),
    });
    return { ok: true };
  }),
);

app.delete("/decks/:id", async (req, reply) =>
  guarded(reply, () => {
    const user = requireUser(req);
    deleteDeck(user.id, (req.params as { id: string }).id);
    return { ok: true };
  }),
);

// ── Sockets ──────────────────────────────────────────────────────────────────
interface Conn {
  socket: WebSocket;
  user?: PublicUser;
  matchId?: string;
  playerId?: PlayerId;
  /** The Score match this socket is sitting in, which is a separate game. */
  scoreId?: string;
  scoreSeat?: ScorePlayer;
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
const lobbies = new LobbyBook<Conn>();
// Score rooms carry no deck: the table is dealt by the server when they meet
const scoreLobbies = new LobbyBook<Conn, null>();
const scoreSeatOfUser = new Map<string, { gameId: string; player: ScorePlayer }>();
const scoreTimers = new Map<string, NodeJS.Timeout>();
const liveMatchIds = new Set<string>();

const send = (ws: WebSocket, msg: ServerMessage) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

function startMatch(
  a: { conn: Conn; draft: PlayerDraftResult },
  b: { conn: Conn; draft: PlayerDraftResult },
  universe: UniverseId,
) {
  try {
    pairUp(a, b, universe);
  } catch (err) {
    // Neither player should be left staring at an empty queue if this ever throws
    const reason = err instanceof Error ? err.message : "Could not start the match";
    send(a.conn.socket, { type: "error", reason });
    send(b.conn.socket, { type: "error", reason });
  }
}

function pairUp(
  a: { conn: Conn; draft: PlayerDraftResult },
  b: { conn: Conn; draft: PlayerDraftResult },
  universe: UniverseId,
) {
  const nameOf = (c: Conn) => c.user?.username ?? "Player";
  const match = createMatch(
    cardsFor(universe),
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
function startPractice(conn: Conn, draft: PlayerDraftResult, universe: UniverseId) {
  const nothing = () => {};
  const match = createMatch(
    cardsFor(universe),
    { seat: { name: conn.user?.username ?? "Player", send: m => send(conn.socket, m as ServerMessage) }, draft },
    { seat: { name: "Computer", send: nothing }, draft: randomDraft(universe) },
  );
  match.botSeat = "P2";
  match.botPlay = botFor(universe);
  liveMatchIds.add(match.id);
  conn.matchId = match.id;
  conn.playerId = "P1";
  if (conn.user) seatOfUser.set(conn.user.id, { matchId: match.id, playerId: "P1" });
  send(conn.socket, { type: "matched", matchId: match.id, you: "P1", opponentName: "Computer" });
  broadcast(match);
  runBotIfItsTurn(match);
  armTurnTimer(match);
}

function randomDraft(universe: UniverseId): PlayerDraftResult {
  const cardDb = cardsFor(universe);
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

// ── Score Battle, between two people ─────────────────────────────────────────

function startScoreMatch(a: Conn, b: Conn, universe: UniverseId) {
  const seatFor = (c: Conn) => ({
    name: c.user?.username ?? "Player",
    userId: c.user?.id,
    send: (m: unknown) => send(c.socket, m as ServerMessage),
  });

  const game = createScoreGame(universe, seatFor(a), seatFor(b));

  a.scoreId = game.id; a.scoreSeat = "P1";
  b.scoreId = game.id; b.scoreSeat = "P2";
  if (a.user) scoreSeatOfUser.set(a.user.id, { gameId: game.id, player: "P1" });
  if (b.user) scoreSeatOfUser.set(b.user.id, { gameId: game.id, player: "P2" });

  send(a.socket, { type: "scoreMatched", matchId: game.id, you: "P1", opponentName: game.seats.P2.name });
  send(b.socket, { type: "scoreMatched", matchId: game.id, you: "P2", opponentName: game.seats.P1.name });
  broadcastScore(game);
  armScoreTimer(game);
}

/** Every seat gets the table with the other side's secrets left out. */
function broadcastScore(game: ScoreGame) {
  for (const player of ["P1", "P2"] as ScorePlayer[]) {
    game.seats[player].send({ type: "scoreState", state: scoreViewFor(game, player) });
  }
}

/**
 * A seat that stops answering has its turn played by the bot. Nobody loses for
 * dropping out of a Score match: the table empties either way, and a finished
 * game pays both players.
 */
function armScoreTimer(game: ScoreGame) {
  const existing = scoreTimers.get(game.id);
  if (existing) clearTimeout(existing);
  if (game.state.over) { scoreTimers.delete(game.id); return; }

  const timer = setTimeout(() => {
    const live = getScoreGame(game.id);
    if (!live || live.state.over) return;
    playScoreFor(live, live.state.turn);
    afterScoreTurn(live);
  }, TURN_SECONDS * 1000);
  scoreTimers.set(game.id, timer);
}

/** What happens after anything moves a Score match along. */
function afterScoreTurn(game: ScoreGame) {
  broadcastScore(game);
  if (game.state.over) finishScoreMatch(game);
  else armScoreTimer(game);
}

function finishScoreMatch(game: ScoreGame) {
  settleScore(game);
  const timer = scoreTimers.get(game.id);
  if (timer) clearTimeout(timer);
  scoreTimers.delete(game.id);
  for (const [userId, seat] of scoreSeatOfUser) {
    if (seat.gameId === game.id) scoreSeatOfUser.delete(userId);
  }
  endScoreGame(game.id);
}

/**
 * Pays out a finished Score match. This one does count for the ladder: the
 * other side was a person, which is the whole difference between this and a
 * practice game.
 */
function settleScore(game: ScoreGame) {
  const winner = game.state.winner;
  if (!winner) return;
  const totals = scoreTotals(game);
  const turns = game.state.round;

  for (const player of ["P1", "P2"] as ScorePlayer[]) {
    const seat = game.seats[player];
    const conn = [...conns.values()].find(c => c.scoreId === game.id && c.scoreSeat === player);
    if (!seat.userId || !conn?.user) continue;

    const opponent = game.seats[player === "P1" ? "P2" : "P1"].name;
    const won = winner === player;
    recordResult(seat.userId, opponent, won, turns);
    postMatch(conn.user, opponent, won, turns);

    let rankChange = null;
    try {
      rankChange = applyResult(seat.userId, won);
      if (rankChange.streak >= 3) postStreak(conn.user, rankChange.streak);
      if (rankChange.rankedUp || rankChange.rankedDown) {
        postRank(conn.user, rankChange.rank, rankChange.rankName, rankChange.rankedUp, rankChange.after);
      }
    } catch (err) {
      console.warn("ranking failed", conn.user.username, err);
    }

    try {
      const payout = payOutMatch(seat.userId, won, game.universe);
      send(conn.socket, {
        type: "rewards",
        packs: payout.packs.map(pack => ({ id: pack.id, packId: pack.packId })),
        berries: payout.berries,
        rank: rankChange,
      });
    } catch (err) {
      console.warn("payout failed", conn.user.username, err);
    }
  }

  // A draw is a draw, but the score is worth saying out loud in the logs
  if (winner === "draw") console.warn("score draw", game.id, totals.P1, totals.P2);
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
    if (!conn?.user) continue;

    const won = winner === pid;
    recordResult(conn.user.id, opponent, won, match.state.turn);

    postMatch(conn.user, opponent, won, match.state.turn);

    let rankChange = null;
    try {
      rankChange = applyResult(conn.user.id, won);
      // A streak is worth saying once it is a run rather than two in a row
      if (rankChange.streak >= 3) postStreak(conn.user, rankChange.streak);
      if (rankChange.rankedUp || rankChange.rankedDown) {
        postRank(conn.user, rankChange.rank, rankChange.rankName, rankChange.rankedUp, rankChange.after);
      }
    } catch (err) {
      console.warn("ranking failed", conn.user.username, err);
    }

    // Packs and Berries. Wrapped because a payout failing should not stop the
    // result being recorded or the other player being paid.
    try {
      const payout = payOutMatch(conn.user.id, won);
      send(conn.socket, {
        type: "rewards",
        packs: payout.packs.map(p => ({ id: p.id, packId: p.packId })),
        berries: payout.berries,
        rank: rankChange,
      });
    } catch (err) {
      console.warn("payout failed", conn.user.username, err);
    }
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
    case "createLobby": {
      const universe = msg.universe ?? DEFAULT_UNIVERSE;
      const bad = validateDraft(msg.draft, cardsFor(universe));
      if (bad) return send(conn.socket, { type: "error", reason: bad });
      const lobby = lobbies.create(conn, conn.user.username, msg.draft, universe);
      return send(conn.socket, { type: "lobbyOpen", code: lobby.code });
    }

    case "joinLobby": {
      const lobby = lobbies.find(msg.code);
      if (!lobby) return send(conn.socket, { type: "error", reason: "No lobby with that code" });
      if (lobby.host.socket === conn.socket) {
        return send(conn.socket, { type: "error", reason: "That is your own lobby" });
      }
      if (lobby.host.socket.readyState !== lobby.host.socket.OPEN) {
        lobbies.close(lobby.code);
        return send(conn.socket, { type: "error", reason: "The host is no longer connected" });
      }
      const bad = validateDraft(msg.draft, cardsFor(lobby.universe));
      if (bad) return send(conn.socket, { type: "error", reason: bad });
      lobbies.close(lobby.code);
      return startMatch(
        { conn: lobby.host, draft: lobby.payload },
        { conn, draft: msg.draft },
        lobby.universe,
      );
    }

    case "createScoreLobby": {
      const universe = msg.universe ?? DEFAULT_UNIVERSE;
      const lobby = scoreLobbies.create(conn, conn.user.username, null, universe);
      return send(conn.socket, { type: "lobbyOpen", code: lobby.code });
    }

    case "joinScoreLobby": {
      const lobby = scoreLobbies.find(msg.code);
      if (!lobby) return send(conn.socket, { type: "error", reason: "No room with that code" });
      if (lobby.host.socket === conn.socket) {
        return send(conn.socket, { type: "error", reason: "That is your own room" });
      }
      if (lobby.host.socket.readyState !== lobby.host.socket.OPEN) {
        scoreLobbies.close(lobby.code);
        return send(conn.socket, { type: "error", reason: "The host is no longer connected" });
      }
      scoreLobbies.close(lobby.code);
      return startScoreMatch(lobby.host, conn, lobby.universe);
    }

    case "scoreIntent": {
      const game = conn.scoreId ? getScoreGame(conn.scoreId) : undefined;
      if (!game || !conn.scoreSeat) {
        return send(conn.socket, { type: "error", reason: "You are not in a match" });
      }
      const refused = submitScoreIntent(game, conn.scoreSeat, msg.intent);
      if (refused) return send(conn.socket, { type: "error", reason: refused });
      return afterScoreTurn(game);
    }

    case "cancelLobby":
      lobbies.closeFor(conn);
      scoreLobbies.closeFor(conn);
      return;

    case "practice": {
      const universe = msg.universe ?? DEFAULT_UNIVERSE;
      const bad = validateDraft(msg.draft, cardsFor(universe));
      if (bad) return send(conn.socket, { type: "error", reason: bad });
      lobbies.closeFor(conn);
      return startPractice(conn, msg.draft, universe);
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

// Puts a player who dropped back into their Score seat, if it is still going.
function resumeScoreMatch(conn: Conn): boolean {
  if (!conn.user) return false;
  const seat = scoreSeatOfUser.get(conn.user.id);
  if (!seat) return false;
  const game = getScoreGame(seat.gameId);
  if (!game || game.state.over) { scoreSeatOfUser.delete(conn.user.id); return false; }

  conn.scoreId = game.id;
  conn.scoreSeat = seat.player;
  rebindScoreSeat(game, seat.player, m => send(conn.socket, m as ServerMessage));

  const other: ScorePlayer = seat.player === "P1" ? "P2" : "P1";
  send(conn.socket, {
    type: "scoreMatched",
    matchId: game.id,
    you: seat.player,
    opponentName: game.seats[other].name,
  });
  broadcastScore(game);
  return true;
}

// Puts a player who dropped back into their seat, if the match is still going.
function resumeMatch(conn: Conn) {
  if (!conn.user) return;
  if (resumeScoreMatch(conn)) return;
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
  lobbies.closeFor(conn);
  scoreLobbies.closeFor(conn);
  // A Score seat is left where it is: the bot covers it, and the player can
  // come back to a game that has moved on rather than to a loss.
  if (conn.scoreId) parkScoreSeat(conn);
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
  lobbies.closeFor(conn);
  scoreLobbies.closeFor(conn);
  dropFromScore(conn);
  const match: Match | undefined = conn.matchId ? getMatch(conn.matchId) : undefined;
  if (!match || !conn.playerId) return;
  const other: PlayerId = conn.playerId === "P1" ? "P2" : "P1";
  match.seats[other].send({ type: "opponentLeft" });
  if (conn.user) seatOfUser.delete(conn.user.id);
  finishMatch(match, forfeit(match, conn.playerId, "Left the match"));
  conn.matchId = undefined;
  conn.playerId = undefined;
}

/** Stops writing to a socket that has gone, and lets the bot take the seat. */
function parkScoreSeat(conn: Conn) {
  const game = conn.scoreId ? getScoreGame(conn.scoreId) : undefined;
  if (!game || !conn.scoreSeat || game.state.over) return;
  rebindScoreSeat(game, conn.scoreSeat, () => {});
  game.seats[conn.scoreSeat === "P1" ? "P2" : "P1"].send({
    type: "opponentDisconnected",
    seconds: TURN_SECONDS,
  });
}

/** Leaving a Score match hands the rest of it to the bot. */
function dropFromScore(conn: Conn) {
  const game = conn.scoreId ? getScoreGame(conn.scoreId) : undefined;
  conn.scoreId = undefined;
  const seat = conn.scoreSeat;
  conn.scoreSeat = undefined;
  if (!game || !seat || game.state.over) return;
  if (conn.user) scoreSeatOfUser.delete(conn.user.id);
  rebindScoreSeat(game, seat, () => {});
  game.seats[seat === "P1" ? "P2" : "P1"].send({ type: "opponentLeft" });
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
