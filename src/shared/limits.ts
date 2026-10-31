/** ข้อจำกัดที่ใช้ร่วมกันทั้ง Worker และหน้าเว็บ เพื่อคุมโทเค็นและป้องกันการใช้งานเกินจำเป็น */
export const LIMITS = {
  /** จำนวนรอบสนทนาสูงสุดต่อสาย (1 รอบ = TSR พูด 1 ครั้ง + ลูกค้าตอบ 1 ครั้ง) */
  maxTurnsPerCall: 25,
  /** ความยาวสูงสุดของข้อความ TSR ต่อครั้ง (ตัวอักษร) */
  maxTsrMessageChars: 600,
  /** ความยาวสูงสุดของข้อความลูกค้าที่ส่งกลับมาใน transcript */
  maxCustomerMessageChars: 1500,
  /** ความยาวคำตอบใน Objection Drill */
  maxDrillAnswerChars: 1200,
  /** ความยาวช่องข้อมูลแต่ละช่องใน Pitch Builder */
  maxPitchFieldChars: 300,
  /** จำนวนข้อสูงสุดที่ขอให้ AI สร้างต่อครั้ง */
  maxQuizQuestions: 10,
  /** เวลามาตรฐานสำหรับตอบข้ออ้าง (วินาที) */
  defaultDrillSeconds: 45,
  /** เวลาเป้าหมายต่อสาย (วินาที) ใช้แสดงเตือนในหน้าโทร */
  targetCallSeconds: 8 * 60,
  /** ขนาด request body สูงสุด (bytes) */
  maxBodyBytes: 64 * 1024,
  /** ขนาด progress JSON สูงสุดสำหรับ KV (bytes) */
  maxProgressBytes: 512 * 1024,
} as const;

/** เครื่องหมายพิเศษที่ AI ลูกค้าใส่ท้ายข้อความ หน้าเว็บจะตัดออกก่อนแสดงผลและอ่านออกเสียง */
export const CALL_MARKERS = {
  hangUp: "[วางสาย]",
  agreed: "[ตกลงซื้อ]",
} as const;

/** ชื่อ header ที่ใช้ส่ง passcode (ค่าถูก encodeURIComponent เพื่อรองรับภาษาไทย) */
export const PASSCODE_HEADER = "X-App-Passcode";
/** ชื่อ header สำหรับระบุผู้ฝึก (ใช้เฉพาะโหมดเก็บสถิติบน KV) */
export const TRAINEE_HEADER = "X-Trainee-Id";
