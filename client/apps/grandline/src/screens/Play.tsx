import { useState } from "react";
import { ENERGY_PER_TURN, TABLE_SIZE, TEAM, TEAM_SIZE } from "@cg/score";
import { COLOR, RADIUS, SPACE, text } from "../design/tokens";
import { Button, Panel, SectionHead, Text } from "../components/primitives";
import ScoreBattle from "./play/ScoreBattle";
import OnlineScore from "./play/OnlineScore";
import CardBattle, { type CardOpponent } from "./play/CardBattle";
import type { Store } from "../data/store";

/**
 * Where a game starts.
 *
 * Three modes, and three ways into each: online against another person, the
 * computer, and a local game where one screen holds both seats. Local exists
 * because two people at one keyboard is the easiest way to play a new mode with
 * somebody, and it needs no server at all.
 *
 * Online is a room and a code rather than a queue: one person opens a room and
 * reads out five letters, the other types them in. Nothing sits in a queue and
 * nothing runs between matches.
 */

type Mode = "score" | "draft" | "deck";

interface ModeDef {
  id: Mode;
  name: string;
  blurb: string;
  detail: string[];
  ready: boolean;
  /** Whether the server can run this mode between two people. */
  online: boolean;
}

const MODES: ModeDef[] = [
  {
    id: "score",
    name: "Score",
    blurb: "A table of face-down cards, and one take a turn.",
    detail: [
      `${TABLE_SIZE} cards on the table, ${TEAM_SIZE} to a team`,
      `${TEAM.captain} captain · ${TEAM.combat} combat · ${TEAM.support} support`,
      `${ENERGY_PER_TURN} energy a turn: look, or lock one away`,
    ],
    ready: true,
    online: true,
  },
  {
    id: "draft",
    name: "Draft",
    blurb: "Build a deck out of what you are dealt, then fight with it.",
    detail: [
      "A leader, then 12 picks, three on offer each time",
      "Cards come from the draft, not your binder",
      "Same battle as Deck",
    ],
    ready: true,
    online: true,
  },
  {
    id: "deck",
    name: "Deck",
    blurb: "Bring a deck you built, and fight with it.",
    detail: [
      "A leader and 12 cards, built on the Decks page",
      "Cards come from your collection",
      "Same battle as Draft",
    ],
    ready: true,
    online: true,
  },
];

export default function PlayScreen({ store }: { store: Store }) {
  const [playing, setPlaying] = useState<{ mode: Mode; opponent: CardOpponent } | null>(null);

  if (playing?.mode === "score") {
    if (playing.opponent === "online") {
      return <OnlineScore store={store} onLeave={() => setPlaying(null)} />;
    }
    return (
      <ScoreBattle
        opponent={playing.opponent}
        store={store}
        onLeave={() => setPlaying(null)}
      />
    );
  }

  if (playing) {
    return (
      <CardBattle
        mode={playing.mode}
        opponent={playing.opponent}
        store={store}
        onLeave={() => setPlaying(null)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Play"
        title="Pick a game"
        right={
          <span style={{ ...text("small"), color: COLOR.fathom }}>
            {store.signedIn ? "Online plays out of a room code" : "Sign in to play online"}
          </span>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: SPACE.lg }}>
        {MODES.map(mode => (
          <Panel key={mode.id} padding={SPACE.xl} style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md }}>
              <Text as="h3" role="heading">{mode.name}</Text>
              {!mode.ready && (
                <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>soon</span>
              )}
            </div>

            <p style={{ ...text("small"), color: COLOR.mist, minHeight: 34 }}>{mode.blurb}</p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 5 }}>
              {mode.detail.map(line => (
                <li
                  key={line}
                  style={{
                    ...text("small"),
                    fontSize: 12,
                    color: COLOR.fathom,
                    paddingLeft: SPACE.md,
                    borderLeft: `1px solid ${COLOR.rope}`,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  {line}
                </li>
              ))}
            </ul>

            <div
              style={{
                marginTop: "auto",
                paddingTop: SPACE.lg,
                display: "flex",
                gap: SPACE.sm,
                flexWrap: "wrap",
              }}
            >
              <Button
                tone="ghost"
                size="sm"
                disabled={!mode.online || !store.signedIn}
                onClick={() => setPlaying({ mode: mode.id, opponent: "online" })}
              >
                Online play
              </Button>
              <Button
                tone={mode.ready ? "primary" : "ghost"}
                size="sm"
                disabled={!mode.ready}
                onClick={() => setPlaying({ mode: mode.id, opponent: "ai" })}
              >
                Play vs AI
              </Button>
              <Button
                tone="secondary"
                size="sm"
                disabled={!mode.ready}
                onClick={() => setPlaying({ mode: mode.id, opponent: "local" })}
              >
                Play local
              </Button>
            </div>
          </Panel>
        ))}
      </div>

      <p style={{ ...text("small"), color: COLOR.fathom, maxWidth: 620 }}>
        A local game runs both seats on this screen, so two people can play across one keyboard, or
        over a share. Online puts you in a room with a code to pass on: no queue, and nothing to
        keep running between matches.
      </p>
    </div>
  );
}
