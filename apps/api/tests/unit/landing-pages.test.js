import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidSlug,
  contentsEqual,
  defaultLandingContent,
  hasPublishableContent,
  isReservedSlug,
  sanitizeLandingContent,
  slugify,
} from "../../src/modules/landing-pages/content.js";

test("slugify produces url-safe unique-friendly slugs", () => {
  assert.equal(slugify("Summer Campaign"), "summer-campaign");
  assert.equal(slugify("  Product Launch!! "), "product-launch");
});

test("reserved slugs are rejected", () => {
  assert.equal(isReservedSlug("login"), true);
  assert.equal(isReservedSlug("portfolio"), true);
  assert.equal(isReservedSlug("summer-campaign"), false);
  assert.equal(assertValidSlug("contact").ok, false);
  assert.equal(assertValidSlug("summer-campaign").ok, true);
});

test("draft content without heading or sections is not publishable", () => {
  const empty = defaultLandingContent("");
  assert.equal(hasPublishableContent(empty), false);
  empty.hero.heading = "کمپین تابستانی";
  assert.equal(hasPublishableContent(empty), true);
});

test("sanitizeLandingContent strips removed html/container elements safely", () => {
  const dirty = {
    hero: {
      heading: "Hi",
      overlayOpacity: 4,
      ctaUrl: "javascript:alert(1)",
    },
    sections: [
      {
        type: "content",
        elements: [
          {
            type: "html",
            content: { html: "<img src=x onerror=alert(1)><p>ok</p>" },
          },
          {
            type: "container",
            content: {},
            children: [{ type: "paragraph", content: { text: "nested" } }],
          },
          { type: "unknown-block", content: {} },
          { type: "heading", content: { text: "عنوان" } },
        ],
      },
    ],
  };
  const clean = sanitizeLandingContent(dirty, { title: "Hi" });
  assert.equal(clean.version, 1);
  assert.equal(clean.hero.overlayOpacity <= 0.9, true);
  assert.equal(clean.hero.ctaUrl.startsWith("javascript"), false);
  assert.equal(
    clean.sections[0].elements.some((el) => el.type === "html"),
    false,
  );
  assert.equal(
    clean.sections[0].elements.some((el) => el.type === "container"),
    false,
  );
  assert.equal(
    clean.sections[0].elements.some(
      (el) => el.type === "paragraph" && el.content.text === "nested",
    ),
    true,
  );
  assert.equal(
    clean.sections[0].elements.some((el) => el.type === "heading"),
    true,
  );
});

test("sanitizeLandingContent strips removed rich-text/newsletter/logo-showcase safely", () => {
  const dirty = {
    hero: { heading: "Hi" },
    sections: [
      {
        type: "content",
        elements: [
          { type: "rich-text", content: { html: "<p>x</p>" } },
          { type: "newsletter-cta", content: { heading: "N" } },
          { type: "logo-showcase", content: { items: [] } },
          { type: "paragraph", content: { text: "keep" } },
        ],
      },
    ],
  };
  const clean = sanitizeLandingContent(dirty, { title: "Hi" });
  assert.equal(
    clean.sections[0].elements.some((el) => el.type === "rich-text"),
    false,
  );
  assert.equal(
    clean.sections[0].elements.some((el) => el.type === "newsletter-cta"),
    false,
  );
  assert.equal(
    clean.sections[0].elements.some((el) => el.type === "logo-showcase"),
    false,
  );
  assert.equal(
    clean.sections[0].elements.some(
      (el) => el.type === "paragraph" && el.content.text === "keep",
    ),
    true,
  );
});

test("sanitizeLandingContent preserves responsive image fields with legacy fallback", () => {
  const dirty = {
    hero: { heading: "Hi" },
    sections: [
      {
        type: "content",
        elements: [
          {
            type: "image",
            content: {
              imageKey: "images/landing/desktop.jpg",
              imageUrl: "https://cdn.example.com/desktop.jpg",
              mobileImageKey: "images/landing/mobile.jpg",
              mobileImageUrl: "https://cdn.example.com/mobile.jpg",
              alt: "بنر",
            },
          },
          {
            type: "image",
            content: {
              imageKey: "images/landing/legacy.jpg",
              imageUrl: "https://cdn.example.com/legacy.jpg",
              alt: "قدیمی",
            },
          },
        ],
      },
    ],
  };
  const clean = sanitizeLandingContent(dirty, { title: "Hi" });
  const [responsive, legacy] = clean.sections[0].elements;
  assert.equal(responsive.type, "image");
  assert.equal(responsive.content.imageKey, "images/landing/desktop.jpg");
  assert.equal(
    responsive.content.mobileImageKey,
    "images/landing/mobile.jpg",
  );
  assert.equal(
    responsive.content.mobileImageUrl,
    "https://cdn.example.com/mobile.jpg",
  );
  assert.equal(legacy.content.imageKey, "images/landing/legacy.jpg");
  assert.equal(legacy.content.mobileImageKey, null);
  assert.equal(legacy.content.mobileImageUrl, "");
});

test("contentsEqual detects unpublished changes", () => {
  const a = defaultLandingContent("A");
  const b = defaultLandingContent("A");
  assert.equal(contentsEqual(a, b), true);
  b.hero.heading = "B";
  assert.equal(contentsEqual(a, b), false);
});
