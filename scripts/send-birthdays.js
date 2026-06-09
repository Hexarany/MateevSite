/**
 * Birthday greeting script — runs daily, sends warm email to clients with birthday today.
 * Cron: 0 9 * * * cd /opt/MateevSite && node scripts/send-birthdays.js >> /var/log/mateev-birthdays.log 2>&1
 */

const fs   = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ROOT     = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

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

// ── HTTP helper ────────────────────────────────────────────────────────────
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

// ── Read JSON ──────────────────────────────────────────────────────────────
async function readJson(file) {
  const raw = await fs.promises.readFile(path.join(DATA_DIR, file), "utf8").catch(() => "[]");
  return JSON.parse(raw);
}

async function writeJson(file, data) {
  await fs.promises.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf8");
}

// ── Get today MM-DD in Chisinau timezone ───────────────────────────────────
function getTodayMD() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Chisinau" }));
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getYear() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Chisinau" })).getFullYear();
}

// ── Build email ────────────────────────────────────────────────────────────
function buildBirthdayHtml(name) {
  const brandColor = "#b36d2c";
  const bg         = "#f7f0e6";
  const ink        = "#241c17";
  const muted      = "#7d6d60";
  const forest     = "#1a2e22";

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">

        <tr>
          <td style="background:${forest};padding:28px 36px;text-align:center;">
            <p style="margin:0;font-size:32px;">🎂</p>
            <p style="margin:10px 0 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">С днём рождения</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Mateev Spa Studio</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 36px 28px;text-align:center;">
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:${ink};">С днём рождения, ${name}!</h1>
            <p style="margin:0 0 20px;font-size:15px;color:${muted};line-height:1.7;">
              Желаем здоровья, лёгкости в теле и хорошего настроения.<br>
              Сегодня особенный день — пусть он будет наполнен теплом.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:${ink};line-height:1.7;">
              Приглашаем вас на сеанс — лучший подарок для тела и ума.
            </p>
            <a href="${SITE_URL}/#booking"
               style="display:inline-block;padding:14px 32px;background:${brandColor};color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">
              Записаться на сеанс →
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 36px 28px;text-align:center;">
            <p style="margin:0;font-size:13px;color:${muted};line-height:1.6;">
              С уважением,<br>
              <strong style="color:${ink};">Денис Матиевич</strong><br>
              Mateev Spa Studio · Кишинёв
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);text-align:center;">
            <p style="margin:0;font-size:11px;color:${muted};">
              <a href="${SITE_URL}" style="color:${muted};">mateevmassage.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.log(`[${new Date().toISOString()}] Skipped: RESEND_API_KEY or EMAIL_FROM not set.`);
    return;
  }

  const todayMD = getTodayMD();
  const year    = getYear();
  console.log(`[${new Date().toISOString()}] Checking birthdays for ${todayMD}...`);

  // Load clients and sent log
  const clients = await readJson("clients.json");
  const sentLog = await readJson("birthday-sent.json").catch(() => ({}));

  const toSend = clients.filter(c => {
    const dob = c.medCard?.dob || "";
    if (!dob || !c.email) return false;
    const md = dob.slice(5); // MM-DD from YYYY-MM-DD
    if (md !== todayMD) return false;
    const key = `${c.id}-${year}`;
    return !sentLog[key]; // не отправляли в этом году
  });

  if (!toSend.length) {
    console.log(`[${new Date().toISOString()}] No birthdays today.`);
    return;
  }

  console.log(`[${new Date().toISOString()}] Found ${toSend.length} birthday(s).`);

  for (const client of toSend) {
    const name = client.clientName || "друг";
    const html = buildBirthdayHtml(name);
    try {
      const res = await post(
        "https://api.resend.com/emails",
        {
          from: EMAIL_FROM,
          to: [client.email],
          replyTo: EMAIL_REPLY_TO || undefined,
          subject: `С днём рождения, ${name}! 🎂`,
          html,
          text: `С днём рождения, ${name}!\n\nЖелаем здоровья и лёгкости в теле. Приглашаем на сеанс: ${SITE_URL}/#booking\n\nС уважением, Денис Матиевич, Mateev Spa Studio`
        },
        { Authorization: `Bearer ${RESEND_API_KEY}` }
      );
      if (res.status >= 200 && res.status < 300) {
        sentLog[`${client.id}-${year}`] = new Date().toISOString();
        console.log(`[${new Date().toISOString()}] Sent to ${client.email} (${name})`);
      } else {
        console.error(`[${new Date().toISOString()}] Failed for ${client.email}: ${res.status} ${res.body}`);
      }
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Error for ${client.email}:`, e.message);
    }
  }

  await writeJson("birthday-sent.json", sentLog);
  console.log(`[${new Date().toISOString()}] Done.`);
}

main().catch(e => {
  console.error(`[${new Date().toISOString()}] Fatal:`, e);
  process.exitCode = 1;
});
