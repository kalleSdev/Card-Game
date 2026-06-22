import { useMemo, useState } from "react";
import type { GameState, Intent } from "@cg/contracts";
import { createEngine, createInitialState } from "@cg/engine";
import type { PlayerIcons, PlayerNames } from "./types";

import HomeScreen from "./screens/HomeScreen";
import CardGallery from "./screens/CardGallery";
import SetupScreen from "./screens/SetupScreen";
import BindingVowScreen from "./screens/BindingVowScreen";
import CoinFlipScreen from "./screens/CoinFlipScreen";
import DraftScreen from "./screens/DraftScreen";
import RevealScreen from "./screens/RevealScreen";
import PlacementScreen from "./screens/PlacementScreen";
import AugmentScreen from "./screens/AugmentScreen";
import LockedInScreen from "./screens/LockedInScreen";
import ResolutionScreen from "./screens/ResolutionScreen";

type AppScreen = "HOME" | "SETUP" | "GAME" | "GALLERY";

export default function App() {
  const [appScreen, setAppScreen] = useState<AppScreen>("HOME");
  const [playerNames, setPlayerNames] = useState<PlayerNames>({ P1: "Player 1", P2: "Player 2" });
  const [playerIcons, setPlayerIcons] = useState<PlayerIcons>({ P1: "⚡", P2: "💀" });
  const [key, setKey] = useState(0);
  const engine = useMemo(() => createEngine(createInitialState()), [key]);
  const [state, setState] = useState<GameState>(engine.getState());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  useMemo(() => { setState(engine.getState()); }, [engine]);

  const restart = () => { setKey(k => k + 1); setSelectedCard(null); setAppScreen("SETUP"); };

  const send = (intent: Intent) => {
    const res = engine.applyIntent(intent);
    setState(res.state);
  };

  if (appScreen === "HOME") return <HomeScreen onSelect={() => setAppScreen("SETUP")} onGallery={() => setAppScreen("GALLERY")} />;
  if (appScreen === "GALLERY") return <CardGallery cardDb={state.cardDb} onBack={() => setAppScreen("HOME")} />;

  if (appScreen === "SETUP") {
    return <SetupScreen onStart={(names, icons) => {
      setPlayerNames(names);
      setPlayerIcons(icons);
      setAppScreen("GAME");
    }} />;
  }

  if (state.phase === "BINDING_VOW") {
    return <BindingVowScreen state={state} onSend={send} playerNames={playerNames} playerIcons={playerIcons} />;
  }

  if (state.phase === "DRAFT" && state.draft && !state.draft.coinFlipped) {
    return (
      <div style={{ position: "relative" }}>
        {/* Draft screen rendered underneath, visually blurred */}
        <div style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none" }}>
          <DraftScreen state={state} onSend={() => {}} playerNames={playerNames} playerIcons={playerIcons} />
        </div>
        {/* Coin flip as a translucent overlay */}
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <CoinFlipScreen onFlip={firstPicker => send({ type: "FLIP_COIN", firstPicker })} playerNames={playerNames} playerIcons={playerIcons} />
        </div>
      </div>
    );
  }

  if (state.phase === "DRAFT") {
    return <DraftScreen state={state} onSend={send} playerNames={playerNames} playerIcons={playerIcons} />;
  }

  if (state.phase === "REVEAL") {
    return <RevealScreen state={state} onSend={send} playerNames={playerNames} />;
  }

  if (state.phase === "AUGMENT") {
    return <AugmentScreen state={state} onSend={send} playerNames={playerNames} playerIcons={playerIcons} />;
  }

  if (state.phase === "LOCKED_IN") {
    return <LockedInScreen state={state} onSend={send} playerNames={playerNames} />;
  }

  if (state.phase === "RESOLUTION") {
    return <ResolutionScreen state={state} playerNames={playerNames} playerIcons={playerIcons} onRestart={restart} />;
  }

  // PLACEMENT + LOCK_IN phases
  return (
    <PlacementScreen
      state={state}
      onSend={send}
      playerNames={playerNames}
      playerIcons={playerIcons}
      selectedCard={selectedCard}
      setSelectedCard={setSelectedCard}
    />
  );
}