import { useMemo, useState } from "react";
import {
  COSMETICS, PROFILE_ICONS, PRINTS,
  bestPrintOf, binderOrder, countOf, statsFor,
  type CosmeticKind, type PrintId, type RankId,
} from "@cg/meta";
import { CARD_SIZE, COLOR, RADIUS, SPACE, cardSlotHeight, text } from "../design/tokens";
import PrintCard from "../components/PrintCard";
import Inspect from "../components/Inspect";
import ProfileIcon, { iconName } from "../components/ProfileIcon";
import { Banner, BorderRing, CosmeticTile, Title, cosmeticOf } from "../components/cosmetics";
import { Button, Panel, RankBadge, SectionHead, Text } from "../components/primitives";
import { POOL, cardFace, cardName } from "../data/pool";
import type { Store } from "../data/store";

const SHOWCASE_SLOTS = 5;
const ICON_SIZE = 88;

type Tab = CosmeticKind | "icon" | "showcase";
const TABS: Tab[] = ["icon", "title", "banner", "border", "showcase"];

export default function ProfileScreen({ store, onSignIn }: { store: Store; onSignIn: () => void }) {
  const [tab, setTab] = useState<Tab>("icon");
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
        <SectionHead eyebrow="Profile" title="Your flag" />
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
  const rankId: RankId | null = standing ? ((standing.topRank ?? standing.rank) as RankId) : null;
  const rankLabel = standing
    ? standing.topRank === "pirateKing" ? "Pirate King"
      : standing.topRank === "emperor" ? "Emperor"
      : standing.rankName
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
      <SectionHead
        eyebrow="Profile"
        title="Your flag"
        right={
          <span style={{ ...text("small"), color: COLOR.fathom }}>
            What everyone else sees on the ladder
          </span>
        }
      />

      {/* ── The card everyone else sees ── */}
      <Panel padding={0} style={{ overflow: "hidden" }}>
        <Banner id={profile.bannerId} height={128} radius={0} />

        <div style={{ padding: `0 ${SPACE.xl}px ${SPACE.xl}px` }}>
          {/* Only the icon laps over the banner. Lifting the whole row would
              take the name up with it and clip it against the banner edge. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: SPACE.xl, flexWrap: "wrap" }}>
            <div style={{ marginTop: -(ICON_SIZE / 2), marginBottom: SPACE.sm }}>
              <BorderRing id={profile.borderId} size={ICON_SIZE}>
                <div
                  style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: COLOR.hull,
                  }}
                >
                <ProfileIcon id={profile.iconId} size={ICON_SIZE - 26} />
                </div>
              </BorderRing>
            </div>

            <div style={{ flex: 1, minWidth: 220, paddingBottom: 4 }}>
              <Text as="h2" role="title">{store.account?.username}</Text>
              <div style={{ marginTop: 4, minHeight: 16 }}>
                {profile.titleId
                  ? <Title id={profile.titleId} size={12} />
                  : <span style={{ ...text("label"), fontSize: 10, color: COLOR.fathom }}>No title worn</span>}
              </div>
            </div>

            {rankId && standing && (
              <div style={{ paddingBottom: 4 }}>
                <RankBadge rank={rankId} label={rankLabel} mmr={standing.mmr} />
              </div>
            )}
          </div>

          {/* One row of numbers, evenly spaced, rather than a huddle under the name */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
              gap: SPACE.lg,
              marginTop: SPACE.xl,
              paddingTop: SPACE.lg,
              borderTop: `1px solid ${COLOR.rope}`,
            }}
          >
            <Figure label="Record" value={standing ? `${standing.wins}W ${standing.losses}L` : "—"} />
            <Figure label="Peak MMR" value={standing ? standing.peakMmr : "—"} color={COLOR.mist} />
            <Figure
              label="Best streak"
              value={standing ? standing.bestStreak : "—"}
              color={standing && standing.bestStreak > 1 ? COLOR.kelp : COLOR.mist}
            />
            <Figure label="Collection" value={`${Math.round(stats.completion * 100)}%`} />
            <Figure label="Cosmetics" value={`${owned.size} / ${COSMETICS.length}`} color={COLOR.mist} />
          </div>
        </div>
      </Panel>

      {/* ── Showcase ── */}
      <section>
        <h3 style={{ ...text("label"), color: COLOR.fathom, marginBottom: SPACE.md }}>
          Showcase · {profile.showcase.length} of {SHOWCASE_SLOTS}
        </h3>
        <Panel padding={SPACE.lg}>
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
        </Panel>
      </section>

      {/* ── The wardrobe ── */}
      <section>
        <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap", marginBottom: SPACE.lg }}>
          {TABS.map(id => (
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

        {tab === "icon" ? (
          <Panel padding={SPACE.xl}>
            <Note>
              Placeholders for now. Icons become cosmetics of their own once there is art for them,
              so everybody picks from the same set until then.
            </Note>
            <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
              {PROFILE_ICONS.map(icon => {
                const chosen = profile.iconId === icon.id;
                return (
                  <button
                    key={icon.id}
                    onClick={() => set({ iconId: chosen ? null : icon.id })}
                    style={{
                      width: 96,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      padding: `${SPACE.md}px 6px`,
                      borderRadius: RADIUS.md,
                      border: `1px solid ${chosen ? COLOR.current : COLOR.rope}`,
                      background: chosen ? "rgba(62,143,160,0.1)" : COLOR.hull,
                      color: COLOR.foam,
                    }}
                  >
                    <ProfileIcon id={icon.id} size={40} color={chosen ? COLOR.foam : COLOR.mist} />
                    <span style={{ ...text("small"), fontSize: 11, color: chosen ? COLOR.foam : COLOR.mist }}>
                      {icon.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>
        ) : tab === "showcase" ? (
          <Panel padding={SPACE.xl}>
            <Note>
              Up to {SHOWCASE_SLOTS} cards, shown on your profile in the best print you hold of each.
            </Note>
            {ownedCards.length === 0 ? (
              <Empty />
            ) : (
              <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
                {ownedCards.map(cardId => {
                  const heldPrints = PRINTS.filter(p => countOf(collection, cardId, p) > 0);
                  const best = heldPrints[heldPrints.length - 1];
                  const chosen = profile.showcase.includes(cardId);
                  return (
                    <div
                      key={cardId}
                      style={{ outline: chosen ? `2px solid ${COLOR.current}` : "none", outlineOffset: 3, borderRadius: 10 }}
                    >
                      <PrintCard
                        card={cardFace(cardId)}
                        print={best}
                        width={CARD_SIZE.sm}
                        onClick={() => set({
                          showcase: chosen
                            ? profile.showcase.filter(id => id !== cardId)
                            : [...profile.showcase, cardId].slice(0, SHOWCASE_SLOTS),
                        })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        ) : (
          <Panel padding={SPACE.xl}>
            <Note>
              {owned.size === 0
                ? "Cosmetics come out of cosmetic packs, which a win pays. Nothing here is for sale on its own."
                : `You own ${owned.size} of ${COSMETICS.length}. Anything greyed out has not turned up yet.`}
            </Note>
            <div style={{ display: "flex", gap: SPACE.md, flexWrap: "wrap" }}>
              {COSMETICS.filter(c => c.kind === tab).map(def => {
                const current =
                  tab === "title" ? profile.titleId
                    : tab === "banner" ? profile.bannerId
                    : profile.borderId;
                return (
                  <CosmeticTile
                    key={def.id}
                    def={def}
                    owned={owned.has(def.id)}
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

function Figure({ label, value, color = COLOR.foam }: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom }}>{label}</span>
      <span style={{ ...text("data"), fontSize: 15, color }}>{value}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ ...text("small"), color: COLOR.mist, marginBottom: SPACE.lg, maxWidth: 560 }}>
      {children}
    </p>
  );
}

function Empty() {
  return (
    <span style={{ ...text("small"), color: COLOR.fathom }}>
      Open a pack first: there is nothing to choose from yet.
    </span>
  );
}

/** Used on the ladder, so a row looks like the person on it. */
export function ProfileChip({
  username, profile, size = 30,
}: {
  username: string;
  profile: { iconId: string | null; borderId: string | null; titleId: string | null };
  size?: number;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: SPACE.md, minWidth: 0 }}>
      <BorderRing id={profile.borderId} size={size}>
        <div
          style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: COLOR.hull,
          }}
        >
          <ProfileIcon id={profile.iconId} size={size - 10} color={COLOR.mist} />
        </div>
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

export { cosmeticOf, iconName };
