const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function apiClient<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Allow passing endpoint with or without leading slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  let authHeader: Record<string, string> = {};
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match) {
      authHeader['Authorization'] = `Bearer ${decodeURIComponent(match[1])}`;
    }
  }

  const response = await fetch(`${API_URL}${cleanEndpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
    credentials: 'include',
  });
  
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
