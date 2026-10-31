import { Hono } from "hono";
import { buildQuizSystemPrompt, buildQuizUserPrompt } from "../../../prompts/quiz.ts";
import { quizRequestSchema, quizResponseSchema } from "../../shared/schemas.ts";
import type { AppBindings } from "../env.ts";
import { generateJson } from "../lib/gemini.ts";
import { quizResponseSchema as quizGeminiSchema } from "../lib/geminiSchemas.ts";
import { parseBody, requestedModel } from "../lib/validate.ts";

/** ให้ AI สร้างข้อสอบปรนัยใหม่จาก products.json */
export const quizRoute = new Hono<AppBindings>().post("/", async (c) => {
  const req = await parseBody(c, quizRequestSchema);
  const result = await generateJson(c.env, {
    model: requestedModel(c),
    systemInstruction: buildQuizSystemPrompt(),
    contents: [{ role: "user", parts: [{ text: buildQuizUserPrompt(req.count, req.topic) }] }],
    responseSchema: quizGeminiSchema(req.count),
    zodSchema: quizResponseSchema.refine(
      (r) => r.questions.every((q) => new Set(q.choices).size === 4),
      { message: "ตัวเลือกในข้อเดียวกันต้องไม่ซ้ำกัน" },
    ),
    temperature: 0.9,
    maxOutputTokens: 6144,
    thinkingBudget: 0,
    timeoutMs: 45_000,
  });
  return c.json(result);
});
