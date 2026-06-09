/**
 * Daily backup script — creates local snapshot + emails bundle to admin.
 * Cron: 0 3 * * * cd /opt/MateevSite && node scripts/backup-data.js >> /var/log/mateev-backup.log 2>&1
 */

const fs     = require("node:fs");
const path   = require("node:path");
const https  = require("node:https");
const { execSync } = require("node:child_process");

const ROOT        = path.join(__dirname, "..");
const DATA_DIR    = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");

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
const BACKUP_EMAIL   = process.env.BACKUP_EMAIL || process.env.EMAIL_REPLY_TO || "";

// ── HTTP helper ────────────────────────────────────────────────────────────
function post(urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url     = new URL(urlString);
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers
      }
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

// ── Build bundle ───────────────────────────────────────────────────────────
async function buildBundle() {
  const files = (await fs.promises.readdir(DATA_DIR)).filter(f => f.endsWith(".json"));
  const bundle = {};
  for (const file of files) {
    const key = file.replace(".json", "");
    try {
      bundle[key] = JSON.parse(await fs.promises.readFile(path.join(DATA_DIR, file), "utf8"));
    } catch {
      bundle[key] = null;
    }
  }
  return { bundle, files };
}

// ── Backup uploads as tar.gz ───────────────────────────────────────────────
async function backupUploads(backupDir, date, label) {
  try {
    const tarFile = path.join(backupDir, `uploads-${date}-${label}.tar.gz`);
    execSync(`tar -czf "${tarFile}" -C "${ROOT}" uploads`, { stdio: "pipe" });
    const stat = await fs.promises.stat(tarFile);
    console.log(`Uploads archived: ${tarFile} (${Math.round(stat.size / 1024)}KB)`);
    return tarFile;
  } catch (e) {
    console.error("Uploads backup failed:", e.message);
    return null;
  }
}

// ── Local snapshot ─────────────────────────────────────────────────────────
async function saveLocalSnapshot(bundle, label) {
  const BACKUP_DIR = path.join(ROOT, "backups");
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);

  // Save JSON data bundle
  const filename = path.join(BACKUP_DIR, `backup-${date}-${label}.json`);
  await fs.promises.writeFile(filename, JSON.stringify(bundle, null, 2), "utf8");

  // Save uploads archive
  const uploadsFile = await backupUploads(BACKUP_DIR, date, label);

  // Keep only last 30 backups of each type
  for (const prefix of ["backup-", "uploads-"]) {
    const ext = prefix === "backup-" ? ".json" : ".tar.gz";
    const all = (await fs.promises.readdir(BACKUP_DIR))
      .filter(f => f.startsWith(prefix) && f.endsWith(ext))
      .sort();
    if (all.length > 30) {
      for (const old of all.slice(0, all.length - 30)) {
        await fs.promises.unlink(path.join(BACKUP_DIR, old)).catch(() => {});
      }
    }
  }

  return { filename, uploadsFile };
}

// ── Send email ─────────────────────────────────────────────────────────────
async function sendBackupEmail(bundle, fileCount, uploadsFile) {
  if (!RESEND_API_KEY || !EMAIL_FROM || !BACKUP_EMAIL) {
    console.log("Email backup skipped: RESEND_API_KEY, EMAIL_FROM or BACKUP_EMAIL not set");
    return;
  }

  const date      = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const json      = JSON.stringify(bundle, null, 2);
  const b64       = Buffer.from(json, "utf8").toString("base64");
  const filename  = `mateev-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const totalKeys = Object.keys(bundle).length;
  const totalRecs = Object.values(bundle).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);

  // Prepare uploads attachment if available and under 5MB
  const attachments = [{ filename, content: b64 }];
  if (uploadsFile) {
    try {
      const uploadsBuf = await fs.promises.readFile(uploadsFile);
      if (uploadsBuf.length < 5 * 1024 * 1024) {
        attachments.push({
          filename: path.basename(uploadsFile),
          content: uploadsBuf.toString("base64")
        });
      }
    } catch {}
  }

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f0e6;font-family:'Helvetica Neue',Arial,sans-serif;color:#241c17;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f0e6;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">
<tr><td style="background:#1a2e22;padding:24px 36px;">
  <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Автоматический бэкап</p>
  <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">Mateev Spa Studio</p>
</td></tr>
<tr><td style="padding:28px 36px;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e22;">Резервная копия данных</p>
  <p style="margin:0 0 20px;font-size:14px;color:#7d6d60;">${date}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr><td style="padding:8px 0;border-bottom:1px solid rgba(71,49,28,0.08);color:#7d6d60;">Файлов данных</td><td style="padding:8px 0;border-bottom:1px solid rgba(71,49,28,0.08);font-weight:600;text-align:right;">${totalKeys}</td></tr>
    <tr><td style="padding:8px 0;color:#7d6d60;">Всего записей</td><td style="padding:8px 0;font-weight:600;text-align:right;">${totalRecs}</td></tr>
  </table>
  <p style="margin:20px 0 0;font-size:13px;color:#7d6d60;">JSON-файл с полной копией данных прикреплён к этому письму.</p>
</td></tr>
<tr><td style="padding:16px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);">
  <p style="margin:0;font-size:12px;color:#7d6d60;">Mateev Spa Studio · Кишинёв</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const result = await post(
    "https://api.resend.com/emails",
    {
      from: EMAIL_FROM,
      to: [BACKUP_EMAIL],
      subject: `Бэкап данных ${new Date().toISOString().slice(0, 10)} — Mateev Spa Studio`,
      html,
      attachments
    },
    { Authorization: `Bearer ${RESEND_API_KEY}` }
  );

  if (result.status >= 200 && result.status < 300) {
    console.log(`Backup email sent to ${BACKUP_EMAIL}`);
  } else {
    console.error(`Backup email failed: ${result.status} ${result.body}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const label = process.argv[2] || "auto";
  console.log(`[${new Date().toISOString()}] Starting backup (${label})...`);

  const { bundle, files } = await buildBundle();
  const { filename: localFile, uploadsFile } = await saveLocalSnapshot(bundle, label);
  console.log(`Local snapshot: ${path.basename(localFile)} (${files.length} files)`);

  await sendBackupEmail(bundle, files.length, uploadsFile);
  console.log(`[${new Date().toISOString()}] Backup complete.`);
}

main().catch(e => {
  console.error(`[${new Date().toISOString()}] Backup error:`, e);
  process.exitCode = 1;
});
