const TURKISH_FOLD = new Map([
  ["ı", "i"], ["İ", "i"], ["ş", "s"], ["Ş", "s"],
  ["ç", "c"], ["Ç", "c"], ["ğ", "g"], ["Ğ", "g"],
  ["ö", "o"], ["Ö", "o"], ["ü", "u"], ["Ü", "u"],
]);

const STOP_WORDS = new Set([
  "acaba", "ama", "ancak", "ben", "bana", "beni", "benim", "biz",
  "bu", "bunu", "da", "de", "daha", "diye", "en", "gibi", "icin",
  "ile", "ise", "ki", "mi", "mu", "mı", "mü", "ne", "nasil", "o",
  "olarak", "olan", "oldu", "olur", "peki", "sonra", "su", "şu",
  "ve", "veya", "ya", "yani", "simdi", "şimdi", "bir", "kadar",
]);

const CANONICAL = new Map([
  ["intern", "staj"], ["internship", "staj"], ["stajyer", "staj"],
  ["staji", "staj"], ["stajim", "staj"], ["stajimi", "staj"], ["stajdan", "staj"], ["stajda", "staj"],
  ["stajlar", "staj"], ["stajlarin", "staj"], ["stajlarim", "staj"],
  ["stajlarimi", "staj"], ["butun", "toplam"],
  ["tum", "toplam"], ["toplami", "toplam"], ["kac", "sayi"],
  ["tane", "sayi"], ["adet", "sayi"], ["kere", "sayi"],
  ["mezun", "mezuniyet"], ["mezuniyete", "mezuniyet"],
  ["zorunlu", "zorunlu"], ["yukumludur", "zorunlu"], ["yukumluluk", "zorunlu"],
  ["tamamlamakla", "tamamla"], ["tamamlamali", "tamamla"], ["bitirmeliyim", "tamamla"],
  ["gunu", "gun"], ["gunleri", "gun"], ["isgunu", "gun"], ["aktssi", "akts"], ["aktsdir", "akts"], ["aktstir", "akts"],
  ["suresi", "sure"], ["suruyor", "sure"], ["sinifi", "sinif"],
  ["sinifa", "sinif"], ["siniftan", "sinif"], ["geciyorum", "gec"],
  ["gececegim", "gec"], ["gecerken", "gec"], ["gecmek", "gec"],
  ["sirket", "isyeri"], ["firma", "isyeri"], ["isletme", "isyeri"],
  ["isletmeyi", "isyeri"], ["isyerini", "isyeri"], ["yerini", "isyeri"],
  ["kendim", "ogrenci"], ["ogrenciye", "ogrenci"], ["ogrencinin", "ogrenci"],
  ["bulacagim", "bul"], ["bulacagiz", "bul"], ["bulma", "bul"], ["bulmak", "bul"], ["bulur", "bul"], ["bulunur", "bul"],
  ["isveren", "isyeri"], ["sigortasi", "sigorta"], ["evrak", "belge"],
  ["evraklar", "belge"], ["belgeler", "belge"], ["belgeleri", "belge"],
  ["raporu", "rapor"], ["raporun", "rapor"], ["raporda", "rapor"],
  ["degerlendirilir", "degerlendirme"], ["puanlar", "degerlendirme"],
  ["puanlama", "degerlendirme"], ["kriter", "olcut"], ["kriterler", "olcut"],
  ["kriterlerle", "olcut"], ["olcutleri", "olcut"],
  ["basvurusu", "basvuru"], ["teslimler", "teslim"], ["teslimi", "teslim"],
  ["teslimine", "teslim"], ["verecegim", "teslim"], ["verilecek", "teslim"],
  ["dosya", "belge"], ["dosyalar", "belge"], ["dosyalari", "belge"],
  ["formu", "form"], ["once", "oncesi"], ["oncesinde", "oncesi"],
  ["sirasiyla", "akis"], ["sirayla", "akis"], ["adimlar", "akis"],
  ["yapacagim", "akis"], ["yapilmali", "akis"],
  ["gonullu", "istege-bagli"], ["raporlu", "rapor"],
]);

const SAFE_SUFFIXES = [
  "lerimizden", "larimizdan", "lerimiz", "larimiz", "lerden", "lardan",
  "lerin", "larin", "leri", "lari", "ler", "lar", "dan", "den", "dir",
  "dur", "tir", "tur", "nin", "nun", "lik", "luk",
];

export function foldTurkish(value = "") {
  return [...String(value).normalize("NFKC")]
    .map((ch) => TURKISH_FOLD.get(ch) ?? ch)
    .join("");
}

export function normalizeText(value = "") {
  return foldTurkish(value)
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/ie\s*[-_.]?\s*(197|297|397)/g, "ie$1")
    .replace(/\bis\s+yeri\b/g, "isyeri")
    .replace(/(\d)\s*(?:den|dan|ten|tan)\s*(\d)\s*(?:ye|ya|e|a)/g, "$1 $2 gec")
    .replace(/[^a-z0-9%+./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeToken(raw) {
  let token = raw.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!token) return "";
  if (CANONICAL.has(token)) return CANONICAL.get(token);
  for (const suffix of SAFE_SUFFIXES) {
    if (token.length > suffix.length + 4 && token.endsWith(suffix)) {
      const stem = token.slice(0, -suffix.length);
      return CANONICAL.get(stem) || stem;
    }
  }
  return token;
}

export function tokenize(value = "", { removeStopWords = true } = {}) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const tokens = [];
  const seen = new Set();
  for (const raw of normalized.split(" ")) {
    const token = canonicalizeToken(raw);
    if (!token) continue;
    if (token.length === 1 && !/^\d$/.test(token)) continue;
    if (removeStopWords && STOP_WORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

export function stripMarkdown(value = "") {
  return String(value)
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[>*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSentences(value = "") {
  return stripMarkdown(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);
}

export function wordCount(value = "") {
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}

export function characterTrigrams(value = "") {
  const normalized = `  ${normalizeText(value)}  `;
  const set = new Set();
  for (let i = 0; i < normalized.length - 2; i += 1) {
    set.add(normalized.slice(i, i + 3));
  }
  return set;
}

export function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function extractNumberTokens(value = "") {
  const matches = String(value).match(/\b\d+(?:[.,]\d+)?\b/g) || [];
  return new Set(matches.map((item) => String(Number(item.replace(",", ".")))));
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
