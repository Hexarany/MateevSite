/**
 * Daily reminder script — run via cron the day before each booking.
 * Sends an email to the client and a Telegram summary to the admin.
 *
 * Cron: 0 10 * * * cd /opt/MateevSite && node scripts/send-reminders.js
 */

const fs   = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ROOT = path.join(__dirname, "..");

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

const RESEND_API_KEY     = process.env.RESEND_API_KEY || "";
const EMAIL_FROM         = process.env.EMAIL_FROM || "";
const EMAIL_REPLY_TO     = process.env.EMAIL_REPLY_TO || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID || "";
const SITE_URL           = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
const FORM_TOKEN_SECRET  = process.env.FORM_TOKEN_SECRET || process.env.ADMIN_SESSION_SECRET || "fallback";

// ── Helpers ────────────────────────────────────────────────────────────────
const crypto = require("node:crypto");

function generateConfirmToken(bookingId) {
  return crypto.createHmac("sha256", FORM_TOKEN_SECRET).update(`confirm:${bookingId}`).digest("hex").slice(0, 32);
}
function post(urlString, body) {
  return new Promise((resolve, reject) => {
    const url     = new URL(urlString);
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function formatDate(dateStr) {
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const d = new Date(`${dateStr}T12:00:00`);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Email template ─────────────────────────────────────────────────────────
function buildReminderHtml(booking, dateLabel) {
  const brandColor = "#b36d2c";
  const bg = "#f7f0e6";
  const ink = "#241c17";
  const muted = "#7d6d60";
  const cancelUrl = `${SITE_URL}/cancel?ref=${encodeURIComponent(booking.reference)}`;
  const confirmUrl = booking.status !== "confirmed"
    ? `${SITE_URL}/confirm?id=${encodeURIComponent(booking.id)}&token=${generateConfirmToken(booking.id)}`
    : null;

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">
        <tr>
          <td style="background:${brandColor};padding:28px 36px;">
            <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Студия массажа в Кишиневе</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Mateev Spa Studio</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 24px;">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${muted};">Напоминание о визите</p>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${ink};">Ждём вас завтра, ${booking.clientName}!</h1>
            <p style="margin:0 0 24px;font-size:14px;color:${muted};line-height:1.6;">Это напоминание о вашей записи в Mateev Spa Studio завтра.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(68,50,36,0.12);border-radius:14px;overflow:hidden;">
              <tr style="background:rgba(179,109,44,0.06);">
                <td style="padding:14px 18px;font-size:12px;color:${muted};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(68,50,36,0.10);" colspan="2">Детали визита</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(68,50,36,0.08);">
                <td style="padding:12px 18px;font-size:13px;color:${muted};width:40%;">Процедура</td>
                <td style="padding:12px 18px;font-size:13px;color:${ink};">${booking.serviceName}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(68,50,36,0.08);">
                <td style="padding:12px 18px;font-size:13px;color:${muted};">Специалист</td>
                <td style="padding:12px 18px;font-size:13px;color:${ink};">${booking.specialistName}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;font-size:13px;color:${muted};">Дата и время</td>
                <td style="padding:12px 18px;font-size:13px;color:${ink};font-weight:600;">${dateLabel}, ${booking.slot}–${booking.endsAt}</td>
              </tr>
            </table>
          </td>
        </tr>
        ${confirmUrl ? `
        <tr>
          <td style="padding:8px 36px 16px;text-align:center;">
            <p style="margin:0 0 14px;font-size:14px;color:${muted};">Подтвердите что будете — один клик:</p>
            <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;background:#2a6b3e;border-radius:12px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;">✓ Подтверждаю — буду</a>
          </td>
        </tr>` : `
        <tr>
          <td style="padding:8px 36px 16px;text-align:center;">
            <p style="margin:0;font-size:14px;color:#2a6b3e;font-weight:600;">✓ Запись подтверждена</p>
          </td>
        </tr>`}
        <tr>
          <td style="padding:0 36px 32px;">
            <p style="margin:0 0 14px;font-size:13px;color:${muted};line-height:1.5;">Если планы изменились — отмените запись заранее.</p>
            <a href="${cancelUrl}" style="display:inline-block;padding:12px 24px;background:transparent;border:1.5px solid rgba(68,50,36,0.25);border-radius:10px;font-size:13px;font-weight:600;color:${ink};text-decoration:none;">Отменить запись</a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);">
            <p style="margin:0;font-size:12px;color:${muted};line-height:1.6;">Ждём вас в студии. До встречи!</p>
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
  const tomorrow = getTomorrow();
  const bookingsPath = path.join(ROOT, "data", "bookings.json");

  if (!fs.existsSync(bookingsPath)) {
    console.log("bookings.json not found, skipping.");
    return;
  }

  const bookings = JSON.parse(fs.readFileSync(bookingsPath, "utf8"));
  const due = bookings.filter(b =>
    b.date === tomorrow &&
    (b.status === "confirmed" || b.status === "new")
  );

  console.log(`[reminders] Tomorrow: ${tomorrow}, bookings due: ${due.length}`);

  if (!due.length) return;

  const dateLabel = formatDate(tomorrow);
  let emailsSent = 0;

  // Send email to each client
  if (RESEND_API_KEY && EMAIL_FROM) {
    for (const booking of due) {
      if (!booking.email) continue;
      try {
        await post("https://api.resend.com/emails", {
          from: EMAIL_FROM,
          to: [booking.email],
          replyTo: EMAIL_REPLY_TO || undefined,
          subject: `Напоминание — ${booking.serviceName} завтра, ${dateLabel}`,
          html: buildReminderHtml(booking, dateLabel),
          text: `Напоминание о визите завтра!\n\nПроцедура: ${booking.serviceName}\nСпециалист: ${booking.specialistName}\nВремя: ${booking.slot}–${booking.endsAt}\n\nОтменить: ${SITE_URL}/cancel?ref=${booking.reference}`
        });
        emailsSent++;
        console.log(`  ✓ Email sent to ${booking.email} (${booking.reference})`);
      } catch (err) {
        console.error(`  ✗ Email failed for ${booking.reference}:`, err.message);
      }
    }
  } else {
    console.log("  Skipping emails: RESEND_API_KEY or EMAIL_FROM not set.");
  }

  // Send Telegram summary to admin
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const lines = due.map(b => `• ${b.slot} — ${b.clientName} (${b.serviceName}, ${b.specialistName}) ${b.phone}`);
    const text = `📅 Завтра ${dateLabel} — ${due.length} визит(а/ов):\n\n${lines.join("\n")}`;
    try {
      await post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text
      });
      console.log("  ✓ Telegram summary sent.");
    } catch (err) {
      console.error("  ✗ Telegram failed:", err.message);
    }
  }

  console.log(`[reminders] Done. Emails: ${emailsSent}/${due.filter(b => b.email).length}`);
}

main().catch(err => {
  console.error("[reminders] Fatal:", err);
  process.exitCode = 1;
});
