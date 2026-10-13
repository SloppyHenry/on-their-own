// Baut das Mockup „Ruhige Ansicht“ zu einer Datei (../ruhig.js), damit ruhig.html ohne Server und ohne App läuft.
// Aufruf aus frontend/: npx vite build -c ../docs/mockups/welt-optik/ruhig/bau.config.mjs
import { fileURLToPath } from "node:url";

const hier = fileURLToPath(new URL(".", import.meta.url));
export default {
  logLevel: "warn",
  build: {
    outDir: hier + "..",
    emptyOutDir: false,
    minify: false,
    lib: { entry: hier + "main.ts", formats: ["iife"], name: "ruhig", fileName: () => "ruhig.js" },
  },
};
