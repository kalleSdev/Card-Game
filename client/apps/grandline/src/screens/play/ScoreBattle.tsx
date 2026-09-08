import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COST, ENERGY_PER_TURN, MISPLACED_PENALTY, TEAM, TEAM_SIZE,
  applyScoreIntent, createScoreMatch, playScoreTurn, scores, seatOf, valueOf,
  type ScoreCard as ScoreCardDef, type ScoreIntent, type ScorePlayer, type ScoreState,
  type Seat, type SeatRef, type Team,
} from "@cg/score";
import { ARENA_CARD, ARENA_GAP, ARENA_SLOT, ARENA_WIDTH, TABLE_COLUMNS } from "../../design/arena";
import { COLOR, RADIUS, SPACE, cardSlotHeight, text } from "../../design/tokens";
import ScoreCard from "../../components/ScoreCard";
import CardBack from "../../components/CardBack";
import { Button, Panel, Text } from "../../components/primitives";
import { SCORE_POOL, cardName, cardShortName, scoreCard } from "../../data/pool";

/**
 * Score Battle.
 *
 * Two phases, and the screen is really two screens sharing a frame.
 *
 * The draft is about the table: look at a card, lock one away, and take one a
 * turn into a hand nobody else can read. Placement is about your own board:
 * everything anybody drafted turns face up, and you sit your seven wherever you
 * think they are worth the most.
 *
 * Every size comes from design/arena.ts. The cards are the Score face, which
 * exists only in this mode.
 */

const YOU: ScorePlayer = "P1";
const THEM: ScorePlayer = "P2";
const BOT_THINKING_MS = 700;
const HAND_CARD = ARENA_CARD.yours;

export default function ScoreBattle({ onLeave }: { onLeave: () => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [state, setState] = useState<ScoreState>(() => createScoreMatch(SCORE_POOL, seed));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const total = useMemo(() => scores(state, SCORE_POOL), [state]);
  const yourTurn = state.phase === "draft" && state.turn === YOU;

  const play = useCallback((intent: ScoreIntent) => {
    setState(current => {
      const { state: next, events } = applyScoreIntent(current, intent, YOU, SCORE_POOL);
      const refused = events.find(e => e.type === "REJECTED");
      setNote(refused && "reason" in refused ? refused.reason : null);
      return next;
    });
    setSelectedIndex(null);
    setSelectedCard(null);
  }, []);

  // The opponent drafts on its own turn, and sits its hand as soon as it can
  useEffect(() => {
    if (state.over) return;
    const theirMove =
      (state.phase === "draft" && state.turn === THEM) ||
      (state.phase === "placement" && state.hands[THEM].length > 0);
    if (!theirMove) return;

    const timer = setTimeout(() => {
      setState(current => playScoreTurn(current, THEM, SCORE_POOL).state);
    }, BOT_THINKING_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const restart = () => {
    const next = Math.floor(Math.random() * 2 ** 31);
    setSeed(next);
    setState(createScoreMatch(SCORE_POOL, next));
    setSelectedIndex(null);
    setSelectedCard(null);
    setNote(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ARENA_GAP.band }}>
      <Header seed={seed} phase={state.phase} onRestart={restart} onLeave={onLeave} />

      {/* ── Their side ── */}
      {state.phase === "draft" ? (
        <HandBand
          heading="Opponent"
          count={state.hands[THEM].length}
          active={state.turn === THEM}
        />
      ) : (
        <TeamBand
          heading="Opponent"
          team={state.teams[THEM]}
          total={total[THEM]}
          card={ARENA_CARD.theirs}
          waiting={state.hands[THEM].length}
        />
      )}

      <StatusBar
        state={state}
        note={note}
        selectedIndex={selectedIndex}
        selectedCard={selectedCard}
        onReveal={() => selectedIndex !== null && play({ type: "REVEAL", index: selectedIndex })}
        onDeny={() => selectedIndex !== null && play({ type: "DENY", index: selectedIndex })}
        onTake={() => selectedIndex !== null && play({ type: "TAKE", index: selectedIndex })}
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
        {state.table.map((_, index) => (
          <TableCard
            key={index}
            state={state}
            index={index}
            selected={selectedIndex === index}
            live={yourTurn}
            onSelect={() => setSelectedIndex(selectedIndex === index ? null : index)}
          />
        ))}
      </div>

      {/* ── Your side ── */}
      {state.phase === "draft" ? (
        <YourHand cards={state.hands[YOU]} />
      ) : (
        <TeamBand
          heading="Your team"
          team={state.teams[YOU]}
          total={total[YOU]}
          card={ARENA_CARD.yours}
          placing={selectedCard}
          onSeat={ref => selectedCard && play({ type: "PLACE", cardId: selectedCard, seat: ref })}
          onUnseat={ref => play({ type: "UNPLACE", seat: ref })}
          hand={state.hands[YOU]}
          selectedCard={selectedCard}
          onPick={id => setSelectedCard(selectedCard === id ? null : id)}
        />
      )}

      {state.over && (
        <Panel padding={SPACE.xl} style={{ width: ARENA_WIDTH, textAlign: "center" }}>
          <Text as="h3" role="title">
            {state.winner === "draw" ? "A draw" : state.winner === YOU ? "You win" : "You lose"}
          </Text>
          <p style={{ ...text("data"), fontSize: 20, color: COLOR.mist, margin: `${SPACE.md}px 0 ${SPACE.lg}px` }}>
            {total[YOU]} — {total[THEM]}
          </p>
          <Button tone="primary" onClick={restart}>Play again</Button>
        </Panel>
      )}
    </div>
  );
}

// ── Frame ────────────────────────────────────────────────────────────────────

function Header({ seed, phase, onRestart, onLeave }: {
  seed: number;
  phase: ScoreState["phase"];
  onRestart: () => void;
  onLeave: () => void;
}) {
  const label = phase === "draft" ? "Draft" : phase === "placement" ? "Placement" : "Finished";
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
        {label}
      </span>
      <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>seed {seed.toString(36)}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: SPACE.sm }}>
        <Button size="sm" tone="ghost" onClick={onRestart}>New table</Button>
        <Button size="sm" tone="ghost" onClick={onLeave}>Leave</Button>
      </div>
    </div>
  );
}

function StatusBar({
  state, note, selectedIndex, selectedCard, onReveal, onDeny, onTake, onEndTurn,
}: {
  state: ScoreState;
  note: string | null;
  selectedIndex: number | null;
  selectedCard: string | null;
  onReveal: () => void;
  onDeny: () => void;
  onTake: () => void;
  onEndTurn: () => void;
}) {
  const drafting = state.phase === "draft";
  const yours = drafting && state.turn === YOU;
  const slot = selectedIndex !== null ? state.table[selectedIndex] : null;

  const message = note
    ? note
    : !drafting
      ? state.over
        ? "Every card is placed."
        : state.hands[YOU].length > 0
          ? selectedCard
            ? "Pick a seat. A card in the wrong seat costs 2."
            : "Pick a card from your hand."
          : "Waiting for them to finish placing."
      : !yours
        ? "They are thinking."
        : selectedIndex === null
          ? "Pick a card on the table."
          : slot?.revealed
            ? "Take it, or deny it so nobody can."
            : "Look at it, or take it blind.";

  return (
    <Panel padding={0} style={{ width: ARENA_WIDTH }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, padding: `0 ${SPACE.lg}px`, height: 56 }}>
        <span style={{ ...text("label"), fontSize: 10, color: yours ? COLOR.current : COLOR.fathom }}>
          {state.over ? "Finished" : drafting ? (yours ? "Your turn" : "Their turn") : "Placement"}
        </span>

        {drafting && (
          <>
            <Pips filled={state.energy} of={ENERGY_PER_TURN} label="energy" colour={COLOR.current} />
            <Pips filled={state.takesLeft} of={1} label="take" colour={COLOR.doubloon} />
            <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
              {state.hands[YOU].length}/{TEAM_SIZE} drafted
            </span>
          </>
        )}

        <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom, flex: 1, minWidth: 0 }}>
          {message}
        </span>

        {yours && selectedIndex !== null && (
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
        {yours && selectedIndex === null && (
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
  const card = faceOf(state, index);
  const width = ARENA_CARD.table;
  const height = ARENA_SLOT.table;
  const gone = Boolean(slot.takenBy) || slot.denied;
  const clickable = live && !gone;

  return (
    <div
      onClick={clickable ? onSelect : undefined}
      style={{
        height,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        position: "relative",
        cursor: clickable ? "pointer" : "default",
        outline: selected ? `2px solid ${COLOR.current}` : "none",
        outlineOffset: 4,
        borderRadius: RADIUS.lg,
      }}
    >
      {card ? (
        <ScoreCard
          card={card}
          name={cardShortName(card.id)}
          width={width}
          spent={gone}
          interactive={clickable}
        />
      ) : (
        <CardBack width={width} height={Math.round(width * 1.4)} dim={gone} />
      )}

      {slot.denied && <Stamp label="Denied" colour={COLOR.signal} />}
      {slot.takenBy && (
        <Stamp
          label={slot.takenBy === YOU ? "Yours" : "Theirs"}
          colour={slot.takenBy === YOU ? COLOR.current : COLOR.fathom}
        />
      )}
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
        background: "rgba(7,12,19,0.45)",
        borderRadius: RADIUS.lg,
      }}
    >
      {label}
    </span>
  );
}

// ── Hands, during the draft ──────────────────────────────────────────────────

function HandBand({ heading, count, active }: { heading: string; count: number; active: boolean }) {
  const width = ARENA_CARD.theirs;
  return (
    <Panel padding={SPACE.lg} style={{ width: ARENA_WIDTH, borderColor: active ? COLOR.cable : COLOR.rope }}>
      <BandHead heading={heading} right={`${count} / ${TEAM_SIZE} drafted`} active={active} />
      <div style={{ display: "flex", gap: ARENA_GAP.card, minHeight: Math.round(width * 1.4) }}>
        {Array.from({ length: TEAM_SIZE }, (_, i) =>
          i < count ? (
            <CardBack key={i} width={width} height={Math.round(width * 1.4)} />
          ) : (
            <EmptySlot key={i} width={width} height={Math.round(width * 1.4)} />
          ),
        )}
      </div>
    </Panel>
  );
}

function YourHand({ cards }: { cards: string[] }) {
  const width = HAND_CARD;
  return (
    <Panel padding={SPACE.lg} style={{ width: ARENA_WIDTH }}>
      <BandHead heading="Your hand" right={`${cards.length} / ${TEAM_SIZE} drafted`} active />
      <div style={{ display: "flex", gap: ARENA_GAP.card, minHeight: cardSlotHeight(width) }}>
        {Array.from({ length: TEAM_SIZE }, (_, i) => {
          const id = cards[i];
          const card = id ? scoreCard(id) : null;
          return (
            <div key={i} style={{ height: cardSlotHeight(width), display: "flex", alignItems: "flex-end" }}>
              {card ? (
                <ScoreCard card={card} name={cardShortName(card.id)} width={width} />
              ) : (
                <EmptySlot width={width} height={Math.round(width * 1.4)} />
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Teams, during placement ──────────────────────────────────────────────────

const ROWS: { row: Seat; count: number }[] = [
  { row: "captain", count: TEAM.captain },
  { row: "combat", count: TEAM.combat },
  { row: "support", count: TEAM.support },
];

function TeamBand({
  heading, team, total, card, placing = null, onSeat, onUnseat, waiting = 0,
  hand = [], selectedCard = null, onPick,
}: {
  heading: string;
  team: Team;
  total: number;
  card: number;
  placing?: string | null;
  onSeat?: (ref: SeatRef) => void;
  onUnseat?: (ref: SeatRef) => void;
  /** Cards they have drafted but not yet placed. */
  waiting?: number;
  hand?: string[];
  selectedCard?: string | null;
  onPick?: (id: string) => void;
}) {
  const placingCard = placing ? scoreCard(placing) : null;
  const slot = cardSlotHeight(card);

  return (
    <Panel padding={SPACE.lg} style={{ width: ARENA_WIDTH }}>
      <BandHead
        heading={heading}
        right={waiting > 0 ? `${waiting} still to place` : `${total} points`}
        active={Boolean(onSeat)}
      />

      <div style={{ display: "flex", gap: ARENA_GAP.row, flexWrap: "wrap" }}>
        {ROWS.map(({ row, count }) => (
          <div key={row} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>{row}</span>
            <div style={{ display: "flex", gap: ARENA_GAP.card }}>
              {Array.from({ length: count }, (_, i) => {
                const ref: SeatRef = { row, index: i };
                const held = seatOf(team, ref);
                const heldCard = held ? scoreCard(held) : null;
                const offering = Boolean(placingCard) && !held;
                return (
                  <div
                    key={i}
                    onClick={
                      offering && onSeat
                        ? () => onSeat(ref)
                        : held && onUnseat
                          ? () => onUnseat(ref)
                          : undefined
                    }
                    style={{
                      height: slot,
                      display: "flex",
                      alignItems: "flex-end",
                      position: "relative",
                      cursor: offering || (held && onUnseat) ? "pointer" : "default",
                      borderRadius: RADIUS.lg,
                      outline: offering ? `2px solid ${COLOR.current}` : "none",
                      outlineOffset: 3,
                    }}
                  >
                    {heldCard ? (
                      <ScoreCard card={heldCard} name={cardShortName(heldCard.id)} width={card} />
                    ) : (
                      <EmptySlot width={card} height={Math.round(card * 1.4)} />
                    )}
                    {offering && placingCard && <SeatHint card={placingCard} row={row} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* The cards still waiting for a seat, on your own band only */}
      {onPick && hand.length > 0 && (
        <div style={{ marginTop: SPACE.lg, paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.rope}` }}>
          <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>
            In hand · click one, then a seat
          </span>
          <div style={{ display: "flex", gap: ARENA_GAP.card, marginTop: 6 }}>
            {hand.map(id => {
              const held = scoreCard(id);
              if (!held) return null;
              return (
                <ScoreCard
                  key={id}
                  card={held}
                  name={cardShortName(id)}
                  width={card}
                  interactive
                  selected={selectedCard === id}
                  onClick={() => onPick(id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

function BandHead({ heading, right, active }: { heading: string; right: string; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md, marginBottom: SPACE.md }}>
      <span style={{ ...text("label"), fontSize: 9, color: active ? COLOR.current : COLOR.fathom }}>
        {heading}
      </span>
      <span style={{ ...text("data"), fontSize: 13, color: COLOR.mist, marginLeft: "auto" }}>{right}</span>
    </div>
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
        background: "rgba(7,12,19,0.72)",
        ...text("data"),
        fontSize: 16,
        color: wrong ? COLOR.signal : COLOR.kelp,
      }}
    >
      {value}
      {wrong && <span style={{ ...text("label"), fontSize: 7 }}>−{MISPLACED_PENALTY}</span>}
    </span>
  );
}

function EmptySlot({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: RADIUS.lg,
        border: `1px dashed ${COLOR.rope}`,
      }}
    />
  );
}

// ── Reading the state ────────────────────────────────────────────────────────

/** The Score card at a table position, when the state says it is known. */
function faceOf(state: ScoreState, index: number): ScoreCardDef | null {
  if (!state.table[index].revealed) return null;
  const id = state.cards[index];
  return id ? scoreCard(id) : null;
}

/** The character name, for anywhere a Score card needs one at full size. */
export function scoreCardName(id: string): string {
  return cardName(id);
}
