import { useMemo, useState } from "react";
import {
  DECK_RULES, PRINT_INFO, bestPrintOf, deckIsComplete, deckProblems, describeProblem,
  printForDeck, printsOwnedOf,
  type Deck, type PrintId,
} from "@cg/meta";
import { CARD_SIZE, COLOR, PRINT_COLOR, RADIUS, SPACE, text } from "../design/tokens";
import PrintCard from "../components/PrintCard";
import { Button, Panel, SectionHead, Text, TierPip } from "../components/primitives";
import { LEADER_POOL, POOL, cardFace, cardName } from "../data/pool";
import type { Store } from "../data/store";

export default function DecksScreen({ store, onSignIn }: { store: Store; onSignIn: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const deck = store.decks.find(d => d.id === editing) ?? null;

  if (deck) {
    return <DeckBuilder deck={deck} store={store} onBack={() => setEditing(null)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Collection"
        title="Decks"
        right={
          <Button
            tone="primary"
            disabled={!store.signedIn}
            onClick={() => setEditing(store.newDeck(`Deck ${store.decks.length + 1}`).id)}
          >
            {store.signedIn ? "New deck" : "Log in to build"}
          </Button>
        }
      />

      <p style={{ ...text("body"), color: COLOR.mist, maxWidth: 600 }}>
        A deck is one leader and {DECK_RULES.cards} cards, drawn from what you own. Where you hold a
        card in more than one print you pick which one takes the board.
      </p>

      {!store.signedIn ? (
        <Panel padding={SPACE.lg} style={{ borderColor: "rgba(62,143,160,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexWrap: "wrap" }}>
            <span style={{ ...text("body"), color: COLOR.mist }}>
              You are looking around without an account. Log in to build decks.
            </span>
            <div style={{ marginLeft: "auto" }}>
              <Button size="sm" tone="primary" onClick={onSignIn}>Log in</Button>
            </div>
          </div>
        </Panel>
      ) : store.decks.length === 0 ? (
        <Panel padding={SPACE.xxxl}>
          <Text role="heading">No decks yet</Text>
          <p style={{ ...text("body"), color: COLOR.mist, marginTop: SPACE.sm, maxWidth: 460 }}>
            Build one from your binder. Nothing is locked behind a rarity: every print of a card
            plays exactly the same, so a Base deck is as strong as a Secret one.
          </p>
        </Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: SPACE.lg }}>
          {store.decks.map(d => (
            <DeckTile key={d.id} deck={d} store={store} onEdit={() => setEditing(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeckTile({ deck, store, onEdit }: { deck: Deck; store: Store; onEdit: () => void }) {
  const complete = deckIsComplete(deck);
  const leaderPrint = deck.leaderId ? printForDeck(deck, store.collection, deck.leaderId) : null;

  return (
    <Panel padding={SPACE.lg}>
      <div style={{ display: "flex", gap: SPACE.lg }}>
        <div style={{ width: CARD_SIZE.xs, flex: "none" }}>
          {deck.leaderId && leaderPrint ? (
            <PrintCard card={cardFace(deck.leaderId)} print={leaderPrint} width={CARD_SIZE.xs} interactive={false} />
          ) : (
            <div style={{
              width: CARD_SIZE.xs, aspectRatio: "5 / 7", borderRadius: 8,
              border: `1px dashed ${COLOR.rope}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              ...text("label"), fontSize: 9, color: COLOR.fathom, textAlign: "center",
            }}>
              No leader
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          <Text role="heading" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {deck.name}
          </Text>
          <span style={{ ...text("data"), fontSize: 12, color: complete ? COLOR.kelp : COLOR.fathom }}>
            {deck.cardIds.length} / {DECK_RULES.cards} cards{complete ? " · ready" : ""}
          </span>
          <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
            <Button size="sm" onClick={onEdit}>Edit</Button>
            <Button size="sm" tone="ghost" onClick={() => store.deleteDeck(deck.id)}>Delete</Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DeckBuilder({ deck, store, onBack }: { deck: Deck; store: Store; onBack: () => void }) {
  const { collection } = store;
  const [pickingPrintFor, setPickingPrintFor] = useState<string | null>(null);

  const ownedCards = useMemo(
    () => POOL.filter(id => bestPrintOf(collection, id) !== null),
    [collection],
  );
  const ownedLeaders = useMemo(
    () => LEADER_POOL.filter(id => bestPrintOf(collection, id) !== null),
    [collection],
  );

  const problems = deckProblems(deck, collection);
  const complete = problems.length === 0;
  const full = deck.cardIds.length >= DECK_RULES.cards;

  const update = (patch: Partial<Deck>) => store.saveDeck({ ...deck, ...patch });

  const addCard = (id: string) => {
    if (full || deck.cardIds.includes(id)) return;
    update({ cardIds: [...deck.cardIds, id] });
  };
  const removeCard = (id: string) => update({ cardIds: deck.cardIds.filter(c => c !== id) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Deck builder"
        title={deck.name}
        right={<Button tone="ghost" onClick={onBack}>Done</Button>}
      />

      <Panel padding={SPACE.lg}>
        <div style={{ display: "flex", gap: SPACE.lg, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={deck.name}
            onChange={e => update({ name: e.target.value })}
            style={{
              ...text("body"),
              padding: "8px 12px", minWidth: 220,
              background: COLOR.deck, border: `1px solid ${COLOR.rope}`,
              borderRadius: RADIUS.md, color: COLOR.foam, outline: "none",
            }}
          />
          <span style={{ ...text("data"), fontSize: 13, color: complete ? COLOR.kelp : COLOR.mist }}>
            {deck.cardIds.length} / {DECK_RULES.cards}
          </span>
          {complete ? (
            <span style={{ ...text("label"), color: COLOR.kelp }}>Ready to play</span>
          ) : (
            <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
              {problems.slice(0, 2).map((p, i) => (
                <span key={i} style={{ ...text("small"), color: COLOR.doubloon }}>
                  {describeProblem(p, cardName)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* Leader */}
      <section>
        <h3 style={{ ...text("label"), color: COLOR.fathom, marginBottom: SPACE.md }}>Leader</h3>
        {ownedLeaders.length === 0 ? (
          <p style={{ ...text("small"), color: COLOR.fathom }}>
            You do not own a card that can lead yet.
          </p>
        ) : (
          <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
            {ownedLeaders.map(id => {
              const on = deck.leaderId === id;
              const print = printForDeck(deck, collection, id);
              if (!print) return null;
              return (
                <div key={id} style={{ position: "relative" }}>
                  <div style={{ outline: on ? `2px solid ${COLOR.current}` : "none", outlineOffset: 3, borderRadius: 10 }}>
                    <PrintCard
                      card={cardFace(id)}
                      print={print}
                      width={CARD_SIZE.sm}
                      onClick={() => update({ leaderId: on ? null : id })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* In the deck */}
      <section>
        <h3 style={{ ...text("label"), color: COLOR.fathom, marginBottom: SPACE.md }}>
          In this deck — click to remove, or change its print
        </h3>
        {deck.cardIds.length === 0 ? (
          <p style={{ ...text("small"), color: COLOR.fathom }}>Empty. Pick from your collection below.</p>
        ) : (
          <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
            {deck.cardIds.map(id => {
              const print = printForDeck(deck, collection, id);
              if (!print) return null;
              const others = printsOwnedOf(collection, id);
              return (
                <div key={id} style={{ display: "flex", flexDirection: "column", gap: 6, width: CARD_SIZE.sm }}>
                  <PrintCard card={cardFace(id)} print={print} width={CARD_SIZE.sm} onClick={() => removeCard(id)} />
                  {others.length > 1 && (
                    <button
                      onClick={() => setPickingPrintFor(pickingPrintFor === id ? null : id)}
                      style={{
                        ...text("label"), fontSize: 9,
                        padding: "3px 6px", borderRadius: RADIUS.sm,
                        border: `1px solid ${COLOR.rope}`, background: "transparent",
                        color: PRINT_COLOR[print],
                      }}
                    >
                      {PRINT_INFO[print].name}
                    </button>
                  )}
                  {pickingPrintFor === id && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {others.map(o => (
                        <button
                          key={o.print}
                          onClick={() => {
                            update({ prints: { ...deck.prints, [id]: o.print as PrintId } });
                            setPickingPrintFor(null);
                          }}
                          style={{
                            ...text("label"), fontSize: 9,
                            padding: "3px 6px", borderRadius: RADIUS.sm,
                            border: `1px solid ${o.print === print ? COLOR.current : COLOR.rope}`,
                            background: "transparent", color: PRINT_COLOR[o.print],
                            display: "inline-flex", alignItems: "center", gap: 4,
                          }}
                        >
                          <TierPip tier={PRINT_INFO[o.print].tier} size={5} />
                          {PRINT_INFO[o.print].name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Everything owned */}
      <section>
        <h3 style={{ ...text("label"), color: COLOR.fathom, marginBottom: SPACE.md }}>
          Your collection {full && "— deck is full"}
        </h3>
        <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
          {ownedCards.map(id => {
            const print = bestPrintOf(collection, id);
            if (!print) return null;
            const inDeck = deck.cardIds.includes(id);
            return (
              <div key={id} style={{ opacity: inDeck || full ? 0.35 : 1 }}>
                <PrintCard
                  card={cardFace(id)}
                  print={print}
                  width={CARD_SIZE.sm}
                  interactive={!inDeck && !full}
                  onClick={() => addCard(id)}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
