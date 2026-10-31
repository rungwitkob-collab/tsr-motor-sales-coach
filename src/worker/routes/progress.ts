/**
 * (ทางเลือกในอนาคต) เก็บสถิติผู้ฝึกบน Cloudflare KV
 * ทำงานเมื่อเพิ่ม binding PROGRESS_KV ใน wrangler.jsonc เท่านั้น ถ้าไม่มีจะตอบ 501
 * MVP ใช้ localStorage ในหน้าเว็บเป็นหลัก
 */
import { Hono } from "hono";
import { LIMITS, TRAINEE_HEADER } from "../../shared/limits.ts";
import { progressSchema } from "../../shared/schemas.ts";
import type { AppBindings, Env } from "../env.ts";
import { AppError } from "../lib/errors.ts";

function requireKv(env: Env): KVNamespace {
  if (!env.PROGRESS_KV) {
    throw new AppError(501, "NOT_CONFIGURED", "ยังไม่ได้เปิดใช้การเก็บสถิติบน KV (ระบบใช้ localStorage ในเครื่องแทน)");
  }
  return env.PROGRESS_KV;
}

function traineeKey(raw: string | undefined): string {
  let id = "";
  try {
    id = decodeURIComponent(raw ?? "").trim();
  } catch {
    id = "";
  }
  if (!id || id.length > 64) throw new AppError(400, "BAD_REQUEST", "กรุณาระบุชื่อหรือรหัสพนักงาน (ไม่เกิน 64 ตัวอักษร)");
  return `progress:${id.toLowerCase()}`;
}

export const progressRoute = new Hono<AppBindings>()
  .get("/", async (c) => {
    const kv = requireKv(c.env);
    const data = await kv.get(traineeKey(c.req.header(TRAINEE_HEADER)), "json");
    if (!data) return c.json({ progress: null });
    const parsed = progressSchema.safeParse(data);
    return c.json({ progress: parsed.success ? parsed.data : null });
  })
  .put("/", async (c) => {
    const kv = requireKv(c.env);
    const key = traineeKey(c.req.header(TRAINEE_HEADER));
    const raw = await c.req.text();
    if (raw.length > LIMITS.maxProgressBytes) throw new AppError(413, "PAYLOAD_TOO_LARGE", "ข้อมูลสถิติใหญ่เกินกำหนด");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError(400, "BAD_REQUEST", "รูปแบบข้อมูลสถิติไม่ถูกต้อง");
    }
    const parsed = progressSchema.safeParse(json);
    if (!parsed.success) throw new AppError(400, "BAD_REQUEST", "รูปแบบข้อมูลสถิติไม่ถูกต้อง");
    await kv.put(key, JSON.stringify(parsed.data));
    return c.json({ ok: true });
  });
