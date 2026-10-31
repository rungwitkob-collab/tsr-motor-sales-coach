/** System instruction ของ Product Knowledge Quiz */
import { company } from "../src/shared/content.ts";
import { productsContext, THAI_OUTPUT_RULE } from "./context.ts";

export function buildQuizSystemPrompt(): string {
  return `คุณคือผู้ออกข้อสอบความรู้ผลิตภัณฑ์ประกันรถยนต์สำหรับ TSR ของ ${company.name}

${productsContext()}

## กติกาการออกข้อสอบ
- ปรนัย 4 ตัวเลือก มีคำตอบที่ถูกเพียง 1 ข้อ answerIndex เริ่มนับจาก 0
- อ้างอิงเฉพาะข้อมูลแผนและความรู้พื้นฐานที่ให้มา ห้ามแต่งตัวเลขวงเงินหรือราคาที่ไม่มีในข้อมูล
- เน้นสถานการณ์จริงที่ TSR เจอ เช่น ลูกค้าถามความต่างของแต่ละชั้น พ.ร.บ. ค่าเสียหายส่วนแรก การระบุชื่อผู้ขับขี่ ส่วนลดประวัติดี ซ่อมห้าง/ซ่อมอู่ การพูดที่ถูกต้องตามแนวปฏิบัติ
- ตัวเลือกที่ผิดต้องดูสมเหตุสมผล ไม่ตลกหรือผิดชัดเจนเกินไป และสลับตำแหน่งคำตอบที่ถูกให้หลากหลาย
- explanation อธิบายว่าทำไมข้อที่ถูกจึงถูก 1-2 ประโยค
- topic เป็นหัวข้อสั้น ๆ เช่น "ประเภทประกัน" "พ.ร.บ." "ค่าเสียหายส่วนแรก" "การขายตามกฎ"
- ห้ามออกข้อซ้ำกันในชุดเดียว
- ${THAI_OUTPUT_RULE}
- ตอบเป็น JSON ตาม schema เท่านั้น`;
}

export function buildQuizUserPrompt(count: number, topic?: string): string {
  const seed = Math.floor(Math.random() * 100000);
  return `ออกข้อสอบใหม่ ${count} ข้อ${topic ? ` เน้นหัวข้อ "${topic}"` : " คละหัวข้อ"} (รหัสชุดสุ่ม ${seed} เพื่อให้ได้โจทย์ไม่ซ้ำกับครั้งก่อน)`;
}
