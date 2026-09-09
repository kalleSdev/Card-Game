import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * The card art lives in the JJK app's public folder, and this app serves the
 * same files rather than keeping a second copy of seventeen megabytes. It is
 * the same borrowing the card pool already does: One Piece has no art yet, so
 * Grand Line is built against the set that does.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: fileURLToPath(new URL("../web/public", import.meta.url)),
  server: { port: 5180 },
});
