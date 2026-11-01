/** หน้า "ตั้งค่า": เสียงลูกค้า, รุ่น AI ประเมินการทดสอบ, ชื่อผู้ฝึก, ย้ายข้อมูล, ออกจากระบบ (ค่าทั้งหมดเก็บต่อเครื่องใน localStorage) */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  DEFAULT_VOICE_PREFERENCE,
  EVAL_MODEL_CHOICES,
  MODEL_STORAGE_KEY,
  TTS_MODEL_STORAGE_KEY,
  VOICE_CHOICES,
  VOICE_STORAGE_KEY,
  type VoicePreference,
} from "../../shared/models.ts";
import { Icon } from "../components/Icon.tsx";
import { Card, PageTitle } from "../components/Layout.tsx";
import { choiceClass, ui } from "../components/ui.ts";
import { clearPasscode, getTraineeName, setTraineeName } from "../lib/passcode.ts";
import { progressActions, useProgress } from "../lib/progress.ts";
import { thaiVoiceHint, useSpeechSynthesis } from "../lib/speech.ts";
import { localDateKey } from "../lib/stats.ts";
import { parseProgress } from "../lib/storage.ts";
import { useLocalStorageState } from "../lib/useLocalStorage.ts";

const SAMPLE_SENTENCE = "สวัสดีค่ะ ดิฉันคือลูกค้าจำลอง ตอนนี้กำลังทดสอบเสียงอยู่ค่ะ";

export function SettingsPage() {
  const progress = useProgress();
  const tts = useSpeechSynthesis();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [name, setName] = useState(progress.traineeName || getTraineeName());
  const [voice, setVoice] = useLocalStorageState<string>(VOICE_STORAGE_KEY, DEFAULT_VOICE_PREFERENCE);
  const [, setTtsModel] = useLocalStorageState(TTS_MODEL_STORAGE_KEY, "");
  const [model, setModel] = useLocalStorageState(MODEL_STORAGE_KEY, "");

  const currentVoice: VoicePreference = voice === "browser" ? "browser" : "ai";
  const defaultModel = EVAL_MODEL_CHOICES[0]!.id;
  const currentModel = EVAL_MODEL_CHOICES.some((m) => m.id === model) ? model : defaultModel;

  // ค่าที่เคยเลือกจากหน้าเดิม (เช่นรุ่นที่ไม่อยู่ใน 2 ตัวเลือกนี้) ให้ปรับเป็นค่าที่หน้านี้แสดง เพื่อให้สิ่งที่เห็นตรงกับที่ส่งไป Worker
  useEffect(() => {
    if (model !== currentModel) setModel(currentModel);
  }, [model, currentModel, setModel]);

  const chooseVoice = (id: VoicePreference) => {
    setVoice(id);
    const choice = VOICE_CHOICES.find((c) => c.id === id);
    if (choice?.ttsModel) setTtsModel(choice.ttsModel);
    setMessage({ kind: "ok", text: "บันทึกการตั้งค่าเสียงลูกค้าแล้ว มีผลกับสายถัดไปทันที" });
  };

  const chooseModel = (id: string) => {
    setModel(id);
    setMessage({ kind: "ok", text: "บันทึกรุ่น AI แล้ว มีผลกับการประเมินและบทสนทนาถัดไปทันที (ไม่ต้อง deploy)" });
  };

  const testVoice = () => {
    tts.unlock();
    void tts.speak(SAMPLE_SENTENCE, "female");
  };

  const exportJson = () => {
    const data = { ...progress, traineeName: name.trim() || progress.traineeName };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const who = (data.traineeName || "tsr").replace(/[^\p{L}\p{N}_-]+/gu, "-");
    a.href = url;
    a.download = `tsr-progress-${who}-${localDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ kind: "ok", text: "ดาวน์โหลดไฟล์แล้ว ส่งไฟล์นี้ให้หัวหน้าทีมหรือนำไป import ที่เครื่องอื่นได้" });
  };

  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ kind: "error", text: "ไฟล์ใหญ่เกิน 2 MB" });
      return;
    }
    try {
      const parsed = parseProgress(JSON.parse(await file.text()));
      if (!parsed) {
        setMessage({ kind: "error", text: "ไฟล์ไม่ใช่ข้อมูลสถิติของ TSR Motor Sales Coach หรือรูปแบบไม่ถูกต้อง" });
        return;
      }
      const ok = window.confirm(
        `แทนที่ข้อมูลในเครื่องนี้ (${progress.calls.length} สาย) ด้วยข้อมูลจากไฟล์ (${parsed.calls.length} สาย, ${parsed.drills.length} ข้ออ้าง, ${parsed.quizzes.length} ควิซ)?`,
      );
      if (!ok) return;
      progressActions.replaceAll(parsed);
      if (parsed.traineeName) setName(parsed.traineeName);
      setMessage({ kind: "ok", text: "นำเข้าข้อมูลเรียบร้อย" });
    } catch {
      setMessage({ kind: "error", text: "อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์ .json ที่ export จากแอปนี้" });
    }
  };

  const resetAll = () => {
    if (window.confirm("ลบสถิติการฝึกทั้งหมดในเครื่องนี้? (แนะนำให้ export เก็บไว้ก่อน)")) {
      progressActions.reset();
      setMessage({ kind: "ok", text: "ล้างข้อมูลแล้ว" });
    }
  };

  const saveName = () => {
    setTraineeName(name);
    progressActions.setTraineeName(name);
    setMessage({ kind: "ok", text: "บันทึกชื่อแล้ว" });
  };

  const logout = () => {
    if (window.confirm("ออกจากระบบ? (สถิติในเครื่องยังอยู่ครบ)")) {
      clearPasscode();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle title="ตั้งค่า" subtitle="ค่าทั้งหมดจำไว้ในเบราว์เซอร์ของเครื่องนี้ และมีผลทันทีโดยไม่ต้อง deploy ใหม่" />

      {message && <p className={message.kind === "ok" ? ui.noticeSuccess : ui.noticeDanger}>{message.text}</p>}

      <Card>
        <h2 className="font-semibold text-brand-900">เสียงลูกค้า</h2>
        <p className="mt-1 text-sm text-ink-muted">เสียงที่ลูกค้าจำลองใช้พูดตอบในหน้าฝึกโทร และเสียงอ่านข้ออ้างในหน้าฝึกตอบข้ออ้าง</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="เสียงลูกค้า">
          {VOICE_CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={currentVoice === c.id}
              onClick={() => chooseVoice(c.id)}
              className={choiceClass(currentVoice === c.id)}
            >
              <p className="font-semibold text-ink">{c.label}</p>
              <p className="mt-1 text-sm text-ink-muted">{c.description}</p>
            </button>
          ))}
        </div>
        {currentVoice === "browser" && tts.voicesLoaded && !tts.hasThaiVoice && (
          <p className={`${ui.noticeWarning} mt-3`}>เครื่องนี้ยังไม่มีเสียงอ่านภาษาไทย ลูกค้าจะเงียบหรือออกเสียงไม่ชัด {thaiVoiceHint()}</p>
        )}
        {tts.error && <p className={`${ui.noticeWarning} mt-3`}>{tts.error}</p>}
        {tts.notice && <p className={`${ui.noticeWarning} mt-3`}>{tts.notice}</p>}
        <button type="button" onClick={testVoice} disabled={!tts.supported || tts.speaking} className={`${ui.btnSecondary} mt-3`}>
          <Icon name="speaker" className="h-5 w-5" />
          {tts.speaking ? "กำลังพูด..." : "ทดสอบเสียงลูกค้า"}
        </button>
      </Card>

      <Card>
        <h2 className="font-semibold text-brand-900">ประเมินการทดสอบ</h2>
        <p className="mt-1 text-sm text-ink-muted">รุ่น AI ที่ใช้ให้คะแนนสาย เล่นบทลูกค้าจำลอง ให้คะแนนข้ออ้าง เขียนบทพูด และออกข้อสอบ</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="รุ่น AI ประเมินการทดสอบ">
          {EVAL_MODEL_CHOICES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={currentModel === m.id}
              onClick={() => chooseModel(m.id)}
              className={choiceClass(currentModel === m.id)}
            >
              <p className="font-semibold text-ink">{m.label}</p>
              <p className="mt-1 text-sm text-ink-muted">{m.description}</p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">ถ้ารุ่นที่เลือกแจ้งว่าโควตาเต็ม ให้สลับไปอีกรุ่นชั่วคราว โควตาแยกกันต่อรุ่น</p>
      </Card>

      <Card>
        <h2 className="font-semibold text-brand-900">ผู้ฝึก</h2>
        <label className="mt-3 block space-y-1.5">
          <span className={ui.label}>ชื่อเล่น / รหัสพนักงาน</span>
          <div className="flex gap-2">
            <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
            <button type="button" onClick={saveName} className={`${ui.btnSecondary} shrink-0`}>
              บันทึก
            </button>
          </div>
        </label>
      </Card>

      <Card>
        <h2 className="font-semibold text-brand-900">ย้ายเครื่อง / ส่งให้หัวหน้าทีม</h2>
        <p className="mt-1 text-sm text-ink-muted">Export สถิติเป็นไฟล์ JSON แล้วนำไป Import ที่เครื่องอื่น หรือส่งให้หัวหน้าทีมดูผลการฝึก</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={exportJson} className={ui.btnPrimary}>
            Export JSON
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={ui.btnSecondary}>
            Import JSON
          </button>
          <button type="button" onClick={resetAll} className={`${ui.btnSecondary} text-danger-700`}>
            ล้างข้อมูล
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importJson(e)} />
      </Card>

      <button type="button" onClick={logout} className={`${ui.link} text-sm`}>
        ออกจากระบบ (ล้างรหัสผ่านทีมในเครื่องนี้)
      </button>
    </div>
  );
}
