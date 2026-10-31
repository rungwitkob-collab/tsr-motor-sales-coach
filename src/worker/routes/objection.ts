import { Hono } from "hono";
import { buildObjectionSystemPrompt, buildObjectionUserPrompt } from "../../../prompts/objection.ts";
import { findObjection, objectionGroupLabel } from "../../shared/content.ts";
import { objectionFeedbackSchema, objectionRequestSchema } from "../../shared/schemas.ts";
import type { AppBindings } from "../env.ts";
import { AppError } from "../lib/errors.ts";
import { generateJson } from "../lib/gemini.ts";
import { objectionResponseSchema } from "../lib/geminiSchemas.ts";
import { parseBody, requestedModel } from "../lib/validate.ts";

/** ให้คะแนนคำตอบข้ออ้าง 1-5 พร้อมคำตอบต้นแบบ 2 แบบ */
export const objectionRoute = new Hono<AppBindings>().post("/", async (c) => {
  const req = await parseBody(c, objectionRequestSchema);
  const objection = findObjection(req.objectionId);
  if (!objection) throw new AppError(404, "NOT_FOUND", "ไม่พบข้ออ้างที่เลือก");

  const feedback = await generateJson(c.env, {
    model: requestedModel(c),
    systemInstruction: buildObjectionSystemPrompt(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildObjectionUserPrompt({
              objection,
              groupLabel: objectionGroupLabel(objection.group),
              answer: req.answer,
              timeTakenSec: req.timeTakenSec,
              timeLimitSec: req.timeLimitSec,
              focusSkill: req.focusSkill,
            }),
          },
        ],
      },
    ],
    responseSchema: objectionResponseSchema,
    zodSchema: objectionFeedbackSchema,
    temperature: 0.5,
    maxOutputTokens: 2048,
    thinkingBudget: 0,
    timeoutMs: 30_000,
  });

  // ไม่ได้ตอบ = 1 คะแนนเสมอ
  return c.json(req.answer.trim() ? feedback : { ...feedback, score: 1 });
});
