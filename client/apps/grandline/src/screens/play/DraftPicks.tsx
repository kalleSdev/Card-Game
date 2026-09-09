import { useMemo, useState } from "react";
import type { PlayerDraftResult } from "@cg/contracts";
import { CARD_SIZE, COLOR, RADIUS, SPACE, cardSlotHeight, text } from "../../design/tokens";
import { ARENA_RAIL_WIDTH } from "../../design/arena";
import PrintCard from "../../components/PrintCard";
import { Button, Panel, Text } from "../../components/primitives";
import { cardFace } from "../../data/pool";
import {
  DECK_CARDS, LEADER_OPTIONS, PICK_SPECS,
  draftedCards, emptyDraft, everythingTaken, leaderOptions, pickOptions, withPick,
} from "../../data/draft";

/**
 * The draft.
 *
 * A leader first, from three, and then twelve cards three at a time: two
 * combat, three support, and seven of anything. The rules are the old client's
 * — they work, and this pass is about the board rather than the ruleset.
 *
 * The screen is the same frame the boards use: the rail on the left holding
 * everything that is not the game, the choice itself in the middle, and what
 * you have taken so far along the bottom.
 */

const OPTION_CARD = CARD_SIZE.lg;
const TAKEN_CARD = CARD_SIZE.xs;

export default function DraftPicks({ title, onDone, onLeave }: {
  title: string;
  onDone: (draft: PlayerDraftResult) => void;
  onLeave: () => void;
}) {
  const [draft, setDraft] = useState<PlayerDraftResult>(emptyDraft);
  const [leaders] = useState<string[]>(() => leaderOptions());
  const [options, setOptions] = useState<string[]>([]);

  const pickIndex = draftedCards(draft).length;
  const pickingLeader = draft.leaderId === "";
  const spec = PICK_SPECS[pickIndex];

  // The three on offer. Recomputed only when a pick lands, so the choice does
  // not shuffle under the cursor on a re-render.
  const offered = useMemo(
    () => (pickingLeader ? leaders : options),
    [pickingLeader, leaders, options],
  );

  const takeLeader = (id: string) => {
    const next = { ...draft, leaderId: id };
    setDraft(next);
    setOptions(pickOptions(0, everythingTaken(next)));
  };

  const takeCard = (id: string) => {
    const next = withPick(draft, pickIndex, id);
    setDraft(next);
    if (draftedCards(next).length >= DECK_CARDS) onDone(next);
    else setOptions(pickOptions(draftedCards(next).length, everythingTaken(next)));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        overflow: "hidden",
        background: `
          radial-gradient(1100px 620px at 50% -8%, rgba(62,143,160,0.09), transparent 68%),
          ${COLOR.abyss}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.lg,
        padding: SPACE.md,
      }}
    >
      {/* The rail, the same one both boards carry */}
      <div
        style={{
          width: ARENA_RAIL_WIDTH,
          flex: "none",
          alignSelf: "stretch",
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
          padding: `${SPACE.md}px 0`,
        }}
      >
        <Text as="h2" role="title">{title}</Text>
        <span
          style={{
            ...text("label"),
            fontSize: 9,
            color: COLOR.current,
            border: `1px solid ${COLOR.rope}`,
            borderRadius: RADIUS.sm,
            padding: "4px 8px",
            textAlign: "center",
          }}
        >
          {pickingLeader ? "Leader" : `Pick ${pickIndex + 1} / ${DECK_CARDS}`}
        </span>
        <div style={{ marginTop: "auto" }}>
          <Button size="sm" tone="ghost" full onClick={onLeave}>Leave</Button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE.xl }}>
        <div style={{ textAlign: "center" }}>
          <Text as="h3" role="title">
            {pickingLeader ? "Take a leader" : `Take a ${spec?.label.toLowerCase() ?? "card"}`}
          </Text>
          <p style={{ ...text("small"), color: COLOR.mist, marginTop: SPACE.sm, maxWidth: 520 }}>
            {pickingLeader
              ? `One of ${LEADER_OPTIONS}. Your leader stands behind your board and the match ends when it falls.`
              : "Three on offer, one taken. Nothing is offered twice in a draft."}
          </p>
        </div>

        {/* The choice */}
        <div style={{ display: "flex", gap: SPACE.xl }}>
          {offered.map(id => (
            <div key={id} style={{ display: "flex", flexDirection: "column", gap: SPACE.md, alignItems: "center" }}>
              <div style={{ height: cardSlotHeight(OPTION_CARD), display: "flex", alignItems: "flex-end" }}>
                <PrintCard
                  card={cardFace(id)}
                  print="base"
                  width={OPTION_CARD}
                  onClick={() => (pickingLeader ? takeLeader(id) : takeCard(id))}
                />
              </div>
              <Button
                size="sm"
                tone="secondary"
                onClick={() => (pickingLeader ? takeLeader(id) : takeCard(id))}
              >
                Take
              </Button>
            </div>
          ))}
        </div>

        {/* What is already yours */}
        <Panel padding={SPACE.md} style={{ width: 760 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md, marginBottom: SPACE.sm }}>
            <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>Your deck</span>
            <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom, marginLeft: "auto" }}>
              {draftedCards(draft).length} / {DECK_CARDS}
            </span>
          </div>

          <div style={{ display: "flex", gap: SPACE.sm, alignItems: "flex-end", minHeight: cardSlotHeight(TAKEN_CARD) }}>
            {draft.leaderId ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <span style={{ ...text("label"), fontSize: 8, color: COLOR.doubloon }}>Leader</span>
                <PrintCard card={cardFace(draft.leaderId)} print="base" width={TAKEN_CARD} interactive={false} />
              </div>
            ) : (
              <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>
                Nothing taken yet.
              </span>
            )}

            {draftedCards(draft).map(id => (
              <PrintCard key={id} card={cardFace(id)} print="base" width={TAKEN_CARD} interactive={false} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
