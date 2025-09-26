import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Log at module eval (should appear once per cold start in Vercel function logs)
// If this never appears, the function is not initializing properly.
console.log('[autocsp:/api/ping] module loaded at', new Date().toISOString());

export async function GET() {
  console.log('[autocsp:/api/ping] GET invoked at', new Date().toISOString());
  return NextResponse.json({ ok: true, route: 'ping', ts: Date.now() });
}
