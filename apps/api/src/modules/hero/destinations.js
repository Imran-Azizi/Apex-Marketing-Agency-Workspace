/**
 * Shared destination catalog for hero slide CTA buttons.
 * Kept in API so Zod validation stays aligned with the Manager UI.
 */

export const HERO_BUTTON_SECTION_DESTINATIONS = Object.freeze([
  { id: "home", label: "صفحه اصلی" },
  { id: "about", label: "درباره ما" },
  { id: "services", label: "خدمات" },
  { id: "portfolio", label: "نمونه‌کارها" },
  { id: "customers", label: "مشتریان ما" },
  { id: "contact", label: "تماس با ما" },
]);

export const HERO_BUTTON_EXTERNAL = "external";

/** @type {[string, ...string[]]} */
export const HERO_BUTTON_DESTINATION_IDS = [
  "home",
  "about",
  "services",
  "portfolio",
  "customers",
  "contact",
  HERO_BUTTON_EXTERNAL,
];

export function isHeroButtonSectionDestination(value) {
  return HERO_BUTTON_SECTION_DESTINATIONS.some((d) => d.id === value);
}

export function normalizeHeroButtonFields(input = {}) {
  const buttonEnabled = input.buttonEnabled === true;
  const buttonText = buttonEnabled
    ? String(input.buttonText || "").trim() || null
    : null;
  const buttonDestination = buttonEnabled
    ? String(input.buttonDestination || "").trim() || null
    : null;
  let buttonUrl = null;
  if (buttonEnabled && buttonDestination === HERO_BUTTON_EXTERNAL) {
    buttonUrl = String(input.buttonUrl || "").trim() || null;
  }
  return { buttonEnabled, buttonText, buttonDestination, buttonUrl };
}
