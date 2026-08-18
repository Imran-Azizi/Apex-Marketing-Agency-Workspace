import test from "node:test";
import assert from "node:assert/strict";
import {
  createHeroSlideSchema,
  updateHeroSlideSchema,
  reorderHeroSlidesSchema,
  clampDurationSeconds,
} from "../../src/modules/hero/service.js";

test("hero schema accepts a valid slide payload", () => {
  const parsed = createHeroSlideSchema.parse({
    title: "تبلیغات ویدیویی حرفه‌ای برای برندهای متمایز",
    description: "از ایده تا تدوین نهایی، با استاندارد سینمایی.",
    imageKey: "images/hero/123-abc.jpg",
    durationSeconds: 5,
    isPublished: true,
  });
  assert.equal(parsed.title.includes("تبلیغات"), true);
  assert.equal(parsed.imageKey, "images/hero/123-abc.jpg");
  assert.equal(parsed.durationSeconds, 5);
});

test("hero schema requires title and image on create", () => {
  const title = createHeroSlideSchema.safeParse({
    title: "ا",
    imageKey: "images/hero/a.jpg",
  });
  assert.equal(title.success, false);

  const image = createHeroSlideSchema.safeParse({
    title: "اسلاید نمونه",
    imageKey: "",
  });
  assert.equal(image.success, false);
});

test("hero duration must be an integer from 1 to 10", () => {
  const ok = createHeroSlideSchema.parse({
    title: "اسلاید نمونه",
    imageKey: "images/hero/a.jpg",
    durationSeconds: 7,
  });
  assert.equal(ok.durationSeconds, 7);

  const tooLow = createHeroSlideSchema.safeParse({
    title: "اسلاید نمونه",
    imageKey: "images/hero/a.jpg",
    durationSeconds: 0,
  });
  assert.equal(tooLow.success, false);

  const tooHigh = createHeroSlideSchema.safeParse({
    title: "اسلاید نمونه",
    imageKey: "images/hero/a.jpg",
    durationSeconds: 11,
  });
  assert.equal(tooHigh.success, false);
});

test("hero update schema allows partial fields", () => {
  const parsed = updateHeroSlideSchema.parse({
    isPublished: false,
    durationSeconds: 3,
  });
  assert.equal(parsed.isPublished, false);
  assert.equal(parsed.durationSeconds, 3);
});

test("clampDurationSeconds maps legacy milliseconds and out-of-range values", () => {
  assert.equal(clampDurationSeconds(5), 5);
  assert.equal(clampDurationSeconds(6000), 6);
  assert.equal(clampDurationSeconds(0), 1);
  assert.equal(clampDurationSeconds(99), 10);
  assert.equal(clampDurationSeconds(null), 5);
});

test("hero reorder schema requires ids", () => {
  const ok = reorderHeroSlidesSchema.parse({ orderedIds: ["a", "b"] });
  assert.deepEqual(ok.orderedIds, ["a", "b"]);
  const bad = reorderHeroSlidesSchema.safeParse({ orderedIds: [] });
  assert.equal(bad.success, false);
});
