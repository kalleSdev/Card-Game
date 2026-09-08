import { useEffect, useMemo, useState } from "react";
import { RANKS, WIN_VALUE, breakEvenWinRate, type RankId } from "@cg/meta";
import { COLOR, RADIUS, RANK_COLOR, SPACE, text } from "../design/tokens";
import { Panel, RankBadge, SectionHead, Stat, Text } from "../components/primitives";
import { fetchLeaderboard, type Standing } from "../data/api";
import type { Store } from "../data/store";

export default function LadderScreen({ store }: { store: Store }) {
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then(res => { if (!cancelled) setStandings(res.standings); })
      .catch(err => { if (!cancelled) setProblem(err instanceof Error ? err.message : "Could not load the ladder"); });
    return () => { cancelled = true; };
  }, []);

  const you = store.standing;
  const yourRow = useMemo(
    () => standings?.findIndex(s => s.userId === you?.userId) ?? -1,
    [standings, you],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Ladder"
        title="Standings"
        right={
          you ? (
            <div style={{ display: "flex", gap: SPACE.xl, alignItems: "flex-end" }}>
              <Stat label="Your MMR" value={you.mmr} />
              <Stat label="Peak" value={you.peakMmr} color={COLOR.mist} />
              {you.streak > 1 && <Stat label="Streak" value={`${you.streak} in a row`} color={COLOR.kelp} />}
            </div>
          ) : undefined
        }
      />

      {problem && (
        <Panel padding={SPACE.lg} style={{ borderColor: "#7A2A22" }}>
          <span style={{ ...text("small"), color: "#E9857A" }}>{problem}</span>
        </Panel>
      )}

      {/* Where everyone actually is */}
      <Panel padding={0}>
        {standings === null ? (
          <div style={{ padding: SPACE.xxl, ...text("label"), color: COLOR.fathom }}>Loading</div>
        ) : standings.length === 0 ? (
          <div style={{ padding: SPACE.xxl }}>
            <Text role="heading">Nobody has played yet</Text>
            <p style={{ ...text("body"), color: COLOR.mist, marginTop: SPACE.sm, maxWidth: 460 }}>
              The ladder fills up as matches finish. A win is +{WIN_VALUE}; a loss costs more the
              higher you are.
            </p>
          </div>
        ) : (
          <div>
            {standings.map((s, i) => (
              <Row key={s.userId} standing={s} place={i + 1} isYou={i === yourRow} />
            ))}
          </div>
        )}
      </Panel>

      {/* What the numbers mean */}
      <section>
        <h3 style={{ ...text("label"), color: COLOR.fathom, marginBottom: SPACE.md }}>The ranks</h3>
        <div style={{ display: "grid", gap: 3 }}>
          {RANKS.map(rank => (
            <div
              key={rank.id}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 130px 1fr auto auto",
                gap: SPACE.lg,
                alignItems: "center",
                padding: `10px ${SPACE.lg}px`,
                background: you && you.rank === rank.id ? COLOR.swell : COLOR.hull,
                border: `1px solid ${you && you.rank === rank.id ? COLOR.cable : COLOR.rope}`,
                borderRadius: RADIUS.sm,
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 2, background: RANK_COLOR[rank.id] }} />
              <span style={{ ...text("body"), fontWeight: 700 }}>{rank.name}</span>
              <span style={{ ...text("data"), fontSize: 13, color: COLOR.mist }}>
                {rank.ceiling === null ? `${rank.floor} +` : `${rank.floor} – ${rank.ceiling}`}
              </span>
              <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
                −{rank.lossValue} a loss
              </span>
              <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom, minWidth: 96, textAlign: "right" }}>
                {Math.round(breakEvenWinRate(rank.floor) * 100)}% to hold
              </span>
            </div>
          ))}
          {(["emperor", "pirateKing"] as RankId[]).map(id => (
            <div
              key={id}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 130px 1fr",
                gap: SPACE.lg,
                alignItems: "center",
                padding: `10px ${SPACE.lg}px`,
                background: "rgba(214,65,47,0.07)",
                border: "1px solid rgba(214,65,47,0.35)",
                borderRadius: RADIUS.sm,
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 2, background: RANK_COLOR[id] }} />
              <span style={{ ...text("body"), fontWeight: 700 }}>
                {id === "emperor" ? "Emperor" : "Pirate King"}
              </span>
              <span style={{ ...text("data"), fontSize: 13, color: COLOR.mist }}>
                {id === "emperor" ? "top 4 above Master" : "top 1 above Master"}
              </span>
            </div>
          ))}
        </div>
        <p style={{ ...text("small"), color: COLOR.fathom, marginTop: SPACE.lg, maxWidth: 620 }}>
          A win is worth {WIN_VALUE} wherever you are, so the loss value sets the win rate you need to
          hold a rank. Emperor and Pirate King are the only two nobody can reach by grinding: they are
          a place on this list, and they change when somebody else plays.
        </p>
      </section>
    </div>
  );
}

function Row({ standing, place, isYou }: { standing: Standing; place: number; isYou: boolean }) {
  const top = standing.topRank;
  const label = top === "pirateKing" ? "Pirate King" : top === "emperor" ? "Emperor" : standing.rankName;
  const rankId: RankId = top ?? standing.rank;
  const played = standing.wins + standing.losses;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr auto auto auto",
        gap: SPACE.lg,
        alignItems: "center",
        padding: `${SPACE.md}px ${SPACE.xl}px`,
        borderBottom: `1px solid ${COLOR.rope}`,
        background: isYou ? "rgba(62,143,160,0.09)" : "transparent",
      }}
    >
      <span style={{ ...text("data"), fontSize: 14, color: place <= 5 ? COLOR.foam : COLOR.fathom }}>
        {place}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: SPACE.md, minWidth: 0 }}>
        <span
          style={{
            ...text("body"),
            fontWeight: isYou ? 700 : 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {standing.username}
        </span>
        {isYou && <span style={{ ...text("label"), fontSize: 9, color: COLOR.current }}>You</span>}
        {standing.streak >= 3 && (
          <span style={{ ...text("label"), fontSize: 9, color: COLOR.kelp }}>
            {standing.streak} in a row
          </span>
        )}
      </span>
      <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
        {standing.wins}W {standing.losses}L
        {played > 0 && ` · ${Math.round((standing.wins / played) * 100)}%`}
      </span>
      <RankBadge rank={rankId} label={label} />
      <span style={{ ...text("data"), fontSize: 14, minWidth: 52, textAlign: "right" }}>
        {standing.mmr}
      </span>
    </div>
  );
}
