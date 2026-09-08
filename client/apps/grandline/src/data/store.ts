import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_COLLECTION, EMPTY_WALLET, addPull, emptyDeck, openPack,
  type Collection, type Deck, type PrintId, type SpareAction, type Wallet,
  scrapSpares,
} from "@cg/meta";
import { POOL } from "./pool";

/**
 * Where the player's things live, for now.
 *
 * The server owns all of this eventually: packs have to be rolled somewhere the
 * client cannot reach, and a wallet the browser can edit is not a wallet. Until
 * that lands this keeps everything in localStorage behind the same shape the
 * server will expose, so the swap is this file and not the screens.
 */

const KEY = "grandline.save.v1";

export interface SaveFile {
  collection: Collection;
  wallet: Wallet;
  decks: Deck[];
}

/**
 * A starting collection, so the binder opens on something to look at rather
 * than an empty grid. Rolled from a fixed seed, which means every fresh browser
 * gets the same one and a screenshot is reproducible.
 */
function starterSave(): SaveFile {
  let collection = EMPTY_COLLECTION;
  for (let i = 0; i < 14; i++) {
    for (const pull of openPack("goldCard", POOL, 1000 + i).pulls) {
      if (pull.kind === "card") collection = addPull(collection, pull.cardId, pull.print).collection;
    }
  }
  // A couple of hits, so every treatment is visible in the binder from the off
  for (const [cardId, print] of [
    ["gojo-base", "signed"],
    ["sukuna", "secret"],
    ["yuta", "blackLabel"],
    ["megumi", "altArt"],
  ] as [string, PrintId][]) {
    collection = addPull(collection, cardId, print).collection;
  }
  return { collection, wallet: { berries: 1240, stardust: 860 }, decks: [] };
}

function read(): SaveFile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return starterSave();
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    return {
      collection: parsed.collection ?? EMPTY_COLLECTION,
      wallet: parsed.wallet ?? EMPTY_WALLET,
      decks: parsed.decks ?? [],
    };
  } catch {
    // A save that will not parse is worth less than a fresh one
    return starterSave();
  }
}

function write(save: SaveFile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private windows and full quotas both land here. Losing the write is
    // survivable; the session keeps working from memory.
  }
}

export interface Store {
  collection: Collection;
  wallet: Wallet;
  decks: Deck[];
  /** Scrap spares of one print for Stardust or Berries. */
  scrap: (cardId: string, print: PrintId, amount: number, action: SpareAction) => void;
  saveDeck: (deck: Deck) => void;
  deleteDeck: (id: string) => void;
  newDeck: (name: string) => Deck;
  /** Wipes the save and starts again, for testing the empty and full states. */
  reset: () => void;
}

export function useStore(): Store {
  const [save, setSave] = useState<SaveFile>(read);

  useEffect(() => { write(save); }, [save]);

  const scrap = useCallback((cardId: string, print: PrintId, amount: number, action: SpareAction) => {
    setSave(prev => {
      const result = scrapSpares(prev.collection, cardId, print, amount, action);
      if (result.removed === 0) return prev;
      const currency = action === "dust" ? "stardust" : "berries";
      return {
        ...prev,
        collection: result.collection,
        wallet: { ...prev.wallet, [currency]: prev.wallet[currency] + result.gained },
      };
    });
  }, []);

  const saveDeck = useCallback((deck: Deck) => {
    setSave(prev => {
      const next = { ...deck, updatedAt: Date.now() };
      const at = prev.decks.findIndex(d => d.id === deck.id);
      const decks = at < 0 ? [...prev.decks, next] : prev.decks.map(d => (d.id === deck.id ? next : d));
      return { ...prev, decks };
    });
  }, []);

  const deleteDeck = useCallback((id: string) => {
    setSave(prev => ({ ...prev, decks: prev.decks.filter(d => d.id !== id) }));
  }, []);

  const newDeck = useCallback((name: string) => {
    const deck = emptyDeck(`deck-${Date.now().toString(36)}`, name);
    setSave(prev => ({ ...prev, decks: [...prev.decks, deck] }));
    return deck;
  }, []);

  const reset = useCallback(() => setSave(starterSave()), []);

  return { ...save, scrap, saveDeck, deleteDeck, newDeck, reset };
}
