import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(import.meta.dirname, '..');
const temporary = [];
afterEach(() => temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
const text = path => readFileSync(path, 'utf8');
const common = text(join(repo, 'ops/common.sh'));
const run = (command, args, options = {}) => spawnSync(command, args, { cwd: repo, encoding: 'utf8', timeout: 15000, ...options });
const succeeded = result => assert.equal(result.status, 0, result.stderr + result.stdout);
function temp() {
  const root = mkdtempSync(join(tmpdir(), 'journal-ci-'));
  temporary.push(root);
  return root;
}
function write(root, name, content, mode = 0o644) {
  const path = join(root, name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, { mode });
}
function archive(extra = () => {}) {
  const source = temp();
  for (const name of ['Dockerfile', 'compose.yaml', 'compose.vps.yaml']) write(source, name, 'test-only\n');
  write(source, 'ops/common.sh', common);
  write(source, 'ops/deploy.sh', `#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
lock_operations
[[ "\${MOCK_FAIL_DEPLOY:-}" != 1 ]] || exit 1
printf 'inherited\n' > "$(data_root)/runtime/inherited-lock"
persist_version "$APP_VERSION"
`, 0o755);
  write(source, 'new-source.txt', 'new release\n');
  write(source, '.env.example', 'TEST_ONLY=true\n');
  extra(source);
  succeeded(run('git', ['init', '-q'], { cwd: source }));
  succeeded(run('git', ['add', '.'], { cwd: source }));
  succeeded(run('git', ['-c', 'user.name=CI test', '-c', 'user.email=ci-test@example.invalid', 'commit', '-qm', 'fixture'], { cwd: source }));
  const revision = run('git', ['rev-parse', 'HEAD'], { cwd: source }).stdout.trim();
  const packed = run('git', ['archive', '--format=tar.gz', revision], { cwd: source, encoding: null });
  assert.equal(packed.status, 0);
  const file = join(temp(), 'source.tar.gz');
  writeFileSync(file, packed.stdout);
  return { file, revision, bytes: packed.stdout };
}
function production() {
  const root = temp(), app = join(root, 'app');
  mkdirSync(join(root, 'runtime'));
  write(app, 'ops/common.sh', common);
  write(app, 'old-source.txt', 'old release\n');
  write(app, '.env.production', `DATA_ROOT=${root}\nAPP_VERSION=before-ci\nPOSTGRES_PASSWORD=test-only-credential\nPROXY_MODE=caddy\nWEB_PORT=3100\n`, 0o600);
  write(app, '.data/deploy/admin-password', 'test-only-admin-credential\n', 0o600);
  write(root, 'media/live/keep.txt', 'original image\n');
  write(root, 'postgres/keep.txt', 'original database\n');
  return { root, app, config: join(app, '.env.production'), env: { ...process.env, JOURNAL_CI_ROOT: root } };
}
const payload = a => Buffer.concat([Buffer.from(`deploy ${a.revision}\n`), a.bytes]);

test('Git archive verifies commit metadata and preserves executable modes', () => {
  const a = archive(), destination = join(temp(), 'source');
  succeeded(run('python3', ['ops/ci/extract-source.py', a.file, destination, a.revision]));
  assert.equal(text(join(destination, 'new-source.txt')), 'new release\n');
  assert.equal(statSync(join(destination, 'ops/deploy.sh')).mode & 0o777, 0o755);
  assert.equal(statSync(join(destination, 'new-source.txt')).mode & 0o777, 0o644);
  assert.notEqual(run('python3', ['ops/ci/extract-source.py', a.file, join(temp(), 'source'), '0'.repeat(40)]).status, 0);
});

test('archives reject production credentials, persistent data and symbolic links', () => {
  for (const extra of [
    source => write(source, '.env.production', 'test-only'),
    source => write(source, 'nested/.env.local', 'test-only'),
    source => write(source, '.data/admin-password', 'test-only'),
    source => write(source, 'media/photo.jpg', 'test-only'),
    source => write(source, 'deploy.key', 'test-only'),
    source => symlinkSync('/etc/passwd', join(source, 'outside')),
  ]) {
    const a = archive(extra);
    assert.notEqual(run('python3', ['ops/ci/extract-source.py', a.file, join(temp(), 'source'), a.revision]).status, 0);
  }
});

test('CI source sync shares the deployment lock and keeps production secrets and data', () => {
  const a = archive(), f = production();
  succeeded(run('bash', ['ops/ci/receive-deploy.sh'], { env: f.env, input: payload(a) }));
  assert.equal(existsSync(join(f.app, 'old-source.txt')), false);
  assert.equal(text(join(f.app, 'new-source.txt')), 'new release\n');
  assert.match(text(f.config), new RegExp(`APP_VERSION=ci-${a.revision.slice(0, 12)}\\n`));
  assert.match(text(f.config), /POSTGRES_PASSWORD=test-only-credential/);
  assert.equal(statSync(f.config).mode & 0o777, 0o600);
  assert.equal(text(join(f.app, '.data/deploy/admin-password')), 'test-only-admin-credential\n');
  assert.equal(text(join(f.root, 'media/live/keep.txt')), 'original image\n');
  assert.equal(text(join(f.root, 'postgres/keep.txt')), 'original database\n');
  assert.equal(text(join(f.root, 'runtime/inherited-lock')), 'inherited\n');
  assert.equal(text(join(f.root, 'runtime/last-ci-revision')), a.revision + '\n');
  assert.equal(readdirSync(join(f.root, 'runtime')).some(name => name.startsWith('.ci-deploy-')), false);
});

test('failed CI deployment restores previous source without replacing production credentials', () => {
  const a = archive(), f = production(), initial = text(f.config);
  const result = run('bash', ['ops/ci/receive-deploy.sh'], { env: { ...f.env, MOCK_FAIL_DEPLOY: '1' }, input: payload(a) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /生产源码已恢复/);
  assert.equal(text(join(f.app, 'old-source.txt')), 'old release\n');
  assert.equal(existsSync(join(f.app, 'new-source.txt')), false);
  assert.equal(text(f.config), initial);
  assert.equal(text(join(f.app, '.data/deploy/admin-password')), 'test-only-admin-credential\n');
  assert.equal(existsSync(join(f.root, 'runtime/last-ci-revision')), false);
  assert.equal(readdirSync(join(f.root, 'runtime')).some(name => name.startsWith('.ci-deploy-')), false);
});

test('an active operations lock prevents CI source changes', () => {
  const a = archive(), f = production();
  const result = run('bash', ['-c', 'exec 9>"$JOURNAL_CI_ROOT/runtime/ops.lock"; flock -n 9; bash ops/ci/receive-deploy.sh; result=$?; exit "$result"'], { env: f.env, input: payload(a) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /已有部署或备份操作/);
  assert.equal(text(join(f.app, 'old-source.txt')), 'old release\n');
  assert.equal(existsSync(join(f.app, 'new-source.txt')), false);
});

test('CI rejects invalid commands and oversized transfers before source sync', () => {
  const f = production();
  assert.notEqual(run('bash', ['ops/ci/receive-deploy.sh'], { env: f.env, input: 'deploy master; whoami\n' }).status, 0);
  const result = run('bash', ['ops/ci/receive-deploy.sh'], { env: f.env, input: Buffer.concat([Buffer.from(`deploy ${'a'.repeat(40)}\n`), Buffer.alloc(33554433)]) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /超过 32 MiB/);
  assert.equal(text(join(f.app, 'old-source.txt')), 'old release\n');
});

test('forced SSH entry only permits fixed check/deploy commands and prefixes the input', () => {
  const bin = temp(), captured = join(bin, 'captured');
  write(bin, 'sudo', '#!/bin/sh\ncat > "$MOCK_CAPTURE"\n', 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, MOCK_CAPTURE: captured };
  for (const command of ['uname -a', 'deploy master', `deploy ${'a'.repeat(40)}; whoami`, 'check extra']) {
    assert.notEqual(run('bash', ['ops/ci/ssh-entry.sh'], { env: { ...env, SSH_ORIGINAL_COMMAND: command } }).status, 0);
    assert.equal(existsSync(captured), false);
  }
  succeeded(run('bash', ['ops/ci/ssh-entry.sh'], { env: { ...env, SSH_ORIGINAL_COMMAND: 'check' } }));
  assert.equal(text(captured), 'check\n');
  succeeded(run('bash', ['ops/ci/ssh-entry.sh'], { env: { ...env, SSH_ORIGINAL_COMMAND: `deploy ${'a'.repeat(40)}` }, input: 'test archive bytes' }));
  assert.equal(text(captured), `deploy ${'a'.repeat(40)}\ntest archive bytes`);
});

test('workflow only publishes master, after verification, with pinned actions and host keys', () => {
  const workflow = text(join(repo, '.github/workflows/deploy-master.yml'));
  assert.match(workflow, /branches: \[master\]/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /needs: verify/);
  assert.match(workflow, /github.ref == 'refs\/heads\/master'/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.match(workflow, /git archive --format=tar.gz "\$GITHUB_SHA"/);
  assert.equal([...workflow.matchAll(/uses: actions\/[^@]+@([0-9a-f]{40})/g)].length, 3);
  for (const name of ['VPS_HOST', 'VPS_SSH_PORT', 'VPS_SSH_USER', 'VPS_SSH_KEY', 'VPS_KNOWN_HOSTS']) assert.ok(workflow.includes(`secrets.${name}`));
});
