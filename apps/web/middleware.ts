import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protects /admin with HTTP Basic auth until real SSO/RBAC is in place.
 * Configure ADMIN_USER and ADMIN_PASSWORD. If they are not set, /admin is
 * disabled entirely in production and open only in local development.
 */
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') return new NextResponse('Not found', { status: 404 });
    return NextResponse.next();
  }

  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(':');
      if (timingSafeEqual(u, user) && timingSafeEqual(rest.join(':'), pass)) return NextResponse.next();
    } catch {}
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="EyeShots Admin", charset="UTF-8"' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const config = { matcher: ['/admin/:path*'] };
