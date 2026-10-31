/**
 * เสียงฟรีจาก browser:
 * - SpeechRecognition (th-TH) สำหรับ TSR พูดผ่านไมค์
 * - SpeechSynthesis สำหรับให้ลูกค้าจำลองอ่านออกเสียง
 * ถ้าไม่รองรับ หน้าเว็บจะใช้การพิมพ์แทนเสมอ
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* ---- Minimal typings (lib.dom ของ TypeScript ยังไม่มี SpeechRecognition) ---- */
interface RecognitionAlternative {
  readonly transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: RecognitionAlternative;
}
interface RecognitionResultList {
  readonly length: number;
  readonly [index: number]: RecognitionResult;
}
interface RecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: RecognitionResultList;
}
interface RecognitionErrorEvent extends Event {
  readonly error: string;
}
interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const RECOGNITION_ERRORS: Record<string, string> = {
  "not-allowed": "ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์ หรือพิมพ์แทน",
  "service-not-allowed": "เบราว์เซอร์ไม่อนุญาตให้ใช้การรู้จำเสียง (บน iOS ให้เปิด Siri & Dictation) หรือพิมพ์แทน",
  "no-speech": "ไม่ได้ยินเสียง ลองกดไมค์แล้วพูดใกล้ ๆ อีกครั้ง",
  "audio-capture": "ไม่พบไมโครโฟนในเครื่องนี้ กรุณาพิมพ์แทน",
  network: "การแปลงเสียงเป็นข้อความต้องใช้อินเทอร์เน็ต กรุณาตรวจสอบการเชื่อมต่อ",
  "language-not-supported": "เบราว์เซอร์นี้ไม่รองรับการฟังภาษาไทย กรุณาพิมพ์แทน",
};

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [supported] = useState(() => getRecognitionCtor() !== undefined);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return;
    setError(null);
    finalRef.current = "";
    interimRef.current = "";
    setInterim("");
    const rec = new Ctor();
    rec.lang = "th-TH";
    // iOS Safari ทำงานไม่เสถียรเมื่อ continuous = true
    rec.continuous = !isIOS();
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      finalRef.current = finalText;
      interimRef.current = interimText;
      setInterim(`${finalText}${interimText}`);
    };
    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(RECOGNITION_ERRORS[event.error] ?? `ไมโครโฟนมีปัญหา (${event.error}) กรุณาพิมพ์แทน`);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      const text = `${finalRef.current}${interimRef.current}`.trim();
      setInterim("");
      if (text) onFinalRef.current(text);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setError("เริ่มใช้ไมโครโฟนไม่ได้ กรุณาลองใหม่หรือพิมพ์แทน");
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    finalRef.current = "";
    interimRef.current = "";
    recRef.current?.abort();
  }, []);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, interim, error, start, stop, cancel, toggle, clearError: () => setError(null) };
}

export function useSpeechSynthesis() {
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const thaiVoice = voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("th"));

  /** อ่านออกเสียง คืน Promise ที่ resolve เมื่ออ่านจบ */
  const speak = useCallback(
    (text: string, gender: "male" | "female" = "female"): Promise<void> => {
      if (!supported || !text.trim()) return Promise.resolve();
      return new Promise<void>((resolve) => {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "th-TH";
        if (thaiVoice) u.voice = thaiVoice;
        u.rate = 1.0;
        u.pitch = gender === "female" ? 1.15 : 0.85;
        const done = () => {
          setSpeaking(false);
          resolve();
        };
        u.onend = done;
        u.onerror = done;
        setSpeaking(true);
        window.speechSynthesis.speak(u);
        // กันกรณีบางเบราว์เซอร์ไม่ยิง onend
        setTimeout(done, Math.min(30_000, 2_000 + text.length * 180));
      });
    },
    [supported, thaiVoice],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  /** iOS ต้องเรียก speak ครั้งแรกจาก user gesture จึงจะอ่านออกเสียงได้ */
  const unlock = useCallback(() => {
    if (!supported) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }, [supported]);

  return { supported, hasThaiVoice: thaiVoice !== undefined, speaking, speak, cancel, unlock };
}
