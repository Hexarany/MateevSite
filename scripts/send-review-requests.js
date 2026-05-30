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
const GOOGLE_REVIEW_URL = "https://g.page/r/YOUR_PLACE_ID/review";

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
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
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
  const bg = "#f7f0e6";
  const ink = "#241c17";
  const muted = "#7d6d60";

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
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${muted};">Спасибо за визит</p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:${ink};">${booking.clientName}, как прошёл сеанс?</h1>
            <p style="margin:0 0 24px;font-size:15px;color:${muted};line-height:1.7;">
              Вы посетили нас вчера — ${booking.serviceName} с ${booking.specialistName}.<br>
              Нам важно знать ваше мнение. Если вам понравилось — оставьте отзыв на Google, это очень поможет студии.
            </p>
            <a href="${GOOGLE_REVIEW_URL}"
               style="display:inline-block;padding:14px 28px;background:${brandColor};color:#fff;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">
              ⭐ Оставить отзыв на Google
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px 28px;">
            <p style="margin:0;font-size:13px;color:${muted};line-height:1.6;">
              Если что-то пошло не так или есть пожелания — просто ответьте на это письмо.<br>
              Ждём вас снова. До встречи!
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);">
            <a href="${SITE_URL}/#booking" style="font-size:13px;color:${brandColor};font-weight:700;text-decoration:none;">
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
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.log("[review-requests] Skipped: RESEND_API_KEY or EMAIL_FROM not set.");
    return;
  }

  const yesterday = getYesterday();
  const bookingsPath = path.join(ROOT, "data", "bookings.json");

  if (!fs.existsSync(bookingsPath)) {
    console.log("[review-requests] bookings.json not found.");
    return;
  }

  const bookings = JSON.parse(fs.readFileSync(bookingsPath, "utf8"));

  const due = bookings.filter(b =>
    b.date === yesterday &&
    (b.status === "confirmed" || b.status === "completed") &&
    b.email &&
    !b.reviewRequestedAt
  );

  console.log(`[review-requests] Yesterday: ${yesterday}, eligible: ${due.length}`);

  let sent = 0;
  for (const booking of due) {
    try {
      await post("https://api.resend.com/emails",
        { Authorization: `Bearer ${RESEND_API_KEY}` },
        {
          from: EMAIL_FROM,
          to: [booking.email],
          replyTo: EMAIL_REPLY_TO || undefined,
          subject: `${booking.clientName}, как прошёл ваш визит? — Mateev Spa Studio`,
          html: buildReviewEmail(booking),
          text: `Здравствуйте, ${booking.clientName}!\n\nВы посетили нас вчера — ${booking.serviceName} с ${booking.specialistName}.\n\nЕсли вам понравилось, пожалуйста оставьте отзыв на Google:\n${GOOGLE_REVIEW_URL}\n\nЗаписаться снова: ${SITE_URL}/#booking`
        }
      );
      booking.reviewRequestedAt = new Date().toISOString();
      sent++;
      console.log(`  ✓ Review request sent to ${booking.email} (${booking.reference})`);
    } catch (err) {
      console.error(`  ✗ Failed for ${booking.reference}:`, err.message);
    }
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
