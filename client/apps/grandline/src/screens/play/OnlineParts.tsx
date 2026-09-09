import { useState } from "react";
import { COLOR, RADIUS, SPACE, text } from "../../design/tokens";
import { Button, Currency, Panel, Text } from "../../components/primitives";
import type { Net } from "../../data/net";

/**
 * The bits every online mode needs: the room, the dropped-out banner, and what
 * the match paid. They are the same in Score and in a card battle, and they are
 * the same because being online is the same problem in both.
 */

/** Before the match: connect, open a room, or use somebody's code. */
export function LobbyPanel({ net, title, onHost, onJoin, onLeave }: {
  net: Net;
  /** Which mode is waiting, for the line above the heading. */
  title: string;
  onHost: () => void;
  onJoin: (code: string) => void;
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
            <Button tone="primary" full disabled={net.status !== "ready"} onClick={onHost}>
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
                onClick={() => onJoin(code)}
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

/** The other player dropped, and has a moment before the game goes on without them. */
export function Away({ seconds }: { seconds: number }) {
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

/** Berries, packs and what it did to the ladder — or that it is still counting. */
export function RewardLine({ net }: { net: Net }) {
  const rank = net.rewards?.rank;
  if (!net.rewards) {
    return (
      <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>Counting it up…</span>
    );
  }

  return (
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
  );
}
