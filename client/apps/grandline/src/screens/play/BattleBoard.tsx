import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerDraftResult, PlayerId } from "@cg/contracts";
import {
  applyBattleIntent, playBotTurn,
  type BattleEvent, type BattleIntent, type BattleState,
} from "@cg/battle";
import { COLOR, SPACE, text } from "../../design/tokens";
import HandOver from "./HandOver";
import type { EventFeed } from "./arena/cues";
import { Arena, seatName } from "./Arena";
import { Button, Currency, Panel, Text } from "../../components/primitives";
import { cardShortName } from "../../data/pool";
import * as api from "../../data/api";
import type { Store } from "../../data/store";

/**
 * A card battle played here: against the computer, or across one keyboard.
 *
 * The rules are the ones the old client already plays — the same engine, the
 * same intents, the same bot — and the board they are drawn on is the arena,
 * which knows nothing about any of it. This file owns the engine, the bot, and
 * handing the result in to be paid for; the arena owns everything you look at.
 *
 * Locally the board turns around between turns: the seat to move is always the
 * one at the bottom, and a hand-over screen stands between the two so the next
 * player is not given a screen with the last one's hand on it.
 *
 * This version plays the plain game: no domain meter, no spells, no perks, no
 * weapons. The engine still knows about them — they are the old client's — but
 * nothing here offers them and the bot is told to leave them alone, so both
 * players are playing the same game.
 */

const BOT_THINKING_MS = 800;

export type BattleOpponent = "ai" | "local";

/** What came back from handing the match in: nothing yet, a payout, or a no. */
type Reward = api.Payout | "refused" | null;

export default function BattleBoard({ initial, seed, drafts, opponent, title, store, onLeave }: {
  initial: BattleState;
  /** What the match was dealt from, so the server can replay it. */
  seed: number;
  drafts: { p1: PlayerDraftResult; p2: PlayerDraftResult };
  opponent: BattleOpponent;
  /** Which mode brought us here, for the rail. */
  title: string;
  store: Store;
  onLeave: () => void;
}) {
  const [state, setState] = useState<BattleState>(initial);
  const [note, setNote] = useState<string | null>(null);
  /** What has happened, as the engine reported it, put into words. */
  const [history, setHistory] = useState<string[]>([]);
  const [payout, setPayout] = useState<Reward>(null);
  /** The last batch of events, which the board animates. */
  const [feed, setFeed] = useState<EventFeed | null>(null);

  /**
   * Every intent played, in order. The server replays the match from the seed
   * and these rather than being told who won.
   */
  const log = useRef<BattleIntent[]>([]);

  /**
   * The state the log is written against. A state updater can be called more
   * than once for the same update, so the log is kept out of one: an intent
   * written down twice is a match that no longer replays.
   */
  const latest = useRef(state);
  latest.current = state;

  /** Whether this game has already been handed in. */
  const sent = useRef(false);

  /** Up while a local game is between two people, hiding the board. */
  const [passing, setPassing] = useState(false);

  const local = opponent === "local";
  /** The seat the board is drawn from. Fixed, even locally. */
  const you: PlayerId = "P1";
  const yourTurn = !state.winner && (local || state.activePlayer === you);

  const play = useCallback((intent: BattleIntent) => {
    const current = latest.current;
    const { state: next, events } = applyBattleIntent(current, intent);
    const illegal = events.find(e => e.type === "ILLEGAL");
    setNote(illegal && "reason" in illegal ? String(illegal.reason) : null);
    if (!illegal) {
      log.current.push(intent);
      latest.current = next;
      setState(next);
      setHistory(h => h.concat(tell(events, current, next, you, local)));
      if (events.length) setFeed(f => ({ id: (f?.id ?? 0) + 1, list: events }));
      // A local game changes hands the moment the turn does
      if (local && !next.winner && next.activePlayer !== current.activePlayer) setPassing(true);
    }
  }, [local]);

  // Against the computer, P2 plays itself, on the plain ruleset this board shows
  useEffect(() => {
    if (opponent !== "ai" || state.winner || state.activePlayer !== "P2") return;
    const timer = setTimeout(() => {
      const current = latest.current;
      if (current.activePlayer !== "P2" || current.winner) return;
      const { state: next, intents, events } = playBotTurn(current, "P2", { plain: true });
      log.current.push(...intents);
      latest.current = next;
      setState(next);
      setHistory(h => h.concat(tell(events, current, next, you, local)));
      if (events.length) setFeed(f => ({ id: (f?.id ?? 0) + 1, list: events }));
    }, BOT_THINKING_MS);
    return () => clearTimeout(timer);
  }, [state, opponent, local]);

  /**
   * A finished game against the computer is handed in and paid for. A local
   * game is not: two people at one keyboard decide the winner between them.
   */
  useEffect(() => {
    if (!state.winner || opponent !== "ai" || !store.signedIn || sent.current) return;
    sent.current = true;
    void store
      .settle(() => api.settleBattle({
        seed,
        p1: drafts.p1,
        p2: drafts.p2,
        intents: log.current,
        you: "P1",
      }))
      .then(result => setPayout(result ?? "refused"));
  }, [state.winner, opponent, store, seed, drafts]);

  return (
    <Arena
      state={state}
      events={feed}
      you={you}
      local={local}
      yourTurn={yourTurn}
      note={note}
      history={history}
      title={title}
      badge={local ? `Local · ${state.activePlayer}` : "vs Computer"}
      onIntent={play}
      onLeave={onLeave}
    >
      {passing && !state.winner && (
        <HandOver
          seat={seatName(state.activePlayer)}
          note="Your turn. The last player's hand is put away."
          onReady={() => setPassing(false)}
          onLeave={onLeave}
        />
      )}

      {state.winner && (
        <Result
          winner={state.winner}
          you={you}
          local={local}
          payout={payout}
          onLeave={onLeave}
        />
      )}
    </Arena>
  );
}

// ── The end ──────────────────────────────────────────────────────────────────

function Result({ winner, you, local, payout, onLeave }: {
  winner: PlayerId | "DRAW";
  you: PlayerId;
  local: boolean;
  payout: Reward;
  onLeave: () => void;
}) {
  const line = winner === "DRAW"
    ? "A draw"
    : local
      ? `${seatName(winner)} wins`
      : winner === you ? "You win" : "You lose";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(4,8,14,0.72)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Panel padding={SPACE.xxl} style={{ textAlign: "center", minWidth: 340 }} lifted>
        <Text as="h3" role="display">{line}</Text>

        <div style={{ marginTop: SPACE.lg }}>
          {local ? (
            <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>
              A local game pays nothing.
            </span>
          ) : payout === "refused" ? (
            <span style={{ ...text("small"), fontSize: 12, color: COLOR.signal }}>
              That match could not be settled, so nothing was paid for it.
            </span>
          ) : payout ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: SPACE.lg }}>
              <Currency kind="berries" amount={payout.berries} />
              <span style={{ ...text("small"), fontSize: 12, color: COLOR.mist }}>
                {payout.packs.length === 1 ? "1 pack" : `${payout.packs.length} packs`} to open
              </span>
              <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>
                no MMR from practice
              </span>
            </span>
          ) : (
            <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>Counting it up…</span>
          )}
        </div>

        <div style={{ marginTop: SPACE.xl }}>
          <Button tone="primary" onClick={onLeave}>Back to Play</Button>
        </div>
      </Panel>
    </div>
  );
}

/**
 * The engine's events, as lines a player can read. Only the ones a player
 * would tell: a card played, a blow landed, a card lost, a turn begun, the
 * end. The engine's own bookkeeping stays with the engine.
 */
function tell(events: BattleEvent[], before: BattleState, after: BattleState, you: PlayerId, local: boolean): string[] {
  const who = (pid: PlayerId) => (local ? seatName(pid) : pid === you ? "You" : "Opponent");
  const name = (instanceId: string) => {
    for (const s of [before, after]) {
      for (const p of Object.values(s.players)) {
        const card = [...p.hand, ...p.board, ...p.deck].find(c => c && c.instanceId === instanceId);
        if (card) return cardShortName(card.defId);
      }
    }
    return "a card";
  };
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "TURN_START": lines.push(`Turn ${e.turn} — ${who(e.pid)}`); break;
      case "CARD_PLAYED": lines.push(`${who(e.pid)} played ${name(e.instanceId)}`); break;
      case "ATTACK_CARD": lines.push(`${name(e.attackerId)} hit ${name(e.targetId)} for ${e.damage}`); break;
      case "ATTACK_LEADER": lines.push(`${name(e.attackerId)} hit the leader for ${e.damage}`); break;
      case "CARD_DIED": lines.push(`${name(e.instanceId)} fell`); break;
      case "GAME_OVER": lines.push(`${who(e.winner)} won`); break;
      default: break;
    }
  }
  return lines;
}
