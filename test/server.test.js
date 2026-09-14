import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequestHandler } from "../src/server.js";
import { config } from "../src/config.js";
import { createTempDir, removeTempDir } from "./helpers/testUtils.js";

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function fakeEngine() {
  const documents = [];
  return {
    queryCalls: 0,
    getStore() {
      return {
        countDocuments: () => 17 + documents.length,
        countPassages: () => 30,
        listDocuments: () => documents,
        getDocument: (id) => documents.find((item) => item.docId === id) || null,
      };
    },
    async query(message) {
      this.queryCalls += 1;
      return { text: `Yanıt: ${message}`, sources: [], grounded: true };
    },
    async addDocument(parsed) {
      documents.push(parsed.document);
      return parsed.passages.length;
    },
  };
}

test("Yerel HTTP API", async (t) => {
  const tempDir = createTempDir("agu-http-");
  fs.writeFileSync(path.join(tempDir, "index.html"), "<h1>AGÜ</h1>", "utf8");
  const docsDir = path.join(tempDir, "docs");
  fs.mkdirSync(docsDir);
  const cfg = { ...config, publicDir: tempDir, docsDir };
  const engine = fakeEngine();
  const state = { ready: true, error: null, status: { phase: "ready", message: "Hazır" } };
  const handler = createRequestHandler({ engine, cfg, state });

  try {
    await withServer(handler, async (base) => {
      await t.test("sağlık bilgisi ve güvenlik başlıkları döner", async () => {
        const response = await fetch(`${base}/api/health`);
        const data = await response.json();
        assert.equal(response.status, 200);
        assert.equal(data.status, "ok");
        assert.equal(response.headers.get("x-frame-options"), "DENY");
        assert.match(data.retrieval, /SQLite/);
      });

      await t.test("geçerli sohbet isteğini işler", async () => {
        const response = await fetch(`${base}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "IE 297 kaç gün?", history: [] }),
        });
        const data = await response.json();
        assert.equal(response.status, 200);
        assert.match(data.text, /IE 297/);
      });

      await t.test("boş ve çok uzun soruyu reddeder", async () => {
        for (const message of ["", "x".repeat(cfg.maxQuestionChars + 1)]) {
          const response = await fetch(`${base}/api/chat`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ message }),
          });
          assert.equal(response.status, 400);
        }
      });

      await t.test("geçersiz belge uzantısını reddeder", async () => {
        const response = await fetch(`${base}/api/upload`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: "zararli.exe", content: "x".repeat(50) }),
        });
        assert.equal(response.status, 400);
      });

      await t.test("geçerli yerel belgeyi güvenli adla ekler ve çakışmayı reddeder", async () => {
        const payload = {
          filename: "Yeni Belge.md",
          content: "---\nid: yeni-belge\ntitle: Yeni Belge\n---\n# Bilgi\nBu, staj süreciyle ilgili yeterince uzun bir yerel belge metnidir.",
        };
        const first = await fetch(`${base}/api/upload`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        assert.equal(first.status, 200);
        assert.equal(fs.existsSync(path.join(docsDir, "Yeni_Belge.md")), true);
        const second = await fetch(`${base}/api/upload`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        assert.equal(second.status, 409);
      });
    });
  } finally { removeTempDir(tempDir); }
});
