import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { resolveProviderKey, type ProviderKey } from "./providers";
import { normalizeContractAnalysis, type ContractAnalysis } from "./contractAnalysis";
import { buildAssistantSystem } from "./assistantSystem";
import { drafterId, UNKNOWN_DRAFTER } from "./ai/drafterId";

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

/**
 * The next provider to try if the primary one (`aiProvider()`) is configured
 * but fails at call time — an invalid/expired key, no credits, a transient
 * outage. Without this, a broken Anthropic key made the assistant fail
 * outright even when a working Gemini key sat right next to it in the same
 * environment, unused.
 */
function secondaryProvider(): AiProvider | null {
  const primary = aiProvider();
  if (primary !== "openai" && openaiCompatConfig()) return "openai";
  if (primary !== "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (primary !== "ollama" && ollamaConfigured()) return "ollama";
  return null;
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

/**
 * Rank a key's actual model list: prefer our known-good order, then any other
 * flash-family generateContent model, newest-looking first. Pure — tested.
 */
export function rankGeminiModels(available: string[]): string[] {
  const usable = available.filter(
    (m) => /flash/i.test(m) && !/(embedding|tts|image|live|audio|thinking)/i.test(m),
  );
  const preferred = GEMINI_FALLBACK_MODELS.filter((m) => usable.includes(m));
  const rest = usable.filter((m) => !preferred.includes(m)).sort((a, b) => b.localeCompare(a));
  return [...preferred, ...rest];
}

/** Discover which models THIS key can use; cached per server instance. */
let geminiModelCache: { models: string[]; at: number } | null = null;

async function geminiCandidateModels(apiKey: string): Promise<string[]> {
  if (geminiModelCache && Date.now() - geminiModelCache.at < 10 * 60 * 1000) {
    return geminiModelCache.models;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${apiKey}`,
    );
    if (res.ok) {
      const data = (await res.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      };
      const names = (data.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => (m.name ?? "").replace(/^models\//, ""))
        .filter(Boolean);
      const ranked = rankGeminiModels(names);
      if (ranked.length > 0) {
        geminiModelCache = { models: ranked, at: Date.now() };
        return ranked;
      }
    }
  } catch {
    /* fall through to the static list */
  }
  return GEMINI_FALLBACK_MODELS;
}

/**
 * Minimal Gemini REST call (no extra SDK dependency). Mirrors the shape we
 * need from the Anthropic paths: system instruction + user text (+ optional
 * inline image) → plain text out.
 */
async function geminiGenerate(opts: {
  system: string;
  userText: string;
  imageBase64?: string;
  mediaType?: string;
  maxTokens: number;
  temperature?: number;
  /**
   * Try this model FIRST (e.g. a smarter "pro" model for open-ended reasoning).
   * If the key can't use it, or its quota is spent, we fall through to the
   * normal ranked candidates — quality upgrade, never a reliability regression.
   */
  preferModel?: string;
  /** Reports the provider and model that actually served this call. */
  onModel?: (provider: AiProvider, model: string) => void;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiUnavailableError();

  const parts: Array<Record<string, unknown>> = [];
  if (opts.imageBase64) {
    parts.push({ inline_data: { mime_type: opts.mediaType || "image/jpeg", data: opts.imageBase64 } });
  }
  parts.push({ text: opts.userText });

  // One request to a specific model. `noThinking` adds thinkingConfig, which
  // stops Gemini 2.5 models from spending the output budget on hidden
  // "thinking" tokens — the usual cause of answers that truncate mid-sentence.
  const callModel = (model: string, noThinking: boolean) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            maxOutputTokens: opts.maxTokens,
            ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
            ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      },
    );

  const discovered = await geminiCandidateModels(apiKey);
  // Prepend the preferred model (deduped) so quality-sensitive calls try it
  // first, then gracefully degrade through the discovered flash candidates.
  const candidates = opts.preferModel
    ? [opts.preferModel, ...discovered.filter((m) => m !== opts.preferModel)]
    : discovered;
  let lastError = "no model candidates";
  for (const model of candidates) {
    let res = await callModel(model, true);
    // If a model rejects thinkingConfig (400), retry it WITHOUT that field so
    // this optimization can never break an otherwise-working model.
    if (res.status === 400) res = await callModel(model, false);

    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("\n")
        .trim();
      if (text) {
        opts.onModel?.("gemini", model);
        return text;
      }
      lastError = `Gemini ${model}: empty response`;
      continue;
    }

    // Pull Google's own message — the difference between "invalid key",
    // "quota exceeded" and "model not found" is everything when debugging.
    const errBody = (await res.json().catch(() => null)) as {
      error?: { message?: string; status?: string };
    } | null;
    lastError = `Gemini ${model}: ${res.status} ${errBody?.error?.status ?? ""} ${(errBody?.error?.message ?? "").slice(0, 160)}`.trim();
    // 404 = this key doesn't have the model; 429 = THIS model's quota is
    // spent (quotas are per-model!) — both warrant trying the next candidate.
    if (res.status !== 404 && res.status !== 429) break;
  }
  throw new Error(lastError);
}

/**
 * Local model via Ollama (self-hosted, no API key, no per-call cost). Uses the
 * native /api/chat endpoint, which accepts base64 images for vision models
 * (e.g. llava, llama3.2-vision). Point OLLAMA_BASE_URL at the machine running
 * `ollama serve`; set OLLAMA_MODEL to the pulled model (default: llama3.1).
 *
 * Note on hosting: Ollama runs on YOUR computer, so a cloud deployment (Vercel)
 * can only reach it if that machine is exposed to the internet (e.g. a tunnel).
 * Locally, or on a self-hosted server, it works out of the box.
 */
async function ollamaGenerate(opts: {
  system: string;
  userText: string;
  imageBase64?: string;
  mediaType?: string;
  maxTokens: number;
  temperature?: number;
  /** Reports the provider and model that actually served this call. */
  onModel?: (provider: AiProvider, model: string) => void;
}): Promise<string> {
  const base = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.1";

  const userMessage: Record<string, unknown> = { role: "user", content: opts.userText };
  if (opts.imageBase64) userMessage.images = [opts.imageBase64];

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "system", content: opts.system }, userMessage],
      options: {
        num_predict: opts.maxTokens,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 160);
    throw new Error(`Ollama ${model}: ${res.status} ${detail}`.trim());
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const text = (data.message?.content ?? "").trim();
  if (!text) throw new Error(`Ollama ${model}: empty response`);
  opts.onModel?.("ollama", model);
  return text;
}

/**
 * OpenAI-compatible chat endpoint (DeepSeek / OpenRouter / Together / …).
 * DeepSeek's `deepseek-chat` is a strong, cheap model — the recommended way to
 * make the assistant genuinely smart without an Anthropic key.
 */
async function openaiCompatGenerate(opts: {
  system: string;
  userText: string;
  imageBase64?: string;
  mediaType?: string;
  maxTokens: number;
  temperature?: number;
  /** Reports the provider and model that actually served this call. */
  onModel?: (provider: AiProvider, model: string) => void;
}): Promise<string> {
  const cfg = openaiCompatConfig();
  if (!cfg) throw new AiUnavailableError();

  // Vision uses the OpenAI content-array shape; text-only models ignore it.
  const userContent: unknown = opts.imageBase64
    ? [
        { type: "text", text: opts.userText },
        {
          type: "image_url",
          image_url: { url: `data:${opts.mediaType || "image/jpeg"};base64,${opts.imageBase64}` },
        },
      ]
    : opts.userText;

  const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: userContent },
      ],
      max_tokens: opts.maxTokens,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`OpenAI-compat ${cfg.model}: ${res.status} ${detail}`.trim());
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error(`OpenAI-compat ${cfg.model}: empty response`);
  opts.onModel?.("openai", cfg.model);
  return text;
}

/**
 * Dispatch a text/vision generation to whichever non-Anthropic provider is
 * active. Keeps the four call sites below to a single branch each.
 */
async function fallbackGenerate(
  opts: {
    system: string;
    userText: string;
    imageBase64?: string;
    mediaType?: string;
    maxTokens: number;
    temperature?: number;
    /** Gemini-only: a stronger model to try first (ignored by other providers). */
    geminiPreferModel?: string;
    /** Reports the provider and model that actually served this call. */
    onModel?: (provider: AiProvider, model: string) => void;
  },
  /** Explicit provider (used when retrying after the primary failed at call time). */
  forceProvider?: AiProvider,
): Promise<string> {
  const provider = forceProvider ?? aiProvider();
  if (provider === "openai") return openaiCompatGenerate(opts);
  if (provider === "ollama") return ollamaGenerate(opts);
  if (provider === "gemini") return geminiGenerate({ ...opts, preferModel: opts.geminiPreferModel });
  throw new AiUnavailableError();
}

/**
 * LLM FinOps — two levers, applied to every call in this file:
 *
 * 1. MODEL ROUTING: mechanical extraction (bill OCR → JSON) goes to a small,
 *    fast, cheap model; open-ended drafting/reasoning goes to the stronger
 *    model. Both overridable per-deployment via env.
 * 2. PROMPT CACHING: the long, stable instructions live in a `system` block
 *    flagged with `cache_control` and NEVER contain dynamic values; per-request
 *    data (amounts, names, images) goes last, in the user message. Cached
 *    input tokens are billed at ~10% of list price, so repeated calls within
 *    the TTL cut input cost by up to ~90%.
 */
const DRAFT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const EXTRACT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL || "claude-haiku-4-5";

/** A system block that opts into prompt caching. Text must be stable. */
function cachedSystem(text: string) {
  return [{ type: "text" as const, text, cache_control: { type: "ephemeral" as const } }];
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

/**
 * Single entry point for every "generate text, maybe with an image" call in
 * this file. When Anthropic is configured but fails at call time (bad key,
 * no credits, transient outage), retries via the next configured provider
 * instead of throwing — same resilience as askZakai's assistant chat, now
 * shared by every AI feature that has no other fallback of its own (bill
 * OCR, receipt OCR, statement extraction, contract analysis). Callers that
 * already degrade to a non-AI fallback (generateRecommendation → template,
 * extractSavingsFromEmail → regex) keep their own try/catch and don't need
 * this — a second AI attempt there would just delay reaching a fallback
 * that's already correct.
 */
async function generateText(opts: {
  system: string;
  userText: string;
  imageBase64?: string;
  mediaType?: string;
  model: string;
  maxTokens: number;
  temperature?: number;
  geminiPreferModel?: string;
  /**
   * Called with the provider and model that actually produced the text, after
   * the call succeeds — including when a fallback provider handled it.
   *
   * It is a callback rather than a return value so that adding attribution did
   * not have to touch all ~15 call sites. The distinction that matters is that
   * it reports the executed call, never the configuration: the two differ
   * exactly when the primary provider failed, which is precisely when a
   * configuration-derived answer would be wrong.
   */
  onModel?: (provider: AiProvider, model: string) => void;
}): Promise<string> {
  if (aiProvider() !== "anthropic") return fallbackGenerate(opts);

  async function callAnthropic(): Promise<string> {
    const anthropic = client();
    const msg = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0,
      system: cachedSystem(opts.system),
      messages: [
        {
          role: "user",
          content: opts.imageBase64
            ? [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: (opts.mediaType ?? "image/jpeg") as "image/jpeg",
                    data: opts.imageBase64,
                  },
                },
                { type: "text", text: opts.userText },
              ]
            : opts.userText,
        },
      ],
    });
    // Reported after the call returns, and from the response's own model
    // field where the API echoes it, so an alias like "claude-sonnet-5"
    // resolves to whatever actually served the request.
    opts.onModel?.("anthropic", msg.model || opts.model);
    return msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
  }

  try {
    return await callAnthropic();
  } catch (err) {
    const secondary = secondaryProvider();
    if (!secondary) throw err;
    return fallbackGenerate(opts, secondary);
  }
}

// ---------- Bill image analysis (OCR) ----------

export interface BillAnalysis {
  provider: ProviderKey;
  amountShekels: number;
  plan: string;
  readable: boolean;
}

const BILL_EXTRACT_SYSTEM = `You extract data from photos of Israeli MOBILE phone bills. Extract the provider name, the monthly charge as a plain ILS number, and a short Hebrew plan description if visible. If the image is not a readable bill, set readable=false. Respond ONLY with JSON: {"provider":"...","amount":number_or_null,"plan":"...","readable":boolean}`;

/**
 * Name the document. Do not act on it.
 *
 * This exists because every other image entry point here is scoped to one
 * document type and answers everything else with `readable: false`, which the
 * UI shows as "I couldn't read the image, try a clearer photo". A sharp,
 * well-lit electricity bill uploaded on /check got told to try a better
 * picture — the app blaming the camera for a document it never handled.
 *
 * The model's whole job is the label. Where a label leads is decided by
 * `routeDocument` in documentRouter.ts, in product code, tested without a
 * network call — the same LLM-proposes / code-executes split used everywhere
 * else in this file.
 */
const DOCUMENT_CLASSIFY_SYSTEM = `You identify what kind of document an image shows. Israeli context (Hebrew text common). Choose exactly one "kind" from this closed list:
- "mobile_bill": a cellular/mobile phone bill (Cellcom, Partner, Pelephone, HOT Mobile, Golan, Rami Levy…)
- "internet_bill": home internet / TV / landline bill (Bezeq, HOT, Partner Fiber…)
- "electricity_bill": an electricity bill (חשמל, IEC)
- "water_bill": a water bill (מים, תאגיד מים)
- "arnona_bill": a municipal property tax notice (ארנונה)
- "bank_statement": a bank account statement or transaction list
- "card_statement": a credit-card statement or transaction list
- "receipt": a shop/restaurant/service receipt or a one-off invoice
- "subscription_notice": a subscription charge, renewal or cancellation notice
- "insurance_policy": an insurance policy or premium notice
- "unknown": anything else, or too blurry/dark/cropped to tell

Set "legible" to false ONLY when the image itself cannot be read (blur, glare, cut off). A clear document of a type not listed above is legible with kind "unknown" — never call a readable image illegible just because it is not a phone bill.

Respond ONLY with JSON: {"kind":"...","legible":boolean,"issuer":"..." or null}`;

export interface DocumentClassification {
  /** Validated against the closed set by the caller; may be any string here. */
  kind: string;
  /** False only when the image is genuinely unreadable, not merely off-topic. */
  legible: boolean;
  /** Provider/issuer name if visible, for a more specific message. */
  issuer: string | null;
}

export async function classifyDocumentImage(
  base64: string,
  mediaType: string,
): Promise<DocumentClassification> {
  const text = await generateText({
    system: DOCUMENT_CLASSIFY_SYSTEM,
    userText: "Identify this document.",
    imageBase64: base64,
    mediaType,
    model: EXTRACT_MODEL,
    maxTokens: 200,
    temperature: 0,
  });
  const parsed = extractJson(text) as {
    kind?: string;
    legible?: boolean;
    issuer?: string | null;
  };
  return {
    kind: typeof parsed.kind === "string" ? parsed.kind : "unknown",
    // Absent means readable: an omitted flag must not turn a good photo into
    // the camera error this whole path exists to stop showing.
    legible: parsed.legible !== false,
    issuer: typeof parsed.issuer === "string" && parsed.issuer.trim() ? parsed.issuer.trim() : null,
  };
}

export async function analyzeBillImage(
  base64: string,
  mediaType: string,
): Promise<BillAnalysis> {
  const text = await generateText({
    system: BILL_EXTRACT_SYSTEM,
    userText: "Extract this bill.",
    imageBase64: base64,
    mediaType,
    model: EXTRACT_MODEL,
    maxTokens: 400,
    temperature: 0,
  });
  const parsed = extractJson(text) as {
    provider?: string;
    amount?: number | null;
    plan?: string;
    readable?: boolean;
  };
  return {
    provider: resolveProviderKey(parsed.provider ?? "other"),
    amountShekels: parsed.amount ?? 0,
    plan: parsed.plan ?? "",
    readable: Boolean(parsed.readable) && Boolean(parsed.amount),
  };
}

// ---------- Receipt / invoice extraction (receipt collector) ----------

export type ReceiptCategory = "business_deductible" | "recurring" | "personal" | "other";

export interface ReceiptAnalysis {
  vendor: string;
  amountShekels: number;
  currency: string;
  /** ISO date (yyyy-mm-dd) if the receipt shows one, else null. */
  date: string | null;
  category: ReceiptCategory;
  /** True when VAT is itemized on the receipt — relevant for the business export. */
  hasVat: boolean;
  readable: boolean;
}

const RECEIPT_EXTRACT_SYSTEM = `You extract data from a photo of ANY receipt or invoice (paper or digital, any vendor — retail, restaurant, service, subscription, professional). Extract: the vendor/merchant name, the total amount charged as a plain number, the currency (ISO code, default ILS if a shekel symbol or Israeli vendor), the date if visible (yyyy-mm-dd), whether VAT/tax is itemized as a separate line, and a category guess: "business_deductible" (a plausible tax-deductible business expense — office supplies, professional services, business travel), "recurring" (a subscription or membership renewal), "personal" (an ordinary personal purchase), or "other" if unclear. If the image is not a readable receipt, set readable=false. Respond ONLY with JSON: {"vendor":"...","amount":number_or_null,"currency":"ILS","date":"yyyy-mm-dd"_or_null,"category":"business_deductible"|"recurring"|"personal"|"other","hasVat":boolean,"readable":boolean}`;

export async function analyzeReceiptImage(
  base64: string,
  mediaType: string,
): Promise<ReceiptAnalysis> {
  const text = await generateText({
    system: RECEIPT_EXTRACT_SYSTEM,
    userText: "Extract this receipt.",
    imageBase64: base64,
    mediaType,
    model: EXTRACT_MODEL,
    maxTokens: 400,
    temperature: 0,
  });
  const parsed = extractJson(text) as {
    vendor?: string;
    amount?: number | null;
    currency?: string;
    date?: string | null;
    category?: string;
    hasVat?: boolean;
    readable?: boolean;
  };
  const category: ReceiptCategory =
    parsed.category === "business_deductible" ||
    parsed.category === "recurring" ||
    parsed.category === "personal"
      ? parsed.category
      : "other";
  return {
    vendor: (parsed.vendor ?? "").trim().slice(0, 120),
    amountShekels: parsed.amount ?? 0,
    currency: (parsed.currency ?? "ILS").trim().slice(0, 8) || "ILS",
    date: parsed.date ?? null,
    category,
    hasVat: Boolean(parsed.hasVat),
    readable: Boolean(parsed.readable) && Boolean(parsed.amount) && Boolean(parsed.vendor?.trim()),
  };
}

// ---------- Recommendation + outreach draft ----------

export interface Recommendation {
  strategy: string; // one sentence, in the user's UI language
  targetShekels: number;
  marketLowShekels: number;
  marketHighShekels: number;
  draftMessage: string; // outreach body, always Hebrew (the provider reads Hebrew)
  source: "ai" | "template";
  /**
   * Which model actually wrote `draftMessage`, as "provider:model", so the
   * outcome graph can later say whether it was worth using. `UNKNOWN_DRAFTER`
   * for the deterministic template, because no model wrote that one — folding
   * template outcomes into a model's record would inflate or wreck it.
   */
  drafterId: string;
}

export interface RecommendationInput {
  providerLabel: string;
  amountShekels: number;
  plan: string;
  locale: string;
  customerName: string;
  /**
   * How to pitch this one, chosen by the Strategy Engine from what has
   * actually been getting paid by this counterparty. Absent = the model's own
   * default, which is what every draft used before the engine existed.
   */
  stance?: string[];
}

export async function generateRecommendation(
  input: RecommendationInput,
): Promise<Recommendation> {
  if (!aiAvailable()) return templateRecommendation(input);
  try {
    return await aiRecommendation(input);
  } catch {
    // Any AI failure degrades to the honest template rather than blocking.
    return templateRecommendation(input);
  }
}

const RECOMMENDATION_SYSTEM = `You are Zakai, a consumer-advocacy AI agent for Israeli consumers (an automated tool, NOT a claimed human-level negotiation expert).
Given a customer's current mobile bill, produce:
1. A one-sentence strategy in the requested language (loyalty discount / downgrade / retention pricing). Framed as an approach, not a promise.
2. A realistic target monthly amount (plain number, lower than the current amount).
3. A low-high ILLUSTRATIVE market range (two plain numbers) for comparison context only — clearly an estimate, not scraped live pricing.
4. A polite, professional outreach message in HEBREW (120-160 words) written as Zakai on the customer's behalf. It MUST state Zakai is a digital agent acting with the customer's authorization, must NOT impersonate the customer, and must invite the provider to contact the customer directly. Do NOT promise any outcome.
Respond ONLY with JSON: {"strategy":"...","targetAmount":number,"marketLow":number,"marketHigh":number,"message":"..."}`;

async function aiRecommendation(input: RecommendationInput): Promise<Recommendation> {
  const langName =
    { he: "Hebrew", en: "English", ar: "Arabic", ru: "Russian" }[input.locale] ?? "Hebrew";
  const stance = input.stance?.length
    ? `\n\nHow to pitch this one (chosen from what has actually been getting paid by this counterparty — follow it):\n- ${input.stance.join("\n- ")}`
    : "";
  const userText = `Customer pays ${input.amountShekels} ILS/month to ${input.providerLabel} for: "${input.plan || "a standard mobile plan"}". Customer name: "${input.customerName}". Strategy language: ${langName}.${stance}`;

  let text: string;
  // Set from the call that actually ran, never from configuration.
  let usedDrafter = UNKNOWN_DRAFTER;
  const onModel = (provider: AiProvider, model: string) => {
    usedDrafter = drafterId(provider, model);
  };
  if (aiProvider() !== "anthropic") {
    text = await fallbackGenerate({ system: RECOMMENDATION_SYSTEM, userText, maxTokens: 900, temperature: 0.5, onModel });
  } else {
    const anthropic = client();
    const msg = await anthropic.messages.create({
      model: DRAFT_MODEL,
      max_tokens: 900,
      temperature: 0.5,
      // Stable persona + format contract, cached; customer specifics go last.
      system: cachedSystem(RECOMMENDATION_SYSTEM),
      messages: [{ role: "user", content: userText }],
    });
    text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    usedDrafter = drafterId("anthropic", msg.model || DRAFT_MODEL);
  }
  const p = extractJson(text) as {
    strategy: string;
    targetAmount: number;
    marketLow: number;
    marketHigh: number;
    message: string;
  };
  return {
    strategy: p.strategy,
    targetShekels: Math.round(p.targetAmount),
    marketLowShekels: Math.round(p.marketLow),
    marketHighShekels: Math.round(p.marketHigh),
    draftMessage: p.message,
    source: "ai",
    drafterId: usedDrafter,
  };
}

// ---------- Statement screenshot extraction ----------

/**
 * Extract transaction rows from a SCREENSHOT of a bank/credit-card app —
 * the zero-friction path for users who never exported a CSV in their life.
 * Returns CSV text ("dd/mm/yyyy,merchant,amount" lines) that feeds the same
 * deterministic recurring-charges engine as pasted exports. Extraction only —
 * the detection logic stays deterministic and tested.
 */
const STATEMENT_EXTRACT_SYSTEM = `You extract transaction rows from screenshots of Israeli banking / credit-card apps and statements (Hebrew UI common). Output ONLY CSV lines, one per visible transaction, in the exact format: dd/mm/yyyy,merchant name,amount
- amount is the charged amount as a plain number (no currency symbol).
- Skip balances, totals, headers, buttons and any non-transaction text.
- If a year is missing assume the current year visible elsewhere on screen, else 2026.
- If NO transactions are visible, output exactly: NONE`;

export async function extractStatementImage(
  base64: string,
  mediaType: string,
): Promise<string> {
  const text = await generateText({
    system: STATEMENT_EXTRACT_SYSTEM,
    userText: "Extract the transactions.",
    imageBase64: base64,
    mediaType,
    model: EXTRACT_MODEL,
    maxTokens: 1500,
    temperature: 0,
  });
  return text === "NONE" ? "" : text;
}

// ---------- Inbound email savings extract (proof loop) ----------

export interface SavingsEmailExtract {
  found: boolean;
  newAmountShekels: number | null;
  authorizationCode: string | null;
  confidence: number; // 0–1
  reason: string;
  /** Lump cases: whether newAmount is remaining owed vs refund/credit applied. */
  amountKind?: "monthly" | "remaining" | "refund" | null;
}

export interface SavingsEmailExtractContext {
  feeBasis?: "monthly" | "lump";
  originalAmountShekels?: number;
  vertical?: string;
}

const SAVINGS_EMAIL_SYSTEM = `You extract savings-confirmation signals from emails about Israeli consumer bills (mobile, bank fees, subscriptions, flights, parking, etc.).
Look for:
- A new / reduced monthly charge amount (plain number in ILS or ₪).
- An authorization / reference code that looks like ZK-XXXX-XXXX (Zakai format).
- Whether the email is clearly a confirmation of a price reduction, refund, or cancelled charge.
Respond ONLY with JSON: {"found":boolean,"newAmount":number_or_null,"authorizationCode":string_or_null,"confidence":0to1,"reason":"short","amountKind":"monthly"|"remaining"|"refund"|null}`;

function savingsEmailSystemPrompt(ctx?: SavingsEmailExtractContext): string {
  if (ctx?.feeBasis !== "lump") return SAVINGS_EMAIL_SYSTEM;
  const orig = ctx.originalAmountShekels ?? 0;
  const vertical = ctx.vertical ? ` Vertical: ${ctx.vertical}.` : "";
  return `${SAVINGS_EMAIL_SYSTEM}

This email belongs to a ONE-TIME (lump) recovery case. Original amount in dispute was about ${orig} ILS.${vertical}
For amountKind:
- "remaining" — email states how much is still owed / outstanding balance after partial payment.
- "refund" — email states a credit, refund, or payment transferred to the customer (not the remaining balance).
- "monthly" — only if a new recurring monthly rate is explicit (unusual for lump).
Put the relevant number in newAmount. Never invent amounts.`;
}

/**
 * Deterministic fallback when AI is unavailable: regex for ZK- codes and
 * common "new monthly" / "reduced to" patterns. Never invents amounts.
 */
function deterministicSavingsExtract(body: string, ctx?: SavingsEmailExtractContext): SavingsEmailExtract {
  const codeMatch = body.match(/\b(ZK-[A-Z0-9]{4}-[A-Z0-9]{4})\b/i);
  const refundMatch =
    ctx?.feeBasis === "lump"
      ? body.match(
          /(?:הוחזר|זיכוי|זוכה|credit(?:ed)?|refund(?:ed)?)[^\d]{0,40}(?:₪|ILS|ש"ח)?\s*(\d{2,6}(?:\.\d{1,2})?)/i,
        )
      : null;
  const remainingMatch =
    ctx?.feeBasis === "lump"
      ? body.match(
          /(?:יתרה|נותר|remaining|outstanding|חוב נותר)[^\d]{0,40}(?:₪|ILS|ש"ח)?\s*(\d{2,6}(?:\.\d{1,2})?)/i,
        )
      : null;
  const amountMatch =
    remainingMatch ||
    refundMatch ||
    body.match(/(?:חדש|new|reduced to|הופחת ל|סכום חדש|monthly|חודשי)[^\d]{0,40}(?:₪|ILS|ש"ח)?\s*(\d{2,5}(?:\.\d{1,2})?)/i) ||
    body.match(/(?:₪|ILS)\s*(\d{2,5}(?:\.\d{1,2})?)/);
  const amount = amountMatch ? Math.round(Number(amountMatch[1])) : null;
  const amountKind: SavingsEmailExtract["amountKind"] =
    ctx?.feeBasis === "lump"
      ? remainingMatch
        ? "remaining"
        : refundMatch
          ? "refund"
          : null
      : amount != null
        ? "monthly"
        : null;
  const hasCode = Boolean(codeMatch);
  const found = hasCode || (amount != null && amount > 0 && amount < 50000);
  return {
    found,
    newAmountShekels: amount,
    authorizationCode: codeMatch ? codeMatch[1].toUpperCase() : null,
    confidence: hasCode && amount != null ? 0.55 : hasCode ? 0.4 : amount != null ? 0.35 : 0,
    reason: found ? "deterministic" : "no_signal",
    amountKind,
  };
}

export async function extractSavingsFromEmail(
  body: string,
  context?: SavingsEmailExtractContext,
): Promise<SavingsEmailExtract> {
  const system = savingsEmailSystemPrompt(context);
  if (!aiAvailable()) return deterministicSavingsExtract(body, context);
  try {
    let text: string;
    if (aiProvider() !== "anthropic") {
      text = await fallbackGenerate({
        system,
        userText: body.slice(0, 8000),
        maxTokens: 300,
        temperature: 0,
      });
    } else {
      const anthropic = client();
      const msg = await anthropic.messages.create({
        model: EXTRACT_MODEL,
        max_tokens: 300,
        temperature: 0,
        system: cachedSystem(system),
        messages: [{ role: "user", content: body.slice(0, 8000) }],
      });
      text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    }
    const p = extractJson(text) as {
      found?: boolean;
      newAmount?: number | null;
      authorizationCode?: string | null;
      confidence?: number;
      reason?: string;
      amountKind?: SavingsEmailExtract["amountKind"];
    };
    const amountKind =
      p.amountKind === "monthly" || p.amountKind === "remaining" || p.amountKind === "refund"
        ? p.amountKind
        : null;
    return {
      found: Boolean(p.found),
      newAmountShekels: p.newAmount != null ? Math.round(Number(p.newAmount)) : null,
      authorizationCode: p.authorizationCode ? String(p.authorizationCode).toUpperCase() : null,
      confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
      reason: p.reason || "ai",
      amountKind,
    };
  } catch {
    return deterministicSavingsExtract(body, context);
  }
}

// ---------- Contract red-flag summary ----------

const CONTRACT_ANALYSIS_SYSTEM = `You review consumer and small-business contracts in Hebrew or English (lease, gym membership, phone/internet plan, employment offer, vendor/service agreement, terms of service) and flag clauses in plain language for a non-lawyer.

Extract up to 20 clauses that actually matter to a consumer signing this — skip boilerplate (definitions, notices addresses, governing law) unless it's genuinely consequential.

For each clause: quote or closely paraphrase it (short), classify it "green" (favours the reader: fixed price, free exit, reasonable notice) or "red" (should give the reader pause: penalty fees, automatic price increases, auto-renewal, long lock-in, one-sided termination rights, hidden costs), and give one short sentence explaining why in the SAME LANGUAGE as the contract.

Also look specifically for an automatic-renewal clause: set autoRenews=true if the contract renews itself unless cancelled. If — and ONLY if — the contract states an actual renewal, expiry, or notice-deadline DATE in a form you can resolve to a real calendar date, set renewalDate to that date as yyyy-mm-dd. If the contract only gives a duration ("renews annually", "12-month term") with no anchor date to compute from, or you are not confident, leave renewalDate null — never guess or compute a date from "today" or from your own sense of the current date.

If the input is not readable as a contract at all (random text, a shopping list, gibberish), set readable=false and return an empty clauses array — do not force clauses onto unrelated text.

Never invent a clause that isn't actually in the text. Respond ONLY with JSON: {"readable":boolean,"autoRenews":boolean,"renewalDate":"yyyy-mm-dd"_or_null,"clauses":[{"quote":"...","risk":"green"|"red","explanation":"..."}]}`;

/**
 * Read a contract's text and flag clauses for a non-lawyer — bounded output,
 * shaped by `normalizeContractAnalysis` so a malformed or partial model
 * response degrades to "not readable" rather than crashing the caller.
 */
export async function analyzeContractText(text: string): Promise<ContractAnalysis> {
  const input = text.slice(0, 20_000);
  const raw = await generateText({
    system: CONTRACT_ANALYSIS_SYSTEM,
    userText: input,
    model: DRAFT_MODEL,
    maxTokens: 2000,
    temperature: 0,
  });
  try {
    return normalizeContractAnalysis(extractJson(raw));
  } catch {
    return { clauses: [], readable: false, autoRenews: false, renewalDate: null };
  }
}

// ---------- In-app assistant ("הסוכן שלי") ----------

/**
 * The assistant's stable persona/guardrails, built by `buildAssistantSystem()`
 * (agent playbook + FAQ digest + rights catalog — see assistantSystem.ts).
 * NEVER interpolate anything dynamic into it here — it is the cached prefix.
 * The user's own data snapshot and question arrive in the user message,
 * after the cache boundary.
 *
 * Control-plane separation (the trust core of the feature): the model can only
 * TALK. Every real action lives behind existing, gated product flows (check,
 * authorization, ownership verification), so the LLM proposes and the
 * application's permission layer executes — never the other way around.
 */
export interface AssistantContext {
  plan: string;
  casesSummary: string; // compact, pre-serialized snapshot of the user's cases
  locale: string;
}

export async function askZakai(
  question: string,
  ctx: AssistantContext,
  image?: { base64: string; mediaType: string },
): Promise<string> {
  const userText = `[User data snapshot — plan: ${ctx.plan}; locale: ${ctx.locale}]\n${ctx.casesSummary}\n\nQuestion: ${question}`;
  const system = buildAssistantSystem();

  // The assistant is the most reasoning-heavy call in the app, so on Gemini
  // we reach for the smarter "pro" model first (still cheap against a
  // prepaid credit) and fall back to flash automatically if unavailable.
  return generateText({
    system,
    userText,
    imageBase64: image?.base64,
    mediaType: image?.mediaType,
    model: DRAFT_MODEL,
    maxTokens: 1024,
    temperature: 0.3,
    geminiPreferModel: process.env.GEMINI_ASSISTANT_MODEL || "gemini-2.5-pro",
  });
}

/**
 * Deterministic, honest fallback. Targets a ~18% reduction, presents an
 * illustrative market band, and drafts a correct, disclosure-compliant Hebrew
 * outreach body. No claim of being AI.
 */
export function templateRecommendation(input: RecommendationInput): Recommendation {
  const amount = input.amountShekels;
  const target = Math.max(1, Math.round(amount * 0.82));
  const marketLow = Math.max(1, Math.round(amount * 0.7));
  const marketHigh = Math.max(marketLow + 1, Math.round(amount * 0.95));

  const strategy = strategyByLocale(input.locale, input.providerLabel, target);
  const draftMessage = hebrewOutreach(input.customerName, input.providerLabel, amount, target, input.plan);

  return {
    strategy,
    targetShekels: target,
    marketLowShekels: marketLow,
    marketHighShekels: marketHigh,
    draftMessage,
    source: "template",
    drafterId: UNKNOWN_DRAFTER,
  };
}

function strategyByLocale(locale: string, provider: string, target: number): string {
  if (locale === "en") {
    return `Request a loyalty/retention adjustment from ${provider}, aiming for about ₪${target}/month, or a downgrade to a plan matching actual usage.`;
  }
  return `לבקש מ${provider} התאמת מחיר ללקוח קיים (מסלול שימור), יעד של כ-₪${target} בחודש, או מעבר למסלול שתואם את השימוש בפועל.`;
}

function hebrewOutreach(
  customerName: string,
  provider: string,
  amount: number,
  target: number,
  plan: string,
): string {
  const planLine = plan ? ` (מסלול נוכחי: ${plan})` : "";
  return `לכבוד שירות הלקוחות של ${provider},

שמי זכאי, שירות סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח/ה ${customerName} ובהרשאתו/ה המפורשת. אינני הלקוח/ה עצמו/ה.

הלקוח/ה משלם/ת כיום כ-₪${amount} בחודש${planLine}. בשם הלקוח/ה, אני מבקש/ת לבחון התאמת מחיר ללקוח קיים או מעבר למסלול חסכוני יותר, בכיוון של כ-₪${target} בחודש, בהתאם לשימוש בפועל.

מצורף מסמך הרשאה עם קוד אימות שניתן לבדוק. הלקוח/ה זמין/ה ליצירת קשר ישיר לאישור פרטים.

אודה לחזרתכם עם האפשרויות הרלוונטיות.

בברכה,
זכאי — בשם ${customerName}`;
}
