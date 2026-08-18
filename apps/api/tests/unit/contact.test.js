import test from "node:test";
import assert from "node:assert/strict";
import { submitContactSchema } from "../../src/modules/contact/service.js";

test("contact schema accepts a valid payload", () => {
  const parsed = submitContactSchema.parse({
    name: "علی رضایی",
    email: "ali@example.com",
    phone: "0700123456",
    company: "شرکت نمونه",
    subject: "CONSULTATION",
    message: "سلام، برای تولید ویدیو تبلیغاتی مشاوره می‌خواهم.",
  });
  assert.equal(parsed.email, "ali@example.com");
  assert.equal(parsed.subject, "CONSULTATION");
});

test("contact schema rejects invalid email and short message", () => {
  const email = submitContactSchema.safeParse({
    name: "علی",
    email: "not-an-email",
    phone: "0700123456",
    subject: "QUOTE",
    message: "این یک پیام معتبر برای تست است",
  });
  assert.equal(email.success, false);

  const message = submitContactSchema.safeParse({
    name: "علی",
    email: "ali@example.com",
    phone: "0700123456",
    subject: "QUOTE",
    message: "کوتاه",
  });
  assert.equal(message.success, false);
});

test("contact schema rejects invalid phone", () => {
  const parsed = submitContactSchema.safeParse({
    name: "علی رضایی",
    email: "ali@example.com",
    phone: "123",
    subject: "SUPPORT",
    message: "لطفاً درباره پشتیبانی پروژه راهنمایی کنید.",
  });
  assert.equal(parsed.success, false);
});
