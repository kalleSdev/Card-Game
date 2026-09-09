import { useEffect } from "react";
import { scores, type ScorePlayer } from "@cg/score";
import { COLOR, SPACE, text } from "../../design/tokens";
import { Button, Panel, Text } from "../../components/primitives";
import { SCORE_POOL } from "../../data/pool";
import { useNet, type Net } from "../../data/net";
import type { Store } from "../../data/store";
import { ScoreTable } from "./ScoreBattle";
import { Away, LobbyPanel, RewardLine } from "./OnlineParts";

/**
 * Score Battle against another person.
 *
 * The table is dealt on the server and stays there. What arrives here has every
 * face-down card blanked out, which is the only way a blind take can mean
 * anything: locally the browser knows the whole deal and simply agrees not to
 * look, and that is fine against the computer and worth nothing against a
 * person.
 *
 * There is no seed on the rail for the same reason. The seed is the deal.
 */

export default function OnlineScore({ store, onLeave }: { store: Store; onLeave: () => void }) {
  const net = useNet(true);

  useEffect(() => {
    if (net.rewards) void store.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net.rewards]);

  const leave = () => { net.leave(); onLeave(); };

  if (net.status === "playing" && net.scoreState && net.scoreYou) {
    const state = net.scoreState;
    const you = net.scoreYou;
    return (
      <ScoreTable
        state={state}
        you={you}
        yourTurn={!state.over && state.turn === you}
        local={false}
        note={net.error}
        badge={`vs ${net.opponentName ?? "someone"}`}
        onIntent={net.sendScore}
        onLeave={leave}
      >
        {net.away !== null && !state.over && <Away seconds={net.away} />}
        {state.over && <Finish net={net} you={you} onLeave={leave} />}
      </ScoreTable>
    );
  }

  return (
    <LobbyPanel
      net={net}
      title="Score"
      onHost={net.hostScore}
      onJoin={net.joinScore}
      onLeave={leave}
    />
  );
}

/** The end of the table, and what the server paid for it. */
function Finish({ net, you, onLeave }: { net: Net; you: ScorePlayer; onLeave: () => void }) {
  const state = net.scoreState;
  const total = state ? scores(state, SCORE_POOL) : { P1: 0, P2: 0 };
  const them: ScorePlayer = you === "P1" ? "P2" : "P1";
  const line = state?.winner === "draw" ? "A draw" : state?.winner === you ? "You win" : "You lose";

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

        <p style={{ ...text("data"), fontSize: 30, color: COLOR.mist, margin: `${SPACE.lg}px 0` }}>
          {total[you]} — {total[them]}
        </p>

        <div style={{ margin: `${SPACE.xl}px 0` }}>
          <RewardLine net={net} />
        </div>

        <Button tone="primary" full onClick={onLeave}>Back to Play</Button>
      </Panel>
    </div>
  );
}
