/**
 * Gemini REST client แบบเบา (ใช้ fetch ตรง ไม่ใช้ SDK)
 * - Worker ทำหน้าที่เป็น proxy เท่านั้น เพื่อให้ CPU time ต่ำกว่า 10 ms ตาม free plan
 * - Streaming: ส่ง SSE ดิบจาก Gemini กลับไปยัง browser โดยไม่ parse ใน Worker
 */
import type { z } from "zod";
import { buildRepairPrompt } from "../../../prompts/repair.ts";
import { modelName, type Env } from "../env.ts";
import { AppError } from "./errors.ts";
import type { GeminiSchema } from "./geminiSchemas.ts";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GeminiCallOptions {
  systemInstruction: string;
  contents: GeminiContent[];
  temperature?: number;
  maxOutputTokens?: number;
  /** งบ thinking token (เฉพาะรุ่น 2.5) 0 = ปิด เพื่อความเร็วและประหยัด quota */
  thinkingBudget?: number;
  timeoutMs?: number;
}

interface GeminiResponsePayload {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

interface GeminiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: {
      "@type"?: string;
      retryDelay?: string;
      reason?: string;
      violations?: { quotaId?: string; quotaMetric?: string }[];
    }[];
  };
}

const SAFETY_FINISH_REASONS = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "RECITATION",
  "IMAGE_SAFETY",
]);

const SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" }));

function supportsThinkingBudget(model: string): boolean {
  return /gemini-2\.5/i.test(model);
}

function buildBody(
  env: Env,
  opts: GeminiCallOptions,
  json?: { schema: GeminiSchema },
): Record<string, unknown> {
  const model = modelName(env);
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
  };
  if (json) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = json.schema;
  }
  if (supportsThinkingBudget(model) && opts.thinkingBudget !== undefined) {
    // gemini-2.5-pro ปิด thinking ไม่ได้ (ขั้นต่ำ 128)
    const min = /pro/i.test(model) ? 128 : 0;
    generationConfig.thinkingConfig = { thinkingBudget: Math.max(min, opts.thinkingBudget) };
  }
  return {
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    contents: opts.contents,
    generationConfig,
    safetySettings: SAFETY_SETTINGS,
  };
}

function parseRetryDelay(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return m ? Math.max(1, Math.ceil(Number(m[1]))) : undefined;
}

/** แปลง error จาก Gemini เป็นข้อความไทยที่ผู้ใช้เข้าใจ */
async function toAppError(res: Response, model: string): Promise<AppError> {
  let payload: GeminiErrorPayload = {};
  try {
    payload = (await res.json()) as GeminiErrorPayload;
  } catch {
    // body ไม่ใช่ JSON ใช้ status อย่างเดียว
  }
  const message = payload.error?.message ?? "";
  const details = payload.error?.details ?? [];

  if (res.status === 429) {
    const retry = details.map((d) => parseRetryDelay(d.retryDelay)).find((n) => n !== undefined);
    const daily = details.some((d) => d.violations?.some((v) => /PerDay/i.test(v.quotaId ?? "")));
    if (daily) {
      return new AppError(
        429,
        "QUOTA_EXCEEDED",
        "โควตา Gemini รายวันของทีมหมดแล้ว โควตาจะรีเซ็ตทุกเที่ยงคืนตามเวลาแปซิฟิก (ประมาณ 14:00-15:00 น. เวลาไทย) ระหว่างนี้ใช้ชุดควิซตั้งต้นและคลังสคริปต์ได้ตามปกติ",
        retry ?? 3600,
      );
    }
    const wait = retry ?? 60;
    return new AppError(
      429,
      "QUOTA_EXCEEDED",
      `ตอนนี้มีคนใช้ AI พร้อมกันเยอะจนโควตาต่อนาทีเต็ม กรุณารอประมาณ ${wait} วินาทีแล้วลองใหม่`,
      wait,
    );
  }
  if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(message + JSON.stringify(details))) {
    return new AppError(500, "CONFIG_ERROR", "GEMINI_API_KEY ไม่ถูกต้อง ให้หัวหน้าทีมตั้งค่าใหม่ด้วย npx wrangler secret put GEMINI_API_KEY");
  }
  if (res.status === 400 && /location is not supported/i.test(message)) {
    return new AppError(500, "CONFIG_ERROR", "Gemini API ยังไม่รองรับภูมิภาคที่ Worker เรียกใช้งาน (ดู Troubleshooting ใน README)");
  }
  if (res.status === 403) {
    return new AppError(500, "CONFIG_ERROR", "API key ไม่มีสิทธิ์ใช้ Gemini API ตรวจสอบ key ใน Google AI Studio");
  }
  if (res.status === 404) {
    return new AppError(500, "CONFIG_ERROR", `ไม่พบ model "${model}" ตรวจสอบค่า GEMINI_MODEL ใน wrangler.jsonc`);
  }
  if (res.status >= 500) {
    return new AppError(503, "UPSTREAM_ERROR", "ระบบ AI ขัดข้องหรือหนาแน่นชั่วคราว กรุณาลองใหม่ในอีกประมาณ 30 วินาที", 30);
  }
  return new AppError(502, "UPSTREAM_ERROR", `AI ปฏิเสธคำขอ (${res.status}) กรุณาลองใหม่ หากยังพบปัญหาให้แจ้งหัวหน้าทีม`);
}

async function fetchGemini(
  env: Env,
  method: "generateContent" | "streamGenerateContent",
  body: Record<string, unknown>,
  timeoutMs: number,
  readJson: boolean,
): Promise<{ res: Response; json?: GeminiResponsePayload }> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(500, "CONFIG_ERROR", "ยังไม่ได้ตั้งค่า GEMINI_API_KEY (ดูขั้นตอนใน README)");
  }
  const model = modelName(env);
  const base = env.GEMINI_API_BASE?.trim().replace(/\/+$/, "") || API_BASE;
  const url = `${base}/${encodeURIComponent(model)}:${method}${method === "streamGenerateContent" ? "?alt=sse" : ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw await toAppError(res, model);
    if (!readJson) return { res };
    const json = (await res.json()) as GeminiResponsePayload;
    return { res, json };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (controller.signal.aborted) {
      throw new AppError(504, "TIMEOUT", `AI ตอบช้าเกิน ${Math.round(timeoutMs / 1000)} วินาที กรุณาลองใหม่อีกครั้ง`);
    }
    throw new AppError(502, "UPSTREAM_ERROR", "เชื่อมต่อระบบ AI ไม่สำเร็จ กรุณาลองใหม่");
  } finally {
    clearTimeout(timer);
  }
}

function extractText(payload: GeminiResponsePayload): { text: string; finishReason?: string; blockReason?: string } {
  const cand = payload.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  return { text, finishReason: cand?.finishReason, blockReason: payload.promptFeedback?.blockReason };
}

function safetyError(): AppError {
  return new AppError(
    422,
    "SAFETY_BLOCKED",
    "AI ไม่สามารถตอบข้อความนี้ได้เพราะติดตัวกรองความปลอดภัย ลองเรียบเรียงข้อความใหม่ให้สุภาพหรือเป็นกลางขึ้น",
  );
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch {
    return { ok: false };
  }
}

/**
 * เรียก generateContent แบบ JSON mode + validate ด้วย zod
 * ถ้า parse/validate ไม่ผ่าน จะ retry 1 ครั้งด้วย prompt ซ่อม
 */
export async function generateJson<S extends z.ZodType>(
  env: Env,
  opts: GeminiCallOptions & { responseSchema: GeminiSchema; zodSchema: S },
): Promise<z.output<S>> {
  let contents = opts.contents;
  for (let attempt = 0; attempt < 2; attempt++) {
    const body = buildBody(env, { ...opts, contents }, { schema: opts.responseSchema });
    const { json } = await fetchGemini(env, "generateContent", body, opts.timeoutMs ?? 45_000, true);
    const { text, finishReason, blockReason } = extractText(json ?? {});
    if (blockReason || (finishReason && SAFETY_FINISH_REASONS.has(finishReason))) throw safetyError();

    let problem: string;
    if (!text) {
      problem = finishReason === "MAX_TOKENS" ? "คำตอบยาวเกินและถูกตัด" : "ไม่มีข้อความตอบกลับ";
    } else {
      const parsed = tryParseJson(text);
      if (parsed.ok) {
        const result = opts.zodSchema.safeParse(parsed.value);
        if (result.success) return result.data;
        problem = result.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
          .join("; ");
      } else {
        problem = finishReason === "MAX_TOKENS" ? "JSON ถูกตัดเพราะยาวเกิน ให้ตอบให้กระชับขึ้น" : "JSON parse error";
      }
    }

    if (attempt === 0) {
      contents = [
        ...opts.contents,
        ...(text ? [{ role: "model" as const, parts: [{ text: text.slice(0, 8000) }] }] : []),
        { role: "user" as const, parts: [{ text: buildRepairPrompt(problem) }] },
      ];
    }
  }
  throw new AppError(
    502,
    "INVALID_AI_RESPONSE",
    "AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง (ระบบลองซ่อมให้แล้ว 1 ครั้ง) กรุณากดลองใหม่อีกครั้ง",
  );
}

/**
 * เรียก streamGenerateContent แล้วส่ง SSE ดิบกลับ browser ทันที (Worker ไม่ parse เพื่อประหยัด CPU)
 * timeout ครอบคลุมช่วงรอ header แรกจาก Gemini ส่วนช่วง stream หน้าเว็บมี idle timeout ของตัวเอง
 */
export async function streamGenerate(env: Env, opts: GeminiCallOptions): Promise<Response> {
  const body = buildBody(env, opts);
  const { res } = await fetchGemini(env, "streamGenerateContent", body, opts.timeoutMs ?? 20_000, false);
  if (!res.body) throw new AppError(502, "UPSTREAM_ERROR", "AI ไม่ได้ส่งข้อมูลกลับมา กรุณาลองใหม่");
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
