import type { CardInstance, PlayerZones, SlotRef } from "@cg/contracts";
import type { DomainEffectDef } from "@cg/engine";
import { RARITY_COLOR, RARITY_GLOW } from "./constants";

export const rc = (r: string) => RARITY_COLOR[r] ?? "#888";
export const rg = (r: string) => RARITY_GLOW[r] ?? "none";

export const slotLabel = (s: SlotRef) => {
  if (s.type === "LEADER")  return "Leader";
  if (s.type === "COMBAT")  return `Combat ${s.index + 1}`;
  if (s.type === "SUPPORT") return `Support ${s.index + 1}`;
  return "Unleash";
};

export const getBoardCard = (zones: PlayerZones, slot: SlotRef): CardInstance | null => {
  if (slot.type === "LEADER")  return zones.board.leader;
  if (slot.type === "COMBAT")  return zones.board.combat[slot.index];
  if (slot.type === "SUPPORT") return zones.board.support[slot.index];
  return zones.board.unleashLocked;
};

export const isBoardFull = (zones: PlayerZones) =>
  zones.board.leader !== null &&
  zones.board.combat.every(c => c !== null) &&
  zones.board.support.every(s => s !== null);

export const countUp = (target: number, setter: (n: number) => void, onDone: () => void) => {
  const duration = 1800;
  const fps = 60;
  const totalSteps = Math.round((duration / 1000) * fps);
  let step = 0;
  const id = setInterval(() => {
    step++;
    const progress = 1 - Math.pow(1 - step / totalSteps, 3);
    setter(Math.round(target * progress));
    if (step >= totalSteps) {
      setter(target);
      clearInterval(id);
      onDone();
    }
  }, 1000 / fps);
  return id;
};

export const domainDesc = (e: DomainEffectDef) => {
  let d = `+${e.ownPct}% own`;
  if (e.enemyPct < 0) d += ` · ${e.enemyPct}% enemy`;
  return d;
};
