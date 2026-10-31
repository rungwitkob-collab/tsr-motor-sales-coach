/**
 * ที่เก็บสถิติการฝึก
 * - MVP: LocalStorageProgressStore (ไม่มี login ไม่มี database)
 * - อนาคต: KvProgressStore ซิงก์ไป Cloudflare KV ผ่าน /api/progress
 *   เปิดใช้โดยตั้ง VITE_PROGRESS_BACKEND=kv ตอน build และเพิ่ม binding PROGRESS_KV ใน wrangler.jsonc
 */
import { emptyProgress, progressSchema, type ProgressData } from "../../shared/schemas.ts";
import { api } from "./api.ts";
import { getTraineeName } from "./passcode.ts";

export interface ProgressStore {
  readonly kind: "local" | "kv";
  load(): Promise<ProgressData>;
  save(data: ProgressData): Promise<void>;
}

const STORAGE_KEY = "tsr.progress.v1";

/** ตรวจและแปลงข้อมูล (ใช้ทั้งตอนโหลดและตอน import ไฟล์) */
export function parseProgress(raw: unknown): ProgressData | null {
  const result = progressSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export class LocalStorageProgressStore implements ProgressStore {
  readonly kind = "local" as const;

  async load(): Promise<ProgressData> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyProgress();
      const parsed = parseProgress(JSON.parse(raw));
      if (parsed) return parsed;
      // ข้อมูลเสีย: สำรองไว้ก่อนเริ่มใหม่ เผื่อกู้คืน
      localStorage.setItem(`${STORAGE_KEY}.corrupt.${Date.now()}`, raw);
      return emptyProgress();
    } catch {
      return emptyProgress();
    }
  }

  async save(data: ProgressData): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn("บันทึกสถิติไม่สำเร็จ (พื้นที่ localStorage อาจเต็ม)", err);
    }
  }
}

/** ซิงก์ไป KV โดยยังเก็บสำเนาใน localStorage เสมอ (ใช้งานต่อได้แม้ออฟไลน์) */
export class KvProgressStore implements ProgressStore {
  readonly kind = "kv" as const;
  private readonly local = new LocalStorageProgressStore();
  private timer: ReturnType<typeof setTimeout> | undefined;

  async load(): Promise<ProgressData> {
    const local = await this.local.load();
    const traineeId = getTraineeName();
    if (!traineeId) return local;
    try {
      const { progress } = await api.getProgress(traineeId);
      if (!progress) return local;
      // เลือกชุดที่มีข้อมูลมากกว่า (ง่ายและปลอดภัยพอสำหรับผู้ใช้คนเดียวหลายเครื่อง)
      const size = (d: ProgressData) => d.calls.length + d.drills.length + d.quizzes.length;
      return size(progress) >= size(local) ? progress : local;
    } catch (err) {
      console.warn("โหลดสถิติจาก KV ไม่สำเร็จ ใช้ข้อมูลในเครื่องแทน", err);
      return local;
    }
  }

  async save(data: ProgressData): Promise<void> {
    await this.local.save(data);
    const traineeId = getTraineeName();
    if (!traineeId) return;
    // หน่วงเวลาเพื่อลดจำนวนครั้งที่เขียน KV (free tier จำกัดจำนวน write ต่อวัน)
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      api.putProgress(traineeId, data).catch((err: unknown) => console.warn("ซิงก์สถิติไป KV ไม่สำเร็จ", err));
    }, 5_000);
  }
}

export function createProgressStore(): ProgressStore {
  return import.meta.env.VITE_PROGRESS_BACKEND === "kv" ? new KvProgressStore() : new LocalStorageProgressStore();
}
