/**
 * Rate limit ต่อ IP แบบ in-memory (ต่อ isolate)
 * ไม่แม่นยำ 100% เพราะ Cloudflare อาจมีหลาย isolate แต่พอสำหรับ MVP และไม่มีค่าใช้จ่าย
 */
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../env.ts";
import { AppError } from "../lib/errors.ts";

const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 5_000;
const buckets = new Map<string, { count: number; windowStart: number }>();

function limitFrom(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

export const rateLimit: MiddlewareHandler<AppBindings> = async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "local";
  const limit = limitFrom(c.env.RATE_LIMIT_PER_MINUTE);
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_IPS) {
    for (const [key, b] of buckets) if (now - b.windowStart > WINDOW_MS) buckets.delete(key);
  }

  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
  } else {
    bucket.count += 1;
    if (bucket.count > limit) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000));
      throw new AppError(
        429,
        "RATE_LIMITED",
        `ส่งคำขอถี่เกินไป (เกิน ${limit} ครั้งต่อนาที) กรุณารอ ${retryAfterSec} วินาทีแล้วลองใหม่`,
        retryAfterSec,
      );
    }
  }
  await next();
};
