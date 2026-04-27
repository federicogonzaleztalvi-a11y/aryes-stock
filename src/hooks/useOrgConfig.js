// src/hooks/useOrgConfig.js
// Central hook for multi-country org configuration
// Derives tax, currency, locale, and formatting from brandCfg.tax_country
// All components should use this instead of hardcoding UYU/22%/es-UY

import { useMemo } from 'react';
import { getTaxConfig, getTaxRates } from '../lib/taxConfig.js';

// Country code → locale mapping for number formatting
const LOCALE_MAP = {
  UY: 'es', AR: 'es-AR', MX: 'es-MX', CO: 'es-CO', CL: 'es-CL',
  PE: 'es-PE', EC: 'es-EC', CR: 'es-CR', PA: 'es-PA', PY: 'es-PY',
  BO: 'es-BO', VE: 'es-VE', DO: 'es-DO', SV: 'es-SV', GT: 'es-GT',
  HN: 'es-HN', NI: 'es-NI', BR: 'pt-BR', OTHER: 'es',
};

/**
 * useOrgConfig(brandCfg)
 * 
 * Returns the full org configuration derived from brandCfg.tax_country:
 * - country, countryName, locale
 * - currency, currencySymbol
 * - taxName, defaultTaxRate, taxRates
 * - fmt: { currency(), tax(), taxRate() } — formatting helpers
 * 
 * Falls back to Uruguay defaults if no country is configured.
 * Can be called with brandCfg from useApp() or passed as prop.
 */
export function useOrgConfig(brandCfg) {
  return useMemo(() => {
    const countryCode = brandCfg?.tax_country || 'UY';
    const taxCfg = getTaxConfig(countryCode);
    const rates = getTaxRates(countryCode);
    
    // Admin overrides take precedence over preset defaults
    const defaultRate = brandCfg?.iva_default != null ? brandCfg.iva_default : taxCfg.defaultRate;
    const taxName = brandCfg?.tax_name || taxCfg.taxName;
    const currency = taxCfg.currency;
    const currencySymbol = taxCfg.currencySymbol;
    const locale = LOCALE_MAP[countryCode] || 'es';

    // Formatting helpers — use these instead of constants.js fmt.currency
    const fmt = {
      // Format currency: fmt.currency(1500) → "$ 1.500"
      currency: (n, overrideCurrency) => {
        const sym = overrideCurrency
          ? (overrideCurrency === currency ? currencySymbol : overrideCurrency)
          : currencySymbol;
        const num = Number(n || 0);
        return `${sym} ${num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      },

      // Format currency compact: fmt.currencyCompact(1500) → "$ 1.5k"
      currencyCompact: (n, overrideCurrency) => {
        const sym = overrideCurrency
          ? (overrideCurrency === currency ? currencySymbol : overrideCurrency)
          : currencySymbol;
        const num = Number(n || 0);
        if (num >= 1000000) return `${sym} ${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${sym} ${(num / 1000).toFixed(1)}k`;
        return `${sym} ${num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      },

      // Format tax label: fmt.tax() → "IVA 22%" or "IGV 18%"
      tax: (rate) => `${taxName} ${rate != null ? rate : defaultRate}%`,

      // Format integer with thousands separator
      int: (n) => Math.round(Number(n || 0)).toLocaleString(locale),

      // Calculate tax multiplier: fmt.taxMultiplier() → 1.22
      taxMultiplier: (rate) => 1 + (rate != null ? rate : defaultRate) / 100,

      // Net price from gross: fmt.netPrice(580) → 475 (for 22% IVA)
      netPrice: (gross, rate) => Math.round(Number(gross || 0) / (1 + (rate != null ? rate : defaultRate) / 100)),
    };

    return {
      // Country
      country: countryCode,
      countryName: taxCfg.country,
      locale,

      // Currency
      currency,
      currencySymbol,

      // Tax
      taxName,
      defaultTaxRate: defaultRate,
      taxRates: rates.map(r => r.value),
      taxRatesWithLabels: rates,

      // Formatting
      fmt,
    };
  }, [brandCfg?.tax_country, brandCfg?.iva_default, brandCfg?.tax_name]);
}

/**
 * getOrgConfigStatic(brandCfg)
 * Non-hook version for use outside React components (e.g., utility functions)
 */
export function getOrgConfigStatic(brandCfg) {
  const countryCode = brandCfg?.tax_country || 'UY';
  const taxCfg = getTaxConfig(countryCode);
  const defaultRate = brandCfg?.iva_default != null ? brandCfg.iva_default : taxCfg.defaultRate;
  return {
    country: countryCode,
    currency: taxCfg.currency,
    currencySymbol: taxCfg.currencySymbol,
    taxName: brandCfg?.tax_name || taxCfg.taxName,
    defaultTaxRate: defaultRate,
    locale: LOCALE_MAP[countryCode] || 'es',
  };
}
