import { NextResponse } from 'next/server';

// Simple in-memory cache to reduce RPC calls
// Key: JSON-RPC method + params hash, Value: { response, timestamp }
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 second TTL for most calls
const STATIC_CACHE_TTL_MS = 300000; // 5 minutes for static data
const READ_CACHE_TTL_MS = 300000; // 5 minutes for read operations (eth_call, eth_getLogs)

// Rate limiting: track last request time to avoid overwhelming Alchemy
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 100; // 100ms between requests (10 req/sec max)

// Pending requests map to deduplicate concurrent identical requests
const pendingRequests = new Map<string, Promise<unknown>>();

// Methods that return static data and can be cached longer
const STATIC_METHODS = [
  'eth_chainId',
  'net_version',
];

// Methods that can be cached for medium duration (read operations)
const READ_METHODS = [
  'eth_call',
  'eth_getLogs',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
];

// Methods that should not be cached (state-changing or time-sensitive)
const NO_CACHE_METHODS = [
  'eth_sendTransaction',
  'eth_sendRawTransaction',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_getBlockByNumber', // Only when asking for 'pending' or 'latest'
];

function getCacheKey(method: string, params: unknown): string {
  return `${method}:${JSON.stringify(params)}`;
}

function getCacheTTL(method: string): number {
  if (STATIC_METHODS.includes(method)) return STATIC_CACHE_TTL_MS;
  if (READ_METHODS.includes(method)) return READ_CACHE_TTL_MS;
  return CACHE_TTL_MS;
}

function shouldCache(method: string, params: unknown[]): boolean {
  if (NO_CACHE_METHODS.includes(method)) return false;
  // Don't cache eth_getBlockByNumber for 'latest' or 'pending'
  if (method === 'eth_getBlockByNumber' && params?.[0] && 
      (params[0] === 'latest' || params[0] === 'pending')) {
    return false;
  }
  return true;
}

async function makeRpcRequest(rpcUrl: string, method: string, params: unknown, id: number | string): Promise<unknown> {
  // Rate limiting: wait if we're making requests too fast
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: id || Date.now(),
      method,
      params,
    }),
  });

  // Always try to parse the response as JSON first
  const data = await response.json().catch(() => null);
  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { method, params, id } = body;

    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://rpc.sepolia.org';

    if (!rpcUrl) {
      return NextResponse.json({ error: 'RPC URL not configured' }, { status: 500 });
    }

    const cacheKey = getCacheKey(method, params);
    const now = Date.now();

    // Check cache first (for cacheable methods)
    if (shouldCache(method, params || [])) {
      const cached = cache.get(cacheKey);
      if (cached && (now - cached.timestamp) < getCacheTTL(method)) {
        // Return cached response with original id
        const cachedData = cached.data as { id?: unknown; [key: string]: unknown };
        return NextResponse.json({ ...cachedData, id });
      }

      // Check if there's already a pending request for the same data
      if (pendingRequests.has(cacheKey)) {
        const data = await pendingRequests.get(cacheKey);
        const pendingData = data as { id?: unknown; [key: string]: unknown };
        return NextResponse.json({ ...pendingData, id });
      }
    }

    // Make the request (with deduplication)
    const requestPromise = makeRpcRequest(rpcUrl, method, params, id);
    
    if (shouldCache(method, params || [])) {
      pendingRequests.set(cacheKey, requestPromise);
    }

    let data: unknown;
    try {
      data = await requestPromise;
    } finally {
      pendingRequests.delete(cacheKey);
    }

    // Cache successful responses
    if (data && shouldCache(method, params || [])) {
      const rpcData = data as { error?: unknown };
      if (!rpcData.error) {
        cache.set(cacheKey, { data, timestamp: now });
        
        // Clean up old cache entries periodically (every 100 requests)
        if (cache.size > 100) {
          for (const [key, value] of cache.entries()) {
            if (now - value.timestamp > STATIC_CACHE_TTL_MS) {
              cache.delete(key);
            }
          }
        }
      }
    }

    if (data) {
      // Check for empty data errors that might have been cached incorrectly
      const rpcData = data as { result?: string; error?: unknown };
      if (rpcData.result === '0x' && method === 'eth_call') {
        // Empty result from eth_call - don't cache this as it might be a temporary error
        // Clear any existing cache for this key
        cache.delete(cacheKey);
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ 
      jsonrpc: '2.0',
      id: id || Date.now(),
      error: { code: -32000, message: 'Empty response from RPC' }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
