"use strict";

// ── Базовые текстовые утилиты ─────────────────────────────────────────────
// Чистые функции: санитайз, escape, слаги, инициалы. Без side-effects и без
// зависимостей от состояния приложения. Используются по всему server.js,
// поэтому вынесены в отдельный фундаментный модуль (исключает циклические
// зависимости при дальнейшем дроблении монолита).

const crypto = require("node:crypto");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item) => sanitizeText(item))
    .filter((item, index, array) => item && array.indexOf(item) === index);
}

function sanitizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeInteger(value, fallback = 0) {
  return Math.max(0, Math.round(sanitizeNumber(value, fallback)));
}

function sanitizeSlug(value, fallback) {
  const slug = sanitizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function createFallbackId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function buildInitials(name) {
  const parts = sanitizeText(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "MS";
  }

  return parts
    .map((part) => Array.from(part)[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

module.exports = {
  clone,
  sanitizeText,
  escapeHtml,
  sanitizeStringArray,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeSlug,
  createFallbackId,
  buildInitials
};
