import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_COLLECTION, EMPTY_WALLET, emptyDeck, printKey,
  type Collection, type Deck, type PackId, type PrintId, type Pull, type SpareAction, type Wallet,
} from "@cg/meta";
import * as api from "./api";

/**
 * Everything the player owns, read from the server.
 *
 * The server is the only thing that decides what is in a pack, what a spare is
 * worth and how much money there is. This holds a copy so the screens have
 * something to draw, and every action goes to the server and takes back what it
 * says rather than guessing and hoping.
 */

export interface Store {
  account: api.Account | null;
  /** False while browsing without an account: everything shows, nothing acts. */
  signedIn: boolean;
  loading: boolean;
  error: string | null;

  collection: Collection;
  wallet: Wallet;
  packs: api.OwnedPack[];
  decks: Deck[];
  /** Where you sit on the ladder. Null while signed out. */
  standing: api.Standing | null;

  signIn: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  buy: (packId: PackId) => Promise<void>;
  open: (packRowId: string) => Promise<{ pulls: Pull[]; isNew: boolean[] } | null>;
  scrap: (cardId: string, print: PrintId, amount: number, action: SpareAction) => Promise<void>;

  saveDeck: (deck: Deck) => void;
  deleteDeck: (id: string) => void;
  newDeck: (name: string) => Deck;

  /** Pull everything down again. */
  refresh: () => Promise<void>;
}

/** Server rows into the shape the shared collection helpers expect. */
function toCollection(rows: api.PrintRow[]): Collection {
  const out: Collection = {};
  for (const row of rows) out[printKey(row.card_id, row.print_id)] = row.copies;
  return out;
}

export function useStore(): Store {
  const [account, setAccount] = useState<api.Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [collection, setCollection] = useState<Collection>(EMPTY_COLLECTION);
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET);
  const [packs, setPacks] = useState<api.OwnedPack[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [standing, setStanding] = useState<api.Standing | null>(null);

  const load = useCallback(async () => {
    const everything = await api.fetchEverything();
    setCollection(toCollection(everything.prints));
    setWallet(everything.wallet);
    setPacks(everything.packs);
    setDecks(everything.decks.map(d => ({ ...d })));
    setStanding(everything.standing ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [load]);

  // Pick a session back up on load, and fetch what it owns
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.whoAmI();
        if (cancelled) return;
        setAccount(me);
        if (me) await load();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Cannot reach the server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const enter = useCallback(async (run: () => Promise<api.Account>) => {
    setError(null);
    const me = await run();
    setAccount(me);
    await load();
  }, [load]);

  const signIn = useCallback(
    (u: string, p: string) => enter(() => api.signIn(u, p)),
    [enter],
  );
  const register = useCallback(
    (u: string, p: string) => enter(() => api.register(u, p)),
    [enter],
  );

  const signOut = useCallback(async () => {
    await api.signOut();
    setAccount(null);
    setCollection(EMPTY_COLLECTION);
    setWallet(EMPTY_WALLET);
    setPacks([]);
    setDecks([]);
    setStanding(null);
  }, []);

  const buy = useCallback(async (packId: PackId) => {
    try {
      await api.buyPack(packId);
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not buy that");
    }
  }, [load]);

  const open = useCallback(async (packRowId: string) => {
    try {
      const opened = await api.openPack(packRowId);
      await load();
      setError(null);
      return { pulls: opened.pulls, isNew: opened.isNew };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that");
      return null;
    }
  }, [load]);

  const scrap = useCallback(
    async (cardId: string, print: PrintId, amount: number, action: SpareAction) => {
      try {
        await api.scrap(cardId, print, amount, action);
        await load();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not scrap that");
      }
    },
    [load],
  );

  // Decks are written straight through: the screen updates now and the server
  // catches up, because a deck edit is not worth a spinner.
  const saveDeck = useCallback((deck: Deck) => {
    const next = { ...deck, updatedAt: Date.now() };
    setDecks(prev => {
      const at = prev.findIndex(d => d.id === deck.id);
      return at < 0 ? [...prev, next] : prev.map(d => (d.id === deck.id ? next : d));
    });
    void api.saveDeck(next).catch(() => setError("That deck did not save"));
  }, []);

  const deleteDeck = useCallback((id: string) => {
    setDecks(prev => prev.filter(d => d.id !== id));
    void api.deleteDeck(id).catch(() => setError("That deck did not delete"));
  }, []);

  const newDeck = useCallback((name: string) => {
    const deck = emptyDeck(`deck-${Date.now().toString(36)}`, name);
    setDecks(prev => [...prev, deck]);
    void api.saveDeck(deck).catch(() => setError("That deck did not save"));
    return deck;
  }, []);

  return {
    account, signedIn: account !== null, loading, error,
    collection, wallet, packs, decks, standing,
    signIn, register, signOut,
    buy, open, scrap,
    saveDeck, deleteDeck, newDeck,
    refresh,
  };
}
