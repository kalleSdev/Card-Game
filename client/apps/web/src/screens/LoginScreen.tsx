import { useState } from "react";
import { motion } from "framer-motion";
import AmbientCanvas from "../components/AmbientCanvas";
import AmbientOverlay from "../components/AmbientOverlay";
import { login, register } from "../online/api";
import type { PublicUser } from "../online/types";
import { COLOR } from "../theme";

export default function LoginScreen({
  onSignedIn, onBack,
}: {
  onSignedIn: (user: PublicUser) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === "login"
        ? await login(username, password)
        : await register(username, password);
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid #2a2a3a", color: "#fff",
    fontSize: 13, fontFamily: "inherit", outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh", background: COLOR.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden",
    }}>
      <AmbientCanvas intensity={0.3} />
      <AmbientOverlay />

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: "relative", zIndex: 2, width: 340,
          display: "flex", flexDirection: "column", gap: 12,
          padding: "30px 28px", borderRadius: 16,
          background: "rgba(6,6,16,0.92)",
          border: `1px solid ${COLOR.cursed}33`,
          boxShadow: "0 12px 50px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>
            {mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </div>
          <div style={{ fontSize: 9, color: "#556", letterSpacing: 2, marginTop: 5 }}>
            Needed to play online
          </div>
        </div>

        <input
          style={field} value={username} autoComplete="username"
          onChange={e => setUsername(e.target.value)}
          placeholder="Username" aria-label="Username"
        />
        <input
          style={field} value={password} type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password" aria-label="Password"
        />

        {mode === "register" && (
          <div style={{ fontSize: 9, color: "#556", lineHeight: 1.5 }}>
            Letters, numbers and underscores. Password at least 8 characters.
          </div>
        )}

        {error && (
          <div style={{
            fontSize: 10, color: "#ff8888", background: "rgba(255,60,60,0.1)",
            border: "1px solid #ff444444", borderRadius: 6, padding: "7px 9px",
          }}>{error}</div>
        )}

        <motion.button
          type="submit" disabled={busy}
          whileHover={!busy ? { scale: 1.02 } : {}} whileTap={!busy ? { scale: 0.98 } : {}}
          style={{
            marginTop: 4, padding: "10px 0", borderRadius: 8, border: "none",
            background: busy ? "#2a2a3a" : `linear-gradient(135deg, ${COLOR.cursedDeep}, ${COLOR.cursed})`,
            color: "#fff", fontSize: 12, fontWeight: 900, letterSpacing: 3,
            cursor: busy ? "default" : "pointer", fontFamily: "inherit",
          }}
        >
          {busy ? "..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
        </motion.button>

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          style={{
            background: "none", border: "none", color: COLOR.cursed,
            fontSize: 10, letterSpacing: 1, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {mode === "login" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>

        <button
          type="button" onClick={onBack}
          style={{
            background: "none", border: "none", color: "#445",
            fontSize: 9, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
          }}
        >BACK</button>
      </motion.form>
    </div>
  );
}
