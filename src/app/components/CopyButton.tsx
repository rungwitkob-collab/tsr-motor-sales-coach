import { useState } from "react";
import { copyText } from "../lib/clipboard.ts";
import { Icon } from "./Icon.tsx";

/** ปุ่มคัดลอกคลิกเดียว */
export function CopyButton({ text, label = "คัดลอก", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? "done" : "fail");
    setTimeout(() => setState("idle"), 1800);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        state === "done"
          ? "border-success bg-success-soft text-success-700"
          : state === "fail"
            ? "border-danger bg-danger-soft text-danger-700"
            : "border-brand-300 bg-white text-brand-700 hover:bg-brand-50 active:bg-brand-100"
      } ${className}`}
      aria-live="polite"
    >
      <Icon name={state === "done" ? "check" : "copy"} className="h-4 w-4" />
      {state === "done" ? "คัดลอกแล้ว" : state === "fail" ? "คัดลอกไม่ได้" : label}
    </button>
  );
}
