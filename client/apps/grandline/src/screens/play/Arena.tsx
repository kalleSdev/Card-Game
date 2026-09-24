import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { PlayerId } from "@cg/contracts";
import type { BattleCard, BattleIntent, BattlePlayer, BattleState } from "@cg/battle";
import {
  HAND, STAGE, cardBand, leaderSeat, leftFittings, slabEdges, station, useStageFit,
  type Box, type Side,
} from "../../design/arenaStage";
import { useArenaTheme, type ArenaTheme } from "../../design/arenaThemes";
import { text } from "../../design/tokens";
import Layer from "./arena/Layer";
import Scene from "./arena/Scene";
import Stations from "./arena/Stations";
import Structure from "./arena/Structure";
import Surround from "./arena/Surround";
import Atmosphere from "./arena/Atmosphere";
import Surface from "./arena/Surface";
import LeaderNiche, { AbilityDial } from "./arena/LeaderNiche";
import EnergyRail, { EnergyReadout } from "./arena/EnergyRail";
import BoardRow from "./arena/BoardRow";
import RightRail, { key } from "./arena/RightRail";
import { EnemyHand, Hand } from "./arena/Hands";
import { CUE_CSS, NO_CUES, buildCues, type CueSet, type EventFeed } from "./arena/cues";
import { INTERACTION_CSS } from "./arena/interaction";

/**
 * The arena: the board Draft and Deck are both played on.
 *
 * Seen from straight above and never moves. The layers are stacked flat in
 * the order LAYER gives. This file holds no rules, it lays the board out and
 * turns clicks into intents. Engine events come in as `events` and play as
 * short local animations on the cards they touch.
 */

export function Arena({
  state, you, local, yourTurn, note, title, badge, opponentName, history = [], events, onIntent, onLeave, children,
}: {
  state: BattleState;
  /** The latest batch of engine events, for the animations. */
  events?: EventFeed | null;
  /** What has happened so far, most recent last, as lines a player can read. */
  history?: string[];
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
  const [theme] = useArenaTheme();
  const { ref: fit, frame } = useStageFit();
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
  const mine = state.players[acting];

  const play = (intent: BattleIntent) => { if (yourTurn) onIntent(intent); };

  // A click on nothing puts a held card back and drops a picked attacker
  const onBackground = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(".ar-hand-slot, .ar-field, .ar-leader-hit, button, [data-slot]")) return;
    if (held) setHeld(null);
    else if (attacking) play({ type: "CANCEL_ATTACK", pid: acting });
  };

  const onMine = (card: BattleCard) => {
    if (attacking === card.instanceId) return play({ type: "CANCEL_ATTACK", pid: acting });
    play({ type: "SELECT_ATTACKER", pid: acting, instanceId: card.instanceId });
  };

  const onTheirs = (card: BattleCard) => {
    if (!attacking) return;
    play({ type: "ATTACK_CARD", pid: acting, targetInstanceId: card.instanceId });
  };

  const onTheirLeader = () => {
    if (!attacking) return;
    play({ type: "ATTACK_LEADER", pid: acting });
  };

  // Your own leader can be picked up to attack, the engine decides if it may
  const leaderReady = yourTurn && !state.winner && mine.leader.canAttack && !mine.leader.exhausted;
  const leaderClick = (pid: PlayerId) => {
    if (pid === acting) return leaderReady ? () => onMine(mine.leader) : undefined;
    return attacking ? onTheirLeader : undefined;
  };

  const cues = useCues(state, events ?? null, bottom);

  const onSlot = (slot: number) => {
    const card = mine.hand.find(c => c.instanceId === held);
    if (card) play({ type: "PLAY_CARD", pid: acting, instanceId: card.instanceId, slot });
    setHeld(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (held) setHeld(null);
      else if (state.pendingAttackerId) onIntent({ type: "CANCEL_ATTACK", pid: state.activePlayer });
      else onLeave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave, onIntent, held, state.pendingAttackerId, state.activePlayer]);

  const farRow = cardBand("far");

  const headingFor = (pid: PlayerId) =>
    local ? seatName(pid) : pid === you ? "Your hand" : opponentName ?? "Opponent";

  return (
    <div
      ref={fit}
      onClick={onBackground}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflow: "hidden",
        display: "flex",
        // The stage is placed from the top by the frame, not centred by flex
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <style>{CUE_CSS + INTERACTION_CSS + TURN_CSS}</style>
      <Scene theme={theme} />

      <div
        style={{
          // As wide as the screen, never narrower than the composition
          width: frame.width,
          height: STAGE.height,
          // A zoom rather than a scale transform, so text is laid out sharp
          zoom: frame.scale,
          marginTop: frame.top,
          flex: "none",
          position: "relative",
          // Keeps the layer z-indexes inside the board, under any overlay
          isolation: "isolate",
        }}
      >
        {/* The board's shadow on the table */}
        <Layer name="atmosphere">
          <Surround theme={theme} spread={frame.spread} />
        </Layer>

        {/* The board as an object: slab, rim, plinths, sockets */}
        <Layer name="structure">
          <Structure theme={theme} spread={frame.spread} />
        </Layer>

        {/* The surface, set down inside the well */}
        <Layer name="surface">
          <Surface theme={theme} spread={frame.spread} />
        </Layer>

        {/* The two stations, a little out over the field */}
        <Layer name="stations">
          <Stations theme={theme} spread={frame.spread} />
        </Layer>

        {/* Everything the rules know about. Cropped so the hands run off the edge. */}
        <Layer name="play" core spread={frame.spread} crop>
          {/* Their hand, held above the far edge, whole. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: HAND.far.top,
              width: STAGE.width,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <EnemyHand theme={theme} count={state.players[top].hand.length} />
          </div>

          <LeaderNiche
            theme={theme}
            side={top === you ? "you" : "them"}
            end="far"
            card={state.players[top].leader}
            attackable={Boolean(attacking) && top !== acting}
            active={!state.winner && actor === top}
            selected={top === acting && attacking === state.players[top].leader.instanceId}
            cues={cues}
            onClick={leaderClick(top)}
          />

          <BoardRow
            theme={theme}
            band={farRow}
            align="top"
            player={state.players[top]}
            attackable={Boolean(attacking) && top !== acting}
            selected={top === acting ? attacking ?? null : null}
            cues={cues}
            ghosts={cues.ghosts.filter(g => g.pid === top)}
            onCard={top === acting ? onMine : onTheirs}
            onSlot={held && top === acting && yourTurn ? onSlot : undefined}
          />

          <BoardRow
            theme={theme}
            band={cardBand("near")}
            align="bottom"
            player={state.players[bottom]}
            attackable={Boolean(attacking) && bottom !== acting}
            selected={bottom === acting ? attacking ?? null : null}
            cues={cues}
            ghosts={cues.ghosts.filter(g => g.pid === bottom)}
            onCard={bottom === acting ? onMine : onTheirs}
            onSlot={held && bottom === acting && yourTurn ? onSlot : undefined}
          />

          <LeaderNiche
            theme={theme}
            side={bottom === you ? "you" : "them"}
            end="near"
            card={state.players[bottom].leader}
            attackable={Boolean(attacking) && bottom !== acting}
            active={!state.winner && actor === bottom}
            selected={bottom === acting && attacking === state.players[bottom].leader.instanceId}
            cues={cues}
            onClick={leaderClick(bottom)}
          />

          {/* The two dials, in their sockets */}
          <AbilityDial theme={theme} end="far" />
          <AbilityDial theme={theme} end="near" />

          {/* Your hand, held below the near edge, whole. Pointing at a card
              brings it up out of the fan. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: HAND.nearTop,
              width: STAGE.width,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Hand
              theme={theme}
              cards={mine.hand}
              energy={mine.energy}
              held={held}
              live={yourTurn}
              cues={cues}
              onHold={id => setHeld(held === id ? null : id)}
            />
          </div>
        </Layer>

        {/* Dust in the lamp light */}
        <Layer name="particles">
          <Atmosphere theme={theme} spread={frame.spread} />
        </Layer>

        {/* Writing, the decks, and the one button */}
        <Layer name="hud" core spread={frame.spread}>
          <RimName theme={theme} y={FAR_RIM_Y} name={headingFor(top)} far />
          <RimName theme={theme} y={NEAR_RIM_Y} name={headingFor(bottom)} />

          <Channel end="far" player={state.players[top]} theme={theme} />
          <Channel end="near" player={state.players[bottom]} theme={theme} />

          <RightRail
            theme={theme}
            topDeck={state.players[top].deck.length}
            bottomDeck={state.players[bottom].deck.length}
            yourTurn={yourTurn}
            attacking={Boolean(attacking)}
            onEndTurn={() => play({ type: "END_TURN", pid: acting })}
            onCancel={() => play({ type: "CANCEL_ATTACK", pid: acting })}
          />

          <LeftRail
            theme={theme}
            title={title}
            badge={badge}
            turn={state.turn}
            line={turnLine(state, yourTurn, local)}
            note={note}
            history={history}
            onLeave={onLeave}
          />
        </Layer>
      </div>

      {children}
    </div>
  );
}

export function seatName(pid: PlayerId): string {
  return pid === "P1" ? "Player one" : "Player two";
}

/** What the board says about whose turn it is, in as few words as possible. */
function turnLine(state: BattleState, yourTurn: boolean, local: boolean): string {
  if (state.winner) return "Finished";
  if (local) return `${seatName(state.activePlayer)} to play`;
  return yourTurn ? "Your turn" : "They are thinking";
}

/**
 * Plays each new batch of events once. The cues clear with one timeout after
 * the last animation ends, so nothing runs while the board is idle.
 */
function useCues(state: BattleState, events: EventFeed | null, bottom: PlayerId): CueSet {
  const [cues, setCues] = useState<CueSet>(NO_CUES);
  const before = useRef(state);
  const seen = useRef(events?.id ?? 0);

  useEffect(() => {
    const prev = before.current;
    before.current = state;
    if (!events || events.id === seen.current) return;
    seen.current = events.id;
    const next = buildCues(events, prev, state, bottom);
    if (next.end > 0) setCues(next);
  }, [state, events, bottom]);

  useEffect(() => {
    if (cues.end === 0) return;
    const timer = setTimeout(() => setCues(NO_CUES), cues.end + 60);
    return () => clearTimeout(timer);
  }, [cues]);

  return cues;
}

/**
 * The line each rim lines up on.
 *
 * The leader's own middle, taken from the seat rather than guessed at, so the
 * name, the energy row and the leader itself sit on one line at each end and the
 * two lines are exact mirrors of each other about the seam.
 */
const FAR_RIM_Y = leaderSeat("far").line;
const NEAR_RIM_Y = leaderSeat("near").line;

/** A player's name, cut into the rim on the left of their own plinth. */
function RimName({ theme, y, name, far = false }: {
  theme: ArenaTheme;
  y: number;
  name: string;
  far?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: slabEdges(y).x0 + 56,
        top: y - 10,
        height: 20,
        display: "flex",
        alignItems: "center",
        ...text("label"),
        fontSize: far ? 8 : 9,
        color: theme.frameInlay,
        opacity: far ? 0.85 : 1,
        pointerEvents: "none",
      }}
    >
      {name}
    </div>
  );
}

/**
 * What goes in one station's energy channel: the number, then the stones.
 *
 * Both are placed by the station's own geometry rather than laid out against
 * each other, so each lands in the part of the hole the board cut for it.
 */
function Channel({ theme, end, player }: {
  theme: ArenaTheme;
  end: Side;
  player: BattlePlayer;
}) {
  const seat = station(end);

  return (
    <>
      <div style={{ position: "absolute", left: seat.readout.x, top: seat.readout.y }}>
        <EnergyReadout theme={theme} have={player.energy} />
      </div>
      <div style={{ position: "absolute", left: seat.gems.x, top: seat.gems.y }}>
        <EnergyRail theme={theme} have={player.energy} max={player.maxEnergy} />
      </div>
    </>
  );
}

/**
 * What sits in the left hand fittings: the board's information, and the way
 * out.
 *
 * Which game this is, whose turn it is, and the way out. The two plates,
 * the stones and the frame for the key are the board's, drawn with the
 * structure; this puts the words and the key into them. Nothing here draws a
 * box: every edge you can see belongs to the board.
 *
 * Type goes one of two ways depending on what it is sitting on. Inside a recess
 * it is pale with a dark line above it, because that is what paint in a hole
 * looks like. On bare stone it is the wood's own lit edge colour, dimmer than
 * paint, which is what a letter cut into the board looks like under a lamp.
 */
function LeftRail({ theme, title, badge, turn, line, note, history, onLeave }: {
  theme: ArenaTheme;
  title: string;
  badge: string;
  turn: number;
  line: string;
  note: string | null;
  history: string[];
  onLeave: () => void;
}) {
  const seat = leftFittings();
  const [showing, setShowing] = useState(false);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* What has happened so far. A plate at the top of the column; point at
          it and the history unrolls beside it, over the board, and rolls up
          again when you look away. */}
      <div
        onMouseEnter={() => setShowing(true)}
        onMouseLeave={() => setShowing(false)}
        style={{
          position: "absolute",
          left: seat.actions.x,
          top: seat.actions.y,
          width: seat.actions.width,
          height: seat.actions.height,
          pointerEvents: "auto",
          cursor: "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...text("label"),
          fontSize: 8.5,
          color: theme.gold.light,
          textShadow: SUNK,
        }}
      >
        Actions
        {showing && (
          <div
            style={{
              position: "absolute",
              left: seat.actions.width + 12,
              top: 0,
              width: 240,
              maxHeight: 320,
              overflow: "hidden",
              padding: "8px 10px",
              boxSizing: "border-box",
              borderRadius: 6,
              background: theme.bezel,
              border: `1px solid ${theme.gold.dark}`,
              boxShadow: `2px 3px 6px rgba(0,0,0,0.6)`,
              ...text("small"),
              fontSize: 9.5,
              lineHeight: 1.45,
              textAlign: "left",
              color: theme.paint,
              zIndex: 1,
            }}
          >
            {history.length === 0 && <div style={{ opacity: 0.6 }}>Nothing yet.</div>}
            {history.slice(-14).map((entry, i) => (
              <div key={i}>{entry}</div>
            ))}
          </div>
        )}
      </div>

      {/* The match, on the upper plaque. */}
      <Plaque box={seat.plaque}>
        <span
          style={{
            ...text("title"),
            fontSize: 17,
            lineHeight: 1.05,
            letterSpacing: "0.04em",
            color: theme.paint,
            textShadow: SUNK,
          }}
        >
          {title}
        </span>
        <span
          style={{
            ...text("label"),
            fontSize: 7.5,
            lineHeight: 1.5,
            color: theme.gold.light,
            opacity: 0.9,
            textShadow: SUNK,
          }}
        >
          {badge}
        </span>
      </Plaque>

      {/* The turn, on the lower one. */}
      <Plaque box={seat.status} key={`${turn}-${line}`} className="ar-turn">
        <span
          style={{
            ...text("label"),
            fontSize: 8.5,
            lineHeight: 1.3,
            color: theme.gold.light,
            textShadow: SUNK,
          }}
        >
          {line}
        </span>
        <span
          style={{
            ...text("data"),
            fontSize: 14,
            lineHeight: 1,
            color: theme.paint,
            textShadow: SUNK,
          }}
        >
          Turn {turn}
        </span>
      </Plaque>

      {/* Anything the board has to say, cut into the wood below the column
          rather than given a plate of its own. */}
      {note && (
        <div
          style={{
            position: "absolute",
            left: seat.note.x,
            top: seat.note.y,
            width: seat.note.width,
            display: "flex",
            justifyContent: "center",
            ...text("small"),
            fontSize: 9.5,
            lineHeight: 1.35,
            textAlign: "center",
            color: theme.frameInlay,
            textShadow: SUNK,
          }}
        >
          {note}
        </div>
      )}

      {/* The way out: the same key as the one that ends a turn, in its own
          frame at the foot of the column. */}
      <button
        onClick={onLeave}
        style={{
          position: "absolute",
          left: seat.leave.x,
          top: seat.leave.y,
          width: seat.leave.width,
          height: seat.leave.height,
          pointerEvents: "auto",
          cursor: "pointer",
          ...key(theme, "ivory"),
          ...text("label"),
          fontSize: 8,
        }}
      >
        Leave
      </button>
    </div>
  );
}

/** The turn plaque settles in when the turn changes. */
const TURN_CSS = `
@keyframes ar-turn {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: none; }
}
.ar-turn { animation: ar-turn 260ms ease-out both; }
`;

/** Paint in a hole: pale, with the wall's shadow falling across the top of it. */
const SUNK = "0 1px 0 rgba(0,0,0,0.55)";

/** The words that go in one of the housing's two plaques. */
function Plaque({ box, className, children }: {
  box: Box;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0 8px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}
