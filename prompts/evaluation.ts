/** System instruction ของโมดูล Call Evaluation */
import { RUBRIC } from "../src/shared/rubric.ts";
import { difficultyLabel } from "../src/shared/rubric.ts";
import type { ChatMessage, Difficulty, Persona } from "../src/shared/types.ts";
import { companyContext, productsContext, THAI_OUTPUT_RULE } from "./context.ts";

export function buildEvaluationSystemPrompt(): string {
  const rubric = RUBRIC.map((r, i) => `${i + 1}. key="${r.key}" ${r.label} (${r.labelTh}): ${r.description}`).join("\n");
  return `คุณคือโค้ชการขายประกันรถยนต์ทางโทรศัพท์ระดับอาวุโส ทำหน้าที่ประเมินบทสนทนาของ TSR อย่างยุติธรรม เจาะจง และนำไปใช้ได้จริง

## ข้อมูลบริษัท
${companyContext()}

## ${productsContext()}

## เกณฑ์การให้คะแนน (แต่ละด้าน 0-10)
${rubric}

ระดับคะแนน: 0-3 = ไม่ได้ทำหรือทำผิด, 4-6 = ทำได้บางส่วน, 7-8 = ทำได้ดี, 9-10 = ยอดเยี่ยมเป็นแบบอย่างได้
ถ้าสายจบก่อนถึงขั้นตอนใด ให้ให้คะแนนต่ำในด้านนั้นตามจริง และยังต้องให้ตัวอย่างประโยคที่ควรพูด

## กติกาการประเมิน
- ประเมินเฉพาะบทพูดของ TSR ข้อความของลูกค้าใช้เป็นบริบท
- categories ต้องมีครบ 6 ด้าน ด้านละ 1 รายการ ใช้ key ตามที่กำหนดเท่านั้น
- strengths 1-2 ข้อ และ improvements 1-2 ข้อ ต่อด้าน เขียนให้เจาะจงกับบทสนทนานี้ ไม่ใช่คำแนะนำทั่วไป
- example.quote ต้องคัดลอกประโยคของ TSR จากบทสนทนาแบบคำต่อคำ ถ้า TSR ไม่ได้พูดเรื่องนั้นเลยให้ใส่ "(ไม่ได้พูดถึงในสายนี้)"
- example.rewrite คือประโยคที่ควรพูดแทน พูดได้จริงทางโทรศัพท์ สั้น กระชับ ใช้ชื่อบริษัทจริงตามข้อมูลด้านบน
- compliance.flagged = true ถ้า TSR ทำอย่างน้อยหนึ่งข้อ: ให้ข้อมูลเท็จหรือเกินจริง, รับรองผลการเคลม, กดดัน/เร่งเร้า/ข่มขู่ลูกค้า, ไม่แนะนำชื่อ บริษัท หรือเลขที่ใบอนุญาต, ไม่ขออนุญาตก่อนสนทนา, ขอข้อมูลบัตร/OTP ไม่เหมาะสม, แนะนำให้ปกปิดข้อมูลกับบริษัทประกัน
- compliance.issues ระบุแต่ละปัญหาเป็นประโยคสั้นพร้อมอ้างสิ่งที่ TSR พูด (ถ้าไม่มีปัญหาให้เป็น array ว่าง)
- discoveredInfo = ข้อมูลซ่อนของลูกค้าที่ TSR ถามจนได้ข้อมูลจริง, missedInfo = ข้อมูลสำคัญที่ TSR ไม่ได้ถาม
- outcome: sold = ลูกค้าตกลงซื้อ, callback = ได้นัดโทรกลับ/ส่งข้อมูลที่ชัดเจน, rejected = ลูกค้าปฏิเสธ, hung_up = ลูกค้าวางสาย, unclear = ยังไม่มีข้อสรุป
- nextFocus = สิ่งเดียวที่สำคัญที่สุดที่ TSR ควรฝึกต่อ เขียนเป็นคำแนะนำ 1-2 ประโยค
- summary = สรุปภาพรวม 2-3 ประโยค
- ${THAI_OUTPUT_RULE}
- ตอบเป็น JSON ตาม schema เท่านั้น`;
}

export function buildEvaluationUserPrompt(input: {
  persona: Persona;
  difficulty: Difficulty;
  messages: ChatMessage[];
  durationSec: number;
  endedBy: "tsr" | "customer" | "turn_limit";
}): string {
  const { persona, difficulty, messages, durationSec, endedBy } = input;
  const h = persona.hiddenProfile;
  const transcript = messages
    .map((m, i) => `${i + 1}. ${m.role === "tsr" ? "TSR" : "ลูกค้า"}: ${m.text}`)
    .join("\n");
  const endedText =
    endedBy === "customer" ? "ลูกค้าเป็นฝ่ายวางสาย" : endedBy === "turn_limit" ? "ครบจำนวนรอบสูงสุด" : "TSR กดจบสาย";
  return `## ลูกค้าจำลอง
${persona.name} (${persona.title}) ระดับความยาก: ${difficultyLabel(difficulty)}
ข้อมูลซ่อนที่ TSR ควรค้นหา:
- รถ: ${h.car} ปี ${h.carYear}
- ประกันปัจจุบัน: ${h.currentInsurance}
- งบประมาณ: ${h.budget}
- การใช้รถ: ${h.usage}
- ความกังวล: ${h.painPoints.join("; ")}
- ปัจจัยตัดสินใจ: ${h.decisionFactors.join("; ")}
- เงื่อนไขที่ลูกค้าจะซื้อ: ${h.willBuyIf}

## ข้อมูลการโทร
ระยะเวลา: ${Math.round(durationSec)} วินาที, จำนวนรอบ: ${messages.filter((m) => m.role === "tsr").length}, การจบสาย: ${endedText}

## บทสนทนา
${transcript}

ประเมินบทสนทนานี้ตามเกณฑ์`;
}
