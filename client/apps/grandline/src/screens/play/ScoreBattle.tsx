import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COST, ENERGY_PER_TURN, MISPLACED_PENALTY, TEAM, TEAM_SIZE,
  applyScoreIntent, createScoreMatch, playScoreTurn, scores, seatOf, seatsFilled, valueOf,
  type ScoreCard as ScoreCardDef, type ScoreIntent, type ScorePlayer, type ScoreState,
  type Seat, type SeatRef, type Team,
} from "@cg/score";
import {
  ARENA_CARD, ARENA_GAP, ARENA_SLOT, ARENA_WIDTH, SEAT_GROUP_GAP, TABLE_COLUMNS,
  TURN_BAR_HEIGHT, seatCardFor, seatSlotHeight,
} from "../../design/arena";
import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import ScoreCard from "../../components/ScoreCard";
import CardBack from "../../components/CardBack";
import { Button, Panel, Text } from "../../components/primitives";
import { SCORE_POOL, cardShortName, scoreCard } from "../../data/pool";

/**
 * Score Battle.
 *
 * One phase. Look at a card, lock one away, or take one straight into a seat,
 * with the seat chosen at the moment you take it.
 *
 * The board is symmetrical: both teams draw at the same size, on the same slot
 * height, so neither side looks more important than the other. The pool is the
 * row that gives up height, because it is twenty cards you glance across
 * against seven you are building something out of. Nothing scrolls.
 *
 * Two ways to act, and they are the two you would expect from a board game.
 * Arm an action from the bar and click the card you want it done to, or double
 * click a card to take it. A single click only brings a card forward, so
 * looking at something is never the same gesture as spending on it.
 */

const BOT_THINKING_MS = 750;

export type ScoreOpponent = "ai" | "local";

/** What the bar has armed, waiting for a card. */
type Armed = "reveal" | "deny" | null;

export default function ScoreBattle({ opponent, onLeave }: {
  opponent: ScoreOpponent;
  onLeave: () => void;
}) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [state, setState] = useState<ScoreState>(() => createScoreMatch(SCORE_POOL, seed));
  const [focused, setFocused] = useState<number | null>(null);
  const [armed, setArmed] = useState<Armed>(null);
  const [placing, setPlacing] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const seatCard = useSeatCard();

  const total = useMemo(() => scores(state, SCORE_POOL), [state]);

  /** Whoever is sitting at the keyboard right now. Both seats, in a local game. */
  const you: ScorePlayer = opponent === "local" ? state.turn : "P1";
  const them: ScorePlayer = you === "P1" ? "P2" : "P1";
  const yourTurn = !state.over && state.turn === you;

  const play = useCallback((intent: ScoreIntent) => {
    setState(current => {
      const { state: next, events } = applyScoreIntent(current, intent, current.turn, SCORE_POOL);
      const refused = events.find(e => e.type === "REJECTED");
      setNote(refused && "reason" in refused ? refused.reason : null);
      return next;
    });
    setArmed(null);
    setPlacing(null);
  }, []);

  // Against the computer, P2 plays itself. In a local game both seats are yours.
  useEffect(() => {
    if (opponent !== "ai" || state.over || state.turn !== "P2") return;
    const timer = setTimeout(() => {
      setState(current =>
        current.turn === "P2" && !current.over
          ? playScoreTurn(current, "P2", SCORE_POOL).state
          : current,
      );
    }, BOT_THINKING_MS);
    return () => clearTimeout(timer);
  }, [state, opponent]);

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
    setNote(null);
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

  const restart = () => {
    const next = Math.floor(Math.random() * 2 ** 31);
    setSeed(next);
    setState(createScoreMatch(SCORE_POOL, next));
    setFocused(null);
    setArmed(null);
    setPlacing(null);
    setNote(null);
  };

  const slot = seatSlotHeight(seatCard);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflow: "hidden",
        background: `
          radial-gradient(1200px 700px at 50% -10%, rgba(62,143,160,0.08), transparent 70%),
          ${COLOR.abyss}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: ARENA_GAP.band,
        padding: `${SPACE.md}px ${SPACE.xl}px`,
      }}
    >
      <Header
        seed={seed}
        local={opponent === "local"}
        seat={state.turn}
        onRestart={restart}
        onLeave={onLeave}
      />

      {/* Their side. Same size, same slot, same shape as yours. */}
      <TeamBand
        heading={opponent === "local" ? `Seat ${them}` : "Opponent"}
        team={state.teams[them]}
        total={total[them]}
        card={seatCard}
        slot={slot}
        active={!state.over && state.turn === them}
      />

      <TurnBar
        state={state}
        yourTurn={yourTurn}
        note={note}
        armed={armed}
        placing={placing !== null}
        onArm={next => { setArmed(armed === next ? null : next); setPlacing(null); }}
        onCancel={() => { setArmed(null); setPlacing(null); }}
        onEndTurn={() => play({ type: "END_TURN" })}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TABLE_COLUMNS}, ${ARENA_CARD.table}px)`,
          gap: ARENA_GAP.card,
        }}
      >
        {state.table.map((tableSlot, index) => (
          <TableCard
            key={index}
            state={state}
            index={index}
            focused={focused === index}
            armed={armed}
            live={yourTurn && placing === null && !tableSlot.denied && !tableSlot.takenBy}
            onClick={() => onCard(index)}
            onDoubleClick={() => onCardTake(index)}
          />
        ))}
      </div>

      <TeamBand
        heading={opponent === "local" ? `Seat ${you} — your turn` : "Your team"}
        team={state.teams[you]}
        total={total[you]}
        card={seatCard}
        slot={slot}
        active={yourTurn}
        placing={placing !== null}
        placingCard={placing !== null ? knownCard(state, placing) : null}
        onSeat={ref => placing !== null && play({ type: "TAKE", index: placing, seat: ref })}
      />

      {state.over && (
        <Result
          state={state}
          total={total}
          local={opponent === "local"}
          onRestart={restart}
          onLeave={onLeave}
        />
      )}
    </div>
  );
}

/** The seat size the window can hold, kept current as it is resized. */
function useSeatCard(): number {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return seatCardFor(height);
}

// ── Frame ────────────────────────────────────────────────────────────────────

function Header({ seed, local, seat, onRestart, onLeave }: {
  seed: number;
  local: boolean;
  seat: ScorePlayer;
  onRestart: () => void;
  onLeave: () => void;
}) {
  return (
    <div style={{ width: ARENA_WIDTH, display: "flex", alignItems: "center", gap: SPACE.lg }}>
      <Text as="h2" role="title">Score Battle</Text>
      <span
        style={{
          ...text("label"),
          fontSize: 9,
          color: COLOR.current,
          border: `1px solid ${COLOR.rope}`,
          borderRadius: RADIUS.sm,
          padding: "3px 8px",
        }}
      >
        {local ? `Local · ${seat}` : "vs Computer"}
      </span>
      <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>seed {seed.toString(36)}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: SPACE.sm }}>
        <Button size="sm" tone="ghost" onClick={onRestart}>New table</Button>
        <Button size="sm" tone="ghost" onClick={onLeave}>Leave</Button>
      </div>
    </div>
  );
}

function TurnBar({
  state, yourTurn, note, armed, placing, onArm, onCancel, onEndTurn,
}: {
  state: ScoreState;
  yourTurn: boolean;
  note: string | null;
  armed: Armed;
  placing: boolean;
  onArm: (next: Exclude<Armed, null>) => void;
  onCancel: () => void;
  onEndTurn: () => void;
}) {
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
              ? "Click a face-up card to lock it away."
              : "Double click a card to take it, or arm an action.";

  return (
    <Panel padding={0} style={{ width: ARENA_WIDTH }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.md,
          padding: `0 ${SPACE.lg}px`,
          height: TURN_BAR_HEIGHT,
        }}
      >
        <span style={{ ...text("label"), fontSize: 10, color: yourTurn ? COLOR.current : COLOR.fathom }}>
          {state.over ? "Finished" : yourTurn ? "Your turn" : "Their turn"}
        </span>
        <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
          {seatsFilled(state.teams[state.turn])}/{TEAM_SIZE} seats
        </span>

        <span style={{ ...text("small"), fontSize: 13, color: COLOR.mist, flex: 1, minWidth: 0 }}>
          {message}
        </span>

        {/* The two actions that cost something, with the energy that pays for
            them right beside the buttons rather than across the bar. */}
        <Pips filled={state.energy} of={ENERGY_PER_TURN} label="energy" colour={COLOR.current} />
        <Button
          size="sm"
          tone={armed === "reveal" ? "primary" : "secondary"}
          onClick={() => onArm("reveal")}
          disabled={!yourTurn || state.energy < COST.reveal}
        >
          Reveal · {COST.reveal}
        </Button>
        <Button
          size="sm"
          tone={armed === "deny" ? "primary" : "secondary"}
          onClick={() => onArm("deny")}
          disabled={!yourTurn || state.energy < COST.deny}
        >
          Deny · {COST.deny}
        </Button>

        {/* Ending the turn sits apart from the two that spend */}
        <span style={{ width: SPACE.xl, flex: "none" }} />
        <Pips filled={state.takesLeft} of={1} label="take" colour={COLOR.doubloon} />
        {placing || armed ? (
          <Button size="sm" tone="ghost" onClick={onCancel}>Cancel</Button>
        ) : (
          <Button size="sm" tone="ghost" onClick={onEndTurn} disabled={!yourTurn}>End turn</Button>
        )}
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

function TableCard({ state, index, focused, armed, live, onClick, onDoubleClick }: {
  state: ScoreState;
  index: number;
  focused: boolean;
  armed: Armed;
  live: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const slot = state.table[index];
  const card = knownCard(state, index);
  const width = ARENA_CARD.table;
  const gone = Boolean(slot.takenBy) || slot.denied;

  // A card the armed action could actually be used on
  const targeted =
    live && (armed === "reveal" ? !slot.revealed : armed === "deny" ? slot.revealed : false);

  return (
    <div
      onClick={live ? onClick : undefined}
      onDoubleClick={live ? onDoubleClick : undefined}
      style={{
        height: ARENA_SLOT.table,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        position: "relative",
        cursor: live ? "pointer" : "default",
        outline: focused
          ? `2px solid ${COLOR.current}`
          : targeted
            ? `1px solid ${armed === "deny" ? COLOR.signal : COLOR.current}`
            : "none",
        outlineOffset: 3,
        borderRadius: RADIUS.lg,
        transform: focused ? "translateY(-6px)" : "none",
        transition: "transform 160ms cubic-bezier(0.2,0,0.2,1)",
        userSelect: "none",
      }}
    >
      {slot.takenBy ? (
        <TakenSlot width={width} by={slot.takenBy} />
      ) : card ? (
        <ScoreCard
          card={card}
          name={cardShortName(card.id)}
          width={width}
          spent={slot.denied}
          interactive={live}
        />
      ) : (
        <CardBack width={width} height={Math.round(width * 1.4)} dim={gone} />
      )}

      {slot.denied && <Stamp label="Denied" colour={COLOR.signal} />}
    </div>
  );
}

function TakenSlot({ width, by }: { width: number; by: ScorePlayer }) {
  return (
    <div
      style={{
        width,
        height: Math.round(width * 1.4),
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
        background: "rgba(7,12,19,0.5)",
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

      <div style={{ display: "flex", gap: SEAT_GROUP_GAP, justifyContent: "center" }}>
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
                      <ScoreCard card={heldCard} name={cardShortName(heldCard.id)} width={card} />
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
        height: Math.round(width * 1.4),
        borderRadius: RADIUS.lg,
        border: `1px dashed ${COLOR.rope}`,
      }}
    />
  );
}

// ── The end ──────────────────────────────────────────────────────────────────

function Result({ state, total, local, onRestart, onLeave }: {
  state: ScoreState;
  total: Record<ScorePlayer, number>;
  local: boolean;
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
        <p style={{ ...text("data"), fontSize: 30, color: COLOR.mist, margin: `${SPACE.lg}px 0 ${SPACE.xl}px` }}>
          {total.P1} — {total.P2}
        </p>
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
