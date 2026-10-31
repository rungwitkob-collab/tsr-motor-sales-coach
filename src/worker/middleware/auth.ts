/** ตรวจ passcode ทุก request เพื่อป้องกันคนนอกใช้ Gemini key ของทีม */
import type { MiddlewareHandler } from "hono";
import { PASSCODE_HEADER } from "../../shared/limits.ts";
import type { AppBindings } from "../env.ts";
import { AppError } from "../lib/errors.ts";

const encoder = new TextEncoder();

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(value));
}

/** เปรียบเทียบแบบ constant-time (hash ก่อนเพื่อให้ความยาวเท่ากัน) */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function decodeHeader(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export const passcodeAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const expected = c.env.APP_PASSCODE?.trim();
  if (!expected) {
    throw new AppError(500, "CONFIG_ERROR", "ยังไม่ได้ตั้งค่า APP_PASSCODE ให้หัวหน้าทีมรัน npx wrangler secret put APP_PASSCODE");
  }
  const provided = decodeHeader(c.req.header(PASSCODE_HEADER) ?? "").trim();
  if (!provided || !(await safeEqual(provided, expected))) {
    throw new AppError(401, "UNAUTHORIZED", "รหัสผ่านทีมไม่ถูกต้อง กรุณากรอกใหม่ หรือสอบถามหัวหน้าทีม");
  }
  await next();
};
