import { useState } from "react";
import { COLOR, RADIUS, SPACE, text } from "../design/tokens";
import { Button, Panel, Text } from "../components/primitives";
import type { Store } from "../data/store";

/** The gate. Nothing a player owns exists on this machine, so there is one. */
export default function SignIn({ store }: { store: Store }) {
  const [mode, setMode] = useState<"in" | "new">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await (mode === "in" ? store.signIn(username, password) : store.register(username, password));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  };

  const field = {
    ...text("body"),
    padding: "10px 13px",
    background: COLOR.deck,
    border: `1px solid ${COLOR.rope}`,
    borderRadius: RADIUS.md,
    color: COLOR.foam,
    outline: "none",
    width: "100%",
  } as const;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE.xl,
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: SPACE.xl }}>
          <div
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 900,
              fontSize: 34,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: COLOR.foam,
            }}
          >
            Grand Line
          </div>
          <div style={{ ...text("label"), color: COLOR.fathom, marginTop: SPACE.sm }}>Card Game</div>
        </div>

        <Panel padding={SPACE.xl} lifted>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}>
            <Text role="heading">{mode === "in" ? "Sign in" : "Make an account"}</Text>
            <p style={{ ...text("small"), color: COLOR.mist, margin: 0 }}>
              Your collection, packs and Berries live on the server, so they follow you between
              browsers and nothing here can be edited from this machine.
            </p>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ ...text("label"), color: COLOR.fathom }}>Username</span>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                style={field}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ ...text("label"), color: COLOR.fathom }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                style={field}
              />
            </label>

            {problem && (
              <div style={{ ...text("small"), color: "#E9857A" }}>{problem}</div>
            )}

            <Button tone="primary" full disabled={busy || !username || !password}>
              {busy ? "One moment" : mode === "in" ? "Sign in" : "Create account"}
            </Button>

            <button
              type="button"
              onClick={() => { setMode(mode === "in" ? "new" : "in"); setProblem(null); }}
              style={{
                ...text("small"),
                background: "none",
                border: "none",
                color: COLOR.current,
                padding: 0,
                textAlign: "left",
              }}
            >
              {mode === "in" ? "No account yet? Make one" : "Already have one? Sign in"}
            </button>
          </form>
        </Panel>

        <p style={{ ...text("small"), color: COLOR.fathom, marginTop: SPACE.lg }}>
          The server runs separately. If sign in cannot reach it, start it with{" "}
          <code style={{ ...text("data"), fontSize: 12, color: COLOR.mist }}>npm run dev:server</code>.
        </p>
      </div>
    </div>
  );
}
