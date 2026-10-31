import { useCallback, useState } from "react";

type Primitive = string | number | boolean;
/** แปลง literal type (เช่น 45, true) เป็น type กว้าง (number, boolean) */
type Widen<T extends Primitive> = T extends string ? string : T extends number ? number : boolean;

/** state ที่จำค่าไว้ใน localStorage (เช่น การตั้งค่าเสียง) */
export function useLocalStorageState<T extends Primitive>(key: string, initial: T): [Widen<T>, (value: Widen<T>) => void] {
  const [value, setValue] = useState<Widen<T>>(() => {
    const fallback = initial as unknown as Widen<T>;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === typeof initial ? (parsed as Widen<T>) : fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (v: Widen<T>) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // private mode หรือพื้นที่เต็ม: ใช้ค่าในหน่วยความจำต่อไป
      }
    },
    [key],
  );
  return [value, set];
}
