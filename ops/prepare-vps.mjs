import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(process.env.ENV_FILE ?? join(repo, '.env.production'));
const output = resolve(process.env.JOURNAL_PREPARE_DIR ?? join(repo, '.data/deploy'));
const renderOnly = process.argv.includes('--render-only');
const parse = content => Object.fromEntries(content.split('\n').flatMap(line => {
  const match = /^\s*([A-Z_]+)=(.*)$/.exec(line);
  return match ? [[match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));

try {
  let content;
  try { content = await readFile(envFile, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT' || renderOnly) throw error;
  }
  const existing = content !== undefined;
  const values = existing ? parse(content) : {
    POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
    APP_VERSION: process.env.APP_VERSION ?? new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
    APP_ORIGIN: `https://${process.env.DOMAIN ?? 'travel.elenacc.org'}`,
    DOMAIN: process.env.DOMAIN ?? 'travel.elenacc.org',
    DATA_ROOT: process.env.DATA_ROOT ?? '/srv/travel-journal',
    PROXY_MODE: 'caddy',
    WEB_PORT: process.env.WEB_PORT ?? '3100',
  };
  if (values.PROXY_MODE !== 'caddy') throw new Error('现有配置不是 Caddy 模式，拒绝覆盖；请检查 PROXY_MODE。');
  const domain = values.DOMAIN ?? '';
  if (domain.length > 253 || !domain.includes('.') || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error('DOMAIN 必须是有效域名。');
  if (values.APP_ORIGIN !== `https://${domain}`) throw new Error('APP_ORIGIN 必须等于 https://DOMAIN。');
  if (!/^[0-9a-f]{64}$/i.test(values.POSTGRES_PASSWORD ?? '')) throw new Error('数据库密码必须是 64 位十六进制字符串。');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(values.APP_VERSION ?? '') || values.APP_VERSION === 'latest') throw new Error('APP_VERSION 必须是固定版本号。');
  if (!values.DATA_ROOT?.startsWith('/') || ['/', '/srv', '/root', '/tmp', '/var', '/var/lib', '/opt', '/home'].includes(resolve(values.DATA_ROOT))) throw new Error('DATA_ROOT 必须是专用绝对路径。');
  if (!/^[1-9]\d{0,4}$/.test(values.WEB_PORT ?? '') || Number(values.WEB_PORT) > 65535) throw new Error('WEB_PORT 无效。');

  if (!existing) {
    await writeFile(envFile, '# Production credentials; do not commit.\n' + Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''), { mode: 0o600, flag: 'wx' });
  }
  await chmod(envFile, 0o600);
  await mkdir(output, { recursive: true, mode: 0o700 });
  await chmod(output, 0o700);
  const template = await readFile(join(repo, 'ops/caddy/site.caddy.template'), 'utf8');
  await writeFile(join(output, 'travel-journal.caddy'), template.replaceAll('__DOMAIN__', domain).replaceAll('__WEB_PORT__', values.WEB_PORT), { mode: 0o600 });
  if (!renderOnly) {
    const passwordPath = join(output, 'admin-password');
    try { await writeFile(passwordPath, randomBytes(24).toString('hex') + '\n', { mode: 0o600, flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await chmod(passwordPath, 0o600);
  }
  console.log(`生产配置已准备：${envFile}（0600，已有密码和版本保持不变）`);
  console.log(`Caddy 配置已生成：${join(output, 'travel-journal.caddy')}`);
  if (!renderOnly) console.log(`管理员初始用户名：admin；密码保存在 ${join(output, 'admin-password')}（尚未创建账号）`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
