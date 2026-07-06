/**
 * Weekly AI digest — раз в неделю шлёт владельцу в Telegram AI-сводку по бизнесу.
 * Переиспользует серверный эндпоинт /api/admin/ai-assistant (контекст + Claude).
 * Cron (понедельник 09:00): 0 9 * * 1 cd /opt/MateevSite && node scripts/send-weekly-digest.js
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ROOT = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnv();

const ADMIN_PIN = process.env.ADMIN_PIN || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const SITE_URL = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");

function post(urlString, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
      timeout: 90000
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(text);
        else reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!ADMIN_PIN || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[weekly-digest] Skipped: нужны ADMIN_PIN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.");
    return;
  }

  const prompt = "Составь короткий еженедельный дайджест для владельца массажной студии по данным бизнеса: "
    + "1) итоги за последние ~30 дней (сколько завершено визитов, выручка); "
    + "2) 3–5 клиентов, которых давно не было — кого стоит вернуть, с телефонами; "
    + "3) одна конкретная идея поста или акции на эту неделю. "
    + "Пиши кратко, по делу, дружелюбно, с эмодзи. Заверши короткой мотивирующей строкой.";

  let reply;
  try {
    const res = await post(`${SITE_URL}/api/admin/ai-assistant`, { "x-admin-pin": ADMIN_PIN }, { message: prompt });
    reply = JSON.parse(res).reply;
  } catch (err) {
    console.error("[weekly-digest] AI failed:", err.message);
    return;
  }
  if (!reply) { console.log("[weekly-digest] Пустой ответ AI (проверьте ANTHROPIC_API_KEY)."); return; }

  try {
    await post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {}, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `📊 Еженедельный дайджест\n\n${reply}`
    });
    console.log("[weekly-digest] Sent.");
  } catch (err) {
    console.error("[weekly-digest] Telegram failed:", err.message);
  }
}

main().catch(err => {
  console.error("[weekly-digest] Fatal:", err);
  process.exitCode = 1;
});
