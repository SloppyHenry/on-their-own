// Zugangsschutz im Heimnetz (optional): ein Token, einmal eingeben, danach merkt sich der Browser es als Cookie.
import { useState } from "react";
import { ApiError, api } from "../net/api";

export function Login({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(token);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 429 ? "Zu viele Versuche, bitte eine Minute warten." : "Das Token stimmt nicht.") : "Backend nicht erreichbar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid h-full place-items-center">
      <form onSubmit={submit} className="w-80 rounded-xl border border-line bg-panel p-6" data-testid="login">
        <h1 className="text-[13px] font-semibold tracking-[0.18em]">ON THEIR OWN</h1>
        <p className="mt-3 text-sm text-dim">Diese Simulation ist geschützt. Bitte das Zugangs-Token eingeben.</p>
        <label className="mt-4 block text-xs text-dim" htmlFor="token">Token</label>
        <input id="token" type="password" autoFocus autoComplete="current-password" className="mt-1 w-full rounded-md border border-line bg-bg px-2 py-1.5" value={token} onChange={(e) => setToken(e.target.value)} />
        {error && <p className="mt-2 text-xs text-warn" role="alert">{error}</p>}
        <button className="btn on mt-4 w-full" disabled={busy || !token}>Anmelden</button>
      </form>
    </main>
  );
}
