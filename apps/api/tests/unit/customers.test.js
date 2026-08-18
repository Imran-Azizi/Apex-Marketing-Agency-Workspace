import test from "node:test";
import assert from "node:assert/strict";
import {
  createCustomerSchema,
  updateCustomerSchema,
  reorderCustomersSchema,
} from "../../src/modules/customers/service.js";

test("customer schema accepts a valid payload", () => {
  const parsed = createCustomerSchema.parse({
    name: "احمد کریمی",
    companyName: "گروه صنعتی آریا",
    description: "همکاری در ساخت کمپین تبلیغاتی برند.",
    imageKey: "images/customers/123-abc.jpg",
    isPublished: true,
  });
  assert.equal(parsed.name, "احمد کریمی");
  assert.equal(parsed.companyName, "گروه صنعتی آریا");
  assert.equal(parsed.imageKey, "images/customers/123-abc.jpg");
  assert.equal(parsed.isPublished, true);
});

test("customer schema requires name, company and image on create", () => {
  const name = createCustomerSchema.safeParse({
    name: "ا",
    companyName: "شرکت نمونه",
    imageKey: "images/customers/a.jpg",
  });
  assert.equal(name.success, false);

  const company = createCustomerSchema.safeParse({
    name: "مشتری نمونه",
    companyName: "ش",
    imageKey: "images/customers/a.jpg",
  });
  assert.equal(company.success, false);

  const image = createCustomerSchema.safeParse({
    name: "مشتری نمونه",
    companyName: "شرکت نمونه",
    imageKey: "",
  });
  assert.equal(image.success, false);
});

test("customer description is limited to 280 characters", () => {
  const tooLong = createCustomerSchema.safeParse({
    name: "مشتری نمونه",
    companyName: "شرکت نمونه",
    imageKey: "images/customers/a.jpg",
    description: "ا".repeat(281),
  });
  assert.equal(tooLong.success, false);

  const ok = createCustomerSchema.parse({
    name: "مشتری نمونه",
    companyName: "شرکت نمونه",
    imageKey: "images/customers/a.jpg",
    description: "ا".repeat(280),
  });
  assert.equal(ok.description.length, 280);
});

test("customer update schema allows partial fields", () => {
  const parsed = updateCustomerSchema.parse({
    isPublished: false,
    companyName: "شرکت به‌روز",
  });
  assert.equal(parsed.isPublished, false);
  assert.equal(parsed.companyName, "شرکت به‌روز");
});

test("customer reorder schema requires ids", () => {
  const ok = reorderCustomersSchema.parse({ orderedIds: ["a", "b"] });
  assert.deepEqual(ok.orderedIds, ["a", "b"]);
  const bad = reorderCustomersSchema.safeParse({ orderedIds: [] });
  assert.equal(bad.success, false);
});
