import { useEffect, useMemo, useState } from "react";
import type { GameState, Intent, PlayerId, CardDef } from "@cg/contracts";
import { createEngine, createInitialState } from "@cg/engine";
import type { PlayerIcons, PlayerNames } from "./types";
import { recordMatchResult, addCardsToCollection, loadProfiles } from "./profiles";
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
import CardRewardScreen from "./screens/CardRewardScreen";
import NormalModeSetupScreen from "./screens/NormalModeSetupScreen";
import BindingVowScreen from "./screens/BindingVowScreen";
import CoinFlipScreen from "./screens/CoinFlipScreen";
import DraftScreen from "./screens/DraftScreen";
import RevealScreen from "./screens/RevealScreen";
import PlacementScreen from "./screens/PlacementScreen";
import AugmentScreen from "./screens/AugmentScreen";
import LockedInScreen from "./screens/LockedInScreen";
import ResolutionScreen from "./screens/ResolutionScreen";
import RankingScreen from "./screens/RankingScreen";
import LoginScreen from "./screens/LoginScreen";
import OnlineScreen from "./screens/OnlineScreen";
import { fetchMe, logout as apiLogout } from "./online/api";
import type { PublicUser } from "./online/types";

type AppScreen =
  | "SPLASH" | "HOME" | "PROFILE_SELECT" | "PROFILES_VIEW"
  | "DRAFT_BATTLE" | "NORMAL_MODE_SETUP" | "SETUP" | "GAME"
  | "BATTLE_BOARD" | "POST_GAME" | "CARD_REWARD" | "GALLERY" | "RANKING"
  | "LOGIN" | "ONLINE";

type BattleMode = "quick-draft" | "normal";

function pickRewardCards(cardDb: Record<string, CardDef>, profile: Profile | null, isWinner: boolean): string[] {
  const count = isWinner ? 5 : 3;
  const ids = Object.keys(cardDb);

  if (isWinner && profile) {
    const unowned = ids.filter(id => !profile.collection.some(c => c.defId === id));
    const owned   = ids.filter(id =>  profile.collection.some(c => c.defId === id));
    const shuffledUnowned = [...unowned].sort(() => Math.random() - 0.5);
    const shuffledOwned   = [...owned].sort(() => Math.random() - 0.5);
    const guaranteed = shuffledUnowned.slice(0, 1);
    const rest = [...shuffledUnowned.slice(1), ...shuffledOwned].sort(() => Math.random() - 0.5);
    return [...guaranteed, ...rest].slice(0, count);
  }

  return [...ids].sort(() => Math.random() - 0.5).slice(0, count);
}

export default function App() {
  const [appScreen, setAppScreen] = useState<AppScreen>("SPLASH");
  const [playerNames, setPlayerNames] = useState<PlayerNames>({ P1: "Player 1", P2: "Player 2" });
  const [playerIcons, setPlayerIcons] = useState<PlayerIcons>({ P1: "player-1", P2: "player-7" });
  const [p1Profile, setP1Profile] = useState<Profile | null>(null);
  const [p2Profile, setP2Profile] = useState<Profile | null>(null);
  const [draftMode, setDraftMode] = useState(false);
  const [battleMode, setBattleMode] = useState<BattleMode>("quick-draft");
  const [p1DraftResult, setP1DraftResult] = useState<PlayerDraftResult | null>(null);
  const [p2DraftResult, setP2DraftResult] = useState<PlayerDraftResult | null>(null);
  const [postGameWinner, setPostGameWinner] = useState<PlayerId | null>(null);
  const [postGameTurns, setPostGameTurns] = useState(0);
  // Card reward flow: P1 spins first, then P2
  const [cardRewardStep, setCardRewardStep] = useState<"P1" | "P2">("P1");
  const [cardRewardOptions, setCardRewardOptions] = useState<string[]>([]);
  const [cardRewardIsWinner, setCardRewardIsWinner] = useState<boolean>(false);
  const [key, setKey] = useState(0);
  const engine = useMemo(() => createEngine(createInitialState()), [key]);
  const [state, setState] = useState<GameState>(engine.getState());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  // Signed in account, if any. Online play needs one, the offline modes do not.
  const [account, setAccount] = useState<PublicUser | null>(null);
  // True while the draft is being done to take online rather than to play locally
  const [draftingForOnline, setDraftingForOnline] = useState(false);
  // Code from an invite link (?join=ABCDE). Held until the deck is drafted.
  const [inviteCode, setInviteCode] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("join"),
  );

  // Pick an existing session back up on load
  useEffect(() => { fetchMe().then(me => { if (me) setAccount(me.user); }); }, []);

  // Online uses the signed in account rather than a local profile, so it skips
  // profile select and drafts a single deck before reaching the lobby.
  const startOnlineDraft = () => {
    if (!account) { setAppScreen("LOGIN"); return; }
    const me: Profile = {
      id: `online-${account.id}`,
      name: account.username,
      icon: "player-1",
      createdAt: Date.now(),
      quickStats:  { wins: 0, losses: 0, matches: 0 },
      draftStats:  { wins: 0, losses: 0, matches: 0 },
      normalStats: { wins: 0, losses: 0, matches: 0 },
      history: [], collection: [], subDecks: [],
    };
    setP1Profile(me);
    setP2Profile(me);
    setPlayerNames({ P1: me.name, P2: "Opponent" });
    setPlayerIcons({ P1: me.icon, P2: "player-2" });
    setBattleMode("quick-draft");
    setDraftMode(true);
    setDraftingForOnline(true);
    setAppScreen("DRAFT_BATTLE");
  };

  // Someone opening an invite link goes straight to the draft, then the lobby
  // joins with the code once they have a deck.
  const [inviteHandled, setInviteHandled] = useState(false);
  useEffect(() => {
    if (!inviteCode || inviteHandled || !account) return;
    setInviteHandled(true);
    startOnlineDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, inviteHandled, account]);


  // New match means a new engine, so pull its state in during render.
  const [prevEngine, setPrevEngine] = useState(engine);
  if (prevEngine !== engine) {
    setPrevEngine(engine);
    setState(engine.getState());
  }

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
    // Start card reward for P1
    const quickWinner: PlayerId | "DRAW" = p1Profile && p2Profile && state.phase === "RESOLUTION"
      ? (state.players.P1.scorePreview > state.players.P2.scorePreview ? "P1"
        : state.players.P2.scorePreview > state.players.P1.scorePreview ? "P2"
        : "DRAW")
      : "DRAW";
    const p1IsWinnerQuick = quickWinner === "P1";
    setCardRewardIsWinner(p1IsWinnerQuick);
    setCardRewardStep("P1");
    setCardRewardOptions(pickRewardCards(state.cardDb, p1Profile, p1IsWinnerQuick));
    setAppScreen("CARD_REWARD");
    setKey(k => k + 1);
    setSelectedCard(null);
  };

  const startCardReward = (options: string[], isWinner: boolean) => {
    setCardRewardIsWinner(isWinner);
    setCardRewardStep("P1");
    setCardRewardOptions(options);
    setAppScreen("CARD_REWARD");
  };

  const handleCardRewardDone = (chosen: string[]) => {
    const profileId = cardRewardStep === "P1" ? p1Profile?.id : p2Profile?.id;
    if (profileId) addCardsToCollection(profileId, chosen);

    if (cardRewardStep === "P1") {
      // Move to P2
      const p2IsWinner = postGameWinner === "P2";
      setCardRewardIsWinner(p2IsWinner);
      setCardRewardStep("P2");
      setCardRewardOptions(pickRewardCards(state.cardDb, p2Profile, p2IsWinner));
    } else {
      // Both done — go to post game (for draft modes) or home
      if (postGameWinner && p1DraftResult && p2DraftResult) {
        setAppScreen("POST_GAME");
      } else {
        setAppScreen("HOME");
      }
    }
  };

  const send = (intent: Intent) => {
    const res = engine.applyIntent(intent);
    setState(res.state);
  };

  // Reload profile after updates
  const reloadProfile = (id: string) => loadProfiles().find(p => p.id === id) ?? null;

  if (appScreen === "SPLASH") return <SplashScreen onSelectJJK={() => setAppScreen("HOME")} />;

  if (appScreen === "HOME") return (
    <HomeScreen
      onSelect={() => { setDraftMode(false); setAppScreen("PROFILE_SELECT"); }}
      onDraftBattle={() => { setBattleMode("quick-draft"); setDraftMode(true); setAppScreen("PROFILE_SELECT"); }}
      onNormalMode={() => { setBattleMode("normal"); setDraftMode(true); setAppScreen("PROFILE_SELECT"); }}
      onGallery={() => setAppScreen("GALLERY")}
      onProfiles={() => setAppScreen("PROFILES_VIEW")}
      onRanking={() => setAppScreen("RANKING")}
      onPlayOnline={startOnlineDraft}
      account={account}
      onAccount={() => setAppScreen("LOGIN")}
      onSignOut={() => { apiLogout(); setAccount(null); }}
      onBack={() => setAppScreen("SPLASH")}
    />
  );

  if (appScreen === "RANKING") return <RankingScreen profiles={loadProfiles()} onBack={() => setAppScreen("HOME")} />;

  if (appScreen === "ONLINE" && p1DraftResult && account) return (
    <OnlineScreen
      cardDb={state.cardDb}
      draft={p1DraftResult}
      username={account.username}
      joinCode={inviteCode ?? undefined}
      onLeave={() => { setDraftingForOnline(false); setInviteCode(null); setAppScreen("HOME"); }}
    />
  );

  if (appScreen === "LOGIN") return (
    <LoginScreen
      onSignedIn={user => { setAccount(user); setAppScreen("HOME"); }}
      onBack={() => setAppScreen("HOME")}
    />
  );

  if (appScreen === "GALLERY") return <CardGallery cardDb={state.cardDb} onBack={() => setAppScreen("HOME")} />;
  if (appScreen === "PROFILES_VIEW") return (
    <ProfilesViewScreen
      cardDb={state.cardDb}
      onBack={() => setAppScreen("HOME")}
    />
  );

  if (appScreen === "PROFILE_SELECT") {
    return (
      <ProfileSelectScreen
        onBack={() => setAppScreen("HOME")}
        onStart={(p1, p2) => {
          setP1Profile(p1);
          setP2Profile(p2);
          setPlayerNames({ P1: p1.name, P2: p2.name });
          setPlayerIcons({ P1: p1.icon, P2: p2.icon });
          if (!draftMode) setAppScreen("SETUP");
          else if (battleMode === "normal") setAppScreen("NORMAL_MODE_SETUP");
          else setAppScreen("DRAFT_BATTLE");
        }}
      />
    );
  }

  if (appScreen === "NORMAL_MODE_SETUP" && p1Profile && p2Profile) {
    return (
      <NormalModeSetupScreen
        p1Profile={reloadProfile(p1Profile.id) ?? p1Profile}
        p2Profile={reloadProfile(p2Profile.id) ?? p2Profile}
        cardDb={state.cardDb}
        onBack={() => setAppScreen("PROFILE_SELECT")}
        onStart={(p1Result, p2Result) => {
          setP1DraftResult(p1Result);
          setP2DraftResult(p2Result);
          setAppScreen("BATTLE_BOARD");
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
        solo={draftingForOnline}
        onBack={() => { setDraftingForOnline(false); setAppScreen(draftingForOnline ? "HOME" : "PROFILE_SELECT"); }}
        onBattleStart={(p1Result, p2Result) => {
          setP1DraftResult(p1Result);
          setP2DraftResult(p2Result);
          // Drafted to take online, so queue instead of playing it here
          setAppScreen(draftingForOnline ? "ONLINE" : "BATTLE_BOARD");
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
          const mode = battleMode === "normal" ? "normal" : "draft";
          recordMatchResult(wP.id, lP.id, mode, wP.name, wP.icon, lP.name, lP.icon);
          setPostGameWinner(winner);
          setPostGameTurns(turnCount);
          // Start card reward before post game — P1 goes first
          const p1IsWinner = winner === "P1";
          startCardReward(pickRewardCards(state.cardDb, p1Profile, p1IsWinner), p1IsWinner);
        }}
      />
    );
  }

  if (appScreen === "CARD_REWARD") {
    const currentProfile = cardRewardStep === "P1" ? p1Profile : p2Profile;
    if (!currentProfile) { setAppScreen("HOME"); return null; }
    return (
      <CardRewardScreen
        key={cardRewardStep}
        profile={reloadProfile(currentProfile.id) ?? currentProfile}
        options={cardRewardOptions}
        cardDb={state.cardDb}
        isWinner={cardRewardIsWinner}
        onDone={handleCardRewardDone}
      />
    );
  }

  if (appScreen === "POST_GAME" && postGameWinner && p1DraftResult && p2DraftResult && p1Profile && p2Profile) {
    return (
      <PostGameScreen
        winner={postGameWinner}
        p1Profile={reloadProfile(p1Profile.id) ?? p1Profile}
        p2Profile={reloadProfile(p2Profile.id) ?? p2Profile}
        p1Draft={p1DraftResult}
        p2Draft={p2DraftResult}
        cardDb={state.cardDb}
        turnCount={postGameTurns}
        onPlayAgain={() => {
          setPostGameWinner(null);
          setP1DraftResult(null);
          setP2DraftResult(null);
          if (battleMode === "normal") setAppScreen("NORMAL_MODE_SETUP");
          else setAppScreen("DRAFT_BATTLE");
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
