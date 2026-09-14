import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { markdownToPassages } from "./documentParser.js";
import { SQLiteVectorStore } from "./sqliteStore.js";
import { FoundryRuntime } from "./foundryRuntime.js";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function readDocuments(docsDir = config.docsDir) {
  if (!fs.existsSync(docsDir)) throw new Error(`Belge klasörü bulunamadı: ${docsDir}`);
  const files = fs
    .readdirSync(docsDir)
    .filter((name) => /\.(md|txt)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "tr"));

  const seenIds = new Set();
  return files.map((filename) => {
    const markdown = fs.readFileSync(path.join(docsDir, filename), "utf8");
    const parsed = markdownToPassages({ filename, markdown });
    if (seenIds.has(parsed.document.docId)) {
      throw new Error(`Aynı belge kimliği birden fazla dosyada kullanılmış: ${parsed.document.docId}`);
    }
    seenIds.add(parsed.document.docId);
    parsed.document.contentHash = sha256(markdown);
    return parsed;
  });
}

export async function buildKnowledgeBase({
  cfg = config,
  store = null,
  runtime = null,
  embedder = null,
} = {}) {
  const ownStore = !store;
  const ownRuntime = !runtime && !embedder;
  const vectorStore = store || new SQLiteVectorStore(cfg.dbPath);
  const foundry = runtime || (embedder ? null : new FoundryRuntime({ cfg }));
  const documents = readDocuments(cfg.docsDir);
  const allPassages = documents.flatMap((item) => item.passages);
  const texts = allPassages.map((passage) => {
    const document = documents.find((item) => item.document.docId === passage.docId)?.document;
    return `${document?.title || passage.title}\n${passage.section}\n${passage.plainText}`;
  });

  console.log("=== AGÜ IE Staj Asistanı – Foundry Embeddings + SQLite ===\n");
  console.log(`${documents.length} belge, ${allPassages.length} pasaj bulundu.`);

  let vectors;
  try {
    if (embedder) {
      vectors = await embedder(texts);
    } else {
      await foundry.initialize({ needEmbedding: true, needChat: false });
      vectors = await foundry.embedMany(texts, { batchSize: 8 });
    }

    if (!Array.isArray(vectors) || vectors.length !== allPassages.length) {
      throw new Error("Embedding sayısı pasaj sayısıyla eşleşmiyor.");
    }
    const dimensions = vectors[0]?.length || 0;
    if (!dimensions || vectors.some((vector) => !Array.isArray(vector) || vector.length !== dimensions)) {
      throw new Error("Embedding boyutları geçersiz veya tutarsız.");
    }

    let index = 0;
    const items = documents.map((item) => ({
      document: item.document,
      passages: item.passages.map((passage) => ({
        ...passage,
        embedding: vectors[index++],
      })),
    }));

    vectorStore.replaceAll(items, {
      schema_version: "2",
      generated_at: new Date().toISOString(),
      embedding_model: cfg.embeddingModel,
      embedding_dimensions: String(dimensions),
      document_count: String(documents.length),
      passage_count: String(allPassages.length),
    });

    console.log(`\nTamamlandı: ${vectorStore.countDocuments()} belge, ${vectorStore.countPassages()} pasaj.`);
    console.log(`Embedding modeli: ${cfg.embeddingModel} (${dimensions} boyut)`);
    console.log(`SQLite bilgi tabanı: ${cfg.dbPath}`);

    return {
      documents: vectorStore.countDocuments(),
      passages: vectorStore.countPassages(),
      dimensions,
      dbPath: cfg.dbPath,
    };
  } finally {
    if (ownRuntime && foundry) await foundry.close();
    if (ownStore) vectorStore.close();
  }
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  buildKnowledgeBase().catch((error) => {
    console.error(`\n[Ingest] Hata: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}
