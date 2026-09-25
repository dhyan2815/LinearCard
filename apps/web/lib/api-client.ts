// In dev the API restarts on every save (nest --watch). A request made during
// that window used to sit on the full 15s timeout and then burn three
// exponential retries — ~22s of a frozen-looking page. Dev fails fast and
// loud instead; production keeps the patient settings.
const IS_DEV = process.env.NODE_ENV !== 'production';
const API_TIMEOUT = IS_DEV ? 30000 : 30000;
const MAX_RETRIES = IS_DEV ? 1 : 3;
const RETRY_DELAY_MS = 1000; // exponential: 1s, 2s, 4s

/** crypto.randomUUID is unavailable on http:// origins in some browsers. */
function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

async function fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Retry on timeout or network errors; don't retry on 4xx (client errors).
    // FE-1: only for safe methods. A timed-out POST may well have been
    // processed server-side, so retrying it could award points 3x.
    //
    // Phase 7.1: a mutating request that carries an Idempotency-Key is safe
    // to retry — the backend interceptor guarantees it executes at most
    // once, and a replay returns the first response rather than repeating
    // the work. That is what makes a timed-out `process-order` recoverable
    // instead of simply lost.
    const method = (options.method || 'GET').toUpperCase();
    const headers = (options.headers || {}) as Record<string, string>;
    const isSafeMethod =
      method === 'GET' || method === 'HEAD' || !!headers['Idempotency-Key'];
    const isNetworkError = error instanceof TypeError || error?.name === 'AbortError';
    if (isSafeMethod && isNetworkError && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, attempt + 1);
    }

    // Log actual error for debugging
    console.error(`[API] ${url} (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}

export async function apiClient<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = '/' + endpoint.replace(/^\/+/, '');
  const isServer = typeof window === 'undefined';

  let fullUrl: string;
  let baseApiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (isServer) {
    if (!baseApiUrl && (process.env.VERCEL_ENV === 'preview' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview')) {
      const vercelUrl = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
      if (vercelUrl) {
        baseApiUrl = `https://${vercelUrl.replace(/^linearcard(-git)?/, 'linearcard-api$1')}`;
      }
    }
    fullUrl = `${(baseApiUrl || 'http://localhost:3001').replace(/\/+$/, '')}${cleanEndpoint}`;
  } else {
    // Same-origin: next.config.mjs rewrites /api/* to the backend. No host
    // rewriting, no ports, no CORS, and the admin_session cookie is always
    // set on the host the page is served from — which is what the old
    // localhost/127.0.0.1 juggling kept getting wrong.
    fullUrl = `/api${cleanEndpoint}`;
  }

  // Phase 7.1 — every mutating request gets an idempotency key unless the
  // caller supplied its own. Generated per call rather than per retry: the
  // whole point is that the retries of one logical request share a key.
  const method = (options.method || 'GET').toUpperCase();
  const needsKey = method !== 'GET' && method !== 'HEAD';
  const suppliedHeaders = (options.headers || {}) as Record<string, string>;

  const fetchOptions: RequestInit = {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(needsKey && !suppliedHeaders['Idempotency-Key']
        ? { 'Idempotency-Key': newIdempotencyKey() }
        : {}),
      ...options.headers,
    },
  };

  if (!isServer) {
    fetchOptions.credentials = 'include';
  }

  const response = await fetchWithRetry(fullUrl, fetchOptions);

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errorData = await response.json();
      errorMsg = errorData?.error || errorData?.message || errorData?.details || errorMsg;
    } catch (e) {}

    // Throw UnauthorizedError for 401 so callers can distinguish auth failures
    if (response.status === 401) {
      throw new UnauthorizedError(`API Error (${response.status}): ${errorMsg}`);
    }

    throw new Error(`API Error (${response.status}): ${errorMsg}`);
  }

  return response.json();
}
