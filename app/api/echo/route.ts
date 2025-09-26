import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return new Response('echo-ok', { status: 200, headers: { 'content-type': 'text/plain' } });
}
