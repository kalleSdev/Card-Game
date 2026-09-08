import { useState } from "react";
import { ENERGY_PER_TURN, TABLE_SIZE, TEAM, TEAM_SIZE } from "@cg/score";
import { COLOR, RADIUS, SPACE, text } from "../design/tokens";
import { Button, Panel, SectionHead, Text } from "../components/primitives";
import ScoreBattle from "./play/ScoreBattle";

/**
 * Where a game starts.
 *
 * Three modes, one card each, and nothing else on the page. Two of them are the
 * same battle with a different source of cards, which the copy says out loud
 * rather than leaving somebody to work out from playing both.
 */

type Mode = "score" | "draft" | "deck";

interface ModeDef {
  id: Mode;
  name: string;
  blurb: string;
  detail: string[];
  ready: boolean;
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
  },
  {
    id: "draft",
    name: "Draft",
    blurb: "Build a deck out of what you are dealt, then fight with it.",
    detail: ["Cards come from the draft, not your binder", "Same battle as Deck"],
    ready: false,
  },
  {
    id: "deck",
    name: "Deck",
    blurb: "Bring a deck you built, and fight with it.",
    detail: ["Cards come from your collection", "Same battle as Draft"],
    ready: false,
  },
];

export default function PlayScreen() {
  const [playing, setPlaying] = useState<Mode | null>(null);

  if (playing === "score") return <ScoreBattle onLeave={() => setPlaying(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Play"
        title="Pick a game"
        right={
          <span style={{ ...text("small"), color: COLOR.fathom }}>
            Against the computer for now
          </span>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: SPACE.lg }}>
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

            <div style={{ marginTop: "auto", paddingTop: SPACE.lg }}>
              <Button
                tone={mode.ready ? "primary" : "ghost"}
                disabled={!mode.ready}
                onClick={() => setPlaying(mode.id)}
              >
                {mode.ready ? "Play" : "Not yet"}
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
