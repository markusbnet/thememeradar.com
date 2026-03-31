import { MemoryCache } from '@/lib/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(1000); // 1 second TTL for tests
  });

  it('should store and retrieve values', () => {
    cache.set('key1', { data: 'test' });
    expect(cache.get('key1')).toEqual({ data: 'test' });
  });

  it('should return null for missing keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should expire entries after TTL', async () => {
    cache.set('key1', 'value', 50); // 50ms TTL
    expect(cache.get('key1')).toBe('value');

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(cache.get('key1')).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeNull();
  });

  it('should overwrite existing entries', () => {
    cache.set('key', 'old');
    cache.set('key', 'new');
    expect(cache.get('key')).toBe('new');
  });

  it('should use custom TTL when provided', async () => {
    cache.set('short', 'value', 50);
    cache.set('long', 'value', 500);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(cache.get('short')).toBeNull();
    expect(cache.get('long')).toBe('value');
  });
});
