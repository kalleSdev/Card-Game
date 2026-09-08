import { useState } from "react";
import {
  PACKS, PRINTS, PRINT_INFO, STANDARD_RATES, DIAMOND_RATES, effectiveRate,
  type PackId,
} from "@cg/meta";
import { COLOR, PRINT_COLOR, SPACE, text } from "../design/tokens";
import { Button, Currency, Panel, SectionHead, Text, TierPip } from "../components/primitives";
import PackOpening, { type Opened } from "./PackOpening";
import type { Store } from "../data/store";

/** Packs a match hands out for free, on top of being buyable. */
const ALSO_EARNED = new Set<PackId>(["goldCard", "goldCosmetic", "silverCard"]);

export default function ShopScreen({ store }: { store: Store }) {
  const [busy, setBusy] = useState<PackId | null>(null);
  const [showOdds, setShowOdds] = useState(false);

  const buy = async (packId: PackId) => {
    setBusy(packId);
    await store.buy(packId);
    setBusy(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Shop"
        title="Packs"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg }}>
            <Currency kind="berries" amount={store.wallet.berries} />
            <Button size="sm" tone="ghost" onClick={() => setShowOdds(v => !v)}>
              {showOdds ? "Hide odds" : "Show odds"}
            </Button>
          </div>
        }
      />

      {store.error && (
        <Panel padding={SPACE.lg} style={{ borderColor: "#7A2A22" }}>
          <span style={{ ...text("small"), color: "#E9857A" }}>{store.error}</span>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: SPACE.lg }}>
        {(Object.keys(PACKS) as PackId[]).map(id => {
          const pack = PACKS[id];
          const diamond = id.startsWith("diamond");
          const accent = diamond ? COLOR.current : id.startsWith("gold") ? COLOR.doubloon : COLOR.mist;
          const affordable = pack.price !== null && store.wallet.berries >= pack.price;
          return (
            <Panel
              key={id}
              padding={SPACE.lg}
              style={{ borderColor: diamond ? "rgba(62,143,160,0.4)" : COLOR.rope }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, height: "100%" }}>
                <div style={{ width: 34, height: 3, borderRadius: 2, background: accent }} />
                <Text role="heading">{pack.name}</Text>
                <div style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
                  {pack.pulls} {pack.contents === "cards" ? "cards" : "cosmetics"}
                  {diamond ? " · better odds" : ""}
                </div>
                {ALSO_EARNED.has(id) && (
                  <span style={{ ...text("label"), fontSize: 9, color: COLOR.kelp }}>
                    Also earned from a match
                  </span>
                )}

                <div style={{ marginTop: "auto", paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.rope}`, display: "flex", alignItems: "center", gap: SPACE.md }}>
                  {pack.price !== null && <Currency kind="berries" amount={pack.price} size="sm" />}
                  <div style={{ marginLeft: "auto" }}>
                    <Button
                      size="sm"
                      tone={affordable ? "primary" : "ghost"}
                      disabled={!affordable || busy !== null}
                      onClick={() => buy(id)}
                    >
                      {busy === id ? "Buying" : affordable ? "Buy" : "Not enough"}
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {showOdds && (
        <Panel padding={SPACE.xl}>
          <Text role="heading" style={{ marginBottom: SPACE.lg }}>Every rate, in full</Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: `${SPACE.sm}px ${SPACE.xl}px`, maxWidth: 480 }}>
            <span style={{ ...text("label"), color: COLOR.fathom }}>Print</span>
            <span style={{ ...text("label"), color: COLOR.fathom, textAlign: "right" }}>Silver / Gold</span>
            <span style={{ ...text("label"), color: COLOR.fathom, textAlign: "right" }}>Diamond</span>
            {[...PRINTS].reverse().map(print => (
              <ExactRate key={print} print={print} />
            ))}
          </div>
          <p style={{ ...text("small"), color: COLOR.fathom, marginTop: SPACE.lg, maxWidth: 560 }}>
            Published in full rather than summarised. Every print plays identically, so none of this
            buys an advantage; it only decides how a card looks on the board.
          </p>
        </Panel>
      )}
    </div>
  );
}

function ExactRate({ print }: { print: (typeof PRINTS)[number] }) {
  return (
    <>
      <span style={{ display: "flex", alignItems: "center", gap: 8, ...text("small") }}>
        <TierPip tier={PRINT_INFO[print].tier} size={7} />
        <span style={{ color: PRINT_COLOR[print], fontWeight: 600 }}>{PRINT_INFO[print].name}</span>
      </span>
      <span style={{ ...text("data"), fontSize: 13, textAlign: "right" }}>
        {effectiveRate(print, STANDARD_RATES)}%
      </span>
      <span style={{ ...text("data"), fontSize: 13, textAlign: "right", color: COLOR.current }}>
        {effectiveRate(print, DIAMOND_RATES)}%
      </span>
    </>
  );
}

/** Unopened packs. Opening one hands off to the reveal. */
export function PacksScreen({ store }: { store: Store }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);

  const open = async (id: string, packId: PackId) => {
    setBusy(id);
    const result = await store.open(id);
    setBusy(null);
    if (result) setOpened({ packId, pulls: result.pulls, isNew: result.isNew });
  };

  if (opened) return <PackOpening opened={opened} onDone={() => setOpened(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Packs"
        title="Unopened"
        right={<span style={{ ...text("data"), fontSize: 15, color: COLOR.mist }}>{store.packs.length}</span>}
      />

      {store.error && (
        <Panel padding={SPACE.lg} style={{ borderColor: "#7A2A22" }}>
          <span style={{ ...text("small"), color: "#E9857A" }}>{store.error}</span>
        </Panel>
      )}

      {store.packs.length === 0 ? (
        <Panel padding={SPACE.xxxl}>
          <Text role="heading">Nothing to open</Text>
          <p style={{ ...text("body"), color: COLOR.mist, marginTop: SPACE.sm, maxWidth: 460 }}>
            Finish a match or buy one in the shop. A win pays a gold card pack and a gold cosmetic
            pack; a loss still pays a silver card pack.
          </p>
        </Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: SPACE.lg }}>
          {store.packs.map(pack => {
            const def = PACKS[pack.packId];
            const accent = pack.packId.startsWith("diamond")
              ? COLOR.current
              : pack.packId.startsWith("gold") ? COLOR.doubloon : COLOR.mist;
            return (
              <Panel key={pack.id} padding={SPACE.lg}>
                <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
                  <div style={{ width: 34, height: 3, borderRadius: 2, background: accent }} />
                  <Text role="heading">{def.name}</Text>
                  <span style={{ ...text("data"), fontSize: 12, color: COLOR.fathom }}>
                    {def.pulls} {def.contents === "cards" ? "cards" : "cosmetics"} · {sourceLabel(pack.source)}
                  </span>
                  <Button
                    tone="primary"
                    disabled={busy !== null}
                    onClick={() => open(pack.id, pack.packId)}
                  >
                    {busy === pack.id ? "Opening" : "Open"}
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function sourceLabel(source: string): string {
  if (source === "matchWin") return "won";
  if (source === "matchLoss") return "consolation";
  return "bought";
}
