/** Bindings ของ Worker (ตั้งค่าใน wrangler.jsonc และ `wrangler secret put`) */
export interface Env {
  /** Secret: Gemini API key จาก Google AI Studio */
  GEMINI_API_KEY?: string;
  /** Secret: รหัสผ่านทีมที่ TSR ต้องกรอกก่อนใช้งาน */
  APP_PASSCODE?: string;
  /** รุ่นเริ่มต้น เช่น gemini-3.5-flash-lite (หน้าเว็บเลือกรุ่นอื่นในรายการ src/shared/models.ts ได้) */
  GEMINI_MODEL?: string;
  /**
   * รุ่น TTS สำหรับเสียงลูกค้า เช่น gemini-3.8-flash-tts
   * ใส่ "off" เพื่อปิด (หน้าเว็บจะใช้เสียงอ่านของเบราว์เซอร์แทน)
   */
  GEMINI_TTS_MODEL?: string;
  /**
   * (ไม่บังคับ) เปลี่ยน endpoint ของ Gemini เช่นใช้ผ่าน Cloudflare AI Gateway:
   * https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY>/google-ai-studio/v1beta/models
   */
  GEMINI_API_BASE?: string;
  /** จำนวน request ต่อนาทีต่อ IP */
  RATE_LIMIT_PER_MINUTE?: string;
  /** (ไม่บังคับ) KV สำหรับเก็บสถิติผู้ฝึกบน Cloudflare */
  PROGRESS_KV?: KVNamespace;
  /** Static assets (หน้าเว็บ React) */
  ASSETS: Fetcher;
}

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** รุ่นเริ่มต้นของ Worker (จาก GEMINI_MODEL ใน wrangler.jsonc) */
export function modelName(env: Env): string {
  return env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** รุ่นที่เอกสารระบุว่ารองรับภาษาไทย (รุ่น flash-lite-tts ไม่มีไทยในตารางภาษา) */
export const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";

/** คืน null เมื่อปิดเสียงจาก AI (GEMINI_TTS_MODEL = "off") */
export function ttsModelName(env: Env): string | null {
  const value = env.GEMINI_TTS_MODEL?.trim();
  if (value && /^(off|none|false|0)$/i.test(value)) return null;
  return value || DEFAULT_TTS_MODEL;
}

export type AppBindings = { Bindings: Env };
