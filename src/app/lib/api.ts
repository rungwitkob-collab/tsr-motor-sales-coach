/** เรียก API ของ Worker พร้อมแนบ passcode และแปลง error เป็นข้อความไทย */
import type { ApiErrorBody, ApiErrorCode, EvaluateResponse, PersonasResponse } from "../../shared/api.ts";
import { PASSCODE_HEADER, TRAINEE_HEADER } from "../../shared/limits.ts";
import type {
  EvaluateRequest,
  ObjectionFeedback,
  ObjectionRequest,
  PitchRequest,
  PitchResult,
  ProgressData,
  QuizRequest,
  QuizResponse,
  RoleplayRequest,
} from "../../shared/schemas.ts";
import { clearPasscode, getPasscode, notifyUnauthorized } from "./passcode.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterSec?: number;

  constructor(status: number, code: ApiErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

const NETWORK_MESSAGE = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
  /** ใช้ตอนตรวจ passcode ครั้งแรก (ยังไม่ได้บันทึก) */
  passcode?: string;
  headers?: Record<string, string>;
}

function buildHeaders(opts: RequestOptions): Headers {
  const headers = new Headers(opts.headers);
  if (opts.body !== undefined) headers.set("Content-Type", "application/json");
  const passcode = opts.passcode ?? getPasscode();
  // encodeURIComponent เพื่อให้ส่งรหัสภาษาไทยใน header ได้
  if (passcode) headers.set(PASSCODE_HEADER, encodeURIComponent(passcode));
  return headers;
}

async function toApiError(res: Response, isPasscodeCheck: boolean): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // ไม่ใช่ JSON
  }
  const retryHeader = Number(res.headers.get("Retry-After"));
  const retryAfterSec = body.error?.retryAfterSec ?? (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined);
  const code: ApiErrorCode = body.error?.code ?? (res.status === 401 ? "UNAUTHORIZED" : "UPSTREAM_ERROR");
  const message = body.error?.message ?? `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (${res.status}) กรุณาลองใหม่`;
  if (res.status === 401 && !isPasscodeCheck) {
    clearPasscode();
    notifyUnauthorized();
  }
  return new ApiError(res.status, code, message, retryAfterSec);
}

async function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: buildHeaders(opts),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", NETWORK_MESSAGE);
  }
  if (!res.ok) throw await toApiError(res, opts.passcode !== undefined);
  return res;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawFetch(path, opts);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, "INVALID_AI_RESPONSE", "ได้รับข้อมูลที่อ่านไม่ได้จากเซิร์ฟเวอร์ กรุณาลองใหม่");
  }
}

export const api = {
  checkPasscode: (passcode: string) =>
    request<{ ok: true; model: string }>("/api/auth/check", { method: "POST", body: {}, passcode }),
  personas: (signal?: AbortSignal) => request<PersonasResponse>("/api/personas", { signal }),
  evaluate: (body: EvaluateRequest, signal?: AbortSignal) =>
    request<EvaluateResponse>("/api/evaluate", { body, signal }),
  objection: (body: ObjectionRequest, signal?: AbortSignal) =>
    request<ObjectionFeedback>("/api/objection", { body, signal }),
  pitch: (body: PitchRequest, signal?: AbortSignal) => request<PitchResult>("/api/pitch", { body, signal }),
  quiz: (body: QuizRequest, signal?: AbortSignal) => request<QuizResponse>("/api/quiz", { body, signal }),
  getProgress: (traineeId: string) =>
    request<{ progress: ProgressData | null }>("/api/progress", {
      headers: { [TRAINEE_HEADER]: encodeURIComponent(traineeId) },
    }),
  putProgress: (traineeId: string, data: ProgressData) =>
    request<{ ok: true }>("/api/progress", {
      method: "PUT",
      body: data,
      headers: { [TRAINEE_HEADER]: encodeURIComponent(traineeId) },
    }),
};

/* ------------------------------------------------------------------ */
/* Streaming roleplay: Worker ส่ง SSE ดิบของ Gemini มา เราแยกข้อความเอง */
/* ------------------------------------------------------------------ */

interface GeminiStreamChunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string };
}

const SAFETY_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);
const STREAM_IDLE_TIMEOUT_MS = 30_000;

function safetyError(): ApiError {
  return new ApiError(
    422,
    "SAFETY_BLOCKED",
    "ข้อความนี้ติดตัวกรองความปลอดภัยของ AI ลองเรียบเรียงใหม่ให้สุภาพหรือเป็นกลางขึ้นแล้วส่งอีกครั้ง",
  );
}

export async function streamRoleplay(
  body: RoleplayRequest,
  handlers: { onDelta: (fullText: string) => void; signal?: AbortSignal },
): Promise<{ text: string; finishReason?: string }> {
  const controller = new AbortController();
  let timedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, STREAM_IDLE_TIMEOUT_MS);
  };
  const onExternalAbort = () => controller.abort();
  handlers.signal?.addEventListener("abort", onExternalAbort);

  let full = "";
  let finishReason: string | undefined;

  const handleLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk: GeminiStreamChunk;
    try {
      chunk = JSON.parse(data) as GeminiStreamChunk;
    } catch {
      return;
    }
    if (chunk.error) {
      if (chunk.error.code === 429) {
        throw new ApiError(429, "QUOTA_EXCEEDED", "โควตา AI เต็มระหว่างสนทนา กรุณารอประมาณ 60 วินาทีแล้วส่งใหม่", 60);
      }
      throw new ApiError(502, "UPSTREAM_ERROR", "ระบบ AI ขัดข้องระหว่างตอบ กรุณาส่งข้อความอีกครั้ง");
    }
    if (chunk.promptFeedback?.blockReason) throw safetyError();
    const cand = chunk.candidates?.[0];
    const piece = (cand?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("");
    if (piece) {
      full += piece;
      handlers.onDelta(full);
    }
    if (cand?.finishReason) finishReason = cand.finishReason;
  };

  try {
    resetIdle();
    const res = await rawFetch("/api/roleplay", { body, signal: controller.signal });
    if (!res.body) throw new ApiError(502, "UPSTREAM_ERROR", "ไม่ได้รับข้อมูลจากเซิร์ฟเวอร์ กรุณาลองใหม่");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);
  } catch (err) {
    if (timedOut) throw new ApiError(504, "TIMEOUT", "ลูกค้าตอบช้าเกินไป (AI ไม่ตอบภายใน 30 วินาที) กรุณาส่งข้อความอีกครั้ง");
    throw err;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    handlers.signal?.removeEventListener("abort", onExternalAbort);
  }

  if (!full.trim()) {
    if (finishReason && SAFETY_REASONS.has(finishReason)) throw safetyError();
    throw new ApiError(502, "INVALID_AI_RESPONSE", "ลูกค้าเงียบไป (AI ไม่ได้ตอบกลับ) กรุณาส่งข้อความอีกครั้ง");
  }
  return { text: full, finishReason };
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return `เกิดข้อผิดพลาด: ${err.message}`;
  return "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่";
}
