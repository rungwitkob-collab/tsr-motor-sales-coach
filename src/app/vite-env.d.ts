/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "local" (ค่าเริ่มต้น) หรือ "kv" เพื่อซิงก์สถิติไป Cloudflare KV */
  readonly VITE_PROGRESS_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
