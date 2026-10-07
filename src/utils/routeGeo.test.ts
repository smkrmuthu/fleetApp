import { describe, expect, it } from 'vitest';
import { findTown } from './routeGeo';

describe('findTown', () => {
  it('matches a town inside a longer place name, ignoring case', () => {
    expect(findTown('Chennai Yard')?.name).toBe('Chennai');
    expect(findTown('SRIPERUMBUDUR ICD')?.name).toBe('Sriperumbudur');
    expect(findTown('Kochi port')?.name).toBe('Cochin');
  });

  it('returns null for a place it does not know', () => {
    expect(findTown('Some Village Godown')).toBeNull();
    expect(findTown('')).toBeNull();
  });
});

describe('areas around Chennai', () => {
  it('finds the area in a "CUSTOMER - AREA" name', () => {
    expect(findTown('PREMIX CONCRETE - VADAPALANI')?.name).toBe('Vadapalani');
    expect(findTown('ULTRATECH - THIRUMUDIVAKKAM')?.name).toBe('Thirumudivakkam');
    expect(findTown('Aarov buildmart - kundrathur')?.name).toBe('Kundrathur');
    expect(findTown('ULTRATECH - MARAIMALAINAGAR')?.name).toBe('Maraimalai Nagar');
    expect(findTown('SS READYMIX - VALLAKOTTAI')?.name).toBe('Vallakkottai');
  });
  it('does not mistake Velappanchavadi for Avadi', () => {
    expect(findTown('DHINA PILE - VELAPANCHAVADI')?.name).toBe('Velappanchavadi');
    expect(findTown('AK ENTERPRISES - AVADI')?.name).toBe('Avadi');
  });
  it('prefers the specific area over "Chennai" in the same text', () => {
    expect(findTown('KMR - Kundrathur, Chennai')?.name).toBe('Kundrathur');
    expect(findTown('Chennai Port')?.name).toBe('Chennai');
  });
  it('leaves names that are ambiguous for the map to search or the user to place', () => {
    expect(findTown('CONCRETE OEM - SUNCITY')).toBeNull();
    expect(findTown('PREMIX CONCRETE - THANDALAM')).toBeNull();
    expect(findTown('BOSON INFRA - NAVALUR')).toBeNull();
    expect(findTown('WORKSHOP STOP')).toBeNull();
  });
});
