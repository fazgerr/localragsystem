import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { SQLiteVectorStore } from "./sqliteStore.js";

function parseVersion(value) {
  return String(value).replace(/^v/, "").split(".").map(Number);
}

function atLeast(current, minimum) {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

function before(current, maximum) {
  return !atLeast(current, maximum);
}

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log(`AGÜ IE Staj Asistanı v${config.version} — Tanılama\n`);
check(
  "Node.js sürümü",
  atLeast(process.version, "22.13.0") && before(process.version, "24.0.0"),
  `${process.version} (gereken: >=22.13.0 <24)`
);
check("Belge klasörü", fs.existsSync(config.docsDir), config.docsDir);
const docCount = fs.existsSync(config.docsDir)
  ? fs.readdirSync(config.docsDir).filter((name) => /\.(md|txt)$/i.test(name)).length
  : 0;
check("Kaynak belge sayısı", docCount >= 17, String(docCount));
check("SQLite bilgi tabanı", fs.existsSync(config.dbPath), config.dbPath);

if (fs.existsSync(config.dbPath)) {
  const store = new SQLiteVectorStore(config.dbPath);
  check("SQLite belge sayısı", store.countDocuments() >= 17, String(store.countDocuments()));
  check("SQLite pasaj sayısı", store.countPassages() >= 30, String(store.countPassages()));
  check("Embedding vektörleri", store.hasEmbeddings(), store.getMetadata("embedding_model") || "bilinmiyor");
  store.close();
}

check("Arayüz dosyası", fs.existsSync(path.join(config.publicDir, "index.html")));
check("Chat modeli", Boolean(config.chatModel), config.chatModel);
check("Embedding modeli", Boolean(config.embeddingModel), config.embeddingModel);

const failed = checks.filter((item) => !item.ok);
console.log(`\nSonuç: ${checks.length - failed.length}/${checks.length} kontrol başarılı.`);
if (failed.length) process.exitCode = 1;
