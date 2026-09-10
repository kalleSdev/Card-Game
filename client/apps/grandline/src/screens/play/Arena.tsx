import { useEffect, useState, type ReactNode } from "react";
import type { PlayerId } from "@cg/contracts";
import type { BattleCard, BattleIntent, BattlePlayer, BattleState } from "@cg/battle";
import {
  BOARD, CENTRE, FAR_SCALE, HAND, HAZE, PERSPECTIVE, STAGE, TILT, WELL,
  cardBand, leaderSeat, slabEdges, station, useStageFit, wellEdges, type Side,
} from "../../design/arenaStage";
import { ARENA_THEME_LIST, useArenaTheme, type ArenaTheme, type ArenaThemeId } from "../../design/arenaThemes";
import { text } from "../../design/tokens";
import Layer from "./arena/Layer";
import Scene from "./arena/Scene";
import Structure from "./arena/Structure";
import Surface from "./arena/Surface";
import LeaderNiche, { AbilityDial } from "./arena/LeaderNiche";
import EnergyRail, { EnergyReadout } from "./arena/EnergyRail";
import BoardRow from "./arena/BoardRow";
import RightRail from "./arena/RightRail";
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
  const [theme, setTheme] = useArenaTheme();
  const { ref: fit, frame } = useStageFit();
  const tilt = useTilt();
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
        perspectiveOrigin: "50% 50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Scene theme={theme} tilt={tilt} />

      <div
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
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${frame.scale})`,
          transformOrigin: "center",
          transition: `transform ${TILT.settle}ms cubic-bezier(0.2,0,0.2,1)`,
        }}
      >
        {/* The board as an object: slab, rim, plinths, sockets */}
        <Layer name="structure">
          <Structure theme={theme} spread={frame.spread} />
        </Layer>

        {/* The surface, set down inside the well */}
        <Layer name="surface">
          <Surface theme={theme} spread={frame.spread} />
        </Layer>

        {/* Everything the rules know about. Cropped at the board's edge, which
            is what lets a hand hang off it the way it does on a table. */}
        <Layer name="play" core spread={frame.spread} crop>
          {/* Their hand, hanging from the top rail. Cropped again, because a
              back has nothing on it worth the room a whole card would take. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: HAND.farTop,
              width: STAGE.width,
              height: HAND.farHeight,
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <EnemyHand count={state.players[top].hand.length} />
          </div>

          {/* Scaled about the board's far edge rather than about the plinth's
              inner face, so the far leader stays seated the same distance inside
              the frame as the near one and shrinks inwards from there. */}
          <Far originX={CENTRE.x} originY={BOARD.farY}>
            <LeaderNiche
              theme={theme}
              side={top === you ? "you" : "them"}
              end="far"
              card={state.players[top].leader}
              attackable={Boolean(attacking) && top !== acting}
              active={!state.winner && actor === top}
              onClick={top === acting ? undefined : onTheirLeader}
            />
          </Far>

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

          {/* Your hand, sitting over the bottom rail. Pointing at a card brings
              it up far enough to read. */}
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
            onTheme={setTheme}
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
 * Somebody who has asked their system not to animate things gets a board that
 * sits still.
 */
function useTilt(): { x: number; y: number } {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      const fromCentreX = e.clientX / window.innerWidth - 0.5;
      const fromCentreY = e.clientY / window.innerHeight - 0.5;
      setTilt({ x: -fromCentreY * TILT.degrees * 2, y: fromCentreX * TILT.degrees * 2 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return tilt;
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
        color: theme.ink,
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
 * The strip down the left: which game this is, whose turn it is, which table
 * you are playing on, and the way out. None of it is the game, which is why it
 * is all in one place away from the middle.
 */
function LeftRail({ theme, title, badge, turn, line, note, onTheme, onLeave }: {
  theme: ArenaTheme;
  title: string;
  badge: string;
  turn: number;
  line: string;
  note: string | null;
  onTheme: (id: ArenaThemeId) => void;
  onLeave: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        // On the left rim, between the board's edge and the well. The rim
        // tapers, so both numbers are asked for at the seam where it is
        // narrowest and the rail therefore fits at every depth.
        left: slabEdges(WELL.seamY).x0 + 10,
        top: WELL.farY + 10,
        width: wellEdges(WELL.seamY).x0 - slabEdges(WELL.seamY).x0 - 30,
        height: WELL.height - 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "20px 0",
        // The rail's own buttons are the only things on it worth pressing, and
        // its layer refuses the cursor, so the rail asks for it back.
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          ...text("title"),
          fontSize: 19,
          lineHeight: 1.05,
          color: theme.ink,
          textAlign: "center",
        }}
      >
        {title}
      </span>

      <span
        style={{
          ...text("label"),
          fontSize: 7,
          color: theme.ink,
          border: `1px solid ${theme.wingEdge}`,
          borderRadius: 999,
          padding: "4px 8px",
          maxWidth: 78,
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        {badge}
      </span>

      <span style={{ ...text("label"), fontSize: 8, color: theme.ink, textAlign: "center", lineHeight: 1.4 }}>
        {line}
      </span>
      <span style={{ ...text("data"), fontSize: 11, color: theme.inkSoft }}>Turn {turn}</span>

      {note && (
        <span
          style={{
            ...text("small"),
            fontSize: 10,
            color: theme.inkSoft,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {note}
        </span>
      )}

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <span style={{ ...text("label"), fontSize: 7, color: theme.inkSoft }}>Table</span>
        <div style={{ display: "flex", gap: 6 }}>
          {ARENA_THEME_LIST.map(option => (
            <button
              key={option.id}
              title={`${option.name} — ${option.blurb}`}
              onClick={() => onTheme(option.id)}
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                cursor: "pointer",
                padding: 0,
                background: `linear-gradient(150deg, ${option.felt.light}, ${option.felt.dark})`,
                border: option.id === theme.id
                  ? `2px solid ${theme.ink}`
                  : `1px solid ${theme.wingEdge}`,
              }}
            />
          ))}
        </div>

        <button
          onClick={onLeave}
          style={{
            ...text("label"),
            fontSize: 8,
            color: theme.ink,
            background: `linear-gradient(180deg, ${theme.wing.light}, ${theme.wing.mid})`,
            border: `1px solid ${theme.wingEdge}`,
            borderRadius: 8,
            padding: "7px 10px",
            cursor: "pointer",
            width: 70,
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
