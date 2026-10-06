import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { cookies, headers } from 'next/headers';
import { db } from './db';
import { AppError } from './errors';
import { assertWritable } from './runtime';

const cookieName = 'journal_session';
const day = 86400000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const secure = () => process.env.COOKIE_SECURE !== 'false';
const cookieOptions = () => ({ httpOnly: true, secure: secure(), sameSite: 'lax' as const, path: '/', maxAge: 7 * 86400 });
let dummyHash: Promise<string>;

export async function assertOrigin(requestHeaders?: Headers) {
  const h = requestHeaders ?? await headers();
  const expected = process.env.APP_ORIGIN;
  if (!expected || h.get('origin') !== new URL(expected).origin) throw new AppError('CSRF', '请求来源无效，请从本站重新打开页面', 403);
}
export async function currentAdmin(token?: string) {
  const value = token ?? (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  const session = await db.session.findUnique({ where: { tokenHash: digest(value) }, include: { admin: true } });
  if (!session || !session.admin.enabled || session.expiresAt.getTime() <= Date.now() || session.lastActiveAt.getTime() <= Date.now() - day) return null;
  // Read-only backups also freeze session activity writes.
  if (session.lastActiveAt.getTime() < Date.now() - 5 * 60000) {
    try { await assertWritable(); await db.session.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } }); } catch { /* session can still be read */ }
  }
  return { id: session.admin.id, username: session.admin.username };
}
export async function requireAdmin(mutation = false) {
  const admin = await currentAdmin();
  if (!admin) throw new AppError('UNAUTHORIZED', '登录已过期，请重新登录；当前表单会保留', 401);
  if (mutation) { await assertOrigin(); await assertWritable(); }
  return admin;
}
export async function login(username: string, password: string) {
  await assertOrigin();
  await assertWritable();
  if (!username || username.length > 80 || password.length > 256) throw new AppError('LOGIN_FAILED', '账号或密码不正确', 401);
  const h = await headers();
  const ip = process.env.TRUST_PROXY === 'true' ? (h.get('x-real-ip') ?? 'unknown').slice(0, 100) : 'direct';
  const token = randomBytes(32).toString('base64url');
  const outcome = await db.$transaction(async tx => {
    // Serialize login attempts across web processes, so parallel failures cannot bypass the limit.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`login:${ip}`}))::text`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`account:${username}`}))::text`;
    const since = new Date(Date.now() - 15 * 60000);
    const count = await tx.loginAttempt.count({ where: { createdAt: { gte: since }, OR: [{ ip }, { username }] } });
    if (count >= 5) return 'limited';
    const admin = await tx.adminUser.findUnique({ where: { username } });
    dummyHash ??= argon2.hash('journal-dummy-password', { type: argon2.argon2id });
    const valid = await argon2.verify(admin?.passwordHash ?? await dummyHash, password);
    if (!admin?.enabled || !valid) {
      await tx.loginAttempt.create({ data: { ip, username } });
      return 'invalid';
    }
    await tx.session.create({ data: { adminId: admin.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 7 * day) } });
    await tx.loginAttempt.deleteMany({ where: { ip, username } });
    await tx.adminEvent.create({ data: { adminId: admin.id, action: 'login', resourceType: 'admin', resourceId: admin.id } });
    return 'ok';
  }, { timeout: 20000 });
  if (outcome === 'limited') throw new AppError('RATE_LIMIT', '尝试次数过多，请在 15 分钟后重试', 429);
  if (outcome !== 'ok') throw new AppError('LOGIN_FAILED', '账号或密码不正确', 401);
  (await cookies()).set(cookieName, token, cookieOptions());
}
export async function logout() {
  await assertOrigin();
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (token) { await assertWritable(); await db.session.deleteMany({ where: { tokenHash: digest(token) } }); }
  cookieStore.set(cookieName, '', { ...cookieOptions(), maxAge: 0 });
}
