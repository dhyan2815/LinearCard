const API_TIMEOUT = 15000; // 15s timeout (dev: backend may restart)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // exponential: 1s, 2s, 4s

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

    // Retry on timeout or network errors; don't retry on 4xx (client errors)
    const isNetworkError = error instanceof TypeError || error?.name === 'AbortError';
    if (isNetworkError && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, attempt + 1);
    }

    // Log actual error for debugging
    console.error(`[API] ${url} (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

export async function apiClient<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = '/' + endpoint.replace(/^\/+/, '');

  let authHeader: Record<string, string> = {};
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match) {
      authHeader['Authorization'] = `Bearer ${decodeURIComponent(match[1])}`;
    }
  }

  const isServer = typeof window === 'undefined';

  let fullUrl: string;
  let baseApiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (isServer) {
    if (!baseApiUrl && process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
      const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
      if (vercelUrl) {
        baseApiUrl = `https://${vercelUrl.replace(/^linearcard(-git)?/, 'linearcard-api$1')}`;
      }
    }
    fullUrl = `${(baseApiUrl || 'http://localhost:3001').replace(/\/+$/, '')}${cleanEndpoint}`;
  } else {
    const hostname = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;

    if (hostname.includes('.vercel.app')) {
      const apiHostname = hostname.replace(/^linearcard(-git)?/, 'linearcard-api$1');
      fullUrl = `${window.location.protocol}//${apiHostname}${cleanEndpoint}`;
    } else if (baseApiUrl && baseApiUrl.startsWith('http')) {
      fullUrl = `${baseApiUrl.replace(/\/+$/, '')}${cleanEndpoint}`;
    } else {
      fullUrl = `${window.location.protocol}//${hostname}:3001${cleanEndpoint}`;
    }
  }

  const fetchOptions: RequestInit = {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
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
      errorMsg = errorData?.error || errorData?.message || errorMsg;
    } catch (e) {}

    // Throw UnauthorizedError for 401 so callers can distinguish auth failures
    if (response.status === 401) {
      throw new UnauthorizedError(`API Error (${response.status}): ${errorMsg}`);
    }

    throw new Error(`API Error (${response.status}): ${errorMsg}`);
  }

  return response.json();
}
