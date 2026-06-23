/**
 * Win-back script — возвращает «потерянных» клиентов.
 * Письмо «скучаем по вам + скидка» тем, кто не был 60–180 дней.
 * Запускать раз в неделю.
 * Cron: 0 12 * * 1 cd /opt/MateevSite && node scripts/send-winback.js >> /var/log/mateev-winback.log 2>&1
 */

const fs   = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ROOT     = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

// ── Параметры окна ──────────────────────────────────────────────────────────
const GAP_MIN_DAYS     = 60;   // не трогаем тех, кто был недавно
const GAP_MAX_DAYS     = 180;  // и тех, кто ушёл слишком давно (не спамим спустя полгода+)
const RESEND_AFTER_DAYS = 180; // одному человеку не чаще раза в полгода
const PROMO_CODE       = "СНОВА15"; // -15% на следующий визит (применяет администратор)

// ── Load .env ──────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}
loadEnv();

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM     = process.env.EMAIL_FROM || "";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";
const SITE_URL       = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");

function post(urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url     = new URL(urlString);
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers }
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function readJson(file) {
  const raw = await fs.promises.readFile(path.join(DATA_DIR, file), "utf8").catch(() => "[]");
  return JSON.parse(raw);
}
async function writeJson(file, data) {
  await fs.promises.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf8");
}

function todayChisinau() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Chisinau" }));
}
function daysBetween(dateStr, now) {
  return Math.floor((now - new Date(dateStr + "T12:00:00")) / 86400000);
}
function phoneTail(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-8);
}

function buildWinbackHtml(name) {
  const brandColor = "#b36d2c";
  const bg = "#f7f0e6", ink = "#241c17", muted = "#7d6d60", forest = "#1a2e22";
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">
        <tr>
          <td style="background:${forest};padding:28px 36px;text-align:center;">
            <p style="margin:0;font-size:32px;">🌿</p>
            <p style="margin:10px 0 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Мы скучаем по вам</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Mateev Spa Studio</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 24px;text-align:center;">
            <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${ink};">${name}, давно вас не было!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:${muted};line-height:1.7;">
              Тело быстро накапливает напряжение, если давно не было разгрузки.
              Возвращайтесь — и мы вернём лёгкость.
            </p>
            <div style="margin:0 0 24px;padding:18px;background:rgba(179,109,44,0.08);border:1px dashed ${brandColor};border-radius:14px;">
              <p style="margin:0 0 4px;font-size:13px;color:${muted};">Ваш подарок на возвращение</p>
              <p style="margin:0;font-size:26px;font-weight:800;color:${brandColor};letter-spacing:0.04em;">−15%</p>
              <p style="margin:6px 0 0;font-size:13px;color:${ink};">код <strong>${PROMO_CODE}</strong> — назовите при записи</p>
            </div>
            <a href="${SITE_URL}/#booking"
               style="display:inline-block;padding:14px 32px;background:${brandColor};color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;">
              Записаться со скидкой →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 36px 28px;text-align:center;">
            <p style="margin:0;font-size:13px;color:${muted};line-height:1.6;">
              С теплом,<br><strong style="color:${ink};">Денис Матиевич</strong><br>Mateev Spa Studio · Кишинёв
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);text-align:center;">
            <p style="margin:0;font-size:11px;color:${muted};"><a href="${SITE_URL}" style="color:${muted};">mateevmassage.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function main() {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.log(`[${new Date().toISOString()}] Skipped: RESEND_API_KEY or EMAIL_FROM not set.`);
    return;
  }

  const now = todayChisinau();
  const bookings = await readJson("bookings.json");
  const sentLog = await readJson("winback-sent.json").catch(() => ({}));

  // Агрегируем по клиенту (телефон): email, имя, дата последнего визита
  const byClient = new Map();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const tail = phoneTail(b.phone);
    if (!tail) continue;
    const ex = byClient.get(tail) || { tail, email: "", name: "", lastVisit: "" };
    if (!ex.email && b.email) ex.email = b.email;
    if ((b.clientName || "").length > ex.name.length) ex.name = b.clientName;
    if (b.date > ex.lastVisit) ex.lastVisit = b.date;
    byClient.set(tail, ex);
  }

  const due = [...byClient.values()].filter(c => {
    if (!c.email || !c.lastVisit) return false;
    const gap = daysBetween(c.lastVisit, now);
    if (gap < GAP_MIN_DAYS || gap > GAP_MAX_DAYS) return false;
    const sentAt = sentLog[c.tail];
    if (sentAt && daysBetween(sentAt.slice(0, 10), now) < RESEND_AFTER_DAYS) return false;
    return true;
  });

  console.log(`[${new Date().toISOString()}] Win-back: ${due.length} клиент(ов) для возврата.`);
  if (!due.length) return;

  let sent = 0;
  for (const c of due) {
    const name = (c.name || "").split(" ")[0] || "друг";
    try {
      const res = await post(
        "https://api.resend.com/emails",
        {
          from: EMAIL_FROM,
          to: [c.email],
          replyTo: EMAIL_REPLY_TO || undefined,
          subject: `${name}, возвращайтесь — дарим −15% 🌿`,
          html: buildWinbackHtml(name),
          text: `${name}, давно вас не было в Mateev Spa Studio!\n\nВозвращайтесь — дарим −15% на следующий визит. Код: ${PROMO_CODE} (назовите при записи).\n\nЗаписаться: ${SITE_URL}/#booking\n\nС теплом, Денис Матиевич`
        },
        { Authorization: `Bearer ${RESEND_API_KEY}` }
      );
      if (res.status >= 200 && res.status < 300) {
        sentLog[c.tail] = new Date().toISOString();
        sent++;
        console.log(`  ✓ ${c.email} (${name}, не был ${daysBetween(c.lastVisit, now)} дн.)`);
      } else {
        console.error(`  ✗ ${c.email}: ${res.status} ${res.body.slice(0, 150)}`);
      }
    } catch (e) {
      console.error(`  ✗ ${c.email}:`, e.message);
    }
  }

  await writeJson("winback-sent.json", sentLog);
  console.log(`[${new Date().toISOString()}] Done. Отправлено: ${sent}/${due.length}`);
}

main().catch(e => {
  console.error(`[${new Date().toISOString()}] Fatal:`, e);
  process.exitCode = 1;
});
