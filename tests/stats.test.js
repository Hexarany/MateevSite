"use strict";

// Тесты сводки админки (buildAdminStats) — денежная математика.
// Выручка должна считаться только по подтверждённым и завершённым броням,
// а отменённые и новые не должны попадать в доход.

const test = require("node:test");
const assert = require("node:assert");

process.env.ADMIN_PIN = process.env.ADMIN_PIN || "test-pin";
const { buildAdminStats } = require("../server.js");

test("пустой список — все нули", () => {
  const stats = buildAdminStats([]);
  assert.deepStrictEqual(stats, {
    total: 0, new: 0, confirmed: 0, completed: 0, cancelled: 0, revenue: 0
  });
});

test("выручка считается только по confirmed и completed", () => {
  const bookings = [
    { status: "new", totalPrice: 500 },
    { status: "confirmed", totalPrice: 400 },
    { status: "completed", totalPrice: 600 },
    { status: "cancelled", totalPrice: 999 }
  ];
  const stats = buildAdminStats(bookings);

  assert.strictEqual(stats.total, 4);
  assert.strictEqual(stats.new, 1);
  assert.strictEqual(stats.confirmed, 1);
  assert.strictEqual(stats.completed, 1);
  assert.strictEqual(stats.cancelled, 1);
  // 400 (confirmed) + 600 (completed); new и cancelled НЕ в выручке
  assert.strictEqual(stats.revenue, 1000);
});

test("несколько завершённых суммируются корректно", () => {
  const bookings = [
    { status: "completed", totalPrice: 350 },
    { status: "completed", totalPrice: 350 },
    { status: "confirmed", totalPrice: 300 }
  ];
  assert.strictEqual(buildAdminStats(bookings).revenue, 1000);
});
