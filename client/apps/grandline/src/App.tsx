import { useState } from "react";
import Shell from "./components/Shell";
import DesignLanguage from "./screens/DesignLanguage";
import CollectionScreen from "./screens/Collection";
import DecksScreen from "./screens/Decks";
import ShopScreen, { PacksScreen } from "./screens/Shop";
import LadderScreen from "./screens/Ladder";
import SignIn from "./screens/SignIn";
import { useStore } from "./data/store";
import { COLOR, SPACE, text } from "./design/tokens";
import { Panel, Text } from "./components/primitives";

export default function App() {
  const [page, setPage] = useState("collection");
  const store = useStore();

  if (store.loading) return <Loading />;

  // Signing in is a page like any other rather than a wall in front of the app.
  // Everything can be looked at without an account; nothing can be spent.
  if (page === "signin") {
    return <SignIn store={store} onBack={() => setPage("collection")} />;
  }

  const goSignIn = () => setPage("signin");

  return (
    <Shell
      active={page}
      onNavigate={setPage}
      wallet={store.wallet}
      username={store.account?.username ?? null}
      standing={store.standing}
      packsWaiting={store.packs.length}
      onSignOut={() => void store.signOut()}
      onSignIn={goSignIn}
    >
      {page === "collection" ? <CollectionScreen store={store} />
        : page === "decks" ? <DecksScreen store={store} onSignIn={goSignIn} />
        : page === "shop" ? <ShopScreen store={store} onSignIn={goSignIn} />
        : page === "packs" ? <PacksScreen store={store} onSignIn={goSignIn} />
        : page === "ladder" ? <LadderScreen store={store} />
        : page === "design" ? <DesignLanguage />
        : <NotBuiltYet id={page} />}
    </Shell>
  );
}

function Loading() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      ...text("label"), color: COLOR.fathom,
    }}>
      Loading
    </div>
  );
}

/** Honest placeholder. Better than a half screen that pretends to work. */
function NotBuiltYet({ id }: { id: string }) {
  return (
    <Panel padding={SPACE.xxxl}>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, alignItems: "flex-start" }}>
        <div style={{ ...text("label"), color: COLOR.current }}>Not built yet</div>
        <Text as="h2" role="title">
          {id.charAt(0).toUpperCase() + id.slice(1)}
        </Text>
        <p style={{ ...text("body"), color: COLOR.mist, maxWidth: 520 }}>
          The rules behind this screen are written and tested. The screen itself comes in build
          order, on the design language rather than ahead of it.
        </p>
      </div>
    </Panel>
  );
}
