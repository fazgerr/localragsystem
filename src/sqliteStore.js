import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  characterTrigrams,
  clamp,
  cosineSimilarity,
  jaccard,
  normalizeText,
  tokenize,
} from "./text.js";

function vectorToBlob(vector) {
  const values = Float32Array.from(vector || []);
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength);
}

function blobToVector(blob, dimensions) {
  if (!blob) return [];
  const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const aligned = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  const values = Array.from(new Float32Array(aligned));
  return dimensions ? values.slice(0, dimensions) : values;
}

function tokenCoverage(queryTokens, textTokens) {
  if (!queryTokens.length) return 0;
  const textSet = new Set(textTokens);
  let matched = 0;
  for (const token of new Set(queryTokens)) if (textSet.has(token)) matched += 1;
  return matched / new Set(queryTokens).size;
}

function lexicalScore(query, row) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return 0;

  const bodyTokens = tokenize(row.plain_text || row.content || "");
  const titleTokens = tokenize(row.title || "");
  const sectionTokens = tokenize(row.section || "");
  const categoryTokens = tokenize(row.category || "");

  const bodyCoverage = tokenCoverage(queryTokens, bodyTokens);
  const titleCoverage = tokenCoverage(queryTokens, titleTokens);
  const sectionCoverage = tokenCoverage(queryTokens, sectionTokens);
  const categoryCoverage = tokenCoverage(queryTokens, categoryTokens);
  const fuzzy = jaccard(
    characterTrigrams(query),
    characterTrigrams(
      `${row.title || ""} ${row.section || ""} ${row.category || ""} ${row.plain_text || ""}`
    )
  );
  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(
    `${row.title || ""} ${row.section || ""} ${row.plain_text || ""}`
  );
  const phraseBoost =
    normalizedQuery.length >= 8 && normalizedText.includes(normalizedQuery) ? 0.15 : 0;

  // Ders kodu, yüzde, sınıf veya form adı gibi açık varlıklar genel benzerlikten
  // daha güçlü bir sinyaldir. Bu, tek tek soru ezberlemek yerine tüm açık
  // varlıkları aynı kuralla önceliklendirir.
  const queryEntities = new Set(
    normalizedQuery.match(/\bie(?:197|297|397)\b|\b\d+(?:[.,]\d+)?%?\b/g) || []
  );
  const normalizedSection = normalizeText(row.section || "");
  const normalizedTitle = normalizeText(row.title || "");
  const sectionEntities = new Set(
    normalizedSection.match(/\bie(?:197|297|397)\b|\b\d+(?:[.,]\d+)?%?\b/g) || []
  );
  const titleEntities = new Set(
    normalizedTitle.match(/\bie(?:197|297|397)\b|\b\d+(?:[.,]\d+)?%?\b/g) || []
  );
  const rowEntities = new Set(
    normalizedText.match(/\bie(?:197|297|397)\b|\b\d+(?:[.,]\d+)?%?\b/g) || []
  );
  const sectionEntityMatch = [...queryEntities].some((entity) => sectionEntities.has(entity));
  const titleEntityMatch = [...queryEntities].some((entity) => titleEntities.has(entity));
  const bodyEntityMatch = [...queryEntities].some((entity) => rowEntities.has(entity));
  const entityBoost = sectionEntityMatch ? 0.40 : titleEntityMatch ? 0.10 : bodyEntityMatch ? 0.06 : 0;

  return clamp(
    bodyCoverage * 0.48 +
      titleCoverage * 0.2 +
      sectionCoverage * 0.14 +
      categoryCoverage * 0.06 +
      fuzzy * 0.12 +
      phraseBoost +
      entityBoost
  );
}

export class SQLiteVectorStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.createSchema();
  }

  createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        doc_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        source_file TEXT NOT NULL,
        content_hash TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS passages (
        passage_id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        section TEXT NOT NULL,
        content TEXT NOT NULL,
        plain_text TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        word_count INTEGER NOT NULL,
        embedding BLOB,
        embedding_dim INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_passages_doc_id ON passages(doc_id);
      CREATE INDEX IF NOT EXISTS idx_passages_sequence ON passages(doc_id, sequence);
    `);
  }

  close() {
    this.db.close();
  }

  clear() {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      this.db.exec("DELETE FROM passages; DELETE FROM documents; DELETE FROM metadata;");
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  setMetadata(key, value) {
    this.db
      .prepare(`INSERT INTO metadata(key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(String(key), String(value));
  }

  getMetadata(key) {
    const row = this.db.prepare("SELECT value FROM metadata WHERE key = ?").get(String(key));
    return row?.value ?? null;
  }

  replaceAll(items, metadata = {}) {
    const insertDocument = this.db.prepare(`
      INSERT INTO documents(doc_id, title, category, source_file, content_hash)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertPassage = this.db.prepare(`
      INSERT INTO passages(
        passage_id, doc_id, section, content, plain_text,
        sequence, word_count, embedding, embedding_dim
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.exec("BEGIN IMMEDIATE;");
    try {
      this.db.exec("DELETE FROM passages; DELETE FROM documents; DELETE FROM metadata;");
      for (const item of items) {
        const document = item.document;
        insertDocument.run(
          document.docId,
          document.title,
          document.category,
          document.sourceFile,
          document.contentHash || ""
        );
        for (const passage of item.passages) {
          const vector = passage.embedding || [];
          insertPassage.run(
            passage.passageId,
            passage.docId,
            passage.section,
            passage.content,
            passage.plainText,
            passage.sequence,
            passage.wordCount,
            vector.length ? vectorToBlob(vector) : null,
            vector.length
          );
        }
      }
      const setMeta = this.db.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)");
      for (const [key, value] of Object.entries(metadata)) {
        setMeta.run(String(key), String(value));
      }
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  upsertDocument(document, passages) {
    const upsertDocument = this.db.prepare(`
      INSERT INTO documents(doc_id, title, category, source_file, content_hash)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(doc_id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        source_file = excluded.source_file,
        content_hash = excluded.content_hash
    `);
    const insertPassage = this.db.prepare(`
      INSERT INTO passages(
        passage_id, doc_id, section, content, plain_text,
        sequence, word_count, embedding, embedding_dim
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.exec("BEGIN IMMEDIATE;");
    try {
      upsertDocument.run(
        document.docId,
        document.title,
        document.category,
        document.sourceFile,
        document.contentHash || ""
      );
      this.db.prepare("DELETE FROM passages WHERE doc_id = ?").run(document.docId);
      for (const passage of passages) {
        const vector = passage.embedding || [];
        insertPassage.run(
          passage.passageId,
          passage.docId,
          passage.section,
          passage.content,
          passage.plainText,
          passage.sequence,
          passage.wordCount,
          vector.length ? vectorToBlob(vector) : null,
          vector.length
        );
      }
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  countDocuments() {
    return Number(this.db.prepare("SELECT COUNT(*) AS count FROM documents").get().count);
  }

  countPassages() {
    return Number(this.db.prepare("SELECT COUNT(*) AS count FROM passages").get().count);
  }

  hasEmbeddings() {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM passages WHERE embedding IS NOT NULL AND embedding_dim > 0")
      .get();
    return Number(row.count) === this.countPassages() && Number(row.count) > 0;
  }

  getDocument(docId) {
    const row = this.db
      .prepare(`SELECT doc_id AS docId, title, category, source_file AS sourceFile, content_hash AS contentHash
                FROM documents WHERE doc_id = ?`)
      .get(String(docId));
    return row || null;
  }

  listDocuments() {
    return this.db
      .prepare(`
        SELECT d.doc_id AS docId, d.title, d.category,
               d.source_file AS sourceFile, COUNT(p.passage_id) AS passageCount
        FROM documents d
        LEFT JOIN passages p ON p.doc_id = d.doc_id
        GROUP BY d.doc_id
        ORDER BY d.title COLLATE NOCASE
      `)
      .all()
      .map((row) => ({ ...row, passageCount: Number(row.passageCount) }));
  }

  getPassagesByIds(ids = []) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return [];
    const placeholders = unique.map(() => "?").join(",");
    const rows = this.db
      .prepare(`
        SELECT p.*, d.title, d.category, d.source_file
        FROM passages p JOIN documents d ON d.doc_id = p.doc_id
        WHERE p.passage_id IN (${placeholders})
      `)
      .all(...unique);
    const byId = new Map(rows.map((row) => [row.passage_id, this._publicRow(row)]));
    return unique.map((id) => byId.get(id)).filter(Boolean);
  }

  _allRows() {
    return this.db.prepare(`
      SELECT p.*, d.title, d.category, d.source_file
      FROM passages p JOIN documents d ON d.doc_id = p.doc_id
      ORDER BY d.doc_id, p.sequence
    `).all();
  }

  _publicRow(row) {
    return {
      passageId: row.passage_id,
      docId: row.doc_id,
      title: row.title,
      category: row.category,
      sourceFile: row.source_file,
      section: row.section,
      content: row.content,
      plainText: row.plain_text,
      sequence: Number(row.sequence),
      wordCount: Number(row.word_count),
    };
  }

  search({ queryText, queryEmbedding = null, topK = 8, semanticWeight = 0.72, lexicalWeight = 0.28 }) {
    const rows = this._allRows();
    const hasVector = Array.isArray(queryEmbedding) && queryEmbedding.length > 0;

    const scored = rows.map((row) => {
      const lexical = lexicalScore(queryText, row);
      let semantic = 0;
      if (hasVector && row.embedding && Number(row.embedding_dim) === queryEmbedding.length) {
        semantic = clamp(cosineSimilarity(queryEmbedding, blobToVector(row.embedding, row.embedding_dim)));
      }
      const weighted = semantic * semanticWeight + lexical * lexicalWeight;
      // Güçlü bir tam/terim eşleşmesinin zayıf bir embedding sonucuyla ezilmesini
      // önlemek için sözcüksel puan hibrit skorun alt sınırıdır.
      const score = hasVector ? clamp(Math.max(weighted, lexical)) : lexical;
      return {
        ...this._publicRow(row),
        score,
        semanticScore: semantic,
        lexicalScore: lexical,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score || b.lexicalScore - a.lexicalScore)
      .slice(0, Math.max(1, topK));
  }
}

export const __test = { vectorToBlob, blobToVector, lexicalScore };
