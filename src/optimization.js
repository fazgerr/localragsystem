// Query Cache - Sorguları ve sonuçlarını hafızada saklar
// LRU (Least Recently Used) stratejisi ile maksimum 100 sorgu tutulur

export class QueryCache {
  constructor(maxSize = 100, ttlMs = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.times = new Map();
  }

  makeKey(question, history = []) {
    // Soru + geçmiş hashı ile cache key oluştur
    return `${question}|${history.length > 0 ? JSON.stringify(history.slice(-1)) : ''}`;
  }

  get(question, history) {
    const key = this.makeKey(question, history);
    if (!this.cache.has(key)) return null;
    
    // TTL kontrolü
    const time = this.times.get(key);
    if (time && Date.now() - time > this.ttlMs) {
      this.cache.delete(key);
      this.times.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  set(question, history, result) {
    const key = this.makeKey(question, history);
    
    // LRU: eski entries'i sil
    if (this.cache.size >= this.maxSize) {
      const oldest = Array.from(this.times.entries())
        .sort(([,a], [,b]) => a - b)[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
        this.times.delete(oldest[0]);
      }
    }
    
    this.cache.set(key, result);
    this.times.set(key, Date.now());
  }

  clear() {
    this.cache.clear();
    this.times.clear();
  }

  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}

// Response Compression - Payload boyutunu azalt
export function compressResponse(data) {
  if (!data.sources) return data;
  
  const compressed = {
    ...data,
    sources: data.sources.map(s => ({
      docId: s.docId,
      title: s.title,
      category: s.category,
      sourceFile: s.sourceFile,
      score: Math.round(s.score * 100) / 100, // 2 decimal place
      passages: s.passages?.map(p => ({
        passageId: p.passageId,
        excerpt: p.excerpt,
        score: Math.round(p.score * 100) / 100,
      })) || [],
    })) || [],
  };
  
  return compressed;
}

// Rate Limiter - İstek sınırlaması
export class RateLimiter {
  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(clientId) {
    const now = Date.now();
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, []);
    }
    
    const times = this.requests.get(clientId)
      .filter(t => now - t < this.windowMs);
    
    if (times.length >= this.maxRequests) {
      return false;
    }
    
    times.push(now);
    this.requests.set(clientId, times);
    return true;
  }

  reset(clientId) {
    this.requests.delete(clientId);
  }
}

// Performance Monitor - Yanıt sürelerini ölçer
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      queries: [],
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
    };
  }

  record(timeMs) {
    this.metrics.queries.push(timeMs);
    this.metrics.minTime = Math.min(this.metrics.minTime, timeMs);
    this.metrics.maxTime = Math.max(this.metrics.maxTime, timeMs);
    this.metrics.avgTime = 
      this.metrics.queries.reduce((a, b) => a + b, 0) / this.metrics.queries.length;
  }

  stats() {
    return {
      count: this.metrics.queries.length,
      avgMs: Math.round(this.metrics.avgTime),
      minMs: this.metrics.minTime === Infinity ? 0 : this.metrics.minTime,
      maxMs: this.metrics.maxTime,
    };
  }

  clear() {
    this.metrics = {
      queries: [],
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
    };
  }
}
