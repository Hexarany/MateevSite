"use strict";

// Тесты сериализации критических секций (withLock).
// Доказывают, что одновременные «прочитать → изменить → записать» не теряют
// обновления — то есть две параллельные брони на один слот не затрут друг друга.

const test = require("node:test");
const assert = require("node:assert");

// server.js падает на старте без ADMIN_PIN — задаём тестовое значение до require.
process.env.ADMIN_PIN = process.env.ADMIN_PIN || "test-pin";
const { withLock } = require("../server.js");

// Имитация состояния на диске (как массив в bookings.json).
function makeStore() {
  return { rows: [] };
}

// Read-modify-write с искусственной паузой между чтением и записью —
// именно здесь возникает гонка, если не сериализовать.
async function appendRow(store, row) {
  const current = store.rows; // "прочитали"
  await new Promise((r) => setTimeout(r, 5)); // пауза (как await в реальном хендлере)
  store.rows = [...current, row]; // "записали"
}

test("без блокировки одновременные записи теряются (демонстрация гонки)", async () => {
  const store = makeStore();
  await Promise.all([
    appendRow(store, "A"),
    appendRow(store, "B"),
    appendRow(store, "C")
  ]);
  // Из-за гонки выживает только последняя запись.
  assert.strictEqual(store.rows.length, 1, "ожидаем потерю обновлений без блокировки");
});

test("withLock сериализует записи — ничего не теряется", async () => {
  const store = makeStore();
  await Promise.all([
    withLock("store", () => appendRow(store, "A")),
    withLock("store", () => appendRow(store, "B")),
    withLock("store", () => appendRow(store, "C"))
  ]);
  assert.strictEqual(store.rows.length, 3, "все три записи должны сохраниться");
  assert.deepStrictEqual([...store.rows].sort(), ["A", "B", "C"]);
});

test("разные ключи не блокируют друг друга", async () => {
  const order = [];
  await Promise.all([
    withLock("k1", async () => { await new Promise((r) => setTimeout(r, 20)); order.push("slow"); }),
    withLock("k2", async () => { order.push("fast"); })
  ]);
  // Быстрая секция на другом ключе не ждёт медленную.
  assert.strictEqual(order[0], "fast");
});

test("ошибка в одной секции не заклинивает очередь ключа", async () => {
  await assert.rejects(withLock("k", async () => { throw new Error("boom"); }));
  // Следующая секция на том же ключе всё ещё выполняется.
  const result = await withLock("k", async () => 42);
  assert.strictEqual(result, 42);
});

test("withLock возвращает значение функции", async () => {
  const value = await withLock("ret", async () => "hello");
  assert.strictEqual(value, "hello");
});
