/** สัญญา (contract) ของ API ระหว่างหน้าเว็บกับ Worker */
import type { EvaluationAi } from "./schemas.ts";
import type { Difficulty, HiddenProfile, PersonaPublic } from "./types.ts";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "TIMEOUT"
  | "SAFETY_BLOCKED"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_AI_RESPONSE"
  | "UPSTREAM_ERROR"
  | "CONFIG_ERROR"
  | "NOT_FOUND"
  | "NOT_CONFIGURED"
  | "NETWORK_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    /** ข้อความภาษาไทยที่แสดงให้ผู้ใช้ได้ทันที */
    message: string;
    /** จำนวนวินาทีที่ควรรอก่อนลองใหม่ (ถ้ามี) */
    retryAfterSec?: number;
  };
}

export interface PersonasResponse {
  personas: PersonaPublic[];
}

export interface EvaluateResponse extends EvaluationAi {
  /** คะแนนรวม 0-100 คำนวณใน Worker จากคะแนนรายด้าน (เฉลี่ยเท่ากันทุกด้าน) */
  overallScore: number;
  persona: { id: string; name: string; title: string };
  difficulty: Difficulty;
  /** เฉลยข้อมูลซ่อนของลูกค้า เปิดเผยหลังจบสายเท่านั้น */
  hiddenProfile: HiddenProfile;
}

export interface HealthResponse {
  ok: true;
  model: string;
}
