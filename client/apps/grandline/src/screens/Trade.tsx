import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRINTS, PRINT_INFO, binderOrder, countOf, printKey, type PrintId } from "@cg/meta";
import { CARD_SIZE, COLOR, RADIUS, SPACE, cardSlotHeight, text } from "../design/tokens";
import PrintCard from "../components/PrintCard";
import { Button, Currency, Panel, SectionHead, Text } from "../components/primitives";
import { POOL, cardFace, cardName } from "../data/pool";
import * as api from "../data/api";
import type { Store } from "../data/store";

/**
 * The trading table.
 *
 * Both sides are read from the server on a timer rather than pushed, because a
 * trade is a handful of clicks a minute and a socket for it would be more
 * moving parts than the thing is worth. The important rule is the server's, not
 * this screen's: editing either offer clears both confirmations, so what is
 * drawn here as "waiting on them" can never be stale in a way that costs
 * anybody anything.
 */

const POLL_MS = 2500;

export default function TradeScreen({ store, onSignIn }: { store: Store; onSignIn: () => void }) {
  const [trade, setTrade] = useState<api.Trade | null>(null);
  const [history, setHistory] = useState<api.TradeLogEntry[]>([]);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justDone, setJustDone] = useState<api.Trade | null>(null);
  const seenConfirmed = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.fetchTrades();
      setTrade(res.trade);
      setHistory(res.history);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not load your trades");
    }
  }, []);

  // Poll only while there is a table to watch
  useEffect(() => {
    if (!store.signedIn) return;
    void load();
  }, [store.signedIn, load]);

  useEffect(() => {
    if (!store.signedIn || !trade) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [store.signedIn, trade, load]);

  /** Every action is the same shape: run it, take the trade back, say why not. */
  const act = useCallback(
    async (run: () => Promise<{ trade: api.Trade } | { ok: true }>) => {
      setBusy(true);
      setProblem(null);
      try {
        const res = await run();
        if ("trade" in res) {
          if (res.trade.state === "done") {
            setJustDone(res.trade);
            setTrade(null);
            await store.refresh();
          } else {
            setTrade(res.trade);
          }
        } else {
          setTrade(null);
        }
        await load();
      } catch (err) {
        setProblem(err instanceof Error ? err.message : "That did not work");
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load, store],
  );

  // The other side committing is the one change worth reacting to on its own
  useEffect(() => {
    if (!trade) {
      seenConfirmed.current = false;
      return;
    }
    seenConfirmed.current = trade.them?.confirmed ?? false;
  }, [trade]);

  if (!store.signedIn) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
        <SectionHead eyebrow="Trade" title="The table" />
        <Panel padding={SPACE.lg} style={{ borderColor: "rgba(62,143,160,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexWrap: "wrap" }}>
            <span style={{ ...text("body"), color: COLOR.mist }}>
              Trading needs an account on both sides of the table.
            </span>
            <div style={{ marginLeft: "auto" }}>
              <Button size="sm" tone="primary" onClick={onSignIn}>Log in</Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Trade"
        title="The table"
        right={
          trade ? (
            <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg }}>
              <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>Code</span>
              <span style={{ ...text("data"), fontSize: 18, letterSpacing: "0.18em", color: COLOR.doubloon }}>
                {trade.code}
              </span>
            </div>
          ) : undefined
        }
      />

      {problem && (
        <Panel padding={SPACE.lg} style={{ borderColor: "#7A2A22" }}>
          <span style={{ ...text("small"), color: "#E9857A" }}>{problem}</span>
        </Panel>
      )}

      {justDone && !trade && (
        <Panel padding={SPACE.lg} style={{ borderColor: "rgba(63,164,107,0.45)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexWrap: "wrap" }}>
            <span style={{ ...text("body"), color: COLOR.kelp }}>
              Traded with {justDone.them?.username ?? "them"}. It is in your binder now.
            </span>
            <div style={{ marginLeft: "auto" }}>
              <Button size="sm" tone="ghost" onClick={() => setJustDone(null)}>Clear</Button>
            </div>
          </div>
        </Panel>
      )}

      {trade ? (
        <Table trade={trade} store={store} busy={busy} act={act} />
      ) : (
        <Start
          code={code}
          setCode={setCode}
          busy={busy}
          onOpen={() => void act(() => api.openTrade())}
          onJoin={() => void act(() => api.joinTrade(code))}
        />
      )}

      <History entries={history} />
    </div>
  );
}

// ── Before there is a table ──────────────────────────────────────────────────

function Start({ code, setCode, busy, onOpen, onJoin }: {
  code: string;
  setCode: (next: string) => void;
  busy: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: SPACE.lg }}>
      <Panel padding={SPACE.xl}>
        <Text role="heading">Open a table</Text>
        <p style={{ ...text("small"), color: COLOR.mist, margin: `${SPACE.md}px 0 ${SPACE.lg}px` }}>
          You get a five letter code. Give it to whoever you are trading with and they join you here.
          One table at a time.
        </p>
        <Button tone="primary" onClick={onOpen} disabled={busy}>Open a table</Button>
      </Panel>

      <Panel padding={SPACE.xl}>
        <Text role="heading">Join with a code</Text>
        <p style={{ ...text("small"), color: COLOR.mist, margin: `${SPACE.md}px 0 ${SPACE.lg}px` }}>
          Type the code they gave you. Case and spacing do not matter.
        </p>
        <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="ABCDE"
            maxLength={12}
            style={{
              ...text("data"),
              fontSize: 18,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              width: 150,
              padding: "8px 12px",
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLOR.rope}`,
              background: COLOR.abyss,
              color: COLOR.foam,
            }}
          />
          <Button tone="secondary" onClick={onJoin} disabled={busy || code.trim().length < 3}>
            Join
          </Button>
        </div>
      </Panel>
    </div>
  );
}

// ── The table itself ─────────────────────────────────────────────────────────

function Table({ trade, store, busy, act }: {
  trade: api.Trade;
  store: Store;
  busy: boolean;
  act: (run: () => Promise<{ trade: api.Trade } | { ok: true }>) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const offer = trade.you.offer;

  const setOffer = (next: api.Offer) => void act(() => api.setOffer(trade.id, next));

  const change = (cardId: string, print: PrintId, by: number) => {
    const lines = offer.prints.slice();
    const at = lines.findIndex(l => l.cardId === cardId && l.print === print);
    if (at === -1) {
      if (by > 0) lines.push({ cardId, print, count: by });
    } else {
      const count = lines[at].count + by;
      if (count <= 0) lines.splice(at, 1);
      else lines[at] = { ...lines[at], count };
    }
    setOffer({ ...offer, prints: lines });
  };

  const both = trade.you.confirmed && (trade.them?.confirmed ?? false);
  const waiting = trade.you.confirmed && !both;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: SPACE.lg }}>
        <Side
          heading="Your side"
          side={trade.you}
          store={store}
          onRemove={(cardId, print) => change(cardId, print, -1)}
          onBerries={next => setOffer({ ...offer, berries: next })}
          onAdd={() => setPicking(true)}
          busy={busy}
        />
        <Side
          heading={trade.them ? `${trade.them.username}'s side` : "Waiting for somebody"}
          side={trade.them}
          store={store}
          busy={busy}
        />
      </div>

      {/* Confirming is deliberately its own bar, away from the editing */}
      <Panel padding={SPACE.lg}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexWrap: "wrap" }}>
          <span style={{ ...text("small"), color: COLOR.mist, flex: 1, minWidth: 240 }}>
            {!trade.them
              ? "Nobody has joined yet. Give them the code above."
              : waiting
                ? "You have confirmed. Waiting on them."
                : trade.them.confirmed
                  ? `${trade.them.username} has confirmed. Confirm to swap.`
                  : "Changing either side clears both confirmations, so nothing can be swapped underneath you."}
          </span>

          <Button
            tone="ghost"
            size="sm"
            onClick={() => void act(async () => { await api.cancelTrade(trade.id); return { ok: true } as const; })}
            disabled={busy}
          >
            Cancel trade
          </Button>
          <Button
            tone="primary"
            onClick={() => void act(() => api.confirmTrade(trade.id))}
            disabled={busy || !trade.them || trade.you.confirmed}
          >
            {trade.you.confirmed ? "Confirmed" : "Confirm"}
          </Button>
        </div>
      </Panel>

      {picking && (
        <Picker
          store={store}
          offer={offer}
          onPick={(cardId, print) => change(cardId, print, 1)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function Side({ heading, side, store, onRemove, onBerries, onAdd, busy }: {
  heading: string;
  side: api.TradeSide | null;
  store: Store;
  onRemove?: (cardId: string, print: PrintId) => void;
  onBerries?: (next: number) => void;
  onAdd?: () => void;
  busy?: boolean;
}) {
  const editable = Boolean(onRemove);
  const offer = side?.offer ?? { prints: [], berries: 0 };

  return (
    <Panel padding={SPACE.lg}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg }}>
        <Text role="heading">{heading}</Text>
        {side?.confirmed && (
          <span style={{ ...text("label"), fontSize: 9, color: COLOR.kelp }}>Confirmed</span>
        )}
        {editable && (
          <div style={{ marginLeft: "auto" }}>
            <Button size="sm" tone="secondary" onClick={onAdd} disabled={busy}>Add a card</Button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap", minHeight: cardSlotHeight(CARD_SIZE.sm) }}>
        {offer.prints.length === 0 ? (
          <span style={{ ...text("small"), color: COLOR.fathom }}>Nothing on the table yet.</span>
        ) : (
          offer.prints.map(line => (
            <div key={printKey(line.cardId, line.print)} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: cardSlotHeight(CARD_SIZE.sm), display: "flex", alignItems: "flex-end" }}>
                <PrintCard card={cardFace(line.cardId)} print={line.print} width={CARD_SIZE.sm} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...text("data"), fontSize: 12, color: COLOR.mist }}>×{line.count}</span>
                <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>
                  {PRINT_INFO[line.print].short}
                </span>
                {editable && (
                  <button
                    onClick={() => onRemove?.(line.cardId, line.print)}
                    disabled={busy}
                    style={{
                      ...text("label"), fontSize: 9,
                      marginLeft: "auto",
                      color: COLOR.signal,
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    Take back
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", gap: SPACE.md,
          marginTop: SPACE.lg, paddingTop: SPACE.md,
          borderTop: `1px solid ${COLOR.rope}`,
        }}
      >
        <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>Berries</span>
        {editable ? (
          <input
            type="number"
            min={0}
            max={store.wallet.berries}
            value={offer.berries}
            onChange={e => onBerries?.(Math.max(0, Math.min(store.wallet.berries, Number(e.target.value) || 0)))}
            disabled={busy}
            style={{
              ...text("data"),
              fontSize: 14,
              width: 110,
              padding: "5px 9px",
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLOR.rope}`,
              background: COLOR.abyss,
              color: COLOR.doubloon,
            }}
          />
        ) : (
          <Currency kind="berries" amount={offer.berries} size="sm" />
        )}
        {editable && (
          <span style={{ ...text("small"), fontSize: 11, color: COLOR.fathom, marginLeft: "auto" }}>
            you have {store.wallet.berries}
          </span>
        )}
      </div>
    </Panel>
  );
}

// ── Choosing what to put on the table ────────────────────────────────────────

function Picker({ store, offer, onPick, onClose }: {
  store: Store;
  offer: api.Offer;
  onPick: (cardId: string, print: PrintId) => void;
  onClose: () => void;
}) {
  const staged = useMemo(() => {
    const out = new Map<string, number>();
    for (const line of offer.prints) out.set(printKey(line.cardId, line.print), line.count);
    return out;
  }, [offer]);

  const rows = useMemo(
    () =>
      binderOrder(store.collection, POOL, cardName).flatMap(cardId =>
        PRINTS.filter(print => countOf(store.collection, cardId, print) > 0).map(print => ({ cardId, print })),
      ),
    [store.collection],
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(4,7,12,0.72)",
        backdropFilter: "blur(7px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: SPACE.xl,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: COLOR.hull,
          border: `1px solid ${COLOR.rope}`,
          borderRadius: RADIUS.lg,
          padding: SPACE.xl,
          maxWidth: 900,
          width: "100%",
          maxHeight: "82vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: SPACE.lg }}>
          <Text role="heading">Put a card on the table</Text>
          <div style={{ marginLeft: "auto" }}>
            <Button size="sm" tone="ghost" onClick={onClose}>Done</Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <span style={{ ...text("small"), color: COLOR.fathom }}>
            You have nothing to trade yet. Open a pack first.
          </span>
        ) : (
          <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
            {rows.map(({ cardId, print }) => {
              const held = countOf(store.collection, cardId, print);
              const on = staged.get(printKey(cardId, print)) ?? 0;
              const left = held - on;
              return (
                <div key={printKey(cardId, print)} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div
                    style={{
                      height: cardSlotHeight(CARD_SIZE.sm),
                      display: "flex",
                      alignItems: "flex-end",
                      opacity: left > 0 ? 1 : 0.3,
                    }}
                  >
                    <PrintCard
                      card={cardFace(cardId)}
                      print={print}
                      width={CARD_SIZE.sm}
                      onClick={left > 0 ? () => onPick(cardId, print) : undefined}
                    />
                  </div>
                  <span style={{ ...text("data"), fontSize: 11, color: left > 0 ? COLOR.mist : COLOR.fathom }}>
                    {left} of {held} free
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── What has already been traded ─────────────────────────────────────────────

function History({ entries }: { entries: api.TradeLogEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 style={{ ...text("label"), color: COLOR.fathom, marginBottom: SPACE.md }}>Past trades</h3>
      <Panel padding={0}>
        {entries.map(entry => (
          <div
            key={entry.id}
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr 1fr",
              gap: SPACE.lg,
              alignItems: "center",
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              borderBottom: `1px solid ${COLOR.rope}`,
            }}
          >
            <span style={{ ...text("small"), fontSize: 12, color: COLOR.mist }}>
              {new Date(entry.at).toLocaleDateString()} · {entry.withName}
            </span>
            <Half label="You gave" offer={entry.gave} color={COLOR.signal} />
            <Half label="You got" offer={entry.got} color={COLOR.kelp} />
          </div>
        ))}
      </Panel>
    </section>
  );
}

function Half({ label, offer, color }: { label: string; offer: api.Offer; color: string }) {
  const cards = offer.prints.reduce((sum, line) => sum + line.count, 0);
  const parts = [
    cards > 0 ? `${cards} card${cards === 1 ? "" : "s"}` : null,
    offer.berries > 0 ? `${offer.berries} Berries` : null,
  ].filter(Boolean);
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>{label}</span>
      <span style={{ ...text("small"), fontSize: 12, color }}>
        {parts.length > 0 ? parts.join(" · ") : "nothing"}
      </span>
    </span>
  );
}
