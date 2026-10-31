/** Bindings ของ Worker (ตั้งค่าใน wrangler.jsonc และ `wrangler secret put`) */
export interface Env {
  /** Secret: Gemini API key จาก Google AI Studio */
  GEMINI_API_KEY?: string;
  /** Secret: รหัสผ่านทีมที่ TSR ต้องกรอกก่อนใช้งาน */
  APP_PASSCODE?: string;
  /** ชื่อ model เช่น gemini-2.5-flash */
  GEMINI_MODEL?: string;
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

export const DEFAULT_MODEL = "gemini-2.5-flash";

export function modelName(env: Env): string {
  return env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export type AppBindings = { Bindings: Env };
