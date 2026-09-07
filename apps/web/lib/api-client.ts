const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  // Allow passing endpoint with or without leading slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const response = await fetch(`${API_URL}${cleanEndpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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
