import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  COST, ENERGY_PER_TURN, MISPLACED_PENALTY, SKIPS_PER_GAME, TEAM, TEAM_SIZE,
  applyScoreIntent, createScoreMatch, playScoreTurn, scores, seatOf, seatsFilled, valueOf,
  type ScoreCard as ScoreCardDef, type ScoreIntent, type ScorePlayer, type ScoreState,
  type Seat, type SeatRef, type Team,
} from "@cg/score";
import {
  ARENA_GAP, ARENA_RAIL_WIDTH, ARENA_WIDTH, SEAT_GROUP_GAP, TABLE_COLUMNS,
  TURN_BAR_HEIGHT, boardSizesFor, plainCardHeight, seatSlotHeight, tableSlotHeight,
} from "../../design/arena";
import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import ScoreCard from "../../components/ScoreCard";
import CardBack from "../../components/CardBack";
import { Button, Currency, Panel, Text } from "../../components/primitives";
import { SCORE_POOL, artUrl, cardShortName, scoreCard } from "../../data/pool";
import * as api from "../../data/api";
import type { Store } from "../../data/store";

/**
 * Score Battle.
 *
 * Look at a card, lock one away, or take one straight into a seat, with the
 * seat chosen at the moment you take it. Taking is what ends a turn: the only
 * other way out is a skip, and there are two of those a game.
 *
 * The board is symmetrical: both teams draw at the same size on the same slot
 * height, so neither side looks more important than the other. The pool is the
 * row that gives up height when a window is short. Nothing scrolls.
 *
 * Two ways to act, and they are the two you would expect from a board game.
 * Arm an action from the bar and click the card you want it done to, or double
 * click a card to take it. A single click only brings a card forward, so
 * looking at something is never the same gesture as spending on it, and a click
 * on the board itself puts everything down again.
 */

const BOT_THINKING_MS = 750;

export type ScoreOpponent = "ai" | "local";

/** What came back from handing the match in: nothing yet, a payout, or a no. */
type Reward = api.Payout | "refused" | null;

/** What the bar has armed, waiting for a card. */
type Armed = "reveal" | "deny" | null;

export default function ScoreBattle({ opponent, store, onLeave }: {
  opponent: ScoreOpponent;
  store: Store;
  onLeave: () => void;
}) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [state, setState] = useState<ScoreState>(() => createScoreMatch(SCORE_POOL, seed));
  const [note, setNote] = useState<string | null>(null);
  const [payout, setPayout] = useState<Reward>(null);

  /**
   * Every intent played, in order, so the server can replay the match instead
   * of taking the client's word for who won it. Kept in a ref because it is a
   * log rather than state: nothing on screen is drawn from it.
   */
  const log = useRef<{ intent: ScoreIntent; by: ScorePlayer }[]>([]);

  /**
   * The state the log is written against. React is free to call a state updater
   * more than once for the same update, so anything that has to happen exactly
   * once for each intent cannot live inside one. Writing it down twice would
   * hand the server a match that cannot replay.
   */
  const latest = useRef(state);
  latest.current = state;

  /** Whether this game has already been handed in. */
  const sent = useRef(false);

  /**
   * The seats keep their sides for the whole game, even locally. Swapping them
   * with the turn made a card you had just placed look as though it had moved
   * to the other player's board.
   */
  const you: ScorePlayer = "P1";
  const local = opponent === "local";
  const yourTurn = !state.over && (local || state.turn === you);

  const play = useCallback((intent: ScoreIntent) => {
    const current = latest.current;
    const { state: next, events } = applyScoreIntent(current, intent, current.turn, SCORE_POOL);
    const refused = events.find(e => e.type === "REJECTED");
    setNote(refused && "reason" in refused ? refused.reason : null);
    if (!refused) {
      log.current.push({ intent, by: current.turn });
      latest.current = next;
      setState(next);
    }
  }, []);

  // Against the computer, P2 plays itself. In a local game both seats are yours.
  useEffect(() => {
    if (opponent !== "ai" || state.over || state.turn !== "P2") return;
    const timer = setTimeout(() => {
      const current = latest.current;
      if (current.turn !== "P2" || current.over) return;
      const { state: next, intents } = playScoreTurn(current, "P2", SCORE_POOL);
      for (const intent of intents) log.current.push({ intent, by: "P2" });
      latest.current = next;
      setState(next);
    }, BOT_THINKING_MS);
    return () => clearTimeout(timer);
  }, [state, opponent]);

  /**
   * A finished game against the computer is worth something, so it is handed
   * in. A local game is not: two people at one keyboard can decide the winner
   * between them, which is fine for a game and useless as a source of packs.
   */
  useEffect(() => {
    if (!state.over || opponent !== "ai" || !store.signedIn || sent.current) return;
    sent.current = true;
    void store
      .settle(() => api.settleScore({ seed, intents: log.current, you }))
      .then(result => setPayout(result ?? "refused"));
  }, [state.over, opponent, store, seed, you]);

  const restart = () => {
    const next = Math.floor(Math.random() * 2 ** 31);
    setSeed(next);
    setState(createScoreMatch(SCORE_POOL, next));
    log.current = [];
    sent.current = false;
    setPayout(null);
    setNote(null);
  };

  return (
    <ScoreTable
      state={state}
      you={you}
      yourTurn={yourTurn}
      local={local}
      note={note}
      seed={seed}
      badge={local ? `Local · ${state.turn}` : "vs Computer"}
      onIntent={play}
      onRestart={restart}
      onLeave={onLeave}
    >
      {state.over && (
        <Result
          state={state}
          total={scores(state, SCORE_POOL)}
          local={local}
          payout={payout}
          onRestart={restart}
          onLeave={onLeave}
        />
      )}
    </ScoreTable>
  );
}

/**
 * The table itself: two teams, the pool between them, and the bar that acts.
 *
 * It holds the game in its hands but none of the rules — what is picked up,
 * what is armed, what is being placed — and turns all of that into intents for
 * whoever is running the match. That is what lets the same table draw a game
 * against the computer and a game the server is running for two people.
 */
export function ScoreTable({
  state, you, yourTurn, local, note, seed, badge, onIntent, onRestart, onLeave, children,
}: {
  state: ScoreState;
  /** The seat drawn along the bottom. */
  you: ScorePlayer;
  yourTurn: boolean;
  /** Both seats played on one screen. */
  local: boolean;
  note: string | null;
  /** The deal this table came from. Online there is none: the seed is the deal. */
  seed?: number;
  /** The line under the title in the rail: who you are playing. */
  badge: string;
  onIntent: (intent: ScoreIntent) => void;
  /** Only offered where a new table costs nothing, which online it does not. */
  onRestart?: () => void;
  onLeave: () => void;
  children?: ReactNode;
}) {
  const [focused, setFocused] = useState<number | null>(null);
  const [armed, setArmed] = useState<Armed>(null);
  const [placing, setPlacing] = useState<number | null>(null);
  const { seat: seatCard, table: tableCard } = useBoardSizes();

  const them: ScorePlayer = you === "P1" ? "P2" : "P1";
  const total = useMemo(() => scores(state, SCORE_POOL), [state]);

  /** Puts everything down: nothing selected, nothing armed. */
  const clearAll = () => {
    setFocused(null);
    setArmed(null);
    setPlacing(null);
  };

  const play = (intent: ScoreIntent) => {
    onIntent(intent);
    setArmed(null);
    setPlacing(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape backs out of whatever is armed first, and only then leaves
      if (armed || placing !== null) {
        setArmed(null);
        setPlacing(null);
      } else {
        onLeave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave, armed, placing]);

  /** A click on a pool card. What it means depends on what is armed. */
  const onCard = (index: number) => {
    if (!yourTurn || placing !== null) return;
    if (armed === "reveal") return play({ type: "REVEAL", index });
    if (armed === "deny") return play({ type: "DENY", index });
    setFocused(focused === index ? null : index);
  };

  /** A double click always means take, whatever is armed. */
  const onCardTake = (index: number) => {
    if (!yourTurn || state.takesLeft < 1) return;
    setArmed(null);
    setFocused(index);
    setPlacing(index);
  };

  const slot = seatSlotHeight(seatCard);

  return (
    <div
      // A click on the board itself, rather than on anything in it, puts
      // whatever was picked up back down.
      onClick={clearAll}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflow: "hidden",
        background: `
          radial-gradient(1200px 700px at 50% -10%, rgba(62,143,160,0.08), transparent 70%),
          ${COLOR.abyss}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.lg,
        padding: SPACE.md,
      }}
    >
      {/* Everything that is not the game runs down the left, out of the way */}
      <Rail seed={seed} badge={badge} onRestart={onRestart} onLeave={onLeave} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: ARENA_GAP.band,
        }}
      >
      {/* Their side. Same size, same slot, same shape as yours. */}
      <TeamBand
        heading={local ? "Player two" : "Opponent"}
        team={state.teams[them]}
        total={total[them]}
        card={seatCard}
        slot={slot}
        active={!state.over && state.turn === them}
        placing={placing !== null && state.turn === them}
        placingCard={placing !== null ? knownCard(state, placing) : null}
        onSeat={ref => placing !== null && play({ type: "TAKE", index: placing, seat: ref })}
      />

      <TurnBar
        state={state}
        yourTurn={yourTurn}
        local={local}
        note={note}
        armed={armed}
        placing={placing !== null}
        onArm={next => { setArmed(armed === next ? null : next); setPlacing(null); }}
        onCancel={clearAll}
        onSkip={() => play({ type: "SKIP" })}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TABLE_COLUMNS}, ${tableCard}px)`,
          gap: ARENA_GAP.card,
        }}
      >
        {state.table.map((tableSlot, index) => (
          <TableCard
            key={index}
            state={state}
            index={index}
            width={tableCard}
            focused={focused === index}
            armed={armed}
            live={yourTurn && placing === null && !tableSlot.denied && !tableSlot.takenBy}
            onClick={() => onCard(index)}
            onDoubleClick={() => onCardTake(index)}
          />
        ))}
      </div>

      <TeamBand
        heading={local ? "Player one" : "Your team"}
        team={state.teams[you]}
        total={total[you]}
        card={seatCard}
        slot={slot}
        active={!state.over && state.turn === you}
        placing={placing !== null && state.turn === you}
        placingCard={placing !== null ? knownCard(state, placing) : null}
        onSeat={ref => placing !== null && play({ type: "TAKE", index: placing, seat: ref })}
      />
      </div>

      {children}
    </div>
  );
}

/** The sizes the window can hold, kept current as it is resized. */
function useBoardSizes(): { seat: number; table: number } {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return boardSizesFor(height);
}

// ── Frame ────────────────────────────────────────────────────────────────────

/**
 * The title and the two buttons that are not the game, stood on their side
 * down the left edge. Along the top they cost the board a whole row of height;
 * here they cost it nothing, because the board is limited by height and not by
 * width.
 */
function Rail({ seed, badge, onRestart, onLeave }: {
  seed?: number;
  badge: string;
  onRestart?: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: ARENA_RAIL_WIDTH,
        flex: "none",
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        gap: SPACE.md,
        padding: `${SPACE.md}px 0`,
      }}
    >
      <Text as="h2" role="title">Score<br />Battle</Text>

      <span
        style={{
          ...text("label"),
          fontSize: 9,
          color: COLOR.current,
          border: `1px solid ${COLOR.rope}`,
          borderRadius: RADIUS.sm,
          padding: "4px 8px",
          textAlign: "center",
        }}
      >
        {badge}
      </span>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: SPACE.sm }}>
        {seed !== undefined && (
          <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>
            seed {seed.toString(36)}
          </span>
        )}
        {onRestart && (
          <Button size="sm" tone="ghost" full onClick={onRestart}>New table</Button>
        )}
        <Button size="sm" tone="ghost" full onClick={onLeave}>Leave</Button>
      </div>
    </div>
  );
}

/**
 * The bar.
 *
 * Every control in it has a fixed width, and the message beside them takes
 * whatever is left. A button that changes what it says must not change where it
 * sits: a row that shuffles under the cursor is a row you have to look at twice
 * before every click.
 */
const BUTTON_WIDTH = 104;

function TurnBar({
  state, yourTurn, local, note, armed, placing, onArm, onCancel, onSkip,
}: {
  state: ScoreState;
  yourTurn: boolean;
  local: boolean;
  note: string | null;
  armed: Armed;
  placing: boolean;
  onArm: (next: Exclude<Armed, null>) => void;
  onCancel: () => void;
  onSkip: () => void;
}) {
  const skips = state.skipsLeft[state.turn];
  const busy = placing || armed !== null;

  const message = note
    ? note
    : state.over
      ? "Every seat is filled."
      : !yourTurn
        ? "They are thinking."
        : placing
          ? "Pick a seat for it. A card in the wrong seat costs 2."
          : armed === "reveal"
            ? "Click a face-down card to look at it."
            : armed === "deny"
              ? "Click any card to lock it away."
              : skips > 0
                ? "Double click a card to take it, or arm an action."
                : "No skips left: you have to take a card this turn.";

  const whose = state.over
    ? "Finished"
    : local
      ? `${state.turn === "P1" ? "Player one" : "Player two"} to play`
      : yourTurn ? "Your turn" : "Their turn";

  return (
    <Panel padding={0} style={{ width: ARENA_WIDTH }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.md,
          padding: `0 ${SPACE.lg}px`,
          height: TURN_BAR_HEIGHT,
        }}
      >
        <span
          style={{
            ...text("label"),
            fontSize: 10,
            color: yourTurn ? COLOR.current : COLOR.fathom,
            width: 118,
            flex: "none",
          }}
        >
          {whose}
        </span>
        <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom, width: 62, flex: "none" }}>
          {seatsFilled(state.teams[state.turn])}/{TEAM_SIZE} seats
        </span>

        <span
          style={{
            ...text("small"),
            fontSize: 13,
            color: COLOR.mist,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </span>

        {/* The two actions that cost something, with the energy that pays for
            them right beside the buttons rather than across the bar. */}
        <Pips filled={state.energy} of={ENERGY_PER_TURN} label="energy" colour={COLOR.current} />
        <span style={{ width: BUTTON_WIDTH, flex: "none" }}>
          <Button
            size="sm"
            full
            tone={armed === "reveal" ? "primary" : "secondary"}
            onClick={() => onArm("reveal")}
            disabled={!yourTurn || state.energy < COST.reveal}
          >
            Reveal · {COST.reveal}
          </Button>
        </span>
        <span style={{ width: BUTTON_WIDTH, flex: "none" }}>
          <Button
            size="sm"
            full
            tone={armed === "deny" ? "primary" : "secondary"}
            onClick={() => onArm("deny")}
            disabled={!yourTurn || state.energy < COST.deny}
          >
            Deny · {COST.deny}
          </Button>
        </span>

        {/* Skipping sits apart from the two that spend energy */}
        <span style={{ width: SPACE.xl, flex: "none" }} />
        <Pips filled={skips} of={SKIPS_PER_GAME} label="skips" colour={COLOR.doubloon} />
        <span style={{ width: BUTTON_WIDTH, flex: "none" }}>
          <Button
            size="sm"
            full
            tone="ghost"
            onClick={busy ? onCancel : onSkip}
            disabled={!yourTurn || (!busy && skips < 1)}
          >
            {busy ? "Cancel" : "Skip"}
          </Button>
        </span>
      </div>
    </Panel>
  );
}

function Pips({ filled, of, label, colour }: {
  filled: number;
  of: number;
  label: string;
  colour: string;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, flex: "none" }}>
      <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>{label}</span>
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: i < filled ? colour : "transparent",
            border: `1px solid ${i < filled ? colour : COLOR.rope}`,
          }}
        />
      ))}
    </span>
  );
}

// ── The pool ─────────────────────────────────────────────────────────────────

function TableCard({ state, index, width, focused, armed, live, onClick, onDoubleClick }: {
  state: ScoreState;
  index: number;
  width: number;
  focused: boolean;
  armed: Armed;
  live: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const slot = state.table[index];
  const card = knownCard(state, index);
  const gone = Boolean(slot.takenBy) || slot.denied;

  // A card the armed action could actually be used on
  const targeted =
    live && (armed === "reveal" ? !slot.revealed : armed === "deny" ? slot.revealed : false);

  return (
    <div
      onClick={live ? onClick : undefined}
      onDoubleClick={live ? onDoubleClick : undefined}
      style={{
        height: tableSlotHeight(width),
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        position: "relative",
        cursor: live ? "pointer" : "default",
        borderRadius: RADIUS.lg,
        transform: focused ? "translateY(-6px)" : "none",
        transition: "transform 160ms cubic-bezier(0.2,0,0.2,1)",
        userSelect: "none",
      }}
    >
      {/* A line down the left edge rather than a box around the card. A box
          reads as a selection rectangle from a file manager; a rule beside the
          card reads as a marker laid next to it. */}
      <Marker
        show={focused || targeted}
        colour={armed === "deny" ? COLOR.signal : COLOR.current}
        strong={focused}
      />
      {slot.takenBy ? (
        <TakenSlot width={width} by={slot.takenBy} />
      ) : card ? (
        <ScoreCard
          card={card}
          name={cardShortName(card.id)}
          art={artUrl(card.id)}
          width={width}
          spent={slot.denied}
          interactive={live}
        />
      ) : (
        <CardBack width={width} height={plainCardHeight(width)} dim={gone} />
      )}

      {slot.denied && <Stamp label="Denied" colour={COLOR.signal} />}
    </div>
  );
}

/** The rule laid beside a card the cursor or an armed action is pointing at. */
function Marker({ show, colour, strong }: { show: boolean; colour: string; strong: boolean }) {
  return (
    <span
      style={{
        position: "absolute",
        left: -7,
        top: "18%",
        bottom: "18%",
        width: 2,
        borderRadius: 2,
        background: colour,
        opacity: show ? (strong ? 0.95 : 0.45) : 0,
        transition: "opacity 140ms ease",
        pointerEvents: "none",
      }}
    />
  );
}

function TakenSlot({ width, by }: { width: number; by: ScorePlayer }) {
  return (
    <div
      style={{
        width,
        height: plainCardHeight(width),
        borderRadius: RADIUS.lg,
        border: `1px dashed ${COLOR.rope}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...text("label"),
        fontSize: 8,
        color: COLOR.fathom,
      }}
    >
      {by}
    </div>
  );
}

function Stamp({ label, colour }: { label: string; colour: string }) {
  return (
    <span
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...text("label"),
        fontSize: 9,
        letterSpacing: "0.2em",
        color: colour,
        background: "rgba(7,12,19,0.28)",
        borderRadius: RADIUS.lg,
      }}
    >
      {label}
    </span>
  );
}

// ── A team ───────────────────────────────────────────────────────────────────

const ROWS: { row: Seat; count: number }[] = [
  { row: "captain", count: TEAM.captain },
  { row: "combat", count: TEAM.combat },
  { row: "support", count: TEAM.support },
];

function TeamBand({
  heading, team, total, card, slot, active, placing = false, placingCard = null, onSeat,
}: {
  heading: string;
  team: Team;
  total: number;
  card: number;
  slot: number;
  active: boolean;
  /** True while a take is waiting for a seat, whether or not the card is known. */
  placing?: boolean;
  /** The card being placed, when it is face up. A blind take has none. */
  placingCard?: ScoreCardDef | null;
  onSeat?: (ref: SeatRef) => void;
}) {
  return (
    <Panel
      padding={SPACE.md}
      style={{ width: ARENA_WIDTH, borderColor: active ? COLOR.cable : COLOR.rope }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md, marginBottom: SPACE.sm }}>
        <span style={{ ...text("label"), fontSize: 9, color: active ? COLOR.current : COLOR.fathom }}>
          {heading}
        </span>
        <span style={{ ...text("data"), fontSize: 18, color: COLOR.foam, marginLeft: "auto" }}>{total}</span>
        <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>points</span>
      </div>

      <div style={{ display: "flex", gap: SEAT_GROUP_GAP, justifyContent: "space-between" }}>
        {ROWS.map(({ row, count }) => (
          <div key={row} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>{row}</span>
            <div style={{ display: "flex", gap: ARENA_GAP.card }}>
              {Array.from({ length: count }, (_, i) => {
                const ref: SeatRef = { row, index: i };
                const held = seatOf(team, ref);
                const heldCard = held ? scoreCard(held) : null;
                const offering = placing && !held;
                return (
                  <div
                    key={i}
                    onClick={offering && onSeat ? () => onSeat(ref) : undefined}
                    style={{
                      height: slot,
                      display: "flex",
                      alignItems: "flex-end",
                      position: "relative",
                      cursor: offering ? "pointer" : "default",
                      borderRadius: RADIUS.lg,
                      outline: offering ? `2px solid ${COLOR.current}` : "none",
                      outlineOffset: 3,
                    }}
                  >
                    {heldCard ? (
                      <ScoreCard
                        card={heldCard}
                        name={cardShortName(heldCard.id)}
                        art={artUrl(heldCard.id)}
                        width={card}
                      />
                    ) : (
                      <EmptySeat width={card} />
                    )}
                    {offering && (
                      placingCard
                        ? <SeatHint card={placingCard} row={row} />
                        : <BlindHint />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** What this card would actually score in this seat, before you commit to it. */
function SeatHint({ card, row }: { card: ScoreCardDef; row: Seat }) {
  const value = valueOf(card, row);
  const wrong = card.role !== row;
  return (
    <span
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        borderRadius: RADIUS.lg,
        background: "rgba(7,12,19,0.74)",
        ...text("data"),
        fontSize: 20,
        color: wrong ? COLOR.signal : COLOR.kelp,
      }}
    >
      {value}
      {wrong && <span style={{ ...text("label"), fontSize: 8 }}>−{MISPLACED_PENALTY}</span>}
    </span>
  );
}

/** A blind take has no number to show, so the seat says so rather than lying. */
function BlindHint() {
  return (
    <span
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: RADIUS.lg,
        background: "rgba(7,12,19,0.6)",
        ...text("label"),
        fontSize: 9,
        color: COLOR.mist,
      }}
    >
      Blind
    </span>
  );
}

function EmptySeat({ width }: { width: number }) {
  return (
    <div
      style={{
        width,
        height: plainCardHeight(width),
        borderRadius: RADIUS.lg,
        border: `1px dashed ${COLOR.rope}`,
      }}
    />
  );
}

// ── The end ──────────────────────────────────────────────────────────────────

function Result({ state, total, local, payout, onRestart, onLeave }: {
  state: ScoreState;
  total: Record<ScorePlayer, number>;
  local: boolean;
  payout: Reward;
  onRestart: () => void;
  onLeave: () => void;
}) {
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
      <Panel padding={SPACE.xxl} style={{ textAlign: "center", minWidth: 360 }} lifted>
        <Text as="h3" role="display">
          {state.winner === "draw"
            ? "A draw"
            : local
              ? `${state.winner} wins`
              : state.winner === "P1" ? "You win" : "You lose"}
        </Text>
        <p style={{ ...text("data"), fontSize: 30, color: COLOR.mist, margin: `${SPACE.lg}px 0 ${SPACE.lg}px` }}>
          {total.P1} — {total.P2}
        </p>

        <Reward payout={payout} local={local} />
        <div style={{ display: "flex", gap: SPACE.md, justifyContent: "center" }}>
          <Button tone="primary" onClick={onRestart}>Play again</Button>
          <Button tone="ghost" onClick={onLeave}>Leave</Button>
        </div>
      </Panel>
    </div>
  );
}

// ── Reading the state ────────────────────────────────────────────────────────

/** The Score card at a table position, when the state says it is known. */
function knownCard(state: ScoreState, index: number): ScoreCardDef | null {
  const slot = state.table[index];
  if (!slot?.revealed && !slot?.takenBy) return null;
  const id = state.cards[index];
  return id ? scoreCard(id) : null;
}

/**
 * What the match paid.
 *
 * A practice game pays packs and Berries but no MMR, so the panel says what
 * turned up rather than implying a ladder movement that did not happen.
 */
function Reward({ payout, local }: { payout: Reward; local: boolean }) {
  if (local) {
    return (
      <p style={{ ...text("small"), fontSize: 12, color: COLOR.fathom, marginBottom: SPACE.xl }}>
        A local game pays nothing. Two people at one keyboard can decide the winner between them.
      </p>
    );
  }

  if (payout === "refused") {
    return (
      <p style={{ ...text("small"), fontSize: 12, color: COLOR.signal, marginBottom: SPACE.xl }}>
        That match could not be settled, so nothing was paid for it.
      </p>
    );
  }

  if (!payout) {
    return (
      <p style={{ ...text("small"), fontSize: 12, color: COLOR.fathom, marginBottom: SPACE.xl }}>
        Counting it up…
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.lg,
        marginBottom: SPACE.xl,
        paddingTop: SPACE.md,
        borderTop: `1px solid ${COLOR.rope}`,
      }}
    >
      <Currency kind="berries" amount={payout.berries} />
      <span style={{ ...text("small"), fontSize: 12, color: COLOR.mist }}>
        {payout.packs.length === 1 ? "1 pack" : `${payout.packs.length} packs`} to open
      </span>
      <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>no MMR from practice</span>
    </div>
  );
}
