import { useMemo, useState } from "react";
import type { PlayerDraftResult } from "@cg/contracts";
import { createBattleState, type BattleState } from "@cg/battle";
import { DECK_RULES } from "@cg/meta";
import { COLOR, RADIUS, SPACE, CARD_SIZE, cardSlotHeight, text } from "../../design/tokens";
import PrintCard from "../../components/PrintCard";
import { Button, Panel, SectionHead, Text } from "../../components/primitives";
import { cardDb, cardFace, cardName } from "../../data/pool";
import { draftFromDeck, randomDraft } from "../../data/draft";
import DraftPicks from "./DraftPicks";
import HandOver from "./HandOver";
import BattleBoard from "./BattleBoard";
import OnlineBattle from "./OnlineBattle";
import type { Store } from "../../data/store";

/**
 * Draft and Deck, which are the same match with a different source of cards.
 *
 * Draft deals you a leader and twelve picks; Deck loads one you built. From the
 * moment both sides have a deck the two are identical, which is why they share
 * a board and only differ in how they get here.
 *
 * Against the computer there is one deck to build, yours. Locally there are
 * two, and neither person may watch the other build theirs, so each is taken
 * behind a hand-over screen: player one drafts, the keyboard changes hands,
 * player two drafts, and it changes hands once more before the first turn.
 */

export type CardMode = "draft" | "deck";

/** Who is on the other side: the computer, the next chair, or the server. */
export type CardOpponent = "ai" | "local" | "online";

/** How the two seats are named to two people sharing a screen. */
const SEAT_NAME = { P1: "Player one", P2: "Player two" } as const;

export default function CardBattle({ mode, opponent, store, onLeave }: {
  mode: CardMode;
  opponent: CardOpponent;
  store: Store;
  onLeave: () => void;
}) {
  const local = opponent === "local";
  const online = opponent === "online";
  const title = mode === "draft" ? "Draft" : "Deck";

  const [p1, setP1] = useState<PlayerDraftResult | null>(null);
  const [p2, setP2] = useState<PlayerDraftResult | null>(null);

  /** Whether whoever the screen belongs to next has said they are looking. */
  const [ready, setReady] = useState(false);

  // The computer's deck is drafted at random, once.
  const bot = useMemo(() => randomDraft(), []);
  const theirs = local ? p2 : bot;

  // The seed is drawn once and kept, because the server replays the match from
  // it and a match that cannot be replayed cannot be paid for.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  const battle: BattleState | null = useMemo(() => {
    if (online || !p1 || !theirs) return null;
    return createBattleState(p1, theirs, cardDb, undefined, seed);
  }, [online, p1, theirs, seed]);

  // Online, the deck is all this screen is for: the match itself belongs to the
  // server, and the board there is drawn from what it sends back.
  if (online && p1) {
    return <OnlineBattle draft={p1} title={title} store={store} onLeave={onLeave} />;
  }

  // Both decks are in. One last hand-over, so the board opens in front of the
  // person whose turn it actually is.
  if (battle && p1 && theirs) {
    if (local && !ready) {
      return (
        <HandOver
          seat={SEAT_NAME.P1}
          note="Both decks are in. You have the first turn."
          onReady={() => setReady(true)}
          onLeave={onLeave}
        />
      );
    }
    return (
      <BattleBoard
        initial={battle}
        seed={seed}
        drafts={{ p1, p2: theirs }}
        opponent={local ? "local" : "ai"}
        title={title}
        store={store}
        onLeave={onLeave}
      />
    );
  }

  // Player two builds theirs once the keyboard has changed hands.
  if (p1 && local) {
    if (!ready) {
      return (
        <HandOver
          seat={SEAT_NAME.P2}
          note={mode === "draft"
            ? "Player one is done drafting. Yours is next."
            : "Player one has chosen. Bring a deck of your own."}
          onReady={() => setReady(true)}
          onLeave={onLeave}
        />
      );
    }
    const done = (draft: PlayerDraftResult) => { setP2(draft); setReady(false); };
    return mode === "draft"
      ? <DraftPicks key="p2" title={title} seat={SEAT_NAME.P2} onDone={done} onLeave={onLeave} />
      : <PickDeck store={store} seat={SEAT_NAME.P2} onPlay={done} onLeave={onLeave} />;
  }

  if (mode === "draft") {
    return (
      <DraftPicks
        key="p1"
        title={title}
        seat={local ? SEAT_NAME.P1 : undefined}
        onDone={setP1}
        onLeave={onLeave}
      />
    );
  }

  return (
    <PickDeck store={store} seat={local ? SEAT_NAME.P1 : undefined} onPlay={setP1} onLeave={onLeave} />
  );
}

/** Deck mode: choose one you built, or go back and build one. */
function PickDeck({ store, seat, onPlay, onLeave }: {
  store: Store;
  /** Whose choice this is, when two people are sharing the screen. */
  seat?: string;
  onPlay: (draft: PlayerDraftResult) => void;
  onLeave: () => void;
}) {
  const ready = store.decks.filter(deck => deck.leaderId && deck.cardIds.length === DECK_RULES.cards);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflowY: "auto",
        background: COLOR.abyss,
        padding: SPACE.xxl,
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: SPACE.xl }}>
        <SectionHead
          eyebrow={seat ?? "Deck"}
          title="Bring a deck"
          right={<Button size="sm" tone="ghost" onClick={onLeave}>Leave</Button>}
        />

        {ready.length === 0 ? (
          <Panel padding={SPACE.xxl}>
            <Text role="heading">No deck is ready</Text>
            <p style={{ ...text("body"), color: COLOR.mist, marginTop: SPACE.sm, maxWidth: 520 }}>
              A deck needs a leader and {DECK_RULES.cards} cards before it can be played. Build one
              on the Decks page, or play Draft instead and be dealt one.
            </p>
          </Panel>
        ) : (
          ready.map(deck => (
            <Panel key={deck.id} padding={SPACE.lg}>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.md }}>
                <Text role="heading">{deck.name}</Text>
                <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
                  {deck.leaderId ? cardName(deck.leaderId) : "No leader"} · {deck.cardIds.length} cards
                </span>
                <div style={{ marginLeft: "auto" }}>
                  <Button
                    tone="primary"
                    size="sm"
                    onClick={() => onPlay(draftFromDeck(deck.leaderId, deck.cardIds))}
                  >
                    Play this
                  </Button>
                </div>
              </div>

              <div style={{ display: "flex", gap: SPACE.sm, alignItems: "flex-end", flexWrap: "wrap" }}>
                {deck.leaderId && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <span style={{ ...text("label"), fontSize: 8, color: COLOR.doubloon }}>Leader</span>
                    <PrintCard
                      card={cardFace(deck.leaderId)}
                      print={deck.prints[deck.leaderId] ?? "base"}
                      width={CARD_SIZE.xs}
                      interactive={false}
                    />
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: SPACE.sm,
                    flexWrap: "wrap",
                    minHeight: cardSlotHeight(CARD_SIZE.xs),
                    alignItems: "flex-end",
                    borderLeft: `1px solid ${COLOR.rope}`,
                    paddingLeft: SPACE.md,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  {deck.cardIds.map(id => (
                    <PrintCard
                      key={id}
                      card={cardFace(id)}
                      print={deck.prints[id] ?? "base"}
                      width={CARD_SIZE.xs}
                      interactive={false}
                    />
                  ))}
                </div>
              </div>
            </Panel>
          ))
        )}
      </div>
    </div>
  );
}
