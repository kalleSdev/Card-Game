import { useMemo, useState } from "react";
import {
  COSMETICS, PRINTS, PRINT_INFO,
  bestPrintOf, binderOrder, countOf, statsFor,
  type CosmeticKind, type PrintId, type RankId,
} from "@cg/meta";
import { CARD_SIZE, COLOR, RADIUS, SPACE, cardSlotHeight, text } from "../design/tokens";
import PrintCard from "../components/PrintCard";
import Inspect from "../components/Inspect";
import { Banner, BorderRing, CosmeticTile, Title, cosmeticOf } from "../components/cosmetics";
import { Button, Panel, RankBadge, SectionHead, Stat, Text } from "../components/primitives";
import { POOL, cardFace, cardName } from "../data/pool";
import type { Store } from "../data/store";

const SHOWCASE_SLOTS = 5;

export default function ProfileScreen({ store, onSignIn }: { store: Store; onSignIn: () => void }) {
  const [tab, setTab] = useState<CosmeticKind | "icon" | "showcase">("icon");
  const [inspecting, setInspecting] = useState<{ cardId: string; print: PrintId } | null>(null);

  const { profile, collection, standing } = store;
  const owned = useMemo(() => new Set(store.cosmetics), [store.cosmetics]);
  const stats = useMemo(() => statsFor(collection, POOL), [collection]);
  const ownedCards = useMemo(
    () => binderOrder(collection, POOL, cardName).filter(id => bestPrintOf(collection, id) !== null),
    [collection],
  );

  if (!store.signedIn) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
        <SectionHead eyebrow="Profile" title="Your face" />
        <Panel padding={SPACE.lg} style={{ borderColor: "rgba(62,143,160,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexWrap: "wrap" }}>
            <span style={{ ...text("body"), color: COLOR.mist }}>
              You are looking around without an account. Log in to have a profile.
            </span>
            <div style={{ marginLeft: "auto" }}>
              <Button size="sm" tone="primary" onClick={onSignIn}>Log in</Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const set = (patch: Partial<typeof profile>) => store.saveProfile({ ...profile, ...patch });

  const iconPrint = profile.iconCard && profile.iconPrint ? (profile.iconPrint as PrintId) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead eyebrow="Profile" title="Your face" />

      {/* ── What everyone else sees ── */}
      <Panel padding={0}>
        <Banner id={profile.bannerId} height={112} radius={RADIUS.lg}>
          <div />
        </Banner>
        <div style={{ padding: SPACE.xl, display: "flex", gap: SPACE.xl, alignItems: "flex-start", marginTop: -46 }}>
          <BorderRing id={profile.borderId} size={84}>
            {profile.iconCard && iconPrint ? (
              <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
                <div style={{ transform: "scale(0.5)", transformOrigin: "top left", width: 160 }}>
                  <PrintCard
                    card={cardFace(profile.iconCard)}
                    print={iconPrint}
                    width={160}
                    interactive={false}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  ...text("label"), fontSize: 9, color: COLOR.fathom, textAlign: "center",
                }}
              >
                No icon
              </div>
            )}
          </BorderRing>

          <div style={{ flex: 1, minWidth: 0, paddingTop: SPACE.xxl }}>
            <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, flexWrap: "wrap" }}>
              <Text as="h2" role="title">{store.account?.username}</Text>
              <Title id={profile.titleId} size={12} />
            </div>
            <div style={{ display: "flex", gap: SPACE.xl, marginTop: SPACE.lg, flexWrap: "wrap" }}>
              {standing && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ ...text("label"), color: COLOR.fathom }}>Rank</span>
                    <RankBadge
                      rank={(standing.topRank ?? standing.rank) as RankId}
                      label={
                        standing.topRank === "pirateKing" ? "Pirate King"
                          : standing.topRank === "emperor" ? "Emperor"
                          : standing.rankName
                      }
                      mmr={standing.mmr}
                    />
                  </div>
                  <Stat label="Record" value={`${standing.wins}W ${standing.losses}L`} />
                  <Stat label="Peak" value={standing.peakMmr} color={COLOR.mist} />
                  <Stat label="Best streak" value={standing.bestStreak} color={COLOR.kelp} />
                </>
              )}
              <Stat label="Collection" value={`${Math.round(stats.completion * 100)}%`} />
            </div>
          </div>
        </div>

        {/* Showcase */}
        <div style={{ padding: `0 ${SPACE.xl}px ${SPACE.xl}px` }}>
          <h3 style={{ ...text("label"), color: COLOR.fathom, marginBottom: SPACE.md }}>Showcase</h3>
          <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
            {Array.from({ length: SHOWCASE_SLOTS }, (_, i) => {
              const cardId = profile.showcase[i];
              const print = cardId ? bestPrintOf(collection, cardId) : null;
              if (!cardId || !print) {
                return (
                  <div
                    key={i}
                    style={{
                      width: CARD_SIZE.sm,
                      height: cardSlotHeight(CARD_SIZE.sm),
                      borderRadius: RADIUS.lg,
                      border: `1px dashed ${COLOR.rope}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      ...text("label"), fontSize: 9, color: COLOR.fathom,
                    }}
                  >
                    Empty
                  </div>
                );
              }
              return (
                <div key={i} style={{ height: cardSlotHeight(CARD_SIZE.sm), display: "flex", alignItems: "flex-end" }}>
                  <PrintCard
                    card={cardFace(cardId)}
                    print={print}
                    width={CARD_SIZE.sm}
                    onClick={() => setInspecting({ cardId, print })}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* ── The wardrobe ── */}
      <section>
        <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap", marginBottom: SPACE.lg }}>
          {(["icon", "title", "banner", "border", "showcase"] as const).map(id => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                ...text("label"),
                padding: "6px 13px",
                borderRadius: RADIUS.sm,
                border: `1px solid ${tab === id ? COLOR.current : COLOR.rope}`,
                background: tab === id ? "rgba(62,143,160,0.12)" : "transparent",
                color: tab === id ? COLOR.foam : COLOR.mist,
              }}
            >
              {id}
            </button>
          ))}
        </div>

        {tab === "icon" || tab === "showcase" ? (
          <Panel padding={SPACE.xl}>
            <p style={{ ...text("small"), color: COLOR.mist, marginBottom: SPACE.lg, maxWidth: 560 }}>
              {tab === "icon"
                ? "Any card you own, in any print you hold of it. A Holo One you pulled can be your face whether or not you play it."
                : `Up to ${SHOWCASE_SLOTS} cards, shown on your profile and next to your name on the ladder.`}
            </p>
            {ownedCards.length === 0 ? (
              <span style={{ ...text("small"), color: COLOR.fathom }}>
                Open a pack first: there is nothing to choose from yet.
              </span>
            ) : (
              <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
                {ownedCards.map(cardId => {
                  const heldPrints = PRINTS.filter(p => countOf(collection, cardId, p) > 0);
                  const best = heldPrints[heldPrints.length - 1];
                  const chosen = tab === "icon"
                    ? profile.iconCard === cardId
                    : profile.showcase.includes(cardId);
                  return (
                    <div
                      key={cardId}
                      style={{ outline: chosen ? `2px solid ${COLOR.current}` : "none", outlineOffset: 3, borderRadius: 10 }}
                    >
                      <PrintCard
                        card={cardFace(cardId)}
                        print={best}
                        width={CARD_SIZE.sm}
                        onClick={() => {
                          if (tab === "icon") {
                            set(chosen
                              ? { iconCard: null, iconPrint: null }
                              : { iconCard: cardId, iconPrint: best });
                          } else {
                            const next = chosen
                              ? profile.showcase.filter(id => id !== cardId)
                              : [...profile.showcase, cardId].slice(0, SHOWCASE_SLOTS);
                            set({ showcase: next });
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        ) : (
          <Panel padding={SPACE.xl}>
            <p style={{ ...text("small"), color: COLOR.mist, marginBottom: SPACE.lg, maxWidth: 560 }}>
              {owned.size === 0
                ? "Cosmetics come out of cosmetic packs, which a win pays. Nothing here is for sale on its own."
                : `You own ${owned.size} of ${COSMETICS.length}. Anything greyed out has not turned up yet.`}
            </p>
            <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
              {COSMETICS.filter(c => c.kind === tab).map(def => {
                const isOwned = owned.has(def.id);
                const current =
                  tab === "title" ? profile.titleId
                    : tab === "banner" ? profile.bannerId
                    : profile.borderId;
                return (
                  <CosmeticTile
                    key={def.id}
                    def={def}
                    owned={isOwned}
                    selected={current === def.id}
                    onClick={() => {
                      const value = current === def.id ? null : def.id;
                      set(
                        tab === "title" ? { titleId: value }
                          : tab === "banner" ? { bannerId: value }
                          : { borderId: value },
                      );
                    }}
                  />
                );
              })}
            </div>
          </Panel>
        )}
      </section>

      {inspecting && (
        <Inspect
          card={cardFace(inspecting.cardId)}
          print={inspecting.print}
          count={countOf(collection, inspecting.cardId, inspecting.print)}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}

/** Used on the ladder, so a row looks like the person on it. */
export function ProfileChip({
  username, profile, size = 30,
}: {
  username: string;
  profile: { iconCard: string | null; iconPrint: string | null; borderId: string | null; titleId: string | null };
  size?: number;
}) {
  const print = profile.iconCard && profile.iconPrint ? (profile.iconPrint as PrintId) : null;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: SPACE.md, minWidth: 0 }}>
      <BorderRing id={profile.borderId} size={size}>
        {profile.iconCard && print ? (
          <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
            <div style={{ transform: `scale(${size / 160})`, transformOrigin: "top left", width: 160 }}>
              <PrintCard card={cardFace(profile.iconCard)} print={print} width={160} interactive={false} />
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", height: "100%", background: COLOR.deck }} />
        )}
      </BorderRing>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ ...text("body"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {username}
        </span>
        {profile.titleId && <Title id={profile.titleId} size={9} />}
      </span>
    </span>
  );
}

/** The print label, for anywhere a cosmetic needs naming next to a card. */
export function printName(print: PrintId): string {
  return PRINT_INFO[print].name;
}

export { cosmeticOf };
