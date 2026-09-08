import { useCallback, useEffect, useMemo, useState } from "react";
import { PRINT_INFO, type PrintId, type RankId } from "@cg/meta";
import { COLOR, PRINT_COLOR, RADIUS, RANK_COLOR, SPACE, text } from "../design/tokens";
import { Panel, SectionHead } from "../components/primitives";
import { cardName } from "../data/pool";
import * as api from "../data/api";

/**
 * The room.
 *
 * Everything the server thought was worth saying out loud, newest first. Public
 * on purpose: somebody deciding whether to make an account should be able to
 * see that the game has people in it.
 */

const POLL_MS = 12_000;
const FILTERS = ["everything", "matches", "pulls", "ranks", "trades"] as const;
type Filter = (typeof FILTERS)[number];

const KIND_OF: Record<Filter, api.FeedKind[] | null> = {
  everything: null,
  matches: ["match", "streak"],
  pulls: ["pull"],
  ranks: ["rank"],
  trades: ["trade"],
};

export default function FeedScreen() {
  const [entries, setEntries] = useState<api.FeedEntry[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("everything");

  const load = useCallback(async () => {
    try {
      const res = await api.fetchFeed();
      setEntries(res.entries);
      setProblem(null);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not load the feed");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const shown = useMemo(() => {
    const kinds = KIND_OF[filter];
    if (!entries || !kinds) return entries;
    return entries.filter(entry => kinds.includes(entry.kind));
  }, [entries, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Feed"
        title="The room"
        right={
          <span style={{ ...text("small"), color: COLOR.fathom }}>
            Everyone's matches, pulls, ranks and trades
          </span>
        }
      />

      <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
        {FILTERS.map(id => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              ...text("label"),
              padding: "6px 13px",
              borderRadius: RADIUS.sm,
              border: `1px solid ${filter === id ? COLOR.current : COLOR.rope}`,
              background: filter === id ? "rgba(62,143,160,0.12)" : "transparent",
              color: filter === id ? COLOR.foam : COLOR.mist,
            }}
          >
            {id}
          </button>
        ))}
      </div>

      {problem && (
        <Panel padding={SPACE.lg} style={{ borderColor: "#7A2A22" }}>
          <span style={{ ...text("small"), color: "#E9857A" }}>{problem}</span>
        </Panel>
      )}

      <Panel padding={0}>
        {shown === null ? (
          <div style={{ padding: SPACE.xxl, ...text("label"), color: COLOR.fathom }}>Loading</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: SPACE.xxl }}>
            <p style={{ ...text("body"), color: COLOR.mist, maxWidth: 480 }}>
              {entries && entries.length > 0
                ? "Nothing of that kind yet."
                : "Nothing has happened yet. Finish a match or open a pack and it turns up here."}
            </p>
          </div>
        ) : (
          shown.map(entry => <Row key={entry.id} entry={entry} />)
        )}
      </Panel>
    </div>
  );
}

function Row({ entry }: { entry: api.FeedEntry }) {
  const { mark, colour, line } = describe(entry);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "8px 1fr auto",
        gap: SPACE.lg,
        alignItems: "center",
        padding: `${SPACE.md}px ${SPACE.xl}px`,
        borderBottom: `1px solid ${COLOR.rope}`,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colour }} />
      <span style={{ ...text("body"), fontSize: 14, color: COLOR.mist }}>
        <b style={{ color: COLOR.foam, fontWeight: 700 }}>{entry.username}</b> {line}
      </span>
      <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom, whiteSpace: "nowrap" }}>
        {mark}
      </span>
    </div>
  );
}

/** One row's worth of English, per kind. */
function describe(entry: api.FeedEntry): { mark: string; colour: string; line: string } {
  const ago = since(entry.at);
  const body = entry.body;

  switch (entry.kind) {
    case "match": {
      const won = Boolean(body.won);
      return {
        mark: ago,
        colour: won ? COLOR.kelp : COLOR.fathom,
        line: `${won ? "beat" : "lost to"} ${String(body.opponent)} in ${Number(body.turns)} turns`,
      };
    }
    case "streak":
      return {
        mark: ago,
        colour: COLOR.doubloon,
        line: `is on ${Number(body.streak)} wins in a row`,
      };
    case "rank": {
      const up = Boolean(body.up);
      const rank = body.rank as RankId;
      return {
        mark: ago,
        colour: RANK_COLOR[rank] ?? COLOR.marine,
        line: `${up ? "climbed to" : "dropped to"} ${String(body.rankName ?? rank)} on ${Number(body.mmr)}`,
      };
    }
    case "pull": {
      const print = body.print as PrintId;
      const name = PRINT_INFO[print]?.name ?? "rare";
      return {
        mark: ago,
        colour: PRINT_COLOR[print] ?? COLOR.signal,
        line: `pulled ${article(name)} ${name} ${cardName(String(body.cardId))}`,
      };
    }
    case "trade": {
      const gave = summarise(Number(body.aCards), Number(body.aBerries));
      const got = summarise(Number(body.bCards), Number(body.bBerries));
      const them = String(body.with);
      // A one sided trade is a gift, and reads terribly as "for nothing"
      const line =
        gave && got ? `traded ${gave} to ${them} for ${got}`
          : gave ? `gave ${gave} to ${them}`
          : got ? `took ${got} from ${them}`
          : `traded nothing with ${them}`;
      return { mark: ago, colour: COLOR.current, line };
    }
    default:
      return { mark: ago, colour: COLOR.fathom, line: "did something" };
  }
}

/** "an Alt Art", "a Secret". Only ever runs on print names, so this is enough. */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** Empty when a side put nothing on the table, so the sentence can change shape. */
function summarise(cards: number, berries: number): string {
  const parts = [
    cards > 0 ? `${cards} card${cards === 1 ? "" : "s"}` : null,
    berries > 0 ? `${berries} Berries` : null,
  ].filter(Boolean);
  return parts.join(" and ");
}

function since(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
