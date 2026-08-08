import type { DomainEffect } from "./battleEngine";
import { DOMAIN_BATTLE_EFFECTS } from "./battleEngine";

// All the display text for domain abilities. Screens call describeDomain() and
// render the result however they want.

export interface DomainText {
  /** Ability name, e.g. "Malevolent Shrine". */
  name: string;
  /** What the first activation does, including any granted spell. */
  desc: string;
  /** What a second activation does, when the ability escalates. */
  secondDesc?: string;
}

/** Copy for a single domain effect variant. */
function describeEffect(e: DomainEffect): string {
  const turns = (n: number) => `${n} turn${n > 1 ? "s" : ""}`;

  switch (e.kind) {
    case "STUN_ENEMY_BOARD":
      return `Fully immobilizes all enemies for ${turns(e.turns)}. No actions allowed.`;
    case "DAMAGE_ALL_ENEMIES":
      return `Deals ${e.amount} damage split across all enemies.`;
    case "BUFF_OWN_BOARD":
      return `Gives your board +${e.atkBonus} ATK / +${e.hpBonus} HP for ${turns(e.turns)}.`;
    case "HEAL_LEADER":
      return `Restores ${e.amount} HP to your leader.`;
    case "DRAW_CARDS":
      return `Draw ${e.count} extra card${e.count > 1 ? "s" : ""}.`;
    case "REDUCE_COSTS":
      return `All cards cost ${e.amount} less for ${turns(e.turns)}.`;
    case "KILL_ALL_BOARD":
      return "Destroys all non-leader cards on both sides.";
    case "SPAWN_ENTITIES":
      return `Spawns ${e.count}× ${e.atk}/${e.hp} Cursed Spirits on your board.`;
    case "GRANT_RANDOM_SPELLS":
      return `Grants ${e.count} random synergy spells.`;
    case "PERMANENT_LEADER_ATK":
      return `Your leader permanently attacks for ${e.atk}, taking ${e.counterDmg} self-damage per swing.`;
    case "CHOOSE_KILL_ENEMIES":
      return `Choose ${e.count} enemy board cards to destroy.`;
    case "COPY_ENEMY_CARD":
      return "Place a weakened copy of any enemy board card onto your board.";
    case "HEAL_AND_KILL_ONE":
      return `Restores ${e.healAmount} HP to your leader, then destroys one enemy card.`;
    case "SHEEPIFY_BOARD":
      return "Every board card becomes a 1/1 sheep.";
    case "SHEEPIFY_ENEMY_CARDS":
      return `Choose ${e.count} enemy board cards to turn into 1/1 sheep.`;
    case "SHEEPIFY_ENEMY_LEADER":
      return "Transforms the enemy leader into a 1/7 sheep.";
    case "SNEAK_ATTACK_DOMAIN":
      return `Deal ${e.amount} damage to any target with no counter damage.`;
    case "GRANT_SPELL":
      return `Grants spell: "${e.spellName}". ${e.spellDesc}.`;
    case "BUFF_LEADER_PERMANENT":
      if (e.atk > 0 && e.hp > 0) return `Your leader gains +${e.atk} ATK / +${e.hp} HP permanently.`;
      return e.atk > 0
        ? `Your leader gains +${e.atk} ATK permanently.`
        : `Your leader gains +${e.hp} HP permanently.`;
    case "SUKUNA_BOARD_MODE":
      return "Wipes all board cards. Sukuna enters as a 3/15 board card, always targetable. His death ends the match.";
    case "MAHORAGA_BOARD_MODE":
      return "Mahoraga enters as a 1/25 board card, gaining +1 ATK each time he is hit. His death ends the match.";
    case "TAKABA_BOARD_MODE":
      return "Every card on both boards becomes a 1/1 sheep. Takaba enters as a 1/15 board card. His death ends the match.";
    case "SUMMON_RIKA_AND_COPY":
      return "Summons Rika (5/5 Cursed Spirit) and grants Cursed Copy, which places a 3/3 copy of any board card.";
    default:
      return "Activates a powerful cursed technique.";
  }
}

/** Copy for the escalated second activation. */
function describeSecond(s: DomainEffect): string {
  switch (s.kind) {
    case "GRANT_SPELL":
      return `2nd fill: grants "${s.spellName}". ${s.spellDesc}.`;
    case "BUFF_LEADER_PERMANENT":
      return `2nd fill: your leader gains +${s.atk} ATK / +${s.hp} HP permanently.`;
    case "SUMMON_RIKA_AND_COPY":
      return "2nd fill: summons Rika (5/5) again, this time with a Shield.";
    case "TAKABA_BOARD_MODE":
      return "2nd fill: every card on both boards becomes a 1/1 sheep, and Takaba enters as a 1/15 board card.";
    case "SPAWN_ENTITIES":
      return `2nd fill: spawns ${s.count}× ${s.atk}/${s.hp} entity.`;
    case "GRANT_RANDOM_SPELLS":
      return `2nd fill: grants ${s.count} more random spells.`;
    case "SHEEPIFY_ENEMY_CARDS":
      return `2nd fill: choose ${s.count} more enemy cards to sheepify.`;
    case "SHEEPIFY_ENEMY_LEADER":
      return "2nd fill: the enemy leader becomes a 1/7 sheep.";
    case "STUN_ENEMY_BOARD":
      return "2nd fill: immobilizes the enemy board again.";
    default:
      return "2nd fill: activates a secondary effect.";
  }
}

/**
 * Describe a leader's domain ability.
 * Returns `null` for leaders that have no entry in the ability table.
 */
export function describeDomain(defId: string): DomainText | null {
  // Toji has no domain expansion — his entry describes the Heavenly Restriction passive instead.
  if (defId === "toji") {
    return {
      name: "Heavenly Restriction",
      desc:
        "Passive: 1 ATK, attacks any card on the board and never takes counter damage. " +
        "Filling the meter grants Toji Strike (4 damage).",
      secondDesc: "2nd fill: grants another Toji Strike.",
    };
  }

  const entry = DOMAIN_BATTLE_EFFECTS[defId];
  if (!entry) return null;

  // Gojo's domain has extra scripted riders that don't map onto a single effect variant.
  const grantSuffix =
    defId === "gojo-base"
      ? " Grants Hollow Purple (5 damage), +5 energy, and unlimited spell draws this turn. Filling twice grants 2 Hollow Purples."
      : entry.grantSpell
        ? ` Also grants "${entry.grantSpell.name}". ${entry.grantSpell.desc}.`
        : "";

  return {
    name: entry.name,
    desc: describeEffect(entry.effect) + grantSuffix,
    secondDesc: entry.secondEffect ? describeSecond(entry.secondEffect) : undefined,
  };
}
