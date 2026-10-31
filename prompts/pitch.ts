/** System instruction ของ Pitch Builder */
import type { PitchRequestParsed } from "../src/shared/schemas.ts";
import { company, findPlan } from "../src/shared/content.ts";
import { companyContext, productsContext, THAI_OUTPUT_RULE } from "./context.ts";

export function buildPitchSystemPrompt(): string {
  return `คุณคือผู้เชี่ยวชาญเขียนบทพูดขายประกันรถยนต์ทางโทรศัพท์ให้ TSR ของ ${company.name}

## ข้อมูลบริษัท
${companyContext()}

## ${productsContext()}

## กติกา
- เลือกแผนที่เหมาะที่สุดจากรายการข้างต้น ใส่ id ของแผนใน recommendedPlanId (ต้องเป็น id ที่มีอยู่จริง) และอธิบายเหตุผลใน reason 1-2 ประโยค
- pitch30s: บทพูดประมาณ 30 วินาที (ราว 80-110 คำ) เริ่มจากเชื่อมกับสถานการณ์ลูกค้า เสนอประโยชน์ 2 ข้อที่ตรงกับความกังวล และจบด้วยคำถามปิดกลับ
- shortVersion: เวอร์ชันสั้นประมาณ 15 วินาที สำหรับลูกค้าที่ไม่มีเวลา
- longVersion: เวอร์ชันยาวประมาณ 60 วินาที อธิบายความคุ้มครอง ทุนประกัน ค่าเสียหายส่วนแรก และการซ่อมให้ชัด
- discoveryQuestions: คำถามค้นหาความต้องการเพิ่มเติม 2-4 ข้อที่ TSR ควรถามลูกค้าคนนี้
- ใช้ภาษาพูดทางโทรศัพท์ สุภาพ ไม่กดดัน ห้ามพูดเกินจริงหรือรับรองผลการเคลม ห้ามแต่งราคาที่ไม่มีในข้อมูล ถ้าต้องพูดราคาให้ใช้ช่วงราคาหรือบอกว่าจะเสนอราคาที่แน่นอนให้
- ใช้ "ค่ะ/ครับ" แบบกลาง ๆ เพื่อให้ TSR เลือกใช้เองได้
- ${THAI_OUTPUT_RULE}
- ตอบเป็น JSON ตาม schema เท่านั้น`;
}

export function buildPitchUserPrompt(req: PitchRequestParsed): string {
  const plan = req.planId ? findPlan(req.planId) : undefined;
  const c = req.customer;
  const lines = [
    `รถ: ${req.car.brand} ${req.car.model} ปี ${req.car.year}`,
    `การใช้รถ: ${req.car.usage || "ไม่ระบุ"}`,
    `ชื่อลูกค้า: ${c.name || "ไม่ระบุ"}`,
    `ช่วงอายุ: ${c.ageRange || "ไม่ระบุ"}`,
    `อาชีพ: ${c.occupation || "ไม่ระบุ"}`,
    `ประกันปัจจุบัน: ${c.currentInsurance || "ไม่ระบุ"}`,
    `งบประมาณ: ${c.budget || "ไม่ระบุ"}`,
    `ความกังวล/สิ่งที่ให้ความสำคัญ: ${c.concerns || "ไม่ระบุ"}`,
    plan ? `TSR ต้องการเสนอแผน: [${plan.id}] ${plan.name} (ให้ใช้แผนนี้)` : "ให้เลือกแผนที่เหมาะที่สุดเอง",
  ];
  return `ข้อมูลลูกค้า:\n${lines.join("\n")}\n\nสร้างบทพูดสำหรับลูกค้าคนนี้`;
}
