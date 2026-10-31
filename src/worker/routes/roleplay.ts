import { Hono } from "hono";
import { buildCustomerSystemPrompt, CALL_CONNECTED_CUE } from "../../../prompts/roleplay.ts";
import { roleplayRequestSchema } from "../../shared/schemas.ts";
import type { AppBindings } from "../env.ts";
import { AppError } from "../lib/errors.ts";
import { streamGenerate, type GeminiContent } from "../lib/gemini.ts";
import { findPersona } from "../lib/personas.ts";
import { parseBody, requestedModel } from "../lib/validate.ts";

/** ลูกค้าจำลองตอบกลับแบบ streaming (SSE) */
export const roleplayRoute = new Hono<AppBindings>().post("/", async (c) => {
  const req = await parseBody(c, roleplayRequestSchema);
  const persona = findPersona(req.personaId);
  if (!persona) throw new AppError(404, "NOT_FOUND", "ไม่พบลูกค้าจำลองที่เลือก กรุณาเลือกใหม่");

  const turn = req.messages.filter((m) => m.role === "tsr").length;
  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: CALL_CONNECTED_CUE }] },
    ...req.messages.map(
      (m): GeminiContent => ({ role: m.role === "tsr" ? "user" : "model", parts: [{ text: m.text }] }),
    ),
  ];

  return streamGenerate(c.env, {
    model: requestedModel(c),
    systemInstruction: buildCustomerSystemPrompt(persona, req.difficulty, turn),
    contents,
    temperature: req.difficulty === "hard" ? 1.0 : 0.85,
    maxOutputTokens: 400,
    thinkingBudget: 0,
    timeoutMs: 20_000,
  });
});
