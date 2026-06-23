"use strict";

// Юнит-тесты базовых текстовых утилит (lib/text.js).

const test = require("node:test");
const assert = require("node:assert");
const {
  sanitizeText,
  escapeHtml,
  sanitizeSlug,
  sanitizeInteger,
  sanitizeStringArray,
  buildInitials
} = require("../lib/text");

test("sanitizeText: тримит строки, иначе fallback", () => {
  assert.strictEqual(sanitizeText("  hi  "), "hi");
  assert.strictEqual(sanitizeText(123, "def"), "def");
  assert.strictEqual(sanitizeText(undefined), "");
});

test("escapeHtml: экранирует опасные символы", () => {
  assert.strictEqual(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.strictEqual(escapeHtml(null), "");
});

test("sanitizeSlug: латиница-дефисы, иначе fallback", () => {
  assert.strictEqual(sanitizeSlug("Денис Матиевич", "fb"), "fb"); // кириллица → пусто → fallback
  assert.strictEqual(sanitizeSlug("Deep Tissue!!"), "deep-tissue");
  assert.strictEqual(sanitizeSlug("  --Hello--  "), "hello");
});

test("sanitizeInteger: неотрицательное целое", () => {
  assert.strictEqual(sanitizeInteger("7.8"), 8);
  assert.strictEqual(sanitizeInteger(-5), 0);
  assert.strictEqual(sanitizeInteger("abc", 3), 3);
});

test("sanitizeStringArray: чистит и дедуплицирует", () => {
  assert.deepStrictEqual(sanitizeStringArray([" a ", "a", "", "b"]), ["a", "b"]);
  assert.deepStrictEqual(sanitizeStringArray("not-array", ["x"]), ["x"]);
});

test("buildInitials: до двух заглавных, иначе MS", () => {
  assert.strictEqual(buildInitials("Денис Матиевич"), "ДМ");
  assert.strictEqual(buildInitials("Anna"), "A");
  assert.strictEqual(buildInitials("   "), "MS");
});
