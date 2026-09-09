import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PlayerDraftResult, PlayerId } from "@cg/contracts";
import {
  applyBattleIntent, playBotTurn,
  type BattleCard, type BattleIntent, type BattleState,
} from "@cg/battle";
import {
  ARENA_GAP, ARENA_RAIL_WIDTH, BATTLE_COLUMNS, SEAT_GROUP_GAP,
  TURN_BAR_HEIGHT, battleRowWidth, battleSizesFor, plainCardHeight,
  type BattleSizes,
} from "../../design/arena";
import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import PrintCard from "../../components/PrintCard";
import HandOver from "./HandOver";
import { Button, Currency, Panel, Text } from "../../components/primitives";
import { cardFace } from "../../data/pool";
import * as api from "../../data/api";
import type { Store } from "../../data/store";

/**
 * The card battle, Grand Line.
 *
 * The rules are the ones the old client already plays: the same engine, the
 * same intents, the same bot. What is new is the board around them.
 *
 * Three bands, mirrored. Their leader and five slots on top, the turn bar in
 * the middle, your five slots and leader below it, and your hand under that.
 * Both sides draw at the same size on the same slot height, so the board never
 * flatters one player over the other.
 *
 * Locally the board turns around between turns: the seat to move is always
 * the one at the bottom, and a hand-over screen stands between the two so the
 * next player is not handed a screen with the last one's hand on it.
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
  const [payout, setPayout] = useState<Reward>(null);

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
      const { state: next, intents } = playBotTurn(current, "P2", { plain: true });
      log.current.push(...intents);
      latest.current = next;
      setState(next);
    }, BOT_THINKING_MS);
    return () => clearTimeout(timer);
  }, [state, opponent]);

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
    <Board
      state={state}
      you={you}
      local={local}
      yourTurn={yourTurn}
      note={note}
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
    </Board>
  );
}

/**
 * The board itself: three bands, a hand, and nothing else.
 *
 * It holds no rules and no connection. Whatever is driving the match — the
 * engine in this file, or a server on the other end of a socket — hands it a
 * state and takes back intents, which is the whole of what it knows how to do.
 * Overlays are passed as children, so a driver can put its own screens over it.
 */
export function Board({
  state, you, local, yourTurn, note, title, badge, opponentName, onIntent, onLeave, children,
}: {
  state: BattleState;
  /** The seat drawn along the bottom. */
  you: PlayerId;
  /** Both seats played on one screen, so the board turns around each turn. */
  local: boolean;
  yourTurn: boolean;
  note: string | null;
  title: string;
  /** The line under the title in the rail: who you are playing. */
  badge: string;
  opponentName?: string;
  onIntent: (intent: BattleIntent) => void;
  onLeave: () => void;
  children?: ReactNode;
}) {
  const sizes = useBattleSizes();
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => { setHeld(null); }, [state.activePlayer]);

  const them: PlayerId = you === "P1" ? "P2" : "P1";
  const actor = state.activePlayer;
  const attacking = state.pendingAttackerId;

  // Locally the seat to move comes to the bottom, because the person to move is
  // the one sitting in front of the screen. Online your own seat never moves.
  const acting = local ? actor : you;
  const top = local && actor === "P2" ? you : them;
  const bottom = local && actor === "P2" ? them : you;
  const hand = state.players[acting].hand;

  const play = (intent: BattleIntent) => { if (yourTurn) onIntent(intent); };

  /** A click on one of your own cards: pick it up to attack with. */
  const onMine = (card: BattleCard) => {
    if (attacking === card.instanceId) return play({ type: "CANCEL_ATTACK", pid: acting });
    play({ type: "SELECT_ATTACKER", pid: acting, instanceId: card.instanceId });
  };

  /** A click on one of theirs: swing at it, if something is picked up. */
  const onTheirs = (card: BattleCard) => {
    if (!attacking) return;
    play({ type: "ATTACK_CARD", pid: acting, targetInstanceId: card.instanceId });
  };

  const onTheirLeader = () => {
    if (!attacking) return;
    play({ type: "ATTACK_LEADER", pid: acting });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (state.pendingAttackerId) onIntent({ type: "CANCEL_ATTACK", pid: state.activePlayer });
      else onLeave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave, onIntent, state.pendingAttackerId, state.activePlayer]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflow: "hidden",
        background: `
          radial-gradient(1100px 620px at 50% -8%, rgba(214,65,47,0.07), transparent 68%),
          radial-gradient(900px 520px at 50% 108%, rgba(62,143,160,0.09), transparent 66%),
          ${COLOR.abyss}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.lg,
        padding: SPACE.md,
      }}
    >
      <Rail title={title} badge={badge} turn={state.turn} onLeave={onLeave} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ARENA_GAP.band }}>
        <Side
          player={state.players[top]}
          sizes={sizes}
          heading={local ? seatName(top) : opponentName ?? "Opponent"}
          active={!state.winner && actor === top}
          facing="down"
          attackable={Boolean(attacking) && top !== acting}
          onCard={top === acting ? onMine : onTheirs}
          onLeader={top === acting ? undefined : onTheirLeader}
        />

        <TurnBar
          state={state}
          sizes={sizes}
          yourTurn={yourTurn}
          local={local}
          note={note}
          onEndTurn={() => play({ type: "END_TURN", pid: acting })}
          onCancel={() => play({ type: "CANCEL_ATTACK", pid: acting })}
        />

        <Side
          player={state.players[bottom]}
          sizes={sizes}
          heading={local ? seatName(bottom) : "You"}
          active={!state.winner && actor === bottom}
          facing="up"
          attackable={Boolean(attacking) && bottom !== acting}
          selected={attacking}
          onCard={bottom === acting ? onMine : onTheirs}
          onLeader={bottom === acting ? undefined : onTheirLeader}
          onEmptySlot={held && bottom === acting && yourTurn
            ? slot => {
                const card = hand.find(c => c.instanceId === held);
                if (card) play({ type: "PLAY_CARD", pid: acting, instanceId: card.instanceId, slot });
                setHeld(null);
              }
            : undefined}
        />

        <Hand
          cards={hand}
          energy={state.players[acting].energy}
          sizes={sizes}
          held={held}
          live={yourTurn}
          onHold={id => setHeld(held === id ? null : id)}
        />
      </div>

      {children}
    </div>
  );
}

export function seatName(pid: PlayerId): string {
  return pid === "P1" ? "Player one" : "Player two";
}

/** The sizes the window can hold, kept current as it is resized. */
function useBattleSizes(): BattleSizes {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return battleSizesFor(height);
}

// ── Frame ────────────────────────────────────────────────────────────────────

function Rail({ title, badge, turn, onLeave }: {
  title: string;
  badge: string;
  turn: number;
  onLeave: () => void;
}) {
  return (
    <div
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
      <Text as="h2" role="title">{title}</Text>
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
      <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>Turn {turn}</span>

      <div style={{ marginTop: "auto" }}>
        <Button size="sm" tone="ghost" full onClick={onLeave}>Leave</Button>
      </div>
    </div>
  );
}

function TurnBar({ state, sizes, yourTurn, local, note, onEndTurn, onCancel }: {
  state: BattleState;
  sizes: BattleSizes;
  yourTurn: boolean;
  local: boolean;
  note: string | null;
  onEndTurn: () => void;
  onCancel: () => void;
}) {
  const actor = state.activePlayer;
  const me = state.players[actor];
  const attacking = Boolean(state.pendingAttackerId);

  const message = note
    ? note
    : state.winner
      ? "The match is over."
      : !yourTurn
        ? "They are thinking."
        : attacking
          ? "Pick what it hits: a card, or the leader behind them."
          : "Play a card, or pick one up to attack with.";

  return (
    <Panel padding={0} style={{ width: battleRowWidth(sizes) }}>
      <div
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
          {state.winner ? "Finished" : local ? `${seatName(actor)} to play` : yourTurn ? "Your turn" : "Their turn"}
        </span>

        <Energy have={me.energy} of={me.maxEnergy} />

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

        <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom, flex: "none" }}>
          {me.deck.length} left
        </span>
        <span style={{ width: 104, flex: "none" }}>
          <Button
            size="sm"
            full
            tone={attacking ? "secondary" : "ghost"}
            onClick={attacking ? onCancel : onEndTurn}
            disabled={!yourTurn}
          >
            {attacking ? "Cancel" : "End turn"}
          </Button>
        </span>
      </div>
    </Panel>
  );
}

/** Energy, as pips. Ten is the cap, and ten pips still read at a glance. */
function Energy({ have, of }: { have: number; of: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
      <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>energy</span>
      {Array.from({ length: Math.max(of, 1) }, (_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: i < have ? COLOR.current : "transparent",
            border: `1px solid ${i < have ? COLOR.current : COLOR.rope}`,
          }}
        />
      ))}
    </span>
  );
}

// ── One side of the board ────────────────────────────────────────────────────

function Side({
  player, sizes, heading, active, facing, attackable, selected, onCard, onLeader, onEmptySlot,
}: {
  player: BattleState["players"][PlayerId];
  sizes: BattleSizes;
  heading: string;
  active: boolean;
  /** Which way this side faces, which decides where the leader sits. */
  facing: "up" | "down";
  attackable: boolean;
  selected?: string | null;
  onCard: (card: BattleCard) => void;
  onLeader?: () => void;
  onEmptySlot?: (slot: number) => void;
}) {
  const slotHeight = plainCardHeight(sizes.slot);

  return (
    <Panel
      padding={SPACE.md}
      style={{ width: battleRowWidth(sizes), borderColor: active ? COLOR.cable : COLOR.rope }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md, marginBottom: SPACE.sm }}>
        <span style={{ ...text("label"), fontSize: 9, color: active ? COLOR.current : COLOR.fathom }}>
          {heading}
        </span>
        <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom, marginLeft: "auto" }}>
          {player.hand.length} in hand
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: SEAT_GROUP_GAP,
          alignItems: facing === "down" ? "flex-start" : "flex-end",
        }}
      >
        <Leader
          card={player.leader}
          width={sizes.leader}
          attackable={attackable}
          onClick={onLeader}
        />

        <div style={{ display: "flex", gap: ARENA_GAP.card }}>
          {Array.from({ length: BATTLE_COLUMNS }, (_, slot) => {
            const card = player.board[slot];
            if (!card || card.currentHp <= 0) {
              return (
                <EmptySlot
                  key={slot}
                  width={sizes.slot}
                  height={slotHeight}
                  live={Boolean(onEmptySlot)}
                  onClick={onEmptySlot ? () => onEmptySlot(slot) : undefined}
                />
              );
            }
            return (
              <BoardCard
                key={card.instanceId}
                card={card}
                width={sizes.slot}
                height={slotHeight}
                selected={selected === card.instanceId}
                attackable={attackable}
                onClick={() => onCard(card)}
              />
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Leader({ card, width, attackable, onClick }: {
  card: BattleCard;
  width: number;
  attackable: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        cursor: attackable && onClick ? "crosshair" : "default",
      }}
    >
      <span style={{ ...text("label"), fontSize: 8, color: COLOR.doubloon }}>Leader</span>
      <div style={{ position: "relative" }}>
        <PrintCard card={cardFace(card.defId)} print="base" width={width} interactive={false} stats={false} />
        <Vitals card={card} />
        {attackable && onClick && <Target />}
      </div>
    </div>
  );
}

function BoardCard({ card, width, height, selected, attackable, onClick }: {
  card: BattleCard;
  width: number;
  height: number;
  selected: boolean;
  attackable: boolean;
  onClick: () => void;
}) {
  const spent = card.exhausted || card.stunTurns > 0;
  return (
    <div
      onClick={onClick}
      style={{
        height,
        display: "flex",
        alignItems: "flex-end",
        position: "relative",
        cursor: attackable ? "crosshair" : "pointer",
        transform: selected ? "translateY(-8px)" : "none",
        transition: "transform 150ms cubic-bezier(0.2,0,0.2,1)",
        opacity: spent ? 0.62 : 1,
      }}
    >
      <PrintCard card={cardFace(card.defId)} print="base" width={width} interactive={false} stats={false} />
      <Vitals card={card} />
      {selected && <Marker />}
      {attackable && <Target />}
    </div>
  );
}

/** What a card is worth right now, rather than what its print says. */
function Vitals({ card }: { card: BattleCard }) {
  return (
    <span
      style={{
        position: "absolute",
        left: 6,
        right: 6,
        bottom: 6,
        display: "flex",
        justifyContent: "space-between",
        ...text("data"),
        fontSize: 12,
      }}
    >
      <Pill value={card.atk} colour={COLOR.signal} />
      <Pill value={card.currentHp} colour={card.currentHp < card.maxHp ? COLOR.signal : COLOR.kelp} />
    </span>
  );
}

function Pill({ value, colour }: { value: number; colour: string }) {
  return (
    <span
      style={{
        minWidth: 20,
        padding: "1px 5px",
        borderRadius: 3,
        textAlign: "center",
        background: "rgba(5,9,15,0.86)",
        border: `1px solid ${colour}`,
        color: colour,
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  );
}

/** The rule beside a card you have picked up, the same one Score uses. */
function Marker() {
  return (
    <span
      style={{
        position: "absolute",
        left: -7,
        top: "18%",
        bottom: "18%",
        width: 2,
        borderRadius: 2,
        background: COLOR.current,
        pointerEvents: "none",
      }}
    />
  );
}

/** A card something is currently able to swing at. */
function Target() {
  return (
    <span
      style={{
        position: "absolute",
        inset: -3,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLOR.signal}`,
        pointerEvents: "none",
        opacity: 0.55,
      }}
    />
  );
}

function EmptySlot({ width, height, live, onClick }: {
  width: number;
  height: number;
  live: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width,
        height,
        borderRadius: RADIUS.lg,
        border: `1px dashed ${live ? COLOR.current : COLOR.rope}`,
        background: live ? "rgba(62,143,160,0.06)" : "transparent",
        cursor: live ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...text("label"),
        fontSize: 8,
        color: live ? COLOR.current : "transparent",
      }}
    >
      {live ? "Place" : ""}
    </div>
  );
}

// ── Your hand ────────────────────────────────────────────────────────────────

function Hand({ cards, energy, sizes, held, live, onHold }: {
  cards: BattleCard[];
  energy: number;
  sizes: BattleSizes;
  held: string | null;
  live: boolean;
  onHold: (id: string) => void;
}) {
  const height = plainCardHeight(sizes.hand);
  return (
    <Panel padding={SPACE.md} style={{ width: battleRowWidth(sizes) }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md, marginBottom: SPACE.sm }}>
        <span style={{ ...text("label"), fontSize: 9, color: COLOR.current }}>Your hand</span>
        <span style={{ ...text("small"), fontSize: 11, color: COLOR.fathom, marginLeft: "auto" }}>
          {held ? "Pick a slot to put it in" : "Click a card to pick it up"}
        </span>
      </div>

      <div style={{ display: "flex", gap: ARENA_GAP.card, minHeight: height, alignItems: "flex-end" }}>
        {cards.length === 0 ? (
          <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>Nothing in hand.</span>
        ) : (
          cards.map(card => {
            const affordable = card.cost <= energy;
            return (
              <div
                key={card.instanceId}
                onClick={live && affordable ? () => onHold(card.instanceId) : undefined}
                style={{
                  position: "relative",
                  cursor: live && affordable ? "pointer" : "default",
                  opacity: affordable ? 1 : 0.45,
                  transform: held === card.instanceId ? "translateY(-10px)" : "none",
                  transition: "transform 150ms cubic-bezier(0.2,0,0.2,1)",
                }}
              >
                <PrintCard
                  card={cardFace(card.defId)}
                  print="base"
                  width={sizes.hand}
                  interactive={live && affordable}
                  stats={false}
                />
                <Vitals card={card} />
                <Cost value={card.cost} affordable={affordable} />
                {held === card.instanceId && <Marker />}
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

function Cost({ value, affordable }: { value: number; affordable: boolean }) {
  return (
    <span
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        minWidth: 20,
        padding: "1px 5px",
        borderRadius: 3,
        textAlign: "center",
        ...text("data"),
        fontSize: 12,
        fontWeight: 600,
        background: "rgba(5,9,15,0.86)",
        border: `1px solid ${affordable ? COLOR.current : COLOR.rope}`,
        color: affordable ? COLOR.current : COLOR.fathom,
      }}
    >
      {value}
    </span>
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
