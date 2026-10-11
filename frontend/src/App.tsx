import { useCallback, useEffect, useState } from "react";
import { Login } from "./auth/Login";
import { AppShell } from "./layout/AppShell";
import { AUTH_REQUIRED, api } from "./net/api";

type Gate = "checking" | "login" | "open";

/** Fragt zuerst, ob ein Zugangsschutz aktiv ist; ohne Token startet die Oberfläche sofort. */
export function App() {
  const [gate, setGate] = useState<Gate>("checking");
  const check = useCallback(() => {
    api.authStatus().then((s) => setGate(s.required && !s.authenticated ? "login" : "open")).catch(() => setGate("open"));   // Backend nicht erreichbar: Oberfläche zeigt „Getrennt“
  }, []);
  useEffect(() => {
    check();
    const again = () => setGate("login");
    window.addEventListener(AUTH_REQUIRED, again);
    return () => window.removeEventListener(AUTH_REQUIRED, again);
  }, [check]);

  if (gate === "checking") return null;
  return gate === "login" ? <Login onDone={() => setGate("open")} /> : <AppShell />;
}
