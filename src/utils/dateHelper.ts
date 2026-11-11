/**
 * Utility functions for date parsing and temporary residence expiry calculation
 */

export interface ExpiryEvaluation {
  status: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';
  daysRemaining?: number;
  formattedDate: string;
  badgeText: string;
}

/**
 * Parses date string (dd/mm/yyyy, yyyy-mm-dd, or ddmmyyyy) into Date object
 */
export function parseDateFlexible(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();

  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // yyyy-mm-dd
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // 8 digits ddmmyyyy
  if (/^\d{8}$/.test(clean)) {
    const d = parseInt(clean.substring(0, 2), 10);
    const m = parseInt(clean.substring(2, 4), 10);
    const y = parseInt(clean.substring(4, 8), 10);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Evaluates whether a temporary residence is expired or expiring within 15 days
 * Threshold: 15 days
 */
export function evaluateExpiry(expiryDateStr?: string, status?: string): ExpiryEvaluation {
  if (status !== 'Tạm trú' && (!expiryDateStr || expiryDateStr === 'Vô thời hạn')) {
    return {
      status: 'no_expiry',
      formattedDate: expiryDateStr || 'Vô thời hạn',
      badgeText: 'Thường trú / Không thời hạn',
    };
  }

  if (!expiryDateStr) {
    return {
      status: 'no_expiry',
      formattedDate: 'Chưa có ngày hết hạn',
      badgeText: 'Chưa cập nhật ngày hết hạn',
    };
  }

  const expiryDate = parseDateFlexible(expiryDateStr);
  if (!expiryDate) {
    return {
      status: 'no_expiry',
      formattedDate: expiryDateStr,
      badgeText: expiryDateStr,
    };
  }

  const now = new Date();
  // Normalize to midnight
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

  const diffTime = expiryMidnight.getTime() - nowMidnight.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const dayFormatted = String(expiryDate.getDate()).padStart(2, '0');
  const monthFormatted = String(expiryDate.getMonth() + 1).padStart(2, '0');
  const yearFormatted = expiryDate.getFullYear();
  const formattedDate = `${dayFormatted}/${monthFormatted}/${yearFormatted}`;

  if (daysRemaining < 0) {
    return {
      status: 'expired',
      daysRemaining,
      formattedDate,
      badgeText: `Đã quá hạn ${Math.abs(daysRemaining)} ngày (${formattedDate})`,
    };
  }

  if (daysRemaining <= 15) {
    return {
      status: 'expiring_soon',
      daysRemaining,
      formattedDate,
      badgeText: daysRemaining === 0 
        ? `Hết hạn hôm nay (${formattedDate})` 
        : `Hết hạn trong ${daysRemaining} ngày tới (${formattedDate})`,
    };
  }

  return {
    status: 'valid',
    daysRemaining,
    formattedDate,
    badgeText: `Còn ${daysRemaining} ngày (${formattedDate})`,
  };
}

/**
 * Calculates new expiry date by adding months/years from today or current date
 */
export function calculateExtensionDate(yearsToAdd = 1): string {
  const now = new Date();
  const targetYear = now.getFullYear() + yearsToAdd;
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${targetYear}`;
}
