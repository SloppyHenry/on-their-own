// Baut das Mockup Innenräume zu einer Datei (../innen2.js), damit innen2.html ohne Server und ohne App läuft.
// Aufruf aus frontend/: npx vite build -c ../docs/mockups/welt-optik/innen2/bau.config.mjs
import { fileURLToPath } from "node:url";

const hier = fileURLToPath(new URL(".", import.meta.url));
export default {
  logLevel: "warn",
  build: {
    outDir: hier + "..",
    emptyOutDir: false,
    minify: false,
    lib: { entry: hier + "main.ts", formats: ["iife"], name: "innen", fileName: () => "innen2.js" },
  },
};
