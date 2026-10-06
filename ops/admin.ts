import 'dotenv/config';
import argon2 from 'argon2';
import { createInterface } from 'node:readline/promises';
import { db } from '../server/db';
import { assertWritable } from '../server/runtime';

async function passwordInput() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) {
    let value = ''; for await (const chunk of process.stdin) value += chunk;
    return value.trimEnd();
  }
  process.stderr.write('密码（至少 12 个字符，输入不会显示）：');
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let value = '';
    const done = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', listener); process.stderr.write('\n'); };
    const listener = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { done(); reject(new Error('已取消')); return; }
        if (char === '\r' || char === '\n') { done(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1); else value += char;
      }
    };
    process.stdin.on('data', listener);
  });
}
try {
  await assertWritable();
  const command = process.argv[2];
  if (!['create', 'reset'].includes(command)) throw new Error('用法：admin.ts create|reset [用户名]');
  let username = process.argv[3] ?? process.env.ADMIN_USERNAME;
  if (!username) {
    const input = createInterface({ input: process.stdin, output: process.stderr });
    username = (await input.question('管理员用户名：')).trim(); input.close();
  }
  if (!username || username.length > 80) throw new Error('用户名应为 1–80 个字符');
  const password = await passwordInput();
  if (password.length < 12 || password.length > 256) throw new Error('密码应为 12–256 个字符');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('journal-admin-cli'))::text`;
    if (command === 'create') {
      if (await tx.adminUser.count()) throw new Error('管理员已存在，请使用 reset 重置密码');
      await tx.adminUser.create({ data: { username, passwordHash } });
    } else {
      const admin = await tx.adminUser.update({ where: { username }, data: { passwordHash, enabled: true } });
      await tx.session.deleteMany({ where: { adminId: admin.id } });
      await tx.loginAttempt.deleteMany({ where: { username } });
    }
  });
  console.log(command === 'create' ? '管理员已创建' : '密码已重置，所有旧会话已撤销');
} catch (error) { console.error(error instanceof Error ? error.message : '操作失败'); process.exitCode = 1; }
finally { await db.$disconnect(); }
