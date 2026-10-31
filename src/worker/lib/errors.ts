import type { ApiErrorBody, ApiErrorCode } from "../../shared/api.ts";

/** Error ที่มีข้อความไทยพร้อมแสดงผู้ใช้ */
export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterSec?: number;

  constructor(status: number, code: ApiErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfterSec !== undefined ? { retryAfterSec: this.retryAfterSec } : {}),
      },
    };
  }

  toResponse(): Response {
    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
    if (this.retryAfterSec !== undefined) headers["Retry-After"] = String(this.retryAfterSec);
    return new Response(JSON.stringify(this.toBody()), { status: this.status, headers });
  }
}
