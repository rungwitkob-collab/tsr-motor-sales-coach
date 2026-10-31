/**
 * Zod schemas ที่ใช้ร่วมกัน
 * - Worker ใช้ validate request จากหน้าเว็บ และ validate JSON ที่ได้จาก Gemini ก่อนส่งกลับ
 * - หน้าเว็บใช้ type ที่ infer จาก schema เหล่านี้ (import type เท่านั้น ยกเว้น progress)
 */
import { z } from "zod";
import { LIMITS } from "./limits.ts";
import { CALL_OUTCOMES, RUBRIC_KEYS, type CallOutcome, type RubricKey } from "./rubric.ts";

const idString = z.string().trim().min(1).max(64);

export const difficultySchema = z.enum(["easy", "normal", "hard"]);
export const rubricKeySchema = z.enum(RUBRIC_KEYS);
export const outcomeSchema = z.enum(CALL_OUTCOMES as [CallOutcome, ...CallOutcome[]]);

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export const chatMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("tsr"),
    text: z.string().trim().min(1, "ข้อความว่าง").max(LIMITS.maxTsrMessageChars, `ข้อความยาวเกิน ${LIMITS.maxTsrMessageChars} ตัวอักษร`),
  }),
  z.object({
    role: z.literal("customer"),
    text: z.string().trim().min(1).max(LIMITS.maxCustomerMessageChars),
  }),
]);

type ChatMsg = z.infer<typeof chatMessageSchema>;

const TURN_LIMIT_MESSAGE = `เกิน ${LIMITS.maxTurnsPerCall} รอบต่อสาย กรุณาจบสายเพื่อประเมิน`;

function alternates(messages: ChatMsg[]): boolean {
  return messages.every((m, i) => m.role === (i % 2 === 0 ? "customer" : "tsr"));
}

function tsrTurns(messages: ChatMsg[]): number {
  return messages.filter((m) => m.role === "tsr").length;
}

/** ข้อความต้องเริ่มด้วยลูกค้า (คำทักทายตอนรับสาย) แล้วสลับกับ TSR และจบด้วย TSR */
export const roleplayRequestSchema = z
  .object({
    personaId: idString,
    difficulty: difficultySchema,
    messages: z.array(chatMessageSchema).min(2, "ต้องมีบทสนทนาอย่างน้อย 1 รอบ").max(LIMITS.maxTurnsPerCall * 2, TURN_LIMIT_MESSAGE),
  })
  .refine((v) => alternates(v.messages), { message: "ลำดับบทสนทนาไม่ถูกต้อง", path: ["messages"] })
  .refine((v) => v.messages[v.messages.length - 1]?.role === "tsr", {
    message: "ข้อความล่าสุดต้องเป็นของ TSR",
    path: ["messages"],
  })
  .refine((v) => tsrTurns(v.messages) <= LIMITS.maxTurnsPerCall, {
    message: TURN_LIMIT_MESSAGE,
    path: ["messages"],
  });
export type RoleplayRequest = z.infer<typeof roleplayRequestSchema>;

export const evaluateRequestSchema = z
  .object({
    personaId: idString,
    difficulty: difficultySchema,
    messages: z.array(chatMessageSchema).min(1).max(LIMITS.maxTurnsPerCall * 2 + 1, TURN_LIMIT_MESSAGE),
    durationSec: z.number().int().min(0).max(4 * 60 * 60),
    endedBy: z.enum(["tsr", "customer", "turn_limit"]),
  })
  .refine((v) => alternates(v.messages), { message: "ลำดับบทสนทนาไม่ถูกต้อง", path: ["messages"] })
  .refine((v) => tsrTurns(v.messages) >= 1, { message: "ยังไม่มีบทพูดของ TSR ให้ประเมิน", path: ["messages"] })
  .refine((v) => tsrTurns(v.messages) <= LIMITS.maxTurnsPerCall, { message: TURN_LIMIT_MESSAGE, path: ["messages"] });
export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;

export const objectionRequestSchema = z.object({
  objectionId: idString,
  answer: z.string().trim().max(LIMITS.maxDrillAnswerChars, `คำตอบยาวเกิน ${LIMITS.maxDrillAnswerChars} ตัวอักษร`),
  timeTakenSec: z.number().int().min(0).max(600),
  timeLimitSec: z.number().int().min(10).max(600),
  focusSkill: rubricKeySchema.optional(),
});
export type ObjectionRequest = z.infer<typeof objectionRequestSchema>;

const pitchField = z.string().trim().max(LIMITS.maxPitchFieldChars).default("");

export const pitchRequestSchema = z.object({
  car: z.object({
    brand: z.string().trim().min(1, "กรุณาระบุยี่ห้อรถ").max(LIMITS.maxPitchFieldChars),
    model: pitchField,
    year: z.number().int().min(1980).max(2100),
    usage: pitchField,
  }),
  customer: z.object({
    name: pitchField,
    ageRange: pitchField,
    occupation: pitchField,
    currentInsurance: pitchField,
    budget: pitchField,
    concerns: pitchField,
  }),
  planId: z.string().trim().max(64).optional(),
});
export type PitchRequest = z.input<typeof pitchRequestSchema>;
export type PitchRequestParsed = z.output<typeof pitchRequestSchema>;

/** ขอเสียงอ่านข้อความลูกค้า/ข้ออ้างจาก Gemini TTS */
export const ttsRequestSchema = z.object({
  text: z.string().trim().min(1, "ข้อความว่าง").max(LIMITS.maxCustomerMessageChars, "ข้อความยาวเกินกำหนด"),
  gender: z.enum(["male", "female"]).default("female"),
});
export type TtsRequest = z.input<typeof ttsRequestSchema>;

export const quizRequestSchema = z.object({
  count: z.number().int().min(1).max(LIMITS.maxQuizQuestions),
  topic: z.string().trim().max(100).optional(),
});
export type QuizRequest = z.infer<typeof quizRequestSchema>;

/* ------------------------------------------------------------------ */
/* AI responses (validated in Worker)                                  */
/* ------------------------------------------------------------------ */

const text = z.string().trim().min(1);
const clampInt = (min: number, max: number) =>
  z.number().transform((n) => Math.min(max, Math.max(min, Math.round(n))));
const list = (min: number, max: number) =>
  z
    .array(z.string().trim())
    .transform((a) => a.filter((s) => s.length > 0).slice(0, max))
    .refine((a) => a.length >= min, { message: `ต้องมีอย่างน้อย ${min} ข้อ` });

export const categoryEvaluationSchema = z.object({
  key: rubricKeySchema,
  score: clampInt(0, 10),
  strengths: list(1, 2),
  improvements: list(1, 2),
  example: z.object({
    quote: z.string().trim(),
    rewrite: text,
  }),
});
export type CategoryEvaluation = z.infer<typeof categoryEvaluationSchema>;

export const evaluationAiSchema = z.object({
  summary: text,
  categories: z
    .array(categoryEvaluationSchema)
    .length(RUBRIC_KEYS.length)
    .refine((cats) => new Set(cats.map((c) => c.key)).size === RUBRIC_KEYS.length, {
      message: "ต้องมีครบทั้ง 6 ด้านและไม่ซ้ำกัน",
    }),
  compliance: z.object({
    flagged: z.boolean(),
    issues: list(0, 5),
  }),
  outcome: outcomeSchema,
  discoveredInfo: list(0, 10),
  missedInfo: list(0, 10),
  nextFocus: text,
});
export type EvaluationAi = z.infer<typeof evaluationAiSchema>;

export const objectionFeedbackSchema = z.object({
  score: clampInt(1, 5),
  verdict: text,
  strengths: list(0, 2),
  improvements: list(1, 2),
  modelAnswers: z.object({
    gentle: text,
    direct: text,
  }),
});
export type ObjectionFeedback = z.infer<typeof objectionFeedbackSchema>;

export const pitchResultSchema = z.object({
  recommendedPlanId: z.string().trim(),
  reason: text,
  pitch30s: text,
  shortVersion: text,
  longVersion: text,
  discoveryQuestions: list(2, 4),
});
export type PitchResult = z.infer<typeof pitchResultSchema>;

export const quizQuestionSchema = z.object({
  question: text,
  choices: z.array(text).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: text,
  topic: z.string().trim().default("ทั่วไป"),
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(LIMITS.maxQuizQuestions),
});
export type QuizResponse = z.infer<typeof quizResponseSchema>;

/* ------------------------------------------------------------------ */
/* Progress (localStorage / export-import / KV)                        */
/* ------------------------------------------------------------------ */

const scoresSchema = z.object(
  Object.fromEntries(RUBRIC_KEYS.map((k) => [k, z.number().min(0).max(10)])) as Record<RubricKey, z.ZodNumber>,
);

export const callRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  personaId: z.string(),
  personaName: z.string(),
  difficulty: difficultySchema,
  overallScore: z.number().min(0).max(100),
  scores: scoresSchema,
  complianceFlagged: z.boolean(),
  durationSec: z.number().min(0),
  turns: z.number().min(0),
  outcome: outcomeSchema,
});
export type CallRecord = z.infer<typeof callRecordSchema>;

export const drillRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  objectionId: z.string(),
  score: z.number().min(1).max(5),
});
export type DrillRecord = z.infer<typeof drillRecordSchema>;

export const quizRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  correct: z.number().min(0),
  total: z.number().min(1),
  source: z.enum(["seed", "ai"]),
});
export type QuizRecord = z.infer<typeof quizRecordSchema>;

export const progressSchema = z.object({
  version: z.literal(1),
  traineeName: z.string().max(100).default(""),
  calls: z.array(callRecordSchema).max(1000),
  drills: z.array(drillRecordSchema).max(2000),
  quizzes: z.array(quizRecordSchema).max(1000),
  reviewObjectionIds: z.array(z.string()).max(500),
});
export type ProgressData = z.infer<typeof progressSchema>;

export function emptyProgress(): ProgressData {
  return { version: 1, traineeName: "", calls: [], drills: [], quizzes: [], reviewObjectionIds: [] };
}
