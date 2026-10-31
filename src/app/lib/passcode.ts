/** เก็บ passcode และชื่อผู้ฝึกไว้ใน localStorage */
const PASSCODE_KEY = "tsr.passcode";
const TRAINEE_KEY = "tsr.traineeName";
export const UNAUTHORIZED_EVENT = "tsr:unauthorized";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode หรือพื้นที่เต็ม: ข้ามไป
  }
}

export const getPasscode = () => safeGet(PASSCODE_KEY);
export const setPasscode = (v: string) => safeSet(PASSCODE_KEY, v);
export const clearPasscode = () => safeSet(PASSCODE_KEY, null);

export const getTraineeName = () => safeGet(TRAINEE_KEY) ?? "";
export const setTraineeName = (v: string) => safeSet(TRAINEE_KEY, v.trim() || null);

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
