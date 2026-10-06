import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(import.meta.dirname, '..');
const temporary = [];
afterEach(() => temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
const run = (command, args, env) => spawnSync(command, args, { cwd: repo, env, encoding: 'utf8', timeout: 15000 });
const text = path => readFileSync(path, 'utf8');
const succeeded = result => assert.equal(result.status, 0, result.stderr + result.stdout);

function fixture(mode = 'caddy') {
  const root = mkdtempSync(join(tmpdir(), 'journal-ops-'));
  temporary.push(root);
  const bin = join(root, 'bin');
  mkdirSync(bin); mkdirSync(join(root, 'runtime')); mkdirSync(join(root, 'backups'));
  if (mode === 'nginx') {
    mkdirSync(join(root, 'certificates'));
    for (const name of ['fullchain.pem', 'privkey.pem']) writeFileSync(join(root, 'certificates', name), 'test-only');
  }
  const config = join(root, 'production.env');
  writeFileSync(config, `DATA_ROOT=${root}\nAPP_VERSION=v1\nPOSTGRES_PASSWORD=${'a'.repeat(64)}\nAPP_ORIGIN=https://travel.elenacc.org\nDOMAIN=travel.elenacc.org\nPROXY_MODE=${mode}\nWEB_PORT=3100\n`);
  writeFileSync(join(root, 'runtime/current-version'), 'v1\n');
  const executable = (name, source) => writeFileSync(join(bin, name), '#!/bin/sh\n' + source, { mode: 0o755 });
  executable('docker', 'printf "%s|%s\\n" "${APP_VERSION:-from-file}" "$*" >> "$MOCK_DOCKER_LOG"\ncase "$*" in *"proxy nginx -t") if [ "${MOCK_FAIL_PROXY:-}" = "$APP_VERSION" ]; then exit 1; fi;; *"ps --status running -q web") printf "web-id\\n";; *"archive-inner.sh backup") if [ "${MOCK_FAIL_ARCHIVE:-}" = 1 ]; then exit 1; fi;; esac\n');
  executable('curl', 'printf "%s|%s\\n" "${APP_VERSION:-from-file}" "$*" >> "$MOCK_CURL_LOG"\nif [ -n "${MOCK_FAIL_HOST:-}" ] && [ "$MOCK_FAIL_HOST" = "$APP_VERSION" ]; then exit 1; fi\n');
  executable('flock', 'exit 0\n');
  executable('chown', 'exit 0\n');
  executable('df', "printf 'Filesystem 1024-blocks Used Available Capacity Mounted\\nmock 10000000 1 9999999 1%% /\\n'\n");
  executable('caddy', 'if [ "${MOCK_FAIL_VALIDATE:-}" = 1 ]; then exit 1; fi\n');
  executable('systemctl', 'printf "%s\\n" "$*" >> "$MOCK_SYSTEMCTL_LOG"\nif [ "${MOCK_FAIL_RELOAD:-}" = 1 ]; then exit 1; fi\n');
  const env = { ...process.env, ENV_FILE: config, JOURNAL_PREPARE_DIR: join(root, 'prepared'), PATH: `${bin}:${process.env.PATH}`, MOCK_DOCKER_LOG: join(root, 'docker.log'), MOCK_CURL_LOG: join(root, 'curl.log'), MOCK_SYSTEMCTL_LOG: join(root, 'systemctl.log') };
  return { root, config, env, script: (name, extra = {}, args = []) => run('bash', [`ops/${name}.sh`, ...args], { ...env, ...extra }) };
}

for (const mode of ['nginx', 'caddy']) {
  test(`${mode} deploy, rollback and failed ingress preserve the release version`, () => {
    const f = fixture(mode);
    succeeded(f.script('deploy', { APP_VERSION: 'v2' }));
    assert.match(text(f.config), /APP_VERSION=v2\n/);
    assert.equal(statSync(f.config).mode & 0o777, 0o600);
    succeeded(f.script('rollback'));
    assert.match(text(f.config), /APP_VERSION=v1\n/);
    const failed = f.script('deploy', { APP_VERSION: 'v3', [mode === 'caddy' ? 'MOCK_FAIL_HOST' : 'MOCK_FAIL_PROXY']: 'v3' });
    assert.notEqual(failed.status, 0);
    assert.match(text(f.config), /APP_VERSION=v1\n/);
    assert.equal(text(join(f.root, 'runtime/current-version')), 'v1\n');
    const log = text(f.env.MOCK_DOCKER_LOG);
    assert.match(log, /build web/); assert.match(log, /build ops/);
    if (mode === 'caddy') {
      assert.match(log, /compose\.vps\.yaml/);
      assert.doesNotMatch(log, /force-recreate proxy|proxy nginx/);
      assert.match(text(f.env.MOCK_CURL_LOG), /http:\/\/127\.0\.0\.1:3100\/api\/health/);
    } else assert.match(log, /proxy nginx -t/);
  });
}

test('Caddy seed and restore restart the app without touching host Caddy or Nginx', () => {
  const f = fixture();
  succeeded(f.script('seed-production'));
  const archive = join(f.root, 'backups/test.tar.zst');
  writeFileSync(archive, 'test-only');
  succeeded(f.script('restore', {}, [archive]));
  const log = text(f.env.MOCK_DOCKER_LOG);
  assert.match(log, /npm run db:seed/);
  assert.match(log, /stop web/);
  assert.doesNotMatch(log, /stop proxy|force-recreate proxy|proxy nginx/);
});

test('invalid proxy modes fail before building or recording a release', () => {
  const f = fixture('unknown');
  assert.notEqual(f.script('deploy').status, 0);
  assert.equal(text(join(f.root, 'runtime/current-version')), 'v1\n');
});

test('backup waits for app recovery and preserves archive failures', () => {
  for (const failed of [false, true]) {
    const f = fixture();
    const result = f.script('backup', failed ? { MOCK_FAIL_ARCHIVE: '1' } : {});
    assert.equal(result.status, failed ? 1 : 0, result.stderr);
    const log = text(f.env.MOCK_DOCKER_LOG);
    assert.ok(log.indexOf('archive-inner.sh backup') < log.indexOf('up -d web'));
    assert.ok(log.indexOf('up -d web') < log.indexOf('exec -T web node'));
    assert.equal(statSync(f.root).isDirectory(), true);
    assert.throws(() => statSync(join(f.root, 'runtime/read-only')), { code: 'ENOENT' });
  }
});

test('production preparation generates private credentials and preserves them on repeat runs', () => {
  const root = mkdtempSync(join(tmpdir(), 'journal-prepare-')); temporary.push(root);
  const config = join(root, 'production.env');
  const output = join(root, 'prepared');
  const env = { ...process.env, ENV_FILE: config, JOURNAL_PREPARE_DIR: output, DOMAIN: 'travel.elenacc.org', DATA_ROOT: '/srv/travel-journal', WEB_PORT: '3100', APP_VERSION: 'v1' };
  succeeded(run('node', ['ops/prepare-vps.mjs'], env));
  const initial = text(config), password = text(join(output, 'admin-password'));
  assert.match(initial, /POSTGRES_PASSWORD=[0-9a-f]{64}\n/);
  assert.equal(statSync(config).mode & 0o777, 0o600);
  assert.equal(statSync(join(output, 'admin-password')).mode & 0o777, 0o600);
  assert.equal(statSync(output).mode & 0o777, 0o700);
  succeeded(run('node', ['ops/prepare-vps.mjs'], env));
  assert.equal(text(config), initial);
  assert.equal(text(join(output, 'admin-password')), password);
  assert.match(text(join(output, 'travel-journal.caddy')), /reverse_proxy 127\.0\.0\.1:3100/);
});

test('Caddy installer preserves existing sites and only replaces its own block', () => {
  const f = fixture();
  const config = join(f.root, 'Caddyfile');
  const initial = 'existing.example.org {\n  respond "existing"\n}\n';
  writeFileSync(config, initial);
  succeeded(f.script('install-caddy', { CADDY_CONFIG: config }));
  assert.ok(text(config).startsWith(initial));
  assert.match(text(config), /https:\/\/travel\.elenacc\.org/);
  succeeded(f.script('install-caddy', { CADDY_CONFIG: config }));
  assert.equal(text(config).split('# BEGIN travel-journal managed site').length, 2);
  assert.equal(text(f.env.MOCK_SYSTEMCTL_LOG).trim(), 'reload caddy');
});

test('Caddy validation or reload failure leaves the original configuration intact', () => {
  for (const failure of ['MOCK_FAIL_VALIDATE', 'MOCK_FAIL_RELOAD']) {
    const f = fixture();
    const config = join(f.root, 'Caddyfile');
    const initial = 'existing.example.org { respond "existing" }\n';
    writeFileSync(config, initial);
    assert.notEqual(f.script('install-caddy', { CADDY_CONFIG: config, [failure]: '1' }).status, 0);
    assert.equal(text(config), initial);
  }
});

test('first-install orchestration stages code, initializes admin once and runs seed and backup', () => {
  const f = fixture();
  const config = join(f.root, 'Caddyfile');
  writeFileSync(config, 'existing.example.org { respond "existing" }\n');
  succeeded(f.script('install-vps', { CADDY_CONFIG: config }));
  const productionEnv = join(f.root, 'app/.env.production');
  assert.equal(text(productionEnv), text(f.config));
  assert.equal(statSync(productionEnv).mode & 0o777, 0o600);
  assert.match(text(config), /https:\/\/travel\.elenacc\.org/);
  const firstLog = text(f.env.MOCK_DOCKER_LOG);
  assert.match(firstLog, /npm run admin:create -- admin/);
  assert.match(firstLog, /npm run db:seed/);
  assert.match(firstLog, /archive-inner\.sh backup/);
  assert.doesNotMatch(firstLog, /force-recreate proxy|proxy nginx/);
  const passwordPath = join(f.root, 'app/.data/deploy/admin-password');
  const originalPassword = text(passwordPath);
  writeFileSync(join(f.root, 'prepared/admin-password'), 'different-staged-password\n');
  succeeded(f.script('install-vps', { CADDY_CONFIG: config }));
  assert.equal(text(passwordPath), originalPassword);
  assert.equal(text(f.env.MOCK_DOCKER_LOG).split('npm run admin:create -- admin').length, 2);
});

test('the VPS Compose configuration exposes only loopback web and keeps PostgreSQL private', () => {
  const f = fixture();
  const result = run('docker', ['compose', '--env-file', f.config, '-f', 'compose.yaml', '-f', 'compose.vps.yaml', 'config', '--format', 'json'], process.env);
  succeeded(result);
  const config = JSON.parse(result.stdout);
  assert.equal(config.services.postgres.ports, undefined);
  assert.deepEqual(Object.keys(config.services.postgres.networks), ['internal']);
  assert.equal(config.networks.internal.internal, true);
  assert.equal(config.services.web.ports.length, 1);
  assert.equal(config.services.web.ports[0].host_ip, '127.0.0.1');
  assert.equal(config.services.web.ports[0].published, '3100');
  assert.equal(config.services.web.ports[0].target, 3000);
  assert.ok(Object.hasOwn(config.services.web.networks, 'outbound'));
  assert.equal(config.services.proxy, undefined);
});
