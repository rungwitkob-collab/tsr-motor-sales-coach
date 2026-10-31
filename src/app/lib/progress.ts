/** state สถิติการฝึกแบบ global (useSyncExternalStore) */
import { useSyncExternalStore } from "react";
import {
  emptyProgress,
  type CallRecord,
  type DrillRecord,
  type ProgressData,
  type QuizRecord,
} from "../../shared/schemas.ts";
import { createProgressStore } from "./storage.ts";

const store = createProgressStore();
let state: ProgressData = emptyProgress();
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function trim(d: ProgressData): ProgressData {
  return {
    ...d,
    calls: d.calls.slice(-500),
    drills: d.drills.slice(-1000),
    quizzes: d.quizzes.slice(-500),
    reviewObjectionIds: d.reviewObjectionIds.slice(-300),
  };
}

function update(fn: (d: ProgressData) => ProgressData) {
  // กันการเขียนทับข้อมูลเดิมก่อนโหลดเสร็จ
  if (!loaded) {
    void initProgress().then(() => update(fn));
    return;
  }
  state = trim(fn(state));
  emit();
  void store.save(state);
}

export function initProgress(): Promise<void> {
  loadPromise ??= store.load().then((data) => {
    state = data;
    loaded = true;
    emit();
  });
  return loadPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): ProgressData {
  return useSyncExternalStore(subscribe, () => state);
}

export function getProgressSnapshot(): ProgressData {
  return state;
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const progressActions = {
  addCall(record: CallRecord) {
    update((d) => ({ ...d, calls: [...d.calls, record] }));
  },
  /** บันทึกผล drill: คะแนนต่ำกว่า 3 เข้า "ข้ออ้างที่ต้องทวน" ได้ 3 ขึ้นไปจะถูกนำออก */
  addDrill(record: DrillRecord) {
    update((d) => {
      const review = new Set(d.reviewObjectionIds);
      if (record.score < 3) review.add(record.objectionId);
      else review.delete(record.objectionId);
      return { ...d, drills: [...d.drills, record], reviewObjectionIds: [...review] };
    });
  },
  removeFromReview(objectionId: string) {
    update((d) => ({ ...d, reviewObjectionIds: d.reviewObjectionIds.filter((id) => id !== objectionId) }));
  },
  addQuiz(record: QuizRecord) {
    update((d) => ({ ...d, quizzes: [...d.quizzes, record] }));
  },
  setTraineeName(name: string) {
    update((d) => ({ ...d, traineeName: name.trim() }));
  },
  replaceAll(data: ProgressData) {
    update(() => data);
  },
  reset() {
    update((d) => ({ ...emptyProgress(), traineeName: d.traineeName }));
  },
};
