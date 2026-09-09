import type { PlayerDraftResult } from "@cg/contracts";
import type { UniverseId } from "./universes.js";

// Private rooms. One player opens a lobby and gets a short code, the other
// joins with it. No global queue, so nobody is ever paired with a stranger.

export interface Lobby<Host, Payload = PlayerDraftResult> {
  code: string;
  host: Host;
  hostName: string;
  /** What the host brought. A deck for a card battle, nothing for Score. */
  payload: Payload;
  universe: UniverseId;
  createdAt: number;
}

// No vowels and no look alike characters, so a code read out loud or typed
// from a screenshot still works.
const ALPHABET = "ABCDFGHJKLMNPQRSTVWXYZ23456789";
const CODE_LENGTH = 5;
// Lobbies nobody joins should not sit around for the life of the process
const LOBBY_TTL_MS = 30 * 60 * 1000;

export class LobbyBook<Host, Payload = PlayerDraftResult> {
  private byCode = new Map<string, Lobby<Host, Payload>>();

  private newCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      }
      if (!this.byCode.has(code)) return code;
    }
    throw new Error("Could not find a free lobby code");
  }

  private sweep(): void {
    const cutoff = Date.now() - LOBBY_TTL_MS;
    for (const [code, lobby] of this.byCode) {
      if (lobby.createdAt < cutoff) this.byCode.delete(code);
    }
  }

  create(host: Host, hostName: string, payload: Payload, universe: UniverseId): Lobby<Host, Payload> {
    this.sweep();
    this.closeFor(host);
    const lobby: Lobby<Host, Payload> = {
      code: this.newCode(), host, hostName, payload, universe, createdAt: Date.now(),
    };
    this.byCode.set(lobby.code, lobby);
    return lobby;
  }

  /** Codes are matched loosely, so pasted whitespace or lowercase still works. */
  find(code: string): Lobby<Host, Payload> | undefined {
    this.sweep();
    return this.byCode.get(normaliseCode(code));
  }

  close(code: string): void {
    this.byCode.delete(normaliseCode(code));
  }

  /** Drops whatever lobby this host had open, if any. */
  closeFor(host: Host): void {
    for (const [code, lobby] of this.byCode) {
      if (lobby.host === host) this.byCode.delete(code);
    }
  }

  get size(): number {
    return this.byCode.size;
  }
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
