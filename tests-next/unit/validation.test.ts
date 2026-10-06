import { describe, expect, it } from 'vitest';
import { journeyInput, albumInput } from '../../server/validation';
import { imageSignature, safeMediaKey } from '../../server/media';

const input = { slug: 'chengdu', city: '成都', latin: 'CHENGDU', country: '中国', title: '街巷里的散步', description: '', startDate: '2026-10-01', endDate: '2026-10-06', latitude: null, longitude: null, stops: [] };
describe('server validation', () => {
  it('permits empty albums and optional coordinates but rejects invalid dates, routes and unpaired coordinates', () => {
    expect(journeyInput.parse(input).city).toBe('成都');
    for (const change of [{ startDate: '2026-02-30' }, { endDate: '2026-09-30' }, { latitude: 30 }, { longitude: 181 }, { slug: '../admin' }, { stops: [{ name: '公园', date: '2026-10-07', latitude: null, longitude: null }] }]) expect(journeyInput.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it('requires meaningful photo titles, alternative text and bounded focal points', () => {
    expect(albumInput.safeParse({ revision: 1, coverPhotoId: null, photos: [] }).success).toBe(true);
    expect(albumInput.safeParse({ revision: 0, coverPhotoId: null, photos: [] }).success).toBe(false);
  });
  it('uses binary signatures and rejects SVG, HTML and path traversal', () => {
    expect(imageSignature(Buffer.from([137,80,78,71,13,10,26,10]))).toBe('image/png');
    expect(() => imageSignature(Buffer.from('<svg onload="alert(1)"/>'))).toThrow();
    expect(() => imageSignature(Buffer.from('<html>fake image</html>'))).toThrow();
    for (const value of ['../.env', 'journeys/../../x', '/etc/passwd', 'journeys/x/y', 'journeys/%2e%2e/x']) expect(() => safeMediaKey(value)).toThrow();
  });
});
