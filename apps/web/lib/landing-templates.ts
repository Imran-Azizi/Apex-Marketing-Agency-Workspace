import {
  createElement,
  createSection,
  newBlockId,
  type LandingContent,
  type LandingSection,
} from "@/lib/landing-content";

export type SectionTemplateId =
  | "hero"
  | "about"
  | "services"
  | "features"
  | "portfolio"
  | "testimonials"
  | "pricing"
  | "faq"
  | "cta"
  | "contact"
  | "footer"
  | "stats"
  | "team";

export type SectionTemplate = {
  id: SectionTemplateId;
  label: string;
  description: string;
  build: () => LandingSection;
};

function styledHeading(text: string, color = "#111827") {
  const el = createElement("heading");
  el.content.text = text;
  el.styles.color = color;
  el.styles.align = "center";
  el.styles.fontSize = 36;
  return el;
}

function styledParagraph(text: string, color = "#6b7280") {
  const el = createElement("paragraph");
  el.content.text = text;
  el.styles.color = color;
  el.styles.align = "center";
  el.styles.maxWidth = "640px";
  el.styles.width = "100%";
  el.styles.marginBottom = 32;
  return el;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: "hero",
    label: "بخش Hero",
    description: "عنوان بزرگ، توضیحات و دکمه اقدام",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 96;
      section.settings.align = "center";
      section.elements = [
        styledHeading("عنوان اصلی صفحه"),
        styledParagraph(
          "توضیحات کوتاه و جذاب درباره محصول یا خدمات شما. این متن باید مخاطب را ترغیب به اقدام کند.",
        ),
        (() => {
          const btn = createElement("button");
          btn.content.text = "شروع کنید";
          btn.content.url = "#contact";
          btn.styles.align = "center";
          return btn;
        })(),
      ];
      return section;
    },
  },
  {
    id: "about",
    label: "درباره ما",
    description: "معرفی برند با تصویر و متن",
    build: () => {
      const section = createSection("image-text");
      section.settings.paddingY = 80;
      const img = createElement("image");
      img.styles.borderRadius = 20;
      const heading = createElement("heading");
      heading.content.text = "درباره ما";
      heading.content.level = 2;
      heading.styles.align = "right";
      const text = createElement("paragraph");
      text.content.text =
        "داستان برند، مأموریت و ارزش‌های شما را در این بخش به اشتراک بگذارید.";
      text.styles.align = "right";
      section.columns = [[img], [heading, text]];
      return section;
    },
  },
  {
    id: "services",
    label: "خدمات",
    description: "کارت‌های خدمات در سه ستون",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.elements = [
        styledHeading("خدمات ما"),
        styledParagraph("خدمات اصلی خود را به صورت خلاصه معرفی کنید."),
        (() => {
          const cards = createElement("feature-cards");
          cards.content.items = [
            {
              title: "خدمت اول",
              description: "توضیح کوتاه درباره این خدمت.",
              icon: "BriefcaseBusiness",
            },
            {
              title: "خدمت دوم",
              description: "توضیح کوتاه درباره این خدمت.",
              icon: "Camera",
            },
            {
              title: "خدمت سوم",
              description: "توضیح کوتاه درباره این خدمت.",
              icon: "Globe",
            },
          ];
          return cards;
        })(),
      ];
      return section;
    },
  },
  {
    id: "features",
    label: "ویژگی‌ها",
    description: "مزایا و قابلیت‌های کلیدی",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.settings.backgroundColor = "#f9fafb";
      section.elements = [
        styledHeading("چرا ما؟"),
        (() => {
          const cards = createElement("feature-cards");
          cards.content.items = [
            {
              title: "سریع و قابل اعتماد",
              description: "ارائه خدمات با کیفیت و سرعت بالا.",
              icon: "Zap",
            },
            {
              title: "پشتیبانی ۲۴/۷",
              description: "همیشه در کنار شما هستیم.",
              icon: "Shield",
            },
            {
              title: "قیمت مناسب",
              description: "بهترین ارزش در ازای هزینه.",
              icon: "Award",
            },
          ];
          return cards;
        })(),
      ];
      return section;
    },
  },
  {
    id: "portfolio",
    label: "نمونه‌کارها",
    description: "گالری تصاویر پروژه‌ها",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.elements = [
        styledHeading("نمونه‌کارها"),
        styledParagraph("برخی از پروژه‌های اخیر ما"),
        (() => {
          const gallery = createElement("gallery");
          gallery.content.items = [
            { alt: "پروژه ۱" },
            { alt: "پروژه ۲" },
            { alt: "پروژه ۳" },
            { alt: "پروژه ۴" },
          ];
          gallery.content.columns = 2;
          return gallery;
        })(),
      ];
      return section;
    },
  },
  {
    id: "testimonials",
    label: "نظرات مشتریان",
    description: "کارت‌های نظرات و بازخورد",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.settings.backgroundColor = "#f9fafb";
      section.elements = [
        styledHeading("نظرات مشتریان"),
        (() => {
          const cards = createElement("testimonial-cards");
          cards.content.items = [
            {
              quote: "تجربه فوق‌العاده‌ای داشتیم. تیم حرفه‌ای و پاسخگو.",
              author: "علی محمدی",
              role: "مدیرعامل",
              rating: 5,
            },
            {
              quote: "کیفیت کار و زمان‌بندی دقیق، ما را شگفت‌زده کرد.",
              author: "سارا احمدی",
              role: "مدیر بازاریابی",
              rating: 5,
            },
          ];
          return cards;
        })(),
      ];
      return section;
    },
  },
  {
    id: "pricing",
    label: "قیمت‌گذاری",
    description: "پلن‌های قیمتی",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.elements = [
        styledHeading("پلن‌های قیمتی"),
        styledParagraph("پلن مناسب خود را انتخاب کنید"),
        (() => {
          const cards = createElement("pricing-cards");
          cards.content.items = [
            {
              title: "پایه",
              price: "رایگان",
              description: "برای شروع",
              features: ["ویژگی ۱", "ویژگی ۲", "پشتیبانی ایمیل"],
              badge: "",
              url: "#contact",
            },
            {
              title: "حرفه‌ای",
              price: "۹۹۰,۰۰۰ ت",
              description: "محبوب‌ترین",
              features: ["همه ویژگی‌های پایه", "ویژگی ۳", "پشتیبانی ۲۴/۷"],
              badge: "محبوب",
              url: "#contact",
            },
            {
              title: "سازمانی",
              price: "تماس بگیرید",
              description: "برای تیم‌های بزرگ",
              features: ["همه ویژگی‌ها", "مدیر اختصاصی", "SLA"],
              badge: "",
              url: "#contact",
            },
          ];
          return cards;
        })(),
      ];
      return section;
    },
  },
  {
    id: "faq",
    label: "سوالات متداول",
    description: "آکاردئون سوال و جواب",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.elements = [
        styledHeading("سوالات متداول"),
        (() => {
          const faq = createElement("faq");
          faq.content.items = [
            {
              question: "چگونه می‌توانم شروع کنم؟",
              answer: "فرم تماس را پر کنید تا با شما تماس بگیریم.",
            },
            {
              question: "زمان تحویل چقدر است؟",
              answer: "بسته به پروژه، معمولاً ۱ تا ۲ هفته.",
            },
            {
              question: "آیا پشتیبانی دارید؟",
              answer: "بله، پشتیبانی ۲۴/۷ برای همه مشتریان.",
            },
          ];
          return faq;
        })(),
      ];
      return section;
    },
  },
  {
    id: "cta",
    label: "فراخوان اقدام",
    description: "بخش تیره با دکمه اقدام",
    build: () => createSection("cta"),
  },
  {
    id: "contact",
    label: "تماس",
    description: "اطلاعات تماس و واتساپ",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.settings.align = "center";
      section.elements = [
        styledHeading("تماس با ما"),
        styledParagraph("از طریق فرم پایین صفحه یا واتساپ با ما در ارتباط باشید."),
        (() => {
          const wa = createElement("whatsapp-cta");
          wa.content.phone = "989123456789";
          wa.content.message = "سلام، می‌خواهم اطلاعات بیشتری بگیرم.";
          wa.content.text = "پیام در واتساپ";
          return wa;
        })(),
      ];
      return section;
    },
  },
  {
    id: "stats",
    label: "آمار و ارقام",
    description: "شمارنده‌های آماری",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 64;
      section.settings.backgroundColor = "#111827";
      section.elements = [
        (() => {
          const stats = createElement("stats");
          stats.content.items = [
            { value: "۵۰۰+", label: "مشتری راضی" },
            { value: "۱۰۰۰+", label: "پروژه انجام‌شده" },
            { value: "۱۰+", label: "سال تجربه" },
            { value: "۲۴/۷", label: "پشتیبانی" },
          ];
          stats.styles.color = "#ffffff";
          return stats;
        })(),
      ];
      return section;
    },
  },
  {
    id: "team",
    label: "تیم",
    description: "اعضای تیم",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 80;
      section.elements = [
        styledHeading("تیم ما"),
        (() => {
          const team = createElement("team-cards");
          team.content.items = [
            { name: "علی رضایی", role: "مدیرعامل" },
            { name: "مریم کریمی", role: "مدیر فنی" },
            { name: "حسین نوری", role: "طراح" },
          ];
          return team;
        })(),
      ];
      return section;
    },
  },
  {
    id: "footer",
    label: "پاورقی",
    description: "لینک‌های شبکه اجتماعی و کپی‌رایت",
    build: () => {
      const section = createSection("content");
      section.settings.paddingY = 48;
      section.settings.backgroundColor = "#1f2937";
      section.settings.align = "center";
      section.elements = [
        (() => {
          const social = createElement("social-links");
          social.content.items = [
            { platform: "instagram", url: "https://instagram.com" },
            { platform: "telegram", url: "https://t.me" },
            { platform: "linkedin", url: "https://linkedin.com" },
          ];
          return social;
        })(),
        (() => {
          const text = createElement("paragraph");
          text.content.text = "© ۱۴۰۴ تمامی حقوق محفوظ است.";
          text.styles.color = "#9ca3af";
          text.styles.align = "center";
          text.styles.fontSize = 14;
          text.styles.marginTop = 16;
          return text;
        })(),
      ];
      return section;
    },
  },
];

export function buildSectionFromTemplate(id: SectionTemplateId): LandingSection {
  const template = SECTION_TEMPLATES.find((t) => t.id === id);
  if (!template) return createSection("content");
  const section = template.build();
  section.id = newBlockId("section");
  section.label = template.label;
  return section;
}

export function buildFullPageTemplate(): LandingContent {
  return {
    version: 1,
    hero: {
      enabled: true,
      heading: "صفحه فرود حرفه‌ای",
      description: "با این قالب شروع کنید و هر بخش را سفارشی کنید.",
      backgroundImageKey: null,
      backgroundVideoKey: null,
      backgroundVideoPosterKey: null,
      ctaText: "شروع کنید",
      ctaUrl: "#contact",
      ctaOpenInNewTab: false,
      textAlign: "center",
      overlay: true,
      overlayOpacity: 0.45,
      minHeight: "70vh",
      mobileMinHeight: "55vh",
    },
    sections: [
      "features",
      "stats",
      "testimonials",
      "pricing",
      "faq",
      "cta",
    ].map((id) => buildSectionFromTemplate(id as SectionTemplateId)),
  };
}
