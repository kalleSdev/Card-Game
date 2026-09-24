import { useEffect } from "react";
import type { PlayerDraftResult } from "@cg/contracts";
import { COLOR, SPACE, text } from "../../design/tokens";
import { Button, Panel, Text } from "../../components/primitives";
import { useNet, type Net } from "../../data/net";
import type { Store } from "../../data/store";
import { Arena } from "./Arena";
import { Away, LobbyPanel, RewardLine } from "./OnlineParts";

/**
 * A card battle against another person.
 *
 * Everything here is the server's: the state, the rules, and who won. This
 * screen sends intents and draws what comes back. That is the whole reason
 * online is a different container rather than a flag on the local board — one
 * of them owns an engine, and one of them owns a socket.
 *
 * Two people meet with a code. One opens a room and reads the code out, the
 * other types it in. There is no queue to sit in and nothing kept running
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
      <Arena
        state={net.state}
        events={net.events}
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
      </Arena>
    );
  }

  return (
    <LobbyPanel
      net={net}
      title={title}
      onHost={() => net.host(draft)}
      onJoin={code => net.join(code, draft)}
      onLeave={leave}
    />
  );
}

/** The end of the match, and what the server paid for it. */
function Finish({ net, onLeave }: { net: Net; onLeave: () => void }) {
  const won = net.state?.winner === net.you;

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
        <Text as="h3" role="display">{won ? "You win" : "You lose"}</Text>

        {net.endedBecause && (
          <p style={{ ...text("small"), fontSize: 12, color: COLOR.fathom, marginTop: SPACE.sm }}>
            {net.endedBecause}
          </p>
        )}

        <div style={{ margin: `${SPACE.xl}px 0` }}>
          <RewardLine net={net} />
        </div>

        <Button tone="primary" full onClick={onLeave}>Back to Play</Button>
      </Panel>
    </div>
  );
}
