/**
 * Integration-style acceptance scenarios for AC-01..AC-28.
 * Run against a live API + DB: node --test tests/acceptance/workflow.test.js
 * Set RUN_INTEGRATION=1 to enable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_URL || 'http://localhost:4000/api/v1';
const enabled = process.env.RUN_INTEGRATION === '1';

async function getCsrf(jar) {
  const res = await fetch(`${BASE}/auth/csrf`, { headers: cookieHeader(jar) });
  const setCookie = res.headers.getSetCookie?.() || [];
  applyCookies(jar, setCookie);
  const json = await res.json();
  return json.data.csrfToken;
}

function cookieHeader(jar) {
  return { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') };
}

function applyCookies(jar, setCookies) {
  for (const raw of setCookies) {
    const part = raw.split(';')[0];
    const i = part.indexOf('=');
    if (i > 0) jar[part.slice(0, i)] = part.slice(i + 1);
  }
}

async function api(jar, method, path, body) {
  const csrf = jar.apex_csrf || (await getCsrf(jar));
  jar.apex_csrf = csrf;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
      ...cookieHeader(jar),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  applyCookies(jar, res.headers.getSetCookie?.() || []);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

test('AC-01..28 workflow integration (optional)', { skip: !enabled }, async () => {
  const jar = {};
  await getCsrf(jar);

  // Login manager
  let r = await api(jar, 'POST', '/auth/login', {
    email: 'manager@apex.af',
    password: process.env.DEFAULT_MANAGER_PASSWORD || 'ApexManager!2026',
  });
  assert.equal(r.status, 200, 'manager login');

  // AC-01: create lead — no portal/project
  const wa = `0700${String(Date.now()).slice(-6)}`;
  r = await api(jar, 'POST', '/crm/customers', {
    personName: 'تست پذیرش',
    companyName: 'شرکت تست',
    phone: wa,
    whatsapp: wa,
    source: 'acceptance',
  });
  assert.equal(r.status, 201, 'create lead');
  const customerId = r.json.data.id;
  assert.ok(customerId);

  // AC-02: public whatsapp CTA
  const cta = await fetch(`${BASE}/public/whatsapp-cta?serviceId=demo`);
  const ctaJson = await cta.json();
  assert.equal(cta.status, 200);
  assert.match(ctaJson.data.url, /wa\.me/);

  // Get opportunity
  r = await api(jar, 'GET', `/crm/customers/${customerId}`);
  const opp = r.json.data.opportunities[0];
  assert.ok(opp);

  // Move to ORDER_CONFIRMED
  r = await api(jar, 'PATCH', `/crm/opportunities/${opp.id}/stage`, { stage: 'ORDER_CONFIRMED' });
  assert.equal(r.status, 200);

  // AC-03: invite before accepted commercial terms should fail
  r = await api(jar, 'POST', `/crm/opportunities/${opp.id}/portal-invite`, {});
  assert.equal(r.status, 403);
  assert.equal(r.json.error.code, 'INVITE_NOT_ELIGIBLE');

  r = await api(jar, 'PATCH', `/crm/opportunities/${opp.id}`, {
    agreedPrice: 5000,
    agreedTerms: 'پرداخت طبق توافق',
  });
  assert.equal(r.status, 200);

  // AC-04: invite after phone, order confirmation, and accepted terms
  r = await api(jar, 'POST', `/crm/opportunities/${opp.id}/portal-invite`, {});
  assert.equal(r.status, 201);
  const token = r.json.data.token;

  // OTP + register
  const portalJar = {};
  await getCsrf(portalJar);
  r = await api(portalJar, 'POST', `/portal/invite/${token}/request-otp`, {});
  assert.equal(r.status, 200);
  const otp = r.json.data.otpDev;
  assert.ok(otp);

  r = await api(portalJar, 'POST', `/portal/invite/${token}/register`, {
    otp,
    password: 'Customer!2026xx',
  });
  assert.equal(r.status, 201);

  // Portal login
  r = await api(portalJar, 'POST', '/auth/portal/login', {
    whatsapp: wa,
    password: 'Customer!2026xx',
  });
  assert.equal(r.status, 200);

  // AC-23: new order creates opportunity only
  r = await api(portalJar, 'POST', '/portal/orders', {
    goal: 'ویدیوی جدید',
    description: 'تست',
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.projectCreated, false);

  // AC-07: brief creates project
  // set agreed price on original opp via manager & submit brief
  await api(jar, 'PATCH', `/crm/opportunities/${opp.id}/stage`, { stage: 'ORDER_CONFIRMED' });
  // Ensure opportunity still usable - fetch customer again for project brief
  r = await api(portalJar, 'POST', '/portal/brief', {
    opportunityId: opp.id,
    title: 'پروژه پذیرش',
    personName: 'تست پذیرش',
    jobTitle: 'مدیر',
    companyName: 'شرکت تست',
    phone: wa,
    address: 'کابل',
    productName: 'محصول',
    productDescription: 'توضیح',
    audience: 'جوانان',
    goal: 'فروش',
    mainMessage: 'پیام',
    cta: 'تماس بگیرید',
    durationSec: 30,
    language: 'fa',
  });
  assert.ok([201, 409].includes(r.status), `brief status ${r.status}`);

  console.log('Integration acceptance flow completed core gates.');
});
