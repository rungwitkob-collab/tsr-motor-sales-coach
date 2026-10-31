import { Hono } from "hono";
import type { PersonasResponse } from "../../shared/api.ts";
import type { AppBindings } from "../env.ts";
import { personas, toPublicPersona } from "../lib/personas.ts";

/** รายชื่อลูกค้าจำลอง (ไม่รวมข้อมูลซ่อน) */
export const personasRoute = new Hono<AppBindings>().get("/", (c) => {
  const body: PersonasResponse = { personas: personas.map(toPublicPersona) };
  return c.json(body, 200, { "Cache-Control": "private, max-age=300" });
});
