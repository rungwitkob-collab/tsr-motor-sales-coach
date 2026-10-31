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

  /**
   * ดึงข้อความที่ฟังได้จนถึงตอนนี้ (รวมส่วนที่ยังไม่ final) แบบ synchronous แล้วหยุดไมค์ทันที
   * ใช้ตอนหมดเวลา/กดส่งขณะไมค์ยังฟังอยู่ เพื่อไม่ให้คำพูดหายหรือ onFinal มา append ซ้ำทีหลัง
   */
  const takeTranscript = useCallback((): string => {
    const text = `${finalRef.current}${interimRef.current}`.trim();
    finalRef.current = "";
    interimRef.current = "";
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    setListening(false);
    setInterim("");
    return text;
  }, []);

  return { supported, listening, interim, error, start, stop, cancel, toggle, takeTranscript, clearError: () => setError(null) };
}

const TTS_ERRORS: Record<string, string> = {
  "not-allowed": "เบราว์เซอร์ไม่อนุญาตให้เล่นเสียงอัตโนมัติ แตะหน้าจอหนึ่งครั้งแล้วลองใหม่ (iPhone: ปิดโหมดเงียบที่สวิตช์ข้างเครื่อง)",
  "audio-busy": "ลำโพงถูกแอปอื่นใช้งานอยู่ ปิดแอปที่เล่นเสียงแล้วลองใหม่",
  "synthesis-unavailable": "เครื่องนี้ไม่มีเสียงอ่านภาษาไทย ติดตั้งเสียงภาษาไทยในระบบปฏิบัติการแล้วเปิดหน้านี้ใหม่",
  "synthesis-failed": "อ่านออกเสียงไม่สำเร็จ ลองติ๊ก 'เสียงลูกค้า' ออกแล้วติ๊กใหม่ หรือเปิดหน้านี้ใหม่",
  "language-unavailable": "เครื่องนี้ไม่มีเสียงอ่านภาษาไทย ติดตั้งเสียงภาษาไทยในระบบปฏิบัติการแล้วเปิดหน้านี้ใหม่",
  "voice-unavailable": "เสียงอ่านภาษาไทยที่เลือกใช้ไม่ได้ เปิดหน้านี้ใหม่เพื่อให้ระบบเลือกเสียงอื่น",
};

/** คำแนะนำติดตั้งเสียงไทยตามเครื่องที่ใช้ (แสดงเมื่อไม่พบเสียง th ในเครื่อง) */
export function thaiVoiceHint(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows: Settings → Time & Language → Speech → Add voices → เลือก Thai แล้วเปิดหน้านี้ใหม่";
  if (/Android/i.test(ua)) return "Android: ติดตั้ง/อัปเดต 'Speech Recognition & Synthesis' ของ Google แล้วเพิ่มภาษาไทยใน Settings → Text-to-speech";
  if (isIOS()) return "iPhone/iPad: ใช้ Safari และเปิดเสียงภาษาไทยใน Settings → Accessibility → Spoken Content → Voices → Thai";
  if (/Mac OS/i.test(ua)) return "Mac: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → เพิ่ม Thai";
  return "ติดตั้งเสียงอ่านภาษาไทยในระบบปฏิบัติการแล้วเปิดหน้านี้ใหม่";
}

export function useSpeechSynthesis() {
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chrome จะ GC utterance ที่ไม่มีใครอ้างถึงแล้ว onend ไม่ยิง จึงเก็บ ref ไว้จนกว่าจะอ่านจบ
  const currentRef = useRef<SpeechSynthesisUtterance | null>(null);

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
        const synth = window.speechSynthesis;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "th-TH";
        if (thaiVoice) u.voice = thaiVoice;
        u.rate = 1.0;
        u.pitch = gender === "female" ? 1.15 : 0.85;
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          if (currentRef.current === u) currentRef.current = null;
          setSpeaking(false);
          resolve();
        };
        u.onstart = () => setError(null);
        u.onend = done;
        u.onerror = (event: SpeechSynthesisErrorEvent) => {
          // interrupted/canceled คือเราเป็นคนสั่งหยุดเอง ไม่ใช่ความผิดพลาด
          if (event.error !== "interrupted" && event.error !== "canceled") {
            setError(TTS_ERRORS[event.error] ?? `อ่านออกเสียงไม่สำเร็จ (${event.error}) ลองเปิดหน้านี้ใหม่`);
          }
          done();
        };
        currentRef.current = u;
        setSpeaking(true);
        const start = () => {
          if (finished) return;
          synth.speak(u);
          // Chrome บางครั้งค้างในสถานะ paused หลัง cancel ทำให้เงียบ
          if (synth.paused) synth.resume();
        };
        // เรียก speak ทันทีหลัง cancel บน Chrome/Safari บางเวอร์ชันจะถูกทิ้งเงียบ ๆ จึงเว้นช่วงสั้น ๆ
        if (synth.speaking || synth.pending) {
          synth.cancel();
          setTimeout(start, 120);
        } else {
          start();
        }
        // กันกรณีบางเบราว์เซอร์ไม่ยิง onend
        setTimeout(done, Math.min(30_000, 2_000 + text.length * 180));
      });
    },
    [supported, thaiVoice],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    currentRef.current = null;
    setSpeaking(false);
  }, [supported]);

  /** iOS ต้องเรียก speak ครั้งแรกจาก user gesture จึงจะอ่านออกเสียงได้ */
  const unlock = useCallback(() => {
    if (!supported) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }, [supported]);

  return {
    supported,
    hasThaiVoice: thaiVoice !== undefined,
    /** true เมื่อเบราว์เซอร์ส่งรายชื่อเสียงมาแล้ว (ก่อนหน้านั้นยังสรุปไม่ได้ว่ามีเสียงไทยหรือไม่) */
    voicesLoaded: voices.length > 0,
    speaking,
    error,
    clearError: () => setError(null),
    speak,
    cancel,
    unlock,
  };
}
