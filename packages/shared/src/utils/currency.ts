export interface FormatINROptions {
  compact?: boolean;
  showSymbol?: boolean;
  decimals?: number;
}

/**
 * Formats a numeric INR amount into Indian number format (e.g. ₹ 1,50,00,000)
 * or compact format (e.g. ₹ 1.50 Cr, ₹ 45.00 L).
 */
export function formatINR(amount: number, options: FormatINROptions = {}): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return options.showSymbol !== false ? '₹ 0' : '0';
  }

  const { compact = false, showSymbol = true, decimals = 2 } = options;
  const symbol = showSymbol ? '₹ ' : '';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  if (compact) {
    if (absAmount >= 10000000) {
      const cr = absAmount / 10000000;
      const formatted = cr.toFixed(decimals).replace(/\.?0+$/, '');
      return `${isNegative ? '-' : ''}${symbol}${formatted} Cr`;
    }
    if (absAmount >= 100000) {
      const lakh = absAmount / 100000;
      const formatted = lakh.toFixed(decimals).replace(/\.?0+$/, '');
      return `${isNegative ? '-' : ''}${symbol}${formatted} L`;
    }
    if (absAmount >= 1000) {
      const k = absAmount / 1000;
      const formatted = k.toFixed(decimals).replace(/\.?0+$/, '');
      return `${isNegative ? '-' : ''}${symbol}${formatted} K`;
    }
    return `${isNegative ? '-' : ''}${symbol}${absAmount.toFixed(decimals).replace(/\.?0+$/, '')}`;
  }

  // Standard Indian comma separator notation: ##,##,##,###
  const [intPart, decPart] = absAmount.toFixed(decimals).split('.');
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const decFormatted = decPart && parseInt(decPart, 10) > 0 ? `.${decPart.replace(/0+$/, '')}` : '';

  return `${isNegative ? '-' : ''}${symbol}${formattedInt}${decFormatted}`;
}

/**
 * Parses an INR string representation into a raw number.
 * Supports strings like:
 * - "₹ 1.5 Cr", "1.5Cr", "1.5 Crore" -> 15000000
 * - "45 Lakh", "45L", "45 Lac" -> 4500000
 * - "25 K", "25k" -> 25000
 * - "₹ 1,50,000", "150000" -> 150000
 */
export function parseINR(value: string | number): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  if (!value || typeof value !== 'string') {
    return 0;
  }

  const clean = value.trim().toUpperCase();
  const isNegative = clean.startsWith('-');

  // Match crore
  const crMatch = clean.match(/([\d,.]+)\s*(CR|CRORE|CRORES)/i);
  if (crMatch) {
    const num = parseFloat(crMatch[1].replace(/,/g, ''));
    const result = Math.round(num * 10000000);
    return isNegative ? -result : result;
  }

  // Match lakh
  const lakhMatch = clean.match(/([\d,.]+)\s*(L|LAC|LACS|LAKH|LAKHS)/i);
  if (lakhMatch) {
    const num = parseFloat(lakhMatch[1].replace(/,/g, ''));
    const result = Math.round(num * 100000);
    return isNegative ? -result : result;
  }

  // Match thousand (k)
  const kMatch = clean.match(/([\d,.]+)\s*(K|THOUSAND)/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, ''));
    const result = Math.round(num * 1000);
    return isNegative ? -result : result;
  }

  // Standard numeric string with possible currency symbols and commas
  const sanitized = clean.replace(/[₹\s,RS.]/g, (match, offset) => {
    // Preserve decimal point
    if (match === '.') return '.';
    return '';
  });

  const parsed = parseFloat(sanitized);
  if (isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

/**
 * Converts Razorpay/Stripe integer paise to Rupees (e.g. 10000 paise -> 100 rupees).
 */
export function paiseToRupees(paise: number): number {
  if (isNaN(paise) || !paise) return 0;
  return paise / 100;
}

/**
 * Converts Rupees to integer paise for payment gateways (e.g. 100 rupees -> 10000 paise).
 */
export function rupeesToPaise(rupees: number): number {
  if (isNaN(rupees) || !rupees) return 0;
  return Math.round(rupees * 100);
}

/**
 * Formats square footage area with comma separation.
 */
export function formatAreaSqFt(area: number): string {
  if (isNaN(area) || area === null || area === undefined) return '0 sq.ft.';
  const [intPart, decPart] = area.toFixed(2).split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decFormatted = decPart && parseInt(decPart, 10) > 0 ? `.${decPart.replace(/0+$/, '')}` : '';
  return `${formatted}${decFormatted} sq.ft.`;
}
