import { useEffect, useState, type ReactNode } from "react";
import type { PlayerId } from "@cg/contracts";
import type { BattleCard, BattleIntent, BattleState } from "@cg/battle";
import {
  BAND, ENERGY, FELT, FIELD, HAND_RAIL, RAIL, STAGE, useStageFit,
} from "../../design/arenaStage";
import { ARENA_THEME_LIST, useArenaTheme, type ArenaTheme, type ArenaThemeId } from "../../design/arenaThemes";
import { text } from "../../design/tokens";
import Chrome from "./arena/Chrome";
import LeaderNiche from "./arena/LeaderNiche";
import EnergyRail from "./arena/EnergyRail";
import BoardRow from "./arena/BoardRow";
import RightRail from "./arena/RightRail";
import { EnemyHand, Hand } from "./arena/Hands";

/**
 * The arena: the board Draft and Deck are both played on.
 *
 * One painted object, drawn at a fixed size and scaled to the screen, so the
 * two halves are the same size as each other on every monitor and neither
 * player is given the bigger end of the table. Both sides carry the same
 * furniture in the same places — a hand along the outer edge, a leader standing
 * in a window in the middle of its banner, half the surface — and the only
 * thing that tells them apart is the colour behind the leader.
 *
 * This file holds no rules and paints nothing. It places the pieces on the
 * stage and turns clicks into intents, which is what lets the same board draw a
 * game running in this browser and a game the server is running for two people.
 *
 * Where each piece lives, and why:
 *
 *   Chrome        The board itself. Painted once, behind everything, and never
 *                 clicked, so nothing else has to think about how it looks.
 *   hands         Along the outer edges, nearest the player they belong to.
 *                 Yours is read; theirs is only counted, so it is face down.
 *   leader niche  In the middle of its banner, where both players look. The
 *                 leader's numbers are set into the board under it rather than
 *                 printed on the picture, because a leader is a thing being
 *                 worn down rather than a card you read.
 *   board rows    The contested middle, split by the seam.
 *   right rail    The two decks and the one button that ends a turn.
 *   left rail     Everything that is not the game.
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
  const { ref: fit, scale } = useStageFit();
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

  const half = FELT.height / 2;

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
        // The board is an object on a table, so there is a table under it:
        // boards lit from above, grain running across, and the light falling
        // off towards the corners.
        background: `
          radial-gradient(60% 45% at 50% 42%, rgba(255,255,255,0.05), transparent 70%),
          repeating-linear-gradient(92deg, rgba(255,255,255,0.014) 0 2px, transparent 2px 46px),
          radial-gradient(130% 100% at 50% 42%, ${theme.table} 0%, #05070A 82%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: STAGE.width,
          height: STAGE.height,
          // The stage is a fixed object that gets scaled, never squeezed: as a
          // flex child it would otherwise shrink to the window and every
          // measurement on the board would be off by whatever that took.
          flex: "none",
          transform: `perspective(2400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${scale})`,
          transformOrigin: "center",
          transition: "transform 220ms cubic-bezier(0.2,0,0.2,1)",
          position: "relative",
          // A hand hangs off the bottom edge of the board, the way it does on a
          // table. The stage crops it rather than letting it run off the screen.
          overflow: "hidden",
          borderRadius: 34,
          filter: `drop-shadow(0 30px 60px ${theme.shadow})`,
        }}
      >
        <Chrome theme={theme} />

        {/* Their hand, hanging from the top rail. Cropped, because a back has
            nothing on it worth the room a whole card would take. */}
        <div
          style={{
            position: "absolute",
            left: FIELD.left,
            top: BAND.enemyHand.top,
            width: FIELD.width,
            height: BAND.enemyHand.height,
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            zIndex: 6,
          }}
        >
          <EnemyHand count={state.players[top].hand.length} />
        </div>

        <LeaderNiche
          theme={theme}
          side={top === you ? "you" : "them"}
          facing="down"
          card={state.players[top].leader}
          attackable={Boolean(attacking) && top !== acting}
          active={!state.winner && actor === top}
          onClick={top === acting ? undefined : onTheirLeader}
        />

        <BoardRow
          theme={theme}
          band={{ top: FELT.top, height: half }}
          align="top"
          player={state.players[top]}
          attackable={Boolean(attacking) && top !== acting}
          selected={top === acting ? attacking ?? null : null}
          onCard={top === acting ? onMine : onTheirs}
          onSlot={held && top === acting && yourTurn ? onSlot : undefined}
        />

        <BoardRow
          theme={theme}
          band={{ top: FELT.top + half, height: half }}
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
          facing="up"
          card={state.players[bottom].leader}
          attackable={Boolean(attacking) && bottom !== acting}
          active={!state.winner && actor === bottom}
          onClick={bottom === acting ? undefined : onTheirLeader}
        />

        {/* Your hand, sitting over the bottom rail and cropped by the board's
            edge. Pointing at a card brings it up far enough to read. */}
        <div
          style={{
            position: "absolute",
            left: FIELD.left,
            top: BAND.yourHand.top,
            width: FIELD.width,
            display: "flex",
            justifyContent: "center",
            zIndex: 14,
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

        {/* Who is sitting at each end. The rail is the only place a name
            belongs: everywhere else on this board is the game itself. */}
        <RailName theme={theme} y={HAND_RAIL.topY} name={headingFor(top)} />
        <RailName theme={theme} y={HAND_RAIL.bottomY} name={headingFor(bottom)} />

        {/* Energy, on the rail each player's hand sits against */}
        <RailSlot theme={theme} y={HAND_RAIL.topY}>
          <EnergyRail
            theme={theme}
            have={state.players[top].energy}
            max={state.players[top].maxEnergy}
            label="Energy"
          />
        </RailSlot>

        <RailSlot theme={theme} y={HAND_RAIL.bottomY}>
          <EnergyRail
            theme={theme}
            have={state.players[bottom].energy}
            max={state.players[bottom].maxEnergy}
            label="Energy"
          />
        </RailSlot>

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
      </div>

      {children}
    </div>
  );
}

/**
 * A degree or so of tilt towards the cursor.
 *
 * It is small enough that nobody should notice it happening, which is the
 * point: a board that answers the cursor reads as an object on a table rather
 * than a picture of one. Anything larger than this starts to make cards harder
 * to click, and the board is not a toy.
 */
function useTilt(): { x: number; y: number } {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const fromCentreX = e.clientX / window.innerWidth - 0.5;
      const fromCentreY = e.clientY / window.innerHeight - 0.5;
      setTilt({ x: -fromCentreY * 2.2, y: fromCentreX * 2.2 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return tilt;
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

/** The left hand end of a hand rail, which is where the name goes. */
function RailName({ theme, y, name }: { theme: ArenaTheme; y: number; name: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: FIELD.left - HAND_RAIL.bleed + ENERGY.gap * 3,
        top: y,
        height: HAND_RAIL.height,
        display: "flex",
        alignItems: "center",
        ...text("label"),
        fontSize: 9,
        color: theme.ink,
        zIndex: 16,
        pointerEvents: "none",
      }}
    >
      {name}
    </div>
  );
}

/** The right hand end of a hand rail, which is where energy is kept. */
function RailSlot({ theme, y, children }: { theme: ArenaTheme; y: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        right: STAGE.width - FIELD.right + HAND_RAIL.bleed - ENERGY.gap * 2,
        top: y,
        height: HAND_RAIL.height,
        display: "flex",
        alignItems: "center",
        color: theme.ink,
        zIndex: 16,
      }}
    >
      {children}
    </div>
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
        left: 8,
        top: 300,
        width: RAIL.left - 16,
        height: 520,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "20px 0",
        zIndex: 16,
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
          maxWidth: RAIL.left - 26,
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
            width: RAIL.left - 34,
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
