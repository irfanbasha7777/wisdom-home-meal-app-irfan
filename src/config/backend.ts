// Permanent Google Sheets Apps Script backend configuration.
// Option A: Set VITE_GOOGLE_SHEETS_URL in Vercel Environment Variables (no code edit needed).
// Option B: Paste your Apps Script Deployment ID (AKfycb...) or full Web App URL below.

export const EMBEDDED_SHEETS_WEB_APP_URL = '';

export function normalizeSheetsUrl(raw?: string): string {
  const value = (raw || '').trim();
  if (!value) return '';
  if (value.startsWith('https://script.google.com/')) {
    return value;
  }
  // Allow pasting just the Apps Script Deployment ID (e.g. AKfycb...)
  if (/^[A-Za-z0-9_-]{20,}$/.test(value)) {
    return `https://script.google.com/macros/s/${value}/exec`;
  }
  return value;
}

export const PERMANENT_SHEETS_URL = normalizeSheetsUrl(
  import.meta.env.VITE_GOOGLE_SHEETS_URL || EMBEDDED_SHEETS_WEB_APP_URL
);
