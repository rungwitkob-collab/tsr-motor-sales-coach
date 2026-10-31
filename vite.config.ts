import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Vite build ทั้งหน้าเว็บ (React) และ Worker (Hono) ในคำสั่งเดียว
// `npm run dev` จะรัน Worker จริงใน workerd ผ่าน @cloudflare/vite-plugin
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});
