/**
 * Review request script — sends email the day after a completed/confirmed visit.
 * Cron: 0 11 * * * cd /opt/MateevSite && node scripts/send-review-requests.js
 */

const fs   = require("node:fs");
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

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM     = process.env.EMAIL_FROM || "";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";
const SITE_URL       = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");

// Google review URL — update after getting it from Google Maps
const GOOGLE_REVIEW_URL = "https://g.page/r/Cbye495fXWm7EBM/review";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const { normalizePhoneDigits } = require("../lib/client");

// phone(последние 8) → chatId клиентов с привязанным Telegram
function loadTelegramLinks() {
  const p = path.join(ROOT, "data", "portal-tokens.json");
  if (!fs.existsSync(p)) return new Map();
  let tokens = [];
  try { tokens = JSON.parse(fs.readFileSync(p, "utf8")); } catch { return new Map(); }
  const map = new Map();
  for (const t of tokens) {
    if (t.telegramChatId && t.phone) {
      const tail = normalizePhoneDigits(t.phone).slice(-8);
      if (tail) map.set(tail, t.telegramChatId);
    }
  }
  return map;
}

function post(urlString, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers }
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
    req.write(payload);
    req.end();
  });
}

function getYesterday() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Chisinau" }));
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function buildReviewEmail(booking) {
  const brandColor = "#b36d2c";
  const green = "#1a2e22";
  const bg = "#f7f0e6";
  const ink = "#241c17";
  const muted = "#7d6d60";
  const bookAgainUrl = `${SITE_URL}/#booking`;

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">

        <tr>
          <td style="background:${green};padding:28px 36px;">
            <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.5);">Mateev Spa Studio · Кишинёв</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#fff;">Денис Матиевич</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 36px 8px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${ink};line-height:1.3;">
              ${booking.clientName}, вчера был ваш<br>${booking.serviceName}
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:${ink};line-height:1.75;">
              Надеюсь, всё прошло хорошо и вы чувствуете разницу. Если сеанс был полезен — у меня к вам одна небольшая просьба.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:${muted};line-height:1.75;">
              Напишите пару слов об ощущениях в Google — это поможет другим людям найти студию и решиться на первый визит. Занимает меньше минуты.
            </p>
            <a href="${GOOGLE_REVIEW_URL}"
               style="display:inline-block;padding:16px 32px;background:${brandColor};color:#fff;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">
              ⭐ Оставить отзыв в Google
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 36px 28px;border-top:1px solid rgba(68,50,36,0.08);margin-top:24px;">
            <p style="margin:0 0 6px;font-size:13px;color:${muted};line-height:1.6;">
              Если что-то в сеансе можно было сделать лучше — ответьте на это письмо напрямую. Мне важно это знать.
            </p>
            <p style="margin:12px 0 0;font-size:13px;color:${muted};">
              До встречи,<br>
              <strong style="color:${ink};">Денис</strong>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 36px;border-top:1px solid rgba(68,50,36,0.08);background:rgba(179,109,44,0.04);">
            <a href="${bookAgainUrl}" style="font-size:13px;color:${brandColor};font-weight:700;text-decoration:none;">
              Записаться снова →
            </a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function main() {
  const emailReady = Boolean(RESEND_API_KEY && EMAIL_FROM);
  if (!emailReady && !TELEGRAM_BOT_TOKEN) {
    console.log("[review-requests] Skipped: ни email, ни Telegram не настроены.");
    return;
  }
  const links = loadTelegramLinks();

  const yesterday = getYesterday();
  const bookingsPath = path.join(ROOT, "data", "bookings.json");

  if (!fs.existsSync(bookingsPath)) {
    console.log("[review-requests] bookings.json not found.");
    return;
  }

  const bookings = JSON.parse(fs.readFileSync(bookingsPath, "utf8"));

  // Phones that already received a review request — don't ask again
  const alreadyAsked = new Set(
    bookings
      .filter(b => b.reviewRequestedAt && b.phone)
      .map(b => b.phone.replace(/\D/g, "").slice(-8))
  );

  // Включаем запись, если:
  // (A) дата визита — вчера И статус confirmed/completed, ИЛИ
  // (B) запись была помечена "completed" вчера (admin поставил статус позже дня визита)
  const due = bookings.filter(b => {
    if (b.reviewRequestedAt) return false;
    if (alreadyAsked.has((b.phone || "").replace(/\D/g, "").slice(-8))) return false;
    const tail = normalizePhoneDigits(b.phone || "").slice(-8);
    const hasChannel = (b.email && emailReady) || (tail && links.get(tail));
    if (!hasChannel) return false;
    const visitWasYesterday = b.date === yesterday && (b.status === "confirmed" || b.status === "completed");
    const completedYesterday = b.status === "completed" && b.updatedAt && b.updatedAt.startsWith(yesterday);
    return visitWasYesterday || completedYesterday;
  });

  console.log(`[review-requests] Yesterday: ${yesterday}, eligible: ${due.length}`);

  let sent = 0;
  for (const booking of due) {
    let ok = false;
    if (booking.email && emailReady) {
      try {
        await post("https://api.resend.com/emails",
          { Authorization: `Bearer ${RESEND_API_KEY}` },
          {
            from: EMAIL_FROM,
            to: [booking.email],
            replyTo: EMAIL_REPLY_TO || undefined,
            subject: `${booking.clientName}, как прошёл ваш ${booking.serviceName}?`,
            html: buildReviewEmail(booking),
            text: `Здравствуйте, ${booking.clientName}!\n\nВы посетили нас вчера — ${booking.serviceName} с ${booking.specialistName}.\n\nЕсли вам понравилось, пожалуйста оставьте отзыв на Google:\n${GOOGLE_REVIEW_URL}\n\nЗаписаться снова: ${SITE_URL}/#booking`
          }
        );
        ok = true;
        console.log(`  ✓ Email review request → ${booking.email} (${booking.reference})`);
      } catch (err) {
        console.error(`  ✗ Email failed ${booking.reference}:`, err.message);
      }
    }
    const tail = normalizePhoneDigits(booking.phone || "").slice(-8);
    const chatId = tail && links.get(tail);
    if (chatId && TELEGRAM_BOT_TOKEN) {
      try {
        await post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {}, {
          chat_id: chatId,
          text: `Здравствуйте, ${booking.clientName}! 🌿\n\nВчера вы были у нас — ${booking.serviceName}. Как всё прошло?\n\nБудем очень благодарны за короткий отзыв — это помогает нам и другим гостям 🙏`,
          reply_markup: { inline_keyboard: [[{ text: "⭐ Оставить отзыв", url: GOOGLE_REVIEW_URL }]] }
        });
        ok = true;
        console.log(`  ✓ Telegram review request → ${booking.clientName} (${booking.reference})`);
      } catch (err) {
        console.error(`  ✗ Telegram failed ${booking.reference}:`, err.message);
      }
    }
    if (ok) { booking.reviewRequestedAt = new Date().toISOString(); sent++; }
  }

  // Save updated bookings with reviewRequestedAt
  if (sent > 0) {
    fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2) + "\n", "utf8");
  }

  console.log(`[review-requests] Done. Sent: ${sent}/${due.length}`);
}

main().catch(err => {
  console.error("[review-requests] Fatal:", err);
  process.exitCode = 1;
});
