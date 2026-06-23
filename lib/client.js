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

// Только цифры; молдавский 0XXXXXXXX → 373XXXXXXXX.
function normalizePhoneDigits(phone) {
  let digits = sanitizeText(phone).replace(/\D/g, "");
  // Moldova: 0XXXXXXXX → 373XXXXXXXX
  if (digits.length >= 8 && digits.length <= 9 && digits.startsWith("0")) {
    digits = "373" + digits.slice(1);
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
