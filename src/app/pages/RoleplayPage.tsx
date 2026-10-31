/** โมดูล 1: Roleplay Simulator (หน้าหลัก) + เข้าสู่โมดูล 2: Call Evaluation */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { EvaluateResponse } from "../../shared/api.ts";
import { CALL_MARKERS, LIMITS } from "../../shared/limits.ts";
import { DIFFICULTIES, difficultyLabel, RUBRIC, type RubricKey } from "../../shared/rubric.ts";
import type { ChatMessage, Difficulty, PersonaPublic } from "../../shared/types.ts";
import { Card, PageTitle } from "../components/Layout.tsx";
import { ErrorNotice, LoadingBlock, Spinner } from "../components/Feedback.tsx";
import { Icon } from "../components/Icon.tsx";
import { MicButton } from "../components/MicButton.tsx";
import { choiceClass, ui } from "../components/ui.ts";
import { api, ApiError, isAbortError, streamRoleplay } from "../lib/api.ts";
import { formatDuration } from "../lib/format.ts";
import { newId, progressActions } from "../lib/progress.ts";
import { navigate } from "../lib/router.ts";
import { isIOS, useSpeechRecognition, useSpeechSynthesis } from "../lib/speech.ts";
import { useLocalStorageState } from "../lib/useLocalStorage.ts";
import { EvaluationView } from "./EvaluationView.tsx";

type Phase = "setup" | "call" | "evaluating" | "result";
type EndedBy = "tsr" | "customer" | "turn_limit";

const tsrTurns = (msgs: ChatMessage[]) => msgs.filter((m) => m.role === "tsr").length;

function parseMarkers(text: string) {
  const hangUp = text.includes(CALL_MARKERS.hangUp);
  const agreed = text.includes(CALL_MARKERS.agreed);
  const clean = text.split(CALL_MARKERS.hangUp).join("").split(CALL_MARKERS.agreed).join("").trim();
  return { clean, hangUp, agreed };
}

/** ระหว่าง stream ตัด marker ที่ยังพิมพ์ไม่จบ เช่น "[วาง" ออกจากการแสดงผล */
function displayText(text: string): string {
  return parseMarkers(text).clean.replace(/\[[^\]]*$/, "").trimEnd();
}

export function RoleplayPage() {
  const [phase, setPhaseState] = useState<Phase>("setup");
  const phaseRef = useRef<Phase>("setup");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  // ---- setup ----
  const [personas, setPersonas] = useState<PersonaPublic[] | null>(null);
  const [personasError, setPersonasError] = useState<unknown>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [notice, setNotice] = useState<string | null>(null);

  // ---- call ----
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const setMessages = (m: ChatMessage[]) => {
    messagesRef.current = m;
    setMessagesState(m);
  };
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [input, setInput] = useState("");
  const [callError, setCallError] = useState<unknown>(null);
  const [agreed, setAgreed] = useState(false);
  const [hungUp, setHungUp] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // ---- evaluation ----
  const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);
  const [evalError, setEvalError] = useState<unknown>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [endedBy, setEndedBy] = useState<EndedBy>("tsr");

  // ---- voice ----
  const [ttsOn, setTtsOn] = useLocalStorageState("tsr.tts", true);
  const [autoSend, setAutoSend] = useLocalStorageState("tsr.autoSend", true);
  const tts = useSpeechSynthesis();
  const sendRef = useRef<(text: string) => void>(() => undefined);
  const autoSendRef = useRef(autoSend);
  useEffect(() => {
    autoSendRef.current = autoSend;
  }, [autoSend]);
  const onVoiceFinal = useCallback((text: string) => {
    if (text.length > LIMITS.maxTsrMessageChars) {
      // พูดยาวเกินกำหนด: ไม่ส่งอัตโนมัติ แต่คงคำพูดไว้ในช่องพิมพ์ให้ตัดแล้วส่งเอง (คำพูดไม่หาย)
      setInput(text.slice(0, LIMITS.maxTsrMessageChars));
      setCallError(
        new ApiError(
          400,
          "BAD_REQUEST",
          `คำพูดยาวเกิน ${LIMITS.maxTsrMessageChars} ตัวอักษร ระบบตัดให้แล้วในช่องพิมพ์ กรุณาตรวจแล้วกดส่งเอง ครั้งหน้าลองพูดสั้นลงเหมือนคุยโทรศัพท์จริง`,
        ),
      );
      return;
    }
    if (autoSendRef.current) sendRef.current(text);
    else setInput((prev) => `${prev ? `${prev} ` : ""}${text}`.slice(0, LIMITS.maxTsrMessageChars));
  }, []);
  const mic = useSpeechRecognition(onVoiceFinal);

  const persona = personas?.find((p) => p.id === personaId) ?? null;

  const loadPersonas = useCallback(async () => {
    setPersonasError(null);
    try {
      const res = await api.personas();
      setPersonas(res.personas);
    } catch (err) {
      setPersonasError(err);
    }
  }, []);

  useEffect(() => {
    void loadPersonas();
  }, [loadPersonas]);

  useEffect(() => {
    if (phase !== "call") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "call") chatEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, streamingText, phase]);

  const startCall = () => {
    if (!persona) return;
    tts.unlock(); // iOS: ต้องเรียกจากการกดปุ่ม
    setMessages([{ role: "customer", text: persona.greeting }]);
    setAgreed(false);
    setHungUp(false);
    setCallError(null);
    setEvaluation(null);
    setEvalError(null);
    setInput("");
    setNotice(null);
    setStreamingText(null);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase("call");
    if (ttsOn) void tts.speak(persona.greeting, persona.gender);
  };

  const runEvaluation = async (msgs: ChatMessage[], duration: number, by: EndedBy) => {
    if (!persona) return;
    setEvalError(null);
    setEvaluation(null);
    try {
      const result = await api.evaluate({
        personaId: persona.id,
        difficulty,
        messages: msgs,
        durationSec: duration,
        endedBy: by,
      });
      setEvaluation(result);
      setPhase("result");
      progressActions.addCall({
        id: newId(),
        date: new Date().toISOString(),
        personaId: result.persona.id,
        personaName: `${result.persona.name} (${result.persona.title})`,
        difficulty,
        overallScore: result.overallScore,
        scores: Object.fromEntries(result.categories.map((c) => [c.key, c.score])) as Record<RubricKey, number>,
        complianceFlagged: result.compliance.flagged,
        durationSec: duration,
        turns: tsrTurns(msgs),
        outcome: result.outcome,
      });
    } catch (err) {
      setEvalError(err);
    }
  };

  const endCall = async (by: EndedBy) => {
    if (phaseRef.current !== "call") return;
    abortRef.current?.abort();
    tts.cancel();
    mic.cancel();
    const msgs = messagesRef.current;
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
    setDurationSec(duration);
    setEndedBy(by);
    setStreamingText(null);
    if (tsrTurns(msgs) === 0) {
      setPhase("setup");
      setNotice("ยังไม่ได้พูดกับลูกค้าเลย จึงไม่มีบทสนทนาให้ประเมิน ลองเริ่มสายใหม่อีกครั้ง");
      return;
    }
    setPhase("evaluating");
    await runEvaluation(msgs, duration, by);
  };

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || !persona || busyRef.current || phaseRef.current !== "call") return;
    if (text.length > LIMITS.maxTsrMessageChars) {
      // คงข้อความ (ตัดให้พอดี) ไว้ในช่องพิมพ์ เพื่อให้ปุ่ม "ส่งข้อความอีกครั้ง" ใช้ได้และคำพูดไม่หาย
      setInput(text.slice(0, LIMITS.maxTsrMessageChars));
      setCallError(new ApiError(400, "BAD_REQUEST", `ข้อความยาวเกิน ${LIMITS.maxTsrMessageChars} ตัวอักษร ระบบตัดให้แล้ว กรุณาตรวจแล้วกดส่งอีกครั้ง`));
      return;
    }
    const current = messagesRef.current;
    if (tsrTurns(current) >= LIMITS.maxTurnsPerCall) return;

    tts.cancel();
    const next: ChatMessage[] = [...current, { role: "tsr", text }];
    setMessages(next);
    setInput("");
    setCallError(null);
    setStreamingText("");
    busyRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let reply: { clean: string; hangUp: boolean } | null = null;
    try {
      const { text: full } = await streamRoleplay(
        { personaId: persona.id, difficulty, messages: next },
        { onDelta: (t) => setStreamingText(displayText(t)), signal: controller.signal },
      );
      const parsed = parseMarkers(full);
      const customerText = (parsed.clean || (parsed.hangUp ? "(วางสาย)" : "...")).slice(0, LIMITS.maxCustomerMessageChars);
      setMessages([...next, { role: "customer", text: customerText }]);
      if (parsed.agreed) setAgreed(true);
      if (parsed.hangUp) setHungUp(true);
      reply = parsed;
    } catch (err) {
      if (!isAbortError(err) && phaseRef.current === "call") {
        // คืนข้อความให้ส่งใหม่ได้ โดยไม่ทำให้ลำดับบทสนทนาเสีย
        setMessages(current);
        setInput(text);
        setCallError(err);
      }
    } finally {
      setStreamingText(null);
      busyRef.current = false;
      setBusy(false);
      abortRef.current = null;
    }

    if (!reply || phaseRef.current !== "call") return;
    if (reply.hangUp) {
      if (ttsOn && reply.clean) await tts.speak(reply.clean, persona.gender);
      else await new Promise((r) => setTimeout(r, 1500));
      void endCall("customer");
    } else if (ttsOn && reply.clean) {
      void tts.speak(reply.clean, persona.gender);
    }
  };

  useEffect(() => {
    sendRef.current = (text: string) => void sendMessage(text);
  });

  const turns = tsrTurns(messages);
  const turnLimitReached = turns >= LIMITS.maxTurnsPerCall && !busy;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const backToSetup = () => {
    tts.cancel();
    setPhase("setup");
    setEvaluation(null);
    setEvalError(null);
  };

  /* ------------------------------ render ------------------------------ */

  if (phase === "evaluating") {
    return (
      <div className="space-y-4">
        <PageTitle title="กำลังประเมินสาย" subtitle={persona ? `${persona.name} - ${persona.title}` : undefined} />
        {evalError ? (
          <ErrorNotice error={evalError} onRetry={() => void runEvaluation(messagesRef.current, durationSec, endedBy)} retryLabel="ประเมินอีกครั้ง">
            <button type="button" onClick={backToSetup} className={`${ui.link} block text-sm`}>
              ทิ้งสายนี้และกลับไปเลือกลูกค้า
            </button>
          </ErrorNotice>
        ) : (
          <LoadingBlock label="AI โค้ชกำลังให้คะแนนทั้ง 6 ด้าน..." hint="ใช้เวลาประมาณ 10-40 วินาที กรุณาอย่าปิดหน้านี้" />
        )}
      </div>
    );
  }

  if (phase === "result" && evaluation) {
    return (
      <EvaluationView
        result={evaluation}
        messages={messagesRef.current}
        durationSec={durationSec}
        onRetrySame={startCall}
        onPracticeWeakness={(key) => navigate("/drill", { focus: key })}
        onNewCustomer={backToSetup}
      />
    );
  }

  if (phase === "call" && persona) {
    const overTime = elapsed > LIMITS.targetCallSeconds;
    return (
      <div className="flex flex-col gap-3">
        <Card className="sticky top-[4.25rem] z-10 !p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 ring-2 ring-gold-100">
              {persona.name.replace(/^คุณ(ลุง|ป้า)?/, "").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{persona.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {persona.title} · ระดับ{difficultyLabel(difficulty)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void endCall("tsr")}
              className={`${ui.btnDanger} shrink-0 text-sm`}
            >
              <Icon name="hangup" className="h-5 w-5" />
              จบสาย
            </button>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className={`inline-flex items-center gap-1 font-mono ${overTime ? "font-semibold text-danger" : "text-ink"}`}>
              <Icon name="clock" className="h-4 w-4" />
              {formatDuration(elapsed)}
              <span className="font-sans text-xs text-ink-muted">/ เป้า {formatDuration(LIMITS.targetCallSeconds)}</span>
            </span>
            <span className={`text-sm ${turns >= LIMITS.maxTurnsPerCall - 3 ? "font-semibold text-warning-700" : "text-ink"}`}>
              รอบที่ {turns}/{LIMITS.maxTurnsPerCall}
            </span>
          </div>
        </Card>

        <div className="space-y-3" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "tsr" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "tsr" ? "rounded-br-md border border-brand-300 bg-white text-ink" : "rounded-bl-md bg-brand-100 text-ink"
                }`}
              >
                <span className="mb-0.5 block text-[11px] font-semibold text-brand-700">{m.role === "tsr" ? "คุณ (TSR)" : persona.name}</span>
                {m.text}
              </div>
            </div>
          ))}
          {streamingText !== null && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-brand-100 px-4 py-2.5 text-[15px] leading-relaxed text-ink">
                <span className="mb-0.5 block text-[11px] font-semibold text-brand-700">{persona.name}</span>
                {streamingText || (
                  <span className="inline-flex gap-1 py-1" aria-label="ลูกค้ากำลังพูด">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {agreed && !hungUp && (
          <p className={ui.noticeSuccess}>
            ลูกค้าตกลงแล้ว: สรุปความคุ้มครอง ราคา ช่องทางชำระเงิน และสิทธิ์การยกเลิก แล้วกด "จบสาย" เพื่อรับคะแนน
          </p>
        )}
        {hungUp && (
          <p className={`${ui.noticeWarning} flex items-center gap-2`}>
            <Spinner className="h-4 w-4" /> ลูกค้าวางสายแล้ว กำลังพาไปหน้าประเมิน...
          </p>
        )}
        {callError !== null && <ErrorNotice error={callError} onRetry={() => void sendMessage(input)} retryLabel="ส่งข้อความอีกครั้ง" />}
        {turnLimitReached && (
          <div className={ui.noticeWarning}>
            ครบ {LIMITS.maxTurnsPerCall} รอบแล้ว (จำกัดเพื่อควบคุมการใช้ AI)
            <button type="button" onClick={() => void endCall("turn_limit")} className={`${ui.link} ml-2`}>
              จบสายและดูคะแนน
            </button>
          </div>
        )}

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 rounded-card border border-line bg-white p-3 shadow-float md:bottom-4">
          {mic.listening && (
            <p className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-700">
              กำลังฟัง... {mic.interim || "พูดได้เลย แล้วแตะปุ่มอีกครั้งเมื่อพูดจบ"}
            </p>
          )}
          {mic.error && (
            <p className="mb-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-700" role="alert">
              {mic.error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <MicButton
              listening={mic.listening}
              supported={mic.supported}
              disabled={busy || hungUp || turnLimitReached}
              onClick={() => {
                if (!mic.listening) tts.cancel();
                mic.toggle();
              }}
            />
            <div className="min-w-0 flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, LIMITS.maxTsrMessageChars))}
                onKeyDown={onKeyDown}
                rows={2}
                disabled={hungUp || turnLimitReached}
                placeholder={mic.supported ? "แตะไมค์เพื่อพูด หรือพิมพ์ที่นี่..." : "พิมพ์สิ่งที่จะพูดกับลูกค้า..."}
                className={`${ui.input} resize-none`}
                aria-label="ข้อความถึงลูกค้า"
              />
              <p className="mt-1 text-right text-[11px] text-ink-muted">
                {input.length}/{LIMITS.maxTsrMessageChars}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={busy || !input.trim() || hungUp || turnLimitReached}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition hover:bg-brand-900 disabled:bg-brand-100 disabled:text-ink-muted"
              aria-label="ส่งข้อความ"
            >
              {busy ? <Spinner className="h-5 w-5" /> : <Icon name="send" className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" className="accent-brand-700" checked={ttsOn} onChange={(e) => setTtsOn(e.target.checked)} disabled={!tts.supported} />
              เสียงลูกค้า
            </label>
            {mic.supported && (
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" className="accent-brand-700" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
                ส่งอัตโนมัติเมื่อพูดจบ
              </label>
            )}
            {!mic.supported && <span>เบราว์เซอร์นี้ไม่รองรับการพูดผ่านไมค์ ใช้การพิมพ์แทนได้{isIOS() ? " (iOS: ลองใช้ Safari เวอร์ชันล่าสุด)" : ""}</span>}
            {tts.supported && !tts.hasThaiVoice && ttsOn && <span>เครื่องนี้ไม่มีเสียงอ่านภาษาไทย เสียงอาจไม่ชัด</span>}
          </div>
        </div>
      </div>
    );
  }

  // ---- setup ----
  return (
    <div className="space-y-4">
      <PageTitle title="ฝึกโทรขายกับลูกค้าจำลอง" subtitle="เลือกลูกค้าและระดับความยาก แล้วโทรเข้าไปขายจริง พูดผ่านไมค์หรือพิมพ์ก็ได้ จบสายแล้วได้คะแนนทันที" />

      {notice && <p className={ui.noticeWarning}>{notice}</p>}

      <Card>
        <h2 className="mb-3 font-semibold text-ink">1. เลือกลูกค้า</h2>
        {personasError !== null ? (
          <ErrorNotice error={personasError} onRetry={() => void loadPersonas()} />
        ) : !personas ? (
          <LoadingBlock label="กำลังโหลดรายชื่อลูกค้าจำลอง..." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonaId(p.id)}
                aria-pressed={personaId === p.id}
                className={choiceClass(personaId === p.id)}
              >
                <p className="font-semibold text-ink">{p.title}</p>
                <p className="text-sm text-ink-muted">
                  {p.name} · {p.age} ปี · {p.occupation}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{p.summary}</p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">2. เลือกระดับความยาก</h2>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDifficulty(d.key)}
              aria-pressed={difficulty === d.key}
              className={`${choiceClass(difficulty === d.key)} text-center`}
            >
              <p className="font-semibold text-ink">{d.label}</p>
              <p className="mt-1 hidden text-xs text-ink-muted sm:block">{d.description}</p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted sm:hidden">{DIFFICULTIES.find((d) => d.key === difficulty)?.description}</p>
      </Card>

      <section className={ui.cardAccent}>
        <h2 className="mb-2 font-semibold text-brand-900">เกณฑ์ที่จะถูกประเมิน</h2>
        <ul className="grid gap-1 text-sm text-ink sm:grid-cols-2">
          {RUBRIC.map((r) => (
            <li key={r.key}>
              <span className="font-medium">{r.labelTh}</span> <span className="text-brand-700">({r.label})</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-brand-900">
          จำกัด {LIMITS.maxTurnsPerCall} รอบต่อสาย · เป้าหมายเวลาไม่เกิน {formatDuration(LIMITS.targetCallSeconds)} นาที
        </p>
      </section>

      <button type="button" onClick={startCall} disabled={!persona} className={ui.btnHero}>
        <Icon name="phone" className="h-6 w-6" />
        {persona ? `โทรหา${persona.name}` : "เลือกลูกค้าก่อนเริ่มโทร"}
      </button>
    </div>
  );
}
