import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COST, ENERGY_PER_TURN, MISPLACED_PENALTY, TEAM,
  applyScoreIntent, available, createScoreMatch, playScoreTurn, scores, seatOf, valueOf,
  type ScoreCard, type ScoreIntent, type ScorePlayer, type ScoreState, type Seat, type SeatRef,
} from "@cg/score";
import { ARENA_CARD, ARENA_GAP, ARENA_SLOT, ARENA_WIDTH, TABLE_COLUMNS } from "../../design/arena";
import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import PrintCard from "../../components/PrintCard";
import CardBack from "../../components/CardBack";
import { Button, Panel, Text } from "../../components/primitives";
import { SCORE_POOL, cardFace, scoreCard } from "../../data/pool";

/**
 * Score Battle.
 *
 * Three bands, from the arena tokens: their team, the table, your team. Every
 * size on this screen comes from design/arena.ts, so the rows line up with each
 * other rather than with whatever looked right on the day.
 *
 * The rules live in @cg/score and are not restated here. This screen only
 * decides what a click means: pick a card, pick an action, and if the action is
 * a take, pick the seat it goes in.
 */

const YOU: ScorePlayer = "P1";
const THEM: ScorePlayer = "P2";
const BOT_THINKING_MS = 700;

type Pending = { index: number } | null;

export default function ScoreBattle({ onLeave }: { onLeave: () => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [state, setState] = useState<ScoreState>(() => createScoreMatch(SCORE_POOL, seed));
  const [selected, setSelected] = useState<number | null>(null);
  const [placing, setPlacing] = useState<Pending>(null);
  const [note, setNote] = useState<string | null>(null);

  const table = useMemo(() => scores(state, SCORE_POOL), [state]);

  const play = useCallback((intent: ScoreIntent) => {
    setState(current => {
      const { state: next, events } = applyScoreIntent(current, intent, YOU, SCORE_POOL);
      const refused = events.find(e => e.type === "REJECTED");
      setNote(refused && "reason" in refused ? refused.reason : null);
      return next;
    });
    setSelected(null);
    setPlacing(null);
  }, []);

  // The opponent takes its turn on its own, after long enough to watch
  useEffect(() => {
    if (state.over || state.turn !== THEM) return;
    const timer = setTimeout(() => {
      setState(current =>
        current.turn === THEM && !current.over
          ? playScoreTurn(current, THEM, SCORE_POOL).state
          : current,
      );
    }, BOT_THINKING_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const yours = state.turn === YOU && !state.over;

  const restart = () => {
    const next = Math.floor(Math.random() * 2 ** 31);
    setSeed(next);
    setState(createScoreMatch(SCORE_POOL, next));
    setSelected(null);
    setPlacing(null);
    setNote(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ARENA_GAP.band }}>
      <div style={{ width: ARENA_WIDTH, display: "flex", alignItems: "center", gap: SPACE.lg }}>
        <Text as="h2" role="title">Score Battle</Text>
        <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>
          seed {seed.toString(36)}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: SPACE.sm }}>
          <Button size="sm" tone="ghost" onClick={restart}>New table</Button>
          <Button size="sm" tone="ghost" onClick={onLeave}>Leave</Button>
        </div>
      </div>

      {/* ── Their side ── */}
      <TeamBand
        heading="Opponent"
        team={state.teams[THEM]}
        total={table[THEM]}
        card={ARENA_CARD.theirs}
        slot={ARENA_SLOT.theirs}
        active={state.turn === THEM && !state.over}
      />

      {/* ── The turn bar ── */}
      <TurnBar
        state={state}
        yours={yours}
        note={note}
        selected={selected}
        placing={placing !== null}
        onReveal={() => selected !== null && play({ type: "REVEAL", index: selected })}
        onDeny={() => selected !== null && play({ type: "DENY", index: selected })}
        onTake={() => selected !== null && setPlacing({ index: selected })}
        onCancel={() => { setSelected(null); setPlacing(null); }}
        onEndTurn={() => play({ type: "END_TURN" })}
      />

      {/* ── The table ── */}
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
            live={yours && placing === null && !slot.denied && !slot.takenBy}
            onSelect={() => setSelected(selected === index ? null : index)}
          />
        ))}
      </div>

      {/* ── Your side ── */}
      <TeamBand
        heading="Your team"
        team={state.teams[YOU]}
        total={table[YOU]}
        card={ARENA_CARD.yours}
        slot={ARENA_SLOT.yours}
        active={yours}
        placing={placing !== null}
        placingCard={placing !== null ? knownCard(state, placing.index) : null}
        onSeat={ref => placing !== null && play({ type: "TAKE", index: placing.index, seat: ref })}
      />

      {state.over && (
        <Panel padding={SPACE.xl} style={{ width: ARENA_WIDTH, textAlign: "center" }}>
          <Text as="h3" role="title">
            {state.winner === "draw" ? "A draw" : state.winner === YOU ? "You win" : "You lose"}
          </Text>
          <p style={{ ...text("data"), fontSize: 18, color: COLOR.mist, margin: `${SPACE.md}px 0 ${SPACE.lg}px` }}>
            {table[YOU]} — {table[THEM]}
          </p>
          <Button tone="primary" onClick={restart}>Play again</Button>
        </Panel>
      )}
    </div>
  );
}

// ── The bar that says what you can do ────────────────────────────────────────

function TurnBar({
  state, yours, note, selected, placing, onReveal, onDeny, onTake, onCancel, onEndTurn,
}: {
  state: ScoreState;
  yours: boolean;
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
  const canReveal = Boolean(slot && !slot.revealed && state.energy >= COST.reveal);
  const canDeny = Boolean(slot && slot.revealed && state.energy >= COST.deny);
  const canTake = Boolean(slot && state.takesLeft > 0);

  return (
    <Panel padding={0} style={{ width: ARENA_WIDTH }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.lg,
          padding: `0 ${SPACE.lg}px`,
          height: 56,
        }}
      >
        <span style={{ ...text("label"), fontSize: 10, color: yours ? COLOR.current : COLOR.fathom }}>
          {state.over ? "Finished" : yours ? "Your turn" : "Their turn"}
        </span>

        <Pips filled={state.energy} of={ENERGY_PER_TURN} label="energy" colour={COLOR.current} />
        <Pips filled={state.takesLeft} of={1} label="take" colour={COLOR.doubloon} />

        <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom, flex: 1, minWidth: 0 }}>
          {note
            ? note
            : placing
              ? "Pick a seat for it. A card in the wrong seat costs 2."
              : selected === null
                ? "Pick a card on the table."
                : slot?.revealed
                  ? "Take it, or deny it so nobody can."
                  : "Look at it, or take it blind."}
        </span>

        {yours && selected !== null && !placing && (
          <>
            {!slot?.revealed && (
              <Button size="sm" tone="secondary" onClick={onReveal} disabled={!canReveal}>
                Reveal · {COST.reveal}
              </Button>
            )}
            {slot?.revealed && (
              <Button size="sm" tone="secondary" onClick={onDeny} disabled={!canDeny}>
                Deny · {COST.deny}
              </Button>
            )}
            <Button size="sm" tone="primary" onClick={onTake} disabled={!canTake}>Take</Button>
          </>
        )}
        {yours && placing && <Button size="sm" tone="ghost" onClick={onCancel}>Cancel</Button>}
        {yours && selected === null && (
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
  const height = ARENA_SLOT.table;

  if (slot.takenBy) {
    return (
      <Empty width={width} height={height} label={slot.takenBy === "P1" ? "yours" : "theirs"} />
    );
  }

  return (
    <div
      onClick={live ? onSelect : undefined}
      style={{
        height,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        cursor: live ? "pointer" : "default",
        outline: selected ? `2px solid ${COLOR.current}` : "none",
        outlineOffset: 4,
        borderRadius: RADIUS.lg,
        position: "relative",
      }}
    >
      {slot.revealed && card ? (
        <div style={{ position: "relative" }}>
          <PrintCard card={cardFace(card.id)} print="base" width={width} interactive={false} />
          <Worth card={card} />
        </div>
      ) : (
        <CardBack width={width} height={Math.round(width * 1.4)} dim={slot.denied} />
      )}

      {slot.denied && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...text("label"),
            fontSize: 10,
            color: COLOR.signal,
            letterSpacing: "0.2em",
          }}
        >
          Denied
        </span>
      )}
    </div>
  );
}

/** The one number that matters, on any card whose face is known. */
function Worth({ card }: { card: ScoreCard }) {
  return (
    <span
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        minWidth: 22,
        padding: "2px 5px",
        borderRadius: RADIUS.sm,
        textAlign: "center",
        background: "rgba(7,12,19,0.86)",
        border: `1px solid ${COLOR.cable}`,
        ...text("data"),
        fontSize: 12,
        color: COLOR.doubloon,
      }}
    >
      {card.points}
    </span>
  );
}

function Empty({ width, height, label }: { width: number; height: number; label?: string }) {
  return (
    <div style={{ height, display: "flex", alignItems: "flex-end" }}>
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
        {label ?? ""}
      </div>
    </div>
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
  team: { captain: string | null; combat: (string | null)[]; support: (string | null)[] };
  total: number;
  card: number;
  slot: number;
  active: boolean;
  placing?: boolean;
  placingCard?: ScoreCard | null;
  onSeat?: (ref: SeatRef) => void;
}) {
  return (
    <Panel padding={SPACE.lg} style={{ width: ARENA_WIDTH, borderColor: active ? COLOR.cable : COLOR.rope }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md, marginBottom: SPACE.md }}>
        <span style={{ ...text("label"), fontSize: 9, color: active ? COLOR.current : COLOR.fathom }}>
          {heading}
        </span>
        <span style={{ ...text("data"), fontSize: 16, color: COLOR.foam, marginLeft: "auto" }}>{total}</span>
        <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>points</span>
      </div>

      <div style={{ display: "flex", gap: ARENA_GAP.row, flexWrap: "wrap" }}>
        {ROWS.map(({ row, count }) => (
          <div key={row} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>{row}</span>
            <div style={{ display: "flex", gap: ARENA_GAP.card }}>
              {Array.from({ length: count }, (_, i) => {
                const ref: SeatRef = { row, index: i };
                const held = seatOf(team as never, ref);
                const open = !held;
                const offering = placing && open;
                return (
                  <div
                    key={i}
                    onClick={offering && onSeat ? () => onSeat(ref) : undefined}
                    style={{
                      height: slot,
                      display: "flex",
                      alignItems: "flex-end",
                      cursor: offering ? "pointer" : "default",
                      borderRadius: RADIUS.lg,
                      outline: offering ? `2px solid ${COLOR.current}` : "none",
                      outlineOffset: 3,
                      position: "relative",
                    }}
                  >
                    {held ? (
                      <PrintCard card={cardFace(held)} print="base" width={card} interactive={false} />
                    ) : (
                      <Empty width={card} height={slot} />
                    )}
                    {offering && placingCard && (
                      <SeatHint card={placingCard} row={row} />
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
function SeatHint({ card, row }: { card: ScoreCard; row: Seat }) {
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
        background: "rgba(7,12,19,0.72)",
        ...text("data"),
        fontSize: 15,
        color: wrong ? COLOR.signal : COLOR.kelp,
      }}
    >
      {value}
      {wrong && (
        <span style={{ ...text("label"), fontSize: 7, color: COLOR.signal }}>
          −{MISPLACED_PENALTY}
        </span>
      )}
    </span>
  );
}

// ── Reading the state ────────────────────────────────────────────────────────

/** The card at a table position, when the state says it is known. */
function knownCard(state: ScoreState, index: number): ScoreCard | null {
  const slot = state.table[index];
  if (!slot?.revealed && !slot?.takenBy) return null;
  const id = state.cards[index];
  return id ? scoreCard(id) : null;
}

/** Exported for the hub, so it can say how big a table is without importing rules. */
export function tableSize(state: ScoreState): number {
  return available(state).length;
}
