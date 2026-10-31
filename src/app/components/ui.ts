/**
 * คลาสที่ใช้ซ้ำทั้งแอป (อ้างอิง design tokens ใน index.css เท่านั้น)
 * แก้สไตล์ปุ่ม/ช่องกรอก/การ์ดที่นี่ที่เดียว
 */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100";

export const ui = {
  /** ปุ่มหลัก: brand-700 ตัวอักษรขาว */
  btnPrimary: `${btnBase} bg-brand-700 px-4 py-3 text-white shadow-card hover:bg-brand-900 disabled:bg-brand-100 disabled:text-ink-muted disabled:shadow-none`,
  /** ปุ่มรอง: outline brand-300 ตัวอักษร brand-700 */
  btnSecondary: `${btnBase} border border-brand-300 bg-white px-4 py-3 text-brand-700 hover:bg-brand-50 disabled:text-ink-muted`,
  /** ปุ่มเน้นทอง (เช่น ฝึกจุดอ่อน) */
  btnGold: `${btnBase} border border-gold-500 bg-gold-100 px-4 py-3 text-brand-900 hover:bg-gold-500/40`,
  /** ปุ่มอันตราย (จบสาย) */
  btnDanger: `${btnBase} min-h-11 bg-danger px-3 py-2.5 text-white shadow-card hover:bg-danger-700`,
  /** ปุ่มขนาดใหญ่สำหรับ call-to-action หลักของหน้า */
  btnHero: `${btnBase} w-full bg-brand-700 px-6 py-4 text-lg text-white shadow-float hover:bg-brand-900 disabled:bg-brand-100 disabled:text-ink-muted disabled:shadow-none`,
  /** ลิงก์ข้อความ */
  link: "font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900",
  input:
    "block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-300 focus:outline-none disabled:bg-brand-50",
  label: "text-sm font-medium text-ink",
  card: "rounded-card border border-line bg-white p-4 shadow-card",
  /** card ที่เน้น (พื้น brand-100): ใช้ตัวอักษร ink / brand-700 / brand-900 เท่านั้น */
  cardAccent: "rounded-card border border-brand-300 bg-brand-100 p-4",
  badge: "inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-sm text-brand-900",
  badgeGold: "inline-flex items-center rounded-full bg-gold-100 px-3 py-1 text-sm font-medium text-gold-700",
  noticeWarning: "rounded-xl border border-warning bg-warning-soft p-3 text-sm text-ink",
  noticeSuccess: "rounded-xl border border-success bg-success-soft p-3 text-sm text-success-700",
  noticeDanger: "rounded-xl border border-danger bg-danger-soft p-3 text-sm text-danger-700",
} as const;

/** ปุ่มตัวเลือก (persona / ระดับความยาก) */
export function choiceClass(selected: boolean): string {
  return `rounded-card border p-3 text-left transition ${
    selected ? "border-brand-500 bg-brand-50 ring-2 ring-brand-300" : "border-line bg-white hover:border-brand-300"
  }`;
}

/** chip ตัวกรอง */
export function chipClass(selected: boolean): string {
  return `rounded-full border px-3 py-1.5 text-sm transition ${
    selected ? "border-brand-700 bg-brand-700 text-white" : "border-brand-300 bg-white text-brand-700 hover:bg-brand-50"
  }`;
}
