import type { Difficulty } from "./types.ts";

export const RUBRIC_KEYS = [
  "opening",
  "discovery",
  "presentation",
  "objection",
  "closing",
  "tone",
] as const;

export type RubricKey = (typeof RUBRIC_KEYS)[number];

export interface RubricItem {
  key: RubricKey;
  label: string;
  labelTh: string;
  description: string;
}

/** เกณฑ์การประเมิน 6 ด้าน (แก้คำอธิบายได้ ระบบจะส่งไปให้ AI ใช้ประเมินอัตโนมัติ) */
export const RUBRIC: readonly RubricItem[] = [
  {
    key: "opening",
    label: "Opening & Compliance",
    labelTh: "การเปิดสายและการปฏิบัติตามกฎ",
    description:
      "แนะนำชื่อตนเอง ชื่อบริษัท เลขที่ใบอนุญาต แจ้งวัตถุประสงค์ของการโทร และขออนุญาตลูกค้าก่อนสนทนาต่อ ตามแนวปฏิบัติการขายประกันทางโทรศัพท์ของ คปภ.",
  },
  {
    key: "discovery",
    label: "Needs Discovery",
    labelTh: "การค้นหาความต้องการ",
    description:
      "ถามข้อมูลรถ (รุ่น ปี) ลักษณะการใช้งาน ประกันเดิมและวันหมดอายุ งบประมาณ และความกังวลของลูกค้า ก่อนเสนอแผน",
  },
  {
    key: "presentation",
    label: "Product Presentation",
    labelTh: "การนำเสนอแผนประกัน",
    description:
      "อธิบายความคุ้มครอง ทุนประกัน ค่าเสียหายส่วนแรก ซ่อมห้าง/ซ่อมอู่ ให้ตรงกับความต้องการที่ค้นพบ ถูกต้อง ไม่พูดเกินจริง",
  },
  {
    key: "objection",
    label: "Objection Handling",
    labelTh: "การรับมือข้อโต้แย้ง",
    description:
      "รับมือข้ออ้างด้วยโครง รับฟัง → เห็นใจ → ถามเจาะ → ตอบ → ปิดกลับ ไม่เถียงหรือเพิกเฉยต่อข้อกังวล",
  },
  {
    key: "closing",
    label: "Closing",
    labelTh: "การปิดการขาย",
    description:
      "ขอปิดการขายอย่างชัดเจน สรุปความคุ้มครอง ราคา ช่องทางชำระเงิน และสิทธิ์การยกเลิก/ระยะเวลาพิจารณา หรือได้นัดหมายต่อที่ชัดเจนถ้ายังไม่ปิด",
  },
  {
    key: "tone",
    label: "Tone & Clarity",
    labelTh: "น้ำเสียงและความชัดเจน",
    description:
      "สุภาพ ไม่กดดัน ประโยคสั้นและชัด ไม่ใช้ศัพท์เทคนิคโดยไม่อธิบาย ปรับการพูดให้เข้ากับลูกค้า",
  },
];

export function rubricItem(key: RubricKey): RubricItem {
  const item = RUBRIC.find((r) => r.key === key);
  if (!item) throw new Error(`Unknown rubric key: ${key}`);
  return item;
}

/** ทักษะแต่ละด้าน -> กลุ่มข้ออ้างที่ควรฝึกเพิ่มในโมดูล Objection Drill */
export const SKILL_TO_OBJECTION_GROUPS: Record<RubricKey, string[]> = {
  opening: ["distrust", "no-time"],
  discovery: ["has-insurance", "no-need", "ask-others"],
  presentation: ["price", "no-need", "bad-claim"],
  objection: ["price", "has-insurance", "distrust", "no-time", "think-first", "ask-others", "bad-claim", "no-need"],
  closing: ["think-first", "ask-others", "price"],
  tone: ["distrust", "bad-claim", "no-time"],
};

export const DIFFICULTIES: readonly { key: Difficulty; label: string; description: string }[] = [
  { key: "easy", label: "ง่าย", description: "ลูกค้าเปิดใจ ให้ข้อมูลง่าย ปฏิเสธน้อย" },
  { key: "normal", label: "ปกติ", description: "มีข้อกังวลตามบุคลิก ยกข้ออ้าง 1-2 ครั้ง" },
  { key: "hard", label: "ยาก", description: "ปฏิเสธถี่ พูดแทรก และวางสายได้ถ้าพูดผิดกติกา" },
];

export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTIES.find((x) => x.key === d)?.label ?? d;
}

export const OUTCOME_LABELS = {
  sold: "ปิดการขายได้",
  callback: "ได้นัดโทรกลับ/ส่งข้อมูล",
  rejected: "ลูกค้าปฏิเสธ",
  hung_up: "ลูกค้าวางสาย",
  unclear: "ยังไม่ชัดเจน",
} as const;

export type CallOutcome = keyof typeof OUTCOME_LABELS;
export const CALL_OUTCOMES = Object.keys(OUTCOME_LABELS) as CallOutcome[];
