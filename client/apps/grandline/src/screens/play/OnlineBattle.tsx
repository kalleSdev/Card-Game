import { useEffect, useState } from "react";
import type { PlayerDraftResult } from "@cg/contracts";
import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import { Button, Currency, Panel, Text } from "../../components/primitives";
import { useNet, type Net } from "../../data/net";
import type { Store } from "../../data/store";
import { Board } from "./BattleBoard";

/**
 * A match against another person.
 *
 * Everything here is the server's: the state, the rules, and who won. This
 * screen sends intents and draws what comes back. That is the whole reason
 * online is a different container rather than a flag on the local board — one
 * of them owns an engine, and one of them owns a socket.
 *
 * Two people meet with a code. One opens a room and reads the code out, the
 * other types it in. There is no queue to sit in and nothing to keep running
 * between matches, which is the cheapest thing that is still a real game.
 */

export default function OnlineBattle({ draft, title, store, onLeave }: {
  /** The deck you are bringing, drafted or built before you got here. */
  draft: PlayerDraftResult;
  title: string;
  store: Store;
  onLeave: () => void;
}) {
  const net = useNet(true);

  // What the match paid only exists on the server, so the shell is out of date
  // the moment it arrives.
  useEffect(() => {
    if (net.rewards) void store.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net.rewards]);

  const leave = () => { net.leave(); onLeave(); };

  if (net.status === "playing" && net.state && net.you) {
    const over = Boolean(net.state.winner) || Boolean(net.endedBecause);
    return (
      <Board
        state={net.state}
        you={net.you}
        local={false}
        yourTurn={!net.state.winner && net.state.activePlayer === net.you}
        note={net.error}
        title={title}
        badge={`vs ${net.opponentName ?? "someone"}`}
        opponentName={net.opponentName ?? undefined}
        onIntent={net.send}
        onLeave={leave}
      >
        {net.away !== null && !over && <Away seconds={net.away} />}
        {over && <Finish net={net} onLeave={leave} />}
      </Board>
    );
  }

  return <Lobby net={net} draft={draft} title={title} onLeave={leave} />;
}

/** Before the match: connect, open a room or use someone's code. */
function Lobby({ net, draft, title, onLeave }: {
  net: Net;
  draft: PlayerDraftResult;
  title: string;
  onLeave: () => void;
}) {
  const [code, setCode] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflowY: "auto",
        background: `
          radial-gradient(1100px 620px at 50% -8%, rgba(62,143,160,0.09), transparent 68%),
          ${COLOR.abyss}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE.xl,
      }}
    >
      <Panel padding={SPACE.xxl} style={{ width: 460 }}>
        <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>{title} · online</span>
        <div style={{ marginTop: SPACE.sm }}>
          <Text as="h2" role="display">Find someone</Text>
        </div>

        <p style={{ ...text("body"), color: COLOR.mist, margin: `${SPACE.md}px 0 ${SPACE.xl}px` }}>
          {net.status === "connecting" && "Reaching the server…"}
          {net.status === "offline" && "The server is not answering. This keeps trying."}
          {net.status === "ready" && "Open a room and pass the code on, or type in one you were given."}
          {net.status === "hosting" && "Waiting for someone to use your code."}
          {net.status === "opponentLeft" && "They left the match."}
        </p>

        {net.code ? (
          <div style={{ textAlign: "center", marginBottom: SPACE.xl }}>
            <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>Your code</span>
            <p style={{ ...text("data"), fontSize: 38, color: COLOR.foam, letterSpacing: 4, margin: `${SPACE.sm}px 0` }}>
              {net.code}
            </p>
            <Button size="sm" tone="ghost" onClick={net.cancel}>Close the room</Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, marginBottom: SPACE.xl }}>
            <Button
              tone="primary"
              full
              disabled={net.status !== "ready"}
              onClick={() => net.host(draft)}
            >
              Open a room
            </Button>

            <div style={{ display: "flex", gap: SPACE.sm }}>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={8}
                style={{
                  flex: 1,
                  ...text("data"),
                  fontSize: 16,
                  letterSpacing: 3,
                  textAlign: "center",
                  color: COLOR.foam,
                  background: COLOR.hull,
                  border: `1px solid ${COLOR.rope}`,
                  borderRadius: RADIUS.sm,
                  padding: `0 ${SPACE.md}px`,
                }}
              />
              <Button
                tone="secondary"
                disabled={net.status !== "ready" || code.trim().length < 4}
                onClick={() => net.join(code, draft)}
              >
                Join
              </Button>
            </div>
          </div>
        )}

        {net.error && (
          <p style={{ ...text("small"), fontSize: 12, color: COLOR.signal, marginBottom: SPACE.md }}>
            {net.error}
          </p>
        )}

        <div style={{ paddingTop: SPACE.lg, borderTop: `1px solid ${COLOR.rope}` }}>
          <Button size="sm" tone="ghost" full onClick={onLeave}>Leave</Button>
        </div>
      </Panel>
    </div>
  );
}

/** The opponent dropped, and has a moment to come back before they lose. */
function Away({ seconds }: { seconds: number }) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: SPACE.lg,
        transform: "translateX(-50%)",
        zIndex: 240,
        background: COLOR.hull,
        border: `1px solid ${COLOR.rope}`,
        borderRadius: RADIUS.sm,
        padding: `${SPACE.sm}px ${SPACE.lg}px`,
        ...text("small"),
        fontSize: 12,
        color: COLOR.mist,
      }}
    >
      They dropped out. {seconds}s to come back.
    </div>
  );
}

/** The end of the match, and what the server paid for it. */
function Finish({ net, onLeave }: { net: Net; onLeave: () => void }) {
  const won = net.state?.winner === net.you;
  const line = won ? "You win" : "You lose";
  const rank = net.rewards?.rank;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "rgba(4,8,13,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Panel padding={SPACE.xxl} style={{ width: 420, textAlign: "center" }}>
        <Text as="h3" role="display">{line}</Text>

        {net.endedBecause && (
          <p style={{ ...text("small"), fontSize: 12, color: COLOR.fathom, marginTop: SPACE.sm }}>
            {net.endedBecause}
          </p>
        )}

        <div style={{ margin: `${SPACE.xl}px 0` }}>
          {net.rewards ? (
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg }}>
                <Currency kind="berries" amount={net.rewards.berries} />
                <span style={{ ...text("small"), fontSize: 12, color: COLOR.mist }}>
                  {net.rewards.packs.length === 1 ? "1 pack" : `${net.rewards.packs.length} packs`} to open
                </span>
              </div>

              {rank && (
                <span style={{ ...text("data"), fontSize: 12, color: rank.delta >= 0 ? COLOR.kelp : COLOR.signal }}>
                  {rank.rankName} · {rank.before} → {rank.after} ({rank.delta >= 0 ? "+" : ""}{rank.delta})
                </span>
              )}
            </div>
          ) : (
            <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>Counting it up…</span>
          )}
        </div>

        <Button tone="primary" full onClick={onLeave}>Back to Play</Button>
      </Panel>
    </div>
  );
}
