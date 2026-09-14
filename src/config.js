import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const appName = "agu-staj-asistani-rag-v4";

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const config = Object.freeze({
  appName,
  version: "4.0.6",

  // SDK'nin kullanıcı ana dizinini yanlışlıkla sürücü kökü olarak algıladığı
  // kısıtlı Windows oturumlarında da yazılabilir, kullanıcıya özel bir konum kullan.
  foundryAppDataDir:
    process.env.FOUNDRY_APP_DATA_DIR ||
    path.join(process.env.LOCALAPPDATA || rootDir, appName),

  rootDir,
  docsDir: path.join(rootDir, "docs"),
  dbPath: path.join(rootDir, "data", "knowledge.db"),
  publicDir: path.join(rootDir, "public"),

  host: process.env.HOST || "127.0.0.1",
  port: numberEnv("PORT", 3000),

  chatModel: process.env.FOUNDRY_CHAT_MODEL || "qwen2.5-0.5b",
  embeddingModel:
    process.env.FOUNDRY_EMBEDDING_MODEL || "qwen3-embedding-0.6b",

  // Varsayılan olarak modeller sırayla yüklenir. Bu, 6 GB sınıfı dizüstü GPU'larda
  // chat ve embedding modellerinin aynı anda VRAM tüketmesini önler.
  sequentialModels: boolEnv("FOUNDRY_SEQUENTIAL_MODE", true),

  maxQuestionChars: 1200,
  maxHistoryUserTurns: 2,
  maxContextPassages: 4,
  maxContextChars: 3600,
  maxAnswerWords: 110,
  answerMaxTokens: numberEnv("ANSWER_MAX_TOKENS", 220),

  semanticWeight: 0.72,
  lexicalWeight: 0.28,
  minimumHybridScore: 0.22,
  minimumLexicalScore: 0.08,
  minimumExtractiveScore: 0.40,
  searchTopK: 8,

  noSourceMessage:
    "Bu bilgi yerel belge arşivinde bulunmuyor. Güncel veya kişiye özel bir durumsa AGÜ Endüstri Mühendisliği Bölümünün duyurularını ya da Staj Programı Komisyonunu kontrol etmelisin.",
  outOfScopeMessage:
    "Bu soru AGÜ Endüstri Mühendisliği staj süreçlerinin kapsamı dışında. Bu asistan yalnızca yüklenen staj belgelerine dayanarak cevap verir.",
  modelFallbackMessage:
    "Yerel model yanıt oluşturamadığı için aşağıdaki bilgi doğrudan ilgili belge pasajlarından derlendi.",
});
