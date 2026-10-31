import { company } from "../../shared/content.ts";

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatThaiDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatThaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/** แทนที่ตัวแปร {{name}} ในสคริปต์ */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

export function scriptVariables(agentName: string, customerName: string): Record<string, string> {
  return {
    company: company.name,
    licenseLabel: company.licenseLabel,
    licenseNumber: company.licenseNumber,
    hotline: company.hotline,
    agentName: agentName.trim() || "[ชื่อของคุณ]",
    customerName: customerName.trim() || "[ชื่อลูกค้า]",
    recordingNotice: company.callRecordingNotice,
    verificationChannel: company.verificationChannel,
    cancellationPolicy: company.cancellationPolicy,
    paymentChannels: company.paymentChannels.join(" หรือ "),
  };
}

/**
 * ระดับคะแนนตาม design guideline: 8-10 = ทอง, 5-7 = ม่วง, ต่ำกว่า 5 = danger
 * (คิดเป็นสัดส่วน ใช้ได้ทั้งคะแนน /10, /100 และ /5)
 */
export type ScoreTier = "high" | "mid" | "low";

export function scoreTier(score: number, max: number): ScoreTier {
  const ratio = score / max;
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.5) return "mid";
  return "low";
}

/** สีตัวอักษร (ทองใช้ gold-700 เพื่อผ่าน contrast AA บนพื้นขาว) */
const TIER_TEXT: Record<ScoreTier, string> = {
  high: "text-gold-700",
  mid: "text-brand-500",
  low: "text-danger",
};

/** สีแถบ/จุด/วง (ใช้ gold-500 ตาม guideline) */
const TIER_FILL: Record<ScoreTier, string> = {
  high: "bg-gold-500",
  mid: "bg-brand-500",
  low: "bg-danger",
};

export function scoreColor(score: number, max: number): string {
  return TIER_TEXT[scoreTier(score, max)];
}

export function scoreBarColor(score: number, max: number): string {
  return TIER_FILL[scoreTier(score, max)];
}
