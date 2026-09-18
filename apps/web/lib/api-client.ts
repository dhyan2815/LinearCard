
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

  // Resolve base API URL dynamically for Vercel Previews (Server-side & statically defined Client-side)
  let baseApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseApiUrl && process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && process.env.NEXT_PUBLIC_VERCEL_URL) {
    // e.g. linearcard-git-feat-abc-team.vercel.app -> linearcard-api-git-feat-abc-team.vercel.app
    baseApiUrl = `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/^linearcard(-git)?/, 'linearcard-api$1')}`;
  }

  if (isServer) {
    // On the server, we use the environment variable, dynamic preview URL, or fallback to localhost
    fullUrl = `${(baseApiUrl || 'http://localhost:3001').replace(/\/+$/, '')}${cleanEndpoint}`;
  } else {
    // In the browser, if an explicit absolute URL is provided, use it
    if (baseApiUrl && baseApiUrl.startsWith('http')) {
      fullUrl = `${baseApiUrl.replace(/\/+$/, '')}${cleanEndpoint}`;
    } else {
      // Dynamic fallback based on the current window location
      const hostname = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
      
      // If we are unexpectedly in a preview browser environment without the env var, fallback to hostname rewriting
      if (hostname.includes('.vercel.app')) {
        const apiHostname = hostname.replace(/^linearcard(-git)?/, 'linearcard-api$1');
        fullUrl = `${window.location.protocol}//${apiHostname}${cleanEndpoint}`;
      } else {
        fullUrl = `${window.location.protocol}//${hostname}:3001${cleanEndpoint}`;
      }
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
