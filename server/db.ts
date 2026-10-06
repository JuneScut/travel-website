import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalDb = globalThis as unknown as { journalDb?: PrismaClient };
export const db = globalDb.journalDb ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
if (process.env.NODE_ENV !== 'production') globalDb.journalDb = db;
