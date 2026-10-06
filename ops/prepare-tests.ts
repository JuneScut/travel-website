import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import argon2 from 'argon2';
import sharp from 'sharp';
import { db } from '../server/db';
import { initStorage } from '../server/runtime';

if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/journal_test' || process.env.MEDIA_ROOT !== '.data/media-test') throw new Error('测试必须使用专用 journal_test 数据库和 .data/media-test');
try {
  await db.album.updateMany({ data: { coverPhotoId: null } });
  await db.photo.deleteMany(); await db.journey.deleteMany(); await db.adminUser.deleteMany(); await db.adminEvent.deleteMany(); await db.loginAttempt.deleteMany();
  const password = randomBytes(24).toString('base64url');
  await db.adminUser.create({ data: { username: 'journal-test-admin', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
  await rm('.data/media-test', { recursive: true, force: true });
  await initStorage(); await mkdir('.data', { recursive: true });
  await writeFile('.data/test-credentials.json', JSON.stringify({ username: 'journal-test-admin', password }), { mode: 0o600 });
  await sharp({ create: { width: 120, height: 180, channels: 3, background: '#ddef7d' } }).png().toFile('.data/e2e-photo.png');
} finally { await db.$disconnect(); }
