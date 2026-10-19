/**
 * Tiny in-process LRU for CBETA rewrite cache (question+history → searchZh).
 * Size comes from caller (env CBETA_REWRITE_CACHE_SIZE).
 */
export class LruCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // refresh recency
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    if (this.maxEntries <= 0) return;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}
