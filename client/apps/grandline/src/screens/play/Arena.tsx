import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { PlayerId } from "@cg/contracts";
import type { BattleCard, BattleIntent, BattleState } from "@cg/battle";
import {
  ARENA_CARDS, ARENA_GAPS, BAND, BANNER, ENERGY_PIPS, FELT, LEADER, RIGHT, STAGE,
  cardHeight, useStageScale,
} from "../../design/arenaStage";
import { ARENA_THEME_LIST, useArenaTheme, type ArenaTheme } from "../../design/arenaThemes";
import { RADIUS, text } from "../../design/tokens";
import PrintCard from "../../components/PrintCard";
import CardBack from "../../components/CardBack";
import { cardFace } from "../../data/pool";

/**
 * The arena: the board Draft and Deck are both played on.
 *
 * One painted object, drawn at a fixed size and scaled to the screen, so the
 * two halves are the same size as each other on every monitor and neither
 * player is given the bigger end of the table. Both sides carry the same
 * furniture in the same places — a hand along the outer edge, a wing band with
 * the leader standing in the middle of it, and half the surface — and the only
 * thing that tells them apart is the colour behind the leader.
 *
 * It holds no rules. Whatever is driving the match hands it a state and takes
 * back intents, which is what lets the same board draw a game running in this
 * browser and a game the server is running for two people.
 *
 * The furniture, and why each piece is where it is:
 *
 *   hand rail      Along the outer edge, closest to the player it belongs to.
 *                  Theirs is face down: it only has to be countable.
 *   wing band      The leader in the middle where both players look, the dial
 *                  beside it, and the energy on the outside corner.
 *   surface        The contested middle, split by a seam. Cards are laid from
 *                  the centre outwards so a board with two on it still reads as
 *                  a pair rather than as two cards stranded at one end.
 *   right rail     The decks, and the one button that ends a turn.
 *   left rail      Everything that is not the game.
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
  const scale = useStageScale();
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

  const headingFor = (pid: PlayerId) =>
    local ? seatName(pid) : pid === you ? "You" : opponentName ?? "Opponent";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflow: "hidden",
        background: `radial-gradient(120% 90% at 50% 40%, #14161B 0%, #08090C 70%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: STAGE.width,
          height: STAGE.height,
          transform: `scale(${scale})`,
          transformOrigin: "center",
          position: "relative",
          borderRadius: 34,
          background: theme.frame.face,
          boxShadow: `
            0 40px 90px ${theme.frame.shadow},
            inset 0 2px 0 ${theme.frame.inlay},
            inset 0 -3px 0 rgba(0,0,0,0.28)`,
          border: `2px solid ${theme.frame.edge}`,
        }}
      >
        {/* The dark bezel the panels are set into */}
        <div
          style={{
            position: "absolute",
            inset: STAGE.frame - 4,
            borderRadius: 26,
            background: "transparent",
            border: "3px solid rgba(10,12,16,0.82)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        />

        {/* Their hand, face down along the top edge */}
        <HandRail
          theme={theme}
          band={BAND.enemyHand}
          facing="down"
          label={headingFor(top)}
          count={state.players[top].hand.length}
        >
          <EnemyHand count={state.players[top].hand.length} />
        </HandRail>

        <WingBand
          theme={theme}
          band={BAND.enemyWing}
          side={top === you ? "you" : "them"}
          facing="down"
          heading={headingFor(top)}
          player={state.players[top]}
          active={!state.winner && actor === top}
          attackable={Boolean(attacking) && top !== acting}
          onLeader={top === acting ? undefined : onTheirLeader}
        />

        {/* The surface, one piece with a seam across the middle */}
        <Felt theme={theme} />

        <BoardRow
          theme={theme}
          band={BAND.enemyFelt}
          align="top"
          player={state.players[top]}
          attackable={Boolean(attacking) && top !== acting}
          selected={top === acting ? attacking : null}
          onCard={top === acting ? onMine : onTheirs}
          onSlot={held && top === acting && yourTurn ? onSlot : undefined}
        />

        <BoardRow
          theme={theme}
          band={BAND.yourFelt}
          align="bottom"
          player={state.players[bottom]}
          attackable={Boolean(attacking) && bottom !== acting}
          selected={bottom === acting ? attacking : null}
          onCard={bottom === acting ? onMine : onTheirs}
          onSlot={held && bottom === acting && yourTurn ? onSlot : undefined}
        />

        <WingBand
          theme={theme}
          band={BAND.yourWing}
          side={bottom === you ? "you" : "them"}
          facing="up"
          heading={headingFor(bottom)}
          player={state.players[bottom]}
          active={!state.winner && actor === bottom}
          attackable={Boolean(attacking) && bottom !== acting}
          onLeader={bottom === acting ? undefined : onTheirLeader}
        />

        <HandRail
          theme={theme}
          band={BAND.yourHand}
          facing="up"
          label={local ? `${seatName(acting)} · hand` : "Your hand"}
          count={mine.hand.length}
          note={held ? "Pick a slot to put it in" : note ?? "Click a card to pick it up"}
        >
          <Hand
            theme={theme}
            cards={mine.hand}
            energy={mine.energy}
            held={held}
            live={yourTurn}
            onHold={id => setHeld(held === id ? null : id)}
          />
        </HandRail>

        {/* Everything that is not the game, down the left */}
        <LeftRail
          theme={theme}
          title={title}
          badge={badge}
          turn={state.turn}
          onTheme={setTheme}
          onLeave={onLeave}
        />

        {/* The decks and the button, down the right */}
        <RightRail
          theme={theme}
          topDeck={state.players[top].deck.length}
          bottomDeck={state.players[bottom].deck.length}
          yourTurn={yourTurn}
          attacking={Boolean(attacking)}
          onEndTurn={() => play({ type: "END_TURN", pid: acting })}
          onCancel={() => play({ type: "CANCEL_ATTACK", pid: acting })}
        />

        {/* The turn, said once, across the seam where both players look */}
        <TurnFlag theme={theme} state={state} yourTurn={yourTurn} local={local} note={note} />
      </div>

      {children}
    </div>
  );
}

export function seatName(pid: PlayerId): string {
  return pid === "P1" ? "Player one" : "Player two";
}

// ── The furniture ────────────────────────────────────────────────────────────

/** Where the playing area starts and stops, between the two rails. */
const FIELD_LEFT = STAGE.frame + STAGE.leftRail;
const FIELD_RIGHT = STAGE.width - STAGE.frame - STAGE.rightRail;
const FIELD_WIDTH = FIELD_RIGHT - FIELD_LEFT;

type Band = { top: number; height: number };

function bandStyle(band: Band): CSSProperties {
  return {
    position: "absolute",
    left: FIELD_LEFT,
    top: band.top,
    width: FIELD_WIDTH,
    height: band.height,
  };
}

/**
 * A hand, along the outer edge. Yours reads; theirs only counts, so it is face
 * down and smaller — the space is better spent on the cards you can play.
 */
function HandRail({ theme, band, facing, label, count, note, children }: {
  theme: ArenaTheme;
  band: Band;
  facing: "up" | "down";
  label: string;
  count: number;
  note?: string;
  children: ReactNode;
}) {
  const outer = facing === "down" ? "top" : "bottom";
  return (
    <div style={{ ...bandStyle(band) }}>
      {/* The rail the cards sit against, running the width of the frame */}
      <div
        style={{
          position: "absolute",
          left: -STAGE.leftRail + 22,
          right: -STAGE.rightRail + 22,
          [outer]: STAGE.frame + 4,
          height: 22,
          borderRadius: 12,
          background: theme.wing,
          border: `1px solid ${theme.wingEdge}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
        } as CSSProperties}
      >
        <span style={{ ...text("label"), fontSize: 8, color: theme.ink }}>{label}</span>
        <span style={{ ...text("label"), fontSize: 8, color: theme.inkSoft }}>
          {note ?? `${count} in hand`}
        </span>
      </div>

      {/* The cards themselves, sitting on the rail */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          [facing === "down" ? "top" : "bottom"]: facing === "down" ? STAGE.frame + 2 : 20,
          display: "flex",
          justifyContent: "center",
          alignItems: facing === "down" ? "flex-start" : "flex-end",
          zIndex: 12,
        } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

/** Their hand: backs only, laid so the count is obvious at a glance. */
function EnemyHand({ count }: { count: number }) {
  const width = ARENA_CARDS.enemyHand;
  const height = cardHeight(width);
  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: Math.min(count, 10) }, (_, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : ARENA_GAPS.enemyHand }}>
          <CardBack width={width} height={height} />
        </div>
      ))}
    </div>
  );
}

/** Your hand: the cards you read, lifted clear of the rail when picked up. */
function Hand({ theme, cards, energy, held, live, onHold }: {
  theme: ArenaTheme;
  cards: BattleCard[];
  energy: number;
  held: string | null;
  live: boolean;
  onHold: (id: string) => void;
}) {
  const width = ARENA_CARDS.hand;

  if (cards.length === 0) {
    return (
      <span style={{ ...text("small"), fontSize: 12, color: theme.inkSoft, marginTop: 30 }}>
        Nothing in hand.
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end" }}>
      {cards.map((card, i) => {
        const affordable = card.cost <= energy;
        const playable = live && affordable;
        const up = held === card.instanceId;
        return (
          <div
            key={card.instanceId}
            onClick={playable ? () => onHold(card.instanceId) : undefined}
            style={{
              position: "relative",
              marginLeft: i === 0 ? 0 : ARENA_GAPS.hand,
              zIndex: up ? 30 : 10 + i,
              cursor: playable ? "pointer" : "default",
              opacity: affordable ? 1 : 0.5,
              transform: up ? "translateY(-26px)" : "none",
              transition: "transform 160ms cubic-bezier(0.2,0,0.2,1)",
              filter: up ? `drop-shadow(0 10px 18px rgba(0,0,0,0.5))` : "none",
            }}
            onMouseEnter={e => {
              if (!up) e.currentTarget.style.transform = "translateY(-14px)";
            }}
            onMouseLeave={e => {
              if (!up) e.currentTarget.style.transform = "none";
            }}
          >
            <PrintCard
              card={cardFace(card.defId)}
              print="base"
              width={width}
              interactive={false}
              stats={false}
            />
            <Vitals card={card} />
            <Cost theme={theme} value={card.cost} affordable={affordable} />
            {up && <Held theme={theme} />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A wing band: two panels, a leader standing between them on its banner, the
 * ability dial beside it and the energy out on the corner.
 */
function WingBand({ theme, band, side, facing, heading, player, active, attackable, onLeader }: {
  theme: ArenaTheme;
  band: Band;
  /** Which banner this side flies. */
  side: "you" | "them";
  facing: "up" | "down";
  heading: string;
  player: BattleState["players"][PlayerId];
  active: boolean;
  attackable: boolean;
  onLeader?: () => void;
}) {
  const wingWidth = (FIELD_WIDTH - BANNER.width) / 2 - 8;

  return (
    <div style={{ ...bandStyle(band) }}>
      {/* The two panels */}
      <Wing theme={theme} width={wingWidth} facing={facing} side="left" active={active}>
        <span style={{ ...text("label"), fontSize: 9, color: active ? theme.ink : theme.inkSoft }}>
          {heading}
        </span>
        <span style={{ ...text("data"), fontSize: 11, color: theme.inkSoft }}>
          {player.hand.length} in hand · {player.deck.length} in deck
        </span>
      </Wing>

      <Wing theme={theme} width={wingWidth} facing={facing} side="right" active={active}>
        <span style={{ ...text("label"), fontSize: 8, color: theme.inkSoft }}>Energy points</span>
        <EnergyRail theme={theme} have={player.energy} of={player.maxEnergy} />
      </Wing>

      {/* The banner, and the leader standing on it */}
      <div
        style={{
          position: "absolute",
          left: (FIELD_WIDTH - BANNER.width) / 2,
          [facing === "down" ? "top" : "bottom"]: 0,
          width: BANNER.width,
          height: BANNER.height,
          background: theme.banner[side],
          borderRadius: facing === "down" ? "0 0 26px 26px" : "26px 26px 0 0",
          borderTop: facing === "up" ? `2px solid ${theme.bannerEdge[side]}` : "none",
          borderBottom: facing === "down" ? `2px solid ${theme.bannerEdge[side]}` : "none",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)",
        } as CSSProperties}
      />

      <LeaderArch
        theme={theme}
        side={side}
        facing={facing}
        card={player.leader}
        attackable={attackable}
        onClick={onLeader}
      />

      <AbilityDial theme={theme} facing={facing} player={player} />
    </div>
  );
}

function Wing({ theme, width, facing, side, active, children }: {
  theme: ArenaTheme;
  width: number;
  facing: "up" | "down";
  side: "left" | "right";
  active: boolean;
  children: ReactNode;
}) {
  const outer = facing === "down" ? "top" : "bottom";
  return (
    <div
      style={{
        position: "absolute",
        [side]: 0,
        [outer]: 6,
        width,
        height: BAND.enemyWing.height - 52,
        background: theme.wing,
        border: `1px solid ${active ? theme.accent : theme.wingEdge}`,
        borderRadius: side === "left"
          ? (facing === "down" ? "18px 46px 46px 18px" : "18px 46px 46px 18px")
          : (facing === "down" ? "46px 18px 18px 46px" : "46px 18px 18px 46px"),
        display: "flex",
        flexDirection: "column",
        alignItems: side === "left" ? "flex-start" : "flex-end",
        justifyContent: "center",
        gap: 8,
        padding: `0 ${side === "left" ? 28 : 22}px`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 6px rgba(0,0,0,0.16)",
      } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** The leader, standing in an arch that hangs over the surface. */
function LeaderArch({ theme, side, facing, card, attackable, onClick }: {
  theme: ArenaTheme;
  side: "you" | "them";
  facing: "up" | "down";
  card: BattleCard;
  attackable: boolean;
  onClick?: () => void;
}) {
  const arch = facing === "down"
    ? { borderRadius: "0 0 60px 60px" }
    : { borderRadius: "60px 60px 0 0" };

  const band = BAND.enemyWing.height;
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: FIELD_WIDTH / 2 - LEADER.archWidth / 2 - 40,
        [facing === "down" ? "top" : "bottom"]: LEADER.inset,
        width: LEADER.archWidth,
        height: band - LEADER.inset + LEADER.overlap,
        ...arch,
        background: theme.frame.face,
        border: `2px solid ${theme.frame.edge}`,
        boxShadow: `0 6px 18px rgba(0,0,0,0.34), inset 0 0 0 3px ${theme.bannerEdge[side]}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: attackable && onClick ? "crosshair" : "default",
        zIndex: 6,
      } as CSSProperties}
    >
      <div style={{ position: "relative", marginTop: facing === "down" ? -LEADER.overlap : 0, marginBottom: facing === "up" ? -LEADER.overlap : 0 }}>
        <PrintCard
          card={cardFace(card.defId)}
          print="base"
          width={ARENA_CARDS.leader}
          interactive={false}
          stats={false}
        />
        <Vitals card={card} />
        {attackable && onClick && <Target />}
      </div>
    </div>
  );
}

/**
 * The dial beside a leader. It shows how close that leader is to being able to
 * do something, which on this ruleset is nothing yet — so it reads as a dial
 * with nothing in it rather than as a button that does not work.
 */
function AbilityDial({ theme, facing, player }: {
  theme: ArenaTheme;
  facing: "up" | "down";
  player: BattleState["players"][PlayerId];
}) {
  const filled = Math.max(0, Math.min(1, player.domainMeter / 100));
  return (
    <div
      style={{
        position: "absolute",
        left: FIELD_WIDTH / 2 + LEADER.archWidth / 2 - 26,
        [facing === "down" ? "top" : "bottom"]: 18,
        width: LEADER.dial,
        height: LEADER.dial,
        borderRadius: "50%",
        background: `conic-gradient(${theme.gem} ${filled * 360}deg, ${theme.gemDim} 0deg)`,
        border: `3px solid ${theme.frame.edge}`,
        boxShadow: `0 6px 16px rgba(0,0,0,0.34), inset 0 0 0 6px ${theme.frame.face}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5,
      } as CSSProperties}
    >
      <span
        style={{
          width: LEADER.dial - 34,
          height: LEADER.dial - 34,
          borderRadius: "50%",
          background: theme.wing,
          border: `1px solid ${theme.wingEdge}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...text("label"),
          fontSize: 8,
          color: theme.inkSoft,
        }}
      >
        {filled > 0 ? `${Math.round(filled * 100)}%` : "Ability"}
      </span>
    </div>
  );
}

/** Energy, as gems in a rail. Ten is the cap and ten still reads at a glance. */
function EnergyRail({ theme, have, of }: { theme: ArenaTheme; have: number; of: number }) {
  const shown = Math.max(Math.min(of, ENERGY_PIPS), 1);
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.16)",
        border: `1px solid ${theme.wingEdge}`,
      }}
    >
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          style={{
            width: 11,
            height: 11,
            transform: "rotate(45deg)",
            borderRadius: 2,
            background: i < have ? theme.gem : theme.gemDim,
            boxShadow: i < have ? `0 0 6px ${theme.gem}` : "none",
          }}
        />
      ))}
      <span style={{ ...text("data"), fontSize: 11, color: theme.ink, marginLeft: 4 }}>
        {have}/{of}
      </span>
    </span>
  );
}

/** The playing surface: one piece of parchment with a seam across the middle. */
function Felt({ theme }: { theme: ArenaTheme }) {
  return (
    <div
      style={{
        position: "absolute",
        left: FIELD_LEFT - FELT.inset,
        right: STAGE.width - FIELD_RIGHT - FELT.inset,
        top: FELT.top,
        height: FELT.height,
        background: theme.felt,
        border: `2px solid ${theme.feltEdge}`,
        borderRadius: 30,
        boxShadow: "inset 0 0 60px rgba(0,0,0,0.22)",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: "50%",
          height: 1,
          background: theme.seam,
        }}
      />
    </div>
  );
}

/**
 * One side's cards in play. They are laid from the middle outwards, so a board
 * with two cards on it reads as a pair in front of the leader rather than as
 * two cards pushed against one end of the table.
 */
function BoardRow({ theme, band, align, player, attackable, selected, onCard, onSlot }: {
  theme: ArenaTheme;
  band: Band;
  align: "top" | "bottom";
  player: BattleState["players"][PlayerId];
  attackable: boolean;
  selected: string | null;
  onCard: (card: BattleCard) => void;
  onSlot?: (slot: number) => void;
}) {
  const width = ARENA_CARDS.slot;
  const height = cardHeight(width);
  const slots = player.board.length;

  return (
    <div
      style={{
        ...bandStyle(band),
        display: "flex",
        alignItems: align === "top" ? "flex-start" : "flex-end",
        justifyContent: "center",
        gap: ARENA_GAPS.slot,
        padding: `${(band.height - height) / 2}px 0`,
        minHeight: height,
        zIndex: 3,
      }}
    >
      {Array.from({ length: slots }, (_, slot) => {
        const card = player.board[slot];
        if (!card || card.currentHp <= 0) {
          // An empty slot is only drawn while something is looking for one.
          // The rest of the time the cards close up and sit in the middle,
          // which is how a board with two things on it should read.
          if (!onSlot) return null;
          return (
            <EmptySlot
              key={slot}
              theme={theme}
              width={width}
              height={height}
              live
              onClick={() => onSlot(slot)}
            />
          );
        }
        return (
          <BoardCard
            key={card.instanceId}
            theme={theme}
            card={card}
            width={width}
            height={height}
            align={align}
            selected={selected === card.instanceId}
            attackable={attackable}
            onClick={() => onCard(card)}
          />
        );
      })}
    </div>
  );
}

function BoardCard({ theme, card, width, height, align, selected, attackable, onClick }: {
  theme: ArenaTheme;
  card: BattleCard;
  width: number;
  height: number;
  align: "top" | "bottom";
  selected: boolean;
  attackable: boolean;
  onClick: () => void;
}) {
  const spent = card.exhausted || card.stunTurns > 0;
  const lift = align === "top" ? 8 : -8;
  return (
    <div
      onClick={onClick}
      style={{
        width,
        height,
        position: "relative",
        cursor: attackable ? "crosshair" : "pointer",
        transform: selected ? `translateY(${lift}px)` : "none",
        transition: "transform 150ms cubic-bezier(0.2,0,0.2,1)",
        opacity: spent ? 0.62 : 1,
        filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.34))",
      }}
    >
      <PrintCard
        card={cardFace(card.defId)}
        print="base"
        width={width}
        interactive={false}
        stats={false}
      />
      <Vitals card={card} />
      {selected && <Held theme={theme} />}
      {attackable && <Target />}
    </div>
  );
}

function EmptySlot({ theme, width, height, live, onClick }: {
  theme: ArenaTheme;
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
        border: `2px ${live ? "solid" : "dashed"} ${live ? theme.accent : theme.feltEdge}`,
        background: live ? theme.slotLive : theme.slot,
        cursor: live ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...text("label"),
        fontSize: 8,
        color: live ? theme.accentInk : "transparent",
        transition: "background 140ms ease",
      }}
    >
      {live ? "Place" : ""}
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
      <Pill value={card.atk} colour="#E2544A" />
      <Pill value={card.currentHp} colour={card.currentHp < card.maxHp ? "#E2544A" : "#4FBF7B"} />
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

function Cost({ theme, value, affordable }: {
  theme: ArenaTheme;
  value: number;
  affordable: boolean;
}) {
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
        border: `1px solid ${affordable ? theme.gem : "rgba(255,255,255,0.2)"}`,
        color: affordable ? theme.gem : "rgba(255,255,255,0.45)",
      }}
    >
      {value}
    </span>
  );
}

/** The rule beside a card you have picked up. */
function Held({ theme }: { theme: ArenaTheme }) {
  return (
    <span
      style={{
        position: "absolute",
        left: -7,
        top: "16%",
        bottom: "16%",
        width: 3,
        borderRadius: 2,
        background: theme.accent,
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
        border: "2px solid #E2544A",
        pointerEvents: "none",
        opacity: 0.7,
      }}
    />
  );
}

// ── The rails ────────────────────────────────────────────────────────────────

function LeftRail({ theme, title, badge, turn, onTheme, onLeave }: {
  theme: ArenaTheme;
  title: string;
  badge: string;
  turn: number;
  onTheme: (id: ArenaTheme["id"]) => void;
  onLeave: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: STAGE.frame,
        top: STAGE.frame,
        bottom: STAGE.frame,
        width: STAGE.leftRail,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "18px 0",
      }}
    >
      <span
        style={{
          ...text("title"),
          fontSize: 20,
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
          fontSize: 8,
          color: theme.ink,
          border: `1px solid ${theme.wingEdge}`,
          borderRadius: 999,
          padding: "3px 8px",
          textAlign: "center",
          maxWidth: STAGE.leftRail - 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {badge}
      </span>
      <span style={{ ...text("data"), fontSize: 11, color: theme.inkSoft }}>Turn {turn}</span>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <span style={{ ...text("label"), fontSize: 7, color: theme.inkSoft }}>Table</span>
        <div style={{ display: "flex", gap: 6 }}>
          {ARENA_THEME_LIST.map(option => (
            <button
              key={option.id}
              title={`${option.name} — ${option.blurb}`}
              onClick={() => onTheme(option.id)}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                cursor: "pointer",
                background: option.felt,
                border: option.id === theme.id
                  ? `2px solid ${theme.ink}`
                  : `1px solid ${theme.wingEdge}`,
                padding: 0,
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
            background: theme.wing,
            border: `1px solid ${theme.wingEdge}`,
            borderRadius: 8,
            padding: "7px 10px",
            cursor: "pointer",
            width: STAGE.leftRail - 26,
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function RightRail({ theme, topDeck, bottomDeck, yourTurn, attacking, onEndTurn, onCancel }: {
  theme: ArenaTheme;
  topDeck: number;
  bottomDeck: number;
  yourTurn: boolean;
  attacking: boolean;
  onEndTurn: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: STAGE.frame,
        top: STAGE.frame,
        bottom: STAGE.frame,
        width: STAGE.rightRail,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
      }}
    >
      <DeckStack theme={theme} count={topDeck} colour={theme.banner.them} />

      <button
        onClick={attacking ? onCancel : onEndTurn}
        disabled={!yourTurn}
        style={{
          width: RIGHT.buttonWidth,
          height: RIGHT.buttonHeight,
          borderRadius: 14,
          border: `2px solid ${theme.frame.edge}`,
          background: yourTurn ? theme.accent : theme.wing,
          color: yourTurn ? theme.accentInk : theme.inkSoft,
          ...text("label"),
          fontSize: 11,
          cursor: yourTurn ? "pointer" : "default",
          boxShadow: yourTurn ? "0 6px 16px rgba(0,0,0,0.34)" : "none",
          // It leans in over the surface, which is where the eye already is
          marginRight: 42,
        }}
      >
        {attacking ? "Cancel" : "End turn"}
      </button>

      <DeckStack theme={theme} count={bottomDeck} colour={theme.banner.you} />
    </div>
  );
}

/** A deck, leaning out of the right rail with what is left in it. */
function DeckStack({ theme, count, colour }: {
  theme: ArenaTheme;
  count: number;
  colour: string;
}) {
  return (
    <div style={{ position: "relative", width: RIGHT.deckWidth, height: RIGHT.deckHeight, marginRight: 16 }}>
      {[6, 3, 0].map(offset => (
        <span
          key={offset}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${offset}px, ${-offset}px)`,
            borderRadius: 8,
            background: colour,
            border: `1px solid ${theme.frame.edge}`,
            boxShadow: "inset 0 0 12px rgba(0,0,0,0.4)",
          }}
        />
      ))}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...text("data"),
          fontSize: 15,
          color: "#F4EEE4",
          textShadow: "0 1px 3px rgba(0,0,0,0.7)",
          zIndex: 2,
        }}
      >
        {count}
      </span>
    </div>
  );
}

/** Whose turn it is, said once, on the seam where both players are looking. */
function TurnFlag({ theme, state, yourTurn, local, note }: {
  theme: ArenaTheme;
  state: BattleState;
  yourTurn: boolean;
  local: boolean;
  note: string | null;
}) {
  const line = state.winner
    ? "Finished"
    : local
      ? `${seatName(state.activePlayer)} to play`
      : yourTurn
        ? "Your turn"
        : "They are thinking";

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: FELT.top + FELT.height / 2,
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 18px",
        borderRadius: 999,
        background: theme.frame.face,
        border: `2px solid ${theme.frame.edge}`,
        boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
        zIndex: 8,
        maxWidth: FIELD_WIDTH - 200,
      }}
    >
      <span style={{ ...text("label"), fontSize: 9, color: theme.ink }}>{line}</span>
      {note && (
        <span
          style={{
            ...text("small"),
            fontSize: 11,
            color: theme.inkSoft,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {note}
        </span>
      )}
    </div>
  );
}
