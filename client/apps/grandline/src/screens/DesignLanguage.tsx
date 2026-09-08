import { useState } from "react";
import {
  PRINTS, PRINT_INFO, PACKS, STANDARD_RATES, DIAMOND_RATES,
  effectiveRate, DUPLICATE_VALUE, RANKS, craftCost,
  type PackId, type PrintId,
} from "@cg/meta";
import { COLOR, PRINT_COLOR, RADIUS, SPACE, TEXT, text } from "../design/tokens";
import PrintCard, { type CardFace } from "../components/PrintCard";
import {
  Button, Chip, Currency, Divider, Panel, RankBadge, SectionHead, Stat, Text, TierPip,
} from "../components/primitives";

/** Packs a match hands out for free, on top of being buyable. */
const EARNED = new Set<PackId>(["goldCard", "goldCosmetic", "silverCard"]);

const DEMO: CardFace = { id: "monkey-d-luffy", name: "Monkey D. Luffy", atk: 6, hp: 7, cost: 5 };

const BINDER: { card: CardFace; print: PrintId; count: number }[] = [
  { card: DEMO, print: "altArt", count: 3 },
  { card: { id: "roronoa-zoro", name: "Roronoa Zoro", atk: 7, hp: 5, cost: 5 }, print: "foil", count: 8 },
  { card: { id: "nami", name: "Nami", atk: 2, hp: 4, cost: 2 }, print: "base", count: 12 },
  { card: { id: "nico-robin", name: "Nico Robin", atk: 4, hp: 4, cost: 3 }, print: "blackLabel", count: 1 },
];

export default function DesignLanguage() {
  const [tone, setTone] = useState<"standard" | "diamond">("standard");
  const rates = tone === "standard" ? STANDARD_RATES : DIAMOND_RATES;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xxxl }}>
      {/* ── Opening ── */}
      <header>
        <div style={{ ...text("label"), color: COLOR.current, marginBottom: SPACE.md }}>
          Design language · draft one
        </div>
        <h1
          style={{
            ...text("display"),
            maxWidth: 760,
            marginBottom: SPACE.lg,
          }}
        >
          A sea chart drawn in ink
        </h1>
        <p style={{ ...text("body"), color: COLOR.mist, maxWidth: 620 }}>
          Deep blue-black grounds, warm paper whites, and one signal red doing all the shouting.
          Gold is reserved for value and never spent on decoration. Everything on this page is built
          from the tokens in <code style={{ ...text("data"), fontSize: 13, color: COLOR.current }}>design/tokens.ts</code>,
          so nothing later can be freestyled without changing the system first.
        </p>
      </header>

      {/* ── Palette ── */}
      <section>
        <SectionHead eyebrow="01" title="Palette" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: SPACE.md }}>
          {(
            [
              ["Abyss", COLOR.abyss, "the page"],
              ["Hull", COLOR.hull, "panels"],
              ["Deck", COLOR.deck, "raised"],
              ["Rope", COLOR.rope, "hairlines"],
              ["Foam", COLOR.foam, "text"],
              ["Mist", COLOR.mist, "secondary"],
              ["Fathom", COLOR.fathom, "labels"],
              ["Signal", COLOR.signal, "identity"],
              ["Doubloon", COLOR.doubloon, "value"],
              ["Current", COLOR.current, "interactive"],
              ["Marine", COLOR.marine, "foil"],
              ["Kelp", COLOR.kelp, "positive"],
            ] as const
          ).map(([name, hex, use]) => (
            <div key={name} style={{ border: `1px solid ${COLOR.rope}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
              <div style={{ height: 52, background: hex }} />
              <div style={{ padding: `${SPACE.sm}px ${SPACE.md}px` }}>
                <div style={{ ...text("small"), fontWeight: 600 }}>{name}</div>
                <div style={{ ...text("data"), fontSize: 11, color: COLOR.fathom }}>{hex}</div>
                <div style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>{use}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Type ── */}
      <section>
        <SectionHead eyebrow="02" title="Type" />
        <Panel>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
            {(Object.keys(TEXT) as (keyof typeof TEXT)[]).map(role => (
              <div key={role} style={{ display: "flex", gap: SPACE.xl, alignItems: "baseline" }}>
                <div style={{ ...text("label"), color: COLOR.fathom, width: 92, flex: "none" }}>{role}</div>
                <div style={{ ...text(role), flex: 1 }}>
                  {role === "display" || role === "title"
                    ? "The Grand Line"
                    : role === "label"
                      ? "Pack contents"
                      : role === "data"
                        ? "1,240 · 4.7% · ×12"
                        : "A crew is only as good as the cards it draws."}
                </div>
                <div style={{ ...text("data"), fontSize: 11, color: COLOR.fathom, flex: "none" }}>
                  {TEXT[role].size}px
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <p style={{ ...text("small"), color: COLOR.fathom, marginTop: SPACE.md, maxWidth: 640 }}>
          Fraunces for anything named, Archivo for anything read or clicked, IBM Plex Mono for
          anything counted. Uppercase tracking is for labels only — never a sentence, which is where
          the old client went wrong.
        </p>
      </section>

      {/* ── Prints: the centrepiece ── */}
      <section>
        <SectionHead
          eyebrow="03"
          title="Six prints, one card"
          right={
            <div style={{ display: "flex", gap: SPACE.sm }}>
              <Button tone={tone === "standard" ? "secondary" : "ghost"} size="sm" onClick={() => setTone("standard")}>
                Silver / Gold odds
              </Button>
              <Button tone={tone === "diamond" ? "secondary" : "ghost"} size="sm" onClick={() => setTone("diamond")}>
                Diamond odds
              </Button>
            </div>
          }
        />
        <p style={{ ...text("body"), color: COLOR.mist, maxWidth: 620, marginBottom: SPACE.xl }}>
          Identical stats, six treatments. Each one changes the card's shape or colour rather than
          just its trim, so it reads from across the table. Art is placeholder — the treatments are
          real.
        </p>

        <div style={{ display: "flex", gap: SPACE.xl, flexWrap: "wrap" }}>
          {PRINTS.map(print => (
            <div key={print} style={{ display: "flex", flexDirection: "column", gap: SPACE.md, width: 168 }}>
              {/* Prints differ in height on purpose, so the slot is fixed and the
                  cards hang from a common baseline. Otherwise the captions stagger. */}
              <div style={{ height: 232, display: "flex", alignItems: "flex-end" }}>
                <PrintCard card={DEMO} print={print} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <TierPip tier={PRINT_INFO[print].tier} />
                  <span style={{ ...text("small"), fontWeight: 600, color: PRINT_COLOR[print] }}>
                    {PRINT_INFO[print].name}
                  </span>
                </div>
                <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
                  {effectiveRate(print, rates).toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Packs ── */}
      <section>
        <SectionHead eyebrow="04" title="Packs" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: SPACE.lg }}>
          {(Object.keys(PACKS) as PackId[]).map(id => {
            const pack = PACKS[id];
            const isDiamond = id.startsWith("diamond");
            const accent = isDiamond ? COLOR.current : id.startsWith("gold") ? COLOR.doubloon : COLOR.mist;
            return (
              <Panel key={id} padding={SPACE.lg} style={{ borderColor: isDiamond ? "rgba(62,143,160,0.4)" : COLOR.rope }}>
                <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, height: "100%" }}>
                  <div style={{ width: 34, height: 3, borderRadius: 2, background: accent }} />
                  <Text role="heading">{pack.name}</Text>
                  <div style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
                    {pack.pulls} {pack.contents === "cards" ? "cards" : "cosmetics"}
                  </div>
                  <div style={{
                    marginTop: "auto", paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.rope}`,
                    display: "flex", alignItems: "center", gap: SPACE.md,
                  }}>
                    {pack.price !== null && <Currency kind="berries" amount={pack.price} size="sm" />}
                    {EARNED.has(id) && (
                      <span style={{ ...text("label"), fontSize: 9, color: COLOR.kelp }}>Also earned</span>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      {/* ── Collection row ── */}
      <section>
        <SectionHead eyebrow="05" title="Collection" />
        <Panel padding={SPACE.xl}>
          <div style={{ display: "flex", gap: SPACE.xl, flexWrap: "wrap" }}>
            {BINDER.map(entry => (
              <div key={entry.print} style={{ display: "flex", flexDirection: "column", gap: SPACE.md, width: 150 }}>
                <PrintCard card={entry.card} print={entry.print} width={150} count={entry.count} />
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" tone="ghost">Dust</Button>
                  <Button size="sm" tone="ghost">Sell</Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ ...text("small"), fontSize: 12, color: COLOR.fathom }}>
                    {entry.count - 1} spare{entry.count - 1 === 1 ? "" : "s"}
                  </span>
                  <Currency kind="stardust" amount={DUPLICATE_VALUE[entry.print].stardust * (entry.count - 1)} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* ── Controls ── */}
      <section>
        <SectionHead eyebrow="06" title="Controls" />
        <Panel>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
            <div style={{ display: "flex", gap: SPACE.md, alignItems: "center", flexWrap: "wrap" }}>
              <Button tone="primary">Open pack</Button>
              <Button tone="secondary">Build a deck</Button>
              <Button tone="ghost">Cancel</Button>
              <Button tone="danger">Surrender</Button>
              <Button tone="primary" disabled>Not enough Berries</Button>
            </div>

            <Divider />

            <div style={{ display: "flex", gap: SPACE.md, alignItems: "center", flexWrap: "wrap" }}>
              <Chip color={COLOR.kelp} border="rgba(63,164,107,0.4)">New</Chip>
              <Chip color={COLOR.mist}>Duplicate</Chip>
              <Chip color={COLOR.doubloon} border="rgba(224,169,59,0.4)">
                <TierPip tier={5} size={6} /> Alt art
              </Chip>
              <Chip color={COLOR.signal} border="rgba(214,65,47,0.4)">
                <TierPip tier={6} size={6} /> Secret
              </Chip>
              <Currency kind="berries" amount={1240} />
              <Currency kind="stardust" amount={860} />
            </div>

            <Divider />

            <div style={{ display: "flex", gap: SPACE.xxl, flexWrap: "wrap" }}>
              <Stat label="Matches" value="184" />
              <Stat label="Win rate" value="57%" color={COLOR.kelp} />
              <Stat label="Prints owned" value="212 / 408" />
              <Stat label="To next craft" value={`${craftCost("altArt")} dust`} color={COLOR.marine} />
            </div>
          </div>
        </Panel>
      </section>

      {/* ── Ladder ── */}
      <section>
        <SectionHead eyebrow="07" title="Ladder" />
        <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap", alignItems: "center" }}>
          {RANKS.map(rank => (
            <RankBadge key={rank.id} rank={rank.id} label={rank.name} mmr={rank.floor} />
          ))}
          <RankBadge rank="emperor" label="Emperor" />
          <RankBadge rank="pirateKing" label="Pirate King" />
        </div>
        <p style={{ ...text("small"), color: COLOR.fathom, marginTop: SPACE.lg, maxWidth: 640 }}>
          The eight threshold ranks are outlines. Emperor and Pirate King fill in, because they are
          the two nobody can reach by grinding.
        </p>
      </section>

      {/* ── Pack opening preview ── */}
      <section>
        <SectionHead eyebrow="08" title="A pack, opened" />
        <Panel padding={SPACE.xxl} lifted>
          <div style={{ display: "flex", gap: SPACE.lg, flexWrap: "wrap", justifyContent: "center" }}>
            {(
              [
                { print: "secret" as PrintId, dupe: false, tag: "New" },
                { print: "base" as PrintId, dupe: true, tag: "+1" },
                { print: "blackLabel" as PrintId, dupe: false, tag: "New" },
                { print: "base" as PrintId, dupe: true, tag: "+1" },
                { print: "foil" as PrintId, dupe: true, tag: "+1" },
              ]
            ).map((pull, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, alignItems: "center" }}>
                <PrintCard
                  card={i % 2 === 0 ? DEMO : BINDER[1].card}
                  print={pull.print}
                  width={140}
                  duplicate={pull.dupe}
                />
                <span
                  style={{
                    ...text("label"),
                    fontSize: 10,
                    color: pull.dupe ? COLOR.fathom : COLOR.kelp,
                  }}
                >
                  {pull.tag}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <p style={{ ...text("small"), color: COLOR.fathom, marginTop: SPACE.md, maxWidth: 640 }}>
          Duplicates dim back so the eye lands on what is new. The reveal animation is the one place
          in the app allowed to take its time.
        </p>
      </section>
    </div>
  );
}
