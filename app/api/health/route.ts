import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { db } from '../../../server/db';
import { mediaRoot, runtimeRoot } from '../../../server/runtime';

export const dynamic = 'force-dynamic';
export async function GET() {
  const checks = await Promise.allSettled([db.$queryRaw`SELECT 1`, access(mediaRoot(), constants.R_OK | constants.W_OK), access(runtimeRoot(), constants.R_OK)]);
  const ok = checks.every(check => check.status === 'fulfilled');
  return Response.json({ status: ok ? 'ok' : 'error', database: checks[0].status === 'fulfilled' ? 'ok' : 'error', media: checks[1].status === 'fulfilled' ? 'ok' : 'error', runtime: checks[2].status === 'fulfilled' ? 'ok' : 'error', version: process.env.APP_VERSION ?? 'development' }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
