import {
  useEffect, useLayoutEffect, useRef, useState,
  type ReactNode, type RefObject,
} from "react";
import type { PlayerId } from "@cg/contracts";
import type { BattleCard, BattleIntent, BattlePlayer, BattleState } from "@cg/battle";
import {
  CAMERA, CENTRE, FAR_SCALE, HAND, HAZE, PERSPECTIVE, STAGE, TILT, WELL,
  cardBand, leaderSeat, leftFittings, slabEdges, station, useStageFit,
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

/**
 * The arena: the board Draft and Deck are both played on.
 *
 * The board is a physical object standing in a room. The room fills the window;
 * the object has fixed proportions and is scaled to fit inside it. Everything
 * drawn on the object is measured in the object's own units, so the two halves
 * are identical on every monitor and neither player is given the bigger end of
 * the table.
 *
 * It is built as a stack of layers rather than a pile of components. The stack
 * is declared once in arenaStage.ts — room, atmosphere, structure, surface,
 * props, play, highlights, particles, writing — and each layer stands at its
 * own height above the surface. That is what makes the board lean rather than
 * tip: the layers slide against each other, because they are genuinely at
 * different distances from the eye.
 *
 * This file holds no rules and paints nothing. It puts the layers in order,
 * hands each one what it needs, and turns clicks into intents, which is what
 * lets the same board draw a game running in this browser and a game the server
 * is running for two people.
 */

export function Arena({
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
  // The setter is not wired to anything on the board any more: the stones
  // that switched tables were the one control the housing did not keep.
  const [theme] = useArenaTheme();
  const { ref: fit, frame } = useStageFit();
  const { stage, room } = useTilt(frame.scale);
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

  const half = WELL.height / 2;
  const farRow = cardBand("far");

  const headingFor = (pid: PlayerId) =>
    local ? seatName(pid) : pid === you ? "Your hand" : opponentName ?? "Opponent";

  return (
    <div
      ref={fit}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflow: "hidden",
        // The eye is here, once, for the whole board. Every layer's depth is
        // measured against this, which is the only way the perspective can
        // agree with itself.
        perspective: PERSPECTIVE,
        // The eye looks at a point above the middle of the screen, which is
        // where the hall's own floor runs to. Everything that recedes on the
        // board recedes towards the same place.
        perspectiveOrigin: `50% ${CAMERA.horizon * 100}%`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Scene theme={theme} nodeRef={room} />

      <div
        ref={stage}
        style={{
          // As wide as the screen, never narrower than the composition. The
          // board fills the extra; the game inside it does not.
          width: frame.width,
          height: STAGE.height,
          // The stage is a fixed object that gets scaled, never squeezed: as a
          // flex child it would otherwise shrink to the window and every
          // measurement on the board would be off by whatever that took.
          flex: "none",
          position: "relative",
          // The layers inside keep their own distance from the eye. Nothing
          // here may crop or filter, because either one would flatten them all
          // back into a single sheet.
          transformStyle: "preserve-3d",
          transformOrigin: "center",
          // `transform` is deliberately absent. It carries both the lean and
          // the fit, it changes with the cursor, and it is written straight to
          // this node by useTilt's frame loop. Listing it here even once would
          // hand the property to React, which would then reset it on every
          // unrelated render — a card picked up, a turn ended — and the board
          // would snap flat mid-movement.
        }}
      >
        {/* Behind the board: the shadow it drops on the floor, the warmth it
            bounces onto the margin, and the floor going away under it. The only
            layer further off than the board, which is why it is the only one
            the board can stand in front of. */}
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

        {/* The two stations: the frame's stone, widened at each end and cut
            for the leader, the dial and the energy. Over the surface, because
            each stands a little out over the field. */}
        <Layer name="stations">
          <Stations theme={theme} spread={frame.spread} />
        </Layer>

        {/* Everything the rules know about. Cropped at the board's edge, which
            is what lets a hand hang off it the way it does on a table. */}
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

          {/* Not scaled with the far cards: the leader sits in a cavity the
              board cut full size, and has to fill it. */}
          <LeaderNiche
            theme={theme}
            side={top === you ? "you" : "them"}
            end="far"
            card={state.players[top].leader}
            attackable={Boolean(attacking) && top !== acting}
            active={!state.winner && actor === top}
            onClick={top === acting ? undefined : onTheirLeader}
          />

          <Far originX={CENTRE.x} originY={farRow.top + farRow.height / 2}>
          <BoardRow
            theme={theme}
            band={farRow}
            align="top"
            player={state.players[top]}
            attackable={Boolean(attacking) && top !== acting}
            selected={top === acting ? attacking ?? null : null}
            onCard={top === acting ? onMine : onTheirs}
            onSlot={held && top === acting && yourTurn ? onSlot : undefined}
          />
          </Far>

          <BoardRow
            theme={theme}
            band={cardBand("near")}
            align="bottom"
            player={state.players[bottom]}
            attackable={Boolean(attacking) && bottom !== acting}
            selected={bottom === acting ? attacking ?? null : null}
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
            onClick={bottom === acting ? undefined : onTheirLeader}
          />

          {/* The two dials, in the sockets the board is cut with. Outside the
              Far wrapper on purpose: a fitting in a hole has to be the size of
              the hole, whichever end of the board it is at. */}
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
              onHold={id => setHeld(held === id ? null : id)}
            />
          </div>
        </Layer>

        {/* The air between the two ends of the board. It goes over the far
            cards rather than under them, because that is where the air is. */}
        <Layer name="highlight" core spread={frame.spread}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: WELL.farY,
              width: STAGE.width,
              height: half,
              background: `linear-gradient(to bottom, ${theme.hazeTint}, transparent)`,
              opacity: HAZE,
            }}
          />
        </Layer>

        {/* The air in front of it all: the corners of the room going dark, and
            what little there is in the air catching the lamp. Over the cards
            and under the writing, which is the only place a vignette can be
            and still be a room rather than a filter. */}
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
 * A degree or so of lean towards the cursor.
 *
 * It is small enough that nobody should notice it happening, which is the
 * point: a board that answers the cursor reads as an object on a table rather
 * than a picture of one. Anything larger starts to make cards harder to click,
 * and the board is a control surface before it is a toy.
 *
 * None of it goes through React. The cursor rewrites this value as fast as the
 * screen refreshes, and a value that changes every frame is the one kind of
 * value that must not be state: it used to re-render the whole arena sixty
 * times a second, and worse, it restarted a two hundred millisecond transform
 * transition on the stage every time, so the entire three dimensional stack —
 * the board, its filtered surfaces, every card — was being recomposited
 * continuously and never actually arrived anywhere.
 *
 * So the mouse writes a target, one frame loop closes the gap towards it, and
 * the loop writes the two transforms itself. The easing that used to be the
 * CSS transition's job is the loop's: a fifth of the remaining distance each
 * frame, which arrives in a handful of frames and cannot be restarted because
 * there is nothing to restart. When the board has arrived the loop stops, so an
 * arena nobody is touching costs nothing at all.
 *
 * Both nodes are written on the same frame on purpose. The room drifts against
 * the board's lean, and if the two moved on different frames they would
 * disagree about where the viewer is standing, which is the one thing the
 * whole arrangement exists to say.
 *
 * Somebody who has asked their system not to animate things gets a board that
 * sits still — but still gets the fit applied, since that is not animation.
 */
function useTilt(scale: number): {
  /** Goes on the stage: the board, and everything standing on it. */
  stage: RefObject<HTMLDivElement>;
  /** Goes on the room the board is standing in. */
  room: RefObject<HTMLDivElement>;
} {
  const stage = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  /** Where the cursor has asked the board to be, and where it actually is. */
  const target = useRef({ x: 0, y: 0 });
  const shown = useRef({ x: 0, y: 0 });

  // The whole loop lives inside the effect: nothing about it is created during
  // a render, so there is nothing for React to memoise, invalidate or reset.
  // The two refs above are the only things that outlive it, and they are what
  // lets the board keep its lean when the window is resized under it.
  useLayoutEffect(() => {
    const drift = TILT.sceneDrift / TILT.degrees;
    let frame = 0;
    let running = false;

    const paint = () => {
      const { x, y } = shown.current;
      if (stage.current) {
        stage.current.style.transform =
          `rotateX(${CAMERA.pitch + x}deg) rotateY(${y}deg) scale(${scale})`;
      }
      if (room.current) {
        room.current.style.transform = `translate(${-y * drift}px, ${-x * drift}px)`;
      }
    };

    const step = () => {
      const to = target.current;
      const at = shown.current;
      const dx = to.x - at.x;
      const dy = to.y - at.y;
      const arrived = Math.abs(dx) < TILT.rest && Math.abs(dy) < TILT.rest;

      shown.current = arrived
        ? { x: to.x, y: to.y }
        : { x: at.x + dx * TILT.ease, y: at.y + dy * TILT.ease };
      paint();

      if (arrived) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(step);
    };

    // Before the browser's first paint rather than after it, so the board is
    // never shown for a frame at the wrong size.
    paint();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onMove = (event: MouseEvent) => {
      const fromCentreX = event.clientX / window.innerWidth - 0.5;
      const fromCentreY = event.clientY / window.innerHeight - 0.5;
      target.current = {
        x: -fromCentreY * TILT.degrees * 2,
        y: fromCentreX * TILT.degrees * 2,
      };
      if (running) return;
      running = true;
      frame = requestAnimationFrame(step);
    };

    // Passive: the board leans in response to the cursor and never asks the
    // cursor to do anything else, so the browser need not wait to find out.
    if (!still) window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      if (!still) window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [scale]);

  return { stage, room };
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

/**
 * Anything the far side of the board carries, drawn at its distance.
 *
 * It scales about a point on the board rather than about the middle of the
 * stage, so whatever is inside it shrinks towards where it stands instead of
 * sliding off towards the centre.
 */
function Far({ originX, originY, children }: {
  originX: number;
  originY: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${FAR_SCALE})`,
        transformOrigin: `${originX}px ${originY}px`,
      }}
    >
      {children}
    </div>
  );
}

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
 * each other, so each lands in the part of the hole the board cut for it. No
 * FAR_SCALE either — the channel at the far end is the same hole as the one at
 * the near end, so what sits in it is the same size.
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
function LeftRail({ theme, title, badge, turn, line, note, onLeave }: {
  theme: ArenaTheme;
  title: string;
  badge: string;
  turn: number;
  line: string;
  note: string | null;
  onLeave: () => void;
}) {
  const seat = leftFittings();

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
      <Plaque box={seat.status}>
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
          ...key(theme, false),
          ...text("label"),
          fontSize: 8,
        }}
      >
        Leave
      </button>
    </div>
  );
}

/** Paint in a hole: pale, with the wall's shadow falling across the top of it. */
const SUNK = "0 1px 0 rgba(0,0,0,0.55)";

/** The words that go in one of the housing's two plaques. */
function Plaque({ box, children }: {
  box: Box;
  children: ReactNode;
}) {
  return (
    <div
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
