/**
 * responseSchema ที่ส่งให้ Gemini (OpenAPI subset ตามเอกสาร Gemini API)
 * ต้องสอดคล้องกับ zod schema ใน src/shared/schemas.ts ซึ่งใช้ validate ซ้ำอีกชั้นใน Worker
 */
import { CALL_OUTCOMES, RUBRIC_KEYS } from "../../shared/rubric.ts";

export interface GeminiSchema {
  type: "OBJECT" | "ARRAY" | "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN";
  description?: string;
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
  items?: GeminiSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
}

const str = (description?: string): GeminiSchema => ({ type: "STRING", ...(description ? { description } : {}) });
const strList = (min: number, max: number, description?: string): GeminiSchema => ({
  type: "ARRAY",
  items: { type: "STRING" },
  minItems: min,
  maxItems: max,
  ...(description ? { description } : {}),
});

function obj(properties: Record<string, GeminiSchema>): GeminiSchema {
  const keys = Object.keys(properties);
  return { type: "OBJECT", properties, required: keys, propertyOrdering: keys };
}

export const evaluationResponseSchema: GeminiSchema = obj({
  summary: str("สรุปภาพรวม 2-3 ประโยค"),
  categories: {
    type: "ARRAY",
    minItems: RUBRIC_KEYS.length,
    maxItems: RUBRIC_KEYS.length,
    items: obj({
      key: { type: "STRING", enum: [...RUBRIC_KEYS] },
      score: { type: "INTEGER", minimum: 0, maximum: 10 },
      strengths: strList(1, 2, "สิ่งที่ทำได้ดี"),
      improvements: strList(1, 2, "สิ่งที่ควรปรับ"),
      example: obj({
        quote: str("ประโยคของ TSR จากบทสนทนาแบบคำต่อคำ หรือ (ไม่ได้พูดถึงในสายนี้)"),
        rewrite: str("ประโยคที่ควรพูดแทน"),
      }),
    }),
  },
  compliance: obj({
    flagged: { type: "BOOLEAN" },
    issues: strList(0, 5),
  }),
  outcome: { type: "STRING", enum: [...CALL_OUTCOMES] },
  discoveredInfo: strList(0, 10),
  missedInfo: strList(0, 10),
  nextFocus: str(),
});

export const objectionResponseSchema: GeminiSchema = obj({
  score: { type: "INTEGER", minimum: 1, maximum: 5 },
  verdict: str(),
  strengths: strList(0, 2),
  improvements: strList(1, 2),
  modelAnswers: obj({
    gentle: str("คำตอบต้นแบบแบบนุ่มนวล"),
    direct: str("คำตอบต้นแบบแบบตรงประเด็น"),
  }),
});

export function pitchResponseSchema(planIds: string[]): GeminiSchema {
  return obj({
    recommendedPlanId: { type: "STRING", enum: planIds },
    reason: str(),
    pitch30s: str(),
    shortVersion: str(),
    longVersion: str(),
    discoveryQuestions: strList(2, 4),
  });
}

export function quizResponseSchema(count: number): GeminiSchema {
  return obj({
    questions: {
      type: "ARRAY",
      minItems: count,
      maxItems: count,
      items: obj({
        question: str(),
        choices: { type: "ARRAY", items: { type: "STRING" }, minItems: 4, maxItems: 4 },
        answerIndex: { type: "INTEGER", minimum: 0, maximum: 3 },
        explanation: str(),
        topic: str(),
      }),
    },
  });
}
