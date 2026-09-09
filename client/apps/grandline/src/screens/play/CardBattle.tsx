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
import BattleBoard, { type BattleOpponent } from "./BattleBoard";
import type { Store } from "../../data/store";

/**
 * Draft and Deck, which are the same match with a different source of cards.
 *
 * Draft deals you a leader and twelve picks; Deck loads one you built. From the
 * moment both sides have a deck the two are identical, which is why they share
 * a board and only differ in how they get here.
 *
 * A local game drafts once and plays both seats from that, which is enough to
 * sit two people at one screen. Drafting separately behind a hand-over screen
 * is the next thing this wants, and needs the hand-over to exist first.
 */

export type CardMode = "draft" | "deck";

export default function CardBattle({ mode, opponent, store, onLeave }: {
  mode: CardMode;
  opponent: BattleOpponent;
  store: Store;
  onLeave: () => void;
}) {
  const [yourDraft, setYourDraft] = useState<PlayerDraftResult | null>(null);
  const title = mode === "draft" ? "Draft" : "Deck";

  // The opponent's deck is drafted at random. A person sitting locally plays
  // the same one, because both seats share a screen and neither can hide a
  // draft from the other yet.
  const theirDraft = useMemo(() => randomDraft(), []);

  // The seed is drawn once and kept, because the server replays the match from
  // it and a match that cannot be replayed cannot be paid for.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  const battle: BattleState | null = useMemo(() => {
    if (!yourDraft) return null;
    return createBattleState(yourDraft, theirDraft, cardDb, undefined, seed);
  }, [yourDraft, theirDraft, seed]);

  if (battle && yourDraft) {
    return (
      <BattleBoard
        initial={battle}
        seed={seed}
        drafts={{ p1: yourDraft, p2: theirDraft }}
        opponent={opponent}
        title={title}
        store={store}
        onLeave={onLeave}
      />
    );
  }

  if (mode === "draft") {
    return <DraftPicks title={title} onDone={setYourDraft} onLeave={onLeave} />;
  }

  return <PickDeck store={store} onPlay={setYourDraft} onLeave={onLeave} />;
}

/** Deck mode: choose one you built, or go back and build one. */
function PickDeck({ store, onPlay, onLeave }: {
  store: Store;
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
          eyebrow="Deck"
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
