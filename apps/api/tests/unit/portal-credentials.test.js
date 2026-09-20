import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptCredential,
  encryptCredential,
  looksLikeCipher,
} from "../../src/utils/credentialVault.js";
import {
  inviteStatus,
  serializePortalInvite,
  serializePortalCredentials,
} from "../../src/modules/crm/portalInvites.js";
import { buildPortalPasswordRecord } from "../../src/modules/portal/credentials.js";

test("encryptCredential stores AES-GCM ciphertext, not plaintext", () => {
  const secret = "Customer!2026xx";
  const cipher = encryptCredential(secret);
  assert.equal(looksLikeCipher(cipher), true);
  assert.equal(cipher.includes(secret), false);
  assert.notEqual(cipher, secret);
});

test("decryptCredential recovers the original portal password", () => {
  const secret = "ApexPortal#Pass9";
  const cipher = encryptCredential(secret);
  assert.equal(decryptCredential(cipher), secret);
});

test("encryptCredential produces unique blobs for the same password", () => {
  const secret = "SamePassword!23";
  const a = encryptCredential(secret);
  const b = encryptCredential(secret);
  assert.notEqual(a, b);
  assert.equal(decryptCredential(a), secret);
  assert.equal(decryptCredential(b), secret);
});

test("tampered ciphertext cannot be decrypted", () => {
  const cipher = encryptCredential("SecretPass!2026");
  const tampered = `${cipher.slice(0, -2)}aa`;
  assert.throws(() => decryptCredential(tampered));
});

test("inviteStatus maps used, revoked, expired, and pending invites", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  assert.equal(
    inviteStatus({ usedAt: now, expiresAt: now, revokedAt: null }, now),
    "REGISTERED",
  );
  assert.equal(
    inviteStatus({ usedAt: null, expiresAt: now, revokedAt: now }, now),
    "REVOKED",
  );
  assert.equal(
    inviteStatus(
      {
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date("2026-08-24T12:00:00.000Z"),
      },
      now,
    ),
    "EXPIRED",
  );
  assert.equal(
    inviteStatus(
      {
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date("2026-08-26T12:00:00.000Z"),
      },
      now,
    ),
    "PENDING",
  );
});

const now = new Date("2026-08-25T12:00:00.000Z");
const baseInvite = {
  id: "inv_1",
  crmCustomerId: "cus_1",
  opportunityId: "opp_1",
  token: "tok_abc",
  whatsappNumber: "93700000001",
  passwordCipher: null,
  createdAt: now,
  expiresAt: new Date("2026-08-26T12:00:00.000Z"),
  usedAt: null,
  revokedAt: null,
  opportunity: {
    crmCustomer: {
      customerCode: "C-1",
      personName: "علی",
      companyName: "شرکت",
    },
  },
  portalAccount: null,
};

test("serializePortalInvite hides password until the customer registers", () => {
  const row = serializePortalInvite(baseInvite, { roleCode: "MANAGER" }, { now });
  assert.equal(row.status, "PENDING");
  assert.equal(row.whatsappNumber, "93700000001");
  assert.equal(row.hasPassword, false);
  assert.equal(row.canRevealPassword, false);
  assert.equal(row.passwordCipher, undefined);
  assert.equal(row.password, undefined);
  assert.match(String(row.registerUrl), /tok_abc/);
});

test("serializePortalInvite prefers the WhatsApp the customer registered with", () => {
  const cipher = encryptCredential("Customer!2026xx");
  const row = serializePortalInvite(
    {
      ...baseInvite,
      usedAt: now,
      passwordCipher: cipher,
      portalAccount: {
        id: "acc_1",
        normalizedWhatsapp: "93711111111",
        passwordCipher: cipher,
      },
    },
    { roleCode: "MANAGER" },
    { now },
  );
  assert.equal(row.status, "REGISTERED");
  assert.equal(row.whatsappNumber, "93711111111");
  assert.equal(row.hasPassword, true);
  assert.equal(row.canRevealPassword, true);
  assert.equal(row.registerUrl, null);
});

test("serializePortalInvite does not let sales reveal the portal password", () => {
  const cipher = encryptCredential("Customer!2026xx");
  const row = serializePortalInvite(
    {
      ...baseInvite,
      usedAt: now,
      passwordCipher: cipher,
    },
    { roleCode: "SALES", permissions: ["crm.invite"] },
    { now },
  );
  assert.equal(row.whatsappNumber, "");
  assert.equal(row.hasPassword, false);
  assert.equal(row.canRevealPassword, false);
});

test("serializePortalCredentials hides login fields until the account exists", () => {
  const row = serializePortalCredentials(
    {
      portalStatus: "INVITED",
      normalizedWhatsapp: "93700000001",
      portalAccount: null,
    },
    { roleCode: "MANAGER" },
  );
  assert.equal(row.exists, false);
  assert.equal(row.isRegistered, false);
  assert.equal(row.whatsappNumber, null);
  assert.equal(row.hasPassword, false);
  assert.equal(row.canRevealPassword, false);
  assert.equal(row.passwordCipher, undefined);
  assert.equal(row.statusLabel, "دعوت ارسال شده");
});

test("serializePortalCredentials hides WhatsApp and password from sales", () => {
  const cipher = encryptCredential("Customer!2026xx");
  const row = serializePortalCredentials(
    {
      portalStatus: "REGISTERED",
      normalizedWhatsapp: "93700000001",
      portalAccount: {
        normalizedWhatsapp: "93711111111",
        passwordCipher: cipher,
        isActive: true,
        registeredAt: now,
        createdAt: now,
        deletedAt: null,
      },
    },
    { roleCode: "SALES", permissions: ["crm.invite", "crm.view"] },
  );
  assert.equal(row.exists, true);
  assert.equal(row.isRegistered, true);
  assert.equal(row.whatsappNumber, null);
  assert.equal(row.hasPassword, false);
  assert.equal(row.canRevealPassword, false);
});

test("serializePortalCredentials binds WhatsApp and reveal flags to that customer", () => {
  const cipher = encryptCredential("Customer!2026xx");
  const row = serializePortalCredentials(
    {
      portalStatus: "REGISTERED",
      normalizedWhatsapp: "93700000001",
      portalAccount: {
        normalizedWhatsapp: "93711111111",
        passwordCipher: cipher,
        isActive: true,
        registeredAt: now,
        createdAt: now,
        deletedAt: null,
      },
    },
    { roleCode: "MANAGER" },
  );
  assert.equal(row.exists, true);
  assert.equal(row.isRegistered, true);
  assert.equal(row.whatsappNumber, "93711111111");
  assert.equal(row.hasPassword, true);
  assert.equal(row.canRevealPassword, true);
  assert.equal(row.password, undefined);
});

test("buildPortalPasswordRecord keeps a login hash and a recoverable copy", async () => {
  const secret = "PortalRecover!26";
  const record = await buildPortalPasswordRecord(secret);
  assert.equal(typeof record.passwordHash, "string");
  assert.notEqual(record.passwordHash, secret);
  assert.equal(looksLikeCipher(record.passwordCipher), true);
  assert.equal(decryptCredential(record.passwordCipher), secret);
});


