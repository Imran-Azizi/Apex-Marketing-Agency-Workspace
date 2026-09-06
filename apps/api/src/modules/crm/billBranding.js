/**
 * Shared APEX branding for payment receipt + invoice HTML documents.
 * Logo is inlined as a data URI so print/PDF blobs do not depend on web origin.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LOGO_CANDIDATES = [
  resolve(__dirname, '../../../../web/public/brand/apex-logo.png'),
  resolve(process.cwd(), '../web/public/brand/apex-logo.png'),
  resolve(process.cwd(), 'apps/web/public/brand/apex-logo.png'),
];

let cachedLogoDataUri = null;
let logoResolved = false;

export function getApexLogoDataUri() {
  if (logoResolved) return cachedLogoDataUri;
  logoResolved = true;
  for (const path of LOGO_CANDIDATES) {
    try {
      if (!existsSync(path)) continue;
      const buf = readFileSync(path);
      if (!buf?.length) continue;
      cachedLogoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
      return cachedLogoDataUri;
    } catch {
      /* try next */
    }
  }
  cachedLogoDataUri = null;
  return null;
}

export function buildBillBrandHeaderHtml({ titleBadge }) {
  const esc = escapeHtml;
  const logo = getApexLogoDataUri();
  const mark = logo
    ? `<img class="brand-logo" src="${logo}" alt="APEX" width="48" height="48"/>`
    : `<div class="brand-mark" aria-hidden="true">AP</div>`;

  return `
      <header class="header">
        ${mark}
        <div class="brand-sub">APEX SMART MARKETING</div>
        <div class="title-badge">${esc(titleBadge)}</div>
      </header>`;
}

/**
 * Compact professional footer for both bills.
 * @param {{ phone?: string|null, email?: string|null, website?: string|null }} [company]
 */
export function buildBillFooterHtml(company = {}) {
  const esc = escapeHtml;
  const phone = String(company.phone || '').trim();
  const email = String(company.email || '').trim();
  const website = String(company.website || '').trim();
  const contacts = [phone, email, website].filter(Boolean);

  return `
      <footer class="bill-footer">
        <div class="footer-rule" aria-hidden="true"></div>
        <p class="footer-thanks">با سپاس از اعتماد شما</p>
        <p class="footer-brand">APEX SMART MARKETING</p>
        ${
          contacts.length
            ? `<p class="footer-contact" dir="ltr">${esc(contacts.join('  ·  '))}</p>`
            : ''
        }
      </footer>`;
}

/** Shared CSS fragments for header logo + footer. */
export const BILL_BRAND_CSS = `
    .brand-logo {
      width: 48px;
      height: 48px;
      margin: 0 auto 6px;
      display: block;
      object-fit: contain;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      margin: 0 auto 6px;
      border-radius: 10px;
      border: 1px solid rgba(30,58,95,.2);
      background: rgba(30,58,95,.06);
      color: var(--title-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }
    .bill-footer {
      padding: 12px 16px 16px;
      text-align: center;
    }
    .footer-rule {
      height: 1px;
      margin: 0 auto 12px;
      max-width: 72%;
      background: linear-gradient(90deg, transparent, #d4af37, transparent);
    }
    .footer-thanks {
      font-size: 11px;
      font-weight: 650;
      color: #64748b;
    }
    .footer-brand {
      margin-top: 4px;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #1e3a5f;
    }
    .footer-contact {
      margin-top: 6px;
      font-size: 9px;
      font-weight: 600;
      color: #94a3b8;
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
`;
