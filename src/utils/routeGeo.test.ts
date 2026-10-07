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
  it('places Suncity near Siruseri and Thandalam near Kundrathur', () => {
    const suncity = findTown('CONCRETE OEM - SUNCITY')!;
    const siruseri = findTown('SUN X - SIRUSERI')!;
    expect(suncity.name).toBe('Suncity');
    expect(Math.hypot(suncity.lat - siruseri.lat, suncity.lon - siruseri.lon)).toBeLessThan(0.1);
    const thandalam = findTown('PREMIX CONCRETE - THANDALAM')!;
    const kundrathur = findTown('KMR - KUNDRATHUR')!;
    expect(thandalam.name).toBe('Thandalam');
    expect(Math.hypot(thandalam.lat - kundrathur.lat, thandalam.lon - kundrathur.lon)).toBeLessThan(0.1);
  });
  it('places Navalur on the OMR road, near Siruseri', () => {
    const navalur = findTown('BOSON INFRA - NAVALUR')!;
    const siruseri = findTown('SUN X - SIRUSERI')!;
    expect(navalur.name).toBe('Navalur');
    expect(Math.hypot(navalur.lat - siruseri.lat, navalur.lon - siruseri.lon)).toBeLessThan(0.1);
  });
  it('leaves the workshop places for the map to search or the user to place', () => {
    expect(findTown('WORKSHOP STOP')).toBeNull();
    expect(findTown('WORKSHOP START')).toBeNull();
  });
});
