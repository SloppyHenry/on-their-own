import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backend = process.env.SIM_BACKEND ?? "http://127.0.0.1:8090";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.SIM_FRONTEND_PORT ?? 5173),
    proxy: {
      "/api": backend,
      "/ws": { target: backend, ws: true },
    },
  },
});
