import path from "path";
import { stripMarkdown, wordCount } from "./text.js";

export function parseFrontMatter(markdown = "") {
  const match = String(markdown).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: String(markdown) };

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) meta[key] = value;
  }
  return { meta, body: match[2] };
}

function slug(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "bolum";
}

function splitLongBlock(text, maxWords, overlapWords) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [text.trim()];

  const parts = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    parts.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start = Math.max(start + 1, end - overlapWords);
  }
  return parts;
}

/**
 * Markdown başlıklarını ve paragrafları koruyan, kararlı kimliklere sahip pasajlar üretir.
 */
export function markdownToPassages({
  filename,
  markdown,
  maxWords = 190,
  overlapWords = 25,
}) {
  const { meta, body } = parseFrontMatter(markdown);
  const requestedId = meta.id || path.basename(filename, path.extname(filename));
  const docId = slug(requestedId).replace(/-+/g, "-");
  const title = meta.title || path.basename(filename);
  const category = meta.category || "AGÜ Endüstri Mühendisliği Staj Belgeleri";

  const lines = body.split(/\r?\n/);
  const sections = [];
  let currentHeading = title;
  let currentLines = [];

  const flush = () => {
    const content = currentLines.join("\n").trim();
    if (content) sections.push({ heading: currentHeading, content });
    currentLines = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1].trim();
      continue;
    }
    currentLines.push(line);
  }
  flush();

  if (!sections.length && body.trim()) {
    sections.push({ heading: title, content: body.trim() });
  }

  const passages = [];
  let sequence = 1;

  for (const section of sections) {
    const blocks = section.content
      .split(/\r?\n\s*\r?\n/)
      .map((block) => block.trim())
      .filter(Boolean);

    let buffer = [];
    const emitBuffer = () => {
      if (!buffer.length) return;
      const combined = buffer.join("\n\n").trim();
      for (const part of splitLongBlock(combined, maxWords, overlapWords)) {
        const passageId = `${docId}::${String(sequence).padStart(2, "0")}`;
        passages.push({
          passageId,
          docId,
          title,
          category,
          section: section.heading,
          content: part,
          plainText: stripMarkdown(part),
          sequence,
          sourceFile: filename,
          wordCount: wordCount(part),
        });
        sequence += 1;
      }
      buffer = [];
    };

    for (const block of blocks) {
      const projected = wordCount([...buffer, block].join(" "));
      if (buffer.length && projected > maxWords) emitBuffer();
      buffer.push(block);
    }
    emitBuffer();
  }

  return {
    document: { docId, title, category, sourceFile: filename },
    passages,
  };
}
