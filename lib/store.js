"use strict";

// ── Слой персистентности ─────────────────────────────────────────────────
// Атомарная запись JSON (tmp + rename), ротация бэкапов и async-мьютекс для
// сериализации критических секций «прочитать → изменить → записать».
// Вынесено из server.js — единая точка работы с data/ и backups/.

const path = require("node:path");
const fs = require("node:fs/promises");

const ROOT_DIR = path.join(__dirname, ".."); // lib/ → корень проекта
const DATA_DIR = path.join(ROOT_DIR, "data");
const BACKUP_DIR = path.join(ROOT_DIR, "backups");
const BACKUP_RETENTION_PER_FILE = Math.max(3, Number(process.env.BACKUP_RETENTION_PER_FILE) || 30);

async function readJson(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function createTimestampSlug(date = new Date()) {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function pruneBackupFiles(fileStem) {
  try {
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    const matchingFiles = entries
      .filter(
        (entry) => entry.isFile() && entry.name.startsWith(`${fileStem}-`) && entry.name.endsWith(".json")
      )
      .map((entry) => entry.name)
      .sort()
      .reverse();

    await Promise.all(
      matchingFiles
        .slice(BACKUP_RETENTION_PER_FILE)
        .map((fileName) => fs.unlink(path.join(BACKUP_DIR, fileName)).catch(() => undefined))
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function backupExistingFile(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);

  try {
    const fileBuffer = await fs.readFile(fullPath);
    await ensureBackupDir();

    const parsed = path.parse(fileName);
    const backupName = `${parsed.name}-${createTimestampSlug()}${parsed.ext || ".json"}`;
    await fs.writeFile(path.join(BACKUP_DIR, backupName), fileBuffer);
    await pruneBackupFiles(parsed.name);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function writeJson(fileName, value) {
  await backupExistingFile(fileName);
  const fullPath = path.join(DATA_DIR, fileName);
  const tmpPath = `${fullPath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, fullPath);
}

// ── Per-key async mutex ──────────────────────────────────────────────────
// Сериализует критические секции, чтобы два одновременных запроса не
// вклинились друг в друга (иначе две брони на один слот затрут друг друга).
// Процесс один (PM2, 1 инстанс) — in-process блокировки достаточно.
const lockChains = new Map();

function withLock(key, fn) {
  const previous = lockChains.get(key) || Promise.resolve();
  // fn стартует только после того, как все прежние держатели ключа отработали.
  const result = previous.then(fn, fn);
  // Хвост проглатывает ошибки, чтобы одна упавшая секция не заклинила очередь.
  const tail = result.then(() => {}, () => {});
  lockChains.set(key, tail);
  // Подчищаем запись, когда очередь по ключу опустела, чтобы Map не рос.
  tail.then(() => {
    if (lockChains.get(key) === tail) {
      lockChains.delete(key);
    }
  });
  return result;
}

module.exports = {
  DATA_DIR,
  BACKUP_DIR,
  readJson,
  writeJson,
  withLock,
  ensureBackupDir,
  createTimestampSlug,
  pruneBackupFiles,
  backupExistingFile
};
