import { Hono } from "hono";
import { buildEvaluationSystemPrompt, buildEvaluationUserPrompt } from "../../../prompts/evaluation.ts";
import type { EvaluateResponse } from "../../shared/api.ts";
import { RUBRIC_KEYS } from "../../shared/rubric.ts";
import { evaluateRequestSchema, evaluationAiSchema } from "../../shared/schemas.ts";
import type { AppBindings } from "../env.ts";
import { AppError } from "../lib/errors.ts";
import { generateJson } from "../lib/gemini.ts";
import { evaluationResponseSchema } from "../lib/geminiSchemas.ts";
import { findPersona } from "../lib/personas.ts";
import { parseBody } from "../lib/validate.ts";

/** ประเมินบทสนทนาทั้งสาย คืน scorecard ตาม schema ตายตัว */
export const evaluateRoute = new Hono<AppBindings>().post("/", async (c) => {
  const req = await parseBody(c, evaluateRequestSchema);
  const persona = findPersona(req.personaId);
  if (!persona) throw new AppError(404, "NOT_FOUND", "ไม่พบลูกค้าจำลองที่เลือก");

  const ai = await generateJson(c.env, {
    systemInstruction: buildEvaluationSystemPrompt(),
    contents: [{ role: "user", parts: [{ text: buildEvaluationUserPrompt({ persona, ...req }) }] }],
    responseSchema: evaluationResponseSchema,
    zodSchema: evaluationAiSchema,
    temperature: 0.3,
    maxOutputTokens: 8192,
    thinkingBudget: 1024,
    timeoutMs: 60_000,
  });

  // เรียงตามลำดับ rubric และคำนวณคะแนนรวมใน Worker เพื่อให้สม่ำเสมอทุกครั้ง
  const categories = RUBRIC_KEYS.map((key) => ai.categories.find((cat) => cat.key === key)).filter(
    (cat): cat is NonNullable<typeof cat> => cat !== undefined,
  );
  const total = categories.reduce((sum, cat) => sum + cat.score, 0);
  const overallScore = Math.round((total / (RUBRIC_KEYS.length * 10)) * 100);

  const body: EvaluateResponse = {
    ...ai,
    categories,
    // ถ้ามีประเด็น compliance ให้ยกธงเสมอ แม้ AI จะใส่ flagged=false
    compliance: { flagged: ai.compliance.flagged || ai.compliance.issues.length > 0, issues: ai.compliance.issues },
    outcome: req.endedBy === "customer" && ai.outcome !== "sold" ? "hung_up" : ai.outcome,
    overallScore,
    persona: { id: persona.id, name: persona.name, title: persona.title },
    difficulty: req.difficulty,
    hiddenProfile: persona.hiddenProfile,
  };
  return c.json(body);
});
