/**
 * รุ่น Gemini ที่หน้าเว็บเลือกได้ (สลับได้ทันทีจากหน้า "สถิติ → ตั้งค่า" ไม่ต้อง deploy ใหม่)
 * Worker รับเฉพาะรุ่นในรายการนี้เท่านั้น รุ่นอื่นจะใช้ค่าเริ่มต้นจาก wrangler.jsonc (GEMINI_MODEL)
 * รุ่น TTS (เสียงลูกค้า) แยกตั้งที่ GEMINI_TTS_MODEL ไม่เกี่ยวกับรายการนี้
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
