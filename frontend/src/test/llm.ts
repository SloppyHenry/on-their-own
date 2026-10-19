import type { InstalledOut, LlmStatusOut, TransferOut } from "../types/generated";

export function makeInstalled(over: Partial<InstalledOut> = {}): InstalledOut {
  return { id: "Qwen3-8B-Q4_K_M", file: "Qwen3-8B-Q4_K_M.gguf", name: "Qwen3-8B", repo: "Qwen/Qwen3-8B-GGUF", quant: "Q4_K_M", size_bytes: 5_027_783_488, size_mb: 4795, license: "Apache-2.0", source: "tool",
    running: false, is_default: false, is_sim_model: false, probe: null, ...over };
}

export function makeTransfer(over: Partial<TransferOut> = {}): TransferOut {
  return { id: "t1", kind: "model", label: "Qwen3-8B", file: "Qwen3-8B-Q4_K_M.gguf", source: "https://huggingface.co/Qwen/Qwen3-8B-GGUF", total: 1000, done: 0, phase: "downloading", speed_bps: 0, eta_s: null, error: null, model_id: "Qwen3-8B-Q4_K_M", ...over };
}

export function makeLlmStatus(over: Partial<LlmStatusOut> = {}): LlmStatusOut {
  return { mode: "builtin", locked: false, external_url: null, external_key_set: false, base_url: "http://127.0.0.1:50000/v1", sim_model: "qwen3.8-9b-uncensored", sim_running: false, default_model: null,
    runtime: { installed: true, version: "b6532", kind: "metal", binary: "/x/llama-server", state: "stopped", model_id: null, error: null, log_tail: [] },
    installed: [], transfer: null, probe: null, ...over };
}
