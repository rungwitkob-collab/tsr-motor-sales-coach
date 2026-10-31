/** System instruction ของโมดูล Objection Drill */
import { rubricItem, type RubricKey } from "../src/shared/rubric.ts";
import type { Objection } from "../src/shared/types.ts";
import { company } from "../src/shared/content.ts";
import { productsContext, THAI_OUTPUT_RULE } from "./context.ts";

export function buildObjectionSystemPrompt(): string {
  return `คุณคือโค้ชฝึกการรับมือข้อโต้แย้ง (objection handling) สำหรับ TSR ขายประกันรถยนต์ของ ${company.name}

${productsContext()}

## วิธีให้คะแนน 1-5
ใช้โครง: รับฟัง → เห็นใจ → ถามเจาะ → ตอบ → ปิดกลับ (ถามคำถามหรือเสนอขั้นตอนถัดไป)
- 1 = ไม่ได้ตอบ ตอบไม่เกี่ยว หรือเถียง/กดดันลูกค้า หรือให้ข้อมูลเท็จ/รับรองผลเคลม
- 2 = ตอบได้บางส่วน ขาดการเห็นใจหรือขาดการปิดกลับ
- 3 = ใช้ได้ ครอบคลุมโครงส่วนใหญ่ แต่ยังไม่เป็นธรรมชาติหรือยังไม่เจาะจง
- 4 = ดี ครบโครง สุภาพ เจาะจงกับข้ออ้าง
- 5 = ยอดเยี่ยม สั้น กระชับ เป็นธรรมชาติ และพาไปสู่ขั้นตอนถัดไปได้ชัด
ถ้าใช้เวลาเกินกำหนดให้หักคะแนนเล็กน้อยและบอกในคำแนะนำ

## รูปแบบคำตอบ
- verdict: สรุปผล 1 ประโยค
- strengths: สิ่งที่ทำได้ดี 0-2 ข้อ, improvements: สิ่งที่ควรปรับ 1-2 ข้อ (เจาะจงกับคำตอบของ TSR)
- modelAnswers.gentle: คำตอบต้นแบบแบบนุ่มนวล เน้นเห็นใจ 2-4 ประโยค
- modelAnswers.direct: คำตอบต้นแบบแบบตรงประเด็น สั้น 1-3 ประโยค
- คำตอบต้นแบบต้องพูดได้จริงทางโทรศัพท์ ไม่พูดเกินจริง ไม่รับรองผลเคลม และจบด้วยคำถามหรือการเสนอขั้นตอนถัดไป
- ${THAI_OUTPUT_RULE}
- ตอบเป็น JSON ตาม schema เท่านั้น`;
}

export function buildObjectionUserPrompt(input: {
  objection: Objection;
  groupLabel: string;
  answer: string;
  timeTakenSec: number;
  timeLimitSec: number;
  focusSkill?: RubricKey;
}): string {
  const focus = input.focusSkill
    ? `\nTSR กำลังฝึกจุดอ่อนด้าน "${rubricItem(input.focusSkill).labelTh}" (${rubricItem(input.focusSkill).description}) ให้เน้นคำแนะนำในด้านนี้เป็นพิเศษ`
    : "";
  const answer = input.answer.trim() || "(TSR ไม่ได้ตอบภายในเวลาที่กำหนด)";
  return `ข้ออ้างของลูกค้า (หมวด ${input.groupLabel}): "${input.objection.text}"
แนวทางที่หัวหน้าทีมแนะนำ: ${input.objection.hint}
เวลาที่ใช้: ${input.timeTakenSec} วินาที จากเวลาที่กำหนด ${input.timeLimitSec} วินาที${focus}

คำตอบของ TSR:
"""
${answer}
"""`;
}
