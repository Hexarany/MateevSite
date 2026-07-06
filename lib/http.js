"use strict";

// ── Исходящие HTTP-запросы ────────────────────────────────────────────────
// requestJson: POST/GET с JSON-телом, таймаутом и разбором ответа. Нужен для
// внешних API (Telegram, Resend и т.п.). Вынесено из server.js как общий
// фундаментный модуль — им пользуется и server.js, и lib/notify.js, поэтому
// держать его отдельно проще (исключает циклические зависимости).

const https = require("node:https");
const { URL } = require("node:url");

const HTTP_OUTBOUND_TIMEOUT_MS = Math.max(1000, Number(process.env.HTTP_OUTBOUND_TIMEOUT_MS) || 8000);

async function requestJson(urlString, { method = "POST", headers = {}, body, timeout } = {}) {
  const urlObject = new URL(urlString);
  const payload = body ? JSON.stringify(body) : "";

  return new Promise((resolve, reject) => {
    const outboundRequest = https.request(
      urlObject,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers
        },
        timeout: Math.max(1000, Number(timeout) || HTTP_OUTBOUND_TIMEOUT_MS)
      },
      (outboundResponse) => {
        const chunks = [];

        outboundResponse.on("data", (chunk) => {
          chunks.push(chunk);
        });

        outboundResponse.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");

          if (outboundResponse.statusCode && outboundResponse.statusCode >= 400) {
            reject(new Error(raw || `Upstream request failed with status ${outboundResponse.statusCode}`));
            return;
          }

          if (!raw) {
            resolve({});
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ raw });
          }
        });
      }
    );

    outboundRequest.on("timeout", () => {
      outboundRequest.destroy(new Error("Upstream request timed out"));
    });

    outboundRequest.on("error", (error) => {
      reject(error);
    });

    if (payload) {
      outboundRequest.write(payload);
    }

    outboundRequest.end();
  });
}

module.exports = { requestJson };
