#!/usr/bin/env bash
# Deploy TSR Motor Sales Coach ขึ้น Cloudflare Workers แบบไม่ต้อง `wrangler login` (ใช้ API token)
#
# ตัวแปรที่ต้องมี:
#   CLOUDFLARE_API_TOKEN   token แบบ "Edit Cloudflare Workers" จาก https://dash.cloudflare.com/profile/api-tokens
#   CLOUDFLARE_ACCOUNT_ID  Account ID (หน้า Workers & Pages ใน Dashboard ด้านขวา)
# ตัวแปรไม่บังคับ:
#   GEMINI_API_KEY, APP_PASSCODE   ถ้ามีจะตั้งเป็น Worker secret ให้หลัง deploy
#   WORKERS_SUBDOMAIN              workers.dev subdomain ที่ต้องการ (ค่าเริ่มต้น sales-tool)
#
# ใช้: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

: "${CLOUDFLARE_API_TOKEN:?ต้องตั้งค่า CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?ต้องตั้งค่า CLOUDFLARE_ACCOUNT_ID}"
WANTED="${WORKERS_SUBDOMAIN:-sales-tool}"
export WRANGLER_SEND_METRICS=false

API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/subdomain"
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")

read_subdomain() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.result&&j.result.subdomain)||"")}catch{process.stdout.write("")}})'
}

echo "1) ตรวจ workers.dev subdomain ของบัญชี"
current="$(curl -sS "${auth[@]}" "$API" | read_subdomain)"
if [ -z "$current" ]; then
  echo "   ยังไม่มี subdomain -> ขอจดทะเบียน '${WANTED}'"
  resp="$(curl -sS -X PUT "${auth[@]}" -H "Content-Type: application/json" -d "{\"subdomain\":\"${WANTED}\"}" "$API")"
  if ! printf '%s' "$resp" | grep -q '"success":true'; then
    echo "   จดทะเบียนไม่สำเร็จ (ชื่ออาจถูกใช้ไปแล้ว) ลองชื่อสำรอง เช่น:"
    echo "   WORKERS_SUBDOMAIN=tsr-sales-tool ./deploy.sh"
    echo "   รายละเอียดจาก Cloudflare: $resp"
    exit 1
  fi
  current="$WANTED"
elif [ "$current" != "$WANTED" ]; then
  echo "   บัญชีนี้มี subdomain อยู่แล้ว: ${current} (ตั้งได้ครั้งเดียวต่อบัญชี) URL จะเป็น https://coach.${current}.workers.dev"
fi

echo "2) build และ deploy Worker 'coach'"
npm run deploy

if [ -n "${GEMINI_API_KEY:-}" ]; then
  echo "3) ตั้ง secret GEMINI_API_KEY"
  printf '%s' "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY
fi
if [ -n "${APP_PASSCODE:-}" ]; then
  echo "4) ตั้ง secret APP_PASSCODE"
  printf '%s' "$APP_PASSCODE" | npx wrangler secret put APP_PASSCODE
fi

echo
echo "เสร็จแล้ว: https://coach.${current}.workers.dev"
echo "ตรวจสุขภาพ: curl https://coach.${current}.workers.dev/api/health"
