import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminSession = request.cookies.get('admin_session');

  // 1. Protect Admin UI Routes (/dashboard and /scan)
  // These routes require an active browser session cookie
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/scan')) {
    if (!adminSession || !adminSession.value) {
      // Missing or invalid session, redirect unauthenticated users to the login screen
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Protect Developer API Routes (/api/update-pass and any future v1 APIs)
  // These routes can be accessed either via a session cookie (from the dashboard) or a Bearer token (from external servers)
  if (pathname.startsWith('/api/update-pass') || pathname.startsWith('/api/v1/')) {
    const authHeader = request.headers.get('authorization');
    
    // Check if either admin_session exists OR the header exists and starts with Bearer
    const hasValidHeader = authHeader && authHeader.startsWith('Bearer ');
    const hasAdminSession = adminSession && adminSession.value;

    // Reject the request if neither authentication method is valid
    if (!hasValidHeader && !hasAdminSession) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authentication' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/scan/:path*',
    '/api/update-pass',
    '/api/v1/:path*'
  ],
};
