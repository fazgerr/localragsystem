import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { markdownToPassages } from "./documentParser.js";
import { QueryEngine } from "./queryEngine.js";
import { QueryCache, compressResponse, RateLimiter, PerformanceMonitor } from "./optimization.js";

const SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';",
});

// Caching ve optimization tools
const queryCache = new QueryCache(100, 3600000); // 1 hour TTL
const rateLimiter = new RateLimiter(60, 60000); // 60 requests per minute
const perfMonitor = new PerformanceMonitor();

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": contentType });
  res.end(contentType.startsWith("application/json") ? JSON.stringify(body) : body);
}

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of req) {
      total += chunk.length;
      if (total > limit) throw new Error("İstek gövdesi çok büyük.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch (err) {
    if (err.message.includes("çok büyük")) throw err;
    throw new Error(`İstek okunurken hata: ${err?.message || "bilinmeyen hata"}`);
  }
}

function safeUploadName(value) {
  const base = path.basename(String(value || ""));
  return base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export function createRequestHandler({ engine, cfg = config, state }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/api/health") {
        return send(res, 200, {
          status: state.ready ? "ok" : state.error ? "error" : "loading",
          message: state.error || state.status.message,
          phase: state.status.phase,
          version: cfg.version,
          chatModel: cfg.chatModel,
          embeddingModel: cfg.embeddingModel,
          retrieval: "Foundry Local embeddings + SQLite hybrid search",
          documents: engine.getStore().countDocuments(),
          passages: engine.getStore().countPassages(),
        });
      }

      if (req.method === "GET" && url.pathname === "/api/docs") {
        return send(res, 200, { documents: engine.getStore().listDocuments() });
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        if (!state.ready) return send(res, 503, { error: state.error || "Sistem hazırlanıyor." });
        
        // Rate limiting (client IP tarafından)
        const clientId = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
        if (!rateLimiter.isAllowed(clientId)) {
          return send(res, 429, { error: "Çok fazla istek. Lütfen biraz bekleyin." });
        }
        
        const raw = await readBody(req);
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          return send(res, 400, { error: "Geçersiz JSON." });
        }
        const message = typeof body.message === "string" ? body.message.trim() : "";
        const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
        if (!message) return send(res, 400, { error: "Soru metni gerekli." });
        if (message.length > cfg.maxQuestionChars) {
          return send(res, 400, { error: `Soru en fazla ${cfg.maxQuestionChars} karakter olabilir.` });
        }
        
        // Cache kontrolü
        let result = queryCache.get(message, history);
        if (result) {
          result.cached = true;
          return send(res, 200, compressResponse(result));
        }
        
        // Query'yi çalıştır ve cache'e kaydet
        const startTime = Date.now();
        result = await engine.query(message, history);
        const elapsed = Date.now() - startTime;
        perfMonitor.record(elapsed);
        
        result.cached = false;
        result.responseTimeMs = elapsed;
        queryCache.set(message, history, result);
        
        return send(res, 200, compressResponse(result));
      }

      if (req.method === "GET" && url.pathname === "/api/stats") {
        return send(res, 200, {
          cache: queryCache.stats(),
          performance: perfMonitor.stats(),
          uptime: Math.floor(process.uptime()),
        });
      }

      if (req.method === "POST" && url.pathname === "/api/upload") {
        if (!state.ready) return send(res, 503, { error: state.error || "Sistem hazırlanıyor." });
        const raw = await readBody(req, 2_000_000);
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          return send(res, 400, { error: "Geçersiz JSON." });
        }
        const filename = safeUploadName(body.filename);
        const content = typeof body.content === "string" ? body.content : "";
        if (!/\.(md|txt)$/i.test(filename)) {
          return send(res, 400, { error: "Yalnızca .md veya .txt dosyası yüklenebilir." });
        }
        if (content.trim().length < 30) {
          return send(res, 400, { error: "Belge içeriği çok kısa." });
        }
        const markdownName = filename.replace(/\.txt$/i, ".md");
        const parsed = markdownToPassages({ filename: markdownName, markdown: content });
        if (!parsed.passages.length) {
          return send(res, 400, { error: "Belgeden pasaj üretilemedi." });
        }
        const target = path.join(cfg.docsDir, markdownName);
        if (fs.existsSync(target)) {
          return send(res, 409, { error: "Aynı dosya adıyla bir belge zaten var." });
        }
        const existing = engine.getStore().getDocument(parsed.document.docId);
        if (existing) {
          return send(res, 409, {
            error: `Belge kimliği zaten kullanılıyor: ${parsed.document.docId}`,
          });
        }
        const passageCount = await engine.addDocument(parsed);
        fs.writeFileSync(target, content, "utf8");
        return send(res, 200, {
          success: true,
          filename: markdownName,
          documentId: parsed.document.docId,
          passages: passageCount,
          totalDocuments: engine.getStore().countDocuments(),
        });
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const html = fs.readFileSync(path.join(cfg.publicDir, "index.html"), "utf8");
        return send(res, 200, html, "text/html; charset=utf-8");
      }

      return send(res, 404, { error: "Bulunamadı." });
    } catch (error) {
      console.error(`[HTTP] ${error.stack || error.message}`);
      return send(res, 500, { error: "Beklenmeyen bir yerel uygulama hatası oluştu." });
    }
  };
}

export async function startServer({ engine = new QueryEngine(), cfg = config } = {}) {
  const state = {
    ready: false,
    error: null,
    status: { phase: "init", message: "Başlatılıyor..." },
  };
  
  // Config path doğrulama
  if (!fs.existsSync(cfg.docsDir)) {
    state.error = `Belge klasörü bulunamadı: ${cfg.docsDir}`;
    console.error(`[CONFIG] ${state.error}`);
  }
  if (!fs.existsSync(path.dirname(cfg.dbPath))) {
    try {
      fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
    } catch (err) {
      state.error = `Veri klasörü oluşturulamadı: ${err.message}`;
      console.error(`[CONFIG] ${state.error}`);
    }
  }
  if (!fs.existsSync(cfg.publicDir)) {
    state.error = `Genel klasörü bulunamadı: ${cfg.publicDir}`;
    console.error(`[CONFIG] ${state.error}`);
  }
  
  engine.onStatus((status) => {
    state.status = status;
  });

  const server = http.createServer(createRequestHandler({ engine, cfg, state }));
  await new Promise((resolve) => server.listen(cfg.port, cfg.host, resolve));
  console.log(`\nAGÜ IE Staj Asistanı v${cfg.version}`);
  console.log(`Arayüz: http://${cfg.host}:${cfg.port}`);
  console.log("Foundry Local ve SQLite hazırlanıyor...\n");

  try {
    await engine.init();
    state.ready = true;
    state.status = { phase: "ready", message: "Çevrimdışı hazır" };
    console.log("Sistem çevrimdışı olarak hazır.");
  } catch (error) {
    state.error = error.message;
    state.status = { phase: "error", message: error.message };
    console.error(`[Başlatma] ${error.stack || error.message}`);
  }

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await new Promise((resolve) => server.close(resolve));
    await engine.close();
  };
  process.once("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.once("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });

  return { server, engine, state, shutdown };
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  startServer().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
