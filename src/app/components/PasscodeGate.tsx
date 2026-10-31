/** หน้ากรอกรหัสผ่านทีม (APP_PASSCODE) ก่อนใช้งานครั้งแรก */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { company } from "../../shared/content.ts";
import { api, ApiError, errorMessage } from "../lib/api.ts";
import { getPasscode, getTraineeName, setPasscode, setTraineeName, UNAUTHORIZED_EVENT } from "../lib/passcode.ts";
import { progressActions } from "../lib/progress.ts";
import { Spinner } from "./Feedback.tsx";
import { Icon } from "./Icon.tsx";
import { ui } from "./ui.ts";

export function PasscodeGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => Boolean(getPasscode()));
  const [kickedOut, setKickedOut] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState(getTraineeName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onUnauthorized = () => {
      setUnlocked(false);
      setKickedOut(true);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("กรุณากรอกรหัสผ่านทีม");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.checkPasscode(trimmed);
      setPasscode(trimmed);
      setTraineeName(name);
      if (name.trim()) progressActions.setTraineeName(name);
      setUnlocked(true);
      setKickedOut(false);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบกับหัวหน้าทีม" : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-100 to-brand-50 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-card border border-line bg-white p-6 shadow-float">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-gold-100 ring-4 ring-gold-100">
            <Icon name="shield" className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-brand-900">TSR Motor Sales Coach</h1>
          <p className="text-sm text-ink-muted">เครื่องมือฝึกขายประกันรถยนต์ทางโทรศัพท์ของ {company.name}</p>
        </div>

        {kickedOut && (
          <p className={ui.noticeWarning}>รหัสผ่านทีมถูกเปลี่ยนหรือไม่ถูกต้อง กรุณากรอกใหม่</p>
        )}

        <label className="block space-y-1.5">
          <span className={ui.label}>รหัสผ่านทีม</span>
          <input
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={ui.input}
            placeholder="ขอรหัสจากหัวหน้าทีม"
            maxLength={100}
          />
        </label>

        <label className="block space-y-1.5">
          <span className={ui.label}>ชื่อเล่น / รหัสพนักงาน (ไม่บังคับ)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={ui.input}
            placeholder="ใช้แสดงในสคริปต์และไฟล์ export"
            maxLength={64}
          />
        </label>

        {error && (
          <p className={ui.noticeDanger} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className={`${ui.btnPrimary} w-full text-base`}
        >
          {busy && <Spinner className="h-5 w-5" />}
          {busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
        </button>
        <p className="text-center text-xs text-ink-muted">รหัสจะถูกจำไว้ในเบราว์เซอร์นี้ ไม่ต้องกรอกซ้ำ</p>
      </form>
    </div>
  );
}
