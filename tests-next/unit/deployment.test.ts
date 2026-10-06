import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));

test('deployment and rollback preserve the version used by later maintenance; failed releases keep the old version', () => {
  const root = mkdtempSync(join(tmpdir(), 'journal-deploy-')); temporary.push(root);
  const bin = join(root, 'bin'); mkdirSync(bin);
  mkdirSync(join(root, 'runtime')); mkdirSync(join(root, 'certificates'));
  for (const name of ['fullchain.pem', 'privkey.pem']) writeFileSync(join(root, 'certificates', name), 'test certificate');
  const config = join(root, 'production.env');
  writeFileSync(config, `DATA_ROOT=${root}\nAPP_VERSION=v1\nPOSTGRES_PASSWORD=test-only\n`);
  writeFileSync(join(root, 'runtime/current-version'), 'v1\n');
  const executable = (name: string, source: string) => writeFileSync(join(bin, name), '#!/bin/sh\n' + source, { mode: 0o755 });
  executable('flock', 'exit 0\n');
  executable('df', "printf 'Filesystem 1024-blocks Used Available Capacity Mounted\\nmock 10000000 1 9999999 1%% /\\n'\n");
  executable('docker', 'printf "%s|%s\\n" "${APP_VERSION:-from-file}" "$*" >> "$MOCK_DOCKER_LOG"\ncase "$*" in *"proxy nginx -t") if [ "${MOCK_FAIL_PROXY:-}" = "$APP_VERSION" ]; then exit 1; fi;; esac\n');
  const env = { ...process.env, ENV_FILE: config, PATH: `${bin}:${process.env.PATH}`, MOCK_DOCKER_LOG: join(root, 'docker.log') };
  const run = (script: string, extra = {}) => spawnSync('bash', [`ops/${script}.sh`], { env: { ...env, ...extra }, encoding: 'utf8' });
  const release = run('deploy', { APP_VERSION: 'v2' });
  expect(release.status, release.stderr).toBe(0);
  expect(readFileSync(config, 'utf8')).toContain('APP_VERSION=v2\n');
  expect(statSync(config).mode & 0o777).toBe(0o600);
  expect(readFileSync(join(root, 'runtime/previous-version'), 'utf8')).toBe('v1\n');
  const rollback = run('rollback');
  expect(rollback.status, rollback.stderr).toBe(0);
  expect(readFileSync(config, 'utf8')).toContain('APP_VERSION=v1\n');
  const failed = run('deploy', { APP_VERSION: 'v3', MOCK_FAIL_PROXY: 'v3' });
  expect(failed.status).toBe(1);
  expect(readFileSync(config, 'utf8')).toContain('APP_VERSION=v1\n');
  expect(readFileSync(join(root, 'runtime/current-version'), 'utf8')).toBe('v1\n');
  expect(readFileSync(join(root, 'docker.log'), 'utf8')).toContain('v1|compose');
}, 15000);
