import type { Context } from "hono";
import type { z } from "zod";
import { isAllowedModel, MODEL_HEADER } from "../../shared/models.ts";
import { modelName, type Env } from "../env.ts";
import { AppError } from "./errors.ts";

/** อ่าน JSON body และ validate ด้วย zod ถ้าไม่ผ่านตอบ 400 พร้อมข้อความไทย */
export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError(400, "BAD_REQUEST", "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น JSON)");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` (${first.path.join(".")})` : "";
    throw new AppError(400, "BAD_REQUEST", `ข้อมูลไม่ถูกต้อง: ${first?.message ?? "ไม่ทราบสาเหตุ"}${where}`);
  }
  return result.data;
}

/** รุ่น Gemini ที่หน้าเว็บขอมา (header) ถ้าไม่อยู่ในรายการที่อนุญาตให้ใช้ค่าเริ่มต้นของ Worker */
export function requestedModel(c: Context<{ Bindings: Env }>): string {
  const wanted = c.req.header(MODEL_HEADER)?.trim();
  return isAllowedModel(wanted) ? wanted : modelName(c.env);
}
