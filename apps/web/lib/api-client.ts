
export async function apiClient<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Ensure exactly one leading slash on endpoint
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
  if (isServer) {
    // On the server, we use the environment variable or fallback to localhost
    const serverApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fullUrl = `${serverApiUrl.replace(/\/+$/, '')}${cleanEndpoint}`;
  } else {
    // In the browser, if an explicit absolute URL is provided, use it
    if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')) {
      fullUrl = `${process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}${cleanEndpoint}`;
    } else {
      // Dynamic fallback: use current hostname but port 3001 for NestJS
      // If hostname is localhost, use 127.0.0.1 to avoid IPv6 issues on Windows
      const hostname = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
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

  // Only include credentials in the browser context
  if (!isServer) {
    fetchOptions.credentials = 'include';
  }

  const response = await fetch(fullUrl, fetchOptions);
  
  if (!response.ok) {
    // Attempt to parse JSON error message if possible
    let errorMsg = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
         errorMsg = errorData.error;
      } else if (errorData && errorData.message) {
         errorMsg = errorData.message;
      }
    } catch(e) {}
    throw new Error(`API Error: ${errorMsg}`);
  }
  
  return response.json();
}
