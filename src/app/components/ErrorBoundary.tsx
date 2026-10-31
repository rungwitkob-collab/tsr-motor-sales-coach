import { Component, type ErrorInfo, type ReactNode } from "react";
import { ui } from "./ui.ts";

/** กันหน้าขาว: ถ้า component พังจะแสดงข้อความไทยพร้อมปุ่มโหลดใหม่ */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-brand-50 p-6">
        <div className={`${ui.card} max-w-sm space-y-3 text-center`}>
          <p className="text-lg font-bold text-brand-900">หน้านี้เกิดข้อผิดพลาด</p>
          <p className="text-sm text-ink-muted">ข้อมูลการฝึกของคุณยังอยู่ครบ ลองโหลดหน้าใหม่อีกครั้ง</p>
          <p className="rounded-lg bg-brand-50 p-2 text-xs break-words text-ink-muted">{this.state.error.message}</p>
          <button type="button" onClick={() => window.location.reload()} className={`${ui.btnPrimary} w-full`}>
            โหลดหน้าใหม่
          </button>
        </div>
      </div>
    );
  }
}
