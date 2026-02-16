import { useMemo, useState } from "react";
import type { Intent, SlotRef } from "@cg/contracts";
import { createEngine, createInitialState } from "@cg/engine";

const slotButton = (label: string, target: SlotRef) => ({ label, target });

export default function App() {
  const engine = useMemo(() => createEngine(createInitialState()), []);
  const [state, setState] = useState(engine.getState());
  const [events, setEvents] = useState<string[]>([]);

  const send = (intent: Intent) => {
    const res = engine.applyIntent(intent);
    setState(res.state);
    setEvents((prev) => [...prev, ...res.events.map((e) => JSON.stringify(e))]);
  };

  const me = state.activePlayerId;
  const zones = state.players[me];

  const myFirstCard = zones.hand[0]; // auto-drawn, first card in hand


  const slots = [
    slotButton("Leader", { type: "LEADER", index: 0 }),
    slotButton("Combat 1", { type: "COMBAT", index: 0 }),
    slotButton("Combat 2", { type: "COMBAT", index: 1 }),
    slotButton("Support 1", { type: "SUPPORT", index: 0 }),
    slotButton("Support 2", { type: "SUPPORT", index: 1 }),
    slotButton("Support 3", { type: "SUPPORT", index: 2 }),
  ] as const;

  const cardName = (instanceId: string, defId: string) =>
    `${instanceId} — ${state.cardDb[defId]?.name ?? defId}`;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Card Battler – Hotseat Slice</h1>

      <div style={{ marginTop: 8 }}>
        <b>Turn:</b> {state.turn} &nbsp; | &nbsp;
        <b>Active Player:</b> {state.activePlayerId}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div style={{ width: 360, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Active Player Actions</h2>

            <div style={{ marginBottom: 10 }}>
              <b>Deck:</b> {zones.deck.length} &nbsp; | &nbsp;
              <b>Hand:</b> {zones.hand.length}
              {zones.hand.length > 0
                ? ` — ${cardName(zones.hand[0].instanceId, zones.hand[0].defId)}`
                : " — (empty)"}
            </div>


          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {slots.map((s) => (
              <button
                key={`${s.target.type}-${s.target.index}`}
                disabled={!myFirstCard}
                onClick={() =>
                  myFirstCard &&
                  send({
                    type: "PLACE_CARD",
                    playerId: me,
                    cardInstanceId: myFirstCard.instanceId,
                    target: s.target,
                  })
                }
              >
                Place to {s.label}
              </button>
            ))}
          </div>

          <button
            style={{ marginTop: 12, width: "100%" }}
            onClick={() => send({ type: "END_TURN", playerId: me })}
          >
            End Turn ({me})
          </button>
        </div>

        <div style={{ flex: 1, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Board</h2>

          <div style={{ display: "flex", gap: 16 }}>
            <BoardView title="Player 1" player={state.players.P1} cardDb={state.cardDb} />
            <BoardView title="Player 2" player={state.players.P2} cardDb={state.cardDb} />
          </div>


          <h2>Event Log</h2>
          <div style={{ maxHeight: 260, overflow: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
            {events.length === 0 ? (
              <div>(no events yet)</div>
            ) : (
              events.slice().reverse().map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardView(props: {
  title: string;
  player: any;
  cardDb: Record<string, any>;
}) {
  const { title, player, cardDb } = props;

  const show = (c: any) => (c ? cardDb[c.defId]?.name ?? c.defId : "(empty)");

  return (
      <div style={{ width: 320, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ marginBottom: 8 }}>
    <div>
      <b>Deck:</b> {player.deck.length} &nbsp; | &nbsp;
      <b>Hand:</b> {player.hand.length}
    </div>
    <div>
      <b>Score (preview):</b> {player.scorePreview}
    </div>
    <div>
      <b>Synergies:</b> {player.activeSynergies?.join(", ") || "(none)"}
    </div>
  </div>


      <div><b>Leader:</b> {show(player.board.leader)}</div>
      <div><b>Combat:</b> {show(player.board.combat[0])} | {show(player.board.combat[1])}</div>
      <div><b>Support:</b> {show(player.board.support[0])} | {show(player.board.support[1])} | {show(player.board.support[2])}</div>
      <div style={{ opacity: 0.6 }}><b>Unleash (locked):</b> {show(player.board.unleashLocked)}</div>
    </div>
  );
}

