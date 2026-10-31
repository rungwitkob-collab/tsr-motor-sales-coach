/**
 * Worker entry: Hono router สำหรับ /api/*
 * ไฟล์หน้าเว็บ (React) เสิร์ฟผ่าน Static Assets โดยไม่ผ่าน Worker
 */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { HealthResponse } from "../shared/api.ts";
import { LIMITS } from "../shared/limits.ts";
import { modelName, type AppBindings, type Env } from "./env.ts";
import { AppError } from "./lib/errors.ts";
import { passcodeAuth } from "./middleware/auth.ts";
import { rateLimit } from "./middleware/rateLimit.ts";
import { evaluateRoute } from "./routes/evaluate.ts";
import { objectionRoute } from "./routes/objection.ts";
import { personasRoute } from "./routes/personas.ts";
import { pitchRoute } from "./routes/pitch.ts";
import { progressRoute } from "./routes/progress.ts";
import { quizRoute } from "./routes/quiz.ts";
import { roleplayRoute } from "./routes/roleplay.ts";

// Workers ไม่อนุญาต eval/new Function จึงปิด JIT ของ zod และใช้ข้อความ error ภาษาไทย
z.config(z.locales.th());
z.config({ jitless: true });

const api = new Hono<AppBindings>().basePath("/api");

api.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", c.res.headers.get("Cache-Control") ?? "no-store");
});

api.use("*", rateLimit);

api.use(
  "*",
  bodyLimit({
    maxSize: LIMITS.maxProgressBytes,
    onError: () => {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "ข้อมูลที่ส่งมีขนาดใหญ่เกินกำหนด");
    },
  }),
);

api.get("/health", (c) => c.json<HealthResponse>({ ok: true, model: modelName(c.env) }));

api.use("*", passcodeAuth);

// จำกัดขนาด body ของ endpoint AI ให้เล็กกว่า progress
api.use("*", async (c, next) => {
  if (c.req.method === "POST") {
    const len = Number(c.req.header("Content-Length") ?? "0");
    if (len > LIMITS.maxBodyBytes) throw new AppError(413, "PAYLOAD_TOO_LARGE", "ข้อมูลที่ส่งมีขนาดใหญ่เกินกำหนด");
  }
  await next();
});

api.post("/auth/check", (c) => c.json({ ok: true, model: modelName(c.env) }));
api.route("/personas", personasRoute);
api.route("/roleplay", roleplayRoute);
api.route("/evaluate", evaluateRoute);
api.route("/objection", objectionRoute);
api.route("/pitch", pitchRoute);
api.route("/quiz", quizRoute);
api.route("/progress", progressRoute);

api.notFound(() => new AppError(404, "NOT_FOUND", "ไม่พบ API ที่เรียก").toResponse());

api.onError((err) => {
  if (err instanceof AppError) return err.toResponse();
  console.error("Unhandled error", err);
  return new AppError(500, "UPSTREAM_ERROR", "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่").toResponse();
});

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      return api.fetch(request, env, ctx);
    }
    // ปกติ request อื่นจะถูกเสิร์ฟโดย Static Assets ก่อนถึง Worker อยู่แล้ว
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
