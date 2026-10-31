/** โมดูล 4: Script Library & Pitch Builder */
import { useState, type FormEvent } from "react";
import { findPlan, products, scriptsData } from "../../shared/content.ts";
import { LIMITS } from "../../shared/limits.ts";
import type { PitchResult } from "../../shared/schemas.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { ErrorNotice, LoadingBlock } from "../components/Feedback.tsx";
import { Card, PageTitle } from "../components/Layout.tsx";
import { ui } from "../components/ui.ts";
import { api } from "../lib/api.ts";
import { fillTemplate, scriptVariables } from "../lib/format.ts";
import { getTraineeName } from "../lib/passcode.ts";
import { useLocalStorageState } from "../lib/useLocalStorage.ts";

type Tab = "library" | "pitch";

export function ScriptsPage() {
  const [tab, setTab] = useState<Tab>("library");
  return (
    <div className="space-y-4">
      <PageTitle title="สคริปต์และ Pitch Builder" subtitle="โครงสคริปต์มาตรฐานพร้อมคัดลอก และให้ AI ช่วยเขียนบทพูด 30 วินาทีสำหรับลูกค้าแต่ละคน" />
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-white p-1" role="tablist">
        {(
          [
            ["library", "คลังสคริปต์"],
            ["pitch", "Pitch Builder"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              tab === key ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "library" ? <ScriptLibrary /> : <PitchBuilder />}
    </div>
  );
}

function ScriptLibrary() {
  const [agentName, setAgentName] = useLocalStorageState("tsr.agentName", getTraineeName());
  const [customerName, setCustomerName] = useState("");
  const vars = scriptVariables(agentName, customerName);
  const allText = scriptsData.sections
    .map((s) => `${s.title}\n${s.scripts.map((v) => `- ${v.label}: ${fillTemplate(v.text, vars)}`).join("\n")}`)
    .join("\n\n");

  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-3 text-sm text-ink-muted">กรอกชื่อเพื่อแทนค่าในสคริปต์อัตโนมัติ ข้อความในวงเล็บเหลี่ยม [ ] คือส่วนที่ต้องปรับตามลูกค้าจริง</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={ui.label}>ชื่อของคุณ</span>
            <input className={ui.input} value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={60} placeholder="เช่น สมหญิง" />
          </label>
          <label className="block space-y-1.5">
            <span className={ui.label}>ชื่อลูกค้า</span>
            <input className={ui.input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={60} placeholder="เช่น สมชาย" />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <CopyButton text={allText} label="คัดลอกทั้งชุด" />
        </div>
      </Card>

      {scriptsData.sections.map((section) => (
        <Card key={section.id}>
          <h2 className="font-semibold text-brand-900">{section.title}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{section.goal}</p>
          <div className="mt-3 space-y-2">
            {section.scripts.map((variant) => {
              const text = fillTemplate(variant.text, vars);
              return (
                <div key={variant.label} className="rounded-xl border border-line bg-brand-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-semibold text-gold-700">{variant.label}</span>
                    <CopyButton text={text} />
                  </div>
                  <p className="mt-2 leading-relaxed text-ink">{text}</p>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

const CURRENT_YEAR = new Date().getFullYear();

interface PitchForm {
  brand: string;
  model: string;
  year: string;
  usage: string;
  name: string;
  ageRange: string;
  occupation: string;
  currentInsurance: string;
  budget: string;
  concerns: string;
  planId: string;
}

const EMPTY_FORM: PitchForm = {
  brand: "",
  model: "",
  year: String(CURRENT_YEAR - 3),
  usage: "",
  name: "",
  ageRange: "",
  occupation: "",
  currentInsurance: "",
  budget: "",
  concerns: "",
  planId: "",
};

const FIELDS: { key: keyof PitchForm; label: string; placeholder: string; group: "car" | "customer" }[] = [
  { key: "brand", label: "ยี่ห้อรถ *", placeholder: "เช่น Toyota", group: "car" },
  { key: "model", label: "รุ่น", placeholder: "เช่น Yaris Ativ", group: "car" },
  { key: "usage", label: "การใช้รถ", placeholder: "เช่น ขับไปทำงานทุกวัน 40 กม.", group: "car" },
  { key: "name", label: "ชื่อลูกค้า", placeholder: "เช่น คุณสมชาย", group: "customer" },
  { key: "ageRange", label: "ช่วงอายุ", placeholder: "เช่น 30-40 ปี", group: "customer" },
  { key: "occupation", label: "อาชีพ", placeholder: "เช่น พนักงานบริษัท", group: "customer" },
  { key: "currentInsurance", label: "ประกันปัจจุบัน", placeholder: "เช่น ชั้น 2+ หมดอายุเดือนหน้า", group: "customer" },
  { key: "budget", label: "งบประมาณ", placeholder: "เช่น ไม่เกิน 8,000 บาท", group: "customer" },
  { key: "concerns", label: "ความกังวล / สิ่งที่ให้ความสำคัญ", placeholder: "เช่น กลัวรถหาย จอดริมถนน", group: "customer" },
];

function PitchBuilder() {
  const [form, setForm] = useState<PitchForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<PitchResult | null>(null);

  const set = (key: keyof PitchForm, value: string) => setForm((f) => ({ ...f, [key]: value.slice(0, LIMITS.maxPitchFieldChars) }));

  const generate = async (e?: FormEvent) => {
    e?.preventDefault();
    const year = Number(form.year);
    if (!form.brand.trim()) return setFormError("กรุณาระบุยี่ห้อรถ");
    if (!Number.isInteger(year) || year < 1980 || year > CURRENT_YEAR + 1) return setFormError(`ปีรถต้องอยู่ระหว่าง 1980 - ${CURRENT_YEAR + 1}`);
    setFormError(null);
    setError(null);
    setLoading(true);
    try {
      const res = await api.pitch({
        car: { brand: form.brand, model: form.model, year, usage: form.usage },
        customer: {
          name: form.name,
          ageRange: form.ageRange,
          occupation: form.occupation,
          currentInsurance: form.currentInsurance,
          budget: form.budget,
          concerns: form.concerns,
        },
        planId: form.planId || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const plan = result ? findPlan(result.recommendedPlanId) : undefined;
  const blocks: [string, string][] = result
    ? [
        ["บทพูด 30 วินาที", result.pitch30s],
        ["เวอร์ชันสั้น (15 วินาที)", result.shortVersion],
        ["เวอร์ชันยาว (60 วินาที)", result.longVersion],
        ["คำถามที่ควรถามเพิ่ม", result.discoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")],
      ]
    : [];

  return (
    <div className="space-y-3">
      <form onSubmit={generate}>
        <Card>
          <h2 className="mb-3 font-semibold text-brand-900">ข้อมูลรถ</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === "car").map((f) => (
              <label key={f.key} className="block space-y-1.5">
                <span className={ui.label}>{f.label}</span>
                <input className={ui.input} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
              </label>
            ))}
            <label className="block space-y-1.5">
              <span className={ui.label}>ปีรถ *</span>
              <input
                className={ui.input}
                type="number"
                inputMode="numeric"
                min={1980}
                max={CURRENT_YEAR + 1}
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
              />
            </label>
          </div>

          <h2 className="mt-5 mb-3 font-semibold text-brand-900">โปรไฟล์ลูกค้า</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === "customer").map((f) => (
              <label key={f.key} className={`block space-y-1.5 ${f.key === "concerns" ? "sm:col-span-2" : ""}`}>
                <span className={ui.label}>{f.label}</span>
                <input className={ui.input} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
              </label>
            ))}
            <label className="block space-y-1.5 sm:col-span-2">
              <span className={ui.label}>แผนที่ต้องการเสนอ</span>
              <select className={ui.input} value={form.planId} onChange={(e) => set("planId", e.target.value)}>
                <option value="">ให้ AI แนะนำแผนที่เหมาะที่สุด</option>
                {products.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {formError && <p className={`${ui.noticeDanger} mt-3`}>{formError}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <button type="submit" disabled={loading} className={ui.btnPrimary}>
              {loading ? "กำลังเขียนบทพูด..." : result ? "สร้างบทพูดใหม่" : "สร้างบทพูด"}
            </button>
            <button type="button" onClick={() => { setForm(EMPTY_FORM); setResult(null); setError(null); }} className={ui.btnSecondary}>
              ล้างฟอร์ม
            </button>
          </div>
        </Card>
      </form>

      {loading && <LoadingBlock label="AI กำลังเขียนบทพูดสำหรับลูกค้าคนนี้..." hint="ประมาณ 5-20 วินาที" />}
      {error !== null && !loading && <ErrorNotice error={error} onRetry={() => void generate()} />}

      {result && !loading && (
        <div className="space-y-3">
          <section className={ui.cardAccent}>
            <p className="text-sm font-semibold text-brand-700">แผนที่แนะนำ</p>
            <p className="mt-1 text-lg font-bold text-brand-900">{plan?.name ?? result.recommendedPlanId}</p>
            <p className="mt-1 text-ink">{result.reason}</p>
          </section>
          {blocks.map(([title, text]) => (
            <Card key={title}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-brand-900">{title}</h3>
                <CopyButton text={text} />
              </div>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-ink">{text}</p>
            </Card>
          ))}
          <div className="flex justify-end">
            <CopyButton text={blocks.map(([t, x]) => `${t}\n${x}`).join("\n\n")} label="คัดลอกทั้งหมด" />
          </div>
        </div>
      )}
    </div>
  );
}
