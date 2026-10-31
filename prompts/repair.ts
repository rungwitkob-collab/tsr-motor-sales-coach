/** prompt ซ่อม JSON เมื่อ Gemini ตอบกลับมาไม่ตรง schema (ใช้ retry 1 ครั้ง) */
export function buildRepairPrompt(problem: string): string {
  return `คำตอบก่อนหน้าไม่ใช่ JSON ที่ถูกต้องตาม schema ที่กำหนด (ปัญหา: ${problem.slice(0, 500)})
กรุณาตอบใหม่เป็น JSON ที่ถูกต้องตาม schema เท่านั้น ครบทุก field ที่ required ไม่มีข้อความอื่นนอก JSON ไม่มี markdown code fence`;
}
