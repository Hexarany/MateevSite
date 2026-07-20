"use strict";

// ── Идентификация клиента ─────────────────────────────────────────────────
// Чистые хелперы для сопоставления клиентов по телефону и стабильного id
// профиля. Вынесено отдельно, чтобы их могли использовать и server.js, и
// lib/notify.js без циклической зависимости.

const crypto = require("node:crypto");
const { sanitizeText } = require("./text");

// Стабильный id профиля клиента из «отпечатка» телефон|email|имя.
function createClientProfileId({ clientName = "", phone = "", email = "" }) {
  const fingerprint = [
    sanitizeText(phone).replace(/\D/g, ""),
    sanitizeText(email).toLowerCase(),
    sanitizeText(clientName).toLowerCase()
  ]
    .filter(Boolean)
    .join("|");

  return `client-${crypto.createHash("sha1").update(fingerprint || crypto.randomUUID()).digest("hex").slice(0, 12)}`;
}

// Приводим номер к канонической форме (только цифры), чтобы один и тот же
// молдавский номер, введённый по-разному, давал одинаковый результат:
//   +373 60 12 34 56 · 060123456 · 60123456 · 00373601234 56  →  37360123456
function normalizePhoneDigits(phone) {
  let digits = sanitizeText(phone).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // международный префикс 00373… → 373…
  // Молдова, локальный с ведущим 0: 0XXXXXXXX → 373XXXXXXXX
  if (digits.length >= 8 && digits.length <= 9 && digits.startsWith("0")) {
    digits = "373" + digits.slice(1);
  }
  // Молдова, мобильный из 8 цифр без префикса (6X…/7X…) → 373XXXXXXXX
  else if (digits.length === 8 && /^[67]/.test(digits)) {
    digits = "373" + digits;
  }
  return digits;
}

// Совпадение номеров с учётом кода страны (сравнение по общему «хвосту»).
function phonesMatch(a, b) {
  const na = String(a || "").replace(/\D/g, "");
  const nb = String(b || "").replace(/\D/g, "");
  if (!na || !nb) return false;
  if (na === nb) return true;
  const minLen = Math.min(na.length, nb.length);
  return minLen >= 7 && na.slice(-minLen) === nb.slice(-minLen);
}

module.exports = { createClientProfileId, normalizePhoneDigits, phonesMatch };
