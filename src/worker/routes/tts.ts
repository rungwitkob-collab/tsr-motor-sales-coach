import { Hono } from "hono";
import { ttsRequestSchema } from "../../shared/schemas.ts";
import { ttsModelName, type AppBindings } from "../env.ts";
import { AppError } from "../lib/errors.ts";
import { generateSpeech } from "../lib/gemini.ts";
import { parseBody } from "../lib/validate.ts";

/**
 * เสียงลูกค้าจำลอง/ข้ออ้างจาก Gemini TTS (เสียงไทยเหมือนกันทุกเครื่อง ไม่พึ่งเสียงของเบราว์เซอร์)
 * - ตอบเป็นไฟล์ WAV ให้หน้าเว็บเล่นด้วย Web Audio
 * - ข้อความเดิม (เช่นประโยครับสายของลูกค้าแต่ละคน) เก็บใน Cloudflare Cache 1 วัน เพื่อไม่เรียก Gemini ซ้ำ
 */

/** เสียงสำเร็จรูปของ Gemini แยกตามเพศของลูกค้าจำลอง (เปลี่ยนได้ตามความชอบ) */
const VOICES: Record<"male" | "female", string> = {
  female: "Kore",
  male: "Charon",
};

const CACHE_TTL_SEC = 86_400;

async function cacheKey(model: string, voice: string, text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${model}|${voice}|${text}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const ttsRoute = new Hono<AppBindings>().post("/", async (c) => {
  const model = ttsModelName(c.env);
  if (!model) {
    throw new AppError(501, "NOT_CONFIGURED", "ปิดการใช้เสียงจาก AI อยู่ (GEMINI_TTS_MODEL = off) หน้าเว็บจะใช้เสียงของเบราว์เซอร์แทน");
  }
  const req = await parseBody(c, ttsRequestSchema);
  const voice = VOICES[req.gender];

  // Cache API ใช้ได้เฉพาะ GET จึงสร้าง key เป็น URL ภายใน (ไม่ถูกเรียกจากภายนอก)
  const key = new Request(`https://tts-cache.internal/${await cacheKey(model, voice, req.text)}`);
  let cache: Cache | undefined;
  try {
    cache = caches.default;
    const hit = await cache.match(key);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set("X-Tts-Cache", "hit");
      return res;
    }
  } catch {
    // บางสภาพแวดล้อม (เช่น wrangler dev) ไม่มี Cache API ให้ข้ามไป
  }

  const wav = await generateSpeech(c.env, { model, text: req.text, voice });
  const res = new Response(wav, {
    headers: {
      "Content-Type": "audio/wav",
      // public เพื่อให้ Cache API เก็บได้ (POST จาก browser ไม่ถูก cache ที่ฝั่ง browser อยู่แล้ว)
      "Cache-Control": `public, max-age=${CACHE_TTL_SEC}`,
      "X-Tts-Model": model,
      "X-Tts-Cache": "miss",
    },
  });
  if (cache) {
    try {
      c.executionCtx.waitUntil(cache.put(key, res.clone()));
    } catch {
      // ไม่มี executionCtx (เช่นใน test) ไม่ต้อง cache
    }
  }
  return res;
});
