import { describe, expect, it } from 'vitest';
import { newTripStatus } from './tripStatus';

describe('newTripStatus', () => {
  it('starts every driver movement as a draft, even a fully recorded one', () => {
    expect(newTripStatus(true, false)).toBe('draft');
    expect(newTripStatus(true, true)).toBe('draft');
  });
  it('approves an Office or Manager movement that is fully recorded', () => {
    expect(newTripStatus(false, true)).toBe('approved');
  });
  it('makes an Office or Manager movement a draft while the closing readings are missing', () => {
    expect(newTripStatus(false, false)).toBe('draft');
  });
  it('never gives a new movement the old pending status', () => {
    for (const driver of [true, false]) for (const full of [true, false]) expect(newTripStatus(driver, full)).not.toBe('pending');
  });
});
