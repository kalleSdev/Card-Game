import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COST, ENERGY_PER_TURN, MISPLACED_PENALTY, TEAM, TEAM_SIZE,
  applyScoreIntent, createScoreMatch, playScoreTurn, scores, seatOf, seatsFilled, valueOf,
  type ScoreCard as ScoreCardDef, type ScoreIntent, type ScorePlayer, type ScoreState,
  type Seat, type SeatRef, type Team,
} from "@cg/score";
import {
  ARENA_CARD, ARENA_GAP, ARENA_SLOT, ARENA_WIDTH, TABLE_COLUMNS, TURN_BAR_HEIGHT,
} from "../../design/arena";
import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import ScoreCard from "../../components/ScoreCard";
import CardBack from "../../components/CardBack";
import { Button, Panel, Text } from "../../components/primitives";
import { SCORE_POOL, cardShortName, scoreCard } from "../../data/pool";

/**
 * Score Battle.
 *
 * One phase. You look at a card, lock one away, or take one straight into a
 * seat, and the seat is chosen at the moment you take it — so a blind take is a
 * gamble on the card and on where you are putting it at the same time.
 *
 * Three bands from design/arena.ts: their team, the table, yours. The whole
 * thing runs full screen, because a match should feel like a game rather than a
 * panel on a website.
 */

const BOT_THINKING_MS = 750;

export type ScoreOpponent = "ai" | "local";

export default function ScoreBattle({ opponent, onLeave }: {
  opponent: ScoreOpponent;
  onLeave: () => void;
}) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [state, setState] = useState<ScoreState>(() => createScoreMatch(SCORE_POOL, seed));
  const [selected, setSelected] = useState<number | null>(null);
  const [placing, setPlacing] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
    setSelected(null);
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onLeave(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  const restart = () => {
    const next = Math.floor(Math.random() * 2 ** 31);
    setSeed(next);
    setState(createScoreMatch(SCORE_POOL, next));
    setSelected(null);
    setPlacing(null);
    setNote(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflowY: "auto",
        background: `
          radial-gradient(1200px 700px at 50% -10%, rgba(62,143,160,0.08), transparent 70%),
          ${COLOR.abyss}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: ARENA_GAP.band,
        padding: `${SPACE.md}px ${SPACE.xl}px ${SPACE.lg}px`,
      }}
    >
      <Header
        seed={seed}
        local={opponent === "local"}
        seat={state.turn}
        onRestart={restart}
        onLeave={onLeave}
      />

      <TeamBand
        heading={opponent === "local" ? `Seat ${them}` : "Opponent"}
        team={state.teams[them]}
        total={total[them]}
        card={ARENA_CARD.theirs}
        slot={ARENA_SLOT.theirs}
        active={!state.over && state.turn === them}
      />

      <TurnBar
        state={state}
        yourTurn={yourTurn}
        note={note}
        selected={selected}
        placing={placing !== null}
        onReveal={() => selected !== null && play({ type: "REVEAL", index: selected })}
        onDeny={() => selected !== null && play({ type: "DENY", index: selected })}
        onTake={() => setPlacing(selected)}
        onCancel={() => { setSelected(null); setPlacing(null); }}
        onEndTurn={() => play({ type: "END_TURN" })}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TABLE_COLUMNS}, ${ARENA_CARD.table}px)`,
          gap: ARENA_GAP.card,
          width: ARENA_WIDTH,
        }}
      >
        {state.table.map((slot, index) => (
          <TableCard
            key={index}
            state={state}
            index={index}
            selected={selected === index}
            live={yourTurn && placing === null && !slot.denied && !slot.takenBy}
            onSelect={() => setSelected(selected === index ? null : index)}
          />
        ))}
      </div>

      <TeamBand
        heading={opponent === "local" ? `Seat ${you} — your turn` : "Your team"}
        team={state.teams[you]}
        total={total[you]}
        card={ARENA_CARD.yours}
        slot={ARENA_SLOT.yours}
        active={yourTurn}
        placing={placing !== null ? knownCard(state, placing) : null}
        onSeat={ref => placing !== null && play({ type: "TAKE", index: placing, seat: ref })}
      />

      {state.over && (
        <Panel padding={SPACE.xxl} style={{ width: ARENA_WIDTH, textAlign: "center" }} lifted>
          <Text as="h3" role="display">
            {state.winner === "draw"
              ? "A draw"
              : opponent === "local"
                ? `${state.winner} wins`
                : state.winner === "P1" ? "You win" : "You lose"}
          </Text>
          <p style={{ ...text("data"), fontSize: 26, color: COLOR.mist, margin: `${SPACE.lg}px 0 ${SPACE.xl}px` }}>
            {total.P1} — {total.P2}
          </p>
          <div style={{ display: "flex", gap: SPACE.md, justifyContent: "center" }}>
            <Button tone="primary" onClick={restart}>Play again</Button>
            <Button tone="ghost" onClick={onLeave}>Leave</Button>
          </div>
        </Panel>
      )}
    </div>
  );
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
  state, yourTurn, note, selected, placing, onReveal, onDeny, onTake, onCancel, onEndTurn,
}: {
  state: ScoreState;
  yourTurn: boolean;
  note: string | null;
  selected: number | null;
  placing: boolean;
  onReveal: () => void;
  onDeny: () => void;
  onTake: () => void;
  onCancel: () => void;
  onEndTurn: () => void;
}) {
  const slot = selected !== null ? state.table[selected] : null;

  const message = note
    ? note
    : state.over
      ? "Every seat is filled."
      : !yourTurn
        ? "They are thinking."
        : placing
          ? "Pick a seat for it. A card in the wrong seat costs 2."
          : selected === null
            ? "Pick a card on the table."
            : slot?.revealed
              ? "Take it, or deny it so nobody can."
              : "Look at it, or take it blind.";

  return (
    <Panel padding={0} style={{ width: ARENA_WIDTH }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, padding: `0 ${SPACE.lg}px`, height: TURN_BAR_HEIGHT }}>
        <span style={{ ...text("label"), fontSize: 10, color: yourTurn ? COLOR.current : COLOR.fathom }}>
          {state.over ? "Finished" : yourTurn ? "Your turn" : "Their turn"}
        </span>

        <Pips filled={state.energy} of={ENERGY_PER_TURN} label="energy" colour={COLOR.current} />
        <Pips filled={state.takesLeft} of={1} label="take" colour={COLOR.doubloon} />
        <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
          {seatsFilled(state.teams[state.turn])}/{TEAM_SIZE} seats
        </span>

        <span style={{ ...text("small"), fontSize: 13, color: COLOR.mist, flex: 1, minWidth: 0 }}>
          {message}
        </span>

        {yourTurn && selected !== null && !placing && (
          <>
            {!slot?.revealed && (
              <Button size="sm" tone="secondary" onClick={onReveal} disabled={state.energy < COST.reveal}>
                Reveal · {COST.reveal}
              </Button>
            )}
            {slot?.revealed && (
              <Button size="sm" tone="secondary" onClick={onDeny} disabled={state.energy < COST.deny}>
                Deny · {COST.deny}
              </Button>
            )}
            <Button size="sm" tone="primary" onClick={onTake} disabled={state.takesLeft < 1}>Take</Button>
          </>
        )}
        {yourTurn && placing && <Button size="sm" tone="ghost" onClick={onCancel}>Cancel</Button>}
        {yourTurn && selected === null && (
          <Button size="sm" tone="ghost" onClick={onEndTurn}>End turn</Button>
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
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
      <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>{label}</span>
    </span>
  );
}

// ── The table ────────────────────────────────────────────────────────────────

function TableCard({ state, index, selected, live, onSelect }: {
  state: ScoreState;
  index: number;
  selected: boolean;
  live: boolean;
  onSelect: () => void;
}) {
  const slot = state.table[index];
  const card = knownCard(state, index);
  const width = ARENA_CARD.table;
  const gone = Boolean(slot.takenBy) || slot.denied;

  return (
    <div
      onClick={live ? onSelect : undefined}
      style={{
        height: ARENA_SLOT.table,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        position: "relative",
        cursor: live ? "pointer" : "default",
        outline: selected ? `2px solid ${COLOR.current}` : "none",
        outlineOffset: 4,
        borderRadius: RADIUS.lg,
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
      {by === "P1" ? "P1" : "P2"}
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
  heading, team, total, card, slot, active, placing = null, onSeat,
}: {
  heading: string;
  team: Team;
  total: number;
  card: number;
  slot: number;
  active: boolean;
  placing?: ScoreCardDef | null;
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

      <div style={{ display: "flex", gap: SPACE.lg, flexWrap: "wrap" }}>
        {ROWS.map(({ row, count }) => (
          <div key={row} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>{row}</span>
            <div style={{ display: "flex", gap: ARENA_GAP.card }}>
              {Array.from({ length: count }, (_, i) => {
                const ref: SeatRef = { row, index: i };
                const held = seatOf(team, ref);
                const heldCard = held ? scoreCard(held) : null;
                const offering = Boolean(placing) && !held;
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
                    {offering && placing && <SeatHint card={placing} row={row} />}
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

// ── Reading the state ────────────────────────────────────────────────────────

/** The Score card at a table position, when the state says it is known. */
function knownCard(state: ScoreState, index: number): ScoreCardDef | null {
  const slot = state.table[index];
  if (!slot?.revealed && !slot?.takenBy) return null;
  const id = state.cards[index];
  return id ? scoreCard(id) : null;
}
