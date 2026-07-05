import { useMemo, useState } from "react";
import type { GameState, Intent, PlayerId } from "@cg/contracts";
import { createEngine, createInitialState } from "@cg/engine";
import type { PlayerIcons, PlayerNames } from "./types";
import { recordMatchResult } from "./profiles";
import type { Profile } from "./profiles";

import SplashScreen from "./screens/SplashScreen";
import HomeScreen from "./screens/HomeScreen";
import CardGallery from "./screens/CardGallery";
import SetupScreen from "./screens/SetupScreen";
import ProfileSelectScreen from "./screens/ProfileSelectScreen";
import ProfilesViewScreen from "./screens/ProfilesViewScreen";
import DraftBattleScreen from "./screens/DraftBattleScreen";
import type { PlayerDraftResult } from "./screens/DraftBattleScreen";
import BattleBoardScreen from "./screens/BattleBoardScreen";
import PostGameScreen from "./screens/PostGameScreen";
import BindingVowScreen from "./screens/BindingVowScreen";
import CoinFlipScreen from "./screens/CoinFlipScreen";
import DraftScreen from "./screens/DraftScreen";
import RevealScreen from "./screens/RevealScreen";
import PlacementScreen from "./screens/PlacementScreen";
import AugmentScreen from "./screens/AugmentScreen";
import LockedInScreen from "./screens/LockedInScreen";
import ResolutionScreen from "./screens/ResolutionScreen";

type AppScreen =
  | "SPLASH" | "HOME" | "PROFILE_SELECT" | "PROFILES_VIEW"
  | "DRAFT_BATTLE" | "SETUP" | "GAME" | "BATTLE_BOARD" | "POST_GAME" | "GALLERY";

export default function App() {
  const [appScreen, setAppScreen] = useState<AppScreen>("SPLASH");
  const [playerNames, setPlayerNames] = useState<PlayerNames>({ P1: "Player 1", P2: "Player 2" });
  const [playerIcons, setPlayerIcons] = useState<PlayerIcons>({ P1: "player-1", P2: "player-7" });
  const [p1Profile, setP1Profile] = useState<Profile | null>(null);
  const [p2Profile, setP2Profile] = useState<Profile | null>(null);
  const [draftMode, setDraftMode] = useState(false);
  const [p1DraftResult, setP1DraftResult] = useState<PlayerDraftResult | null>(null);
  const [p2DraftResult, setP2DraftResult] = useState<PlayerDraftResult | null>(null);
  const [postGameWinner, setPostGameWinner] = useState<PlayerId | null>(null);
  const [postGameTurns, setPostGameTurns] = useState(0);
  const [key, setKey] = useState(0);
  const engine = useMemo(() => createEngine(createInitialState()), [key]);
  const [state, setState] = useState<GameState>(engine.getState());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  useMemo(() => { setState(engine.getState()); }, [engine]);

  const recordAndRestart = () => {
    if (p1Profile && p2Profile && state.phase === "RESOLUTION") {
      const p1Score = state.players.P1.scorePreview;
      const p2Score = state.players.P2.scorePreview;
      const winner: PlayerId | "DRAW" = p1Score > p2Score ? "P1" : p2Score > p1Score ? "P2" : "DRAW";
      if (winner !== "DRAW") {
        const [wP, lP] = winner === "P1" ? [p1Profile, p2Profile] : [p2Profile, p1Profile];
        recordMatchResult(wP.id, lP.id, "quick", wP.name, wP.icon, lP.name, lP.icon);
      }
    }
    setKey(k => k + 1);
    setSelectedCard(null);
    setAppScreen("PROFILE_SELECT");
  };

  const send = (intent: Intent) => {
    const res = engine.applyIntent(intent);
    setState(res.state);
  };

  if (appScreen === "SPLASH") return <SplashScreen onSelectJJK={() => setAppScreen("HOME")} />;

  if (appScreen === "HOME") return (
    <HomeScreen
      onSelect={() => { setDraftMode(false); setAppScreen("PROFILE_SELECT"); }}
      onDraftBattle={() => { setDraftMode(true); setAppScreen("PROFILE_SELECT"); }}
      onGallery={() => setAppScreen("GALLERY")}
      onProfiles={() => setAppScreen("PROFILES_VIEW")}
      onBack={() => setAppScreen("SPLASH")}
    />
  );

  if (appScreen === "GALLERY") return <CardGallery cardDb={state.cardDb} onBack={() => setAppScreen("HOME")} />;
  if (appScreen === "PROFILES_VIEW") return <ProfilesViewScreen onBack={() => setAppScreen("HOME")} />;

  if (appScreen === "PROFILE_SELECT") {
    return (
      <ProfileSelectScreen
        onBack={() => setAppScreen("HOME")}
        onStart={(p1, p2) => {
          setP1Profile(p1);
          setP2Profile(p2);
          setPlayerNames({ P1: p1.name, P2: p2.name });
          setPlayerIcons({ P1: p1.icon, P2: p2.icon });
          setAppScreen(draftMode ? "DRAFT_BATTLE" : "SETUP");
        }}
      />
    );
  }

  if (appScreen === "DRAFT_BATTLE" && p1Profile && p2Profile) {
    return (
      <DraftBattleScreen
        cardDb={state.cardDb}
        p1Profile={p1Profile}
        p2Profile={p2Profile}
        onBack={() => setAppScreen("PROFILE_SELECT")}
        onBattleStart={(p1Result, p2Result) => {
          setP1DraftResult(p1Result);
          setP2DraftResult(p2Result);
          setAppScreen("BATTLE_BOARD");
        }}
      />
    );
  }

  if (appScreen === "BATTLE_BOARD" && p1DraftResult && p2DraftResult && p1Profile && p2Profile) {
    return (
      <BattleBoardScreen
        p1Draft={p1DraftResult}
        p2Draft={p2DraftResult}
        cardDb={state.cardDb}
        p1Name={p1Profile.name}
        p2Name={p2Profile.name}
        p1Icon={p1Profile.icon}
        p2Icon={p2Profile.icon}
        onGameOver={(winner, turnCount) => {
          const [wP, lP] = winner === "P1" ? [p1Profile, p2Profile] : [p2Profile, p1Profile];
          recordMatchResult(wP.id, lP.id, "draft", wP.name, wP.icon, lP.name, lP.icon);
          setPostGameWinner(winner);
          setPostGameTurns(turnCount);
          setAppScreen("POST_GAME");
        }}
      />
    );
  }

  if (appScreen === "POST_GAME" && postGameWinner && p1DraftResult && p2DraftResult && p1Profile && p2Profile) {
    return (
      <PostGameScreen
        winner={postGameWinner}
        p1Profile={p1Profile}
        p2Profile={p2Profile}
        p1Draft={p1DraftResult}
        p2Draft={p2DraftResult}
        cardDb={state.cardDb}
        turnCount={postGameTurns}
        onPlayAgain={() => {
          setP1DraftResult(null);
          setP2DraftResult(null);
          setAppScreen("DRAFT_BATTLE");
        }}
        onMenu={() => setAppScreen("HOME")}
      />
    );
  }

  if (appScreen === "SETUP") {
    return <SetupScreen
      initialNames={playerNames}
      initialIcons={playerIcons}
      onHome={() => setAppScreen("PROFILE_SELECT")}
      onStart={(names, icons) => {
        setPlayerNames(names);
        setPlayerIcons(icons);
        setAppScreen("GAME");
      }}
    />;
  }

  if (state.phase === "BINDING_VOW") {
    return <BindingVowScreen state={state} onSend={send} playerNames={playerNames} playerIcons={playerIcons} onHome={() => { setKey(k => k + 1); setAppScreen("HOME"); }} />;
  }

  if (state.phase === "DRAFT" && state.draft && !state.draft.coinFlipped) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none" }}>
          <DraftScreen state={state} onSend={() => {}} playerNames={playerNames} playerIcons={playerIcons} />
        </div>
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <CoinFlipScreen onFlip={firstPicker => send({ type: "FLIP_COIN", firstPicker })} playerNames={playerNames} playerIcons={playerIcons} onHome={() => { setKey(k => k + 1); setAppScreen("HOME"); }} />
        </div>
      </div>
    );
  }

  if (state.phase === "DRAFT")      return <DraftScreen    state={state} onSend={send} playerNames={playerNames} playerIcons={playerIcons} />;
  if (state.phase === "REVEAL")     return <RevealScreen   state={state} onSend={send} playerNames={playerNames} />;
  if (state.phase === "AUGMENT")    return <AugmentScreen  state={state} onSend={send} playerNames={playerNames} playerIcons={playerIcons} />;
  if (state.phase === "LOCKED_IN")  return <LockedInScreen state={state} onSend={send} playerNames={playerNames} />;
  if (state.phase === "RESOLUTION") return <ResolutionScreen state={state} playerNames={playerNames} playerIcons={playerIcons} onRestart={recordAndRestart} />;

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
