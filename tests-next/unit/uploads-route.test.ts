import { beforeEach, expect, test, vi } from 'vitest';
import { AppError } from '../../server/errors';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), findJourney: vi.fn(), receiveUpload: vi.fn(), importPhoto: vi.fn(),
  rm: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock('node:fs/promises', () => ({ rm: mocks.rm }));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }));
vi.mock('../../server/auth', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('../../server/db', () => ({ db: { journey: { findUnique: mocks.findJourney } } }));
vi.mock('../../server/media', () => ({ receiveUpload: mocks.receiveUpload, importPhoto: mocks.importPhoto }));
import { POST } from '../../app/api/uploads/route';

const journeyId = '00000000-0000-4000-8000-000000000001';
const request = () => new Request(`https://travel.elenacc.org/api/uploads?journeyId=${journeyId}`, { method: 'POST' });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: 'admin-id' });
  mocks.findJourney.mockResolvedValue({ id: journeyId, deletedAt: null });
  mocks.rm.mockResolvedValue(undefined);
});

test('authentication and origin failures reject uploads before reading the request body', async () => {
  for (const [code, status] of [['UNAUTHORIZED', 401], ['CSRF', 403]] as const) {
    mocks.requireAdmin.mockRejectedValueOnce(new AppError(code, 'denied', status));
    const response = await POST(request());
    expect(response.status).toBe(status);
  }
  expect(mocks.receiveUpload).not.toHaveBeenCalled();
  expect(mocks.importPhoto).not.toHaveBeenCalled();
});

test('deleted journeys cannot accept uploads', async () => {
  mocks.findJourney.mockResolvedValue({ id: journeyId, deletedAt: new Date() });
  expect((await POST(request())).status).toBe(404);
  expect(mocks.receiveUpload).not.toHaveBeenCalled();
});

test('mixed batches preserve successful photos, report failures and remove all temporary files', async () => {
  mocks.receiveUpload.mockResolvedValue([
    { path: '/tmp/upload-good', filename: 'good.webp', mime: 'image/webp' },
    { path: '/tmp/upload-bad', filename: 'bad.png', mime: 'image/png' },
  ]);
  mocks.importPhoto.mockResolvedValueOnce('photo-id').mockRejectedValueOnce(new AppError('INVALID_IMAGE', 'invalid image'));
  const response = await POST(request());
  expect(await response.json()).toEqual({ results: [
    { name: 'good.webp', ok: true, id: 'photo-id' },
    { name: 'bad.png', ok: false, error: 'invalid image' },
  ] });
  expect(mocks.rm).toHaveBeenCalledTimes(2);
  expect(mocks.revalidateTag).toHaveBeenCalledWith('journeys', { expire: 0 });
});
