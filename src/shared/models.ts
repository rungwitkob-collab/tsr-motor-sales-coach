/**
 * รุ่น Gemini ที่หน้าเว็บเลือกได้ (สลับได้ทันทีจากหน้า "สถิติ → ตั้งค่า" ไม่ต้อง deploy ใหม่)
 * Worker รับเฉพาะรุ่นในรายการนี้เท่านั้น รุ่นอื่นจะใช้ค่าเริ่มต้นจาก wrangler.jsonc (GEMINI_MODEL)
 * รุ่นเสียงลูกค้า (TTS) เป็นอีกรายการหนึ่ง (TTS_MODEL_OPTIONS) ค่าเริ่มต้นจาก GEMINI_TTS_MODEL
 */
export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    description: "ประหยัดโควตาที่สุด ตอบเร็ว เหมาะกับการฝึกประจำวัน (ค่าเริ่มต้น)",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "สมดุลระหว่างความฉลาดกับโควตา",
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    description: "รุ่นใหม่สุด ฉลาดกว่า แต่ใช้โควตามากกว่าและอาจตอบช้าในช่วงหนาแน่น",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "รุ่นเดิมที่ใช้มาก่อน (โควตาแยกจากรุ่น 3.x ใช้สลับเมื่อรุ่นอื่นเต็ม)",
  },
] as const;

export const MODEL_IDS: readonly string[] = MODEL_OPTIONS.map((m) => m.id);

export function isAllowedModel(id: unknown): id is string {
  return typeof id === "string" && MODEL_IDS.includes(id);
}

/** header ที่หน้าเว็บใช้ส่งรุ่นที่เลือก */
export const MODEL_HEADER = "X-Gemini-Model";
/** key ใน localStorage ของหน้าเว็บ */
export const MODEL_STORAGE_KEY = "tsr.model";

/* ------------------------------------------------------------------ */
/* รุ่นเสียงลูกค้า (Gemini TTS)                                          */
/* ------------------------------------------------------------------ */

/**
 * เฉพาะรุ่นที่ทดสอบแล้วว่าสร้างเสียงไทยได้จากคีย์ free tier
 * (gemini-2.5-pro-preview-tts ไม่มีโควตา free tier, gemini-2.5-flash-preview-tts ตอบ error กับข้อความไทย จึงไม่ใส่)
 */
export const TTS_MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: "gemini-3.8-flash-tts",
    label: "Gemini 3.8 Flash TTS",
    description: "รุ่นล่าสุด เอกสารระบุว่ารองรับภาษาไทย เสียงชัดที่สุดในรายการ (ค่าเริ่มต้น)",
  },
  {
    id: "gemini-3.1-flash-tts-preview",
    label: "Gemini 3.1 Flash TTS (preview)",
    description: "รุ่นก่อนหน้า รองรับภาษาไทย โควตาแยกจากรุ่น 3.8 ใช้สลับเมื่อรุ่นหลักเต็ม",
  },
  {
    id: "gemini-3.8-flash-lite-tts",
    label: "Gemini 3.8 Flash-Lite TTS",
    description: "ถูกและเร็วที่สุด แต่เอกสารไม่ระบุว่ารองรับภาษาไทย (ทดสอบแล้วพูดได้ ความชัดอาจด้อยกว่า)",
  },
] as const;

export const TTS_MODEL_IDS: readonly string[] = TTS_MODEL_OPTIONS.map((m) => m.id);

export function isAllowedTtsModel(id: unknown): id is string {
  return typeof id === "string" && TTS_MODEL_IDS.includes(id);
}

export const TTS_MODEL_HEADER = "X-Gemini-Tts-Model";
export const TTS_MODEL_STORAGE_KEY = "tsr.ttsModel";
