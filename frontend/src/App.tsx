// Platzhalter aus AP00: zeigt nur den Health-Status. Wird in AP04 durch die Leitstelle ersetzt.
import { useEffect, useState } from "react";

interface Health {
  status: string;
  version: string;
  data_dir: string;
  llm: {
    reachable: boolean;
    error: string | null;
    models: string[];
    base_url: string;
    configured_model: string;
    model_available: boolean;
  };
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Simulacra</h1>
      {error && <p className="mt-4 text-red-400">Backend nicht erreichbar: {error}</p>}
      {!health && !error && <p className="mt-4 text-zinc-400">Lade …</p>}
      {health && (
        <section className="mt-4 space-y-2">
          <p>Backend {health.version}: {health.status}</p>
          <p className={health.llm.reachable ? "text-emerald-400" : "text-red-400"}>
            {health.llm.reachable ? "LLM erreichbar" : `LLM nicht erreichbar (${health.llm.error})`}
          </p>
          <p className="text-sm text-zinc-400">
            {health.llm.base_url} · Modell {health.llm.configured_model}
            {health.llm.reachable && !health.llm.model_available && " (nicht im Router!)"}
          </p>
          <ul className="list-disc pl-5 text-sm text-zinc-300">
            {health.llm.models.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
