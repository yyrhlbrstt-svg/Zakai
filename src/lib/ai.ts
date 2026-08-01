import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { resolveProviderKey, type ProviderKey } from "./providers";
import { normalizeContractAnalysis, type ContractAnalysis } from "./contractAnalysis";
import { buildAssistantSystem } from "./assistantSystem";

/**
 * Server-side AI. The API key never reaches the browser.
 *
 * Two honesty rules baked in here:
 *  1. If no key is configured, image analysis throws `AiUnavailableError` — we
 *     never fabricate an OCR result. The UI falls back to manual entry.
 *  2. Recommendation/outreach generation has a deterministic template fallback.
 *     It is clearly a template, not a claimed-expert AI, and figures are framed
 *     as illustrative estimates — matching the DoNotPay/FTC lesson in the spec.
 */

export class AiUnavailableError extends Error {
  constructor() {
    super("AI_UNAVAILABLE");
    this.name = "AiUnavailableError";
  }
}

/**
 * Provider selection. Three options, in priority order:
 *  1. Anthropic (Claude) — primary, recommended (best quality).
 *  2. Google Gemini — keys obtainable without a credit card; pragmatic
 *     fallback for this project's founder.
 *  3. Ollama — a LOCAL model server (self-hosted, no API key, no per-call
 *     cost). Opt-in: set OLLAMA_BASE_URL (and optionally OLLAMA_MODEL). Runs
 *     on your own machine, so it's used only when no cloud key is present.
 * When several are configured, the highest-priority one wins.
 */
export type AiProvider = "anthropic" | "openai" | "gemini" | "ollama";

/** Ollama is enabled only when explicitly pointed at a server. */
function ollamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL);
}

/**
 * Any OpenAI-compatible chat endpoint — DeepSeek, OpenRouter, Together, Groq,
 * etc. DeepSeek in particular is far stronger than the free Gemini tier and
 * very cheap, so it's the recommended "make the assistant smart" upgrade.
 * Enabled by DEEPSEEK_API_KEY (sets sensible DeepSeek defaults) or the generic
 * OPENAI_COMPAT_API_KEY (bring your own base URL + model).
 */
function openaiCompatConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const deepseek = process.env.DEEPSEEK_API_KEY;
  if (deepseek) {
    return {
      apiKey: deepseek,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    };
  }
  const key = process.env.OPENAI_COMPAT_API_KEY;
  if (key && process.env.OPENAI_COMPAT_BASE_URL) {
    return {
      apiKey: key,
      baseUrl: process.env.OPENAI_COMPAT_BASE_URL,
      model: process.env.OPENAI_COMPAT_MODEL || "gpt-4o-mini",
    };
  }
  return null;
}

export function aiProvider(): AiProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (openaiCompatConfig()) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (ollamaConfigured()) return "ollama";
  return null;
}

export function aiAvailable(): boolean {
  return aiProvider() !== null;
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiUnavailableError();
  return new Anthropic({ apiKey });
}

/**
 * Static fallback candidates (env override first). flash-lite variants carry
 * the largest free-tier quotas, so they follow the full flash models.
 */
const GEMINI_FALLBACK_MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];
