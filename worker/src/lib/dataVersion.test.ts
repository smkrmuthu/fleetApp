import { describe, expect, it } from 'vitest';
import { changesData } from './dataVersion';

describe('changesData', () => {
  it('counts a successful save, edit, delete or approval as a change', () => {
    expect(changesData('POST', '/v1/trips', 201)).toBe(true);
    expect(changesData('PATCH', '/v1/trips/abc', 200)).toBe(true);
    expect(changesData('DELETE', '/v1/monthly-expenses/e1', 200)).toBe(true);
    expect(changesData('POST', '/v1/trips/abc/complete', 200)).toBe(true);
    expect(changesData('PATCH', '/v1/settings', 200)).toBe(true);
  });
  it('does not count reads', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) expect(changesData(m, '/v1/trips', 200)).toBe(false);
  });
  it('does not count a request that failed', () => {
    expect(changesData('POST', '/v1/trips', 422)).toBe(false);
    expect(changesData('PATCH', '/v1/trips/abc', 403)).toBe(false);
    expect(changesData('POST', '/v1/trips', 500)).toBe(false);
  });
  it('does not count signing in or a bill scan, which save nothing', () => {
    expect(changesData('POST', '/v1/auth/password', 200)).toBe(false);
    expect(changesData('POST', '/v1/receipts/scan', 200)).toBe(false);
  });
});
