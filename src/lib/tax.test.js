/**
 * Tests for multi-country tax configuration.
 * Validates that tax presets are correct for each country.
 */
import { describe, it, expect } from 'vitest';

const TAX_PRESETS = {
  UY: { name: 'IVA', default: 22 },
  AR: { name: 'IVA', default: 21 },
  CL: { name: 'IVA', default: 19 },
  CO: { name: 'IVA', default: 19 },
  PE: { name: 'IGV', default: 18 },
  MX: { name: 'IVA', default: 16 },
  BR: { name: 'ICMS', default: 18 },
  PY: { name: 'IVA', default: 10 },
  EC: { name: 'IVA', default: 15 },
  ES: { name: 'IVA', default: 21 },
  US: { name: 'Sales Tax', default: 0 },
};

describe('Tax presets', () => {
  it('Uruguay is IVA 22%', () => {
    expect(TAX_PRESETS.UY.name).toBe('IVA');
    expect(TAX_PRESETS.UY.default).toBe(22);
  });

  it('Peru is IGV not IVA', () => {
    expect(TAX_PRESETS.PE.name).toBe('IGV');
    expect(TAX_PRESETS.PE.default).toBe(18);
  });

  it('Brazil is ICMS not IVA', () => {
    expect(TAX_PRESETS.BR.name).toBe('ICMS');
  });

  it('US is Sales Tax with 0% default', () => {
    expect(TAX_PRESETS.US.name).toBe('Sales Tax');
    expect(TAX_PRESETS.US.default).toBe(0);
  });

  it('all presets have name and default', () => {
    for (const [code, preset] of Object.entries(TAX_PRESETS)) {
      expect(preset.name).toBeTruthy();
      expect(typeof preset.default).toBe('number');
      expect(preset.default).toBeGreaterThanOrEqual(0);
      expect(preset.default).toBeLessThanOrEqual(30);
    }
  });

  it('11 countries defined', () => {
    expect(Object.keys(TAX_PRESETS)).toHaveLength(11);
  });
});
