// src/lib/taxConfig.js
// Tax configuration by country — verified from official sources (April 2026)
// Each country has: name, tax name, currency, default rate, available rates
// Admin can always override per product — these are defaults/suggestions

export const TAX_BY_COUNTRY = {
  UY: {
    country: 'Uruguay',
    taxName: 'IVA',
    currency: 'UYU',
    currencySymbol: '$',
    defaultRate: 22,
    rates: [
      { value: 22, label: '22% — Tasa general' },
      { value: 10, label: '10% — Tasa mínima (canasta básica)' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  AR: {
    country: 'Argentina',
    taxName: 'IVA',
    currency: 'ARS',
    currencySymbol: '$',
    defaultRate: 21,
    rates: [
      { value: 21,   label: '21% — Tasa general' },
      { value: 10.5, label: '10.5% — Tasa reducida (alimentos, transporte)' },
      { value: 27,   label: '27% — Tasa diferencial (servicios públicos)' },
      { value: 0,    label: '0% — Exento' },
    ],
  },
  PY: {
    country: 'Paraguay',
    taxName: 'IVA',
    currency: 'PYG',
    currencySymbol: '₲',
    defaultRate: 10,
    rates: [
      { value: 10, label: '10% — Tasa general' },
      { value: 5,  label: '5% — Tasa reducida (canasta familiar, agropecuarios, medicamentos)' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  PA: {
    country: 'Panamá',
    taxName: 'ITBMS',
    currency: 'USD',
    currencySymbol: '$',
    defaultRate: 7,
    rates: [
      { value: 7,  label: '7% — Tasa general' },
      { value: 10, label: '10% — Bebidas alcohólicas, hospedaje' },
      { value: 15, label: '15% — Tabaco' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  MX: {
    country: 'México',
    taxName: 'IVA',
    currency: 'MXN',
    currencySymbol: '$',
    defaultRate: 16,
    rates: [
      { value: 16, label: '16% — Tasa general' },
      { value: 8,  label: '8% — Zona fronteriza norte' },
      { value: 0,  label: '0% — Alimentos básicos, medicinas, libros' },
    ],
  },
  CO: {
    country: 'Colombia',
    taxName: 'IVA',
    currency: 'COP',
    currencySymbol: '$',
    defaultRate: 19,
    rates: [
      { value: 19, label: '19% — Tasa general' },
      { value: 5,  label: '5% — Tasa reducida (canasta básica)' },
      { value: 0,  label: '0% — Exento (bienes excluidos)' },
    ],
  },
  CL: {
    country: 'Chile',
    taxName: 'IVA',
    currency: 'CLP',
    currencySymbol: '$',
    defaultRate: 19,
    rates: [
      { value: 19, label: '19% — Tasa general' },
      { value: 0,  label: '0% — Exento (exportaciones)' },
    ],
  },
  PE: {
    country: 'Perú',
    taxName: 'IGV',
    currency: 'PEN',
    currencySymbol: 'S/',
    defaultRate: 18,
    rates: [
      { value: 18, label: '18% — Tasa general (IGV 16% + IPM 2%)' },
      { value: 0,  label: '0% — Exonerado / Inafecto' },
    ],
  },
  CR: {
    country: 'Costa Rica',
    taxName: 'IVA',
    currency: 'CRC',
    currencySymbol: '₡',
    defaultRate: 13,
    rates: [
      { value: 13, label: '13% — Tasa general' },
      { value: 4,  label: '4% — Tasa reducida (salud privada, seguros)' },
      { value: 2,  label: '2% — Canasta básica, medicamentos' },
      { value: 1,  label: '1% — Canasta básica tributaria' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  EC: {
    country: 'Ecuador',
    taxName: 'IVA',
    currency: 'USD',
    currencySymbol: '$',
    defaultRate: 15,
    rates: [
      { value: 15, label: '15% — Tasa general' },
      { value: 5,  label: '5% — Tasa reducida' },
      { value: 0,  label: '0% — Exento (alimentos básicos, medicinas)' },
    ],
  },
  DO: {
    country: 'Rep. Dominicana',
    taxName: 'ITBIS',
    currency: 'DOP',
    currencySymbol: 'RD$',
    defaultRate: 18,
    rates: [
      { value: 18, label: '18% — Tasa general' },
      { value: 16, label: '16% — Tasa reducida (algunos alimentos)' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  BR: {
    country: 'Brasil',
    taxName: 'ICMS',
    currency: 'BRL',
    currencySymbol: 'R$',
    defaultRate: 17,
    rates: [
      { value: 17, label: '17% — Tasa estándar (varía por estado)' },
      { value: 12, label: '12% — Interestatal (sur/sudeste)' },
      { value: 7,  label: '7% — Interestatal (norte/nordeste)' },
      { value: 25, label: '25% — Productos suntuarios' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  SV: {
    country: 'El Salvador',
    taxName: 'IVA',
    currency: 'USD',
    currencySymbol: '$',
    defaultRate: 13,
    rates: [
      { value: 13, label: '13% — Tasa general' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  GT: {
    country: 'Guatemala',
    taxName: 'IVA',
    currency: 'GTQ',
    currencySymbol: 'Q',
    defaultRate: 12,
    rates: [
      { value: 12, label: '12% — Tasa general' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  HN: {
    country: 'Honduras',
    taxName: 'ISV',
    currency: 'HNL',
    currencySymbol: 'L',
    defaultRate: 15,
    rates: [
      { value: 15, label: '15% — Tasa general' },
      { value: 18, label: '18% — Bebidas alcohólicas, tabaco' },
      { value: 0,  label: '0% — Exento (canasta básica)' },
    ],
  },
  BO: {
    country: 'Bolivia',
    taxName: 'IVA',
    currency: 'BOB',
    currencySymbol: 'Bs',
    defaultRate: 13,
    rates: [
      { value: 13, label: '13% — Tasa general' },
      { value: 0,  label: '0% — Exento' },
    ],
  },
  VE: {
    country: 'Venezuela',
    taxName: 'IVA',
    currency: 'VES',
    currencySymbol: 'Bs.',
    defaultRate: 16,
    rates: [
      { value: 16, label: '16% — Tasa general' },
      { value: 8,  label: '8% — Tasa reducida' },
      { value: 0,  label: '0% — Exento (alimentos, medicinas)' },
    ],
  },
  NI: {
    country: 'Nicaragua',
    taxName: 'IVA',
    currency: 'NIO',
    currencySymbol: 'C$',
    defaultRate: 15,
    rates: [
      { value: 15, label: '15% — Tasa general' },
      { value: 0,  label: '0% — Exento (canasta básica)' },
    ],
  },
  // Custom — for any country not listed, admin enters manually
  OTHER: {
    country: 'Otro',
    taxName: 'Impuesto',
    currency: 'USD',
    currencySymbol: '$',
    defaultRate: 0,
    rates: [
      { value: 0, label: 'Sin impuesto — configurá manualmente' },
    ],
  },
};

// Get sorted list of countries for dropdown
export function getCountryOptions() {
  return Object.entries(TAX_BY_COUNTRY)
    .filter(([code]) => code !== 'OTHER')
    .map(([code, config]) => ({ code, name: config.country, taxName: config.taxName, defaultRate: config.defaultRate }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .concat([{ code: 'OTHER', name: 'Otro país', taxName: 'Impuesto', defaultRate: 0 }]);
}

// Get tax config for a country code
export function getTaxConfig(countryCode) {
  return TAX_BY_COUNTRY[countryCode] || TAX_BY_COUNTRY.OTHER;
}

// Get available rates for a country (for product editor dropdown)
export function getTaxRates(countryCode) {
  const config = getTaxConfig(countryCode);
  return config.rates;
}

// Get the default rate for a country
export function getDefaultTaxRate(countryCode) {
  return getTaxConfig(countryCode).defaultRate;
}

// Get the tax name for display (IVA, ITBMS, IGV, ISV, ICMS)
export function getTaxName(countryCode) {
  return getTaxConfig(countryCode).taxName;
}
