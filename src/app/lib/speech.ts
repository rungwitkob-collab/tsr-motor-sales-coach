/**
 * เสียงฟรีจาก browser:
 * - SpeechRecognition (th-TH) สำหรับ TSR พูดผ่านไมค์
 * - SpeechSynthesis สำหรับให้ลูกค้าจำลองอ่านออกเสียง
 * ถ้าไม่รองรับ หน้าเว็บจะใช้การพิมพ์แทนเสมอ
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, isAbortError } from "./api.ts";

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

/* ---- Audio Session API (Safari 17+) ----
 * บน iOS เมื่อเปิดไมค์ (SpeechRecognition) ระบบจะสลับ audio session เป็นโหมดบันทึกเสียง
 * ทำให้เสียง SpeechSynthesis หลังจากนั้นเบามาก/ออกลำโพงหู หรือเงียบไปเลย
 * จึงประกาศชนิด session ให้ชัด: ตอนฟังไมค์ = play-and-record, ตอนให้ลูกค้าพูด = playback
 * (playback ยังทำให้เสียงดังแม้เปิดสวิตช์ปิดเสียงของ iPhone) เบราว์เซอร์อื่นไม่มี API นี้จะข้ามไป
 */
type AudioSessionType = "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";

function setAudioSessionType(type: AudioSessionType): void {
  if (typeof navigator === "undefined") return;
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // บางเวอร์ชันปฏิเสธค่าที่ไม่รู้จัก ไม่ต้องทำอะไร
  }
}

/** ไมค์กำลังฟังอยู่หรือไม่ (ใช้กันไม่ให้ speak() สลับ session ไปเป็น playback ขณะไมค์ยังเปิด) */
let recognitionActive = false;

function recognitionFinished(): void {
  if (!recognitionActive) return;
  recognitionActive = false;
  setAudioSessionType("playback");
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
      // ถ้าถูก cancel/takeTranscript ไปก่อนแล้ว (recRef ถูกล้างหรือเป็น session ใหม่) ไม่ต้องทำอะไรซ้ำ
      if (recRef.current !== rec) return;
      recRef.current = null;
      recognitionFinished();
      setListening(false);
      const text = `${finalRef.current}${interimRef.current}`.trim();
      setInterim("");
      if (text) onFinalRef.current(text);
    };
    recRef.current = rec;
    try {
      recognitionActive = true;
      setAudioSessionType("play-and-record");
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      recognitionFinished();
      setError("เริ่มใช้ไมโครโฟนไม่ได้ กรุณาลองใหม่หรือพิมพ์แทน");
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    finalRef.current = "";
    interimRef.current = "";
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    recognitionFinished();
    setListening(false);
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
    recognitionFinished();
    setListening(false);
    setInterim("");
    return text;
  }, []);

  return { supported, listening, interim, error, start, stop, cancel, toggle, takeTranscript, clearError: () => setError(null) };
}

/* ------------------------------------------------------------------ */
/* เสียงลูกค้า: Gemini TTS (ผ่าน /api/tts) เล่นด้วย Web Audio เป็นหลัก      */
/* SpeechSynthesis ของเบราว์เซอร์เป็นตัวสำรองเมื่อ AI ใช้ไม่ได้              */
/* เหตุผล: เสียงอ่านไทยของเบราว์เซอร์ไม่น่าเชื่อถือ (Chrome บน Mac เงียบ,     */
/* iOS เงียบหลังใช้ไมค์) ส่วน Web Audio ออกลำโพงได้แม้ session เป็น record  */
/* ------------------------------------------------------------------ */

type Gender = "male" | "female";
type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

let sharedAudioContext: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    sharedAudioContext = new Ctor();
  } catch {
    return null;
  }
  return sharedAudioContext;
}

/** คลิปที่ถอดรหัสแล้ว (ประโยครับสาย/ข้ออ้าง/ฟังอีกครั้ง ไม่ต้องขอ AI ซ้ำ) */
const clipCache = new Map<string, AudioBuffer>();
const CLIP_CACHE_MAX = 40;
function cacheClip(key: string, buffer: AudioBuffer): void {
  if (clipCache.size >= CLIP_CACHE_MAX) {
    const oldest = clipCache.keys().next().value;
    if (oldest !== undefined) clipCache.delete(oldest);
  }
  clipCache.set(key, buffer);
}

/** Chrome ทิ้ง utterance ที่ถูก GC ก่อนพูดจบ จึงเก็บ reference ไว้จนกว่าจะจบ */
let currentUtterance: SpeechSynthesisUtterance | null = null;

const TTS_ERRORS: Record<string, string> = {
  "not-allowed": "เบราว์เซอร์ไม่อนุญาตให้เล่นเสียงอัตโนมัติ แตะหน้าจอหนึ่งครั้งแล้วลองใหม่ (iPhone: ปิดโหมดเงียบที่สวิตช์ข้างเครื่อง)",
  "audio-busy": "ลำโพงถูกแอปอื่นใช้งานอยู่ ปิดแอปที่เล่นเสียงแล้วลองใหม่",
  "synthesis-unavailable": "เครื่องนี้ไม่มีเสียงอ่านภาษาไทย ติดตั้งเสียงภาษาไทยในระบบปฏิบัติการแล้วเปิดหน้านี้ใหม่",
  "synthesis-failed": "อ่านออกเสียงไม่สำเร็จ ลองติ๊ก 'เสียงลูกค้า' ออกแล้วติ๊กใหม่ หรือเปิดหน้านี้ใหม่",
  "language-unavailable": "เครื่องนี้ไม่มีเสียงอ่านภาษาไทย ติดตั้งเสียงภาษาไทยในระบบปฏิบัติการแล้วเปิดหน้านี้ใหม่",
  "voice-unavailable": "เสียงอ่านภาษาไทยที่เลือกใช้ไม่ได้ เปิดหน้านี้ใหม่เพื่อให้ระบบเลือกเสียงอื่น",
};

/** คำแนะนำติดตั้งเสียงไทยตามเครื่องที่ใช้ (ใช้เฉพาะตอนต้องพึ่งเสียงอ่านของเบราว์เซอร์) */
export function thaiVoiceHint(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows: Settings → Time & Language → Speech → Add voices → เลือก Thai แล้วเปิดหน้านี้ใหม่";
  if (/Android/i.test(ua)) return "Android: ติดตั้ง/อัปเดต 'Speech Recognition & Synthesis' ของ Google แล้วเพิ่มภาษาไทยใน Settings → Text-to-speech";
  if (isIOS()) return "iPhone/iPad: ใช้ Safari และเปิดเสียงภาษาไทยใน Settings → Accessibility → Spoken Content → Voices → Thai";
  if (/Mac OS/i.test(ua)) return "Mac: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → เพิ่ม Thai";
  return "ติดตั้งเสียงอ่านภาษาไทยในระบบปฏิบัติการแล้วเปิดหน้านี้ใหม่";
}

export type SpeechProvider = "ai" | "browser";

export function useSpeechSynthesis() {
  const [supported] = useState(
    () => typeof window !== "undefined" && (getAudioContextCtor() !== undefined || "speechSynthesis" in window),
  );
  const [browserSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** ข้อความแจ้งเมื่อเสียง AI ใช้ไม่ได้และสลับไปใช้เสียงเบราว์เซอร์ */
  const [notice, setNotice] = useState<string | null>(null);
  const [provider, setProvider] = useState<SpeechProvider | null>(null);
  const seqRef = useRef(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!browserSupported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [browserSupported]);

  const thaiVoice = voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("th"));

  const stopCurrent = useCallback(() => {
    seqRef.current += 1;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    const source = sourceRef.current;
    sourceRef.current = null;
    if (source) {
      try {
        source.stop();
      } catch {
        // ยังไม่เริ่มหรือจบไปแล้ว
      }
    }
    if (browserSupported) window.speechSynthesis.cancel();
    currentUtterance = null;
  }, [browserSupported]);

  useEffect(() => () => stopCurrent(), [stopCurrent]);

  /** เล่นเสียงจาก Gemini TTS คืน true เมื่อจัดการแล้ว (เล่นจบ/ถูกแทรก) คืน false ให้ใช้เสียงเบราว์เซอร์แทน */
  const speakWithAi = useCallback(async (text: string, gender: Gender, token: number): Promise<boolean> => {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (!recognitionActive) setAudioSessionType("playback");
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // iOS: resume นอก user gesture อาจไม่สำเร็จ
      }
    }
    if (token !== seqRef.current) return true;

    const key = `${gender}|${text}`;
    let buffer = clipCache.get(key);
    if (!buffer) {
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      let bytes: ArrayBuffer;
      try {
        bytes = await api.tts({ text, gender }, controller.signal);
      } catch (err) {
        if (isAbortError(err)) return true;
        if (err instanceof ApiError) {
          if (err.code === "NOT_CONFIGURED") setNotice(null);
          else if (err.code === "QUOTA_EXCEEDED" || err.code === "RATE_LIMITED") {
            setNotice("โควตาเสียงลูกค้าจาก AI เต็มชั่วคราว ใช้เสียงอ่านของเบราว์เซอร์แทน");
          } else setNotice(`เสียงลูกค้าจาก AI ขัดข้อง (${err.message}) ใช้เสียงอ่านของเบราว์เซอร์แทน`);
        } else {
          setNotice("เสียงลูกค้าจาก AI ขัดข้อง ใช้เสียงอ่านของเบราว์เซอร์แทน");
        }
        return false;
      } finally {
        if (fetchAbortRef.current === controller) fetchAbortRef.current = null;
      }
      if (token !== seqRef.current) return true;
      try {
        buffer = await ctx.decodeAudioData(bytes);
      } catch {
        setNotice("อ่านไฟล์เสียงจาก AI ไม่ได้ ใช้เสียงอ่านของเบราว์เซอร์แทน");
        return false;
      }
      cacheClip(key, buffer);
    }
    if (token !== seqRef.current) return true;
    // ถ้า AudioContext ยังถูกระงับ (ยังไม่เคยปลดล็อกด้วยการแตะ) เสียงจะไม่ออก ให้ใช้เสียงเบราว์เซอร์แทน
    if (ctx.state !== "running") return false;

    setNotice(null);
    setProvider("ai");
    const clip = buffer;
    await new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        if (sourceRef.current === source) sourceRef.current = null;
        resolve();
      };
      const source = ctx.createBufferSource();
      source.buffer = clip;
      source.connect(ctx.destination);
      source.onended = done;
      sourceRef.current = source;
      try {
        source.start();
      } catch {
        done();
      }
      setTimeout(done, clip.duration * 1000 + 2_000);
    });
    return true;
  }, []);

  /** ตัวสำรอง: SpeechSynthesis ของเบราว์เซอร์ */
  const speakWithBrowser = useCallback(
    (text: string, gender: Gender, token: number): Promise<void> => {
      if (!browserSupported || token !== seqRef.current) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const synth = window.speechSynthesis;
        // เรียก cancel() เฉพาะเมื่อมีคิวค้างจริง: Safari/Chrome บางเวอร์ชันจะทิ้ง utterance ถัดไป
        // แบบเงียบ ๆ ถ้า cancel() แล้ว speak() ติดกันโดยไม่จำเป็น
        if (synth.speaking || synth.pending) synth.cancel();
        if (!recognitionActive) setAudioSessionType("playback");
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "th-TH";
        if (thaiVoice) u.voice = thaiVoice;
        u.rate = 1.0;
        u.pitch = gender === "female" ? 1.15 : 0.85;
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          if (currentUtterance === u) currentUtterance = null;
          resolve();
        };
        u.onend = done;
        u.onerror = (event) => {
          // "interrupted"/"canceled" คือเรายกเลิกเอง (เช่น TSR เริ่มพูดแทรก) ไม่ใช่ความผิดพลาด
          if (event.error !== "interrupted" && event.error !== "canceled") {
            setError(TTS_ERRORS[event.error] ?? `เล่นเสียงลูกค้าไม่สำเร็จ (${event.error}) แตะ "ฟังอีกครั้ง" ที่ข้อความลูกค้า`);
          }
          done();
        };
        currentUtterance = u;
        setProvider("browser");
        synth.speak(u);
        // Chrome บางครั้งค้างในสถานะ paused หลัง cancel() ทำให้เงียบ resume() แก้ได้
        synth.resume();
        // กันกรณีบางเบราว์เซอร์ไม่ยิง onend
        setTimeout(done, Math.min(30_000, 2_000 + text.length * 180));
      });
    },
    [browserSupported, thaiVoice],
  );

  /** อ่านออกเสียง คืน Promise ที่ resolve เมื่ออ่านจบ (หรือถูกแทรก) */
  const speak = useCallback(
    (text: string, gender: Gender = "female"): Promise<void> => {
      if (!supported || !text.trim()) return Promise.resolve();
      stopCurrent();
      const token = seqRef.current;
      setError(null);
      setSpeaking(true);
      return (async () => {
        try {
          const handled = await speakWithAi(text, gender, token);
          if (!handled) await speakWithBrowser(text, gender, token);
        } finally {
          if (token === seqRef.current) setSpeaking(false);
        }
      })();
    },
    [supported, stopCurrent, speakWithAi, speakWithBrowser],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    stopCurrent();
    setSpeaking(false);
  }, [supported, stopCurrent]);

  /**
   * ต้องเรียกจาก user gesture (แตะปุ่มเริ่มสาย/ไมค์/ฟังอีกครั้ง) อย่างน้อยหนึ่งครั้ง:
   * - iOS/Safari: ปลดล็อก AudioContext และประกาศ session แบบ playback (ออกลำโพงแม้เปิดสวิตช์ปิดเสียง)
   * - SpeechSynthesis บน iOS ต้อง speak ครั้งแรกจาก gesture เช่นกัน (ใช้เป็นตัวสำรอง)
   * เรียกซ้ำได้ ถ้ามีเสียงกำลังเล่นอยู่จะไม่แทรก
   */
  const unlock = useCallback(() => {
    if (!supported) return;
    if (!recognitionActive) setAudioSessionType("playback");
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
      if (!sourceRef.current) {
        try {
          const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
          const s = ctx.createBufferSource();
          s.buffer = silent;
          s.connect(ctx.destination);
          s.start();
        } catch {
          // ไม่สำคัญ แค่ปลดล็อกไม่สำเร็จ
        }
      }
    }
    if (browserSupported) {
      const synth = window.speechSynthesis;
      if (!synth.speaking && !synth.pending) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        synth.speak(u);
      }
    }
  }, [supported, browserSupported]);

  return {
    supported,
    /** เสียงที่ใช้ล่าสุด: "ai" = Gemini TTS, "browser" = เสียงอ่านของเบราว์เซอร์ */
    provider,
    hasThaiVoice: thaiVoice !== undefined,
    /** true เมื่อเบราว์เซอร์ส่งรายชื่อเสียงมาแล้ว (ก่อนหน้านั้นยังสรุปไม่ได้ว่ามีเสียงไทยหรือไม่) */
    voicesLoaded: voices.length > 0,
    speaking,
    error,
    notice,
    speak,
    cancel,
    unlock,
    clearError: useCallback(() => setError(null), []),
  };
}
