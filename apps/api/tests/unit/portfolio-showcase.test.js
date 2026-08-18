import test from "node:test";
import assert from "node:assert/strict";
import {
  createPortfolioItemSchema,
  mixedSelectionSchema,
  createCategorySchema,
  MIXED_SLUG,
  MIXED_LABEL,
  DEFAULT_PORTFOLIO_CATEGORIES,
} from "../../src/modules/portfolio/showcase.js";
import { updatePortfolioSchema } from "../../src/modules/portfolio/service.js";

test("mixed is a dedicated slug, not a seeded content category", () => {
  assert.equal(MIXED_SLUG, "mixed");
  assert.equal(MIXED_LABEL, "کتگوری مختلط");
  assert.equal(DEFAULT_PORTFOLIO_CATEGORIES.length, 6);
  assert.equal(
    DEFAULT_PORTFOLIO_CATEGORIES.some((c) => c.slug === MIXED_SLUG),
    false,
  );
});

test("create portfolio item requires video storage key and title", () => {
  const parsed = createPortfolioItemSchema.parse({
    title: "تبلیغ نوشیدنی",
    storageKey: "videos/portfolio/clip.mp4",
    categoryIds: ["pcat_beverages"],
  });
  assert.equal(parsed.title, "تبلیغ نوشیدنی");
  assert.equal(parsed.storageKey, "videos/portfolio/clip.mp4");
  assert.equal(parsed.status, "PUBLISHED");
  assert.equal(parsed.description, null);

  const missingVideo = createPortfolioItemSchema.safeParse({
    title: "بدون ویدیو",
  });
  assert.equal(missingVideo.success, false);
});

test("update schema allows optional description and category assignment", () => {
  const parsed = updatePortfolioSchema.parse({
    description: "",
    categoryIds: ["pcat_food"],
    status: "UNPUBLISHED",
  });
  assert.equal(parsed.description, null);
  assert.deepEqual(parsed.categoryIds, ["pcat_food"]);
});

test("mixed selection accepts ordered ids including empty curation", () => {
  const empty = mixedSelectionSchema.parse({ orderedIds: [] });
  assert.deepEqual(empty.orderedIds, []);
  const selected = mixedSelectionSchema.parse({
    orderedIds: ["a", "c", "d"],
  });
  assert.deepEqual(selected.orderedIds, ["a", "c", "d"]);
});

test("category create rejects invalid slug", () => {
  const ok = createCategorySchema.parse({ name: "محصولات ویژه" });
  assert.equal(ok.name, "محصولات ویژه");
  const bad = createCategorySchema.safeParse({
    name: "تست",
    slug: "Bad Slug",
  });
  assert.equal(bad.success, false);
});
