/** สถานะ loading / error / empty ที่ใช้ทุกหน้า */
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, errorMessage } from "../lib/api.ts";
import { Icon } from "./Icon.tsx";
import { ui } from "./ui.ts";

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingBlock({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className={`${ui.card} flex flex-col items-center justify-center gap-3 p-8 text-center`} role="status">
      <Spinner className="h-8 w-8 text-brand-500" />
      <p className="font-medium text-ink">{label}</p>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

function useCountdown(seconds: number | undefined): number {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    setLeft(seconds ?? 0);
    if (!seconds) return;
    const started = Date.now();
    const id = setInterval(() => {
      const remain = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remain);
      if (remain === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return left;
}

export function ErrorNotice({
  error,
  onRetry,
  retryLabel = "ลองใหม่",
  children,
}: {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}) {
  const apiErr = error instanceof ApiError ? error : null;
  // ไม่นับถอยหลังนานเกิน 5 นาทีในหน้าเว็บ (โควตารายวันจะแสดงเป็นข้อความแทน)
  const wait = apiErr?.retryAfterSec && apiErr.retryAfterSec <= 300 ? apiErr.retryAfterSec : undefined;
  const left = useCountdown(wait);
  const title =
    apiErr?.code === "QUOTA_EXCEEDED"
      ? "โควตา AI เต็มชั่วคราว"
      : apiErr?.code === "RATE_LIMITED"
        ? "ส่งคำขอถี่เกินไป"
        : apiErr?.code === "TIMEOUT"
          ? "AI ตอบช้าเกินไป"
          : apiErr?.code === "SAFETY_BLOCKED"
            ? "ข้อความติดตัวกรองความปลอดภัย"
            : apiErr?.code === "NETWORK_ERROR"
              ? "ไม่มีการเชื่อมต่อ"
              : apiErr?.code === "CONFIG_ERROR"
                ? "ระบบยังตั้งค่าไม่ครบ"
                : "เกิดข้อผิดพลาด";
  return (
    <div className="rounded-card border border-danger bg-danger-soft p-4 text-ink" role="alert">
      <div className="flex items-start gap-3">
        <Icon name="warning" className="mt-0.5 h-5 w-5 shrink-0 text-danger-700" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-danger-700">{title}</p>
          <p className="text-sm leading-relaxed">{errorMessage(error)}</p>
          {children}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={left > 0}
              className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger-700 disabled:cursor-not-allowed disabled:bg-white disabled:text-ink-muted"
            >
              <Icon name="refresh" className="h-4 w-4" />
              {left > 0 ? `ลองใหม่ได้ในอีก ${left} วินาที` : retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-brand-300 bg-white p-6 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-muted">{children}</div>}
    </div>
  );
}
