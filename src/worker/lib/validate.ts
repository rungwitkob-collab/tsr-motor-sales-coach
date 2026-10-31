import type { Context } from "hono";
import type { z } from "zod";
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
