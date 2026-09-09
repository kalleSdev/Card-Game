import { useMemo, useState } from "react";
import {
  PRINTS, PRINT_INFO, DUPLICATE_VALUE,
  bestPrintOf, binderOrder, countOf, sparesOf, statsFor, valueOfAllSpares,
  type Collection as Held, type PrintId,
} from "@cg/meta";
import { CARD_SIZE, COLOR, PRINT_COLOR, RADIUS, SPACE, cardSlotHeight, text } from "../design/tokens";
import PrintCard from "../components/PrintCard";
import Inspect from "../components/Inspect";
import ScoreCard, { GRADE_LABEL, GRADE_TONE } from "../components/ScoreCard";
import { Button, Chip, Currency, Panel, SectionHead, Stat, Text, TierPip } from "../components/primitives";
import { POOL, cardFace, cardName, scoreCard } from "../data/pool";
import type { Store } from "../data/store";

type Filter = "all" | "owned" | "missing" | "spares" | PrintId;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "owned", label: "Owned" },
  { id: "missing", label: "Missing" },
  { id: "spares", label: "Has spares" },
  ...PRINTS.map(p => ({ id: p as Filter, label: PRINT_INFO[p].name })),
];

export default function CollectionScreen({ store }: { store: Store }) {
  const { collection } = store;
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const stats = useMemo(() => statsFor(collection, POOL), [collection]);
  const spareValue = useMemo(() => valueOfAllSpares(collection), [collection]);
  const ordered = useMemo(() => binderOrder(collection, POOL, cardName), [collection]);

  const shown = useMemo(() => ordered.filter(id => matches(collection, id, filter)), [ordered, collection, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Collection"
        title="Binder"
        right={
          <div style={{ display: "flex", gap: SPACE.xl, alignItems: "flex-end" }}>
            <Stat label="Cards" value={`${stats.cardsOwned} / ${stats.cardsTotal}`} />
            <Stat label="Prints" value={`${stats.printsOwned} / ${stats.printsTotal}`} />
            <Stat
              label="Complete"
              value={`${Math.round(stats.completion * 100)}%`}
              color={stats.completion > 0.5 ? COLOR.kelp : COLOR.foam}
            />
          </div>
        }
      />

      {/* Spares, and what they are worth if scrapped */}
      <Panel padding={SPACE.lg}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.xl, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.sm }}>
            <span style={{ ...text("data"), fontSize: 19 }}>{stats.spares}</span>
            <span style={{ ...text("small"), color: COLOR.mist }}>
              spare{stats.spares === 1 ? "" : "s"} across {stats.copiesHeld} copies
            </span>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: COLOR.rope }} />
          <span style={{ ...text("small"), color: COLOR.fathom }}>Worth</span>
          <Currency kind="stardust" amount={spareValue.stardust} />
          <span style={{ ...text("small"), color: COLOR.fathom }}>or</span>
          <Currency kind="berries" amount={spareValue.berries} />
          <span style={{ ...text("small"), color: COLOR.fathom, marginLeft: "auto" }}>
            Scrapping all your spares always leaves one
          </span>
        </div>
      </Panel>

      {/* Filters */}
      <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap", alignItems: "center" }}>
        {FILTERS.map(f => {
          const on = f.id === filter;
          const isPrint = (PRINTS as readonly string[]).includes(f.id);
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                ...text("label"),
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 11px",
                borderRadius: RADIUS.sm,
                border: `1px solid ${on ? COLOR.current : COLOR.rope}`,
                background: on ? "rgba(62,143,160,0.12)" : "transparent",
                color: on ? COLOR.foam : COLOR.mist,
              }}
            >
              {isPrint && <TierPip tier={PRINT_INFO[f.id as PrintId].tier} size={6} />}
              {f.label}
            </button>
          );
        })}
        <span style={{ ...text("small"), color: COLOR.fathom, marginLeft: "auto" }}>
          {shown.length} card{shown.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* The binder */}
      {shown.length === 0 ? (
        <Panel padding={SPACE.xxxl}>
          <Text role="heading">Nothing here</Text>
          <p style={{ ...text("body"), color: COLOR.mist, marginTop: SPACE.sm }}>
            No card matches that filter. Try Everything.
          </p>
        </Panel>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.lg }}>
          {shown.map(id => (
            <BinderSlot
              key={id}
              cardId={id}
              collection={collection}
              onOpen={() => setOpen(id)}
            />
          ))}
        </div>
      )}

      {open && (
        <CardSheet
          cardId={open}
          store={store}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function matches(collection: Held, cardId: string, filter: Filter): boolean {
  const best = bestPrintOf(collection, cardId);
  if (filter === "all") return true;
  if (filter === "owned") return best !== null;
  if (filter === "missing") return best === null;
  if (filter === "spares") return PRINTS.some(p => sparesOf(collection, cardId, p) > 0);
  return countOf(collection, cardId, filter) > 0;
}

/** One card in the binder: the best print held, or a slot showing what is missing. */
function BinderSlot({
  cardId, collection, onOpen,
}: {
  cardId: string;
  collection: Held;
  onOpen: () => void;
}) {
  const best = bestPrintOf(collection, cardId);
  const held = PRINTS.filter(p => countOf(collection, cardId, p) > 0);

  if (!best) {
    return (
      <button
        onClick={onOpen}
        style={{
          width: CARD_SIZE.md,
          aspectRatio: "5 / 7.2",
          borderRadius: 10,
          border: `1px dashed ${COLOR.rope}`,
          background: "transparent",
          color: COLOR.fathom,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6,
          textAlign: "center", padding: SPACE.md,
        }}
      >
        <span style={{ ...text("small"), color: COLOR.fathom }}>{cardName(cardId)}</span>
        <span style={{ ...text("label"), fontSize: 9 }}>Not collected</span>
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, width: CARD_SIZE.md }}>
      <PrintCard
        card={cardFace(cardId)}
        print={best}
        width={CARD_SIZE.md}
        count={countOf(collection, cardId, best)}
        onClick={onOpen}
      />
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {held.map(p => (
          <span
            key={p}
            title={PRINT_INFO[p].name}
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: PRINT_COLOR[p], flex: "none",
            }}
          />
        ))}
        <span style={{ ...text("small"), fontSize: 11, color: COLOR.fathom, marginLeft: "auto" }}>
          {held.length}/{PRINTS.length}
        </span>
      </div>
    </div>
  );
}

/** Everything about one card: all six prints, what is held, what to do with spares. */
function CardSheet({
  cardId, store, onClose,
}: {
  cardId: string;
  store: Store;
  onClose: () => void;
}) {
  const { collection } = store;
  const [inspecting, setInspecting] = useState<PrintId | null>(null);
  const [face, setFace] = useState<"collection" | "score">("collection");
  const [confirming, setConfirming] = useState<
    { print: PrintId; action: "dust" | "sell"; amount: number } | null
  >(null);
  const score = scoreCard(cardId);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(4,8,14,0.78)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: SPACE.xxl, overflowY: "auto",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 940 }}>
        <Panel padding={SPACE.xxl} lifted>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.lg }}>
            <div>
              <div style={{ ...text("label"), color: COLOR.current, marginBottom: 6 }}>Card</div>
              <Text as="h3" role="title">{cardName(cardId)}</Text>
            </div>
            <div style={{ display: "flex", gap: SPACE.sm }}>
              {score && (
                <Button
                  tone={face === "score" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFace(face === "score" ? "collection" : "score")}
                >
                  {face === "score" ? "Back to prints" : "Score battle version"}
                </Button>
              )}
              <Button tone="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>

          {face === "score" && score ? (
            <div style={{ display: "flex", gap: SPACE.xxl, flexWrap: "wrap", marginTop: SPACE.xl, alignItems: "flex-start" }}>
              <ScoreCard card={score} name={cardName(cardId)} width={CARD_SIZE.xl} />

              <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: SPACE.md }}>
                <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
                  <span
                    style={{ width: 9, height: 9, borderRadius: "50%", background: GRADE_TONE[score.grade].tone }}
                  />
                  <span style={{ ...text("heading"), color: GRADE_TONE[score.grade].tone }}>
                    {GRADE_LABEL[score.grade]}
                  </span>
                </div>

                <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
                  <Chip color={GRADE_TONE[score.grade].tone}>{score.points} points</Chip>
                  <Chip color={COLOR.mist}>{score.role}</Chip>
                </div>

                <p style={{ ...text("small"), color: COLOR.mist, maxWidth: 420 }}>
                  This is the face this character wears in Score Battle, and nowhere else. There is no
                  print, no attack, health or cost, because none of it is used in that mode: a card is
                  worth its points, the captain seat doubles them, and a card in the wrong seat costs
                  2. Your collection card is untouched.
                </p>
              </div>
            </div>
          ) : (
          <>
          <div style={{ display: "flex", gap: SPACE.lg, flexWrap: "wrap", marginTop: SPACE.xl }}>
            {PRINTS.map(print => {
              const count = countOf(collection, cardId, print);
              const spares = sparesOf(collection, cardId, print);
              const value = DUPLICATE_VALUE[print];
              return (
                <div key={print} style={{ width: CARD_SIZE.md, display: "flex", flexDirection: "column", gap: SPACE.sm }}>
                  <div
                    style={{
                      height: cardSlotHeight(CARD_SIZE.md),
                      display: "flex",
                      alignItems: "flex-end",
                      opacity: count ? 1 : 0.28,
                      cursor: count ? "zoom-in" : "default",
                    }}
                  >
                    <PrintCard
                      card={cardFace(cardId)}
                      print={print}
                      width={CARD_SIZE.md}
                      count={count}
                      interactive={count > 0}
                      onClick={count ? () => setInspecting(print) : undefined}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <TierPip tier={PRINT_INFO[print].tier} />
                    <span style={{ ...text("small"), fontWeight: 600, color: count ? PRINT_COLOR[print] : COLOR.fathom }}>
                      {PRINT_INFO[print].name}
                    </span>
                    <span style={{ ...text("data"), fontSize: 11, color: COLOR.fathom, marginLeft: "auto" }}>
                      {count > 0 ? `×${count}` : "—"}
                    </span>
                  </div>

                  {count > 0 && store.signedIn ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ ...text("small"), fontSize: 11, color: COLOR.fathom }}>
                        {spares > 0 ? `${spares} spare${spares === 1 ? "" : "s"}` : "Your only copy"}
                      </span>

                      {/* One at a time. On the last copy these ask first. */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button
                          size="sm"
                          tone="ghost"
                          onClick={() => spares > 0
                            ? store.scrap(cardId, print, 1, "dust")
                            : setConfirming({ print, action: "dust", amount: 1 })}
                        >
                          Dust {value.stardust}
                        </Button>
                        <Button
                          size="sm"
                          tone="ghost"
                          onClick={() => spares > 0
                            ? store.scrap(cardId, print, 1, "sell")
                            : setConfirming({ print, action: "sell", amount: 1 })}
                        >
                          Sell {value.berries}
                        </Button>
                      </div>

                      {/* All of them, which always leaves the last copy alone */}
                      {spares > 1 && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button size="sm" tone="ghost" onClick={() => store.scrap(cardId, print, spares, "dust")}>
                            Dust all {spares}
                          </Button>
                          <Button size="sm" tone="ghost" onClick={() => store.scrap(cardId, print, spares, "sell")}>
                            Sell all {spares}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ ...text("small"), fontSize: 11, color: COLOR.fathom }}>
                      Not collected
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: SPACE.xl, display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
            <Chip color={COLOR.mist}>ATK {cardFace(cardId).atk}</Chip>
            <Chip color={COLOR.mist}>HP {cardFace(cardId).hp}</Chip>
            <Chip color={COLOR.mist}>Cost {cardFace(cardId).cost}</Chip>
            <span style={{ ...text("small"), color: COLOR.fathom, marginLeft: SPACE.md }}>
              Every print plays identically. Only the look changes.
            </span>
          </div>
          </>
          )}
        </Panel>
      </div>

      {confirming && (
        <LastCopy
          cardId={cardId}
          print={confirming.print}
          action={confirming.action}
          onConfirm={() => {
            void store.scrap(cardId, confirming.print, confirming.amount, confirming.action, true);
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        />
      )}

      {inspecting && (
        <Inspect
          card={cardFace(cardId)}
          print={inspecting}
          count={countOf(collection, cardId, inspecting)}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}

/**
 * The last copy of a print.
 *
 * Scrapping a spare is routine and happens on one click. Scrapping the only
 * copy you have is not, so it asks — once, plainly, with the card in front of
 * you rather than a line of text about it.
 */
function LastCopy({ cardId, print, action, onConfirm, onCancel }: {
  cardId: string;
  print: PrintId;
  action: "dust" | "sell";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const value = DUPLICATE_VALUE[print];
  const gain = action === "dust" ? value.stardust : value.berries;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(4,8,14,0.78)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: SPACE.xl,
      }}
    >
      <div onClick={e => e.stopPropagation()}>
        <Panel padding={SPACE.xxl} lifted style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", gap: SPACE.xl, alignItems: "flex-start" }}>
            <PrintCard card={cardFace(cardId)} print={print} width={CARD_SIZE.sm} interactive={false} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <Text as="h3" role="heading">
                {action === "dust" ? "Dust" : "Sell"} your only {PRINT_INFO[print].name}?
              </Text>
              <p style={{ ...text("small"), color: COLOR.mist, margin: `${SPACE.md}px 0 ${SPACE.lg}px` }}>
                This is the last {cardName(cardId)} you hold in this print. Scrapping it takes it out
                of your collection and out of any deck it is in, for{" "}
                {action === "dust" ? `${gain} Stardust` : `${gain} Berries`}.
              </p>

              <div style={{ display: "flex", gap: SPACE.sm }}>
                <Button tone="primary" size="sm" onClick={onConfirm}>
                  Yes, {action === "dust" ? "dust" : "sell"} it
                </Button>
                <Button tone="ghost" size="sm" onClick={onCancel}>Keep it</Button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
