import { NextResponse } from 'next/server';

// Auth guard disabled — all pages freely accessible
export function proxy(request) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
