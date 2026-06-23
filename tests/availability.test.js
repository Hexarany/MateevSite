"use strict";

// Тесты ядра расчёта свободных окон (calculateAvailability).
// Это та логика, что не даёт предложить уже занятый слот — то есть второй
// слой защиты от двойной брони (первый — сериализация записи, см. concurrency.test.js).

const test = require("node:test");
const assert = require("node:assert");

process.env.ADMIN_PIN = process.env.ADMIN_PIN || "test-pin";
const { calculateAvailability } = require("../server.js");

// Далёкое будущее → функция не отсекает «прошедшие» слоты и окно предв. записи,
// поэтому результат детерминирован независимо от текущей даты.
const FUTURE_DATE = "2099-06-15";

const specialist = {
  id: "spec1",
  workDays: [0, 1, 2, 3, 4, 5, 6], // работает каждый день — дата может быть любой
  workHours: { start: "09:00", end: "12:00" },
  breaks: []
};
const service = { id: "svc1", duration: 60 };

const slotTimes = (result) => result.slots.map((s) => s.time);

test("свободный день — слоты с шагом 30 мин внутри рабочих часов", () => {
  const result = calculateAvailability({ date: FUTURE_DATE, service, specialist, bookings: [] });
  // 60-мин услуга, окно 09:00–12:00 → последний старт 11:00
  assert.deepStrictEqual(slotTimes(result), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
});

test("активная бронь убирает пересекающиеся слоты (антидвойная бронь)", () => {
  const bookings = [
    { id: "b1", specialistId: "spec1", date: FUTURE_DATE, slot: "10:00", endsAt: "11:00", status: "confirmed" }
  ];
  const times = slotTimes(calculateAvailability({ date: FUTURE_DATE, service, specialist, bookings }));

  assert.ok(!times.includes("10:00"), "занятый слот не предлагается");
  assert.ok(!times.includes("09:30"), "09:30–10:30 пересекается с бронёй");
  assert.ok(!times.includes("10:30"), "10:30–11:30 пересекается с бронёй");
  assert.ok(times.includes("09:00"), "09:00–10:00 свободно (примыкает, не пересекается)");
  assert.ok(times.includes("11:00"), "11:00–12:00 свободно (примыкает, не пересекается)");
});

test("отменённая бронь не блокирует слот", () => {
  const bookings = [
    { id: "b1", specialistId: "spec1", date: FUTURE_DATE, slot: "10:00", endsAt: "11:00", status: "cancelled" }
  ];
  const times = slotTimes(calculateAvailability({ date: FUTURE_DATE, service, specialist, bookings }));
  assert.ok(times.includes("10:00"), "отмена освобождает слот");
});

test("чужой специалист не влияет на доступность", () => {
  const bookings = [
    { id: "b1", specialistId: "other", date: FUTURE_DATE, slot: "10:00", endsAt: "11:00", status: "confirmed" }
  ];
  const times = slotTimes(calculateAvailability({ date: FUTURE_DATE, service, specialist, bookings }));
  assert.ok(times.includes("10:00"), "бронь к другому специалисту не занимает слот этого");
});

test("нерабочий день — пустой список и сообщение", () => {
  const offDuty = { ...specialist, workDays: [] };
  const result = calculateAvailability({ date: FUTURE_DATE, service, specialist: offDuty, bookings: [] });
  assert.strictEqual(result.slots.length, 0);
  assert.match(result.message, /нет приема/i);
});

test("excludeBookingId — своя бронь не считается конфликтом (редактирование)", () => {
  const bookings = [
    { id: "b1", specialistId: "spec1", date: FUTURE_DATE, slot: "10:00", endsAt: "11:00", status: "confirmed" }
  ];
  const times = slotTimes(
    calculateAvailability({ date: FUTURE_DATE, service, specialist, bookings, excludeBookingId: "b1" })
  );
  assert.ok(times.includes("10:00"), "при редактировании свой же слот снова доступен");
});

test("блок расписания убирает занятые им слоты", () => {
  const schedule = { blocks: [{ specialistId: "spec1", date: FUTURE_DATE, start: "09:00", end: "10:00" }] };
  const times = slotTimes(calculateAvailability({ date: FUTURE_DATE, service, specialist, bookings: [], schedule }));
  assert.ok(!times.includes("09:00"), "заблокированное время не предлагается");
  assert.ok(times.includes("11:00"), "вне блока — свободно");
});

test("услуга длиннее рабочего окна — нет слотов", () => {
  const longService = { id: "svc-long", duration: 240 }; // 4ч в окно 3ч не влезает
  const result = calculateAvailability({ date: FUTURE_DATE, service: longService, specialist, bookings: [] });
  assert.strictEqual(result.slots.length, 0);
});
