import type { BattleState, BattlePlayer, BattleCard, SpellCard } from "./battleEngine";
import type { PlayerId } from "@cg/contracts";

// Cuts a player's private information out of the state before it goes to the
// other player. Hotseat could hand the whole state to one screen, but online
// each client only gets its own view, otherwise you could just read the
// opponent's hand out of devtools.
//
// Public: board, leader, energy, domain meter, shields, blocks, counts.
// Private: hand and deck contents, spells, spell pool, and the rng seed.

const hiddenCard = (c: BattleCard): BattleCard => ({
  ...c,
  hidden: true,
  defId: "hidden",
  name: "",
  tags: [],
  // Stats would give the card away, so blank them too
  atk: 0, currentHp: 0, maxHp: 0, baseAtk: 0, baseHp: 0, cost: 0,
});

const hiddenSpell = (s: SpellCard): SpellCard => ({
  ...s,
  name: "",
  description: "",
});

function redactPlayer(p: BattlePlayer): BattlePlayer {
  return {
    ...p,
    // Keep the lengths so the opponent's hand and deck still render
    hand: p.hand.map(hiddenCard),
    deck: p.deck.map(hiddenCard),
    spells: p.spells.map(hiddenSpell),
    spellQueue: p.spellQueue.map(hiddenSpell),
    spellPool: p.spellPool.map(hiddenSpell),
  };
}

// State as `viewer` is allowed to see it. Display only, never feed this back
// into the engine.
export function viewFor(state: BattleState, viewer: PlayerId): BattleState {
  const opponent: PlayerId = viewer === "P1" ? "P2" : "P1";
  return {
    ...state,
    players: {
      ...state.players,
      [opponent]: redactPlayer(state.players[opponent]),
    } as BattleState["players"],
    // Knowing the seed means knowing every future roll
    rngSeed: 0,
  };
}
