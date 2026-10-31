import { Hono } from "hono";
import { buildPitchSystemPrompt, buildPitchUserPrompt } from "../../../prompts/pitch.ts";
import { findPlan, products } from "../../shared/content.ts";
import { pitchRequestSchema, pitchResultSchema } from "../../shared/schemas.ts";
import type { AppBindings } from "../env.ts";
import { AppError } from "../lib/errors.ts";
import { generateJson } from "../lib/gemini.ts";
import { pitchResponseSchema } from "../lib/geminiSchemas.ts";
import { parseBody } from "../lib/validate.ts";

/** สร้างบทพูด 30 วินาที + เวอร์ชันสั้น/ยาว ที่ปรับให้เข้ากับลูกค้า */
export const pitchRoute = new Hono<AppBindings>().post("/", async (c) => {
  const req = await parseBody(c, pitchRequestSchema);
  if (req.planId && !findPlan(req.planId)) throw new AppError(400, "BAD_REQUEST", "ไม่พบแผนประกันที่เลือก");

  const planIds = products.plans.map((p) => p.id);
  const result = await generateJson(c.env, {
    systemInstruction: buildPitchSystemPrompt(),
    contents: [{ role: "user", parts: [{ text: buildPitchUserPrompt(req) }] }],
    responseSchema: pitchResponseSchema(req.planId ? [req.planId] : planIds),
    zodSchema: pitchResultSchema.refine((r) => planIds.includes(r.recommendedPlanId), {
      message: "recommendedPlanId ต้องเป็น id ของแผนที่มีอยู่",
      path: ["recommendedPlanId"],
    }),
    temperature: 0.8,
    maxOutputTokens: 3072,
    thinkingBudget: 0,
    timeoutMs: 40_000,
  });
  return c.json(result);
});
