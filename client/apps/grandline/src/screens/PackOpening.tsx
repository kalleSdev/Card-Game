import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PACKS, PRINT_INFO, DUPLICATE_VALUE,
  type PackId, type Pull,
} from "@cg/meta";
import { CARD_SIZE, COLOR, PRINT_COLOR, SPACE, cardSlotHeight, text } from "../design/tokens";
import PrintCard from "../components/PrintCard";
import { Button, Currency, TierPip } from "../components/primitives";
import { cardFace } from "../data/pool";
import "../design/opening.css";

export interface Opened {
  packId: PackId;
  pulls: Pull[];
  isNew: boolean[];
}

/** The print whose name reads as a tier, for labelling a cosmetic. */
function tierPrint(tier: number) {
  return tier >= 6 ? "secret" : tier >= 5 ? "altArt" : tier >= 4 ? "foil" : "base";
}

/** How long to wait before turning the next card. A rare one holds the room. */
function pauseAfter(pull: Pull): number {
  if (pull.tier >= 6) return 1500;
  if (pull.tier >= 5) return 1150;
  if (pull.tier >= 4) return 620;
  return 420;
}

const WIDTH = CARD_SIZE.sm;

export default function PackOpening({
  opened,
  onDone,
}: {
  opened: Opened;
  onDone: () => void;
}) {
  const { pulls, isNew, packId } = opened;
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = shown >= pulls.length;

  // Turns cards one at a time, pausing longer on the ones worth pausing for.
  useEffect(() => {
    if (done) return;
    timer.current = setTimeout(() => setShown(n => n + 1), pauseAfter(pulls[shown]));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [shown, done, pulls]);

  const revealAll = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShown(pulls.length);
  }, [pulls.length]);

  // Anywhere on the stage turns the next card straight away
  const next = useCallback(() => {
    if (done) return;
    if (timer.current) clearTimeout(timer.current);
    setShown(n => Math.min(n + 1, pulls.length));
  }, [done, pulls.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { revealAll(); return; }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (done) onDone();
        else next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, next, onDone, revealAll]);

  const summary = useMemo(() => {
    let fresh = 0;
    let spares = 0;
    let dust = 0;
    let best: Pull | null = null;
    pulls.forEach((pull, i) => {
      if (isNew[i]) fresh++;
      else if (pull.kind === "card") {
        spares++;
        dust += DUPLICATE_VALUE[pull.print].stardust;
      }
      if (!best || pull.tier > best.tier) best = pull;
    });
    return { fresh, spares, dust, best: best as Pull | null };
  }, [pulls, isNew]);

  return (
    <div className="po">
      <div className="po__head">
        <div>
          <div style={{ ...text("label"), color: COLOR.current }}>Opening</div>
          <div style={{ ...text("heading"), marginTop: 4 }}>{PACKS[packId].name}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: SPACE.sm }}>
          {!done && <Button size="sm" tone="ghost" onClick={revealAll}>Reveal all</Button>}
          {done && <Button size="sm" tone="primary" onClick={onDone}>Done</Button>}
        </div>
      </div>

      <div
        className="po__stage"
        onClick={next}
        style={{ cursor: done ? "default" : "pointer" }}
      >
        <div className="po__row">
          {pulls.map((pull, i) => (
            <div key={i} style={{ width: WIDTH }}>
              <Slot
                pull={pull}
                revealed={i < shown}
                isNew={isNew[i]}
              />
            </div>
          ))}
        </div>

        {!done ? (
          <div style={{ ...text("small"), color: COLOR.fathom }}>
            {shown} of {pulls.length} · click anywhere to keep going
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.xl, flexWrap: "wrap", justifyContent: "center" }}>
            <Tally label="New" value={summary.fresh} color={COLOR.kelp} />
            <Tally label="Duplicates" value={summary.spares} color={COLOR.mist} />
            {summary.dust > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <span style={{ ...text("label"), color: COLOR.fathom }}>Spares worth</span>
                <Currency kind="stardust" amount={summary.dust} />
              </div>
            )}
            {summary.best && summary.best.tier >= 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <span style={{ ...text("label"), color: COLOR.fathom }}>Best pull</span>
                <span style={{ ...text("data"), fontSize: 15, color: summary.best.kind === "card" ? PRINT_COLOR[summary.best.print] : COLOR.doubloon }}>
                  {summary.best.kind === "card" ? PRINT_INFO[summary.best.print].name : summary.best.category}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
      <span style={{ ...text("label"), color: COLOR.fathom }}>{label}</span>
      <span style={{ ...text("data"), fontSize: 19, color }}>{value}</span>
    </div>
  );
}

function Slot({ pull, revealed, isNew }: { pull: Pull; revealed: boolean; isNew: boolean }) {
  const height = cardSlotHeight(WIDTH);
  const classes = [
    "po__slot",
    revealed ? "po__slot--revealed" : "po__slot--down",
    pull.tier >= 6 ? "po__slot--tier6" : pull.tier >= 5 ? "po__slot--tier5" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <div className={classes} style={{ height, position: "relative" }}>
        <div className="po__burst" />

        <div className="po__face po__face--front" style={{ height: "100%", display: "flex", alignItems: "flex-end" }}>
          {pull.kind === "card" ? (
            <PrintCard
              card={cardFace(pull.cardId)}
              print={pull.print}
              width={WIDTH}
              duplicate={!isNew}
              interactive={false}
            />
          ) : (
            <div className="po__cosmetic" style={{ height: WIDTH * 1.4 }}>
              <TierPip tier={pull.tier} />
              <span style={{ ...text("small"), fontSize: 12 }}>{pull.category}</span>
              <span style={{ ...text("label"), fontSize: 8, color: COLOR.fathom }}>Cosmetic</span>
            </div>
          )}
        </div>

        <div className="po__face po__face--back">
          <CardBack />
        </div>
      </div>

      {/* New and +1 only mean something for a card. A cosmetic is not held in
          copies, so it says what it is instead. */}
      <div
        className="po__tag"
        style={{
          opacity: revealed ? 1 : 0,
          color: pull.kind === "cosmetic" ? COLOR.mist : isNew ? COLOR.kelp : COLOR.fathom,
          transition: "opacity 300ms ease 180ms",
        }}
      >
        {pull.kind === "cosmetic" ? PRINT_INFO[tierPrint(pull.tier)].name : isNew ? "New" : "+1"}
      </div>
    </>
  );
}

/** The back of a card: a compass rose on the hull, drawn rather than loaded. */
function CardBack() {
  return (
    <div className="po__back">
      <svg className="po__rose" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="34" fill="none" stroke="#3E8FA0" strokeWidth="1" opacity="0.7" />
        <circle cx="50" cy="50" r="26" fill="none" stroke="#3E8FA0" strokeWidth="0.5" opacity="0.5" />
        <path d="M50 6 L57 43 L50 50 L43 43 Z" fill="#D6412F" opacity="0.85" />
        <path d="M50 94 L43 57 L50 50 L57 57 Z" fill="#F2ECDF" opacity="0.5" />
        <path d="M6 50 L43 43 L50 50 L43 57 Z" fill="#F2ECDF" opacity="0.3" />
        <path d="M94 50 L57 57 L50 50 L57 43 Z" fill="#F2ECDF" opacity="0.3" />
        <circle cx="50" cy="50" r="2.4" fill="#E0A93B" />
      </svg>
    </div>
  );
}
