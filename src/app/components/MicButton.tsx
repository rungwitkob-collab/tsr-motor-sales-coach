import { Icon } from "./Icon.tsx";

/** ปุ่มไมค์ขนาดใหญ่ กดง่ายบนมือถือ */
export function MicButton({
  listening,
  supported,
  disabled,
  onClick,
  size = "lg",
}: {
  listening: boolean;
  supported: boolean;
  disabled?: boolean;
  onClick: () => void;
  size?: "lg" | "md";
}) {
  const dims = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!supported || disabled}
      aria-pressed={listening}
      aria-label={listening ? "หยุดฟังเสียง" : "กดเพื่อพูด"}
      title={supported ? (listening ? "แตะเพื่อหยุด" : "แตะเพื่อพูด") : "เบราว์เซอร์นี้ไม่รองรับการพูด ใช้การพิมพ์แทน"}
      className={`relative inline-flex ${dims} shrink-0 items-center justify-center rounded-full text-white shadow-float transition active:scale-95 disabled:cursor-not-allowed disabled:bg-brand-100 disabled:text-ink-muted disabled:shadow-none ${
        listening ? "bg-danger motion-safe:animate-soft-pulse" : "bg-brand-700 hover:bg-brand-900"
      }`}
    >
      <Icon name={listening ? "stop" : "mic"} className={size === "lg" ? "relative h-8 w-8" : "relative h-6 w-6"} />
    </button>
  );
}
