import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONTACT_SUBJECT,
  submitContactSchema,
  submitWhatsAppLeadSchema,
  contactService,
} from "../../src/modules/contact/service.js";
import { prisma } from "../../src/db/prisma.js";

test("contact schema accepts a valid payload without subject", () => {
  const parsed = submitContactSchema.parse({
    name: "علی رضایی",
    email: "ali@example.com",
    phone: "+93700123456",
    company: "شرکت نمونه",
    message: "سلام، برای تولید ویدیو تبلیغاتی مشاوره می‌خواهم.",
  });
  assert.equal(parsed.email, "ali@example.com");
  assert.equal(parsed.subject, undefined);
  assert.equal(DEFAULT_CONTACT_SUBJECT, "GENERAL");
});

test("contact schema still accepts legacy subject when provided", () => {
  const parsed = submitContactSchema.parse({
    name: "علی رضایی",
    email: "ali@example.com",
    phone: "0700123456",
    subject: "CONSULTATION",
    message: "سلام، برای تولید ویدیو تبلیغاتی مشاوره می‌خواهم.",
  });
  assert.equal(parsed.subject, "CONSULTATION");
});

test("contact schema rejects invalid email and short message", () => {
  const email = submitContactSchema.safeParse({
    name: "علی",
    email: "not-an-email",
    phone: "+93700123456",
    message: "این یک پیام معتبر برای تست است",
  });
  assert.equal(email.success, false);

  const message = submitContactSchema.safeParse({
    name: "علی",
    email: "ali@example.com",
    phone: "+93700123456",
    message: "کوتاه",
  });
  assert.equal(message.success, false);
});

test("contact schema rejects invalid phone", () => {
  const parsed = submitContactSchema.safeParse({
    name: "علی رضایی",
    email: "ali@example.com",
    phone: "123",
    message: "لطفاً درباره پشتیبانی پروژه راهنمایی کنید.",
  });
  assert.equal(parsed.success, false);
});

test("contact schema rejects non-WhatsApp-valid numbers that only look long enough", () => {
  const parsed = submitContactSchema.safeParse({
    name: "علی رضایی",
    email: "ali@example.com",
    phone: "+1 (453) 981-3641",
    message: "لطفاً درباره پشتیبانی پروژه راهنمایی کنید.",
  });
  assert.equal(parsed.success, false);
});

test("whatsapp lead schema accepts name, whatsapp, company, and job title", () => {
  const parsed = submitWhatsAppLeadSchema.parse({
    name: "احمد کریمی",
    whatsapp: "+93700111222",
    companyName: "شرکت نمونه",
    jobTitle: "مدیر بازاریابی",
  });
  assert.equal(parsed.companyName, "شرکت نمونه");
  assert.equal(parsed.jobTitle, "مدیر بازاریابی");
});

test("whatsapp lead schema rejects incomplete payloads", () => {
  const parsed = submitWhatsAppLeadSchema.safeParse({
    name: "ا",
    whatsapp: "123",
    companyName: "",
    jobTitle: "",
  });
  assert.equal(parsed.success, false);
});

test("contact submit creates a CRM lead with WEBSITE_CONTACT source", async () => {
  const stamp = Date.now();
  const phone = `+9378${String(stamp).slice(-7)}`;
  const email = `lead-flow-${stamp}@example.com`;

  const result = await contactService.submit(
    {
      name: "سرنخ فرم تماس",
      email,
      phone,
      company: "شرکت تست",
      message: "سلام، می‌خواهم پروژه ویدیویی را شروع کنیم لطفاً تماس بگیرید.",
    },
    { ip: "127.0.0.1", get: () => "vitest-agent" },
  );

  assert.ok(result.id);
  assert.ok(result.crmCustomerId);
  assert.equal(result.leadCreated, true);
  assert.equal(result.leadDuplicate, false);

  const lead = await prisma.crmCustomer.findUnique({
    where: { id: result.crmCustomerId },
  });
  const message = await prisma.contactMessage.findUnique({
    where: { id: result.id },
  });

  assert.equal(lead?.source, "WEBSITE_CONTACT");
  assert.equal(lead?.pipelineStage, "NEW_LEAD");
  assert.equal(lead?.personName, "سرنخ فرم تماس");
  assert.equal(lead?.email, email);
  assert.equal(message?.crmCustomerId, lead?.id);
  assert.ok(String(lead?.notes || "").includes("پروژه ویدیویی"));
});

test("contact submit reopens a delivered customer as NEW_LEAD in sales", async () => {
  const stamp = Date.now();
  const phone = `+9379${String(stamp).slice(-7)}`;
  const email = `reopen-flow-${stamp}@example.com`;

  const existing = await prisma.crmCustomer.create({
    data: {
      customerCode: `APEX-T${String(stamp).slice(-5)}`,
      personName: "مشتری تحویل‌شده",
      phone,
      whatsappRaw: phone,
      normalizedWhatsapp: phone.replace(/\D/g, ""),
      phoneCountryIso: "AF",
      email,
      source: "MANUAL",
      pipelineStage: "DELIVERED",
      portalStatus: "NOT_ELIGIBLE",
      convertedAt: new Date(),
      lastContactAt: new Date(Date.now() - 86_400_000),
    },
  });

  const result = await contactService.submit(
    {
      name: "درخواست جدید",
      email: `visitor-${stamp}@example.com`,
      phone,
      message: "سلام دوباره، برای پروژه جدید تماس بگیرید لطفاً.",
    },
    { ip: "127.0.0.1", get: () => "vitest-agent" },
  );

  assert.equal(result.crmCustomerId, existing.id);
  assert.equal(result.leadCreated, true);
  assert.equal(result.leadDuplicate, true);
  assert.equal(result.leadReopened, true);

  const lead = await prisma.crmCustomer.findUnique({
    where: { id: existing.id },
  });
  assert.equal(lead?.pipelineStage, "NEW_LEAD");
  assert.equal(lead?.convertedAt, null);
  assert.equal(lead?.personName, "مشتری تحویل‌شده");

  await prisma.$disconnect();
});
