import { defineConfig } from "@playwright/test";

const BACKEND = 8192;
const FRONTEND = 5175;

/** Echtes Backend mit deterministischem Fake-LLM (scripts/e2e_server.py), echtes Frontend über Vite; kein Zugriff auf maintux. */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${FRONTEND}`, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    {
      command: `rm -rf /tmp/simulacra-e2e-run && ../backend/.venv/bin/python ../scripts/e2e_server.py --port ${BACKEND} --data-dir /tmp/simulacra-e2e-run`,
      url: `http://127.0.0.1:${BACKEND}/api/state`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npx vite --host 127.0.0.1 --strictPort",
      env: { SIM_BACKEND: `http://127.0.0.1:${BACKEND}`, SIM_FRONTEND_PORT: String(FRONTEND) },
      url: `http://127.0.0.1:${FRONTEND}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
