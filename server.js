const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const { exec } = require("node:child_process");
const {
  readJson,
  writeJson,
  withLock,
  ensureBackupDir,
  createTimestampSlug
} = require("./lib/store");
const {
  clone,
  sanitizeText,
  escapeHtml,
  sanitizeStringArray,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeSlug,
  createFallbackId,
  buildInitials
} = require("./lib/text");
const { requestJson } = require("./lib/http");
const { createClientProfileId, normalizePhoneDigits, phonesMatch } = require("./lib/client");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PIN = process.env.ADMIN_PIN;
if (!ADMIN_PIN) {
  process.stderr.write("[FATAL] ADMIN_PIN is required. Copy .env.example to .env and set it.\n");
  process.exit(1);
}
const STAFF_PIN = process.env.STAFF_PIN || null; // optional — staff limited access
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const BACKUP_DIR = path.join(ROOT_DIR, "backups");
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads", "specialists");
const BLOG_UPLOADS_DIR = path.join(ROOT_DIR, "uploads", "blog");
const GALLERY_UPLOADS_DIR = path.join(ROOT_DIR, "uploads", "gallery");
const CREDENTIALS_UPLOADS_DIR = path.join(ROOT_DIR, "uploads", "credentials");
const MATERIALS_UPLOADS_DIR = path.join(ROOT_DIR, "uploads", "materials");
const SIGNATURES_UPLOADS_DIR = path.join(ROOT_DIR, "uploads", "signatures");
const ADMIN_SESSION_COOKIE_NAME = "mateev_admin_session";
const ADMIN_SESSION_TTL_HOURS = Math.max(1, Number(process.env.ADMIN_SESSION_TTL_HOURS) || 12);
const ADMIN_SESSION_TTL_MS = ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000;
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto.createHash("sha256").update(`${ADMIN_PIN}:${ROOT_DIR}`).digest("hex");
const ADMIN_PIN_FINGERPRINT = crypto.createHash("sha256").update(ADMIN_PIN).digest("hex").slice(0, 16);
const FORM_TOKEN_TTL_HOURS = Math.max(1, Number(process.env.FORM_TOKEN_TTL_HOURS) || 12);
const FORM_TOKEN_TTL_MS = FORM_TOKEN_TTL_HOURS * 60 * 60 * 1000;
const FORM_TOKEN_SECRET = process.env.FORM_TOKEN_SECRET || ADMIN_SESSION_SECRET;
const FORM_MIN_SUBMIT_MS = Math.max(1500, Number(process.env.FORM_MIN_SUBMIT_MS) || 4000);
const FORM_MAX_AGE_MS = Math.max(FORM_MIN_SUBMIT_MS * 2, Number(process.env.FORM_MAX_AGE_MS) || 12 * 60 * 60 * 1000);
const BOOKING_RATE_LIMIT = Math.max(1, Number(process.env.BOOKING_RATE_LIMIT) || 6);
const BOOKING_RATE_WINDOW_MS = Math.max(60_000, Number(process.env.BOOKING_RATE_WINDOW_MS) || 10 * 60 * 1000);
const ADMIN_LOGIN_RATE_LIMIT = Math.max(1, Number(process.env.ADMIN_LOGIN_RATE_LIMIT) || 8);
const ADMIN_LOGIN_RATE_WINDOW_MS =
  Math.max(60_000, Number(process.env.ADMIN_LOGIN_RATE_WINDOW_MS) || 15 * 60 * 1000);
const TELEGRAM_BOT_TOKEN = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
const TELEGRAM_CHAT_ID = sanitizeEnv(process.env.TELEGRAM_CHAT_ID);
const RESEND_API_KEY = sanitizeEnv(process.env.RESEND_API_KEY);
const EMAIL_FROM = sanitizeEnv(process.env.EMAIL_FROM);
const EMAIL_REPLY_TO = sanitizeEnv(process.env.EMAIL_REPLY_TO);
const EMAIL_NOTIFICATION_RECIPIENTS = splitCommaList(process.env.EMAIL_NOTIFICATIONS_TO);
const COOKIE_FORCE_SECURE = process.env.COOKIE_SECURE === "true";
const CANCEL_CUTOFF_HOURS = Math.max(0, Number(process.env.CANCEL_CUTOFF_HOURS) || 2);
const SITE_URL = sanitizeEnv(process.env.SITE_URL).replace(/\/$/, "");
const GITHUB_WEBHOOK_SECRET = sanitizeEnv(process.env.GITHUB_WEBHOOK_SECRET);
// AI-ресепшн (Claude). Без ключа фича мягко выключена.
const ANTHROPIC_API_KEY = sanitizeEnv(process.env.ANTHROPIC_API_KEY);
const AI_MODEL = sanitizeEnv(process.env.AI_MODEL) || "claude-haiku-4-5-20251001";
// Платформа обучения (Anatomia): выдача доступа ученику при подтверждении заявки.
const PLATFORM_WEBHOOK_URL = sanitizeEnv(process.env.PLATFORM_WEBHOOK_URL).replace(/\/$/, "");
const PLATFORM_WEBHOOK_SECRET = sanitizeEnv(process.env.PLATFORM_WEBHOOK_SECRET);
const rateLimitBuckets = new Map();

const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/admin": "admin.html",
  "/admin.html": "admin.html",
  "/cancel": "cancel.html",
  "/cancel.html": "cancel.html",
  "/success": "success.html",
  "/success.html": "success.html",
  "/school-success": "school-success.html",
  "/school-success.html": "school-success.html",
  "/og-image.jpg": "og-image.jpg",
  "/og-image.svg": "og-image.svg",
  "/favicon.svg": "favicon.svg",
  "/founder.png": "founder.png",
  "/client": "client.html",
  "/client.html": "client.html",
  "/master": "master.html",
  "/master.html": "master.html",
  "/card": "card.html",
  "/card.html": "card.html",
  "/denis.png": "denis.png",
  "/diploma-bg.png": "diploma-bg.png",
  "/mateev_logo.png": "mateev_logo.png",
  "/mateev_logo.jpg": "mateev_logo.jpg",
  "/school": "school.html",
  "/school.html": "school.html",
  "/school.js": "school.js",
  "/styles.css": "styles.css",
  "/script.js": "script.js",
  "/admin.js": "admin.js",
  "/certificate": "certificate.html",
  "/certificate.html": "certificate.html",
  "/diploma": "diploma.html",
  "/diploma.html": "diploma.html",
  "/manifest.json": "manifest.json",
  "/manifest-admin.json": "manifest-admin.json",
  "/service-worker.js": "service-worker.js",
  "/body-diagram.jpg": "body-diagram.jpg",
  // Методички и презентации курсов (materials/*.html)
  "/materials/seminar-01": "materials/seminar-01-shvz-zhivot-grud-lico.html",
  "/materials/integrativnyy-massazh": "materials/integrativnyy-massazh.html",
  "/materials/integrativnyy-massazh.html": "materials/integrativnyy-massazh.html",
  "/materials/integrativnyy-massazh-programma": "materials/integrativnyy-massazh-programma.html",
  "/materials/integrativnyy-massazh-programma.html": "materials/integrativnyy-massazh-programma.html"
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

const BOOKING_STATUSES = ["new", "confirmed", "completed", "cancelled"];
const DEFAULT_WORK_HOURS = {
  start: "09:00",
  end: "20:00"
};
const DEFAULT_BREAKS = [
  {
    start: "13:00",
    end: "14:00",
    label: "Перерыв"
  }
];
const SLOT_STEP_MINUTES = 30;
const DEFAULT_SITE_CONTENT = {
  seo: {
    title: "Mateev Spa Studio | Массаж и онлайн-запись",
    description:
      "Mateev Spa Studio — массаж и телесная терапия в Кишиневе. Онлайн-запись, комфортная атмосфера и программы для восстановления, расслабления и легкости в теле."
  },
  brand: {
    name: "Mateev Spa Studio",
    eyebrow: "Студия массажа в Кишиневе",
    tagline: "Массаж и телесная терапия для восстановления и глубокого отдыха",
    city: "Кишинев",
    address: "бул. Штефан чел Маре, 145",
    phone: "+373 69 555 210",
    email: "hello@mateevspa.md",
    telegram: "@mateevspa",
    instagram: "_mateevspa_",
    hours: "Пн-Сб 09:00-20:00, Вс 10:00-17:00",
    currency: "MDL"
  },
  navigation: {
    overview: "Почему мы",
    services: "Процедуры",
    specialists: "Специалисты",
    booking: "Запись"
  },
  hero: {
    kicker: "Пространство восстановления и заботы о теле",
    title:
      "Массаж и телесная терапия в Кишиневе, чтобы выдохнуть, восстановиться и вернуться в ресурс",
    subtitle:
      "Выберите программу под свой запрос: глубокое расслабление, восстановление спины, лимфодренаж или интенсивную проработку мышц. Запись онлайн занимает меньше минуты.",
    primaryCta: "Записаться онлайн",
    secondaryCta: "Посмотреть каталог",
    badges: ["Онлайн-запись 24/7", "Центр Кишинева", "Сертифицированные специалисты"],
    stats: [
      { value: "9+", label: "лет практики" },
      { value: "6", label: "программ в каталоге" },
      { value: "от 850 MDL", label: "стоимость сеанса" }
    ],
    asideEyebrow: "Почему выбирают нас",
    asideTitle: "Бережная работа с телом, спокойная атмосфера и запись без лишних звонков",
    asideTags: ["Комфорт", "Профессионализм", "Онлайн-запись"]
  },
  sections: {
    overview: {
      kicker: "Почему мы",
      title: "Все, что нужно для спокойного и комфортного визита в студию",
      copy:
        "От первого знакомства со студией до выбора удобного времени все устроено так, чтобы вам было легко принять решение и просто записаться."
    },
    services: {
      kicker: "Процедуры",
      title: "Программы массажа и ухода с понятным эффектом и прозрачной стоимостью",
      copy:
        "Выбирайте то, что нужно именно сейчас: расслабление, восстановление после нагрузки, работа со спиной или мягкая SPA-пауза для себя."
    },
    specialists: {
      kicker: "Команда",
      title: "Специалисты, которые работают бережно и действительно слышат ваш запрос",
      copy:
        "У каждого мастера свой акцент и специализация, поэтому вы можете выбрать подход, который ближе именно вам."
    },
    process: {
      kicker: "Как это работает",
      title: "Путь от выбора программы до спокойного визита в студию",
      copy:
        "Мы сделали запись простой и понятной, чтобы вы могли выбрать нужную процедуру без долгих переписок и ожидания ответа."
    },
    booking: {
      kicker: "Онлайн-запись",
      title: "Выберите программу, специалиста и удобное время для визита",
      copy:
        "Заполните короткую форму, чтобы оставить заявку на удобный слот. После отправки вы сразу увидите номер записи.",
      slotHint: "Сначала выберите процедуру, специалиста и дату.",
      summaryKicker: "Резюме записи",
      contactsKicker: "Контакты студии",
      note:
        "Если у вас есть пожелания по самочувствию или зонам проработки, укажите их в комментарии к записи."
    },
    reviews: {
      kicker: "Доверие",
      title: "Отзывы гостей и ответы на вопросы перед первым визитом",
      copy:
        "Собрали то, что чаще всего важно знать до записи: ощущения после сеанса, формат визита и организационные детали."
    },
    footer: {
      eyebrow: "Mateev Spa Studio",
      copy:
        "Студия для тех, кто хочет снять напряжение, почувствовать легкость в теле и выделить время на себя без спешки и суеты."
    }
  },
  bookingForm: {
    serviceLabel: "Процедура",
    specialistLabel: "Специалист",
    dateLabel: "Дата",
    slotsLabel: "Свободные слоты",
    nameLabel: "Имя клиента",
    namePlaceholder: "Например, Анна",
    phoneLabel: "Телефон",
    phonePlaceholder: "+373...",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    notesLabel: "Комментарий",
    notesPlaceholder: "Например, акцент на спину",
    submitLabel: "Подтвердить запись"
  },
  ui: {
    featurePrefix: "Преимущество",
    processPrefix: "Шаг",
    serviceCardCta: "Выбрать",
    specialistCardCta: "Выбрать мастера",
    contactAddressLabel: "Адрес",
    contactPhoneLabel: "Телефон",
    contactEmailLabel: "Email",
    contactHoursLabel: "График",
    footerPhoneLabel: "Телефон",
    footerEmailLabel: "Email",
    footerAddressLabel: "Адрес",
    footerTelegramLabel: "Telegram",
    summaryServiceLabel: "Процедура",
    summarySpecialistLabel: "Специалист",
    summaryDateLabel: "Дата",
    summaryTimeLabel: "Время",
    summaryPriceLabel: "Стоимость",
    summaryClientLabel: "Клиент",
    summaryContactLabel: "Контакт"
  },
  translations: {
    ro: {
      navigation: {
        overview: "De ce noi",
        services: "Proceduri",
        specialists: "Specialiști",
        booking: "Programare",
        school: "Școală"
      },
      hero: {
        kicker: "Spațiu de recuperare și îngrijire a corpului",
        title: "Masaj și terapie corporală în Chișinău pentru recuperare, relaxare și resurse interioare",
        subtitle: "Alegeți programul potrivit nevoilor dumneavoastră: relaxare, recuperare după efort, îngrijire a spatelui sau o pauză de calitate pentru sine. Programare online în mai puțin de un minut.",
        primaryCta: "Programare online",
        secondaryCta: "Vezi catalogul",
        asideEyebrow: "De ce ne aleg",
        asideTitle: "Lucru atent cu corpul, atmosferă liniștită și servicii fără complicații"
      },
      sections: {
        overview: {
          kicker: "De ce noi",
          title: "Tot ce este necesar pentru o vizită confortabilă la studio",
          copy: "De la prima cunoaștere cu studioul până la alegerea unui timp convenabil, totul este organizat pentru a fi ușor să luați o decizie și să vă programați."
        },
        services: {
          kicker: "Proceduri",
          title: "Programe de masaj cu efect clar și prețuri transparente",
          copy: "Alegeți ce aveți nevoie acum: relaxare, recuperare după efort, lucru cu spatele sau o pauză SPA pentru dumneavoastră."
        },
        specialists: {
          kicker: "Echipa",
          title: "Specialiști care lucrează atent și ascultă cu adevărat cererea dumneavoastră",
          copy: "Fiecare maestru are propriul accent și specializare, astfel încât puteți alege abordarea care vi se potrivește."
        },
        process: {
          kicker: "Cum funcționează",
          title: "Calea de la alegerea programului până la vizita liniștită la studio",
          copy: "Am făcut programarea simplă și clară, pentru a putea alege procedura necesară fără corespondență îndelungată."
        },
        booking: {
          kicker: "Programare online",
          title: "Alegeți procedura, specialistul și ora convenabilă pentru vizită",
          copy: "Completați formularul scurt pentru a lăsa o cerere. După trimitere veți vedea imediat numărul programării.",
          slotHint: "Mai întâi selectați procedura, specialistul și data.",
          summaryKicker: "Rezumatul programării",
          contactsKicker: "Contactele studioului",
          note: "Dacă aveți preferințe privind starea de sănătate sau zonele de lucru, indicați-le în comentariul la programare."
        },
        reviews: {
          kicker: "Încredere",
          title: "Recenzii ale oaspeților și răspunsuri la întrebări înainte de prima vizită",
          copy: "Am adunat ce este mai important de știut înainte de programare: senzații după ședință, formatul vizitei și detalii organizatorice."
        },
        footer: {
          eyebrow: "Mateev Spa Studio",
          copy: "Studio pentru cei care doresc să elimine tensiunea, să simtă ușurință în corp și să dedice timp pentru sine fără grabă."
        }
      },
      bookingForm: {
        serviceLabel: "Procedură",
        specialistLabel: "Specialist",
        dateLabel: "Data",
        slotsLabel: "Intervale disponibile",
        nameLabel: "Numele clientului",
        namePlaceholder: "De exemplu, Ana",
        phoneLabel: "Telefon",
        phonePlaceholder: "+373...",
        emailLabel: "Email",
        emailPlaceholder: "name@example.com",
        notesLabel: "Comentariu",
        notesPlaceholder: "De exemplu, accent pe spate",
        submitLabel: "Confirmă programarea"
      },
      ui: {
        serviceCardCta: "Alege",
        specialistCardCta: "Alege specialistul",
        contactAddressLabel: "Adresă",
        contactPhoneLabel: "Telefon",
        contactEmailLabel: "Email",
        contactHoursLabel: "Program",
        summaryServiceLabel: "Procedură",
        summarySpecialistLabel: "Specialist",
        summaryDateLabel: "Data",
        summaryTimeLabel: "Ora",
        summaryPriceLabel: "Cost",
        summaryClientLabel: "Client",
        summaryContactLabel: "Contact"
      },
      brand: {
        tagline: "Masaj și terapie corporală pentru recuperare și odihnă profundă",
        eyebrow: "Studio de masaj în Chișinău"
      }
    }
  },
  overview: [
    {
      title: "Индивидуальный подход",
      text:
        "Подбираем технику, интенсивность и длительность под ваш запрос, ритм жизни и текущее состояние тела."
    },
    {
      title: "Спокойная атмосфера",
      text:
        "Теплое пространство, деликатная работа и ощущение паузы для себя без спешки и лишнего шума."
    },
    {
      title: "Удобная запись",
      text: "Свободное время видно сразу, а бронирование подходящего окна занимает всего пару кликов."
    },
    {
      title: "Забота о результате",
      text: "После сеанса подскажем, как сохранить легкость в теле и какую программу выбрать дальше."
    }
  ],
  process: [
    {
      title: "Выберите запрос",
      text:
        "Определите, что сейчас нужно телу: отдых, работа со спиной, уменьшение отечности или восстановление после нагрузки."
    },
    {
      title: "Выберите специалиста",
      text: "Познакомьтесь с мастерами и выберите того, чей подход, опыт и специализация вам ближе."
    },
    {
      title: "Забронируйте удобное время",
      text:
        "Выберите дату и свободный слот онлайн без ожидания ответа в мессенджерах или звонков."
    },
    {
      title: "Приходите на сеанс",
      text: "Мы подготовим пространство к вашему визиту, а при необходимости заранее уточним детали записи."
    }
  ],
  reviews: [
    {
      author: "Анна Д.",
      meta: "расслабляющий ритуал",
      text:
        "Очень бережная работа и спокойная атмосфера. После сеанса ушло напряжение из плеч, а вечером впервые за долгое время спокойно уснула."
    },
    {
      author: "Максим Л.",
      meta: "глубокая проработка спины",
      text:
        "Пришел с постоянной тяжестью в спине из-за сидячей работы. После нескольких сеансов стало заметно легче, а двигаться свободнее."
    },
    {
      author: "Елена С.",
      meta: "лимфодренаж",
      text:
        "Нравится, что можно быстро записаться через сайт и сразу увидеть удобное время. Сама процедура очень деликатная и приятная."
    }
  ],
  faq: [
    {
      question: "Как выбрать процедуру, если я у вас впервые?",
      answer:
        "Если не уверены, что подойдет именно вам, выбирайте классический массаж или расслабляющий ритуал. В комментарии к записи можно указать свой запрос, и мы сориентируем перед визитом."
    },
    {
      question: "Нужно ли что-то брать с собой?",
      answer:
        "Нет, все необходимое уже есть в студии: полотенца, одноразовые материалы и комфортное пространство для процедуры."
    },
    {
      question: "Можно ли перенести запись?",
      answer:
        "Да, конечно. Если планы изменились, просто предупредите нас заранее по телефону или в Telegram, и мы подберем новое удобное время."
    }
  ],
  method: {
    enabled: true,
    tagline: "Авторский подход к работе с телом",
    principles: [
      {
        title: "Первопричина",
        text: "Работаем с источником боли, а не симптомом — находим причину и убираем её"
      },
      {
        title: "Карта тела",
        text: "Индивидуальный постуральный анализ до и после каждого сеанса"
      },
      {
        title: "Честный прогноз",
        text: "Сколько нужно сеансов — скажу сразу и честно, без лишних визитов"
      },
      {
        title: "Живая техника",
        text: "Комбинация методик подбирается под конкретного человека в конкретный день"
      }
    ]
  }
};

function normalizeSiteContent(siteInput = {}) {
  const defaults = clone(DEFAULT_SITE_CONTENT);
  const input = siteInput && typeof siteInput === "object" ? siteInput : {};

  const heroInput = input.hero && typeof input.hero === "object" ? input.hero : {};
  const sectionInput = input.sections && typeof input.sections === "object" ? input.sections : {};
  const brandInput = input.brand && typeof input.brand === "object" ? input.brand : {};
  const navigationInput =
    input.navigation && typeof input.navigation === "object" ? input.navigation : {};
  const seoInput = input.seo && typeof input.seo === "object" ? input.seo : {};
  const bookingFormInput =
    input.bookingForm && typeof input.bookingForm === "object" ? input.bookingForm : {};
  const uiInput = input.ui && typeof input.ui === "object" ? input.ui : {};

  return {
    seo: {
      title: sanitizeText(seoInput.title, defaults.seo.title),
      description: sanitizeText(seoInput.description, defaults.seo.description)
    },
    brand: {
      name: sanitizeText(brandInput.name, defaults.brand.name),
      eyebrow: sanitizeText(brandInput.eyebrow, defaults.brand.eyebrow),
      tagline: sanitizeText(brandInput.tagline, defaults.brand.tagline),
      city: sanitizeText(brandInput.city, defaults.brand.city),
      address: sanitizeText(brandInput.address, defaults.brand.address),
      phone: sanitizeText(brandInput.phone, defaults.brand.phone),
      email: sanitizeText(brandInput.email, defaults.brand.email),
      telegram: sanitizeText(brandInput.telegram, defaults.brand.telegram),
      hours: sanitizeText(brandInput.hours, defaults.brand.hours),
      currency: sanitizeText(brandInput.currency, defaults.brand.currency) || "MDL"
    },
    navigation: {
      overview: sanitizeText(navigationInput.overview, defaults.navigation.overview),
      services: sanitizeText(navigationInput.services, defaults.navigation.services),
      specialists: sanitizeText(navigationInput.specialists, defaults.navigation.specialists),
      booking: sanitizeText(navigationInput.booking, defaults.navigation.booking)
    },
    hero: {
      kicker: sanitizeText(heroInput.kicker, defaults.hero.kicker),
      title: sanitizeText(heroInput.title, defaults.hero.title),
      subtitle: sanitizeText(heroInput.subtitle, defaults.hero.subtitle),
      primaryCta: sanitizeText(heroInput.primaryCta, defaults.hero.primaryCta),
      secondaryCta: sanitizeText(heroInput.secondaryCta, defaults.hero.secondaryCta),
      badges: sanitizeStringArray(heroInput.badges, defaults.hero.badges),
      stats: (Array.isArray(heroInput.stats) ? heroInput.stats : defaults.hero.stats)
        .map((item, index) => ({
          value: sanitizeText(item?.value, defaults.hero.stats[index]?.value || ""),
          label: sanitizeText(item?.label, defaults.hero.stats[index]?.label || "")
        }))
        .filter((item) => item.value || item.label),
      asideEyebrow: sanitizeText(heroInput.asideEyebrow, defaults.hero.asideEyebrow),
      asideTitle: sanitizeText(heroInput.asideTitle, defaults.hero.asideTitle),
      asideTags: sanitizeStringArray(heroInput.asideTags, defaults.hero.asideTags)
    },
    sections: {
      overview: {
        kicker: sanitizeText(sectionInput.overview?.kicker, defaults.sections.overview.kicker),
        title: sanitizeText(sectionInput.overview?.title, defaults.sections.overview.title),
        copy: sanitizeText(sectionInput.overview?.copy, defaults.sections.overview.copy)
      },
      services: {
        kicker: sanitizeText(sectionInput.services?.kicker, defaults.sections.services.kicker),
        title: sanitizeText(sectionInput.services?.title, defaults.sections.services.title),
        copy: sanitizeText(sectionInput.services?.copy, defaults.sections.services.copy)
      },
      specialists: {
        kicker: sanitizeText(
          sectionInput.specialists?.kicker,
          defaults.sections.specialists.kicker
        ),
        title: sanitizeText(
          sectionInput.specialists?.title,
          defaults.sections.specialists.title
        ),
        copy: sanitizeText(sectionInput.specialists?.copy, defaults.sections.specialists.copy)
      },
      process: {
        kicker: sanitizeText(sectionInput.process?.kicker, defaults.sections.process.kicker),
        title: sanitizeText(sectionInput.process?.title, defaults.sections.process.title),
        copy: sanitizeText(sectionInput.process?.copy, defaults.sections.process.copy)
      },
      booking: {
        kicker: sanitizeText(sectionInput.booking?.kicker, defaults.sections.booking.kicker),
        title: sanitizeText(sectionInput.booking?.title, defaults.sections.booking.title),
        copy: sanitizeText(sectionInput.booking?.copy, defaults.sections.booking.copy),
        slotHint: sanitizeText(
          sectionInput.booking?.slotHint,
          defaults.sections.booking.slotHint
        ),
        summaryKicker: sanitizeText(
          sectionInput.booking?.summaryKicker,
          defaults.sections.booking.summaryKicker
        ),
        contactsKicker: sanitizeText(
          sectionInput.booking?.contactsKicker,
          defaults.sections.booking.contactsKicker
        ),
        note: sanitizeText(sectionInput.booking?.note, defaults.sections.booking.note)
      },
      reviews: {
        kicker: sanitizeText(sectionInput.reviews?.kicker, defaults.sections.reviews.kicker),
        title: sanitizeText(sectionInput.reviews?.title, defaults.sections.reviews.title),
        copy: sanitizeText(sectionInput.reviews?.copy, defaults.sections.reviews.copy)
      },
      footer: {
        eyebrow: sanitizeText(sectionInput.footer?.eyebrow, defaults.sections.footer.eyebrow),
        copy: sanitizeText(sectionInput.footer?.copy, defaults.sections.footer.copy)
      }
    },
    bookingForm: {
      serviceLabel: sanitizeText(
        bookingFormInput.serviceLabel,
        defaults.bookingForm.serviceLabel
      ),
      specialistLabel: sanitizeText(
        bookingFormInput.specialistLabel,
        defaults.bookingForm.specialistLabel
      ),
      dateLabel: sanitizeText(bookingFormInput.dateLabel, defaults.bookingForm.dateLabel),
      slotsLabel: sanitizeText(bookingFormInput.slotsLabel, defaults.bookingForm.slotsLabel),
      nameLabel: sanitizeText(bookingFormInput.nameLabel, defaults.bookingForm.nameLabel),
      namePlaceholder: sanitizeText(
        bookingFormInput.namePlaceholder,
        defaults.bookingForm.namePlaceholder
      ),
      phoneLabel: sanitizeText(bookingFormInput.phoneLabel, defaults.bookingForm.phoneLabel),
      phonePlaceholder: sanitizeText(
        bookingFormInput.phonePlaceholder,
        defaults.bookingForm.phonePlaceholder
      ),
      emailLabel: sanitizeText(bookingFormInput.emailLabel, defaults.bookingForm.emailLabel),
      emailPlaceholder: sanitizeText(
        bookingFormInput.emailPlaceholder,
        defaults.bookingForm.emailPlaceholder
      ),
      notesLabel: sanitizeText(bookingFormInput.notesLabel, defaults.bookingForm.notesLabel),
      notesPlaceholder: sanitizeText(
        bookingFormInput.notesPlaceholder,
        defaults.bookingForm.notesPlaceholder
      ),
      submitLabel: sanitizeText(bookingFormInput.submitLabel, defaults.bookingForm.submitLabel)
    },
    ui: {
      featurePrefix: sanitizeText(uiInput.featurePrefix, defaults.ui.featurePrefix),
      processPrefix: sanitizeText(uiInput.processPrefix, defaults.ui.processPrefix),
      serviceCardCta: sanitizeText(uiInput.serviceCardCta, defaults.ui.serviceCardCta),
      specialistCardCta: sanitizeText(
        uiInput.specialistCardCta,
        defaults.ui.specialistCardCta
      ),
      contactAddressLabel: sanitizeText(
        uiInput.contactAddressLabel,
        defaults.ui.contactAddressLabel
      ),
      contactPhoneLabel: sanitizeText(
        uiInput.contactPhoneLabel,
        defaults.ui.contactPhoneLabel
      ),
      contactEmailLabel: sanitizeText(
        uiInput.contactEmailLabel,
        defaults.ui.contactEmailLabel
      ),
      contactHoursLabel: sanitizeText(uiInput.contactHoursLabel, defaults.ui.contactHoursLabel),
      footerPhoneLabel: sanitizeText(uiInput.footerPhoneLabel, defaults.ui.footerPhoneLabel),
      footerEmailLabel: sanitizeText(uiInput.footerEmailLabel, defaults.ui.footerEmailLabel),
      footerAddressLabel: sanitizeText(
        uiInput.footerAddressLabel,
        defaults.ui.footerAddressLabel
      ),
      footerTelegramLabel: sanitizeText(
        uiInput.footerTelegramLabel,
        defaults.ui.footerTelegramLabel
      ),
      summaryServiceLabel: sanitizeText(
        uiInput.summaryServiceLabel,
        defaults.ui.summaryServiceLabel
      ),
      summarySpecialistLabel: sanitizeText(
        uiInput.summarySpecialistLabel,
        defaults.ui.summarySpecialistLabel
      ),
      summaryDateLabel: sanitizeText(uiInput.summaryDateLabel, defaults.ui.summaryDateLabel),
      summaryTimeLabel: sanitizeText(uiInput.summaryTimeLabel, defaults.ui.summaryTimeLabel),
      summaryPriceLabel: sanitizeText(uiInput.summaryPriceLabel, defaults.ui.summaryPriceLabel),
      summaryClientLabel: sanitizeText(
        uiInput.summaryClientLabel,
        defaults.ui.summaryClientLabel
      ),
      summaryContactLabel: sanitizeText(
        uiInput.summaryContactLabel,
        defaults.ui.summaryContactLabel
      )
    },
    overview: (Array.isArray(input.overview) ? input.overview : defaults.overview)
      .map((item, index) => ({
        title: sanitizeText(item?.title, defaults.overview[index]?.title || ""),
        text: sanitizeText(item?.text, defaults.overview[index]?.text || "")
      }))
      .filter((item) => item.title || item.text),
    process: (Array.isArray(input.process) ? input.process : defaults.process)
      .map((item, index) => ({
        title: sanitizeText(item?.title, defaults.process[index]?.title || ""),
        text: sanitizeText(item?.text, defaults.process[index]?.text || "")
      }))
      .filter((item) => item.title || item.text),
    reviews: (Array.isArray(input.reviews) ? input.reviews : defaults.reviews)
      .map((item, index) => ({
        author: sanitizeText(item?.author, defaults.reviews[index]?.author || ""),
        meta: sanitizeText(item?.meta, defaults.reviews[index]?.meta || ""),
        text: sanitizeText(item?.text, defaults.reviews[index]?.text || "")
      }))
      .filter((item) => item.author || item.meta || item.text),
    faq: (Array.isArray(input.faq) ? input.faq : defaults.faq)
      .map((item, index) => ({
        question: sanitizeText(item?.question, defaults.faq[index]?.question || ""),
        answer: sanitizeText(item?.answer, defaults.faq[index]?.answer || "")
      }))
      .filter((item) => item.question || item.answer),
    method: (() => {
      const m = input.method && typeof input.method === "object" ? input.method : {};
      const dm = defaults.method;
      const taglineRo = sanitizeText(m.taglineRo);
      const principles = (Array.isArray(m.principles) ? m.principles : dm.principles)
        .slice(0, 6)
        .map((p, i) => {
          const titleRo = sanitizeText(p?.titleRo);
          const textRo = sanitizeText(p?.textRo);
          return {
            title: sanitizeText(p?.title, dm.principles[i]?.title || ""),
            text: sanitizeText(p?.text, dm.principles[i]?.text || ""),
            ...(titleRo && { titleRo }),
            ...(textRo && { textRo })
          };
        })
        .filter((p) => p.title);

      return {
        enabled: m.enabled !== false,
        tagline: sanitizeText(m.tagline, dm.tagline),
        principles,
        ...(taglineRo && { taglineRo })
      };
    })(),
    translations: input.translations || defaults.translations || {},
    promoBanner: input.promoBanner && typeof input.promoBanner === "object" ? {
      enabled: !!input.promoBanner.enabled,
      text: sanitizeText(input.promoBanner.text),
      cta: sanitizeText(input.promoBanner.cta),
      ctaUrl: sanitizeText(input.promoBanner.ctaUrl),
      color: sanitizeText(input.promoBanner.color) || "brand"
    } : null
  };
}

function normalizeServices(servicesInput = []) {
  const source = Array.isArray(servicesInput) ? servicesInput : [];
  const usedIds = new Set();

  return source
    .map((service, index) => {
      const benefits = sanitizeStringArray(service?.benefits, []);
      const name = sanitizeText(service?.name);
      const category = sanitizeText(service?.category);
      const description = sanitizeText(service?.description);

      if (!name && !category && !description && !benefits.length) {
        return null;
      }

      let id = sanitizeSlug(service?.id, "");
      if (!id || usedIds.has(id)) {
        id = sanitizeSlug(name, createFallbackId("service"));
      }
      while (usedIds.has(id)) {
        id = `${id}-${index + 1}`;
      }
      usedIds.add(id);

      const nameRo = sanitizeText(service?.nameRo);
      const categoryRo = sanitizeText(service?.categoryRo);
      const descriptionRo = sanitizeText(service?.descriptionRo);
      const benefitsRo = sanitizeStringArray(service?.benefitsRo, []);

      return {
        id,
        name: name || `Услуга ${index + 1}`,
        category: category || "Категория",
        duration: sanitizeInteger(service?.duration, 60) || 60,
        price: sanitizeInteger(service?.price, 0),
        description,
        benefits,
        ...(nameRo && { nameRo }),
        ...(categoryRo && { categoryRo }),
        ...(descriptionRo && { descriptionRo }),
        ...(benefitsRo.length && { benefitsRo })
      };
    })
    .filter(Boolean);
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const requiredFiles = [
    ["services.json", "[]"],
    ["specialists.json", "[]"],
    ["site.json", `${JSON.stringify(DEFAULT_SITE_CONTENT, null, 2)}\n`],
    ["bookings.json", "[]"],
    ["schedule.json", `${JSON.stringify({ blocks: [] }, null, 2)}\n`],
    ["clients.json", "[]"],
    ["courses.json", JSON.stringify([
      { id: "classic-massage-group", direction: "massage", name: "Классический массаж", subtitle: "Базовый курс классического массажа с нуля", level: "beginner", format: "group", duration: "3 недели", price: 300, currency: "EUR", description: "Полный курс классического массажа для начинающих. Вы освоите анатомию и физиологию, технику основных приёмов, постановку рук и работу с разными зонами тела.", benefits: ["Анатомия и физиология для практика", "Основные техники: поглаживание, разминание, вибрация", "Работа со спиной, шеей, конечностями", "Практика на реальных клиентах под контролем преподавателя", "Сертификат об окончании курса"], teacherId: "denis-mateev", groupSize: "до 6 человек", certificate: true },
      { id: "advanced-massage-group", direction: "massage", name: "Продвинутый курс массажа", subtitle: "Триггерные точки, терапевтический и спортивный массаж", level: "advanced", format: "group", duration: "4 недели", price: 400, currency: "EUR", description: "Углублённый курс для тех, кто уже знаком с базовой техникой. Фокус на работе с триггерными точками, терапевтическом подходе и специфике спортивного массажа.", benefits: ["Работа с триггерными точками и миофасциальными паттернами", "Терапевтический массаж: протоколы для боли и восстановления", "Спортивный массаж: разминка, восстановление, профилактика", "Индивидуальный разбор техники с преподавателем", "Сертификат об окончании курса"], teacherId: "denis-mateev", groupSize: "до 4 человек", certificate: true },
      { id: "thai-massage-group", direction: "massage", name: "Тайский массаж", subtitle: "Традиционная техника тайского массажа", level: "intermediate", format: "group", duration: "3 недели", price: 500, currency: "EUR", description: "Курс традиционного тайского массажа для тех, кто имеет базовый опыт в телесных практиках. Работа с энергетическими линиями, растяжения, акупрессура.", benefits: ["Философия и принципы традиционного тайского массажа", "Работа с сенами — энергетическими линиями тела", "Техники растяжения и акупрессуры", "Полный протокол сеанса на коврике", "Сертификат об окончании курса"], teacherId: "denis-mateev", groupSize: "до 4 человек", certificate: true },
      { id: "individual-massage", direction: "massage", name: "Индивидуальные занятия", subtitle: "Персональное обучение под ваш запрос и уровень", level: "any", format: "individual", duration: "Гибкий график", price: 500, currency: "EUR", description: "Индивидуальный формат обучения: программа выстраивается под ваш уровень, цели и удобное расписание. Максимум практики и внимания преподавателя.", benefits: ["Программа составляется под ваш запрос и уровень", "Гибкий график — занятия в удобное для вас время", "Максимум внимания и разбор вашей техники", "Быстрый прогресс благодаря персональному подходу", "Сертификат об окончании курса"], teacherId: "denis-mateev", groupSize: "1 человек", certificate: true },
      { id: "basic-cosmetology-group", direction: "cosmetology", name: "Базовый курс косметологии", subtitle: "Введение в косметологию с медицинской базой", level: "beginner", format: "group", duration: "4 недели", price: 0, currency: "EUR", description: "Базовый курс для начинающих косметологов. Анатомия кожи, типы кожи, основные уходовые процедуры и работа с клиентом — всё с опорой на медицинские знания.", benefits: ["Анатомия и физиология кожи", "Типы кожи и подбор ухода", "Базовые косметологические процедуры", "Работа с клиентом: анамнез, противопоказания, протокол", "Сертификат об окончании курса"], teacherId: "vera-mateeva", groupSize: "до 6 человек", certificate: true },
      { id: "facial-skincare-group", direction: "cosmetology", name: "Уход за кожей лица", subtitle: "Профессиональные техники ухода за кожей лица", level: "intermediate", format: "group", duration: "3 недели", price: 0, currency: "EUR", description: "Курс для тех, кто хочет освоить профессиональные уходовые техники для лица: массаж, маски, аппаратные методики и подбор домашнего ухода для клиента.", benefits: ["Массаж лица: классический и лимфодренажный", "Профессиональные маски и пилинги", "Введение в аппаратные методики", "Составление протокола ухода для клиента", "Сертификат об окончании курса"], teacherId: "vera-mateeva", groupSize: "до 6 человек", certificate: true }
    ], null, 2)],
    ["teachers.json", JSON.stringify([
      { id: "denis-mateev", name: "Денис Матеев", role: "Преподаватель массажа", experience: "9 лет практики", bio: "Практикующий массажист и телесный терапевт с 9-летним опытом. Основатель Mateev Spa Studio. Ведёт обучение классическому, терапевтическому и тайскому массажу — от базовой техники до работы с триггерными точками.", directions: ["massage"], initials: "ДМ", photo: null },
      { id: "vera-mateeva", name: "Вера Матеева", role: "Преподаватель косметологии", experience: "6 лет в косметологии", bio: "Медицинское образование — врач-терапевт. 6 лет в практической косметологии. Ведёт обучение уходу за кожей, косметологическим процедурам и работе с клиентом.", directions: ["cosmetology"], initials: "ВМ", photo: null }
    ], null, 2)],
    ["enrollments.json", "[]"],
    ["certificates.json", "[]"],
    ["diplomas.json", "[]"],
    ["expenses.json", "[]"],
    ["packages.json", "[]"],
    ["inventory.json", "[]"],
    ["portal-tokens.json", "[]"],
    ["master-tokens.json", "[]"],
    ["notes.json", "[]"],
    ["master-notes.json", "[]"],
    ["commission-payments.json", "[]"],
    ["gallery.json", "[]"],
    ["results.json", "[]"],
    ["credentials.json", "[]"],
    ["materials.json", "[]"],
    ["care-notes.json", "[]"],
    ["reception.json", JSON.stringify({ mode: "hybrid", open: "08:00", close: "20:00" })],
    ["tg-sessions.json", "{}"],
    ["saas-leads.json", "[]"],
    ["birthday-sent.json", "{}"],
    ["rec-templates.json", "[]"]
  ];

  await Promise.all(
    requiredFiles.map(async ([fileName, fallbackContent]) => {
      const fullPath = path.join(DATA_DIR, fileName);

      try {
        await fs.access(fullPath);
      } catch {
        await fs.writeFile(fullPath, fallbackContent, "utf8");
      }
    })
  );

  // Досев авторского курса «Интегративный массаж» (идемпотентно — и для уже
  // существующих установок, где courses.json создан ранее без этого курса).
  try {
    const coursesPath = path.join(DATA_DIR, "courses.json");
    const list = JSON.parse(await fs.readFile(coursesPath, "utf8"));
    if (Array.isArray(list) && !list.some((c) => c && c.id === "integrative-massage-author")) {
      const course = {
        id: "integrative-massage-author",
        direction: "massage",
        name: "Интегративный массаж",
        subtitle: "Авторский курс Дениса Матеева: тело, лицо и внутренние системы в одном подходе",
        level: "advanced",
        format: "group",
        duration: "8–10 недель",
        price: 600,
        currency: "EUR",
        description: "Авторский интегративный метод: в одном подходе соединяются МФР, deep tissue и триггерные точки, постизометрическая релаксация (ПИР), дифиброзирующий массаж, лимфодренаж, висцеральная терапия, работа с грудью и постурой, массаж лица (в т.ч. интрабуккальный) и восточные техники — шиацу, акупрессура, рефлексология. Теория проходится на платформе MateevSpa академия, практика — на очных семинарах под контролем преподавателя.",
        benefits: [
          "8 групп техник: от фасций, триггеров и ПИР до буккального массажа лица",
          "Дифиброзирующая и эстетическая работа: лицо, рубцы, овал",
          "Висцеральная терапия и лимфодренаж",
          "Восточные рефлекторные техники: шиацу, акупрессура, рефлексология",
          "Умение собирать сеанс под конкретную задачу клиента",
          "Сертификат об окончании курса с QR-верификацией"
        ],
        teacherId: "denis-mateev",
        groupSize: "до 4 человек",
        certificate: true
      };
      const idx = list.findIndex((c) => c && c.id === "individual-massage");
      if (idx >= 0) list.splice(idx + 1, 0, course);
      else list.push(course);
      await fs.writeFile(coursesPath, JSON.stringify(list, null, 2), "utf8");
    }
  } catch { /* не критично — курс можно добавить через админку */ }

  // Досев методичек курса «Интегративный массаж» в библиотеку материалов
  // (идемпотентно по title; content читается из materials/*.md).
  try {
    const seedMaterials = [
      {
        title: "Интегративный массаж — метод и техники",
        topics: "МФР, deep tissue, триггеры, ПИР, дифиброз, лимфодренаж, висцералка, грудь, лицо/буккально, восток",
        file: "integrativnyy-massazh.md",
        token: "int7massage7method7a7f3c1e9b4d20867"
      },
      {
        title: "Интегративный массаж — программа курса",
        topics: "9 модулей: теория + практика + тесты, аттестация и сертификат",
        file: "integrativnyy-massazh-programma.md",
        token: "int7massage7program7b8e4d2fa5c319786"
      }
    ];
    const matPath = path.join(DATA_DIR, "materials.json");
    const mats = await readJson("materials.json").catch(() => []);
    let changed = false;
    const nowIso = new Date().toISOString();
    for (const sm of seedMaterials) {
      if (mats.some((m) => m && m.title === sm.title)) continue;
      let content = "";
      try { content = await fs.readFile(path.join(ROOT_DIR, "materials", sm.file), "utf8"); } catch { continue; }
      mats.push({
        id: crypto.randomUUID(),
        title: sm.title,
        topics: sm.topics,
        date: "",
        content: content.slice(0, 60000),
        token: sm.token,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      changed = true;
    }

    // Одноразовое обновление методички семинара «ШВЗ, живот, грудь, лицо» до
    // версии с явным слоем техник (guard по сигнальной фразе — повторно не перетрёт).
    const SEM_TITLE = "Семинар: ШВЗ, живот, грудь, лицо";
    const SEM_SENTINEL = "Техники семинара (что применялось)";
    const sem = mats.find((m) => m && m.title === SEM_TITLE);
    if (sem && !(sem.content || "").includes(SEM_SENTINEL)) {
      try {
        const c = await fs.readFile(path.join(ROOT_DIR, "materials", "seminar-01.md"), "utf8");
        sem.content = c.slice(0, 60000);
        sem.topics = "МФР, триггеры, дифиброз, лимфодренаж, висцералка, грудь, лицо/буккально";
        sem.updatedAt = nowIso;
        changed = true;
      } catch { /* .md недоступен — оставляем как есть */ }
    }

    if (changed) await fs.writeFile(matPath, JSON.stringify(mats, null, 2), "utf8");
  } catch { /* не критично — методички можно создать через админку */ }
}

function sanitizeEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

function splitCommaList(value) {
  return sanitizeEnv(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function createDataSnapshot(label = "manual") {
  await ensureDataFiles();
  await ensureBackupDir();

  const safeLabel =
    sanitizeEnv(label)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "snapshot";
  const snapshotName = `${createTimestampSlug()}-${safeLabel}`;
  const snapshotDir = path.join(BACKUP_DIR, snapshotName);
  const dataFiles = (await fs.readdir(DATA_DIR)).filter((fileName) => fileName.endsWith(".json"));

  await fs.mkdir(snapshotDir, { recursive: true });
  await Promise.all(
    dataFiles.map((fileName) => fs.copyFile(path.join(DATA_DIR, fileName), path.join(snapshotDir, fileName)))
  );

  return {
    directory: snapshotDir,
    files: dataFiles
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(message);
}

async function serveStaticFile(requestPath, response) {
  if (requestPath.startsWith("/uploads/")) {
    const safeName = path.basename(requestPath);
    const subDir = requestPath.startsWith("/uploads/blog/") ? "blog" : requestPath.startsWith("/uploads/gallery/") ? "gallery" : requestPath.startsWith("/uploads/credentials/") ? "credentials" : requestPath.startsWith("/uploads/materials/") ? "materials" : requestPath.startsWith("/uploads/signatures/") ? "signatures" : "specialists";
    const fullPath = path.join(ROOT_DIR, "uploads", subDir, safeName);
    try {
      const fileBuffer = await fs.readFile(fullPath);
      const extension = path.extname(fullPath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400"
      });
      response.end(fileBuffer);
    } catch {
      sendText(response, 404, "Not found");
    }
    return;
  }

  const fileName = STATIC_FILES[requestPath];

  if (!fileName) {
    const html = render404Page();
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  const fullPath = path.join(ROOT_DIR, fileName);
  const extension = path.extname(fullPath);

  try {
    const fileBuffer = await fs.readFile(fullPath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(fileBuffer);
  } catch (error) {
    sendText(response, 500, `Failed to read static file: ${error.message}`);
  }
}

function parseJsonBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxBytes) {
        reject(new Error("Payload too large"));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

function toMinutes(timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDayIndex(dateString) {
  return new Date(`${dateString}T00:00:00`).getDay();
}

function getWorkingWindow(dateString) {
  const day = getDayIndex(dateString);

  if (day === 0) {
    return { open: 10 * 60, close: 17 * 60 };
  }

  return { open: 9 * 60, close: 20 * 60 };
}

const BOOKING_HORIZON_DAYS = 14;   // max days ahead clients can book
const BOOKING_MIN_NOTICE_HOURS = 24; // min hours before session to book

function isFutureOrToday(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

function isWithinBookingHorizon(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const maxDate = new Date();
  maxDate.setHours(0, 0, 0, 0);
  maxDate.setDate(maxDate.getDate() + BOOKING_HORIZON_DAYS);
  return date <= maxDate;
}

function parseCookies(request) {
  const rawCookieHeader = request.headers.cookie || "";

  return rawCookieHeader.split(";").reduce((accumulator, chunk) => {
    const [rawName, ...rawValueParts] = chunk.trim().split("=");
    if (!rawName) {
      return accumulator;
    }

    accumulator[rawName] = decodeURIComponent(rawValueParts.join("=") || "");
    return accumulator;
  }, {});
}

function createSignedToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readSignedToken(token, secret) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload?.exp && payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function createAdminSessionToken(role = "admin") {
  const now = Date.now();
  return createSignedToken(
    {
      purpose: "admin-session",
      key: ADMIN_PIN_FINGERPRINT,
      role,
      iat: now,
      exp: now + ADMIN_SESSION_TTL_MS,
      nonce: crypto.randomBytes(12).toString("hex")
    },
    ADMIN_SESSION_SECRET
  );
}

function getAdminSession(request) {
  const cookies = parseCookies(request);
  const payload = readSignedToken(cookies[ADMIN_SESSION_COOKIE_NAME], ADMIN_SESSION_SECRET);

  if (!payload || payload.purpose !== "admin-session" || payload.key !== ADMIN_PIN_FINGERPRINT) {
    return null;
  }

  return payload;
}

function createBookingProtectionToken() {
  const now = Date.now();
  return createSignedToken(
    {
      purpose: "booking-form",
      iat: now,
      exp: now + FORM_TOKEN_TTL_MS,
      nonce: crypto.randomBytes(10).toString("hex")
    },
    FORM_TOKEN_SECRET
  );
}

function getBookingProtectionPayload(token) {
  const payload = readSignedToken(token, FORM_TOKEN_SECRET);

  if (!payload || payload.purpose !== "booking-form") {
    return null;
  }

  return payload;
}

function getRequestIp(request) {
  const forwarded = sanitizeEnv(request.headers["x-forwarded-for"]);
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.socket?.remoteAddress || "unknown";
}

function assertRateLimit({ scope, key, windowMs, limit, message }) {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const nextHits = (rateLimitBuckets.get(bucketKey) || []).filter((timestamp) => now - timestamp < windowMs);

  if (nextHits.length >= limit) {
    const error = new Error(message);
    error.statusCode = 429;
    throw error;
  }

  nextHits.push(now);
  rateLimitBuckets.set(bucketKey, nextHits);
}

function isSecureRequest(request) {
  return COOKIE_FORCE_SECURE || sanitizeEnv(request.headers["x-forwarded-proto"]).toLowerCase() === "https";
}

function buildAdminSessionCookie(token, request) {
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`
  ];

  if (isSecureRequest(request)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildExpiredAdminSessionCookie(request) {
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];

  if (isSecureRequest(request)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function hasLegacyAdminPin(request) {
  const providedPin = sanitizeEnv(request.headers["x-admin-pin"]);
  return Boolean(providedPin) && providedPin === ADMIN_PIN;
}

function buildBookingNotificationText(booking) {
  return [
    `Новая запись ${booking.reference}`,
    `Источник: ${booking.source === "admin" ? "админка" : "сайт"}`,
    `Клиент: ${booking.clientName}`,
    `Телефон: ${booking.phone}`,
    booking.email ? `Email: ${booking.email}` : null,
    `Услуга: ${booking.serviceName}`,
    `Специалист: ${booking.specialistName}`,
    `Дата: ${booking.date}`,
    `Время: ${booking.slot}-${booking.endsAt}`,
    `Сумма: ${booking.totalPrice} MDL`,
    booking.referredByName ? `🎁 По реф-ссылке от: ${booking.referredByName} (−10% обоим)` : null,
    booking.notes ? `Комментарий: ${booking.notes}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

async function tgSend(chatId, text, extra = {}) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      body: { chat_id: chatId, text, ...extra }
    });
  } catch {}
}

async function tgAnswer(callbackQueryId, text) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      body: { callback_query_id: callbackQueryId, text, show_alert: false }
    });
  } catch {}
}

async function tgEdit(chatId, messageId, text) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      body: { chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: [] } }
    });
  } catch {}
}

// ── AI-ресепшн («мозг студии» на Claude) ───────────────────────────────
const AI_OWNER_PROMPT = `Ты — бизнес-ассистент владельца массажной студии Mateev Spa Studio (Кишинёв).
Отвечай кратко, по делу, на языке вопроса (русский по умолчанию). Опирайся ТОЛЬКО на данные ниже
(статистика и список клиентов с датами последних визитов).
- «Кого давно не было» → найди клиентов с самым давним последним визитом, дай имена и телефоны.
- «Как неделя/месяц» → используй цифры из данных.
- «Напиши сообщение/пост/win-back» → сразу дай готовый текст, тёплый и человечный.
- Не выдумывай данных, которых нет. Если данных не хватает — честно скажи.`;

const AI_CONTENT_PROMPT = `Ты — SMM-копирайтер массажной студии Mateev Spa Studio (Кишинёв).
Пиши тёплые, экспертные посты про массаж, заботу о теле, восстановление и здоровье.
Тон: спокойный, профессиональный, живой (без канцелярита и «воды»).
На запрос дай 2 варианта поста: у каждого цепляющая первая строка-крючок, компактный текст,
эмодзи в меру и 5–7 релевантных хэштегов. Язык: {lang}.`;

const AI_GOOGLE_POST_PROMPT = `Ты — SMM-специалист массажной студии Mateev Spa Studio (Кишинёв), пишешь публикации для Google Профиля компании (Google Business Profile).
Формат Google-поста отличается от Instagram:
- Объём 150–300 слов (максимум ~1500 знаков). Первая фраза — самая важная, она видна в превью.
- Тон тёплый, экспертный, человечный — без канцелярита и «воды».
- Обязательно вплети 1–2 локальных ключевых слова естественно: «массаж в Кишинёве», «masaj Chișinău», «спа Кишинёв» — но без спама.
- В конце — понятный призыв к действию (записаться, позвонить, узнать подробнее).
- Хэштеги НЕ нужны (в Google Профиле они не работают как в соцсетях).
- Не выдумывай акции, цены или факты, которых нет в задании.
- НЕ используй markdown: никаких звёздочек **, никаких разделителей «--» или «***».
Сначала выдай ГОТОВЫЙ текст поста (одним вариантом, обычным текстом).
Затем — самой последней строкой — добавь подсказку строго в формате: Кнопка: <название>
где <название> — РОВНО ОДИН из реальных вариантов кнопок Google: Забронировать, Заказать, Купить, Подробнее, Зарегистрироваться, Позвонить.
Правило выбора: для записи на массаж/сеанс — «Забронировать»; для набора на курс школы массажа — «Зарегистрироваться»; для чисто информационного поста — «Подробнее»; если цель звонок — «Позвонить».
Язык поста: {lang}.`;

const AI_REVIEW_REPLY_PROMPT = `Ты — владелец массажной студии Mateev Spa Studio (Кишинёв), Денис Матиевич. Пишешь ответ на отзыв клиента в Google.
Правила:
- Отвечай на ЯЗЫКЕ отзыва (русский или румынский).
- Обращайся к автору по имени, если оно указано.
- Упомяни суть отзыва (конкретную проблему/результат, о котором пишет клиент) — коротко, своими словами.
- Тон тёплый, искренний, благодарный, живой — как живой человек, а не шаблон. Без канцелярита.
- 2–4 предложения. 1 уместный эмодзи максимум (например 🙏), можно без него.
- Естественно вплети клиентский ключ, если уместно (массаж, восстановление) — но НЕ рекламно и не в каждый ответ.
- Пригласи вернуться / пожелай хорошего.
- Если отзыв негативный: без оправданий, с эмпатией, признай и предложи связаться и всё решить.
Выдай ТОЛЬКО текст ответа, без пояснений и без кавычек.`;

const AI_VOICE_PROMPT = `Ты помогаешь массажисту привести в порядок голосовую заметку о клиенте, надиктованную после сеанса.
На вход — сырой текст распознавания речи (могут быть оговорки, отсутствие пунктуации). Приведи его в аккуратную карту клиента.
Формат ответа (коротко, только заполненные пункты, без лишних слов):
Жалобы: …
Что делал: …
Зоны: …
Особенности/противопоказания: …
План на следующий раз: …
Правила: не выдумывай то, чего нет в надиктовке; исправь очевидные ошибки распознавания медицинских терминов; пиши кратко и по делу; язык — русский. Верни только текст карты, без вступлений.`;

const AI_MEDICAL_PROMPT = `Ты — медицинский ассистент-консультант для практикующего МАССАЖИСТА (не врача). Твоя задача — помочь ему понять диагноз, медицинский термин, заключение или снимок клиента и определить тактику для массажа.
ВАЖНЫЕ ПРАВИЛА БЕЗОПАСНОСТИ:
- Ты НЕ ставишь диагноз и НЕ заменяешь врача/рентгенолога. Окончательную трактовку снимков и диагнозов даёт только врач.
- По рентгену/КТ/МРТ давай ОРИЕНТИРОВОЧНУЮ картину, без категоричных вердиктов. Формулируй мягко: «на снимке могут быть признаки…, это должен подтвердить врач», а не «у вас перелом».
- Если данных мало или картинка нечёткая — скажи честно и предложи уточнить у лечащего врача.
- Не выдумывай.
Отвечай простым, понятным языком (русский). Структура ответа:
1. **Простыми словами** — что это за диагноз/термин/что в целом видно.
2. **Массаж** — можно / нельзя / с осторожностью, и почему; какие зоны избегать; меры предосторожности и положение клиента.
3. **🚩 Красные флаги** — при каких признаках обязательно направить к врачу и НЕ работать.
4. Короткий дисклеймер: это образовательная ориентировка для массажиста, а не медицинское заключение; при сомнениях — очная консультация врача.`;

const AI_MATERIAL_PROMPT = `Ты — преподаватель авторских семинаров по массажу (Mateev Spa Studio, Кишинёв). Составляешь ТЕОРЕТИЧЕСКУЮ методичку для учеников-практиков.
Важное правило: НЕ описывай конкретные приёмы и последовательность движений рук — приёмы преподаватель показывает лично. Давай только теорию.
По каждой указанной зоне тела дай подробно и структурированно (Markdown, подзаголовки через ##/###):
1. Границы зоны.
2. Анатомия: кости/суставы и все ключевые мышцы (с латинскими названиями).
3. Опасные структуры — где нельзя давить (артерии, нервы, органы, железы). Помечай ⚠️.
4. Лимфа и направление оттока.
5. Показания.
6. Противопоказания (локальные + напомни общие абсолютные).
7. Эффект от работы с зоной.
Тон профессиональный, точный, но понятный практику. Не выдумывай фактов. Язык — русский.
В самом начале добавь короткий блок «Общие принципы и безопасность» (анамнез, согласие, гигиена, обратная связь, абсолютные противопоказания к массажу).`;

const AI_DIARY_PROMPT = `Ты — автор блога «Дневник практики» массажной студии Mateev Spa Studio (Кишинёв), практикующий массажист и преподаватель.
Пиши экспертно, тепло и полезно про массаж, анатомию, восстановление и заботу о теле — простым живым языком, без «воды» и канцелярита.
Это блог (не соцсети), хэштеги не нужны. Язык — русский.`;

const AI_SYSTEM_PROMPT = `Ты — тёплый и вежливый ассистент-консультант студии массажа «Mateev Spa Studio» в Кишинёве.
Твоя задача — отвечать гостям на вопросы и мягко подводить к онлайн-записи.

Правила:
- Отвечай на языке вопроса (русский или румынский), кратко и по-человечески (2–5 предложений).
- Используй ТОЛЬКО факты из блока ниже. Если чего-то нет в фактах — не выдумывай, предложи уточнить у студии (телефон или Telegram).
- Цены и услуги называй строго из списка, в молдавских леях (MDL).
- Когда уместно — мягко предлагай записаться: «записаться можно прямо на сайте в разделе „Запись"».
- Про здоровье говори осторожно: это не медицинская консультация. При боли, травме или беременности советуй сперва проконсультироваться с врачом, а в студии — сообщить о состоянии заранее.
- Не обсуждай ничего, кроме студии, услуг, цен, записи и подготовки к визиту. На посторонние темы вежливо возвращай к студии.`;

const AI_AGENT_PROMPT = `Ты — AI-ресепшн студии массажа «Mateev Spa Studio» в Кишинёве. Ты отвечаешь на вопросы гостей И умеешь записывать их на приём с помощью инструментов.
Тон: тёплый, вежливый, человечный, кратко (2–5 предложений). Язык — язык гостя (русский или румынский).

Как записывать (важно):
1. Пойми, какая услуга нужна. Если не уверен в услуге или её id — вызови list_services.
2. Спроси удобную дату (и при желании время). Определи дату в формате YYYY-MM-DD (сегодняшняя дата указана ниже).
3. ВСЕГДА вызывай check_availability перед тем, как назвать время. Никогда не выдумывай свободные окна — предлагай только те, что вернул инструмент.
4. Собери имя и телефон гостя (обязательно оба).
5. ПОДТВЕРДИ у гостя детали одной фразой: «Записываю: <имя>, <телефон>, <дата> <время>, <услуга> — всё верно?». Только после явного «да» вызывай create_booking.
6. После create_booking: если confirmed=true — скажи, что запись подтверждена (назови дату/время/услугу и номер брони). Если confirmed=false — скажи, что заявка принята и мастер подтвердит её в ближайшее время.

Правила:
- Факты, цены и услуги — только из данных ниже, ничего не выдумывай.
- Про здоровье — осторожно: это не медконсультация; при боли/травме/беременности советуй предупредить студию заранее.
- Если инструмент вернул error — вежливо объясни гостю и предложи другой вариант (другое время/дату) или связаться в Telegram.
- Не проси email — он не нужен для записи через тебя.
- Не обсуждай посторонние темы — мягко возвращай к записи и услугам.`;

async function buildStudioFacts() {
  const [rawServices, rawSite] = await Promise.all([
    readJson("services.json").catch(() => []),
    readJson("site.json").catch(() => ({}))
  ]);
  const services = Array.isArray(rawServices) ? rawServices : [];
  const brand = rawSite.brand || {};
  const faq = Array.isArray(rawSite.faq) ? rawSite.faq : [];
  const cur = brand.currency || "MDL";
  const lines = [];
  lines.push(`Название: ${brand.name || "Mateev Spa Studio"}. Город: ${brand.city || "Кишинёв"}. Адрес: ${brand.address || "—"}.`);
  lines.push(`Часы работы: ${brand.hours || "уточняйте у студии"}.`);
  lines.push(`Телефон: ${brand.phone || "—"}. Telegram: ${brand.telegram || "—"}.`);
  lines.push("");
  lines.push("Услуги и цены:");
  for (const s of services) {
    if (!s || !s.name) continue;
    lines.push(`- ${s.name} — ${s.price} ${cur}, ${s.duration} мин.${s.description ? " " + s.description : ""}`);
  }
  if (faq.length) {
    lines.push("");
    lines.push("Частые вопросы:");
    for (const f of faq) {
      if (f && f.question) lines.push(`- В: ${f.question}\n  О: ${f.answer || ""}`);
    }
  }
  return lines.join("\n");
}

// Универсальный вызов Claude. messages: [{role, content}], начинается с user.
async function callAnthropic(system, messages, maxTokens = 500) {
  if (!ANTHROPIC_API_KEY || !Array.isArray(messages) || !messages.length) return null;
  try {
    const data = await requestJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: { model: AI_MODEL, max_tokens: maxTokens, system, messages },
      timeout: 60000
    });
    const text = (data?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    return text || null;
  } catch {
    return null;
  }
}

async function callStudioAI(messages) {
  const facts = await buildStudioFacts();
  return callAnthropic(`${AI_SYSTEM_PROMPT}\n\n=== ФАКТЫ О СТУДИИ ===\n${facts}`, messages, 400);
}

// Промпт для памятки клиенту после сеанса (клиентоориентированный, тёплый)
const AI_CARE_PROMPT = `Ты — массажист Денис Матеев (Mateev Spa Studio, Кишинёв). Составь тёплую, человечную ПАМЯТКУ ДЛЯ КЛИЕНТА после сеанса массажа — на «ты», простым языком, без клинического жаргона и латыни. Клиент прочитает это дома с телефона.

Структура (Markdown: ## заголовки, - списки, **жирный**):
## Что мы сегодня делали
2–3 предложения по проработанным зонам и техникам простыми словами.
## Как ты можешь себя чувствовать
Что нормально в первые 1–2 дня (лёгкая усталость/чувствительность, пить воду, тепло, отдых). Когда стоит написать мне.
## Домашние рекомендации
3–5 простых выполнимых пунктов под проработанные зоны: пара мягких упражнений/растяжек и бытовые советы (осанка, сон, вода, тепло).
## Когда прийти снова
Мягкая рекомендация по срокам следующего визита.

Пиши тепло и заботливо, без запугивания. Не ставь диагнозов и не обещай лечения. 250–400 слов.`;

// Промпт для короткого follow-up сообщения клиенту через 1–2 дня после сеанса
const AI_FOLLOWUP_PROMPT = `Ты — массажист Денис Матеев (Mateev Spa Studio, Кишинёв). Напиши КОРОТКОЕ (2–4 предложения) тёплое личное сообщение клиенту через 1–2 дня после сеанса — как в мессенджере, на «ты». Спроси, как самочувствие после массажа; при необходимости мягко напомни про воду/тепло/отдых; без напора предложи возвращаться, когда захочет. Без формальностей, без markdown, без подписи. Обращайся по имени, если оно есть. Пиши на {lang} языке.`;

// Rule-based фолбэк для AI-подбора сеанса (работает без ключа/если AI не ответил)
function sessionMatchFallback(a, services) {
  const has = (id) => services.some((s) => s.id === id);
  const pick = (...ids) => ids.find(has) || (services[0] && services[0].id) || "classic";
  const ro = a.lang === "ro";
  const { goal, area, pressure } = a;
  let serviceId = "classic", techniques = [], title = "", note = "", caution = "";

  if (goal === "aesthetic" || area === "face") {
    serviceId = pick("lymph", "relax", "classic");
    techniques = ["Лимфодренаж лица", "Интрабуккальный массаж (жевательные мышцы)", "МФР лица и платизмы"];
    title = ro ? "Sesiune estetică pentru față" : "Эстетический сеанс для лица";
    note = "Акцент: лицо, овал, ВНЧС (уточнить эстетический/буккальный сеанс)";
  } else if (area === "belly") {
    serviceId = pick("classic", "relax");
    techniques = ["Висцеральная работа (по часовой стрелке)", "Диафрагмальные техники", "Мягкий лимфодренаж"];
    title = ro ? "Lucru cu abdomenul și digestia" : "Работа с животом и ЖКТ";
    note = "Акцент: живот, пищеварение, диафрагма";
  } else if (goal === "relax") {
    serviceId = pick("relax", "stones", "classic");
    techniques = ["Мягкий МФР", "Шиацу и акупрессура", "Общая релаксация"];
    title = ro ? "Sesiune integrativă de relaxare" : "Расслабляющий интегративный сеанс";
    note = "Акцент: расслабление, снятие стресса";
  } else if (goal === "recovery" || pressure === "deep") {
    serviceId = pick("deep", "sports", "classic");
    techniques = ["Deep tissue", "МФР", "Триггерные точки", "ПИР"];
    title = ro ? "Lucru profund de recuperare" : "Глубокая восстановительная работа";
    note = "Акцент: глубокая проработка, восстановление";
  } else if (area === "neck") {
    serviceId = pick("classic", "deep");
    techniques = ["МФР шеи и трапеций", "Триггерные точки", "Дифиброзирующий массаж «холки»", "Лимфодренаж"];
    title = ro ? "Zona cervico-scapulară" : "Работа с шейно-воротниковой зоной";
    note = "Акцент: шея, трапеции, головные боли напряжения";
  } else if (area === "chest") {
    serviceId = pick("classic", "deep");
    techniques = ["Массаж груди (постура)", "МФР грудной фасции", "Триггеры малой грудной"];
    title = ro ? "Postură și deschiderea pieptului" : "Постура и раскрытие грудного отдела";
    note = "Акцент: осанка, раскрытие плеч, дыхание";
  } else {
    serviceId = pick("classic", "deep", "relax");
    techniques = ["МФР", "Триггерные точки", "Лимфодренаж", "ПИР"];
    title = ro ? "Sesiune integrativă personalizată" : "Интегративный сеанс под задачу";
    note = a.extra ? ("Акцент: " + a.extra) : "Комплексная проработка";
  }

  if (a.condition === "pregnancy") {
    caution = ro
      ? "Sarcină: excludem masajul profund al abdomenului și lucrul visceral, regim blând. Recomandăm consultarea medicului."
      : "Беременность: исключаем глубокий массаж живота и висцеральную работу, мягкий режим. Рекомендуем консультацию врача.";
  } else if (a.condition === "surgery") {
    caution = ro
      ? "Operații/traume recente: lucrăm cu prudență, în zonă doar după acordul medicului."
      : "Недавние операции/травмы: работаем осторожно, по зоне — только после согласования с врачом.";
  }

  const summary = ro
    ? "Am selectat sesiunea și tehnicile în funcție de răspunsurile tale. La programare poți preciza detaliile — Denis ajustează sesiunea pe loc."
    : "Подобрали сеанс и техники по вашим ответам. При записи можно уточнить детали — Денис адаптирует сеанс на месте.";

  return { serviceId, title, techniques, summary, note, caution };
}

// ─── AI-ресепшн: агент записи (tool use) ─────────────────────────────────────
async function anthropicRaw(system, messages, { tools, maxTokens = 1024 } = {}) {
  if (!ANTHROPIC_API_KEY || !Array.isArray(messages) || !messages.length) return null;
  try {
    const body = { model: AI_MODEL, max_tokens: maxTokens, system, messages };
    if (tools && tools.length) body.tools = tools;
    return await requestJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body, timeout: 60000
    }) || null;
  } catch { return null; }
}

const BOOKING_TOOLS = [
  { name: "list_services", description: "Список услуг студии с id, названием, ценой и длительностью. Вызови, если нужно уточнить, какая услуга нужна клиенту, или её id.", input_schema: { type: "object", properties: {} } },
  { name: "check_availability", description: "Свободные окна на конкретную дату для услуги. Всегда вызывай перед тем, как предложить клиенту время — не выдумывай слоты.", input_schema: { type: "object", properties: { date: { type: "string", description: "Дата в формате YYYY-MM-DD" }, serviceId: { type: "string", description: "id услуги из list_services" } }, required: ["date", "serviceId"] } },
  { name: "create_booking", description: "Создать запись. Вызывай ТОЛЬКО после того, как клиент подтвердил услугу, дату, время и дал имя и телефон. Время должно быть из свободных окон check_availability.", input_schema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM" }, serviceId: { type: "string" } }, required: ["name", "phone", "date", "time", "serviceId"] } }
];

async function getReceptionMode() {
  const r = await readJson("reception.json").catch(() => ({}));
  return { mode: ["request", "auto", "hybrid"].includes(r.mode) ? r.mode : "hybrid", open: sanitizeTimeString(r.open) || "08:00", close: sanitizeTimeString(r.close) || "20:00" };
}
function receptionAutoConfirm(rec) {
  if (rec.mode === "auto") return true;
  if (rec.mode === "request") return false;
  // hybrid: автобронь вне рабочих часов (ночь/рано утром), заявка — в рабочие часы
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Chisinau" }));
  const mins = now.getHours() * 60 + now.getMinutes();
  const within = mins >= toMinutes(rec.open) && mins < toMinutes(rec.close);
  return !within;
}

function findServiceLoose(services, ref) {
  if (!ref) return null;
  const s = String(ref).toLowerCase().trim();
  return services.find((x) => x.id === ref) || services.find((x) => (x.name || "").toLowerCase() === s) || services.find((x) => (x.name || "").toLowerCase().includes(s)) || null;
}

async function runBookingTool(name, input) {
  try {
    if (name === "list_services") {
      const services = await readJson("services.json").catch(() => []);
      return { services: (Array.isArray(services) ? services : []).filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })) };
    }
    if (name === "check_availability") {
      const { services, specialists, bookings, schedule } = await loadStudioData();
      const service = findServiceLoose(services, input.serviceId);
      if (!service) return { error: "Услуга не найдена. Вызови list_services." };
      const specialist = specialists.find((sp) => (sp.specialties || []).includes(service.id));
      if (!specialist) return { error: "Нет специалиста для этой услуги." };
      if (!isValidDateString(input.date) || !isFutureOrToday(input.date)) return { error: "Дату можно только сегодня или в будущем, формат YYYY-MM-DD." };
      const av = calculateAvailability({ date: input.date, service, specialist, bookings, schedule });
      const times = (av.slots || []).map((s) => s.time);
      return times.length ? { date: input.date, service: service.name, freeSlots: times } : { date: input.date, freeSlots: [], message: av.message || "На эту дату свободных окон нет." };
    }
    if (name === "create_booking") {
      return await withLock("studio", async () => {
        const { services, specialists, bookings, schedule } = await loadStudioData();
        const service = findServiceLoose(services, input.serviceId);
        if (!service) return { error: "Услуга не найдена." };
        const specialist = specialists.find((sp) => (sp.specialties || []).includes(service.id));
        if (!specialist) return { error: "Нет специалиста для этой услуги." };
        const nm = sanitizeText(input.name || "").trim();
        const phone = sanitizeText(input.phone || "").trim();
        const slot = sanitizeTimeString(input.time);
        if (nm.length < 2) return { error: "Нужно имя клиента." };
        if (phone.replace(/\D/g, "").length < 8) return { error: "Нужен корректный телефон." };
        if (!isValidDateString(input.date) || !isFutureOrToday(input.date)) return { error: "Некорректная дата." };
        if (!slot) return { error: "Некорректное время." };
        const av = calculateAvailability({ date: input.date, service, specialist, bookings, schedule });
        if (!(av.slots || []).some((s) => s.time === slot)) return { error: "Это окно уже занято. Проверь check_availability и предложи другое время." };
        const rec = await getReceptionMode();
        const auto = receptionAutoConfirm(rec);
        const booking = createBookingRecord({
          payload: { date: input.date, slot },
          cleanPayload: { clientName: nm, phone, email: "", notes: "Запись через AI-ресепшн", status: auto ? "confirmed" : "new" },
          service, specialist, meta: { source: "ai" }
        });
        await writeJson("bookings.json", sortBookings([...bookings, booking]));
        void notifyBookingCreated(booking);
        return { ok: true, reference: booking.reference, confirmed: auto, date: booking.date, time: booking.slot, service: service.name, specialist: specialist.name, clientName: booking.clientName, phone: booking.phone, price: booking.totalPrice };
      });
    }
    return { error: "Неизвестный инструмент." };
  } catch (e) {
    return { error: "Ошибка выполнения: " + (e && e.message ? e.message : "неизвестно") };
  }
}

async function runReceptionAgent(messages) {
  const facts = await buildStudioFacts();
  const services = await readJson("services.json").catch(() => []);
  const idList = (Array.isArray(services) ? services : []).filter((s) => s.active !== false).map((s) => `${s.id} — ${s.name} (${s.price} MDL, ${s.duration} мин)`).join("\n");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
  const system = `${AI_AGENT_PROMPT}\n\nСегодня: ${today} (часовой пояс Кишинёва).\n\n=== ФАКТЫ О СТУДИИ ===\n${facts}\n\n=== УСЛУГИ (id — название) ===\n${idList}`;
  const convo = messages.map((m) => ({ role: m.role, content: m.content }));
  let createdBooking = null;
  for (let step = 0; step < 5; step++) {
    const data = await anthropicRaw(system, convo, { tools: BOOKING_TOOLS, maxTokens: 1024 });
    if (!data || !Array.isArray(data.content)) return null;
    convo.push({ role: "assistant", content: data.content });
    const toolUses = data.content.filter((c) => c.type === "tool_use");
    if (!toolUses.length) {
      const text = data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      return { reply: text || null, booking: createdBooking };
    }
    const results = [];
    for (const tu of toolUses) {
      const out = await runBookingTool(tu.name, tu.input || {});
      if (tu.name === "create_booking" && out && out.ok) createdBooking = out;
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    convo.push({ role: "user", content: results });
  }
  return { reply: "Извините, не удалось завершить запись автоматически. Напишите нам в Telegram — оформим лично.", booking: createdBooking };
}

// Структурированное подтверждение записи клиенту (Telegram)
function buildClientConfirmation(b, site) {
  const brand = (site && site.brand) || {};
  const addr = brand.address || "";
  const city = brand.city || "Кишинёв";
  let dateFmt = b.date;
  try { dateFmt = new Date(b.date + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }); } catch {}
  const mapQuery = encodeURIComponent([addr, city].filter(Boolean).join(", "));
  const head = b.confirmed ? "✅ Ваша запись подтверждена!" : "📝 Заявка принята — мы скоро её подтвердим";
  const lines = [
    head, "",
    `💆 ${b.service}`,
    `👤 ${b.specialist}`,
    `📅 ${dateFmt}, ${b.time}`,
    b.price ? `💰 ${b.price} MDL` : "",
    addr ? `📍 ${addr}, ${city}` : `📍 ${city}`,
    `🗺 Как добраться: https://maps.google.com/?q=${mapQuery}`,
    "",
    `Номер брони: ${b.reference}`,
    "Нужно перенести или отменить? Просто напишите нам здесь 🌿"
  ];
  return lines.filter((l) => l !== "").join("\n");
}

async function sendClientBookingConfirmation(b, directChatId) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !b) return;
    const site = await readJson("site.json").catch(() => ({}));
    const msg = buildClientConfirmation(b, site);
    const targets = new Set();
    if (directChatId) targets.add(String(directChatId));
    const digits = normalizePhoneDigits(b.phone || "");
    if (digits) {
      const tokens = await readJson("portal-tokens.json").catch(() => []);
      for (const t of tokens) { if (t.telegramChatId && normalizePhoneDigits(t.phone || "") === digits) targets.add(String(t.telegramChatId)); }
    }
    for (const chat of targets) await tgSend(chat, msg);
  } catch {}
}

// Память диалога Telegram-агента по чату (для многоходовой записи)
const TG_SESSION_TTL_MS = 90 * 60 * 1000; // 90 минут
async function getTgSession(chatId) {
  const all = await readJson("tg-sessions.json").catch(() => ({}));
  const s = all[String(chatId)];
  if (!s || (Date.now() - (s.t || 0)) > TG_SESSION_TTL_MS) return [];
  return Array.isArray(s.m) ? s.m : [];
}
async function saveTgSession(chatId, messages) {
  const all = await readJson("tg-sessions.json").catch(() => ({}));
  // чистим протухшие сессии, чтобы файл не рос
  const now = Date.now();
  for (const k of Object.keys(all)) { if ((now - (all[k].t || 0)) > TG_SESSION_TTL_MS) delete all[k]; }
  all[String(chatId)] = { t: now, m: messages.slice(-10) };
  await writeJson("tg-sessions.json", all);
}

// Сводка бизнеса для AI-ассистента владельца
async function buildBusinessContext() {
  const [rawServices, rawSpecialists, bookings, clientsRaw] = await Promise.all([
    readJson("services.json").catch(() => []),
    readJson("specialists.json").catch(() => []),
    readJson("bookings.json").catch(() => []),
    readJson("clients.json").catch(() => [])
  ]);
  const services = normalizeServices(rawServices);
  const specialists = normalizeSpecialists(rawSpecialists, services);
  const clients = buildAdminClients(bookings, clientsRaw);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
  const month = today.slice(0, 7);
  const completedMonth = bookings.filter((b) => b.status === "completed" && (b.date || "").slice(0, 7) === month);
  const revenueMonth = completedMonth.reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);
  const upcoming = bookings.filter((b) => b.date >= today && b.status !== "cancelled" && b.status !== "completed").length;

  const clientLines = clients
    .map((c) => {
      const lastVisit = (c.history || []).filter((h) => h.status === "completed").map((h) => h.date).sort().pop() || "нет";
      return { name: c.clientName, phone: c.phone || "—", visits: c.completedVisits, spent: c.totalSpent, last: lastVisit };
    })
    .sort((a, b) => (a.last < b.last ? 1 : -1))
    .slice(0, 100);

  const lines = [];
  lines.push(`Сегодня: ${today}. Текущий месяц: ${month}.`);
  lines.push(`Завершено визитов в этом месяце: ${completedMonth.length}, выручка: ${revenueMonth} MDL.`);
  lines.push(`Предстоящих визитов: ${upcoming}. Всего клиентов: ${clients.length}. Специалистов: ${specialists.length}.`);
  lines.push("");
  lines.push("Клиенты (имя · телефон · завершённых визитов · потрачено MDL · последний визит):");
  for (const c of clientLines) lines.push(`- ${c.name} · ${c.phone} · ${c.visits} · ${c.spent} · ${c.last}`);
  return lines.join("\n");
}

let _botUsernameCache = null;
async function getBotUsername() {
  if (_botUsernameCache !== null) return _botUsernameCache;
  if (!TELEGRAM_BOT_TOKEN) { _botUsernameCache = ""; return ""; }
  try {
    const me = await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`, { method: "GET" });
    _botUsernameCache = me?.result?.username || "";
  } catch { _botUsernameCache = ""; }
  return _botUsernameCache;
}

// Validate Telegram Mini App initData (signed by the bot token). Returns the
// verified user object {id, first_name, ...} or null. See core.telegram.org/bots/webapps
function verifyTelegramInitData(initData) {
  if (!initData || !TELEGRAM_BOT_TOKEN) return null;
  let params;
  try { params = new URLSearchParams(initData); } catch { return null; }
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const pairs = [];
  for (const [k, v] of params.entries()) pairs.push(`${k}=${v}`);
  pairs.sort();
  const dataCheckString = pairs.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  let ok = false;
  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { ok = false; }
  if (!ok) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && (Date.now() / 1000 - authDate) > 86400) return null; // 24h freshness
  try { return JSON.parse(params.get("user") || "null"); } catch { return null; }
}

async function sendTelegramNotification(booking) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { channel: "telegram", skipped: true };
  }

  await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    body: {
      chat_id: TELEGRAM_CHAT_ID,
      text: buildBookingNotificationText(booking),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Подтвердить", callback_data: `confirm:${booking.id}` },
          { text: "🏁 Завершить", callback_data: `complete:${booking.id}` },
          { text: "❌ Отменить", callback_data: `cancel:${booking.id}` }
        ]]
      }
    }
  });

  return { channel: "telegram", delivered: true };
}

async function sendEmailNotification(booking) {
  if (!RESEND_API_KEY || !EMAIL_FROM || !EMAIL_NOTIFICATION_RECIPIENTS.length) {
    return { channel: "email", skipped: true };
  }

  const text = buildBookingNotificationText(booking);
  const html = text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  await requestJson("https://api.resend.com/emails", {
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`
    },
    body: {
      from: EMAIL_FROM,
      to: EMAIL_NOTIFICATION_RECIPIENTS,
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: `Новая запись ${booking.reference}`,
      text,
      html
    }
  });

  return { channel: "email", delivered: true };
}

function generateClientConfirmToken(bookingId) {
  return crypto.createHmac("sha256", FORM_TOKEN_SECRET).update(`confirm:${bookingId}`).digest("hex").slice(0, 32);
}

function verifyClientConfirmToken(bookingId, token) {
  const expected = generateClientConfirmToken(bookingId);
  return typeof token === "string" && token.length === 32 && token === expected;
}

async function getOrCreatePortalToken(booking) {
  try {
    const clientId = createClientProfileId({ clientName: booking.clientName, phone: booking.phone || "", email: booking.email || "" });
    const tokens = await readJson("portal-tokens.json");
    const existing = tokens.find(t => t.clientId === clientId);
    if (existing) return existing.token;
    const token = crypto.randomBytes(24).toString("hex");
    tokens.push({ token, clientId, clientName: booking.clientName, phone: booking.phone || "", createdAt: new Date().toISOString() });
    await writeJson("portal-tokens.json", tokens);
    return token;
  } catch { return null; }
}

// ── Платформа обучения: выдача доступа ученику ──────────────────────────────
// Вызывается при первом переходе заявки в статус "confirmed". Через защищённый
// вебхук платформа создаёт аккаунт ученика и сама отправляет письмо с доступом.
// Возвращает { skipped } если интеграция не настроена, иначе ответ платформы.
async function grantPlatformAccess(enrollment) {
  if (!PLATFORM_WEBHOOK_URL || !PLATFORM_WEBHOOK_SECRET) {
    return { skipped: true, reason: "not_configured" };
  }
  const fullName = String(enrollment.name || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Студент";
  const lastName = parts.slice(1).join(" ") || "—";
  const data = await requestJson(PLATFORM_WEBHOOK_URL, {
    method: "POST",
    body: {
      firstName,
      lastName,
      email: String(enrollment.email || "").trim().toLowerCase(),
      courseId: enrollment.courseId || null,
      language: enrollment.language || "ru",
      secret: PLATFORM_WEBHOOK_SECRET
    }
  });
  return { skipped: false, ...data };
}

async function sendClientConfirmationEmail(booking) {
  if (!RESEND_API_KEY || !EMAIL_FROM || !booking.email) {
    return { channel: "client-email", skipped: true };
  }

  const cancelUrl = SITE_URL
    ? `${SITE_URL}/cancel?ref=${encodeURIComponent(booking.reference)}`
    : null;

  const confirmUrl = SITE_URL
    ? `${SITE_URL}/confirm?id=${encodeURIComponent(booking.id)}&token=${generateClientConfirmToken(booking.id)}`
    : null;

  const portalToken = SITE_URL ? await getOrCreatePortalToken(booking) : null;
  const portalUrl = portalToken ? `${SITE_URL}/client?token=${portalToken}` : null;

  const ru = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const dateLabel = ru.format(new Date(`${booking.date}T12:00:00`)).replace(" г.", "");

  const brandColor = "#b36d2c";
  const bg = "#f7f0e6";
  const ink = "#241c17";
  const muted = "#7d6d60";

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">

        <tr>
          <td style="background:${brandColor};padding:28px 36px;">
            <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Студия массажа в Кишиневе</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Mateev Spa Studio</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 36px 24px;">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${muted};">Запись подтверждена</p>
            <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:${ink};">Ждём вас, ${escapeHtml(booking.clientName)}!</h1>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(26,46,34,0.05);border:1px solid rgba(26,46,34,0.12);border-radius:12px;overflow:hidden;margin-bottom:20px;">
              <tr><td style="padding:14px 18px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:16px;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent((SITE_URL || 'https://mateevmassage.com') + '/intake')}&bgcolor=ffffff&margin=4" width="80" height="80" alt="QR" style="border-radius:8px;display:block;"></td>
                  <td><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1a2e22;">Впервые у нас?</p>
                  <p style="margin:0;font-size:12px;color:${muted};line-height:1.5;">Заполните персональную карту пациента за 2–3 минуты до визита — это поможет специалисту лучше подготовиться.</p></td>
                </tr></table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(68,50,36,0.12);border-radius:14px;overflow:hidden;">
              <tr style="background:rgba(179,109,44,0.06);">
                <td style="padding:14px 18px;font-size:12px;color:${muted};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(68,50,36,0.10);" colspan="2">Детали записи</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(68,50,36,0.08);">
                <td style="padding:12px 18px;font-size:13px;color:${muted};width:40%;">Номер записи</td>
                <td style="padding:12px 18px;font-size:13px;font-weight:700;color:${ink};">${escapeHtml(booking.reference)}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(68,50,36,0.08);">
                <td style="padding:12px 18px;font-size:13px;color:${muted};">Процедура</td>
                <td style="padding:12px 18px;font-size:13px;color:${ink};">${escapeHtml(booking.serviceName)}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(68,50,36,0.08);">
                <td style="padding:12px 18px;font-size:13px;color:${muted};">Специалист</td>
                <td style="padding:12px 18px;font-size:13px;color:${ink};">${escapeHtml(booking.specialistName)}</td>
              </tr>
              <tr style="border-bottom:1px solid rgba(68,50,36,0.08);">
                <td style="padding:12px 18px;font-size:13px;color:${muted};">Дата и время</td>
                <td style="padding:12px 18px;font-size:13px;color:${ink};font-weight:600;">${escapeHtml(dateLabel)}, ${escapeHtml(booking.slot)}–${escapeHtml(booking.endsAt)}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;font-size:13px;color:${muted};">Стоимость</td>
                <td style="padding:12px 18px;font-size:13px;color:${ink};">${escapeHtml(String(booking.totalPrice))} MDL</td>
              </tr>
            </table>
          </td>
        </tr>

        ${confirmUrl ? `
        <tr>
          <td style="padding:24px 36px 8px;text-align:center;">
            <p style="margin:0 0 16px;font-size:14px;color:${muted};">Пожалуйста, подтвердите что придёте — это займёт один клик:</p>
            <a href="${confirmUrl}" style="display:inline-block;padding:16px 36px;background:#2a6b3e;border-radius:12px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.01em;">
              ✓ Подтверждаю — буду
            </a>
          </td>
        </tr>` : ""}

        ${cancelUrl ? `
        <tr>
          <td style="padding:16px 36px 32px;">
            <p style="margin:0 0 14px;font-size:13px;color:${muted};line-height:1.5;">
              Если планы изменились — отменить запись можно самостоятельно не позднее чем за ${CANCEL_CUTOFF_HOURS} ч до визита.
            </p>
            <a href="${cancelUrl}" style="display:inline-block;padding:12px 24px;background:transparent;border:1.5px solid rgba(68,50,36,0.25);border-radius:10px;font-size:13px;font-weight:600;color:${ink};text-decoration:none;">Отменить запись</a>
          </td>
        </tr>` : ""}

        <tr>
          <td style="padding:20px 36px;">
            <a href="${SITE_URL}/#booking?prefillService=${encodeURIComponent(booking.serviceId)}&prefillSpecialist=${encodeURIComponent(booking.specialistId)}"
               style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#b36d2c,#8d5320);color:#fff;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;">
              Записаться снова →
            </a>
          </td>
        </tr>

        ${portalUrl ? `<tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(26,46,34,0.04);border:1px solid rgba(26,46,34,0.10);border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${muted};">Ваш личный кабинет</p>
                  <p style="margin:0 0 12px;font-size:13px;color:${ink};line-height:1.5;">История визитов, абонементы и ближайшие записи — в одном месте.</p>
                  <a href="${portalUrl}" style="display:inline-block;padding:10px 20px;background:#1a2e22;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Открыть кабинет →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ""}

        <tr>
          <td style="padding:24px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);">
            <p style="margin:0;font-size:12px;color:${muted};line-height:1.6;">
              Если есть вопросы — напишите нам или позвоните.<br>
              Ждём вас в студии. До встречи!
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textLines = [
    `Запись подтверждена, ${booking.clientName}!`,
    "",
    `Номер записи: ${booking.reference}`,
    `Процедура: ${booking.serviceName}`,
    `Специалист: ${booking.specialistName}`,
    `Дата и время: ${dateLabel}, ${booking.slot}–${booking.endsAt}`,
    `Стоимость: ${booking.totalPrice} MDL`,
    confirmUrl ? `\nПодтвердить визит: ${confirmUrl}` : "",
    cancelUrl ? `Отменить запись: ${cancelUrl}` : "",
    portalUrl ? `\nЛичный кабинет: ${portalUrl}` : "",
    "",
    "Ждём вас. До встречи!"
  ].join("\n");

  await requestJson("https://api.resend.com/emails", {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    body: {
      from: EMAIL_FROM,
      to: [booking.email],
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: `Запись подтверждена — ${booking.serviceName} ${dateLabel}`,
      text: textLines,
      html
    }
  });

  return { channel: "client-email", delivered: true };
}

async function notifyMasterOfBooking(booking) {
  if (!TELEGRAM_BOT_TOKEN || !booking.specialistId) return;
  const tokens = await readJson("master-tokens.json").catch(() => []);
  const entry = tokens.find((t) => t.specialistId === booking.specialistId && t.telegramChatId);
  if (!entry) return;
  const text = `🆕 Новая запись к вам!\n\n💆 ${booking.serviceName}\n📅 ${booking.date}, ${booking.slot}–${booking.endsAt}\n👤 ${booking.clientName}${booking.phone ? " · " + booking.phone : ""}`;
  await tgSend(entry.telegramChatId, text);
}

async function notifyBookingCreated(booking) {
  const tasks = [sendTelegramNotification(booking), sendEmailNotification(booking), notifyMasterOfBooking(booking)];
  if (booking.email) tasks.push(sendClientConfirmationEmail(booking));

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Booking notification failed:", result.reason);
    }
  });
}

async function notifyWaitlistOnCancellation(cancelledBooking) {
  try {
    const waitlist = await readJson("waitlist.json").catch(() => []);
    const matches = waitlist.filter((entry) =>
      !entry.notified &&
      entry.date === cancelledBooking.date &&
      (
        !entry.specialistId || entry.specialistId === cancelledBooking.specialistId ||
        !entry.serviceId || entry.serviceId === cancelledBooking.serviceId
      )
    );

    if (!matches.length || !TELEGRAM_BOT_TOKEN) return;

    const ru = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
    const dateLabel = ru.format(new Date(`${cancelledBooking.date}T12:00:00`));
    const base = SITE_URL || "https://mateevmassage.com";

    // Карта phone(последние 8) → chatId клиентов с привязанным Telegram
    const tokens = await readJson("portal-tokens.json").catch(() => []);
    const linked = new Map();
    for (const t of tokens) {
      if (t.telegramChatId && t.phone) {
        const tail = normalizePhoneDigits(t.phone).slice(-8);
        if (tail) linked.set(tail, t.telegramChatId);
      }
    }

    for (const entry of matches) {
      const tail = normalizePhoneDigits(entry.phone || "").slice(-8);
      const clientChat = tail && linked.get(tail);
      if (clientChat) {
        // Пишем КЛИЕНТУ напрямую — он сам успевает записаться
        await tgSend(clientChat, `🔔 Освободилось место, о котором вы спрашивали!\n\n📅 ${dateLabel} · ${cancelledBooking.slot} · ${cancelledBooking.serviceName}\n\nУспейте записаться 👇`, {
          reply_markup: { inline_keyboard: [[{ text: "📅 Записаться", url: `${base}/#booking` }]] }
        });
      } else if (TELEGRAM_CHAT_ID) {
        // Клиент без Telegram → сообщаем администратору, чтобы позвонил
        await tgSend(TELEGRAM_CHAT_ID, `🔔 Освободилось место!\n\n${dateLabel} · ${cancelledBooking.serviceName} · ${cancelledBooking.slot}\n\nВ листе ожидания: ${entry.name}, ${entry.phone}\nСвяжитесь для подтверждения.`);
      }
      entry.notified = true;
      entry.notifiedAt = new Date().toISOString();
    }

    await writeJson("waitlist.json", waitlist);
  } catch {}
}

async function notifyBookingCancelledByClient(booking) {
  const text = [
    `Отмена записи ${booking.reference} (клиент)`,
    `Клиент: ${booking.clientName}`,
    `Телефон: ${booking.phone}`,
    `Услуга: ${booking.serviceName}`,
    `Специалист: ${booking.specialistName}`,
    `Дата: ${booking.date} в ${booking.slot}`
  ].join("\n");

  const promises = [];

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    promises.push(
      requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        body: { chat_id: TELEGRAM_CHAT_ID, text }
      }).catch((err) => console.error("Cancel telegram notify failed:", err))
    );
  }

  if (RESEND_API_KEY && EMAIL_FROM && EMAIL_NOTIFICATION_RECIPIENTS.length) {
    const html = text.split("\n").map((l) => `<p>${l}</p>`).join("");
    promises.push(
      requestJson("https://api.resend.com/emails", {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        body: {
          from: EMAIL_FROM,
          to: EMAIL_NOTIFICATION_RECIPIENTS,
          replyTo: EMAIL_REPLY_TO || undefined,
          subject: `Отмена записи ${booking.reference}`,
          text,
          html
        }
      }).catch((err) => console.error("Cancel email notify failed:", err))
    );
  }

  await Promise.allSettled(promises);
}

async function handleBookingCancel(request, response) {
  assertRateLimit({
    scope: "booking-cancel",
    key: getRequestIp(request),
    windowMs: 10 * 60 * 1000,
    limit: 5,
    message: "Слишком много попыток. Попробуйте через несколько минут."
  });

  const payload = await parseJsonBody(request);
  const reference = String(payload.reference || "").trim().toUpperCase();
  const phone = String(payload.phone || "").trim();

  if (!reference || !phone) {
    const err = new Error("Укажите номер записи и телефон.");
    err.statusCode = 400;
    throw err;
  }

  const bookings = await readJson("bookings.json");
  const booking = bookings.find((b) => b.reference.toUpperCase() === reference);

  if (!booking || !phonesMatch(booking.phone, phone)) {
    const err = new Error("Запись не найдена. Проверьте номер записи и телефон.");
    err.statusCode = 404;
    throw err;
  }

  if (!["new", "confirmed"].includes(booking.status)) {
    const statusText = { completed: "завершена", cancelled: "уже отменена" }[booking.status] || booking.status;
    const err = new Error(`Запись ${statusText} и не может быть отменена.`);
    err.statusCode = 409;
    throw err;
  }

  const appointmentMs = new Date(`${booking.date}T${booking.slot}:00`).getTime();
  const cutoffMs = CANCEL_CUTOFF_HOURS * 60 * 60 * 1000;
  if (Date.now() + cutoffMs > appointmentMs) {
    const err = new Error(
      CANCEL_CUTOFF_HOURS > 0
        ? `Самоотмена возможна не позднее чем за ${CANCEL_CUTOFF_HOURS} ч до визита. Пожалуйста, позвоните нам напрямую.`
        : "Время записи уже прошло."
    );
    err.statusCode = 409;
    throw err;
  }

  const updated = bookings.map((b) =>
    b.id === booking.id ? { ...b, status: "cancelled", updatedAt: new Date().toISOString() } : b
  );
  await writeJson("bookings.json", updated);

  void notifyBookingCancelledByClient(booking);
  void notifyWaitlistOnCancellation(booking);

  sendJson(response, 200, {
    message: "Ваша запись отменена.",
    reference: booking.reference
  });
}

function assertPublicBookingProtection(payload, request) {
  assertRateLimit({
    scope: "public-booking",
    key: getRequestIp(request),
    windowMs: BOOKING_RATE_WINDOW_MS,
    limit: BOOKING_RATE_LIMIT,
    message: "Слишком много заявок за короткое время. Повторите попытку чуть позже."
  });

  if (sanitizeText(payload.website)) {
    const error = new Error("Не удалось проверить форму. Обновите страницу и попробуйте снова.");
    error.statusCode = 400;
    throw error;
  }

  if (!getBookingProtectionPayload(payload.formToken)) {
    const error = new Error("Сессия формы устарела. Обновите страницу и отправьте заявку ещё раз.");
    error.statusCode = 400;
    throw error;
  }

}

function assertAdminPin(request) {
  if (getAdminSession(request)) {
    return;
  }

  const providedPin = hasLegacyAdminPin(request) ? ADMIN_PIN : "";

  if (!providedPin || providedPin !== ADMIN_PIN) {
    const error = new Error("Недостаточно прав для доступа к админ-панели.");
    error.statusCode = 401;
    throw error;
  }
}

function sortBookings(bookings) {
  return [...bookings].sort((left, right) => {
    const leftStamp = new Date(`${left.date}T${left.slot}:00`).getTime();
    const rightStamp = new Date(`${right.date}T${right.slot}:00`).getTime();
    return leftStamp - rightStamp;
  });
}

function sanitizeTimeString(value, fallback = "") {
  const time = sanitizeText(value, fallback);

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return fallback;
  }

  const [hours, minutes] = time.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isValidDateString(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || "")) &&
    !Number.isNaN(new Date(`${dateString}T00:00:00`).getTime());
}

function normalizeBreaks(breaksInput = [], fallback = DEFAULT_BREAKS) {
  const source = Array.isArray(breaksInput) ? breaksInput : fallback;

  return source
    .map((entry) => {
      const start = sanitizeTimeString(entry?.start, "");
      const end = sanitizeTimeString(entry?.end, "");
      const label = sanitizeText(entry?.label, "Перерыв");

      if (!start || !end || toMinutes(end) <= toMinutes(start)) {
        return null;
      }

      return {
        start,
        end,
        label
      };
    })
    .filter(Boolean)
    .sort((left, right) => toMinutes(left.start) - toMinutes(right.start));
}

function normalizeSpecialists(specialistsInput = [], services = []) {
  const source = Array.isArray(specialistsInput) ? specialistsInput : [];
  const validServiceIds = new Set(services.map((service) => service.id));
  const usedIds = new Set();

  return source
    .map((specialist, index) => {
      const name = sanitizeText(specialist?.name);
      const role = sanitizeText(specialist?.role);
      const experience = sanitizeText(specialist?.experience);
      const bio = sanitizeText(specialist?.bio);

      if (!name && !role && !experience && !bio) {
        return null;
      }

      let id = sanitizeSlug(specialist?.id, "");
      if (!id || usedIds.has(id)) {
        id = sanitizeSlug(name, createFallbackId("specialist"));
      }
      while (usedIds.has(id)) {
        id = `${id}-${index + 1}`;
      }
      usedIds.add(id);

      const specialties = (Array.isArray(specialist?.specialties)
        ? specialist.specialties
        : []
      )
        .map((item) => sanitizeText(item))
        .filter((item, itemIndex, array) => item && array.indexOf(item) === itemIndex)
        .filter((item) => validServiceIds.has(item));

      const legacyWorkDays = (Array.isArray(specialist?.workDays) ? specialist.workDays : [])
        .map((day) => Number(day))
        .filter((day, itemIndex, array) => Number.isInteger(day) && day >= 0 && day <= 6 && array.indexOf(day) === itemIndex)
        .sort((left, right) => left - right);

      const legacyStart = sanitizeTimeString(
        specialist?.workHours?.start || specialist?.workStart,
        DEFAULT_WORK_HOURS.start
      );
      const legacyEnd = sanitizeTimeString(
        specialist?.workHours?.end || specialist?.workEnd,
        DEFAULT_WORK_HOURS.end
      );
      const legacyWorkHours = toMinutes(legacyEnd) > toMinutes(legacyStart)
        ? { start: legacyStart, end: legacyEnd }
        : clone(DEFAULT_WORK_HOURS);
      const legacyDays = legacyWorkDays.length ? legacyWorkDays : [1, 2, 3, 4, 5];

      const rawDaySchedules = specialist?.daySchedules;
      const daySchedules = Object.fromEntries(
        [0, 1, 2, 3, 4, 5, 6].map((d) => {
          const raw = rawDaySchedules && (rawDaySchedules[d] ?? rawDaySchedules[String(d)]);
          if (raw && typeof raw === "object") {
            const s = sanitizeTimeString(raw.start, legacyWorkHours.start);
            const e = sanitizeTimeString(raw.end, legacyWorkHours.end);
            return [d, { enabled: !!raw.enabled, start: s, end: toMinutes(e) > toMinutes(s) ? e : legacyWorkHours.end }];
          }
          return [d, { enabled: legacyDays.includes(d), start: legacyWorkHours.start, end: legacyWorkHours.end }];
        })
      );

      const workDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => daySchedules[d].enabled);

      const roleRo = sanitizeText(specialist?.roleRo);
      const bioRo = sanitizeText(specialist?.bioRo);

      return {
        id,
        name: name || `Специалист ${index + 1}`,
        role: role || "Специалист",
        experience,
        bio,
        specialties,
        workDays: workDays.length ? workDays : legacyDays,
        workHours: legacyWorkHours,
        daySchedules,
        breaks: normalizeBreaks(specialist?.breaks),
        initials: sanitizeText(specialist?.initials) || buildInitials(name),
        photo: (typeof specialist?.photo === "string" && /^\/uploads\/specialists\/[\w.-]+$/.test(specialist.photo)) ? specialist.photo : null,
        certified: specialist?.certified === true,
        commissionPercent: Math.max(0, Math.min(100, Number(specialist?.commissionPercent) || 0)),
        ...(sanitizeText(specialist?.location) && { location: sanitizeText(specialist?.location) }),
        ...(sanitizeText(specialist?.address) && { address: sanitizeText(specialist?.address) }),
        ...(roleRo && { roleRo }),
        ...(bioRo && { bioRo })
      };
    })
    .filter(Boolean);
}

function normalizeScheduleData(scheduleInput = {}, specialists = []) {
  const source = Array.isArray(scheduleInput)
    ? { blocks: scheduleInput }
    : scheduleInput && typeof scheduleInput === "object"
      ? scheduleInput
      : {};
  const validSpecialistIds = new Set(specialists.map((specialist) => specialist.id));
  const usedIds = new Set();

  return {
    blocks: (Array.isArray(source.blocks) ? source.blocks : [])
      .map((block) => {
        const specialistId = sanitizeText(block?.specialistId);
        const date = sanitizeText(block?.date);
        const start = sanitizeTimeString(block?.start, "");
        const end = sanitizeTimeString(block?.end, "");
        const reason = sanitizeText(block?.reason, "Блокировка");
        const note = sanitizeText(block?.note, "");

        if (!validSpecialistIds.has(specialistId) || !isValidDateString(date) || !start || !end) {
          return null;
        }

        if (toMinutes(end) <= toMinutes(start)) {
          return null;
        }

        let id = sanitizeSlug(block?.id, "");
        if (!id || usedIds.has(id)) {
          id = crypto.randomUUID();
        }
        while (usedIds.has(id)) {
          id = crypto.randomUUID();
        }
        usedIds.add(id);

        return {
          id,
          specialistId,
          date,
          start,
          end,
          reason,
          ...(note ? { note } : {})
        };
      })
      .filter(Boolean)
      .sort((left, right) => `${left.date}T${left.start}`.localeCompare(`${right.date}T${right.start}`))
  };
}

function timeRangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function getSpecialistDaySchedule(specialist, dateString) {
  const dayIndex = getDayIndex(dateString);
  const dayConfig = specialist.daySchedules?.[dayIndex];
  return {
    isWorkingDay: specialist.workDays.includes(dayIndex),
    workHours: dayConfig ? { start: dayConfig.start, end: dayConfig.end } : (specialist.workHours || clone(DEFAULT_WORK_HOURS)),
    breaks: normalizeBreaks(specialist.breaks, [])
  };
}

function getActiveBookingsForSpecialist(bookings, specialistId, dateString, excludeBookingId = "") {
  return bookings.filter(
    (booking) =>
      booking.date === dateString &&
      booking.specialistId === specialistId &&
      booking.status !== "cancelled" &&
      booking.id !== excludeBookingId
  );
}

function getBlocksForSpecialist(schedule, specialistId, dateString) {
  return (schedule?.blocks || []).filter(
    (block) => block.specialistId === specialistId && block.date === dateString
  );
}

function getDayIntervals({ date, specialist, bookings, schedule, excludeBookingId = "" }) {
  const daySchedule = getSpecialistDaySchedule(specialist, date);

  const bookingIntervals = getActiveBookingsForSpecialist(
    bookings,
    specialist.id,
    date,
    excludeBookingId
  ).map((booking) => ({
    type: "booking",
    start: booking.slot,
    end: booking.endsAt,
    booking
  }));

  const breakIntervals = daySchedule.breaks.map((entry) => ({
    type: "break",
    start: entry.start,
    end: entry.end,
    label: entry.label
  }));

  const blockedIntervals = getBlocksForSpecialist(schedule, specialist.id, date).map((block) => ({
    type: "block",
    start: block.start,
    end: block.end,
    block
  }));

  return {
    ...daySchedule,
    intervals: [...bookingIntervals, ...breakIntervals, ...blockedIntervals].sort(
      (left, right) => toMinutes(left.start) - toMinutes(right.start)
    ),
    bookings: bookingIntervals.map((entry) => entry.booking),
    blocks: blockedIntervals.map((entry) => entry.block)
  };
}

function calculateAvailability({ date, service, specialist, bookings, schedule = { blocks: [] }, excludeBookingId = "", adminMode = false }) {
  const daySchedule = getDayIntervals({
    date,
    specialist,
    bookings,
    schedule,
    excludeBookingId
  });

  if (!daySchedule.isWorkingDay) {
    return {
      slots: [],
      message: "У выбранного специалиста нет приема в этот день."
    };
  }

  const open = toMinutes(daySchedule.workHours.start);
  const close = toMinutes(daySchedule.workHours.end);
  const slots = [];

  // Skip past slots + enforce minimum notice (Moldova timezone)
  const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Chisinau" }));
  const todayString = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,"0")}-${String(nowLocal.getDate()).padStart(2,"0")}`;
  const tomorrowLocal = new Date(nowLocal);
  tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);
  const tomorrowString = `${tomorrowLocal.getFullYear()}-${String(tomorrowLocal.getMonth()+1).padStart(2,"0")}-${String(tomorrowLocal.getDate()).padStart(2,"0")}`;
  // nowMinutes + BOOKING_MIN_NOTICE_HOURS: block slots within the notice window
  const nowTotalMinutes = nowLocal.getHours() * 60 + nowLocal.getMinutes() + BOOKING_MIN_NOTICE_HOURS * 60;
  const nowMinutes = date === todayString
    ? nowTotalMinutes
    : date === tomorrowString
      ? Math.max(0, nowTotalMinutes - 24 * 60)
      : 0;

  for (let current = open; current + service.duration <= close; current += SLOT_STEP_MINUTES) {
    const candidateStart = current;
    const candidateEnd = current + service.duration;

    if (!adminMode && candidateStart <= nowMinutes) {
      continue;
    }

    const hasConflict = daySchedule.intervals.some((entry) =>
      timeRangesOverlap(
        candidateStart,
        candidateEnd,
        toMinutes(entry.start),
        toMinutes(entry.end)
      )
    );

    if (!hasConflict) {
      slots.push({
        time: toTimeString(candidateStart),
        endsAt: toTimeString(candidateEnd)
      });
    }
  }

  return {
    slots,
    message: slots.length
      ? `Найдено ${slots.length} доступных окон.`
      : "Свободных окон на эту дату больше нет."
  };
}

function validateBookingPayload(payload, services, specialists, options = {}) {
  const requiredFields = options.adminMode
    ? ["serviceId", "specialistId", "date", "slot", "clientName"]
    : ["serviceId", "specialistId", "date", "slot", "clientName", "phone"];

  for (const field of requiredFields) {
    if (!payload[field] || typeof payload[field] !== "string") {
      throw new Error("Заполните обязательные поля формы.");
    }
  }

  if (!isValidDateString(payload.date)) {
    throw new Error("Дата записи указана в неверном формате.");
  }

  const slot = sanitizeTimeString(payload.slot);
  if (!slot) {
    throw new Error("Время записи указано в неверном формате.");
  }

  const service = services.find((item) => item.id === payload.serviceId);
  const specialist = specialists.find((item) => item.id === payload.specialistId);

  if (!service) {
    throw new Error("Выбранная процедура не найдена.");
  }

  if (!specialist) {
    throw new Error("Выбранный специалист не найден.");
  }

  if (!specialist.specialties.includes(service.id)) {
    throw new Error("Этот специалист не ведет выбранную процедуру.");
  }

  if (!options.allowPast && !isFutureOrToday(payload.date)) {
    throw new Error("Можно записаться только на сегодняшнюю или будущую дату.");
  }

  const trimmedName = payload.clientName.trim();
  const trimmedPhone = payload.phone.trim();
  const trimmedEmail = (payload.email || "").trim();
  const trimmedNotes = (payload.notes || "").trim();

  if (trimmedName.length < 2) {
    throw new Error("Имя клиента слишком короткое.");
  }

  if (!options.adminMode) {
    if (trimmedPhone.replace(/\D/g, "").length < 8) {
      throw new Error("Укажите корректный номер телефона.");
    }

    if (!trimmedEmail) {
      throw new Error("Укажите email — он нужен для отправки подтверждения записи.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error("Email указан в неверном формате.");
    }
  }

  return {
    service,
    specialist,
    cleanPayload: {
      clientName: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      notes: trimmedNotes,
      status:
        payload.status && BOOKING_STATUSES.includes(payload.status)
          ? payload.status
          : options.defaultStatus || "new"
    },
    slot
  };
}

function createBookingRecord({ payload, cleanPayload, service, specialist, meta = {} }) {
  const now = new Date().toISOString();
  const startMins = toMinutes(payload.slot);
  const endMins = startMins + service.duration;
  // Реферал: другу −10% на этот визит (авто)
  const hasReferral = !!meta.referredByCode;
  const totalPrice = hasReferral ? Math.round(service.price * 0.9) : service.price;

  return {
    id: crypto.randomUUID(),
    reference: `MS-${Date.now().toString().slice(-6)}`,
    status: cleanPayload.status,
    createdAt: now,
    updatedAt: now,
    serviceId: service.id,
    serviceName: service.name,
    specialistId: specialist.id,
    specialistName: specialist.name,
    date: payload.date,
    slot: payload.slot,
    endsAt: toTimeString(endMins),
    durationMins: service.duration,
    totalPrice,
    clientName: cleanPayload.clientName,
    phone: cleanPayload.phone,
    email: cleanPayload.email,
    notes: cleanPayload.notes,
    source: meta.source || "public",
    ...(hasReferral ? { referredByCode: meta.referredByCode, referredByName: meta.referredByName, referralDiscount: 10 } : {})
  };
}

function mergeBookingUpdate(existingBooking, payload) {
  return {
    serviceId: sanitizeText(payload.serviceId, existingBooking.serviceId),
    specialistId: sanitizeText(payload.specialistId, existingBooking.specialistId),
    date: sanitizeText(payload.date, existingBooking.date),
    slot: sanitizeText(payload.slot, existingBooking.slot),
    clientName: sanitizeText(payload.clientName, existingBooking.clientName),
    phone: sanitizeText(payload.phone, existingBooking.phone),
    email:
      typeof payload.email === "string"
        ? payload.email
        : existingBooking.email || "",
    notes:
      typeof payload.notes === "string"
        ? payload.notes
        : existingBooking.notes || "",
    status:
      typeof payload.status === "string" && BOOKING_STATUSES.includes(payload.status)
        ? payload.status
        : existingBooking.status
  };
}

function applyBookingUpdate(existingBooking, { payload, cleanPayload, service, specialist }) {
  const startMins = toMinutes(payload.slot);
  const endMins = startMins + service.duration;

  return {
    ...existingBooking,
    serviceId: service.id,
    serviceName: service.name,
    specialistId: specialist.id,
    specialistName: specialist.name,
    date: payload.date,
    slot: payload.slot,
    endsAt: toTimeString(endMins),
    durationMins: service.duration,
    totalPrice: service.price,
    clientName: cleanPayload.clientName,
    phone: cleanPayload.phone,
    email: cleanPayload.email,
    notes: cleanPayload.notes,
    status: cleanPayload.status,
    updatedAt: new Date().toISOString()
  };
}

function buildDaySchedulePayload({ date, specialists, bookings, schedule }) {
  const specialistDays = specialists.map((specialist) => {
    const daySchedule = getDayIntervals({
      date,
      specialist,
      bookings,
      schedule
    });

    const events = [
      ...daySchedule.breaks.map((entry) => ({
        id: `${specialist.id}-${date}-${entry.start}-${entry.end}-break`,
        type: "break",
        start: entry.start,
        end: entry.end,
        title: entry.label
      })),
      ...daySchedule.blocks.map((block) => ({
        id: block.id,
        type: "block",
        start: block.start,
        end: block.end,
        title: block.reason
      })),
      ...daySchedule.bookings.map((booking) => ({
        id: booking.id,
        type: "booking",
        start: booking.slot,
        end: booking.endsAt,
        title: `${booking.clientName} · ${booking.serviceName}`,
        status: booking.status,
        booking
      }))
    ].sort((left, right) => toMinutes(left.start) - toMinutes(right.start));

    return {
      id: specialist.id,
      name: specialist.name,
      role: specialist.role,
      initials: specialist.initials,
      isWorkingDay: daySchedule.isWorkingDay,
      workHours: daySchedule.workHours,
      breaks: daySchedule.breaks,
      blocks: daySchedule.blocks,
      bookings: sortBookings(daySchedule.bookings),
      events
    };
  });

  return {
    date,
    summary: {
      specialistsOnDuty: specialistDays.filter((item) => item.isWorkingDay).length,
      totalBookings: specialistDays.reduce((sum, item) => sum + item.bookings.length, 0),
      newBookings: specialistDays.reduce(
        (sum, item) => sum + item.bookings.filter((booking) => booking.status === "new").length,
        0
      ),
      confirmedBookings: specialistDays.reduce(
        (sum, item) => sum + item.bookings.filter((booking) => booking.status === "confirmed").length,
        0
      ),
      blockedPeriods: specialistDays.reduce((sum, item) => sum + item.blocks.length, 0)
    },
    specialists: specialistDays
  };
}

function normalizeClientProfiles(profilesInput = []) {
  const source = Array.isArray(profilesInput) ? profilesInput : [];
  const usedIds = new Set();

  return source
    .map((profile) => {
      let id = sanitizeText(profile?.id);
      if (!id || usedIds.has(id)) {
        return null;
      }
      usedIds.add(id);

      const status = sanitizeText(profile?.status, "regular");

      return {
        id,
        status: ["new", "regular", "vip", "attention"].includes(status) ? status : "regular",
        note: sanitizeText(profile?.note),
        tag: sanitizeText(profile?.tag),
        // Контактные поля: для ручных клиентов — основные данные, для остальных —
        // override (правка имени/телефона/email из карточки поверх данных из броней).
        ...(sanitizeText(profile?.clientName) && { clientName: sanitizeText(profile?.clientName) }),
        ...(sanitizeText(profile?.phone) && { phone: sanitizeText(profile?.phone) }),
        ...(sanitizeText(profile?.email) && { email: sanitizeText(profile?.email) }),
        ...(profile?.manuallyAdded && {
          manuallyAdded: true,
          createdAt: sanitizeText(profile?.createdAt || "")
        }),
        ...(profile?.medCard && { medCard: profile.medCard }),
        ...(profile?.portalToken && { portalToken: profile.portalToken })
      };
    })
    .filter(Boolean);
}

function buildAdminClients(bookings, profiles = []) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const clientMap = new Map();
  const phoneIndex = new Map(); // normalizedPhone → clientId
  const now = Date.now();

  sortBookings(bookings).forEach((booking) => {
    const rawPhone = normalizePhoneDigits(booking.phone || "");

    // Deduplicate by phone number — same phone = same client
    let clientId = rawPhone ? phoneIndex.get(rawPhone) : null;
    if (!clientId) {
      clientId = createClientProfileId(booking);
      if (rawPhone) phoneIndex.set(rawPhone, clientId);
    }

    const existing = clientMap.get(clientId) || {
      id: clientId,
      clientName: booking.clientName,
      phone: booking.phone || "",
      email: booking.email || "",
      totalVisits: 0,
      completedVisits: 0,
      cancelledVisits: 0,
      upcomingVisits: 0,
      totalSpent: 0,
      serviceCounts: new Map(),
      specialistCounts: new Map(),
      history: []
    };

    // Keep most complete data: prefer name with more chars, keep email if any
    if ((booking.clientName || "").length > (existing.clientName || "").length) {
      existing.clientName = booking.clientName;
    }
    existing.phone = existing.phone || booking.phone || "";
    existing.email = existing.email || booking.email || "";
    existing.history.push(booking);

    if (booking.status === "cancelled") {
      existing.cancelledVisits += 1;
    } else {
      existing.totalVisits += 1;
      if (booking.status === "completed") {
        existing.completedVisits += 1;
      }
      if (booking.status === "confirmed" || booking.status === "completed") {
        existing.totalSpent += Number(booking.totalPrice || 0);
      }
      if (new Date(`${booking.date}T${booking.slot}:00`).getTime() >= now) {
        existing.upcomingVisits += 1;
      }
      existing.serviceCounts.set(
        booking.serviceName,
        (existing.serviceCounts.get(booking.serviceName) || 0) + 1
      );
      existing.specialistCounts.set(
        booking.specialistName,
        (existing.specialistCounts.get(booking.specialistName) || 0) + 1
      );
    }

    clientMap.set(clientId, existing);
  });

  return Array.from(clientMap.values())
    .map((client) => {
      const history = [...client.history].sort(
        (left, right) => new Date(`${right.date}T${right.slot}:00`).getTime() - new Date(`${left.date}T${left.slot}:00`).getTime()
      );
      const profile = profileMap.get(client.id);
      const favoriteServices = Array.from(client.serviceCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
      const favoriteSpecialists = Array.from(client.specialistCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
      const upcomingBooking = history
        .filter((booking) => booking.status !== "cancelled")
        .find((booking) => new Date(`${booking.date}T${booking.slot}:00`).getTime() >= now);

      return {
        id: client.id,
        clientName: profile?.clientName || client.clientName,
        phone: profile?.phone || client.phone,
        email: profile?.email || client.email,
        status: profile?.status || (client.totalVisits <= 1 ? "new" : "regular"),
        note: profile?.note || "",
        tag: profile?.tag || "",
        totalVisits: client.totalVisits,
        completedVisits: client.completedVisits,
        cancelledVisits: client.cancelledVisits,
        upcomingVisits: client.upcomingVisits,
        totalSpent: client.totalSpent,
        lastBooking: history[0] || null,
        upcomingBooking: upcomingBooking || null,
        favoriteServices,
        favoriteSpecialists,
        history,
        medCard: profile?.medCard || null
      };
    })
    .sort((left, right) => {
      const leftStamp = left.lastBooking
        ? new Date(`${left.lastBooking.date}T${left.lastBooking.slot}:00`).getTime()
        : 0;
      const rightStamp = right.lastBooking
        ? new Date(`${right.lastBooking.date}T${right.lastBooking.slot}:00`).getTime()
        : 0;
      return rightStamp - leftStamp;
    })
    .concat(
      // Manual clients with no bookings
      profiles
        .filter(p => p.manuallyAdded && !clientMap.has(p.id))
        .map(p => ({
          id: p.id,
          clientName: p.clientName,
          phone: p.phone,
          email: p.email || "",
          status: p.status || "new",
          note: p.note || "",
          tag: p.tag || "",
          totalVisits: 0, completedVisits: 0, cancelledVisits: 0, upcomingVisits: 0, totalSpent: 0,
          lastBooking: null, upcomingBooking: null,
          favoriteServices: [], favoriteSpecialists: [], history: [], medCard: p.medCard || null
        }))
    );
}

function buildAdminStats(bookings) {
  const stats = {
    total: bookings.length,
    new: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    revenue: 0
  };

  for (const booking of bookings) {
    stats[booking.status] += 1;

    if (booking.status === "confirmed" || booking.status === "completed") {
      stats.revenue += booking.totalPrice;
    }
  }

  return stats;
}

function detectClosure(schedule) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
  const blocks = (schedule?.blocks || []).filter(b => b.date >= today && b.start === "00:00");
  if (blocks.length < 2) return null;
  const sorted = [...new Set(blocks.map(b => b.date))].sort();
  // Find consecutive range starting from today or nearby
  let start = null, end = null, streak = 0;
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(new Date(sorted[0] + "T00:00:00").getTime() + i * 86400000)
      .toISOString().slice(0, 10);
    if (sorted[i] === expected) {
      if (!start) start = sorted[i];
      end = sorted[i];
      streak++;
    } else break;
  }
  if (streak < 2) return null;
  // Pick up an optional public-facing message stored on any block within the range
  const note = blocks.find((b) => b.date >= start && b.date <= end && b.note)?.note || "";
  return { from: start, to: end, note };
}

async function handleBootstrap(response) {
  const [rawServices, rawSpecialists, rawSite, bookings, schedule, credentials] = await Promise.all([
    readJson("services.json"),
    readJson("specialists.json"),
    readJson("site.json"),
    readJson("bookings.json"),
    readJson("schedule.json").catch(() => ({})),
    readJson("credentials.json").catch(() => [])
  ]);

  const services = normalizeServices(rawServices);
  const specialists = normalizeSpecialists(rawSpecialists, services);
  const site = normalizeSiteContent(rawSite);
  const closure = detectClosure(schedule);

  sendJson(response, 200, {
    services,
    specialists,
    site,
    closure,
    credentials: (Array.isArray(credentials) ? credentials : []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
    meta: {
      existingBookings: bookings.length,
      bookingProtectionToken: createBookingProtectionToken()
    }
  });
}

async function handleAdminSessionCreate(request, response) {
  assertRateLimit({
    scope: "admin-login",
    key: getRequestIp(request),
    windowMs: ADMIN_LOGIN_RATE_WINDOW_MS,
    limit: ADMIN_LOGIN_RATE_LIMIT,
    message: "Слишком много попыток входа. Подождите немного и попробуйте снова."
  });

  const payload = await parseJsonBody(request);
  const pin = sanitizeEnv(payload.pin);
  let role = null;
  if (pin === ADMIN_PIN) role = "admin";
  else if (STAFF_PIN && pin === STAFF_PIN) role = "staff";

  if (!role) {
    const error = new Error("PIN не подошёл.");
    error.statusCode = 401;
    throw error;
  }

  const sessionToken = createAdminSessionToken(role);
  const session = readSignedToken(sessionToken, ADMIN_SESSION_SECRET);

  sendJson(
    response,
    200,
    {
      authenticated: true,
      expiresAt: session?.exp || Date.now() + ADMIN_SESSION_TTL_MS
    },
    {
      "Set-Cookie": buildAdminSessionCookie(sessionToken, request)
    }
  );
}

async function handleAdminSessionStatus(request, response) {
  const session = getAdminSession(request);
  if (!session) {
    sendJson(response, 401, {
      message: "Сессия администратора не найдена."
    });
    return;
  }

  sendJson(response, 200, {
    authenticated: true,
    role: session.role || "admin",
    expiresAt: session.exp
  });
}

async function handleAdminSessionDelete(request, response) {
  sendJson(
    response,
    200,
    {
      authenticated: false
    },
    {
      "Set-Cookie": buildExpiredAdminSessionCookie(request)
    }
  );
}

async function loadStudioData() {
  const [rawServices, rawSpecialists, rawSite, bookings, rawSchedule, rawClients] = await Promise.all([
    readJson("services.json"),
    readJson("specialists.json"),
    readJson("site.json"),
    readJson("bookings.json"),
    readJson("schedule.json"),
    readJson("clients.json")
  ]);

  const services = normalizeServices(rawServices);
  const specialists = normalizeSpecialists(rawSpecialists, services);
  const site = normalizeSiteContent(rawSite);
  const schedule = normalizeScheduleData(rawSchedule, specialists);
  const clients = normalizeClientProfiles(rawClients);

  return {
    services,
    specialists,
    site,
    bookings,
    schedule,
    clients
  };
}

async function handleAvailability(urlObject, response) {
  const serviceId = urlObject.searchParams.get("serviceId");
  const specialistId = urlObject.searchParams.get("specialistId");
  const date = urlObject.searchParams.get("date");
  const excludeBookingId = sanitizeText(urlObject.searchParams.get("excludeBookingId"));
  const customDuration = parseInt(urlObject.searchParams.get("customDuration") || "0", 10) || 0;
  const adminMode = urlObject.searchParams.get("admin") === "true";

  if (!serviceId || !specialistId || !date) {
    sendJson(response, 400, {
      message: "Для поиска слотов передай serviceId, specialistId и date."
    });
    return;
  }

  if (!adminMode && !isFutureOrToday(date)) {
    sendJson(response, 400, {
      message: "Нельзя получить доступность для прошедшей даты."
    });
    return;
  }

  const { services, specialists, bookings, schedule } = await loadStudioData();
  const service = services.find((item) => item.id === serviceId);
  const specialist = specialists.find((item) => item.id === specialistId);

  if (!service || !specialist) {
    sendJson(response, 404, {
      message: "Процедура или специалист не найдены."
    });
    return;
  }

  if (!specialist.specialties.includes(service.id)) {
    sendJson(response, 400, {
      message: "Этот специалист не работает с выбранной процедурой."
    });
    return;
  }

  const effectiveService = customDuration > 0
    ? { ...service, duration: customDuration }
    : service;

  const availability = calculateAvailability({
    date,
    service: effectiveService,
    specialist,
    bookings,
    schedule,
    excludeBookingId,
    adminMode
  });

  sendJson(response, 200, availability);
}

async function handleBookingCreate(request, response) {
  const payload = await parseJsonBody(request);
  assertPublicBookingProtection(payload, request);
  const { services, specialists, bookings, schedule } = await loadStudioData();
  const { service, specialist, cleanPayload, slot } = validateBookingPayload(
    payload,
    services,
    specialists
  );

  const customDuration = parseInt(payload.customDuration || "0", 10) || 0;
  const effectiveService = customDuration > 0 && customDuration !== service.duration
    ? { ...service, duration: customDuration, price: Math.round((service.price / service.duration) * customDuration / 50) * 50 }
    : service;

  const safePayload = { ...payload, slot };
  const availability = calculateAvailability({
    date: safePayload.date,
    service: effectiveService,
    specialist,
    bookings,
    schedule
  });

  if (!availability.slots.some((entry) => entry.time === safePayload.slot)) {
    sendJson(response, 409, {
      message: "Это окно уже занято. Обнови слоты и выбери другое время."
    });
    return;
  }

  // Реферал: засчитываем только НОВОМУ клиенту (телефона не было в базе) и не самому себе
  let referredBy = null;
  const referralCode = sanitizeText(payload.referralCode || "");
  if (referralCode) {
    const referrals = await readJson("referrals.json").catch(() => []);
    const ref = referrals.find((r) => r.code.toUpperCase() === referralCode.toUpperCase());
    const friendDigits = normalizePhoneDigits(cleanPayload.phone);
    const isExistingClient = bookings.some((b) => normalizePhoneDigits(b.phone) === friendDigits);
    if (ref && normalizePhoneDigits(ref.phone) !== friendDigits && !isExistingClient) {
      referredBy = { referredByCode: ref.code, referredByName: ref.clientName };
    }
  }

  const booking = createBookingRecord({
    payload: safePayload,
    cleanPayload,
    service: effectiveService,
    specialist,
    meta: {
      source: "public",
      ...(referredBy || {})
    }
  });

  const nextBookings = sortBookings([...bookings, booking]);
  await writeJson("bookings.json", nextBookings);

  const certCode = sanitizeText(payload.certificateCode || "");
  if (certCode) {
    const certs = await readJson("certificates.json");
    const certIdx = certs.findIndex(c => c.code.toUpperCase() === certCode.toUpperCase() && c.status === "active");
    if (certIdx !== -1) {
      certs[certIdx].status = "used";
      certs[certIdx].usedAt = new Date().toISOString();
      certs[certIdx].usedInBooking = booking.reference;
      await writeJson("certificates.json", certs);
    }
  }

  void notifyBookingCreated(booking);

  sendJson(response, 201, {
    message: "Запись успешно создана.",
    booking,
    meta: {
      bookingProtectionToken: createBookingProtectionToken()
    }
  });
}

async function handleAdminBookings(request, response) {
  assertAdminPin(request);

  const { bookings, site, schedule } = await loadStudioData();

  sendJson(response, 200, {
    stats: buildAdminStats(bookings),
    bookings: sortBookings(bookings),
    currency: site.brand.currency,
    scheduleStats: {
      blocks: schedule.blocks.length
    }
  });
}

async function handleAdminClients(request, response) {
  assertAdminPin(request);

  const { bookings, clients } = await loadStudioData();

  sendJson(response, 200, {
    clients: buildAdminClients(bookings, clients)
  });
}

async function handleAdminDay(request, response, urlObject) {
  assertAdminPin(request);

  const date = sanitizeText(urlObject.searchParams.get("date"));
  if (!isValidDateString(date)) {
    sendJson(response, 400, {
      message: "Передайте корректную дату в формате YYYY-MM-DD."
    });
    return;
  }

  const { specialists, bookings, schedule } = await loadStudioData();

  sendJson(
    response,
    200,
    buildDaySchedulePayload({
      date,
      specialists,
      bookings,
      schedule
    })
  );
}

async function handleAdminBookingCreate(request, response) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);
  const { services, specialists, bookings, schedule } = await loadStudioData();
  const { service, specialist, cleanPayload, slot } = validateBookingPayload(
    payload,
    services,
    specialists,
    {
      defaultStatus: "confirmed",
      adminMode: true,
      allowPast: true
    }
  );

  // Apply custom duration and/or price if provided
  const customDuration = parseInt(payload.customDuration || "0", 10) || 0;
  const customPrice = parseInt(payload.customPrice || "0", 10) || 0;
  const effectiveService = (customDuration > 0 && customDuration !== service.duration) || customPrice > 0
    ? {
        ...service,
        duration: customDuration > 0 ? customDuration : service.duration,
        price: customPrice > 0 ? customPrice : Math.round((service.price / service.duration) * (customDuration || service.duration) / 50) * 50
      }
    : service;

  const safePayload = { ...payload, slot };
  const isPastDate = safePayload.date < new Date().toISOString().slice(0, 10);
  if (!isPastDate) {
    const availability = calculateAvailability({
      date: safePayload.date,
      service: effectiveService,
      specialist,
      bookings,
      schedule,
      adminMode: true
    });
    if (!availability.slots.some((entry) => entry.time === safePayload.slot)) {
      sendJson(response, 409, {
        message: "Выбранный слот недоступен. Обновите расписание и попробуйте снова."
      });
      return;
    }
  }

  const booking = createBookingRecord({
    payload: safePayload,
    cleanPayload,
    service: effectiveService,
    specialist,
    meta: {
      source: "admin"
    }
  });

  const nextBookings = sortBookings([...bookings, booking]);
  await writeJson("bookings.json", nextBookings);
  void notifyBookingCreated(booking);

  sendJson(response, 201, {
    message: "Запись создана из админ-панели.",
    booking
  });
}

async function handleBookingStatusUpdate(request, response, bookingId) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);
  const { services, specialists, bookings, schedule } = await loadStudioData();
  const bookingIndex = bookings.findIndex((booking) => booking.id === bookingId);

  if (bookingIndex === -1) {
    sendJson(response, 404, {
      message: "Запись не найдена."
    });
    return;
  }

  const currentBooking = bookings[bookingIndex];
  const hasStructuralUpdate = [
    "serviceId",
    "specialistId",
    "date",
    "slot",
    "clientName",
    "phone",
    "email",
    "notes"
  ].some((field) => Object.prototype.hasOwnProperty.call(payload, field));

  if (!hasStructuralUpdate) {
    if (!payload.status || !BOOKING_STATUSES.includes(payload.status)) {
      sendJson(response, 400, {
        message: "Передайте корректный статус записи."
      });
      return;
    }

    bookings[bookingIndex] = {
      ...currentBooking,
      status: payload.status,
      updatedAt: new Date().toISOString()
    };

    const nextBookings = sortBookings(bookings);
    await writeJson("bookings.json", nextBookings);

    if (payload.status === "cancelled" && currentBooking.status !== "cancelled") {
      void notifyWaitlistOnCancellation(bookings[bookingIndex]);
    }

    sendJson(response, 200, {
      message: "Статус записи обновлен.",
      booking: nextBookings.find((booking) => booking.id === bookingId)
    });
    return;
  }

  const mergedPayload = mergeBookingUpdate(currentBooking, payload);
  const { service, specialist, cleanPayload, slot } = validateBookingPayload(
    mergedPayload,
    services,
    specialists,
    {
      defaultStatus: currentBooking.status,
      adminMode: true
    }
  );
  const safePayload = {
    ...mergedPayload,
    slot
  };
  const availability = calculateAvailability({
    date: safePayload.date,
    service,
    specialist,
    bookings,
    schedule,
    excludeBookingId: bookingId
  });

  if (!availability.slots.some((entry) => entry.time === safePayload.slot)) {
    sendJson(response, 409, {
      message: "Новое окно недоступно. Выберите другой слот."
    });
    return;
  }

  const customDur = parseInt(payload.customDuration || "0", 10) || 0;
  const customPrc = parseInt(payload.customPrice || "0", 10) || 0;
  const effectiveSvc = (customDur > 0 && customDur !== service.duration) || customPrc > 0
    ? {
        ...service,
        duration: customDur > 0 ? customDur : service.duration,
        price: customPrc > 0 ? customPrc : Math.round((service.price / service.duration) * (customDur || service.duration) / 50) * 50
      }
    : service;

  bookings[bookingIndex] = applyBookingUpdate(currentBooking, {
    payload: safePayload,
    cleanPayload,
    service: effectiveSvc,
    specialist
  });

  const nextBookings = sortBookings(bookings);
  await writeJson("bookings.json", nextBookings);

  sendJson(response, 200, {
    message: "Запись обновлена.",
    booking: nextBookings.find((booking) => booking.id === bookingId)
  });
}

async function handleAdminBlockCreate(request, response) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);
  const { specialists, bookings, schedule } = await loadStudioData();
  const specialistId = sanitizeText(payload.specialistId);
  const date = sanitizeText(payload.date);
  const start = sanitizeTimeString(payload.start, "");
  const end = sanitizeTimeString(payload.end, "");
  const reason = sanitizeText(payload.reason, "Блокировка");
  const note = sanitizeText(payload.note, "");
  const force = payload.force === true;
  const specialist = specialists.find((item) => item.id === specialistId);

  if (!specialist || !isValidDateString(date) || !start || !end) {
    sendJson(response, 400, {
      message: "Заполните специалиста, дату и корректный диапазон времени."
    });
    return;
  }

  if (toMinutes(end) <= toMinutes(start)) {
    sendJson(response, 400, {
      message: "Время окончания должно быть позже времени начала."
    });
    return;
  }

  if (!force) {
    const hasBookingConflict = getActiveBookingsForSpecialist(bookings, specialistId, date).some((booking) =>
      timeRangesOverlap(
        toMinutes(start),
        toMinutes(end),
        toMinutes(booking.slot),
        toMinutes(booking.endsAt)
      )
    );

    if (hasBookingConflict) {
      sendJson(response, 409, {
        message: "Нельзя блокировать интервал, в котором уже есть активная запись. Для отпуска используйте форму «Отпуск / закрытие»."
      });
      return;
    }
  }

  const hasBlockConflict = getBlocksForSpecialist(schedule, specialistId, date).some((block) =>
    timeRangesOverlap(
      toMinutes(start),
      toMinutes(end),
      toMinutes(block.start),
      toMinutes(block.end)
    )
  );

  if (hasBlockConflict) {
    sendJson(response, 409, {
      message: "На этот период уже существует блокировка."
    });
    return;
  }

  const nextSchedule = normalizeScheduleData(
    {
      blocks: [
        ...schedule.blocks,
        {
          id: crypto.randomUUID(),
          specialistId,
          date,
          start,
          end,
          reason,
          ...(note ? { note } : {})
        }
      ]
    },
    specialists
  );
  await writeJson("schedule.json", nextSchedule);

  sendJson(response, 201, {
    message: "Период заблокирован.",
    schedule: nextSchedule
  });
}

async function handleAdminBlockDelete(request, response, blockId) {
  assertAdminPin(request);

  const { specialists, schedule } = await loadStudioData();
  const nextSchedule = normalizeScheduleData(
    {
      blocks: schedule.blocks.filter((block) => block.id !== blockId)
    },
    specialists
  );

  if (nextSchedule.blocks.length === schedule.blocks.length) {
    sendJson(response, 404, {
      message: "Блокировка не найдена."
    });
    return;
  }

  await writeJson("schedule.json", nextSchedule);

  sendJson(response, 200, {
    message: "Блокировка удалена.",
    schedule: nextSchedule
  });
}

async function handleSpecialistScheduleUpdate(request, response, specialistId) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);
  const { services, specialists, schedule } = await loadStudioData();
  const specialistIndex = specialists.findIndex((item) => item.id === specialistId);

  if (specialistIndex === -1) {
    sendJson(response, 404, {
      message: "Специалист не найден."
    });
    return;
  }

  const draftSpecialists = specialists.map((item, index) =>
    index === specialistIndex
      ? {
          ...item,
          ...(payload.daySchedules && typeof payload.daySchedules === "object"
            ? { daySchedules: payload.daySchedules }
            : {}),
          ...(Array.isArray(payload.workDays) ? { workDays: payload.workDays } : {}),
          ...(payload.workHours && typeof payload.workHours === "object" ? { workHours: payload.workHours } : {}),
          breaks: Array.isArray(payload.breaks) ? payload.breaks : item.breaks
        }
      : item
  );
  const normalizedSpecialists = normalizeSpecialists(draftSpecialists, services);
  const nextSchedule = normalizeScheduleData(schedule, normalizedSpecialists);

  await Promise.all([
    writeJson("specialists.json", normalizedSpecialists),
    writeJson("schedule.json", nextSchedule)
  ]);

  sendJson(response, 200, {
    message: "График специалиста обновлен.",
    specialist: normalizedSpecialists.find((item) => item.id === specialistId)
  });
}

async function handleAdminContentUpdate(request, response) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);
  const site = normalizeSiteContent(payload.site);
  const services = normalizeServices(payload.services);
  const specialists = normalizeSpecialists(payload.specialists, services);
  const rawSchedule = await readJson("schedule.json");
  const schedule = normalizeScheduleData(rawSchedule, specialists);

  await Promise.all([
    writeJson("site.json", site),
    writeJson("services.json", services),
    writeJson("specialists.json", specialists),
    writeJson("schedule.json", schedule)
  ]);

  sendJson(response, 200, {
    message: "Контент студии обновлен.",
    site,
    services,
    specialists
  });
}

async function handleAdminClientUpdate(request, response, clientId) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);
  const { clients } = await loadStudioData();
  const profiles = normalizeClientProfiles(clients);
  const profileIndex = profiles.findIndex((profile) => profile.id === clientId);
  const status = sanitizeText(payload.status, "regular");

  const nextProfile = {
    id: clientId,
    status: ["new", "regular", "vip", "attention"].includes(status) ? status : "regular",
    note: sanitizeText(payload.note),
    tag: sanitizeText(payload.tag),
    // Контактные override-поля. Если поле не пришло в payload — сохраняем текущее
    // (fallback), пустая строка означает «убрать override и взять данные из броней».
    clientName: sanitizeText(payload.clientName, profiles[profileIndex]?.clientName || ""),
    phone: sanitizeText(payload.phone, profiles[profileIndex]?.phone || ""),
    email: sanitizeText(payload.email, profiles[profileIndex]?.email || ""),
    medCard: payload.medCard && typeof payload.medCard === "object" ? payload.medCard : (profiles[profileIndex]?.medCard || null)
  };

  if (profileIndex === -1) {
    profiles.push(nextProfile);
  } else {
    profiles[profileIndex] = {
      ...profiles[profileIndex],
      ...nextProfile
    };
  }

  await writeJson("clients.json", profiles);

  sendJson(response, 200, {
    message: "Карточка клиента обновлена.",
    client: nextProfile
  });
}

async function handleSchoolEnroll(request, response) {
  const payload = await parseJsonBody(request);

  const courseId = sanitizeText(payload.courseId || "");
  const name = sanitizeText(payload.name || "");
  const phone = sanitizeText(payload.phone || "");
  const email = sanitizeText(payload.email || "");
  const notes = sanitizeText(payload.notes || "");

  if (!courseId || !name || !phone || !email) {
    sendJson(response, 400, { message: "Заполните все обязательные поля." });
    return;
  }

  const courses = await readJson("courses.json");
  const course = courses.find((c) => c.id === courseId);
  if (!course) {
    sendJson(response, 400, { message: "Курс не найден." });
    return;
  }

  // Check enrollment limit
  if (course.maxStudents > 0) {
    const enrollments = await readJson("enrollments.json");
    const activeCount = enrollments.filter(e => e.courseId === courseId && e.status !== "cancelled").length;
    if (activeCount >= course.maxStudents) {
      sendJson(response, 409, { message: "К сожалению, набор на этот курс закрыт. Оставьте заявку — мы сообщим о следующей группе." });
      return;
    }
  }

  const enrollment = {
    id: crypto.randomUUID(),
    reference: `SCH-${Date.now().toString().slice(-6)}`,
    status: "new",
    courseId,
    courseName: course.name,
    direction: course.direction,
    name,
    phone,
    email,
    notes,
    createdAt: new Date().toISOString()
  };

  const enrollments = await readJson("enrollments.json");
  enrollments.push(enrollment);
  await writeJson("enrollments.json", enrollments);

  // Telegram notification (fire and forget)
  void (async () => {
    try {
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const text = `🎓 Новая заявка на обучение\n\nКурс: ${enrollment.courseName}\nИмя: ${enrollment.name}\nТелефон: ${enrollment.phone}\nEmail: ${enrollment.email}${enrollment.notes ? `\nКомментарий: ${enrollment.notes}` : ""}\nНомер: ${enrollment.reference}`;
        await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          body: { chat_id: TELEGRAM_CHAT_ID, text }
        });
      }
    } catch {}
  })();

  sendJson(response, 201, { ok: true, reference: enrollment.reference, enrollment });
}

async function handleSpecialistPhotoUpload(request, response, specialistId) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request, 8 * 1024 * 1024);
  const { photo } = payload;

  if (!photo || typeof photo !== "string") {
    sendJson(response, 400, { message: "Поле photo обязательно." });
    return;
  }

  const match = photo.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) {
    sendJson(response, 400, { message: "Неверный формат. Поддерживаются: JPEG, PNG, WebP." });
    return;
  }

  const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
  const base64Data = match[3];
  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.length > 5 * 1024 * 1024) {
    sendJson(response, 400, { message: "Файл слишком большой. Максимум 5MB." });
    return;
  }

  const specialists = await readJson("specialists.json");
  const idx = specialists.findIndex((s) => s.id === specialistId);

  if (idx === -1) {
    sendJson(response, 404, { message: "Специалист не найден." });
    return;
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `${specialistId}.${ext}`;
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);

  const photoUrl = `/uploads/specialists/${filename}`;
  specialists[idx] = { ...specialists[idx], photo: photoUrl };
  await writeJson("specialists.json", specialists);

  sendJson(response, 200, { ok: true, photo: photoUrl });
}

async function handleTeacherPhotoUpload(request, response, teacherId) {
  assertAdminPin(request);
  const payload = await parseJsonBody(request, 8 * 1024 * 1024);
  const { photo } = payload;
  if (!photo || typeof photo !== "string") { sendJson(response, 400, { message: "Поле photo обязательно." }); return; }
  const match = photo.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) { sendJson(response, 400, { message: "Неверный формат." }); return; }
  const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
  const buffer = Buffer.from(match[3], "base64");
  if (buffer.length > 5 * 1024 * 1024) { sendJson(response, 400, { message: "Файл слишком большой. Максимум 5MB." }); return; }
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `teacher-${teacherId}.${ext}`;
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  const photoUrl = `/uploads/specialists/${filename}`;

  // Update teachers.json if teacher already saved; otherwise photo URL is returned for admin to use
  const teachers = await readJson("teachers.json");
  const idx = teachers.findIndex((t) => t.id === teacherId);
  if (idx !== -1) {
    teachers[idx] = { ...teachers[idx], photo: photoUrl };
    await writeJson("teachers.json", teachers);
  }

  sendJson(response, 200, { ok: true, photo: photoUrl });
}

async function routeApi(request, response, urlObject) {
  if (request.method === "GET" && urlObject.pathname === "/api/bootstrap") {
    await handleBootstrap(response);
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/availability") {
    await handleAvailability(urlObject, response);
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/bookings") {
    await withLock("studio", () => handleBookingCreate(request, response));
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/cancel") {
    await withLock("studio", () => handleBookingCancel(request, response));
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/admin/session") {
    await handleAdminSessionCreate(request, response);
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/admin/session") {
    await handleAdminSessionStatus(request, response);
    return;
  }

  if (request.method === "DELETE" && urlObject.pathname === "/api/admin/session") {
    await handleAdminSessionDelete(request, response);
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/admin/bookings") {
    await handleAdminBookings(request, response);
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/admin/schedule") {
    assertAdminPin(request);
    const { specialists } = await loadStudioData();
    const schedule = normalizeScheduleData(await readJson("schedule.json").catch(() => ({})), specialists);
    sendJson(response, 200, { schedule });
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/admin/clients") {
    await handleAdminClients(request, response);
    return;
  }

  // POST /api/admin/clients — manually add client
  if (request.method === "POST" && urlObject.pathname === "/api/admin/clients") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const name = sanitizeText(payload.clientName || "");
    const phone = sanitizeText(payload.phone || "");
    if (!name || !phone) { sendJson(response, 400, { message: "Имя и телефон обязательны." }); return; }
    const profiles = await readJson("clients.json");
    const id = createClientProfileId({ clientName: name, phone, email: payload.email || "" });
    const existing = profiles.find(p => p.id === id);
    if (!existing) {
      profiles.push({
        id, clientName: name, phone,
        email: sanitizeText(payload.email || ""),
        note: sanitizeText(payload.note || ""),
        status: "new", manuallyAdded: true,
        createdAt: new Date().toISOString()
      });
      await writeJson("clients.json", profiles);
    }
    sendJson(response, 201, { ok: true, id });
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/admin/day") {
    await handleAdminDay(request, response, urlObject);
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/admin/bookings") {
    await withLock("studio", () => handleAdminBookingCreate(request, response));
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/admin/blocks") {
    await withLock("studio", () => handleAdminBlockCreate(request, response));
    return;
  }

  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/blocks/")) {
    const blockId = urlObject.pathname.replace("/api/admin/blocks/", "");
    await withLock("studio", () => handleAdminBlockDelete(request, response, blockId));
    return;
  }

  if (
    request.method === "PATCH" &&
    urlObject.pathname.startsWith("/api/admin/specialists/") &&
    urlObject.pathname.endsWith("/schedule")
  ) {
    const specialistId = urlObject.pathname
      .replace("/api/admin/specialists/", "")
      .replace("/schedule", "")
      .replace(/\/$/, "");
    await withLock("studio", () => handleSpecialistScheduleUpdate(request, response, specialistId));
    return;
  }

  if (
    request.method === "POST" &&
    urlObject.pathname.startsWith("/api/admin/specialists/") &&
    urlObject.pathname.endsWith("/photo")
  ) {
    const specialistId = urlObject.pathname
      .replace("/api/admin/specialists/", "")
      .replace("/photo", "");
    await handleSpecialistPhotoUpload(request, response, specialistId);
    return;
  }

  // POST /api/admin/specialists/:id/master-link — ссылка на кабинет мастера (get-or-create)
  if (
    request.method === "POST" &&
    urlObject.pathname.startsWith("/api/admin/specialists/") &&
    urlObject.pathname.endsWith("/master-link")
  ) {
    assertAdminPin(request);
    const specialistId = urlObject.pathname
      .replace("/api/admin/specialists/", "")
      .replace("/master-link", "");
    const { specialists } = await loadStudioData();
    if (!specialists.find((s) => s.id === specialistId)) {
      sendJson(response, 404, { message: "Специалист не найден." });
      return;
    }
    const reset = urlObject.searchParams.get("reset") === "1";
    const tokens = await readJson("master-tokens.json").catch(() => []);
    let entry = tokens.find((t) => t.specialistId === specialistId);
    if (!entry) {
      entry = { specialistId, token: crypto.randomBytes(24).toString("hex"), createdAt: new Date().toISOString() };
      tokens.push(entry);
      await writeJson("master-tokens.json", tokens);
    } else if (reset) {
      entry.token = crypto.randomBytes(24).toString("hex");
      entry.createdAt = new Date().toISOString();
      await writeJson("master-tokens.json", tokens);
    }
    const base = SITE_URL || "https://mateevmassage.com";
    sendJson(response, 200, { url: `${base}/master?token=${entry.token}`, token: entry.token, reset });
    return;
  }

  if (request.method === "PUT" && urlObject.pathname === "/api/admin/content") {
    await handleAdminContentUpdate(request, response);
    return;
  }

  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/bookings/")) {
    const bookingId = urlObject.pathname.replace("/api/admin/bookings/", "");
    await withLock("studio", () => handleBookingStatusUpdate(request, response, bookingId));
    return;
  }

  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/bookings/")) {
    assertAdminPin(request);
    const bookingId = urlObject.pathname.replace("/api/admin/bookings/", "");
    await withLock("studio", async () => {
      const { bookings } = await loadStudioData();
      const next = bookings.filter(b => b.id !== bookingId);
      if (next.length === bookings.length) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
      await writeJson("bookings.json", next);
      sendJson(response, 200, { ok: true });
    });
    return;
  }

  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/clients/")) {
    const clientId = urlObject.pathname.replace("/api/admin/clients/", "");
    await handleAdminClientUpdate(request, response, clientId);
    return;
  }

  if (
    request.method === "POST" &&
    urlObject.pathname.startsWith("/api/admin/teachers/") &&
    urlObject.pathname.endsWith("/photo")
  ) {
    const teacherId = urlObject.pathname.replace("/api/admin/teachers/", "").replace("/photo", "");
    await handleTeacherPhotoUpload(request, response, teacherId);
    return;
  }

  // PUT /api/admin/school - save courses and teachers
  if (request.method === "PUT" && urlObject.pathname === "/api/admin/school") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    if (Array.isArray(payload.courses)) await writeJson("courses.json", payload.courses);
    if (Array.isArray(payload.teachers)) await writeJson("teachers.json", payload.teachers);
    sendJson(response, 200, { ok: true });
    return;
  }

  // GET /api/school/data - public
  if (request.method === "GET" && urlObject.pathname === "/api/school/data") {
    const courses  = await readJson("courses.json");
    const teachers = await readJson("teachers.json");
    const enrollments = await readJson("enrollments.json");
    const coursesWithCount = courses.map(c => ({
      ...c,
      enrolledCount: enrollments.filter(e => e.courseId === c.id && e.status !== "cancelled").length
    }));
    sendJson(response, 200, { courses: coursesWithCount, teachers });
    return;
  }

  // POST /api/waitlist - public waitlist signup
  if (request.method === "POST" && urlObject.pathname === "/api/waitlist") {
    const payload = await parseJsonBody(request);
    const name       = sanitizeText(payload.name || "");
    const phone      = sanitizeText(payload.phone || "");
    const serviceId  = sanitizeText(payload.serviceId || payload.service || "");
    const specialistId = sanitizeText(payload.specialistId || payload.specialist || "");
    const date       = sanitizeText(payload.date || "");
    if (!name || !phone) { sendJson(response, 400, { message: "Укажите имя и телефон." }); return; }

    // Save to waitlist.json
    const entry = {
      id: `wl-${Date.now()}`,
      name, phone, serviceId, specialistId, date,
      createdAt: new Date().toISOString(),
      notified: false
    };
    const waitlist = await readJson("waitlist.json").catch(() => []);
    waitlist.push(entry);
    await writeJson("waitlist.json", waitlist);

    void (async () => {
      try {
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          const text = `⏳ Лист ожидания\n\nИмя: ${name}\nТелефон: ${phone}${serviceId ? `\nУслуга: ${serviceId}` : ""}${specialistId ? `\nСпециалист: ${specialistId}` : ""}${date ? `\nДата: ${date}` : ""}`;
          await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            body: { chat_id: TELEGRAM_CHAT_ID, text }
          });
        }
      } catch {}
    })();
    sendJson(response, 200, { ok: true });
    return;
  }

  // POST /api/school/enroll - public enrollment
  if (request.method === "POST" && urlObject.pathname === "/api/school/enroll") {
    await handleSchoolEnroll(request, response);
    return;
  }

  // GET /api/admin/enrollments - admin
  if (request.method === "GET" && urlObject.pathname === "/api/admin/enrollments") {
    if (!getAdminSession(request)) { assertAdminPin(request); }
    const enrollments = await readJson("enrollments.json");
    sendJson(response, 200, { enrollments });
    return;
  }

  // DELETE /api/admin/enrollments/:id - admin
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/enrollments/")) {
    assertAdminPin(request);
    const enrollmentId = urlObject.pathname.replace("/api/admin/enrollments/", "");
    const enrollments = await readJson("enrollments.json");
    const next = enrollments.filter(e => e.id !== enrollmentId);
    if (next.length === enrollments.length) { sendJson(response, 404, { message: "Заявка не найдена." }); return; }
    await writeJson("enrollments.json", next);
    sendJson(response, 200, { ok: true });
    return;
  }

  // PATCH /api/admin/enrollments/:id - admin
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/enrollments/")) {
    assertAdminPin(request);
    const enrollmentId = urlObject.pathname.replace("/api/admin/enrollments/", "");
    const payload = await parseJsonBody(request);
    const enrollments = await readJson("enrollments.json");
    const idx = enrollments.findIndex((e) => e.id === enrollmentId);
    if (idx === -1) {
      sendJson(response, 404, { message: "Заявка не найдена." });
      return;
    }
    const allowed = ["new", "contacted", "confirmed", "cancelled"];
    const prevStatus = enrollments[idx].status;
    const status = allowed.includes(payload.status) ? payload.status : prevStatus;
    enrollments[idx] = { ...enrollments[idx], status, updatedAt: new Date().toISOString() };

    // Доступ к платформе выдаём один раз — при первом переходе в "confirmed".
    let platformAccess = null;
    if (status === "confirmed" && prevStatus !== "confirmed" && !enrollments[idx].platformProvisioned) {
      if (!enrollments[idx].email) {
        platformAccess = { ok: false, error: "no_email" };
      } else {
        try {
          const result = await grantPlatformAccess(enrollments[idx]);
          if (result.skipped) {
            platformAccess = { ok: false, skipped: true, reason: result.reason };
          } else {
            enrollments[idx].platformProvisioned = true;
            enrollments[idx].platformUserId = result.userId || null;
            enrollments[idx].platformProvisionedAt = new Date().toISOString();
            platformAccess = { ok: true, status: result.status || "created", userId: result.userId || null };
          }
        } catch (err) {
          platformAccess = { ok: false, error: err.message || "webhook_failed" };
        }
      }
    }

    await writeJson("enrollments.json", enrollments);

    // Уведомление в Telegram об успешной выдаче доступа (fire and forget).
    if (platformAccess && platformAccess.ok) {
      const enr = enrollments[idx];
      void (async () => {
        try {
          if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              body: {
                chat_id: TELEGRAM_CHAT_ID,
                text: `✅ Доступ к платформе выдан\n\nУченик: ${enr.name}\nEmail: ${enr.email}\nКурс: ${enr.courseName}`
              }
            });
          }
        } catch {}
      })();
    }

    sendJson(response, 200, { ok: true, enrollment: enrollments[idx], platformAccess });
    return;
  }

  // ─── Блокнот (заметки / дела / долги) ─────────────────────────────────
  if (request.method === "GET" && urlObject.pathname === "/api/admin/notes") {
    assertAdminPin(request);
    const notes = await readJson("notes.json").catch(() => []);
    sendJson(response, 200, { notes });
    return;
  }
  if (request.method === "POST" && urlObject.pathname === "/api/admin/notes") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const text = sanitizeText(payload.text || "");
    if (!text) { sendJson(response, 400, { message: "Пустая заметка." }); return; }
    const allowedTypes = ["note", "task", "owed_to_me", "i_owe"];
    const note = {
      id: crypto.randomUUID(),
      text,
      type: allowedTypes.includes(payload.type) ? payload.type : "note",
      client: sanitizeText(payload.client || ""),
      amount: Math.max(0, Number(payload.amount) || 0),
      procedures: Math.max(0, parseInt(payload.procedures || "0", 10) || 0),
      dueDate: isValidDateString(payload.dueDate || "") ? payload.dueDate : "",
      done: false,
      pinned: payload.pinned === true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const notes = await readJson("notes.json").catch(() => []);
    notes.push(note);
    await writeJson("notes.json", notes);
    sendJson(response, 201, { ok: true, note });
    return;
  }
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/notes/")) {
    assertAdminPin(request);
    const id = urlObject.pathname.replace("/api/admin/notes/", "");
    const payload = await parseJsonBody(request);
    const notes = await readJson("notes.json").catch(() => []);
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) { sendJson(response, 404, { message: "Заметка не найдена." }); return; }
    const n = notes[idx];
    const allowedTypes = ["note", "task", "owed_to_me", "i_owe"];
    if (typeof payload.text === "string") n.text = sanitizeText(payload.text);
    if (allowedTypes.includes(payload.type)) n.type = payload.type;
    if (typeof payload.client === "string") n.client = sanitizeText(payload.client);
    if (payload.amount !== undefined) n.amount = Math.max(0, Number(payload.amount) || 0);
    if (payload.procedures !== undefined) n.procedures = Math.max(0, parseInt(payload.procedures, 10) || 0);
    if (payload.dueDate !== undefined) n.dueDate = isValidDateString(payload.dueDate || "") ? payload.dueDate : "";
    if (typeof payload.done === "boolean") n.done = payload.done;
    if (typeof payload.pinned === "boolean") n.pinned = payload.pinned;
    n.updatedAt = new Date().toISOString();
    await writeJson("notes.json", notes);
    sendJson(response, 200, { ok: true, note: n });
    return;
  }
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/notes/")) {
    assertAdminPin(request);
    const id = urlObject.pathname.replace("/api/admin/notes/", "");
    const notes = await readJson("notes.json").catch(() => []);
    const next = notes.filter((n) => n.id !== id);
    if (next.length === notes.length) { sendJson(response, 404, { message: "Заметка не найдена." }); return; }
    await writeJson("notes.json", next);
    sendJson(response, 200, { ok: true });
    return;
  }

  // GET /api/admin/certificates
  if (request.method === "GET" && urlObject.pathname === "/api/admin/certificates") {
    assertAdminPin(request);
    const certs = await readJson("certificates.json");
    sendJson(response, 200, { certificates: certs });
    return;
  }

  // GET /api/admin/commission?month=YYYY-MM — отчёт по комиссии сети с мастеров
  if (request.method === "GET" && urlObject.pathname === "/api/admin/commission") {
    assertAdminPin(request);
    const month = /^\d{4}-\d{2}$/.test(urlObject.searchParams.get("month") || "")
      ? urlObject.searchParams.get("month")
      : new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" }).slice(0, 7);
    const { specialists, bookings } = await loadStudioData();
    const payments = await readJson("commission-payments.json").catch(() => []);
    const isPaid = (spId) => payments.some((p) => p.specialistId === spId && p.month === month);
    const rows = specialists.map((sp) => {
      const done = bookings.filter((b) => b.specialistId === sp.id && b.status === "completed" && (b.date || "").slice(0, 7) === month);
      const revenue = done.reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0);
      const pct = sp.commissionPercent || 0;
      return {
        id: sp.id, name: sp.name, certified: !!sp.certified, location: sp.location || "",
        sessions: done.length, revenue, commissionPercent: pct, commission: Math.round(revenue * pct / 100),
        paid: isPaid(sp.id)
      };
    }).sort((a, b) => b.revenue - a.revenue);
    const totals = {
      sessions: rows.reduce((s, r) => s + r.sessions, 0),
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
      commission: rows.reduce((s, r) => s + r.commission, 0),
      commissionUnpaid: rows.filter((r) => !r.paid).reduce((s, r) => s + r.commission, 0)
    };
    sendJson(response, 200, { month, rows, totals });
    return;
  }

  // POST /api/admin/commission/pay — отметить/снять оплату комиссии за месяц
  if (request.method === "POST" && urlObject.pathname === "/api/admin/commission/pay") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const specialistId = sanitizeText(payload.specialistId || "");
    const month = /^\d{4}-\d{2}$/.test(payload.month || "") ? payload.month : "";
    if (!specialistId || !month) { sendJson(response, 400, { message: "Нужны specialistId и month." }); return; }
    const payments = await readJson("commission-payments.json").catch(() => []);
    const idx = payments.findIndex((p) => p.specialistId === specialistId && p.month === month);
    let paid;
    if (idx === -1) { payments.push({ specialistId, month, paidAt: new Date().toISOString() }); paid = true; }
    else { payments.splice(idx, 1); paid = false; }
    await writeJson("commission-payments.json", payments);
    sendJson(response, 200, { ok: true, paid });
    return;
  }

  // GET /api/admin/dashboard-summary — единый обзор (спа + сеть + школа + аналитика)
  if (request.method === "GET" && urlObject.pathname === "/api/admin/dashboard-summary") {
    assertAdminPin(request);
    const [rawServices, rawSpecialists, bookings, clientsRaw, enrollments] = await Promise.all([
      readJson("services.json").catch(() => []),
      readJson("specialists.json").catch(() => []),
      readJson("bookings.json").catch(() => []),
      readJson("clients.json").catch(() => []),
      readJson("enrollments.json").catch(() => [])
    ]);
    const services = normalizeServices(rawServices);
    const specialists = normalizeSpecialists(rawSpecialists, services);
    const clients = buildAdminClients(bookings, clientsRaw);
    const month = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" }).slice(0, 7);
    const inMonth = (b) => (b.date || "").slice(0, 7) === month;

    // Спа
    const monthBookings = bookings.filter(inMonth);
    const completedMonth = monthBookings.filter((b) => b.status === "completed");
    const monthRevenue = completedMonth.reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);
    const cancelledMonth = monthBookings.filter((b) => b.status === "cancelled").length;

    // Сеть
    const certifiedCount = specialists.filter((s) => s.certified).length;
    let commissionMonth = 0;
    for (const sp of specialists) {
      const rev = completedMonth.filter((b) => b.specialistId === sp.id).reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);
      commissionMonth += Math.round(rev * (sp.commissionPercent || 0) / 100);
    }

    // Школа
    const enrList = Array.isArray(enrollments) ? enrollments : [];
    const enrNew = enrList.filter((e) => e && (e.status === "new" || e.status === "pending" || !e.status)).length;

    // Аналитика по клиентам
    const withVisits = clients.filter((c) => c.completedVisits >= 1);
    const ltv = withVisits.length ? Math.round(withVisits.reduce((s, c) => s + (c.totalSpent || 0), 0) / withVisits.length) : 0;
    const repeat = withVisits.filter((c) => c.completedVisits >= 2).length;
    const repeatRate = withVisits.length ? Math.round(repeat / withVisits.length * 100) : 0;
    const avgVisits = withVisits.length ? Math.round(withVisits.reduce((s, c) => s + c.completedVisits, 0) / withVisits.length * 10) / 10 : 0;
    const svcCount = {};
    for (const b of bookings) if (b.status === "completed" && b.serviceName) svcCount[b.serviceName] = (svcCount[b.serviceName] || 0) + 1;
    const topService = Object.entries(svcCount).sort((a, b) => b[1] - a[1])[0] || null;

    sendJson(response, 200, {
      month,
      spa: { monthBookings: monthBookings.filter((b) => b.status !== "cancelled").length, monthRevenue, cancelledMonth, completedMonth: completedMonth.length },
      network: { masters: specialists.length, certified: certifiedCount, commissionMonth },
      school: { total: enrList.length, new: enrNew },
      analytics: {
        totalClients: clients.length,
        activeClients: withVisits.length,
        ltv, repeatRate, avgVisits,
        topService: topService ? { name: topService[0], count: topService[1] } : null
      }
    });
    return;
  }

  // POST /api/admin/ai-assistant — AI-ассистент владельца (чат по данным бизнеса)
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-assistant") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const msg = sanitizeText(payload.message || "").slice(0, 1000);
    if (!msg) { sendJson(response, 400, { message: "Пустой вопрос." }); return; }
    const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];
    const messages = [];
    for (const h of history) {
      const role = h && h.role === "assistant" ? "assistant" : "user";
      const content = sanitizeText((h && h.content) || "").slice(0, 2000);
      if (content) messages.push({ role, content });
    }
    messages.push({ role: "user", content: msg });
    while (messages.length && messages[0].role !== "user") messages.shift();
    const context = await buildBusinessContext();
    const reply = await callAnthropic(`${AI_OWNER_PROMPT}\n\n=== ДАННЫЕ БИЗНЕСА ===\n${context}`, messages, 800);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }

  // POST /api/admin/ai-content — генератор постов для соцсетей
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-content") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const topic = sanitizeText(payload.topic || "").slice(0, 500);
    if (!topic) { sendJson(response, 400, { message: "Укажите тему поста." }); return; }
    const format = sanitizeText(payload.format || "пост для Instagram").slice(0, 100);
    const langLabel = payload.lang === "ro" ? "румынском" : "русском";
    const system = AI_CONTENT_PROMPT.replace("{lang}", langLabel);
    const reply = await callAnthropic(system, [{ role: "user", content: `Тема: ${topic}. Формат: ${format}.` }], 900);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }

  // POST /api/admin/ai-google-post — публикация для Google Профиля
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-google-post") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const topic = sanitizeText(payload.topic || "").slice(0, 500);
    if (!topic) { sendJson(response, 400, { message: "Укажите тему публикации." }); return; }
    const langLabel = payload.lang === "ro" ? "румынском" : "русском";
    const system = AI_GOOGLE_POST_PROMPT.replace("{lang}", langLabel);
    const reply = await callAnthropic(system, [{ role: "user", content: `Тема публикации: ${topic}.` }], 700);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }

  // POST /api/admin/ai-review-reply — ответ на отзыв клиента
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-review-reply") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const review = sanitizeText(payload.review || "").slice(0, 1500);
    if (!review) { sendJson(response, 400, { message: "Вставьте текст отзыва." }); return; }
    const author = sanitizeText(payload.author || "").slice(0, 100);
    const userMsg = (author ? `Автор отзыва: ${author}.\n` : "") + `Текст отзыва:\n${review}`;
    const reply = await callAnthropic(AI_REVIEW_REPLY_PROMPT, [{ role: "user", content: userMsg }], 500);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }

  // GET /api/signature — публичный URL подписи основателя (для диплома)
  if (request.method === "GET" && urlObject.pathname === "/api/signature") {
    const site = await readJson("site.json").catch(() => ({}));
    sendJson(response, 200, { url: (site.brand && site.brand.signature) || null });
    return;
  }
  // POST /api/admin/signature — загрузить подпись
  if (request.method === "POST" && urlObject.pathname === "/api/admin/signature") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 6 * 1024 * 1024);
    const match = String(payload.photo || "").match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
    if (!match) { sendJson(response, 400, { message: "Нужен PNG (лучше с прозрачным фоном), JPEG или WebP." }); return; }
    const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
    const buffer = Buffer.from(match[3], "base64");
    if (buffer.length > 4 * 1024 * 1024) { sendJson(response, 400, { message: "Файл слишком большой (макс. 4MB)." }); return; }
    await fs.mkdir(SIGNATURES_UPLOADS_DIR, { recursive: true });
    // чистим старые файлы подписи
    try { for (const f of await fs.readdir(SIGNATURES_UPLOADS_DIR)) { if (f.startsWith("founder.")) await fs.unlink(path.join(SIGNATURES_UPLOADS_DIR, f)).catch(() => {}); } } catch {}
    const filename = `founder.${ext}`;
    await fs.writeFile(path.join(SIGNATURES_UPLOADS_DIR, filename), buffer);
    const url = `/uploads/signatures/${filename}?v=${Date.now()}`;
    const site = await readJson("site.json").catch(() => ({}));
    site.brand = site.brand || {};
    site.brand.signature = url;
    await writeJson("site.json", site);
    sendJson(response, 201, { ok: true, url });
    return;
  }
  // DELETE /api/admin/signature
  if (request.method === "DELETE" && urlObject.pathname === "/api/admin/signature") {
    assertAdminPin(request);
    try { for (const f of await fs.readdir(SIGNATURES_UPLOADS_DIR)) { if (f.startsWith("founder.")) await fs.unlink(path.join(SIGNATURES_UPLOADS_DIR, f)).catch(() => {}); } } catch {}
    const site = await readJson("site.json").catch(() => ({}));
    if (site.brand) { delete site.brand.signature; await writeJson("site.json", site); }
    sendJson(response, 200, { ok: true });
    return;
  }

  // GET/POST /api/admin/reception — режим AI-ресепшна (запись)
  if (request.method === "GET" && urlObject.pathname === "/api/admin/reception") {
    assertAdminPin(request);
    sendJson(response, 200, await getReceptionMode());
    return;
  }
  if (request.method === "POST" && urlObject.pathname === "/api/admin/reception") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const cur = await getReceptionMode();
    const next = {
      mode: ["request", "auto", "hybrid"].includes(payload.mode) ? payload.mode : cur.mode,
      open: sanitizeTimeString(payload.open) || cur.open,
      close: sanitizeTimeString(payload.close) || cur.close
    };
    await writeJson("reception.json", next);
    sendJson(response, 200, { ok: true, ...next });
    return;
  }

  // POST /api/admin/ai-voice-note — структурировать голосовую заметку в карту клиента
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-voice-note") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const text = sanitizeText(payload.text || "").slice(0, 4000);
    if (!text) { sendJson(response, 400, { message: "Пустая заметка." }); return; }
    const reply = await callAnthropic(AI_VOICE_PROMPT, [{ role: "user", content: text }], 700);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }

  // POST /api/admin/ai-medical — разбор диагноза/снимка для массажиста (текст + изображение)
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-medical") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request, 10 * 1024 * 1024);
    const text = sanitizeText(payload.text || "").slice(0, 2000);
    const image = typeof payload.image === "string" ? payload.image : "";
    const content = [];
    content.push({ type: "text", text: text
      ? `Разбери это для массажиста: ${text}`
      : "Разбери прикреплённый медицинский снимок/заключение для массажиста." });
    if (image) {
      const match = image.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
      if (!match) { sendJson(response, 400, { message: "Неверный формат изображения. Поддерживаются JPEG, PNG, WebP." }); return; }
      const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
      if (Buffer.from(match[3], "base64").length > 5 * 1024 * 1024) { sendJson(response, 400, { message: "Изображение слишком большое (макс. ~5MB)." }); return; }
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: match[3] } });
    }
    if (!text && !image) { sendJson(response, 400, { message: "Введите текст диагноза или прикрепите снимок." }); return; }
    const reply = await callAnthropic(AI_MEDICAL_PROMPT, [{ role: "user", content }], 1800);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }

  // POST /api/admin/ai-diary — идеи тем / черновик статьи для дневника
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-diary") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const mode = payload.mode === "draft" ? "draft" : "ideas";
    let userMsg, maxTokens;
    if (mode === "ideas") {
      userMsg = "Дай 10 идей-заголовков для статей блога про массаж, восстановление, заботу о теле и практичные советы. Каждый заголовок — с новой строки, без нумерации и лишних слов.";
      maxTokens = 400;
    } else {
      const topic = sanitizeText(payload.topic || "").slice(0, 300);
      if (!topic) { sendJson(response, 400, { message: "Укажите заголовок или тему статьи." }); return; }
      userMsg = `Напиши полную завершённую статью для блога на тему: «${topic}». Формат Markdown: подзаголовки через ##, абзацы, при необходимости списки. Объём — 600–900 слов: вступление, 3–5 разделов с подзаголовками, практичные советы и тёплое завершение с призывом записаться. Обязательно допиши статью до конца, не обрывай на середине. Без хэштегов и без повторения заголовка статьи в начале.`;
      maxTokens = 3000;
    }
    const reply = await callAnthropic(AI_DIARY_PROMPT, [{ role: "user", content: userMsg }], maxTokens);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }

  // POST /api/admin/certificates - создать сертификат ИЛИ оформить заявку (upsert по коду)
  if (request.method === "POST" && urlObject.pathname === "/api/admin/certificates") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const code = sanitizeText(payload.code || `GC-${Date.now().toString().slice(-6)}`);
    const recipient = sanitizeText(payload.recipient || "");
    const procedure = sanitizeText(payload.procedure || "");
    const amount = Math.max(0, parseInt(payload.amount || "0", 10));
    const validityMonths = Math.max(1, parseInt(payload.validityMonths || "12", 10));
    const expiresAt = new Date(Date.now() + validityMonths * 30 * 24 * 3600 * 1000).toISOString();
    const certs = await readJson("certificates.json");

    // Если код уже есть (например, онлайн-заявка) — оформляем её: обновляем и активируем,
    // сохраняя тот же код, id и данные покупателя. Без дубля.
    const existingIdx = certs.findIndex((c) => (c.code || "").toUpperCase() === code.toUpperCase());
    if (existingIdx !== -1) {
      const ex = certs[existingIdx];
      ex.recipient = recipient || ex.recipient || "";
      ex.procedure = procedure;
      if (amount) ex.amount = amount;
      ex.validityMonths = validityMonths;
      ex.expiresAt = expiresAt;
      ex.status = "active";
      ex.issuedAt = ex.issuedAt || new Date().toISOString();
      await writeJson("certificates.json", certs);
      sendJson(response, 200, { ok: true, certificate: ex, fulfilled: true });
      return;
    }

    const cert = {
      id: crypto.randomUUID(),
      code,
      recipient,
      procedure,
      amount,
      validityMonths,
      issuedAt: new Date().toISOString(),
      expiresAt,
      status: "active",
      usedAt: null,
      usedInBooking: null
    };
    certs.push(cert);
    await writeJson("certificates.json", certs);
    sendJson(response, 201, { ok: true, certificate: cert });
    return;
  }

  // GET /api/certificates/validate?code=GC-... - public validation
  if (request.method === "GET" && urlObject.pathname === "/api/certificates/validate") {
    const code = sanitizeText(urlObject.searchParams.get("code") || "");
    if (!code) { sendJson(response, 400, { message: "Укажите код сертификата." }); return; }
    const certs = await readJson("certificates.json");
    const cert = certs.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (!cert) { sendJson(response, 404, { message: "Сертификат не найден." }); return; }
    if (cert.status !== "active") { sendJson(response, 409, { message: "Сертификат уже использован." }); return; }
    if (new Date(cert.expiresAt) < new Date()) { sendJson(response, 409, { message: "Срок действия сертификата истёк." }); return; }
    sendJson(response, 200, { valid: true, certificate: { code: cert.code, amount: cert.amount, recipient: cert.recipient, procedure: cert.procedure } });
    return;
  }

  // POST /api/gift-certificate — публичный заказ подарочного сертификата (оплата офлайн)
  if (request.method === "POST" && urlObject.pathname === "/api/gift-certificate") {
    assertRateLimit({
      scope: "gift-cert",
      key: getRequestIp(request),
      windowMs: 10 * 60 * 1000,
      limit: 10,
      message: "Слишком много заявок. Попробуйте через несколько минут."
    });
    const payload = await parseJsonBody(request);
    const amount = Math.max(0, parseInt(payload.amount || "0", 10));
    const buyerName = sanitizeText(payload.buyerName || "");
    const buyerPhone = sanitizeText(payload.buyerPhone || "");
    const buyerEmail = sanitizeText(payload.buyerEmail || "");
    const recipient = sanitizeText(payload.recipient || "");
    const message = sanitizeText(payload.message || "");
    if (amount < 100 || amount > 100000) {
      sendJson(response, 400, { message: "Укажите сумму от 100 до 100 000 MDL." });
      return;
    }
    if (buyerName.length < 2 || buyerPhone.replace(/\D/g, "").length < 8) {
      sendJson(response, 400, { message: "Укажите имя и телефон для связи." });
      return;
    }

    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const validityMonths = 12;
    const cert = {
      id: crypto.randomUUID(),
      code: `GC-${ym}-${String(Math.floor(Math.random() * 900) + 100)}`,
      recipient,
      procedure: "",
      amount,
      validityMonths,
      issuedAt: now.toISOString(),
      expiresAt: new Date(Date.now() + validityMonths * 30 * 24 * 3600 * 1000).toISOString(),
      status: "pending", // ждёт оплаты — админ активирует после получения денег
      buyerName,
      buyerPhone,
      buyerEmail,
      message,
      usedAt: null,
      usedInBooking: null
    };
    const certs = await readJson("certificates.json");
    certs.push(cert);
    await writeJson("certificates.json", certs);

    // Уведомляем администратора в Telegram (заявка = лид на продажу)
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const text = `🎁 Заказ подарочного сертификата\n\n`
        + `Сумма: ${amount} MDL\nКод: ${cert.code}\n`
        + (recipient ? `Получатель: ${recipient}\n` : "")
        + `Покупатель: ${buyerName}\nТелефон: ${buyerPhone}\n`
        + (buyerEmail ? `Email: ${buyerEmail}\n` : "")
        + (message ? `Сообщение: ${message}\n` : "")
        + `\nСвяжитесь для оплаты, затем активируйте (статус → active в админке).`;
      requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        body: { chat_id: TELEGRAM_CHAT_ID, text }
      }).catch(() => {});
    }

    sendJson(response, 201, { ok: true, code: cert.code });
    return;
  }

  // PATCH /api/admin/certificates/:id - update status
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/certificates/")) {
    assertAdminPin(request);
    const certId = urlObject.pathname.replace("/api/admin/certificates/", "");
    const payload = await parseJsonBody(request);
    const certs = await readJson("certificates.json");
    const idx = certs.findIndex(c => c.id === certId);
    if (idx === -1) { sendJson(response, 404, { message: "Сертификат не найден." }); return; }
    const allowed = ["pending", "active", "used", "cancelled"];
    if (allowed.includes(payload.status)) certs[idx].status = payload.status;
    await writeJson("certificates.json", certs);
    sendJson(response, 200, { ok: true, certificate: certs[idx] });
    return;
  }

  // ─── Packages (Абонементы) ────────────────────────────────────────────────
  // GET /api/admin/packages
  if (request.method === "GET" && urlObject.pathname === "/api/admin/packages") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    const packages = await readJson("packages.json");
    sendJson(response, 200, packages);
    return;
  }

  // POST /api/admin/packages — create
  if (request.method === "POST" && urlObject.pathname === "/api/admin/packages") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const total = Math.max(1, parseInt(payload.totalSessions || "5", 10));
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const packages = await readJson("packages.json");
    const seq = String(packages.length + 1).padStart(3, "0");
    const pkg = {
      id: crypto.randomUUID(),
      code: `PKG-${year}${month}-${seq}`,
      title: sanitizeText(payload.title || ""),
      clientId: sanitizeText(payload.clientId || ""),
      clientName: sanitizeText(payload.clientName || ""),
      phone: sanitizeText(payload.phone || ""),
      serviceId: sanitizeText(payload.serviceId || ""),
      serviceName: sanitizeText(payload.serviceName || ""),
      totalSessions: total,
      usedSessions: 0,
      priceTotal: Math.max(0, parseFloat(payload.priceTotal || "0") || 0),
      expiresAt: sanitizeText(payload.expiresAt || ""),
      issuedAt: now.toISOString(),
      status: "active",
      usageHistory: []
    };
    packages.push(pkg);
    await writeJson("packages.json", packages);
    sendJson(response, 201, { ok: true, package: pkg });
    return;
  }

  // PATCH /api/admin/packages/:id — update status / cancel
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/packages/") && !urlObject.pathname.endsWith("/use")) {
    assertAdminPin(request);
    const pkgId = urlObject.pathname.replace("/api/admin/packages/", "");
    const payload = await parseJsonBody(request);
    const packages = await readJson("packages.json");
    const idx = packages.findIndex(p => p.id === pkgId);
    if (idx === -1) { sendJson(response, 404, { message: "Абонемент не найден." }); return; }
    if (["active","exhausted","cancelled"].includes(payload.status)) packages[idx].status = payload.status;
    if (payload.expiresAt !== undefined) packages[idx].expiresAt = sanitizeText(payload.expiresAt);
    await writeJson("packages.json", packages);
    sendJson(response, 200, { ok: true, package: packages[idx] });
    return;
  }

  // POST /api/admin/packages/:id/use — deduct one session
  if (request.method === "POST" && urlObject.pathname.endsWith("/use") && urlObject.pathname.includes("/api/admin/packages/")) {
    assertAdminPin(request);
    const pkgId = urlObject.pathname.replace("/api/admin/packages/", "").replace("/use", "");
    const payload = await parseJsonBody(request);
    const packages = await readJson("packages.json");
    const idx = packages.findIndex(p => p.id === pkgId);
    if (idx === -1) { sendJson(response, 404, { message: "Абонемент не найден." }); return; }
    const pkg = packages[idx];
    if (pkg.status !== "active") { sendJson(response, 409, { message: "Абонемент неактивен." }); return; }
    if (pkg.usedSessions >= pkg.totalSessions) { sendJson(response, 409, { message: "Все сеансы использованы." }); return; }
    pkg.usedSessions += 1;
    pkg.usageHistory.push({
      bookingId: sanitizeText(payload.bookingId || ""),
      date: sanitizeText(payload.date || new Date().toISOString().slice(0, 10)),
      usedAt: new Date().toISOString()
    });
    if (pkg.usedSessions >= pkg.totalSessions) pkg.status = "exhausted";
    await writeJson("packages.json", packages);
    sendJson(response, 200, { ok: true, package: pkg });
    return;
  }

  // DELETE /api/admin/packages/:id
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/packages/")) {
    assertAdminPin(request);
    const pkgId = urlObject.pathname.replace("/api/admin/packages/", "");
    const packages = await readJson("packages.json");
    const idx = packages.findIndex(p => p.id === pkgId);
    if (idx === -1) { sendJson(response, 404, { message: "Абонемент не найден." }); return; }
    packages.splice(idx, 1);
    await writeJson("packages.json", packages);
    sendJson(response, 200, { ok: true });
    return;
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────
  // GET /api/admin/expenses?month=YYYY-MM
  if (request.method === "GET" && urlObject.pathname === "/api/admin/expenses") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    const month = urlObject.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const all = await readJson("expenses.json");
    const record = all.find(r => r.month === month) || { month, items: [] };
    sendJson(response, 200, record);
    return;
  }

  // POST /api/admin/expenses — save month's expenses
  if (request.method === "POST" && urlObject.pathname === "/api/admin/expenses") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const month = sanitizeText(payload.month || new Date().toISOString().slice(0, 7));
    const items = (payload.items || []).map(it => ({
      id: sanitizeText(it.id || crypto.randomUUID()),
      name: sanitizeText(it.name || ""),
      amount: Math.max(0, parseFloat(it.amount) || 0),
      category: sanitizeText(it.category || "other")
    }));
    const all = await readJson("expenses.json");
    const idx = all.findIndex(r => r.month === month);
    const record = { month, items, updatedAt: new Date().toISOString() };
    if (idx === -1) all.push(record); else all[idx] = record;
    await writeJson("expenses.json", all);
    sendJson(response, 200, { ok: true, record });
    return;
  }

  // ─── Diplomas ─────────────────────────────────────────────────────────────
  // POST /api/webhook/issue-diploma — единая сертификация: Академия (Anatomia) выдаёт
  // диплом в систему сайта (/cert + QR + Стена выпускников). Защита — общий секрет.
  if (request.method === "POST" && urlObject.pathname === "/api/webhook/issue-diploma") {
    const payload = await parseJsonBody(request);
    if (!PLATFORM_WEBHOOK_SECRET || sanitizeText(payload.secret || "") !== PLATFORM_WEBHOOK_SECRET) {
      sendJson(response, 401, { message: "Неверный секрет." }); return;
    }
    const graduateName = sanitizeText(payload.graduateName || "").slice(0, 200);
    const courseName = sanitizeText(payload.courseName || "").slice(0, 200);
    if (!graduateName || !courseName) { sendJson(response, 400, { message: "graduateName и courseName обязательны." }); return; }
    const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
    const diplomas = await readJson("diplomas.json").catch(() => []);
    // Идемпотентность: не плодить дубли по externalId (id завершения курса в Академии)
    const externalId = sanitizeText(payload.externalId || "");
    if (externalId) {
      const existing = diplomas.find((d) => d.externalId === externalId);
      if (existing) { sendJson(response, 200, { ok: true, code: existing.code, certUrl: `${base}/cert?code=${existing.code}`, existed: true }); return; }
    }
    const now = new Date();
    const seq = String(diplomas.length + 1).padStart(3, "0");
    const diploma = {
      id: crypto.randomUUID(),
      code: `DIP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${seq}`,
      graduateName, courseName,
      courseId: sanitizeText(payload.courseId || ""),
      completionDate: sanitizeText(payload.completionDate || now.toISOString().slice(0, 10)),
      enrollmentId: "",
      notes: "Выдан автоматически из Mateev Academy",
      public: payload.public === true,
      ...(externalId ? { externalId } : {}),
      source: "anatomia",
      issuedAt: now.toISOString()
    };
    diplomas.push(diploma);
    await writeJson("diplomas.json", diplomas);
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      void tgSend(TELEGRAM_CHAT_ID, `🎓 Выдан диплом (Академия)\n\n${graduateName}\n${courseName}\nКод: ${diploma.code}\n${base}/cert?code=${diploma.code}`);
    }
    sendJson(response, 201, { ok: true, code: diploma.code, certUrl: `${base}/cert?code=${diploma.code}` });
    return;
  }

  // GET /api/admin/diplomas
  if (request.method === "GET" && urlObject.pathname === "/api/admin/diplomas") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    sendJson(response, 200, await readJson("diplomas.json"));
    return;
  }

  // POST /api/admin/diplomas
  if (request.method === "POST" && urlObject.pathname === "/api/admin/diplomas") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const diplomas = await readJson("diplomas.json");
    const seq = String(diplomas.length + 1).padStart(3, "0");
    const diploma = {
      id: crypto.randomUUID(),
      code: `DIP-${year}${month}-${seq}`,
      graduateName: sanitizeText(payload.graduateName || ""),
      courseName: sanitizeText(payload.courseName || ""),
      courseId: sanitizeText(payload.courseId || ""),
      completionDate: sanitizeText(payload.completionDate || now.toISOString().slice(0, 10)),
      enrollmentId: sanitizeText(payload.enrollmentId || ""),
      notes: sanitizeText(payload.notes || ""),
      public: payload.public === true,
      issuedAt: now.toISOString()
    };
    diplomas.push(diploma);
    await writeJson("diplomas.json", diplomas);
    sendJson(response, 201, { ok: true, diploma });
    return;
  }

  // PATCH /api/admin/diplomas/:id — переключить публичность (стена выпускников)
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/diplomas/")) {
    assertAdminPin(request);
    const dipId = urlObject.pathname.replace("/api/admin/diplomas/", "");
    const payload = await parseJsonBody(request);
    const diplomas = await readJson("diplomas.json");
    const idx = diplomas.findIndex(d => d.id === dipId);
    if (idx === -1) { sendJson(response, 404, { message: "Диплом не найден." }); return; }
    if (payload.public !== undefined) diplomas[idx].public = payload.public === true;
    await writeJson("diplomas.json", diplomas);
    sendJson(response, 200, { ok: true, diploma: diplomas[idx] });
    return;
  }

  // DELETE /api/admin/diplomas/:id
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/diplomas/")) {
    assertAdminPin(request);
    const dipId = urlObject.pathname.replace("/api/admin/diplomas/", "");
    const diplomas = await readJson("diplomas.json");
    const idx = diplomas.findIndex(d => d.id === dipId);
    if (idx === -1) { sendJson(response, 404, { message: "Диплом не найден." }); return; }
    diplomas.splice(idx, 1);
    await writeJson("diplomas.json", diplomas);
    sendJson(response, 200, { ok: true });
    return;
  }

  // POST /api/saas-lead — заявка на ранний доступ к платформе (White-label, Этап 0)
  if (request.method === "POST" && urlObject.pathname === "/api/saas-lead") {
    assertRateLimit({ scope: "saas-lead", key: getRequestIp(request), windowMs: 10 * 60 * 1000, limit: 5, message: "Слишком много заявок. Попробуйте позже." });
    const payload = await parseJsonBody(request);
    const name = sanitizeText(payload.name || "").slice(0, 120);
    const contact = sanitizeText(payload.contact || "").slice(0, 160);
    if (!name || !contact) { sendJson(response, 400, { message: "Укажите имя и контакт." }); return; }
    const lead = {
      id: crypto.randomUUID(),
      name, contact,
      size: sanitizeText(payload.size || "").slice(0, 60),
      city: sanitizeText(payload.city || "").slice(0, 80),
      note: sanitizeText(payload.note || "").slice(0, 600),
      createdAt: new Date().toISOString()
    };
    const leads = await readJson("saas-leads.json").catch(() => []);
    leads.push(lead);
    await writeJson("saas-leads.json", leads);
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      void tgSend(TELEGRAM_CHAT_ID, `🚀 Заявка на платформу (ранний доступ)\n\n👤 ${lead.name}\n📞 ${lead.contact}\n🏢 ${lead.size || "—"}${lead.city ? `\n📍 ${lead.city}` : ""}${lead.note ? `\n📝 ${lead.note}` : ""}`);
    }
    sendJson(response, 201, { ok: true });
    return;
  }
  // GET /api/admin/saas-leads — список заявок
  if (request.method === "GET" && urlObject.pathname === "/api/admin/saas-leads") {
    assertAdminPin(request);
    const leads = await readJson("saas-leads.json").catch(() => []);
    sendJson(response, 200, { leads: leads.slice().reverse() });
    return;
  }

  // GET /api/admin/referrals — агрегированная панель рефералов
  if (request.method === "GET" && urlObject.pathname === "/api/admin/referrals") {
    assertAdminPin(request);
    const [referrals, bookings] = await Promise.all([
      readJson("referrals.json").catch(() => []),
      readJson("bookings.json").catch(() => [])
    ]);
    const list = referrals.map((r) => {
      const referred = bookings.filter((b) => (b.referredByCode || "").toUpperCase() === (r.code || "").toUpperCase());
      const completed = referred.filter((b) => b.status === "completed");
      const earned = completed.length;
      const used = Math.max(0, Number(r.rewardsUsed) || 0);
      return {
        code: r.code,
        clientName: r.clientName,
        phone: r.phone || "",
        broughtTotal: referred.length,
        broughtCompleted: earned,
        rewardsEarned: earned,
        rewardsUsed: Math.min(used, earned),
        rewardsRemaining: Math.max(0, earned - used),
        referred: referred
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .map((b) => ({ clientName: b.clientName, date: b.date, status: b.status }))
      };
    }).filter((r) => r.broughtTotal > 0)
      .sort((a, b) => b.broughtCompleted - a.broughtCompleted || b.broughtTotal - a.broughtTotal);
    const totals = {
      referrers: list.length,
      broughtCompleted: list.reduce((s, r) => s + r.broughtCompleted, 0),
      rewardsRemaining: list.reduce((s, r) => s + r.rewardsRemaining, 0)
    };
    sendJson(response, 200, { referrals: list, totals });
    return;
  }
  // POST /api/admin/referrals/:code/redeem — отметить использование награды (delta ±1)
  if (request.method === "POST" && urlObject.pathname.startsWith("/api/admin/referrals/") && urlObject.pathname.endsWith("/redeem")) {
    assertAdminPin(request);
    const code = decodeURIComponent(urlObject.pathname.replace("/api/admin/referrals/", "").replace("/redeem", "")).toUpperCase();
    const payload = await parseJsonBody(request);
    const delta = Number(payload.delta) === -1 ? -1 : 1;
    const [referrals, bookings] = await Promise.all([
      readJson("referrals.json").catch(() => []),
      readJson("bookings.json").catch(() => [])
    ]);
    const idx = referrals.findIndex((r) => (r.code || "").toUpperCase() === code);
    if (idx === -1) { sendJson(response, 404, { message: "Реферер не найден." }); return; }
    const earned = bookings.filter((b) => (b.referredByCode || "").toUpperCase() === code && b.status === "completed").length;
    const cur = Math.max(0, Number(referrals[idx].rewardsUsed) || 0);
    referrals[idx].rewardsUsed = Math.min(earned, Math.max(0, cur + delta));
    await writeJson("referrals.json", referrals);
    sendJson(response, 200, { ok: true, rewardsUsed: referrals[idx].rewardsUsed, rewardsRemaining: earned - referrals[idx].rewardsUsed });
    return;
  }

  // GET /api/diplomas/:code — public
  if (request.method === "GET" && urlObject.pathname.startsWith("/api/diplomas/")) {
    const code = urlObject.pathname.replace("/api/diplomas/", "").toUpperCase();
    const diplomas = await readJson("diplomas.json");
    const diploma = diplomas.find(d => d.code.toUpperCase() === code);
    if (!diploma) { sendJson(response, 404, { message: "Диплом не найден." }); return; }
    sendJson(response, 200, diploma);
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      now: new Date().toISOString()
    });
    return;
  }

  // ─── Inventory ────────────────────────────────────────────────────────────
  // GET /api/admin/inventory
  if (request.method === "GET" && urlObject.pathname === "/api/admin/inventory") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    sendJson(response, 200, await readJson("inventory.json"));
    return;
  }

  // POST /api/admin/inventory — create item
  if (request.method === "POST" && urlObject.pathname === "/api/admin/inventory") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const name = sanitizeText(payload.name || "").trim();
    if (!name) { sendJson(response, 400, { message: "Название обязательно." }); return; }
    const items = await readJson("inventory.json");
    const item = {
      id: crypto.randomUUID(),
      name,
      category: sanitizeText(payload.category || "Прочее"),
      unit: sanitizeText(payload.unit || "шт"),
      stock: Math.max(0, parseFloat(payload.stock) || 0),
      minStock: Math.max(0, parseFloat(payload.minStock) || 0),
      costPerUnit: Math.max(0, parseFloat(payload.costPerUnit) || 0),
      notes: sanitizeText(payload.notes || ""),
      createdAt: new Date().toISOString()
    };
    items.push(item);
    await writeJson("inventory.json", items);
    sendJson(response, 201, { ok: true, item });
    return;
  }

  // PATCH /api/admin/inventory/:id — update properties
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/inventory/") && !urlObject.pathname.endsWith("/adjust")) {
    assertAdminPin(request);
    const itemId = urlObject.pathname.replace("/api/admin/inventory/", "");
    const payload = await parseJsonBody(request);
    const items = await readJson("inventory.json");
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) { sendJson(response, 404, { message: "Позиция не найдена." }); return; }
    if (payload.name !== undefined) items[idx].name = sanitizeText(payload.name);
    if (payload.category !== undefined) items[idx].category = sanitizeText(payload.category);
    if (payload.unit !== undefined) items[idx].unit = sanitizeText(payload.unit);
    if (payload.stock !== undefined) items[idx].stock = Math.max(0, parseFloat(payload.stock) || 0);
    if (payload.minStock !== undefined) items[idx].minStock = Math.max(0, parseFloat(payload.minStock) || 0);
    if (payload.costPerUnit !== undefined) items[idx].costPerUnit = Math.max(0, parseFloat(payload.costPerUnit) || 0);
    if (payload.notes !== undefined) items[idx].notes = sanitizeText(payload.notes);
    items[idx].updatedAt = new Date().toISOString();
    await writeJson("inventory.json", items);
    sendJson(response, 200, { ok: true, item: items[idx] });
    return;
  }

  // POST /api/admin/inventory/:id/adjust — add or subtract stock
  if (request.method === "POST" && urlObject.pathname.endsWith("/adjust") && urlObject.pathname.includes("/api/admin/inventory/")) {
    assertAdminPin(request);
    const itemId = urlObject.pathname.replace("/api/admin/inventory/", "").replace("/adjust", "");
    const payload = await parseJsonBody(request);
    const delta = parseFloat(payload.delta);
    if (isNaN(delta)) { sendJson(response, 400, { message: "Укажите delta." }); return; }
    const items = await readJson("inventory.json");
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) { sendJson(response, 404, { message: "Позиция не найдена." }); return; }
    items[idx].stock = Math.max(0, (items[idx].stock || 0) + delta);
    items[idx].updatedAt = new Date().toISOString();
    await writeJson("inventory.json", items);
    sendJson(response, 200, { ok: true, item: items[idx] });
    return;
  }

  // DELETE /api/admin/inventory/:id
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/inventory/")) {
    assertAdminPin(request);
    const itemId = urlObject.pathname.replace("/api/admin/inventory/", "");
    const items = await readJson("inventory.json");
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) { sendJson(response, 404, { message: "Позиция не найдена." }); return; }
    items.splice(idx, 1);
    await writeJson("inventory.json", items);
    sendJson(response, 200, { ok: true });
    return;
  }

  // ─── Financial Report ─────────────────────────────────────────────────────
  // GET /api/admin/report/financial?from=YYYY-MM&to=YYYY-MM
  if (request.method === "GET" && urlObject.pathname === "/api/admin/report/financial") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    const fromParam = urlObject.searchParams.get("from") || new Date().toISOString().slice(0, 7);
    const toParam   = urlObject.searchParams.get("to")   || fromParam;

    const bookings = await readJson("bookings.json");
    const allExpenses = await readJson("expenses.json");
    const packages = await readJson("packages.json");

    // Filter bookings: completed or confirmed, within date range
    const revenueBookings = bookings.filter(b =>
      (b.status === "completed" || b.status === "confirmed") &&
      b.date >= fromParam + "-01" &&
      b.date <= toParam + "-31"
    );

    const totalRevenue = revenueBookings.reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);

    // Revenue by service
    const byService = {};
    revenueBookings.forEach(b => {
      const key = b.serviceName || "Прочее";
      byService[key] = (byService[key] || { count: 0, total: 0 });
      byService[key].count++;
      byService[key].total += Number(b.totalPrice) || 0;
    });

    // Revenue by month
    const byMonth = {};
    revenueBookings.forEach(b => {
      const m = b.date.slice(0, 7);
      byMonth[m] = (byMonth[m] || { count: 0, total: 0 });
      byMonth[m].count++;
      byMonth[m].total += Number(b.totalPrice) || 0;
    });

    // Package revenue (issued packages in range)
    const pkgRevenue = packages.filter(p =>
      p.issuedAt && p.issuedAt.slice(0, 7) >= fromParam && p.issuedAt.slice(0, 7) <= toParam
    ).reduce((s, p) => s + (Number(p.priceTotal) || 0), 0);

    // Expenses from expenses.json
    const months = [];
    let cur = new Date(fromParam + "-01T00:00:00");
    const end = new Date(toParam + "-01T00:00:00");
    while (cur <= end) {
      months.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }

    let totalExpenses = 0;
    const expensesByCategory = {};
    const expensesByMonth = {};
    months.forEach(m => {
      const rec = allExpenses.find(r => r.month === m);
      if (!rec) return;
      expensesByMonth[m] = { total: 0, items: rec.items || [] };
      (rec.items || []).forEach(item => {
        const amt = Number(item.amount) || 0;
        totalExpenses += amt;
        expensesByMonth[m].total += amt;
        const cat = item.category || "other";
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
      });
    });

    sendJson(response, 200, {
      period: { from: fromParam, to: toParam },
      revenue: {
        total: totalRevenue,
        bookingCount: revenueBookings.length,
        packageRevenue: pkgRevenue,
        byService: Object.entries(byService).sort((a, b) => b[1].total - a[1].total).map(([name, v]) => ({ name, ...v })),
        byMonth: Object.entries(byMonth).sort().map(([month, v]) => ({ month, ...v }))
      },
      expenses: {
        total: totalExpenses,
        byCategory: Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => ({ cat, total })),
        byMonth: Object.entries(expensesByMonth).sort().map(([month, v]) => ({ month, ...v }))
      },
      net: totalRevenue - totalExpenses
    });
    return;
  }

  // POST /api/admin/report/financial/send — email report to accountant
  if (request.method === "POST" && urlObject.pathname === "/api/admin/report/financial/send") {
    assertAdminPin(request);
    if (!RESEND_API_KEY || !EMAIL_FROM) { sendJson(response, 503, { message: "Email не настроен." }); return; }
    const payload = await parseJsonBody(request);
    const toEmail  = sanitizeText(payload.email || "").trim();
    const fromDate = sanitizeText(payload.from || "");
    const toDate   = sanitizeText(payload.to   || fromDate);
    if (!toEmail || !fromDate) { sendJson(response, 400, { message: "Укажите email и период." }); return; }

    // Fetch report data internally
    const bookings = await readJson("bookings.json");
    const allExpenses = await readJson("expenses.json");
    const revenueBookings = bookings.filter(b =>
      (b.status === "completed" || b.status === "confirmed") &&
      b.date >= fromDate + "-01" && b.date <= toDate + "-31"
    );
    const totalRevenue = revenueBookings.reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);
    const byService = {};
    revenueBookings.forEach(b => {
      const k = b.serviceName || "Прочее";
      if (!byService[k]) byService[k] = { count: 0, total: 0 };
      byService[k].count++; byService[k].total += Number(b.totalPrice) || 0;
    });
    const months = [];
    let mc = new Date(fromDate + "-01T00:00:00");
    const me = new Date(toDate + "-01T00:00:00");
    while (mc <= me) { months.push(mc.toISOString().slice(0, 7)); mc.setMonth(mc.getMonth() + 1); }
    let totalExpenses = 0;
    const expCat = {};
    months.forEach(m => {
      const rec = allExpenses.find(r => r.month === m);
      (rec?.items || []).forEach(it => {
        const amt = Number(it.amount) || 0;
        totalExpenses += amt;
        expCat[it.name || "Прочее"] = (expCat[it.name || "Прочее"] || 0) + amt;
      });
    });
    const net = totalRevenue - totalExpenses;
    const periodLabel = fromDate === toDate ? fromDate : `${fromDate} — ${toDate}`;
    const fmt = n => `${n.toLocaleString("ru-RU")} MDL`;
    const netColor = net >= 0 ? "#2d6a4f" : "#b43232";

    const serviceRows = Object.entries(byService).sort((a,b)=>b[1].total-a[1].total)
      .map(([name,v]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0e8de;">${escapeHtml(name)}</td><td style="padding:8px 12px;border-bottom:1px solid #f0e8de;text-align:center;">${v.count}</td><td style="padding:8px 12px;border-bottom:1px solid #f0e8de;text-align:right;font-weight:600;">${fmt(v.total)}</td></tr>`).join("");
    const expRows = Object.entries(expCat).sort((a,b)=>b[1]-a[1])
      .map(([name,total]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0e8de;">${escapeHtml(name)}</td><td style="padding:8px 12px;border-bottom:1px solid #f0e8de;text-align:right;font-weight:600;">${fmt(total)}</td></tr>`).join("");

    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f0e6;font-family:'Helvetica Neue',Arial,sans-serif;color:#241c17;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f0e6;padding:40px 16px;"><tr><td align="center">
<table width="100%" style="max-width:600px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">
<tr><td style="background:#1a2e22;padding:24px 36px;">
  <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Финансовый отчёт</p>
  <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">Mateev Spa Studio</p>
  <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Период: ${escapeHtml(periodLabel)}</p>
</td></tr>
<tr><td style="padding:28px 36px 0;">
  <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
    <tr>
      <td style="background:#f0f7f0;border-radius:12px;padding:16px 20px;text-align:center;width:33%;">
        <p style="margin:0 0 4px;font-size:11px;color:#7d6d60;text-transform:uppercase;letter-spacing:0.06em;">Выручка</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#2d6a4f;">${fmt(totalRevenue)}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7d6d60;">${revenueBookings.length} визитов</p>
      </td>
      <td width="8"></td>
      <td style="background:#fff5f5;border-radius:12px;padding:16px 20px;text-align:center;width:33%;">
        <p style="margin:0 0 4px;font-size:11px;color:#7d6d60;text-transform:uppercase;letter-spacing:0.06em;">Расходы</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#b43232;">${fmt(totalExpenses)}</p>
      </td>
      <td width="8"></td>
      <td style="background:${net>=0?'#f0f7f0':'#fff5f5'};border-radius:12px;padding:16px 20px;text-align:center;width:33%;">
        <p style="margin:0 0 4px;font-size:11px;color:#7d6d60;text-transform:uppercase;letter-spacing:0.06em;">Прибыль</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:${netColor};">${fmt(net)}</p>
      </td>
    </tr>
  </table>
</td></tr>
${serviceRows ? `<tr><td style="padding:0 36px 24px;">
  <p style="font-size:13px;font-weight:700;color:#1a2e22;margin:0 0 10px;">Выручка по услугам</p>
  <table width="100%" style="border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#f3ece3;"><th style="padding:8px 12px;text-align:left;">Услуга</th><th style="padding:8px 12px;text-align:center;">Визиты</th><th style="padding:8px 12px;text-align:right;">Сумма</th></tr></thead>
    <tbody>${serviceRows}</tbody>
    <tfoot><tr style="background:#f3ece3;font-weight:700;"><td style="padding:8px 12px;">Итого</td><td style="padding:8px 12px;text-align:center;">${revenueBookings.length}</td><td style="padding:8px 12px;text-align:right;">${fmt(totalRevenue)}</td></tr></tfoot>
  </table>
</td></tr>` : ""}
${expRows ? `<tr><td style="padding:0 36px 28px;">
  <p style="font-size:13px;font-weight:700;color:#1a2e22;margin:0 0 10px;">Расходы</p>
  <table width="100%" style="border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#f3ece3;"><th style="padding:8px 12px;text-align:left;">Статья</th><th style="padding:8px 12px;text-align:right;">Сумма</th></tr></thead>
    <tbody>${expRows}</tbody>
    <tfoot><tr style="background:#f3ece3;font-weight:700;"><td style="padding:8px 12px;">Итого расходов</td><td style="padding:8px 12px;text-align:right;">${fmt(totalExpenses)}</td></tr></tfoot>
  </table>
</td></tr>` : ""}
<tr><td style="padding:16px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);">
  <p style="margin:0;font-size:12px;color:#7d6d60;">Mateev Spa Studio · Кишинёв, Молдова · Сформировано ${new Date().toLocaleDateString("ru-RU")}</p>
</td></tr>
</table></td></tr></table></body></html>`;

    await requestJson("https://api.resend.com/emails", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      body: { from: EMAIL_FROM, to: [toEmail], subject: `Финансовый отчёт Mateev Spa Studio — ${periodLabel}`, html }
    });
    sendJson(response, 200, { ok: true });
    return;
  }

  // ─── Backup ───────────────────────────────────────────────────────────────
  // GET /api/admin/backup/download — download full data bundle as JSON
  if (request.method === "GET" && urlObject.pathname === "/api/admin/backup/download") {
    assertAdminPin(request);
    const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith(".json"));
    const bundle = {};
    for (const file of files) {
      const key = file.replace(".json", "");
      try { bundle[key] = await readJson(file); } catch { bundle[key] = []; }
    }
    bundle._meta = { exportedAt: new Date().toISOString(), files: files.length };
    const json     = JSON.stringify(bundle, null, 2);
    const date     = new Date().toISOString().slice(0, 10);
    const filename = `mateev-backup-${date}.json`;
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": Buffer.byteLength(json),
      "Cache-Control": "no-store"
    });
    response.end(json);
    return;
  }

  // POST /api/admin/backup/now — trigger backup + email
  if (request.method === "POST" && urlObject.pathname === "/api/admin/backup/now") {
    assertAdminPin(request);
    const { execFile } = await import("node:child_process");
    const scriptPath = path.join(ROOT_DIR, "scripts", "backup-data.js");
    execFile(process.execPath, [scriptPath, "manual"], { timeout: 30000 }, (err) => {
      if (err) console.error("Manual backup error:", err.message);
    });
    sendJson(response, 200, { ok: true, message: "Бэкап запущен. Email придёт в течение минуты." });
    return;
  }

  // GET /api/admin/backup/status — last backup file info
  if (request.method === "GET" && urlObject.pathname === "/api/admin/backup/status") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    try {
      const files = (await fs.readdir(BACKUP_DIR))
        .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
        .sort();
      const last = files[files.length - 1] || null;
      let lastDate = null;
      if (last) {
        const stat = await fs.stat(path.join(BACKUP_DIR, last));
        lastDate = stat.mtime.toISOString();
      }
      sendJson(response, 200, { count: files.length, lastFile: last, lastDate });
    } catch { sendJson(response, 200, { count: 0, lastFile: null, lastDate: null }); }
    return;
  }

  // ─── Rec Templates ────────────────────────────────────────────────────────
  if (request.method === "GET" && urlObject.pathname === "/api/admin/rec-templates") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    sendJson(response, 200, await readJson("rec-templates.json"));
    return;
  }
  if (request.method === "POST" && urlObject.pathname === "/api/admin/rec-templates") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const name = sanitizeText(payload.name || "").trim();
    const text = sanitizeText(payload.text || "").trim();
    if (!name || !text) { sendJson(response, 400, { message: "Укажите название и текст." }); return; }
    const templates = await readJson("rec-templates.json");
    const tpl = { id: crypto.randomUUID(), name, text, createdAt: new Date().toISOString() };
    templates.push(tpl);
    await writeJson("rec-templates.json", templates);
    sendJson(response, 201, { ok: true, template: tpl });
    return;
  }
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/rec-templates/")) {
    assertAdminPin(request);
    const tplId = urlObject.pathname.replace("/api/admin/rec-templates/", "");
    const payload = await parseJsonBody(request);
    const templates = await readJson("rec-templates.json");
    const idx = templates.findIndex(t => t.id === tplId);
    if (idx === -1) { sendJson(response, 404, { message: "Шаблон не найден." }); return; }
    if (payload.name !== undefined) templates[idx].name = sanitizeText(payload.name);
    if (payload.text !== undefined) templates[idx].text = sanitizeText(payload.text);
    await writeJson("rec-templates.json", templates);
    sendJson(response, 200, { ok: true, template: templates[idx] });
    return;
  }
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/rec-templates/")) {
    assertAdminPin(request);
    const tplId = urlObject.pathname.replace("/api/admin/rec-templates/", "");
    const templates = await readJson("rec-templates.json");
    const idx = templates.findIndex(t => t.id === tplId);
    if (idx === -1) { sendJson(response, 404, { message: "Шаблон не найден." }); return; }
    templates.splice(idx, 1);
    await writeJson("rec-templates.json", templates);
    sendJson(response, 200, { ok: true });
    return;
  }

  // ─── Broadcast ────────────────────────────────────────────────────────────
  // GET /api/admin/broadcast/preview?segment=all|vip|inactive|has_package
  if (request.method === "GET" && urlObject.pathname === "/api/admin/broadcast/preview") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    const segment = urlObject.searchParams.get("segment") || "all";
    const { bookings, clients } = await loadStudioData();
    const allClients = buildAdminClients(bookings, clients);
    const packages = await readJson("packages.json");
    const now = new Date();
    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const matched = allClients.filter(c => {
      if (!c.email) return false;
      if (segment === "vip") return c.status === "vip";
      if (segment === "inactive") {
        const lastDate = c.lastBooking?.date || "";
        return lastDate < cutoff;
      }
      if (segment === "has_package") {
        return packages.some(p => p.status === "active" && (
          (c.phone && p.phone && normalizePhoneDigits(p.phone) === normalizePhoneDigits(c.phone)) ||
          p.clientName === c.clientName
        ));
      }
      return true; // all
    });
    sendJson(response, 200, {
      count: matched.length,
      segment,
      preview: matched.slice(0, 5).map(c => ({ name: c.clientName, email: c.email }))
    });
    return;
  }

  // POST /api/admin/broadcast — send emails
  if (request.method === "POST" && urlObject.pathname === "/api/admin/broadcast") {
    assertAdminPin(request);
    if (!RESEND_API_KEY || !EMAIL_FROM) { sendJson(response, 503, { message: "Email не настроен." }); return; }
    const payload = await parseJsonBody(request);
    const segment = sanitizeText(payload.segment || "all");
    const subject = sanitizeText(payload.subject || "").trim();
    const bodyText = sanitizeText(payload.body || "").trim();
    if (!subject || !bodyText) { sendJson(response, 400, { message: "Укажите тему и текст письма." }); return; }
    const { bookings, clients } = await loadStudioData();
    const allClients = buildAdminClients(bookings, clients);
    const packages = await readJson("packages.json");
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const matched = allClients.filter(c => {
      if (!c.email) return false;
      if (segment === "vip") return c.status === "vip";
      if (segment === "inactive") { const d = c.lastBooking?.date || ""; return d < cutoff; }
      if (segment === "has_package") return packages.some(p => p.status === "active" && (
        (c.phone && p.phone && normalizePhoneDigits(p.phone) === normalizePhoneDigits(c.phone)) || p.clientName === c.clientName
      ));
      return true;
    });
    if (!matched.length) { sendJson(response, 400, { message: "Нет клиентов с email в этом сегменте." }); return; }
    const brandColor = "#b36d2c";
    const bg = "#f7f0e6";
    const ink = "#241c17";
    const muted = "#7d6d60";
    let sent = 0, failed = 0;
    for (const client of matched) {
      const personalised = bodyText.replace(/\{имя\}/gi, client.clientName);
      const htmlBody = personalised.split("\n").map(l => l.trim() ? `<p style="margin:0 0 14px;font-size:14px;color:${ink};line-height:1.6;">${escapeHtml(l)}</p>` : "<br>").join("");
      const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">
        <tr><td style="background:${brandColor};padding:28px 36px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Студия массажа в Кишиневе</p>
          <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">Mateev Spa Studio</p>
        </td></tr>
        <tr><td style="padding:32px 36px 24px;">${htmlBody}</td></tr>
        <tr><td style="padding:0 36px 28px;">
          <a href="${SITE_URL}/#booking" style="display:inline-block;padding:12px 24px;background:${brandColor};color:#fff;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;">Записаться →</a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(68,50,36,0.10);">
          <p style="margin:0;font-size:11px;color:${muted};">Mateev Spa Studio · Кишинёв, Молдова</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
      try {
        await requestJson("https://api.resend.com/emails", {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          body: { from: EMAIL_FROM, to: [client.email], subject, html, text: personalised }
        });
        sent++;
        if (sent % 5 === 0) await new Promise(r => setTimeout(r, 500));
      } catch { failed++; }
    }
    sendJson(response, 200, { ok: true, sent, failed, total: matched.length });
    return;
  }

  // ─── Gallery ──────────────────────────────────────────────────────────────
  // GET /api/gallery — public
  if (request.method === "GET" && urlObject.pathname === "/api/gallery") {
    const items = await readJson("gallery.json");
    sendJson(response, 200, items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
    return;
  }

  // GET /api/admin/gallery — admin
  if (request.method === "GET" && urlObject.pathname === "/api/admin/gallery") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    const items = await readJson("gallery.json");
    sendJson(response, 200, items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
    return;
  }

  // POST /api/admin/gallery/upload — upload photo (base64)
  if (request.method === "POST" && urlObject.pathname === "/api/admin/gallery/upload") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 10 * 1024 * 1024);
    const { photo, alt } = payload;
    if (!photo || typeof photo !== "string") { sendJson(response, 400, { message: "Поле photo обязательно." }); return; }
    const match = photo.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
    if (!match) { sendJson(response, 400, { message: "Неверный формат. Поддерживаются JPEG, PNG, WebP." }); return; }
    const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
    const buffer = Buffer.from(match[3], "base64");
    if (buffer.length > 8 * 1024 * 1024) { sendJson(response, 400, { message: "Файл слишком большой. Максимум 8MB." }); return; }
    await fs.mkdir(GALLERY_UPLOADS_DIR, { recursive: true });
    const id = crypto.randomUUID();
    const filename = `gallery-${id}.${ext}`;
    await fs.writeFile(path.join(GALLERY_UPLOADS_DIR, filename), buffer);
    const items = await readJson("gallery.json");
    const item = { id, filename, url: `/uploads/gallery/${filename}`, alt: sanitizeText(alt || ""), order: items.length, createdAt: new Date().toISOString() };
    items.push(item);
    await writeJson("gallery.json", items);
    sendJson(response, 201, { ok: true, item });
    return;
  }

  // PATCH /api/admin/gallery/:id — update alt or order
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/gallery/")) {
    assertAdminPin(request);
    const itemId = urlObject.pathname.replace("/api/admin/gallery/", "");
    const payload = await parseJsonBody(request);
    const items = await readJson("gallery.json");
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) { sendJson(response, 404, { message: "Фото не найдено." }); return; }
    if (payload.alt !== undefined) items[idx].alt = sanitizeText(payload.alt);
    if (payload.order !== undefined) items[idx].order = parseInt(payload.order) || 0;
    await writeJson("gallery.json", items);
    sendJson(response, 200, { ok: true, item: items[idx] });
    return;
  }

  // DELETE /api/admin/gallery/:id
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/gallery/")) {
    assertAdminPin(request);
    const itemId = urlObject.pathname.replace("/api/admin/gallery/", "");
    const items = await readJson("gallery.json");
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) { sendJson(response, 404, { message: "Фото не найдено." }); return; }
    const filename = items[idx].filename;
    items.splice(idx, 1);
    items.forEach((it, i) => { it.order = i; });
    await writeJson("gallery.json", items);
    try { await fs.unlink(path.join(GALLERY_UPLOADS_DIR, filename)); } catch {}
    sendJson(response, 200, { ok: true });
    return;
  }

  // ─── Результаты «до/после» (before-after) ─────────────────────────────────
  // POST /api/admin/results/upload — загрузка изображения (без записи в галерею)
  if (request.method === "POST" && urlObject.pathname === "/api/admin/results/upload") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 10 * 1024 * 1024);
    const { photo } = payload;
    if (!photo || typeof photo !== "string") { sendJson(response, 400, { message: "Поле photo обязательно." }); return; }
    const match = photo.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
    if (!match) { sendJson(response, 400, { message: "Неверный формат (JPEG, PNG, WebP)." }); return; }
    const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
    const buffer = Buffer.from(match[3], "base64");
    if (buffer.length > 8 * 1024 * 1024) { sendJson(response, 400, { message: "Файл слишком большой (макс 8MB)." }); return; }
    await fs.mkdir(GALLERY_UPLOADS_DIR, { recursive: true });
    const filename = `result-${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(GALLERY_UPLOADS_DIR, filename), buffer);
    sendJson(response, 201, { ok: true, url: `/uploads/gallery/${filename}`, filename });
    return;
  }
  // GET /api/results — public
  if (request.method === "GET" && urlObject.pathname === "/api/results") {
    const items = await readJson("results.json").catch(() => []);
    sendJson(response, 200, items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
    return;
  }
  // GET /api/admin/results — admin
  if (request.method === "GET" && urlObject.pathname === "/api/admin/results") {
    assertAdminPin(request);
    const items = await readJson("results.json").catch(() => []);
    sendJson(response, 200, items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
    return;
  }
  // POST /api/admin/results — создать пару до/после
  if (request.method === "POST" && urlObject.pathname === "/api/admin/results") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const beforeUrl = sanitizeText(payload.beforeUrl || "");
    const afterUrl = sanitizeText(payload.afterUrl || "");
    if (!/^\/uploads\/gallery\//.test(beforeUrl) || !/^\/uploads\/gallery\//.test(afterUrl)) {
      sendJson(response, 400, { message: "Нужны оба изображения (до и после)." }); return;
    }
    const items = await readJson("results.json").catch(() => []);
    const item = {
      id: crypto.randomUUID(),
      beforeUrl, afterUrl,
      beforeFile: path.basename(beforeUrl), afterFile: path.basename(afterUrl),
      caption: sanitizeText(payload.caption || "").slice(0, 200),
      zone: sanitizeText(payload.zone || "").slice(0, 80),
      order: items.length,
      createdAt: new Date().toISOString()
    };
    items.push(item);
    await writeJson("results.json", items);
    sendJson(response, 201, { ok: true, item });
    return;
  }
  // DELETE /api/admin/results/:id
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/results/")) {
    assertAdminPin(request);
    const id = urlObject.pathname.replace("/api/admin/results/", "");
    const items = await readJson("results.json").catch(() => []);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) { sendJson(response, 404, { message: "Не найдено." }); return; }
    const it = items[idx];
    items.splice(idx, 1);
    items.forEach((x, i) => { x.order = i; });
    await writeJson("results.json", items);
    for (const f of [it.beforeFile, it.afterFile]) { if (f) { try { await fs.unlink(path.join(GALLERY_UPLOADS_DIR, f)); } catch {} } }
    sendJson(response, 200, { ok: true });
    return;
  }

  // ─── Дипломы и сертификаты владельца (регалии) ────────────────────────────
  if (request.method === "GET" && urlObject.pathname === "/api/credentials") {
    const items = await readJson("credentials.json").catch(() => []);
    sendJson(response, 200, { credentials: items.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) });
    return;
  }
  if (request.method === "GET" && urlObject.pathname === "/api/admin/credentials") {
    assertAdminPin(request);
    const items = await readJson("credentials.json").catch(() => []);
    sendJson(response, 200, { credentials: items.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) });
    return;
  }
  if (request.method === "POST" && urlObject.pathname === "/api/admin/credentials/upload") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 10 * 1024 * 1024);
    const { photo, title, year } = payload;
    if (!photo || typeof photo !== "string") { sendJson(response, 400, { message: "Поле photo обязательно." }); return; }
    const match = photo.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
    if (!match) { sendJson(response, 400, { message: "Неверный формат. Поддерживаются JPEG, PNG, WebP." }); return; }
    const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
    const buffer = Buffer.from(match[3], "base64");
    if (buffer.length > 8 * 1024 * 1024) { sendJson(response, 400, { message: "Файл слишком большой. Максимум 8MB." }); return; }
    await fs.mkdir(CREDENTIALS_UPLOADS_DIR, { recursive: true });
    const id = crypto.randomUUID();
    const filename = `cred-${id}.${ext}`;
    await fs.writeFile(path.join(CREDENTIALS_UPLOADS_DIR, filename), buffer);
    const items = await readJson("credentials.json").catch(() => []);
    const item = {
      id, filename, url: `/uploads/credentials/${filename}`,
      title: sanitizeText(title || ""), year: sanitizeText(year || ""),
      order: items.length, createdAt: new Date().toISOString()
    };
    items.push(item);
    await writeJson("credentials.json", items);
    sendJson(response, 201, { ok: true, item });
    return;
  }
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/credentials/")) {
    assertAdminPin(request);
    const itemId = urlObject.pathname.replace("/api/admin/credentials/", "");
    const payload = await parseJsonBody(request);
    const items = await readJson("credentials.json").catch(() => []);
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) { sendJson(response, 404, { message: "Диплом не найден." }); return; }
    if (payload.title !== undefined) items[idx].title = sanitizeText(payload.title);
    if (payload.year !== undefined) items[idx].year = sanitizeText(payload.year);
    if (payload.order !== undefined) items[idx].order = parseInt(payload.order) || 0;
    await writeJson("credentials.json", items);
    sendJson(response, 200, { ok: true, item: items[idx] });
    return;
  }
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/credentials/")) {
    assertAdminPin(request);
    const itemId = urlObject.pathname.replace("/api/admin/credentials/", "");
    const items = await readJson("credentials.json").catch(() => []);
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) { sendJson(response, 404, { message: "Диплом не найден." }); return; }
    const filename = items[idx].filename;
    items.splice(idx, 1);
    items.forEach((it, i) => { it.order = i; });
    await writeJson("credentials.json", items);
    try { await fs.unlink(path.join(CREDENTIALS_UPLOADS_DIR, filename)); } catch {}
    sendJson(response, 200, { ok: true });
    return;
  }

  // ─── Материалы семинаров (приватная библиотека методичек) ─────────────────
  // GET /api/admin/materials — список
  if (request.method === "GET" && urlObject.pathname === "/api/admin/materials") {
    assertAdminPin(request);
    const items = await readJson("materials.json").catch(() => []);
    const list = items.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    sendJson(response, 200, { materials: list });
    return;
  }
  // POST /api/admin/materials — создать методичку
  if (request.method === "POST" && urlObject.pathname === "/api/admin/materials") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 2 * 1024 * 1024);
    const items = await readJson("materials.json").catch(() => []);
    const now = new Date().toISOString();
    const item = {
      id: crypto.randomUUID(),
      title: sanitizeText(payload.title || "Без названия").slice(0, 200),
      topics: sanitizeText(payload.topics || "").slice(0, 300),
      date: sanitizeText(payload.date || "").slice(0, 20),
      content: String(payload.content || "").slice(0, 60000),
      token: crypto.randomBytes(18).toString("hex"),
      createdAt: now, updatedAt: now
    };
    items.push(item);
    await writeJson("materials.json", items);
    sendJson(response, 201, { ok: true, item });
    return;
  }
  // PATCH /api/admin/materials/:id — обновить (или ?reset=1 — сменить ссылку)
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/materials/")) {
    assertAdminPin(request);
    const id = urlObject.pathname.replace("/api/admin/materials/", "");
    const items = await readJson("materials.json").catch(() => []);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) { sendJson(response, 404, { message: "Методичка не найдена." }); return; }
    if (urlObject.searchParams.get("reset") === "1") {
      items[idx].token = crypto.randomBytes(18).toString("hex");
    } else {
      const payload = await parseJsonBody(request, 2 * 1024 * 1024);
      if (payload.title !== undefined) items[idx].title = sanitizeText(payload.title).slice(0, 200);
      if (payload.topics !== undefined) items[idx].topics = sanitizeText(payload.topics).slice(0, 300);
      if (payload.date !== undefined) items[idx].date = sanitizeText(payload.date).slice(0, 20);
      if (payload.content !== undefined) items[idx].content = String(payload.content).slice(0, 60000);
    }
    items[idx].updatedAt = new Date().toISOString();
    await writeJson("materials.json", items);
    sendJson(response, 200, { ok: true, item: items[idx] });
    return;
  }
  // DELETE /api/admin/materials/:id
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/materials/")) {
    assertAdminPin(request);
    const id = urlObject.pathname.replace("/api/admin/materials/", "");
    const items = await readJson("materials.json").catch(() => []);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) { sendJson(response, 404, { message: "Методичка не найдена." }); return; }
    items.splice(idx, 1);
    await writeJson("materials.json", items);
    sendJson(response, 200, { ok: true });
    return;
  }
  // POST /api/admin/ai-material — AI-черновик методички по темам
  if (request.method === "POST" && urlObject.pathname === "/api/admin/ai-material") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const topics = sanitizeText(payload.topics || "").slice(0, 300);
    if (!topics) { sendJson(response, 400, { message: "Укажите зоны/темы семинара." }); return; }
    const userMsg = `Составь теоретическую методичку по зонам: ${topics}. Обязательно допиши до конца, ничего не обрывай.`;
    const reply = await callAnthropic(AI_MATERIAL_PROMPT, [{ role: "user", content: userMsg }], 4000);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }
  // POST /api/admin/care-ai — AI-черновик памятки клиенту после сеанса
  if (request.method === "POST" && urlObject.pathname === "/api/admin/care-ai") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const clientName = sanitizeText(payload.clientName || "").slice(0, 80);
    const zones = sanitizeText(payload.zones || "").slice(0, 300);
    const techniques = sanitizeText(payload.techniques || "").slice(0, 300);
    const notes = sanitizeText(payload.notes || "").slice(0, 600);
    if (!zones && !techniques) { sendJson(response, 400, { message: "Укажите зоны или техники сеанса." }); return; }
    const langLabel = payload.lang === "ro" ? "румынском" : "русском";
    const userMsg = `Данные сеанса:\n- Имя клиента: ${clientName || "—"}\n- Проработанные зоны: ${zones || "—"}\n- Техники: ${techniques || "—"}\n- Заметки массажиста: ${notes || "—"}\n\nСоставь памятку на ${langLabel} языке. Если указано имя — обращайся по имени.`;
    const reply = await callAnthropic(AI_CARE_PROMPT, [{ role: "user", content: userMsg }], 1400);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }
  // GET /api/admin/care-notes — список памяток
  if (request.method === "GET" && urlObject.pathname === "/api/admin/care-notes") {
    assertAdminPin(request);
    const items = await readJson("care-notes.json").catch(() => []);
    const list = items.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    sendJson(response, 200, { notes: list });
    return;
  }
  // POST /api/admin/care-notes — создать памятку
  if (request.method === "POST" && urlObject.pathname === "/api/admin/care-notes") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 1024 * 1024);
    const content = String(payload.content || "").slice(0, 20000);
    if (!content.trim()) { sendJson(response, 400, { message: "Памятка пустая." }); return; }
    const items = await readJson("care-notes.json").catch(() => []);
    const now = new Date().toISOString();
    const item = {
      id: crypto.randomUUID(),
      clientName: sanitizeText(payload.clientName || "").slice(0, 80),
      zones: sanitizeText(payload.zones || "").slice(0, 300),
      techniques: sanitizeText(payload.techniques || "").slice(0, 300),
      content,
      token: crypto.randomBytes(18).toString("hex"),
      createdAt: now, updatedAt: now
    };
    items.push(item);
    await writeJson("care-notes.json", items);
    sendJson(response, 201, { ok: true, item });
    return;
  }
  // PATCH /api/admin/care-notes/:id — обновить (или ?reset=1 — новая ссылка)
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/care-notes/")) {
    assertAdminPin(request);
    const id = urlObject.pathname.replace("/api/admin/care-notes/", "");
    const items = await readJson("care-notes.json").catch(() => []);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) { sendJson(response, 404, { message: "Памятка не найдена." }); return; }
    if (urlObject.searchParams.get("reset") === "1") {
      items[idx].token = crypto.randomBytes(18).toString("hex");
    } else {
      const payload = await parseJsonBody(request, 1024 * 1024);
      if (payload.clientName !== undefined) items[idx].clientName = sanitizeText(payload.clientName).slice(0, 80);
      if (payload.zones !== undefined) items[idx].zones = sanitizeText(payload.zones).slice(0, 300);
      if (payload.techniques !== undefined) items[idx].techniques = sanitizeText(payload.techniques).slice(0, 300);
      if (payload.content !== undefined) items[idx].content = String(payload.content).slice(0, 20000);
    }
    items[idx].updatedAt = new Date().toISOString();
    await writeJson("care-notes.json", items);
    sendJson(response, 200, { ok: true, item: items[idx] });
    return;
  }
  // DELETE /api/admin/care-notes/:id
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/care-notes/")) {
    assertAdminPin(request);
    const id = urlObject.pathname.replace("/api/admin/care-notes/", "");
    const items = await readJson("care-notes.json").catch(() => []);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) { sendJson(response, 404, { message: "Памятка не найдена." }); return; }
    items.splice(idx, 1);
    await writeJson("care-notes.json", items);
    sendJson(response, 200, { ok: true });
    return;
  }
  // POST /api/admin/followup-ai — AI-сообщение «как самочувствие после сеанса»
  if (request.method === "POST" && urlObject.pathname === "/api/admin/followup-ai") {
    assertAdminPin(request);
    if (!ANTHROPIC_API_KEY) { sendJson(response, 503, { message: "AI недоступен: не задан ANTHROPIC_API_KEY на сервере." }); return; }
    const payload = await parseJsonBody(request);
    const clientName = sanitizeText(payload.clientName || "").slice(0, 80);
    const serviceName = sanitizeText(payload.serviceName || "").slice(0, 120);
    const zones = sanitizeText(payload.zones || "").slice(0, 200);
    const langLabel = payload.lang === "ro" ? "румынском" : "русском";
    const system = AI_FOLLOWUP_PROMPT.replace("{lang}", langLabel);
    const userMsg = `Клиент: ${clientName || "—"}. Услуга: ${serviceName || "—"}. Проработанные зоны: ${zones || "—"}.`;
    const reply = await callAnthropic(system, [{ role: "user", content: userMsg }], 400);
    if (!reply) { sendJson(response, 502, { message: "AI не ответил. Попробуйте ещё раз." }); return; }
    sendJson(response, 200, { reply });
    return;
  }
  // POST /api/admin/followup-send — отправить follow-up клиенту в Telegram (если привязан)
  if (request.method === "POST" && urlObject.pathname === "/api/admin/followup-send") {
    assertAdminPin(request);
    if (!TELEGRAM_BOT_TOKEN) { sendJson(response, 503, { message: "Telegram-бот не настроен." }); return; }
    const payload = await parseJsonBody(request);
    const text = String(payload.text || "").trim().slice(0, 2000);
    const digits = normalizePhoneDigits(payload.phone || "");
    if (!text) { sendJson(response, 400, { message: "Пустое сообщение." }); return; }
    if (!digits) { sendJson(response, 400, { message: "Нужен телефон клиента." }); return; }
    const tokens = await readJson("portal-tokens.json").catch(() => []);
    const targets = new Set();
    for (const tkn of tokens) { if (tkn.telegramChatId && normalizePhoneDigits(tkn.phone || "") === digits) targets.add(String(tkn.telegramChatId)); }
    let sent = 0;
    for (const chat of targets) { try { await tgSend(chat, text); sent++; } catch {} }
    sendJson(response, 200, { ok: true, sent, linked: targets.size > 0 });
    return;
  }
  // POST /api/admin/materials/upload — загрузка картинки для методички
  if (request.method === "POST" && urlObject.pathname === "/api/admin/materials/upload") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 10 * 1024 * 1024);
    const photo = payload.photo;
    if (!photo || typeof photo !== "string") { sendJson(response, 400, { message: "Поле photo обязательно." }); return; }
    const match = photo.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
    if (!match) { sendJson(response, 400, { message: "Неверный формат. Поддерживаются JPEG, PNG, WebP." }); return; }
    const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
    const buffer = Buffer.from(match[3], "base64");
    if (buffer.length > 8 * 1024 * 1024) { sendJson(response, 400, { message: "Файл слишком большой. Максимум 8MB." }); return; }
    await fs.mkdir(MATERIALS_UPLOADS_DIR, { recursive: true });
    const filename = `mat-${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(MATERIALS_UPLOADS_DIR, filename), buffer);
    sendJson(response, 201, { ok: true, url: `/uploads/materials/${filename}` });
    return;
  }

  // ─── Client Portal ────────────────────────────────────────────────────────
  // POST /api/admin/clients/:id/portal-link — generate or refresh portal link
  if (request.method === "POST" && urlObject.pathname.endsWith("/portal-link") && urlObject.pathname.startsWith("/api/admin/clients/")) {
    assertAdminPin(request);
    const clientId = urlObject.pathname.replace("/api/admin/clients/", "").replace("/portal-link", "");
    const { bookings, clients } = await loadStudioData();
    const allClients = buildAdminClients(bookings, clients);
    const client = allClients.find(c => c.id === clientId);
    if (!client) { sendJson(response, 404, { message: "Клиент не найден." }); return; }
    const tokens = await readJson("portal-tokens.json");
    const filtered = tokens.filter(t => t.clientId !== clientId);
    const token = crypto.randomBytes(24).toString("hex");
    filtered.push({ token, clientId, clientName: client.clientName, phone: client.phone || "", createdAt: new Date().toISOString() });
    await writeJson("portal-tokens.json", filtered);
    sendJson(response, 200, { ok: true, token });
    return;
  }

  // POST /api/ai-chat — AI-ресепшн (Claude отвечает на вопросы гостей)
  if (request.method === "POST" && urlObject.pathname === "/api/ai-chat") {
    if (!ANTHROPIC_API_KEY) {
      sendJson(response, 503, { message: "Консультант временно недоступен. Напишите нам в Telegram." });
      return;
    }
    assertRateLimit({
      scope: "ai-chat",
      key: getRequestIp(request),
      windowMs: 5 * 60 * 1000,
      limit: 25,
      message: "Слишком много сообщений. Попробуйте через пару минут."
    });
    const payload = await parseJsonBody(request);
    const userMsg = sanitizeText(payload.message || "").slice(0, 1000);
    if (!userMsg) { sendJson(response, 400, { message: "Пустое сообщение." }); return; }
    const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];
    const messages = [];
    for (const h of history) {
      const role = h && h.role === "assistant" ? "assistant" : "user";
      const content = sanitizeText((h && h.content) || "").slice(0, 1000);
      if (content) messages.push({ role, content });
    }
    messages.push({ role: "user", content: userMsg });
    while (messages.length && messages[0].role !== "user") messages.shift();
    const result = await runReceptionAgent(messages);
    if (!result || !result.reply) {
      sendJson(response, 502, { message: "Консультант сейчас недоступен. Напишите нам в Telegram — ответим лично." });
      return;
    }
    // Если оформилась запись — шлём структурированное подтверждение в Telegram (если клиент привязан)
    if (result.booking) void sendClientBookingConfirmation(result.booking, null);
    sendJson(response, 200, { reply: result.reply });
    return;
  }

  // POST /api/session-match — AI-подбор сеанса (интегративный метод → рекомендация + запись)
  if (request.method === "POST" && urlObject.pathname === "/api/session-match") {
    assertRateLimit({ scope: "session-match", key: getRequestIp(request), windowMs: 5 * 60 * 1000, limit: 30, message: "Слишком много запросов. Попробуйте чуть позже." });
    const payload = await parseJsonBody(request);
    const a = {
      goal: sanitizeText(payload.goal || "").slice(0, 40),
      area: sanitizeText(payload.area || "").slice(0, 40),
      pressure: sanitizeText(payload.pressure || "").slice(0, 20),
      condition: sanitizeText(payload.condition || "").slice(0, 40),
      extra: sanitizeText(payload.extra || "").slice(0, 300),
      lang: payload.lang === "ro" ? "ro" : "ru"
    };
    const services = await readJson("services.json").catch(() => []);
    const allowed = services.map((s) => s.id);
    let result = null;

    if (ANTHROPIC_API_KEY) {
      const svcList = services.map((s) => `${s.id}: ${s.name} (${s.duration} мин, ${s.price} MDL) — ${s.description}`).join("\n");
      const langLabel = a.lang === "ro" ? "румынском" : "русском";
      const system = `Ты — консультант студии Mateev Spa Studio (Кишинёв). Денис Матеев практикует АВТОРСКИЙ ИНТЕГРАТИВНЫЙ МАССАЖ — набор техник под задачу клиента: миофасциальный релиз (МФР), триггерные точки, постизометрическая релаксация (ПИР), дифиброзирующий массаж, лимфодренаж, висцеральная терапия, массаж груди/постуры, массаж лица (в т.ч. интрабуккальный), восточные техники (шиацу, акупрессура, рефлексология).

По ответам клиента подбери сеанс. Пиши на ${langLabel} языке, тепло и по делу.

ДОСТУПНЫЕ УСЛУГИ (serviceId выбирай СТРОГО из этих id):
${svcList}

БЕЗОПАСНОСТЬ: при беременности — исключить глубокий массаж живота и висцеральную работу, мягкий режим, рекомендовать консультацию; недавние операции/травмы — осторожно, по зоне только после согласования с врачом.

Верни СТРОГО JSON без пояснений и без markdown:
{"serviceId":"<id из списка>","title":"короткий заголовок рекомендации","techniques":["техника 1","техника 2","техника 3"],"summary":"2-3 предложения, почему подходит","note":"короткая заметка для комментария к записи (зоны/акцент)","caution":"предостережение по безопасности или пустая строка"}`;
      const userMsg = `Ответы клиента:\n- Что беспокоит: ${a.goal}\n- Зона: ${a.area}\n- Глубина воздействия: ${a.pressure}\n- Особые условия: ${a.condition}\n- Дополнительно: ${a.extra || "—"}`;
      const reply = await callAnthropic(system, [{ role: "user", content: userMsg }], 700);
      if (reply) {
        const m = reply.match(/\{[\s\S]*\}/);
        if (m) { try { result = JSON.parse(m[0]); } catch { /* fallback ниже */ } }
      }
    }

    if (!result || !allowed.includes(result.serviceId)) {
      result = sessionMatchFallback(a, services);
    } else {
      result.techniques = Array.isArray(result.techniques) ? result.techniques.slice(0, 6).map((t) => String(t).slice(0, 120)) : [];
      result.title = String(result.title || "").slice(0, 120);
      result.summary = String(result.summary || "").slice(0, 600);
      result.note = String(result.note || "").slice(0, 200);
      result.caution = String(result.caution || "").slice(0, 300);
    }
    const svc = services.find((s) => s.id === result.serviceId) || null;
    result.serviceName = svc ? svc.name : "";
    result.aiPowered = Boolean(ANTHROPIC_API_KEY);
    sendJson(response, 200, { match: result });
    return;
  }

  // POST /api/tg-auth — авто-вход в Mini App по подписанным данным Telegram
  if (request.method === "POST" && urlObject.pathname === "/api/tg-auth") {
    const payload = await parseJsonBody(request);
    const tgUser = verifyTelegramInitData(payload.initData || "");
    if (!tgUser || !tgUser.id) {
      sendJson(response, 401, { message: "Недействительные данные Telegram." });
      return;
    }
    const tokens = await readJson("portal-tokens.json").catch(() => []);
    const entry = tokens.find((t) => String(t.telegramChatId) === String(tgUser.id));
    if (!entry) {
      sendJson(response, 404, { linked: false });
      return;
    }
    sendJson(response, 200, { linked: true, token: entry.token });
    return;
  }

  // POST /api/client-login — вход клиента по номеру телефона (без пароля)
  if (request.method === "POST" && urlObject.pathname === "/api/client-login") {
    assertRateLimit({
      scope: "client-login",
      key: getRequestIp(request),
      windowMs: 10 * 60 * 1000,
      limit: 20,
      message: "Слишком много попыток входа. Попробуйте через несколько минут."
    });
    const payload = await parseJsonBody(request);
    const phoneDigits = normalizePhoneDigits(payload.phone || "");
    if (phoneDigits.length < 8) {
      sendJson(response, 400, { message: "Введите полный номер телефона." });
      return;
    }
    // Сравниваем по последним 8 цифрам — устойчиво к коду страны (+373 / 0…).
    const tail = phoneDigits.slice(-8);
    const { bookings, clients } = await loadStudioData();
    const allClients = buildAdminClients(bookings, clients);
    const matches = allClients.filter((c) => {
      const cd = normalizePhoneDigits(c.phone || "");
      return cd && cd.slice(-8) === tail;
    });
    if (matches.length === 0) {
      sendJson(response, 404, { message: "Записей с таким номером не найдено. Проверьте номер или запишитесь впервые." });
      return;
    }
    if (matches.length > 1) {
      sendJson(response, 409, { message: "Найдено несколько записей с этим номером. Свяжитесь со студией для доступа." });
      return;
    }
    const client = matches[0];
    const tgUser = payload.initData ? verifyTelegramInitData(payload.initData) : null;
    const tokens = await readJson("portal-tokens.json").catch(() => []);
    let entry = tokens.find((t) => t.clientId === client.id);
    let dirty = false;
    if (!entry) {
      entry = {
        token: crypto.randomBytes(24).toString("hex"),
        clientId: client.id,
        clientName: client.clientName,
        phone: client.phone || "",
        createdAt: new Date().toISOString()
      };
      tokens.push(entry);
      dirty = true;
    }
    // Если вход из Mini App — привязываем Telegram, чтобы дальше было без логина + напоминания
    if (tgUser && tgUser.id && String(entry.telegramChatId) !== String(tgUser.id)) {
      entry.telegramChatId = tgUser.id;
      entry.telegramLinkedAt = new Date().toISOString();
      dirty = true;
    }
    if (dirty) await writeJson("portal-tokens.json", tokens);
    sendJson(response, 200, { ok: true, token: entry.token });
    return;
  }

  // GET /api/master/dashboard?token= — кабинет мастера (свои записи + расписание)
  if (request.method === "GET" && urlObject.pathname === "/api/master/dashboard") {
    const token = urlObject.searchParams.get("token") || "";
    if (!token) { sendJson(response, 400, { message: "Токен не указан." }); return; }
    const tokens = await readJson("master-tokens.json").catch(() => []);
    const entry = tokens.find((t) => t.token === token);
    if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
    const { specialists, bookings, schedule, services } = await loadStudioData();
    const specialist = specialists.find((s) => s.id === entry.specialistId);
    if (!specialist) { sendJson(response, 404, { message: "Мастер не найден." }); return; }
    const myServices = (services || [])
      .filter((sv) => specialist.specialties.includes(sv.id))
      .map((sv) => ({ id: sv.id, name: sv.name, duration: sv.duration, price: sv.price }));

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
    const mapB = (b) => ({
      id: b.id, date: b.date, slot: b.slot, endsAt: b.endsAt,
      serviceId: b.serviceId || "", serviceName: b.serviceName, clientName: b.clientName,
      phone: b.phone || "", status: b.status, notes: b.notes || b.clientNotes || ""
    });
    const mine = bookings
      .filter((b) => b.specialistId === specialist.id)
      .sort((a, b) => `${a.date}T${a.slot}`.localeCompare(`${b.date}T${b.slot}`));
    const upcoming = mine.filter((b) => b.date >= today && b.status !== "cancelled" && b.status !== "completed").map(mapB);
    const past = mine.filter((b) => b.date < today || b.status === "completed").reverse().slice(0, 20).map(mapB);
    const todayCount = mine.filter((b) => b.date === today && b.status !== "cancelled").length;
    const blocks = (schedule?.blocks || [])
      .filter((bl) => bl.specialistId === specialist.id && bl.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((bl) => ({ date: bl.date, start: bl.start, end: bl.end, reason: bl.reason || "" }));

    const ym = today.slice(0, 7);
    const monthDone = mine.filter((b) => b.status === "completed" && (b.date || "").slice(0, 7) === ym);
    const monthRevenue = monthDone.reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0);
    const botUsername = await getBotUsername();
    const telegramConnectUrl = botUsername ? `https://t.me/${botUsername}?start=m_${entry.token}` : null;

    sendJson(response, 200, {
      telegramLinked: !!entry.telegramChatId,
      telegramConnectUrl,
      specialist: {
        id: specialist.id, name: specialist.name, role: specialist.role, initials: specialist.initials,
        roleRo: specialist.roleRo || "", bio: specialist.bio || "", bioRo: specialist.bioRo || "",
        photo: specialist.photo || null, certified: !!specialist.certified,
        location: specialist.location || "", daySchedules: specialist.daySchedules,
        services: myServices, commissionPercent: specialist.commissionPercent || 0
      },
      stats: {
        upcomingCount: upcoming.length,
        todayCount,
        completedTotal: mine.filter((b) => b.status === "completed").length,
        monthSessions: monthDone.length,
        monthRevenue
      },
      upcoming, past, blocks,
      all: mine.map(mapB),
      masterNotes: (await readJson("master-notes.json").catch(() => []))
        .filter((n) => n.specialistId === specialist.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    });
    return;
  }

  // POST /api/master/notes — мастер добавляет заметку по клиенту
  if (request.method === "POST" && urlObject.pathname === "/api/master/notes") {
    const payload = await parseJsonBody(request);
    const tokens = await readJson("master-tokens.json").catch(() => []);
    const entry = tokens.find((t) => t.token === sanitizeText(payload.token || ""));
    if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
    const text = sanitizeText(payload.text || "");
    if (!text) { sendJson(response, 400, { message: "Пустая заметка." }); return; }
    const notes = await readJson("master-notes.json").catch(() => []);
    const note = { id: crypto.randomUUID(), specialistId: entry.specialistId, client: sanitizeText(payload.client || ""), text, createdAt: new Date().toISOString() };
    notes.push(note);
    await writeJson("master-notes.json", notes);
    sendJson(response, 201, { ok: true, note });
    return;
  }

  // DELETE /api/master/note?token=&id= — мастер удаляет свою заметку
  if (request.method === "DELETE" && urlObject.pathname === "/api/master/note") {
    const token = urlObject.searchParams.get("token") || "";
    const id = urlObject.searchParams.get("id") || "";
    const tokens = await readJson("master-tokens.json").catch(() => []);
    const entry = tokens.find((t) => t.token === token);
    if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
    const notes = await readJson("master-notes.json").catch(() => []);
    const next = notes.filter((n) => !(n.id === id && n.specialistId === entry.specialistId));
    if (next.length === notes.length) { sendJson(response, 404, { message: "Заметка не найдена." }); return; }
    await writeJson("master-notes.json", next);
    sendJson(response, 200, { ok: true });
    return;
  }

  // POST /api/master/booking — мастер сам заносит запись (клиент позвонил/пришёл)
  if (request.method === "POST" && urlObject.pathname === "/api/master/booking") {
    return withLock("studio", async () => {
      const payload = await parseJsonBody(request);
      const token = sanitizeText(payload.token || "");
      const tokens = await readJson("master-tokens.json").catch(() => []);
      const entry = tokens.find((t) => t.token === token);
      if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
      payload.specialistId = entry.specialistId; // всегда сам мастер, не из формы
      const { services, specialists, bookings, schedule } = await loadStudioData();
      try {
        const { service, specialist, cleanPayload, slot } = validateBookingPayload(
          payload, services, specialists, { defaultStatus: "confirmed", adminMode: true, allowPast: true }
        );
        if (specialist.id !== entry.specialistId) {
          sendJson(response, 403, { message: "Можно создавать записи только на себя." });
          return;
        }
        const safePayload = { ...payload, slot };
        const isPast = safePayload.date < new Date().toISOString().slice(0, 10);
        if (!isPast) {
          const availability = calculateAvailability({ date: safePayload.date, service, specialist, bookings, schedule, adminMode: true });
          if (!availability.slots.some((e) => e.time === slot)) {
            sendJson(response, 409, { message: "Этот слот уже занят. Обновите и выберите другое время." });
            return;
          }
        }
        const booking = createBookingRecord({ payload: safePayload, cleanPayload, service, specialist, meta: { source: "master" } });
        await writeJson("bookings.json", sortBookings([...bookings, booking]));
        void notifyBookingCreated(booking);
        sendJson(response, 201, { ok: true, booking: { id: booking.id, date: booking.date, slot: booking.slot } });
      } catch (e) {
        sendJson(response, 400, { message: e.message || "Проверьте данные записи." });
      }
    });
  }

  // POST /api/master/profile — мастер редактирует своё описание (роль/био, RU+RO)
  if (request.method === "POST" && urlObject.pathname === "/api/master/profile") {
    return withLock("studio", async () => {
      const payload = await parseJsonBody(request);
      const tokens = await readJson("master-tokens.json").catch(() => []);
      const entry = tokens.find((t) => t.token === sanitizeText(payload.token || ""));
      if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
      const list = await readJson("specialists.json").catch(() => []);
      const arr = Array.isArray(list) ? list : [];
      const idx = arr.findIndex((s) => s.id === entry.specialistId);
      if (idx === -1) { sendJson(response, 404, { message: "Мастер не найден." }); return; }
      if (typeof payload.role === "string") arr[idx].role = sanitizeText(payload.role);
      if (typeof payload.roleRo === "string") arr[idx].roleRo = sanitizeText(payload.roleRo);
      if (typeof payload.bio === "string") arr[idx].bio = sanitizeText(payload.bio);
      if (typeof payload.bioRo === "string") arr[idx].bioRo = sanitizeText(payload.bioRo);
      await writeJson("specialists.json", arr);
      sendJson(response, 200, { ok: true });
      return;
    });
  }

  // POST /api/master/reschedule — мастер переносит свой визит
  if (request.method === "POST" && urlObject.pathname === "/api/master/reschedule") {
    return withLock("studio", async () => {
      const payload = await parseJsonBody(request);
      const tokens = await readJson("master-tokens.json").catch(() => []);
      const entry = tokens.find((t) => t.token === sanitizeText(payload.token || ""));
      if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
      const bookingId = sanitizeText(payload.bookingId || "");
      const date = sanitizeText(payload.date || "");
      const slot = sanitizeTimeString(payload.slot || "");
      if (!isValidDateString(date) || !slot) { sendJson(response, 400, { message: "Укажите дату и время." }); return; }
      const { services, specialists, bookings, schedule } = await loadStudioData();
      const idx = bookings.findIndex((b) => b.id === bookingId && b.specialistId === entry.specialistId);
      if (idx === -1) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
      const booking = bookings[idx];
      if (booking.status === "cancelled" || booking.status === "completed") { sendJson(response, 400, { message: "Эту запись нельзя перенести." }); return; }
      const service = services.find((s) => s.id === booking.serviceId);
      const specialist = specialists.find((s) => s.id === entry.specialistId);
      if (!service || !specialist) { sendJson(response, 400, { message: "Услуга или мастер недоступны." }); return; }
      const duration = booking.durationMins || service.duration;
      const availability = calculateAvailability({ date, service: { ...service, duration }, specialist, bookings, schedule, excludeBookingId: booking.id, adminMode: true });
      if (!availability.slots.some((s) => s.time === slot)) { sendJson(response, 409, { message: "Это время занято. Выберите другое." }); return; }
      bookings[idx] = { ...booking, date, slot, endsAt: toTimeString(toMinutes(slot) + duration), updatedAt: new Date().toISOString() };
      await writeJson("bookings.json", sortBookings(bookings));
      sendJson(response, 200, { ok: true, date, slot });
    });
  }

  // POST /api/master/booking-status — мастер закрывает свой визит (завершён/неявка)
  if (request.method === "POST" && urlObject.pathname === "/api/master/booking-status") {
    return withLock("studio", async () => {
      const payload = await parseJsonBody(request);
      const token = sanitizeText(payload.token || "");
      const tokens = await readJson("master-tokens.json").catch(() => []);
      const entry = tokens.find((t) => t.token === token);
      if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
      const bookingId = sanitizeText(payload.bookingId || "");
      const status = ["completed", "cancelled"].includes(payload.status) ? payload.status : "";
      if (!bookingId || !status) { sendJson(response, 400, { message: "Некорректные данные." }); return; }
      const bookings = await readJson("bookings.json");
      const idx = bookings.findIndex((b) => b.id === bookingId && b.specialistId === entry.specialistId);
      if (idx === -1) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
      bookings[idx].status = status;
      bookings[idx].updatedAt = new Date().toISOString();
      await writeJson("bookings.json", sortBookings(bookings));
      if (status === "cancelled") void notifyWaitlistOnCancellation(bookings[idx]);
      sendJson(response, 200, { ok: true });
    });
  }

  // POST /api/master/block — мастер закрывает свой день/период (по токену)
  if (request.method === "POST" && urlObject.pathname === "/api/master/block") {
    return withLock("studio", async () => {
      const payload = await parseJsonBody(request);
      const token = sanitizeText(payload.token || "");
      const tokens = await readJson("master-tokens.json").catch(() => []);
      const entry = tokens.find((t) => t.token === token);
      if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
      const from = sanitizeText(payload.from || "");
      const to = sanitizeText(payload.to || from);
      const reason = sanitizeText(payload.reason || "") || "Выходной";
      if (!isValidDateString(from) || !isValidDateString(to) || from > to) {
        sendJson(response, 400, { message: "Укажите корректный период." });
        return;
      }
      const { specialists, schedule } = await loadStudioData();
      if (!specialists.find((s) => s.id === entry.specialistId)) { sendJson(response, 404, { message: "Мастер не найден." }); return; }
      const dates = [];
      let cur = new Date(from + "T12:00:00");
      const last = new Date(to + "T12:00:00");
      let guard = 0;
      while (cur <= last && guard < 366) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); guard++; }
      const newBlocks = [...schedule.blocks];
      for (const date of dates) {
        const exists = newBlocks.some((b) => b.specialistId === entry.specialistId && b.date === date && b.start === "00:00");
        if (!exists) newBlocks.push({ id: crypto.randomUUID(), specialistId: entry.specialistId, date, start: "00:00", end: "23:59", reason });
      }
      await writeJson("schedule.json", normalizeScheduleData({ blocks: newBlocks }, specialists));
      sendJson(response, 200, { ok: true, closed: dates.length });
    });
  }

  // DELETE /api/master/block?token=&date= — мастер снова открывает свой день
  if (request.method === "DELETE" && urlObject.pathname === "/api/master/block") {
    return withLock("studio", async () => {
      const token = urlObject.searchParams.get("token") || "";
      const date = urlObject.searchParams.get("date") || "";
      const tokens = await readJson("master-tokens.json").catch(() => []);
      const entry = tokens.find((t) => t.token === token);
      if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна." }); return; }
      const { specialists, schedule } = await loadStudioData();
      const kept = schedule.blocks.filter((b) => !(b.specialistId === entry.specialistId && b.date === date));
      if (kept.length === schedule.blocks.length) { sendJson(response, 404, { message: "Закрытие не найдено." }); return; }
      await writeJson("schedule.json", normalizeScheduleData({ blocks: kept }, specialists));
      sendJson(response, 200, { ok: true });
    });
  }

  // GET /api/client-portal?token=xxx — public client portal data
  if (request.method === "GET" && urlObject.pathname === "/api/client-portal") {
    const token = urlObject.searchParams.get("token") || "";
    if (!token) { sendJson(response, 400, { message: "Токен не указан." }); return; }
    const tokens = await readJson("portal-tokens.json");
    const entry = tokens.find(t => t.token === token);
    if (!entry) { sendJson(response, 404, { message: "Ссылка недействительна или истекла." }); return; }
    const { bookings, clients } = await loadStudioData();
    const allClients = buildAdminClients(bookings, clients);
    const client = allClients.find(c => c.id === entry.clientId);
    if (!client) { sendJson(response, 404, { message: "Данные клиента не найдены." }); return; }
    const packages = await readJson("packages.json");
    const clientPkgs = packages.filter(p =>
      (entry.phone && p.phone && normalizePhoneDigits(p.phone) === normalizePhoneDigits(entry.phone)) ||
      p.clientName === entry.clientName
    ).filter(p => p.status === "active");
    const now = new Date().toISOString().slice(0, 10);
    const upcoming = client.history.filter(b => b.date >= now && b.status !== "cancelled")
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
    const past = client.history.filter(b => b.date < now || b.status === "completed")
      .sort((a, b) => b.date.localeCompare(a.date) || b.slot.localeCompare(a.slot))
      .slice(0, 15);

    // Реферальный код клиента (get-or-create)
    const referrals = await readJson("referrals.json").catch(() => []);
    let refEntry = referrals.find(r => r.clientId === client.id);
    if (!refEntry) {
      refEntry = {
        code: `REF-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        clientId: client.id,
        clientName: client.clientName,
        phone: client.phone || "",
        createdAt: new Date().toISOString()
      };
      referrals.push(refEntry);
      await writeJson("referrals.json", referrals);
    }

    const botUsername = await getBotUsername();
    const telegramConnectUrl = botUsername ? `https://t.me/${botUsername}?start=${entry.token}` : null;

    sendJson(response, 200, {
      clientName: client.clientName,
      totalVisits: client.completedVisits,
      totalSpent: client.totalSpent,
      favoriteService: client.favoriteServices?.[0]?.name || null,
      favoriteSpecialist: client.favoriteSpecialists?.[0]?.name || null,
      memberSince: client.history.length ? client.history[client.history.length - 1].date : null,
      telegramLinked: !!entry.telegramChatId,
      telegramConnectUrl,
      referralCode: refEntry.code,
      referralLink: `${(SITE_URL || "https://mateevmassage.com").replace(/\/$/, "")}/?ref=${refEntry.code}`,
      upcoming,
      past,
      packages: clientPkgs.map(p => ({
        code: p.code, title: p.title, serviceName: p.serviceName,
        remaining: p.totalSessions - p.usedSessions, total: p.totalSessions,
        expiresAt: p.expiresAt || null
      }))
    });
    return;
  }

  // POST /api/client-reschedule — перенос своей записи по portal-токену
  if (request.method === "POST" && urlObject.pathname === "/api/client-reschedule") {
    return withLock("studio", async () => {
      const payload = await parseJsonBody(request);
      const token = sanitizeText(payload.token);
      const ref = sanitizeText(payload.ref);
      const newDate = sanitizeText(payload.date);
      const newSlot = sanitizeTimeString(payload.slot);
      if (!token || !ref || !newDate || !newSlot) {
        sendJson(response, 400, { message: "Не хватает данных для переноса." });
        return;
      }
      if (!isValidDateString(newDate) || !isFutureOrToday(newDate)) {
        sendJson(response, 400, { message: "Выберите корректную будущую дату." });
        return;
      }
      const tokens = await readJson("portal-tokens.json").catch(() => []);
      const entry = tokens.find((tk) => tk.token === token);
      if (!entry) { sendJson(response, 403, { message: "Сессия истекла. Войдите заново." }); return; }

      const { services, specialists, bookings, schedule, clients } = await loadStudioData();
      const booking = bookings.find((b) => b.reference === ref);
      if (!booking) { sendJson(response, 404, { message: "Запись не найдена." }); return; }

      // Бронь должна принадлежать владельцу токена
      const client = buildAdminClients(bookings, clients).find((c) => c.id === entry.clientId);
      if (!client || !client.history.some((b) => b.reference === ref)) {
        sendJson(response, 403, { message: "Это не ваша запись." });
        return;
      }
      if (booking.status === "cancelled") {
        sendJson(response, 400, { message: "Запись отменена — перенос невозможен." });
        return;
      }

      const service = services.find((s) => s.id === booking.serviceId);
      const specialist = specialists.find((s) => s.id === booking.specialistId);
      if (!service || !specialist) {
        sendJson(response, 400, { message: "Услуга или специалист недоступны." });
        return;
      }

      const duration = booking.durationMins || service.duration;
      const availability = calculateAvailability({
        date: newDate,
        service: { ...service, duration },
        specialist,
        bookings,
        schedule,
        excludeBookingId: booking.id
      });
      if (!availability.slots.some((s) => s.time === newSlot)) {
        sendJson(response, 409, { message: "Это время уже занято. Выберите другое." });
        return;
      }

      const idx = bookings.findIndex((b) => b.id === booking.id);
      bookings[idx] = {
        ...booking,
        date: newDate,
        slot: newSlot,
        endsAt: toTimeString(toMinutes(newSlot) + duration),
        updatedAt: new Date().toISOString()
      };
      await writeJson("bookings.json", sortBookings(bookings));
      sendJson(response, 200, { ok: true, date: newDate, slot: newSlot });
    });
  }

  // GET /api/unsubscribe?email=...
  if (request.method === "GET" && urlObject.pathname === "/api/unsubscribe") {
    const email = sanitizeText(urlObject.searchParams.get("email") || "").toLowerCase();
    if (email) {
      const subs = await readJson("subscribers.json").catch(() => []);
      await writeJson("subscribers.json", subs.filter((s) => s.email !== email));
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Отписка</title></head><body style="font-family:sans-serif;text-align:center;padding:80px 24px;background:#f7f0e6;"><h1 style="color:#1a2e22;">Вы отписаны</h1><p style="color:#7d6d60;">Письма больше не будут приходить.</p><a href="/" style="color:#6b8d6b;">На главную</a></body></html>`);
    return;
  }

  // GET /api/admin/telegram/setup — register webhook (run once)
  if (request.method === "GET" && urlObject.pathname === "/api/admin/telegram/setup") {
    const queryPin = sanitizeEnv(urlObject.searchParams.get("pin") || "");
    const sessionOk = !!getAdminSession(request);
    if (queryPin !== ADMIN_PIN && !sessionOk) {
      sendJson(response, 403, { message: "PIN не подошёл." });
      return;
    }
    const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
    const force = urlObject.searchParams.get("force") === "1";
    // force=1 сбрасывает webhook перед установкой — гарантирует применение allowed_updates
    if (force) {
      await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
        { body: { drop_pending_updates: false } }).catch(() => {});
    }
    const result = await requestJson(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      { body: { url: `${base}/api/telegram/webhook`, allowed_updates: ["callback_query", "message"] } }
    );
    // Кнопка-меню бота открывает Mini App (кабинет внутри Telegram)
    const menu = await requestJson(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`,
      { body: { menu_button: { type: "web_app", text: "Кабинет", web_app: { url: `${base}/client` } } } }
    ).catch(() => null);
    const info = await requestJson(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`,
      { method: "GET" }
    ).catch(() => null);
    sendJson(response, 200, { setWebhook: result, menuButton: menu, info: info?.result || info });
    return;
  }

  // POST /api/telegram/webhook — Telegram bot callback handler
  if (request.method === "POST" && urlObject.pathname === "/api/telegram/webhook") {
    const payload = await parseJsonBody(request);
    const cb = payload?.callback_query;
    if (cb && cb.data) {
      const [action, bookingId] = cb.data.split(":");
      const statusMap = { confirm: "confirmed", complete: "completed", cancel: "cancelled" };
      const labelMap = { confirm: "✅ Подтверждена", complete: "🏁 Завершена", cancel: "❌ Отменена" };
      const newStatus = statusMap[action];
      if (newStatus && bookingId) {
        void (async () => {
          try {
            const bookings = await readJson("bookings.json");
            const idx = bookings.findIndex(b => b.id === bookingId);
            if (idx !== -1 && bookings[idx].status !== newStatus) {
              bookings[idx].status = newStatus;
              bookings[idx].updatedAt = new Date().toISOString();
              await writeJson("bookings.json", bookings);
              const b = bookings[idx];
              const answerText = `${labelMap[action]}\n${b.clientName} · ${b.serviceName}\n${b.date}, ${b.slot}`;
              // Answer callback query (removes loading state in Telegram)
              await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                body: { callback_query_id: cb.id, text: labelMap[action], show_alert: false }
              });
              // Edit original message to remove buttons
              await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                body: {
                  chat_id: cb.message.chat.id,
                  message_id: cb.message.message_id,
                  text: `${cb.message.text}\n\n${labelMap[action]}`,
                  reply_markup: { inline_keyboard: [] }
                }
              });
            } else {
              await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                body: { callback_query_id: cb.id, text: "Уже обновлено", show_alert: false }
              });
            }
          } catch {}
        })();
      }
    }

    // ── Client reminder buttons: cgo (буду) / cno (не смогу) ────────────
    if (cb && cb.data && /^(cgo|cno):/.test(cb.data)) {
      const [caction, cBookingId] = cb.data.split(":");
      void withLock("studio", async () => {
        try {
          const bookings = await readJson("bookings.json");
          const idx = bookings.findIndex((b) => b.id === cBookingId);
          if (idx === -1) { await tgAnswer(cb.id, "Запись не найдена."); return; }
          const b = bookings[idx];
          if (b.status === "cancelled" || b.status === "completed") {
            await tgAnswer(cb.id, "Запись уже обработана.");
            return;
          }
          const base = SITE_URL || "https://mateevmassage.com";
          if (caction === "cgo") {
            bookings[idx].status = "confirmed";
            bookings[idx].updatedAt = new Date().toISOString();
            await writeJson("bookings.json", bookings);
            await tgAnswer(cb.id, "Спасибо, ждём вас! 🌿");
            await tgEdit(cb.message.chat.id, cb.message.message_id, `${cb.message.text}\n\n✅ Вы подтвердили — ждём вас!`);
            await tgSend(TELEGRAM_CHAT_ID, `✅ ${b.clientName} подтвердил визит ${b.date}, ${b.slot} (${b.serviceName}).`);
          } else {
            bookings[idx].status = "cancelled";
            bookings[idx].updatedAt = new Date().toISOString();
            await writeJson("bookings.json", bookings);
            await tgAnswer(cb.id, "Запись отменена, слот освобождён.");
            await tgEdit(cb.message.chat.id, cb.message.message_id, `${cb.message.text}\n\n❌ Запись отменена. Будем рады видеть вас в другой раз!`);
            await tgSend(cb.message.chat.id, "Записаться заново — в пару кликов 👇", {
              reply_markup: { inline_keyboard: [[{ text: "📅 Записаться заново", url: `${base}/#booking` }]] }
            });
            await tgSend(TELEGRAM_CHAT_ID, `❌ ${b.clientName} отменил визит ${b.date}, ${b.slot} (${b.serviceName}) — слот свободен.`);
          }
        } catch {}
      });
    }

    // ── Client linking: /start <portalToken> and /stop ──────────────────
    const msg = payload?.message;
    const msgText = typeof msg?.text === "string" ? msg.text.trim() : "";
    const msgChatId = msg?.chat?.id;
    if (msgChatId && msgText.startsWith("/start")) {
      const startToken = msgText.split(/\s+/)[1] || "";
      void (async () => {
        if (!startToken) {
          await tgSend(msgChatId, "🌿 Здравствуйте! Это бот Mateev Spa Studio.\n\nЧтобы получать напоминания о визитах, откройте личный кабинет на сайте и нажмите «🔔 Напоминания в Telegram».");
          return;
        }
        // Мастер: привязка Telegram для уведомлений о новых записях (токен с префиксом m_)
        if (startToken.startsWith("m_")) {
          try {
            const mTokens = await readJson("master-tokens.json").catch(() => []);
            const mEntry = mTokens.find((t) => t.token === startToken.slice(2));
            if (!mEntry) { await tgSend(msgChatId, "Ссылка устарела. Откройте кабинет и нажмите «Уведомления в Telegram» ещё раз."); return; }
            mEntry.telegramChatId = msgChatId;
            mEntry.telegramLinkedAt = new Date().toISOString();
            await writeJson("master-tokens.json", mTokens);
            await tgSend(msgChatId, "✅ Готово! Буду присылать вам сюда новые записи. Отключить — отправьте /stop.");
          } catch {}
          return;
        }
        try {
          const tokens = await readJson("portal-tokens.json").catch(() => []);
          const entry = tokens.find((t) => t.token === startToken);
          if (!entry) {
            await tgSend(msgChatId, "Ссылка устарела. Откройте кабинет на сайте и нажмите «Напоминания в Telegram» ещё раз.");
            return;
          }
          entry.telegramChatId = msgChatId;
          entry.telegramLinkedAt = new Date().toISOString();
          await writeJson("portal-tokens.json", tokens);
          await tgSend(msgChatId, `✅ Готово, ${entry.clientName || "дорогой гость"}! Буду напоминать о ваших визитах здесь. Чтобы отключить — отправьте /stop.`);
        } catch {}
      })();
    } else if (msgChatId && msgText === "/stop") {
      void (async () => {
        try {
          const tokens = await readJson("portal-tokens.json").catch(() => []);
          let changed = false;
          for (const t of tokens) {
            if (t.telegramChatId === msgChatId) { delete t.telegramChatId; delete t.telegramLinkedAt; changed = true; }
          }
          if (changed) await writeJson("portal-tokens.json", tokens);
          const mTokens = await readJson("master-tokens.json").catch(() => []);
          let mChanged = false;
          for (const t of mTokens) {
            if (t.telegramChatId === msgChatId) { delete t.telegramChatId; delete t.telegramLinkedAt; mChanged = true; }
          }
          if (mChanged) await writeJson("master-tokens.json", mTokens);
          await tgSend(msgChatId, "Уведомления в Telegram отключены. Включить снова можно в кабинете.");
        } catch {}
      })();
    } else if (msgChatId && msgText && !msgText.startsWith("/") && ANTHROPIC_API_KEY) {
      // Свободный текст → AI-ресепшн (агент записи) отвечает прямо в чате, с памятью диалога
      void (async () => {
        try {
          await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`,
            { body: { chat_id: msgChatId, action: "typing" } }).catch(() => {});
          const history = await getTgSession(msgChatId);
          history.push({ role: "user", content: msgText.slice(0, 1000) });
          while (history.length && history[0].role !== "user") history.shift();
          const result = await runReceptionAgent(history);
          const reply = result && result.reply;
          if (reply) {
            history.push({ role: "assistant", content: reply });
            await saveTgSession(msgChatId, history);
          }
          await tgSend(msgChatId, reply || "Извините, сейчас не могу ответить. Напишите чуть позже или позвоните нам 🌿");
          if (result && result.booking) await sendClientBookingConfirmation(result.booking, msgChatId);
        } catch {}
      })();
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  // POST /api/intake — public patient intake form submission
  if (request.method === "POST" && urlObject.pathname === "/api/intake") {
    const payload = await parseJsonBody(request);
    const name = sanitizeText(payload.name || "");
    if (!name) { sendJson(response, 400, { message: "Укажите имя." }); return; }
    const entry = {
      id: `intake-${Date.now()}`,
      ...payload,
      submittedAt: new Date().toISOString(),
      linked: false
    };
    const intakes = await readJson("intakes.json").catch(() => []);
    intakes.push(entry);
    await writeJson("intakes.json", intakes);
    void (async () => {
      try {
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          const goals = (payload.goals || []).join(", ") || "—";
          const text = `📋 Новая карта пациента\n\n👤 ${name}\n📞 ${payload.phone || "—"}\n🎯 ${goals}\n💬 ${payload.complaint || "—"}`;
          await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            body: { chat_id: TELEGRAM_CHAT_ID, text }
          });
        }
      } catch {}
    })();
    sendJson(response, 200, { ok: true });
    return;
  }

  // POST /api/subscribe — diary newsletter
  if (request.method === "POST" && urlObject.pathname === "/api/subscribe") {
    const payload = await parseJsonBody(request);
    const email = sanitizeText(payload.email || "").toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(response, 400, { message: "Укажите корректный email." });
      return;
    }
    const subs = await readJson("subscribers.json").catch(() => []);
    if (subs.some((s) => s.email === email)) {
      sendJson(response, 200, { message: "Вы уже подписаны." });
      return;
    }
    subs.push({ email, subscribedAt: new Date().toISOString() });
    await writeJson("subscribers.json", subs);
    sendJson(response, 200, { message: "Спасибо! Новые записи будут приходить на вашу почту." });
    return;
  }

  // GET /api/diary — public published entries (not future-dated)
  if (request.method === "GET" && urlObject.pathname === "/api/diary") {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
    const raw = await readJson("diary.json").catch(() => []);
    const entries = normalizeDiary(raw)
      .filter((e) => e.published && e.publishedAt <= today)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    sendJson(response, 200, { entries });
    return;
  }

  // PATCH /api/admin/bookings/:id/recommendations — save & email home recommendations
  if (request.method === "PATCH" && urlObject.pathname.match(/^\/api\/admin\/bookings\/[^/]+\/recommendations$/)) {
    assertAdminPin(request);
    const bookingId = urlObject.pathname.split("/")[4];
    const payload = await parseJsonBody(request);
    const bookings = await readJson("bookings.json");
    const idx = bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
    const rec = sanitizeText(payload.recommendations || "");
    bookings[idx].homeRecommendations = rec;
    await writeJson("bookings.json", bookings);
    // Send email if client has email
    const booking = bookings[idx];
    if (rec && RESEND_API_KEY && EMAIL_FROM && booking.email) {
      const ink = "#241c17"; const muted = "#7d6d60"; const bg = "#f7f0e6"; const green = "#1a2e22";
      const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">
<tr><td style="background:${green};padding:24px 36px;"><p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.5);">После сеанса</p>
<p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#fff;">Mateev Spa Studio</p></td></tr>
<tr><td style="padding:28px 36px;">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${ink};">Рекомендации после сеанса</h1>
<p style="margin:0 0 20px;font-size:14px;color:${muted};">${escapeHtml(booking.serviceName)} · ${escapeHtml(booking.date)}</p>
<div style="background:#f0f7f0;border-left:3px solid #6b8d6b;border-radius:0 8px 8px 0;padding:16px 20px;font-size:14px;color:${ink};line-height:1.7;white-space:pre-wrap;">${escapeHtml(rec)}</div>
</td></tr>
<tr><td style="padding:16px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);">
<p style="margin:0;font-size:12px;color:${muted};">До встречи! — Денис Матиевич, Mateev Spa Studio</p>
</td></tr></table></td></tr></table></body></html>`;
      void requestJson("https://api.resend.com/emails", {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        body: { from: EMAIL_FROM, to: [booking.email], replyTo: EMAIL_REPLY_TO || undefined,
          subject: `Рекомендации после сеанса — ${booking.serviceName}`, html }
      }).catch(() => {});
    }
    sendJson(response, 200, { ok: true, emailed: !!(rec && booking.email) });
    return;
  }

  // PATCH /api/admin/bookings/:id/session-notes
  if (request.method === "PATCH" && urlObject.pathname.match(/^\/api\/admin\/bookings\/[^/]+\/session-notes$/)) {
    assertAdminPin(request);
    const bookingId = urlObject.pathname.split("/")[4];
    const payload = await parseJsonBody(request);
    const bookings = await readJson("bookings.json");
    const idx = bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
    bookings[idx].sessionNotes = sanitizeText(payload.sessionNotes || "");
    await writeJson("bookings.json", bookings);
    sendJson(response, 200, { ok: true });
    return;
  }

  // GET /api/admin/intakes
  if (request.method === "GET" && urlObject.pathname === "/api/admin/intakes") {
    assertAdminPin(request);
    const intakes = await readJson("intakes.json").catch(() => []);
    sendJson(response, 200, { intakes: intakes.sort((a,b) => b.submittedAt.localeCompare(a.submittedAt)) });
    return;
  }

  // GET /api/admin/diary — all entries
  if (request.method === "GET" && urlObject.pathname === "/api/admin/diary") {
    assertAdminPin(request);
    const raw = await readJson("diary.json").catch(() => []);
    const entries = normalizeDiary(raw).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    sendJson(response, 200, { entries });
    return;
  }

  // POST /api/admin/diary/upload — upload image for blog post
  if (request.method === "POST" && urlObject.pathname === "/api/admin/diary/upload") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request, 8 * 1024 * 1024);
    const dataUrl = typeof payload.image === "string" ? payload.image : "";
    const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/);
    if (!match) { sendJson(response, 400, { message: "Некорректный формат изображения." }); return; }
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 6 * 1024 * 1024) { sendJson(response, 400, { message: "Файл слишком большой (макс. 6 МБ)." }); return; }
    await fs.mkdir(BLOG_UPLOADS_DIR, { recursive: true });
    const filename = `blog-${Date.now()}.${ext}`;
    await fs.writeFile(path.join(BLOG_UPLOADS_DIR, filename), buffer);
    sendJson(response, 200, { url: `/uploads/blog/${filename}` });
    return;
  }

  // POST /api/admin/diary — create entry
  if (request.method === "POST" && urlObject.pathname === "/api/admin/diary") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const entries = normalizeDiary(await readJson("diary.json").catch(() => []));
    const now = new Date().toISOString().slice(0, 7).replace("-", "");
    const usedIds = new Set(entries.map((e) => e.id));
    let seq = entries.length + 1;
    let newId = `diary-${now}-${String(seq).padStart(3, "0")}`;
    while (usedIds.has(newId)) { seq++; newId = `diary-${now}-${String(seq).padStart(3, "0")}`; }
    const entry = normalizeDiaryEntry({ ...payload, id: newId }, 0);
    await writeJson("diary.json", [entry, ...entries]);
    if (entry.published) void notifyDiarySubscribers(entry);
    sendJson(response, 201, { entry });
    return;
  }

  // PATCH /api/admin/diary/:id — update entry
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/diary/")) {
    assertAdminPin(request);
    const entryId = urlObject.pathname.replace("/api/admin/diary/", "");
    const payload = await parseJsonBody(request);
    const entries = normalizeDiary(await readJson("diary.json").catch(() => []));
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
    entries[idx] = normalizeDiaryEntry({ ...entries[idx], ...payload, id: entryId }, idx);
    await writeJson("diary.json", entries);
    sendJson(response, 200, { entry: entries[idx] });
    return;
  }

  // POST /api/admin/diary/:id/translate — auto-translate to RO via DeepL
  if (
    request.method === "POST" &&
    urlObject.pathname.startsWith("/api/admin/diary/") &&
    urlObject.pathname.endsWith("/translate")
  ) {
    assertAdminPin(request);
    const DEEPL_KEY = sanitizeEnv(process.env.DEEPL_API_KEY);
    if (!DEEPL_KEY) {
      sendJson(response, 503, { message: "DEEPL_API_KEY не задан в .env" });
      return;
    }
    const entryId = urlObject.pathname.replace("/api/admin/diary/", "").replace("/translate", "");
    const entries = normalizeDiary(await readJson("diary.json").catch(() => []));
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
    const entry = entries[idx];

    async function deepl(text) {
      // requestJson does JSON.stringify(body) internally — pass object, not string
      const resp = await requestJson("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}` },
        body: { text: [text], source_lang: "RU", target_lang: "RO" }
      });
      return resp?.translations?.[0]?.text || "";
    }

    const [titleRo, bodyRo] = await Promise.all([deepl(entry.title), deepl(entry.body)]);
    entries[idx] = normalizeDiaryEntry({ ...entry, titleRo, bodyRo }, idx);
    await writeJson("diary.json", entries);
    sendJson(response, 200, { titleRo, bodyRo });
    return;
  }

  // DELETE /api/admin/diary/:id — delete entry
  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/diary/")) {
    assertAdminPin(request);
    const entryId = urlObject.pathname.replace("/api/admin/diary/", "");
    const entries = normalizeDiary(await readJson("diary.json").catch(() => []));
    const next = entries.filter((e) => e.id !== entryId);
    if (next.length === entries.length) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
    await writeJson("diary.json", next);
    sendJson(response, 200, { message: "Запись удалена." });
    return;
  }

  // GET /api/admin/analytics — GA4 report (requires admin session)
  if (request.method === "GET" && urlObject.pathname === "/api/admin/analytics") {
    if (!getAdminSession(request)) { sendJson(response, 401, { message: "Not authorized." }); return; }
    try {
      const report = await getGA4Report();
      const totals = report.totals?.[0]?.metricValues || [];
      const rows = (report.rows || []).map(r => ({
        page: r.dimensionValues[0].value,
        views: r.metricValues[2].value
      }));
      sendJson(response, 200, {
        users: totals[0]?.value || "0",
        sessions: totals[1]?.value || "0",
        pageviews: totals[2]?.value || "0",
        topPages: rows
      });
    } catch(err) {
      sendJson(response, 500, { message: err.message });
    }
    return;
  }

  // POST /api/github/webhook — auto-deploy on push to main
  if (request.method === "POST" && urlObject.pathname === "/api/github/webhook") {
    if (!GITHUB_WEBHOOK_SECRET) {
      sendJson(response, 503, { message: "Webhook not configured." });
      return;
    }
    const raw = await new Promise((resolve, reject) => {
      const chunks = [];
      request.on("data", c => chunks.push(c));
      request.on("end", () => resolve(Buffer.concat(chunks)));
      request.on("error", reject);
    });
    const sig = request.headers["x-hub-signature-256"] || "";
    const expected = "sha256=" + crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET).update(raw).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      sendJson(response, 401, { message: "Bad signature." });
      return;
    }
    const event = request.headers["x-github-event"];
    if (event !== "push") { sendJson(response, 200, { message: "Ignored." }); return; }
    let payload;
    try { payload = JSON.parse(raw.toString()); } catch { sendJson(response, 400, { message: "Bad JSON." }); return; }
    if (payload.ref !== "refs/heads/main") { sendJson(response, 200, { message: "Not main branch." }); return; }
    sendJson(response, 200, { message: "Deploy started." });
    // force-sync к origin: сервер — чистая цель деплоя, локальных коммитов нет,
    // поэтому reset --hard надёжнее git pull (никогда не расходится с origin).
    exec("git fetch origin && git reset --hard origin/main && pm2 restart all", { cwd: ROOT_DIR }, (err, stdout, stderr) => {
      if (err) process.stderr.write(`[webhook] deploy error: ${err.message}\n`);
      else process.stdout.write(`[webhook] deployed: ${stdout.trim()}\n`);
    });
    return;
  }

  sendJson(response, 404, {
    message: "API route not found."
  });
}

// ─── GA4 Analytics ───────────────────────────────────────────────────────────
let _ga4 = { token: null, tokenExp: 0, report: null, reportTime: 0 };

async function getGA4Token() {
  const saPath = process.env.GA_SERVICE_ACCOUNT_FILE;
  if (!saPath) throw new Error("GA_SERVICE_ACCOUNT_FILE not configured");
  const now = Math.floor(Date.now() / 1000);
  if (_ga4.token && _ga4.tokenExp > now + 60) return _ga4.token;
  const sa = JSON.parse(await fs.readFile(saPath, "utf8"));
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now
  })).toString("base64url");
  const signing = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signing);
  const jwt = `${signing}.${sign.sign(sa.private_key, "base64url")}`;
  const form = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const data = await new Promise((resolve, reject) => {
    const req = https.request({ hostname: "oauth2.googleapis.com", path: "/token", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(form) }
    }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
    });
    req.on("error", reject);
    req.write(form);
    req.end();
  });
  if (!data.access_token) throw new Error(data.error_description || "GA4 token error");
  _ga4.token = data.access_token;
  _ga4.tokenExp = now + 3500;
  return _ga4.token;
}

async function getGA4Report() {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId) throw new Error("GA_PROPERTY_ID not configured");
  const now = Date.now();
  if (_ga4.report && now - _ga4.reportTime < 10 * 60 * 1000) return _ga4.report;
  const token = await getGA4Token();
  const data = await requestJson(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
        dimensions: [{ name: "pagePath" }],
        metricAggregations: ["TOTAL"],
        limit: 5,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }]
      }
    }
  );
  _ga4.report = data;
  _ga4.reportTime = now;
  return data;
}

async function notifyDiarySubscribers(entry) {
  if (!RESEND_API_KEY || !EMAIL_FROM) return;
  try {
    const subs = await readJson("subscribers.json").catch(() => []);
    if (!subs.length) return;
    const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
    const url = `${base}/blog/${entry.id}`;
    const excerpt = entry.body.replace(/\n/g, " ").slice(0, 200).trim();
    const ink = "#241c17"; const muted = "#7d6d60"; const bg = "#f7f0e6"; const green = "#1a2e22";
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${ink};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#fffaf4;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(54,35,20,0.10);">
<tr><td style="background:${green};padding:24px 36px;">
<p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.5);">Дневник практики</p>
<p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#fff;">Mateev Spa Studio</p></td></tr>
<tr><td style="padding:32px 36px 24px;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${muted};">Новая запись</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${ink};line-height:1.3;">${escapeHtml(entry.title)}</h1>
<p style="margin:0 0 24px;font-size:14px;color:${muted};line-height:1.7;">${escapeHtml(excerpt)}...</p>
<a href="${url}" style="display:inline-block;padding:12px 28px;background:#b36d2c;color:#fff;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">Читать полностью →</a>
</td></tr>
<tr><td style="padding:16px 36px;border-top:1px solid rgba(68,50,36,0.10);background:rgba(179,109,44,0.04);">
<p style="margin:0;font-size:11px;color:${muted};">Вы получили это письмо потому что подписались на дневник. <a href="${base}/unsubscribe?email={{email}}" style="color:${muted};">Отписаться</a></p>
</td></tr></table></td></tr></table></body></html>`;

    for (const sub of subs) {
      try {
        await requestJson("https://api.resend.com/emails", {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          body: {
            from: EMAIL_FROM,
            to: [sub.email],
            replyTo: EMAIL_REPLY_TO || undefined,
            subject: `Новая запись: ${entry.title}`,
            html: html.replace("{{email}}", encodeURIComponent(sub.email))
          }
        });
      } catch {}
    }
  } catch {}
}

function calcReadTime(body = "") {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(t => sanitizeText(t)).filter(Boolean);
  return String(raw).split(",").map(t => sanitizeText(t.trim())).filter(Boolean);
}

function normalizeDiaryEntry(entry, index) {
  const id = sanitizeText(entry?.id) || `diary-${Date.now()}-${index}`;
  const titleRo = sanitizeText(entry?.titleRo);
  const bodyRo = sanitizeText(entry?.bodyRo);
  const body = sanitizeText(entry?.body) || "";
  const coverImage = sanitizeText(entry?.coverImage);
  const category = sanitizeText(entry?.category) || "";
  const tags = normalizeTags(entry?.tags);
  return {
    id,
    title: sanitizeText(entry?.title) || "",
    body,
    publishedAt: sanitizeText(entry?.publishedAt) || new Date().toISOString().slice(0, 10),
    published: entry?.published !== false,
    category,
    tags,
    readTime: calcReadTime(body),
    ...(coverImage && { coverImage }),
    ...(titleRo && { titleRo }),
    ...(bodyRo && { bodyRo })
  };
}

function normalizeDiary(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(normalizeDiaryEntry).filter((e) => e.title);
}

function renderConfirmSuccessPage(booking, alreadyConfirmed) {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const ru = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const dateLabel = ru.format(new Date(`${booking.date}T12:00:00`)).replace(" г.", "");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${alreadyConfirmed ? "Запись уже подтверждена" : "Спасибо за подтверждение"} — Mateev Spa Studio</title>
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center}
    .icon{font-size:4rem;margin-bottom:20px}
    .title{font-family:'Cormorant Garamond',serif;font-size:clamp(1.8rem,5vw,2.6rem);font-weight:600;color:#1a2e22;margin-bottom:12px}
    .sub{color:#7d6d60;font-size:0.95rem;margin-bottom:32px;max-width:440px;line-height:1.7}
    .card{background:rgba(255,255,255,0.7);border:1px solid rgba(71,49,28,0.1);border-radius:20px;padding:24px 28px;margin-bottom:32px;text-align:left;max-width:400px;width:100%}
    .card-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(71,49,28,0.08);font-size:0.88rem}
    .card-row:last-child{border-bottom:none}
    .card-row span:first-child{color:#7d6d60}
    .card-row span:last-child{font-weight:600;color:#1a2e22}
    .btn{display:inline-block;padding:14px 32px;background:#b36d2c;color:#fff;border-radius:12px;font-weight:700;font-size:0.95rem;text-decoration:none}
  </style>
</head>
<body>
  <div class="icon">${alreadyConfirmed ? "✓" : "🎉"}</div>
  <h1 class="title">${alreadyConfirmed ? "Запись уже подтверждена" : "Отлично, ждём вас!"}</h1>
  <p class="sub">${alreadyConfirmed
    ? "Ваша запись уже была подтверждена ранее. До встречи в студии!"
    : `Спасибо, ${escapeHtml(booking.clientName)}! Ваша запись подтверждена — до встречи в студии.`}</p>
  <div class="card">
    <div class="card-row"><span>Процедура</span><span>${escapeHtml(booking.serviceName)}</span></div>
    <div class="card-row"><span>Специалист</span><span>${escapeHtml(booking.specialistName)}</span></div>
    <div class="card-row"><span>Дата</span><span>${escapeHtml(dateLabel)}</span></div>
    <div class="card-row"><span>Время</span><span>${escapeHtml(booking.slot)}–${escapeHtml(booking.endsAt)}</span></div>
  </div>
  <a href="${base}/" class="btn">На главную</a>
</body>
</html>`;
}

function renderFirstVisitPage() {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const sharedFonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">`;

  const steps = [
    {
      num: "01",
      title: "Запись и подтверждение",
      text: "Выберите процедуру и удобное время на сайте. Подтверждение придёт на почту — там будет дата, время и адрес студии."
    },
    {
      num: "02",
      title: "Как подготовиться",
      text: "Ничего особенного не нужно. Приходите в комфортной одежде. За 1-2 часа лучше не есть плотно. Если есть хронические заболевания или недавние травмы — сообщите об этом при записи или при встрече."
    },
    {
      num: "03",
      title: "Начало сеанса",
      text: "В начале я спрошу о вашем самочувствии, зонах напряжения и целях визита. Это займёт 3-5 минут — важно понять запрос чтобы работа была точной и полезной, а не шаблонной."
    },
    {
      num: "04",
      title: "Во время процедуры",
      text: "Вы лежите на массажном столе в тепле, всё необходимое — в студии. Интенсивность давления подбирается по вашим ощущениям — говорите если что-то некомфортно. Работа идёт в тишине или с мягкой фоновой музыкой — как вам лучше."
    },
    {
      num: "05",
      title: "После сеанса",
      text: "После процедуры не торопитесь вставать — дайте телу пару минут. В первые часы рекомендую пить больше воды. Лёгкая усталость или ощущение «прожитых мышц» — это нормально и проходит к следующему дню."
    },
    {
      num: "06",
      title: "Что дальше",
      text: "Скажу честно сколько сеансов нужно именно вам и с каким интервалом. Если разовый визит — дам рекомендации что делать самостоятельно. Никаких лишних визитов — только то что реально нужно."
    }
  ];

  const faq = [
    { q: "Нужно ли что-то брать с собой?", a: "Нет. Всё необходимое — полотенца, одноразовые материалы, масло — в студии." },
    { q: "Можно ли перенести запись?", a: "Да. Сообщите заранее по телефону или в Telegram — подберём новое время." },
    { q: "Как выбрать процедуру если не знаю что нужно?", a: "Выбирайте классический массаж или напишите мне — опишите где болит или что беспокоит, посоветую." },
    { q: "Можно при беременности?", a: "Некоторые техники противопоказаны, особенно в первом триместре. Сообщите о беременности при записи — подберём безопасный формат." }
  ];

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Первый визит в Mateev Spa Studio — что нужно знать</title>
  <meta name="description" content="Как подготовиться к первому сеансу массажа, что взять с собой и что будет происходить. Всё что нужно знать перед визитом в Mateev Spa Studio.">
  <link rel="canonical" href="${base}/first-visit">
  <meta property="og:title" content="Первый визит — Mateev Spa Studio">
  <meta property="og:description" content="Как подготовиться к первому сеансу, что будет происходить и что делать после. Простые ответы на частые вопросы.">
  <meta property="og:url" content="${base}/first-visit">
  <meta property="og:image" content="${base}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  })}</script>
  ${sharedFonts}
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;line-height:1.7}
    a{color:#6b8d6b;text-decoration:none}
    a:hover{text-decoration:underline}
    .topbar{background:rgba(250,242,233,0.95);border-bottom:1px solid rgba(71,49,28,0.08);padding:16px 0;position:sticky;top:0;z-index:10}
    .topbar__inner{max-width:800px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center}
    .topbar__brand{font-weight:700;font-size:0.9rem;color:#241c17}
    .topbar__back{font-size:0.85rem;color:#6b8d6b;font-weight:600}
    .container{max-width:800px;margin:0 auto;padding:0 24px}
    .hero{padding:64px 0 48px}
    .hero__kicker{font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b36d2c;margin-bottom:12px}
    .hero__title{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,5vw,3rem);font-weight:600;color:#1a2e22;margin-bottom:12px;line-height:1.2}
    .hero__sub{color:#7d6d60;font-size:1rem;max-width:580px}
    .steps{padding:48px 0;display:grid;gap:32px}
    .step{display:grid;grid-template-columns:64px 1fr;gap:20px;align-items:start}
    .step__num{font-family:'Cormorant Garamond',serif;font-size:3rem;font-weight:700;color:#b36d2c;opacity:0.6;line-height:1}
    .step__title{font-weight:700;font-size:1.05rem;color:#1a2e22;margin-bottom:6px}
    .step__text{color:#3a2e26;font-size:0.95rem;line-height:1.8}
    .divider{border:none;border-top:1px solid rgba(71,49,28,0.1);margin:0}
    .faq{padding:48px 0}
    .faq__title{font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:600;color:#1a2e22;margin-bottom:28px}
    .faq-item{padding:20px 0;border-bottom:1px solid rgba(71,49,28,0.1)}
    .faq-item:last-child{border-bottom:none}
    .faq-item__q{font-weight:600;color:#1a2e22;margin-bottom:8px}
    .faq-item__a{color:#5a4e45;font-size:0.93rem;line-height:1.75}
    .cta{background:#1a2e22;border-radius:24px;padding:48px;text-align:center;margin-bottom:64px}
    .cta__title{font-family:'Cormorant Garamond',serif;font-size:2rem;color:#fff;margin-bottom:8px}
    .cta__sub{color:rgba(255,255,255,0.6);margin-bottom:28px}
    .cta-btn{display:inline-block;padding:14px 36px;background:#b36d2c;color:#fff;border-radius:12px;font-weight:700;font-size:1rem}
    .cta-btn:hover{background:#9a5c22;text-decoration:none}
    footer{padding:24px 0;border-top:1px solid rgba(71,49,28,0.08);text-align:center;font-size:0.8rem;color:#7d6d60}
    @media(max-width:600px){.step{grid-template-columns:48px 1fr;gap:14px}.step__num{font-size:2.2rem}.cta{padding:32px 20px}}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar__inner">
      <span class="topbar__brand">Mateev Spa Studio</span>
      <a href="/" class="topbar__back">← На главную</a>
    </div>
  </header>
  <main>
    <div class="container">
      <div class="hero">
        <p class="hero__kicker">Первый визит</p>
        <h1 class="hero__title">Что нужно знать перед первым сеансом</h1>
        <p class="hero__sub">Простые ответы на все вопросы — от записи до того что делать после процедуры.</p>
      </div>

      <hr class="divider">

      <div class="steps">
        ${steps.map(s => `
          <div class="step">
            <div class="step__num">${escapeHtml(s.num)}</div>
            <div>
              <div class="step__title">${escapeHtml(s.title)}</div>
              <div class="step__text">${escapeHtml(s.text)}</div>
            </div>
          </div>`).join("")}
      </div>

      <hr class="divider">

      <div class="faq">
        <h2 class="faq__title">Частые вопросы</h2>
        ${faq.map(f => `
          <div class="faq-item">
            <div class="faq-item__q">${escapeHtml(f.q)}</div>
            <div class="faq-item__a">${escapeHtml(f.a)}</div>
          </div>`).join("")}
      </div>

      <div class="cta">
        <div class="cta__title">Готовы записаться?</div>
        <p class="cta__sub">Онлайн-запись без звонков — выберите удобное время прямо сейчас</p>
        <a href="${base}/#booking" class="cta-btn">Выбрать время →</a>
      </div>
    </div>
  </main>
  <footer><p>© ${new Date().getFullYear()} Mateev Spa Studio · Кишинёв</p></footer>
</body>
</html>`;
}

function renderIntakePage() {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const goalsOptions = [
    ["relaxation","Расслабление"],["pain","Боль / напряжение"],
    ["rehab","Реабилитация"],["prevention","Профилактика"],["doctor","Назначение врача"]
  ];
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <meta name="robots" content="noindex">
  <title>Карта пациента — Mateev Spa Studio</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f7f0e6;color:#241c17;padding:20px;max-width:560px;margin:0 auto;}
    .header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1a2e22;}
    .brand{font-size:1.2rem;font-weight:700;color:#1a2e22;}
    .brand-sub{font-size:0.78rem;color:#7d6d60;margin-top:2px;}
    h1{font-size:1rem;font-weight:700;color:#1a2e22;margin:16px 0 4px;}
    p.intro{font-size:0.85rem;color:#7d6d60;line-height:1.6;margin-bottom:20px;}
    .section{margin-bottom:20px;}
    .section-title{font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#b36d2c;margin-bottom:10px;}
    label{display:block;font-size:0.82rem;color:#5a4e45;margin-bottom:4px;font-weight:500;}
    input[type=text],input[type=date],input[type=number],textarea,select{
      width:100%;padding:12px 14px;border:1px solid rgba(71,49,28,0.2);border-radius:10px;
      background:#fffaf4;font-size:0.9rem;font-family:inherit;color:#241c17;margin-bottom:12px;}
    textarea{resize:vertical;min-height:70px;}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
    .checkbox-group{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
    .checkbox-label{display:flex;align-items:center;gap:6px;font-size:0.85rem;padding:8px 12px;
      border:1px solid rgba(71,49,28,0.15);border-radius:8px;background:#fffaf4;cursor:pointer;}
    .checkbox-label input{width:16px;height:16px;}
    .contraindications{background:#fff8f0;border:1px solid #e8c99a;border-radius:10px;padding:14px;font-size:0.78rem;color:#5a4e45;line-height:1.7;margin-bottom:16px;}
    .contraindications strong{color:#b36d2c;}
    .consent-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:20px;}
    .consent-row input{width:20px;height:20px;flex-shrink:0;margin-top:2px;}
    .consent-text{font-size:0.82rem;color:#5a4e45;line-height:1.5;}
    .submit-btn{width:100%;padding:16px;background:#1a2e22;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;}
    .submit-btn:disabled{opacity:0.6;}
    .success{text-align:center;padding:40px 20px;display:none;}
    .success h2{font-size:1.4rem;color:#1a2e22;margin-bottom:8px;}
    .success p{color:#7d6d60;font-size:0.9rem;}
    .success .icon{font-size:3rem;margin-bottom:16px;}
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Mateev Spa Studio</div>
    <div class="brand-sub">Персональная карта пациента</div>
  </div>

  <h1>Добро пожаловать!</h1>
  <p class="intro">Пожалуйста заполните эту форму — это займёт 2–3 минуты и поможет специалисту лучше подготовиться к вашему сеансу.</p>

  <form id="intakeForm">
    <div class="section">
      <div class="section-title">Личные данные</div>
      <label>Имя и фамилия *</label>
      <input type="text" name="name" required placeholder="Анна Иванова">
      <div class="grid2">
        <div><label>Телефон</label><input type="text" name="phone" placeholder="+373..."></div>
        <div><label>Дата рождения</label><input type="date" name="dob"></div>
      </div>
      <label>Профессия / тип работы</label>
      <input type="text" name="profession" placeholder="Программист, парикмахер...">
    </div>

    <div class="section">
      <div class="section-title">Цель визита</div>
      <div class="checkbox-group">
        ${goalsOptions.map(([v,l]) => `<label class="checkbox-label"><input type="checkbox" name="goals" value="${v}"> ${l}</label>`).join("")}
      </div>
      <label>Основная жалоба / что беспокоит</label>
      <textarea name="complaint" placeholder="Боль в шее, скованность по утрам, стресс..."></textarea>
    </div>

    <div class="section">
      <div class="section-title">Здоровье</div>
      <label>Хронические заболевания</label>
      <input type="text" name="chronic" placeholder="Нет / Гипертония / Диабет...">
      <label>Травмы и перенесённые операции</label>
      <input type="text" name="injuries" placeholder="Нет / Перелом 2018...">
      <label>Принимаемые препараты</label>
      <input type="text" name="medications" placeholder="Нет / Конкор...">
      <label>Аллергии (масла, ароматы)</label>
      <input type="text" name="allergies" placeholder="Нет / Лаванда...">
      <label>Когда последний раз были на массаже</label>
      <input type="text" name="last_massage" placeholder="Никогда / 6 месяцев назад...">
    </div>

    <div class="section">
      <div class="section-title">Противопоказания</div>
      <div class="contraindications">
        <strong>Массаж противопоказан при:</strong> онкологии, тромбозе, острых воспалениях, варикозе в зоне работы, инфекционных заболеваниях, повышенной температуре, острой сердечной/почечной недостаточности, психических расстройствах, приёме алкоголя.
      </div>
      <label class="consent-row">
        <input type="checkbox" name="consent" required>
        <span class="consent-text">Я ознакомился(ась) с противопоказаниями и подтверждаю что они ко мне не относятся. Вся указанная информация верна.</span>
      </label>
    </div>

    <button type="submit" class="submit-btn" id="submitBtn">Отправить карту →</button>
  </form>

  <div class="success" id="successBlock">
    <div class="icon">✅</div>
    <h2>Спасибо!</h2>
    <p>Ваша карта заполнена. Специалист уже получил информацию.</p>
    <p style="margin-top:8px;font-size:0.8rem;color:#9a8a7a;">Mateev Spa Studio · Кишинёв</p>
  </div>

  <script>
    document.getElementById("intakeForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true; btn.textContent = "Отправляю...";
      const fd = new FormData(e.target);
      const goals = [...fd.getAll("goals")];
      const data = {
        name: fd.get("name"), phone: fd.get("phone"), dob: fd.get("dob"),
        profession: fd.get("profession"), complaint: fd.get("complaint"),
        chronic: fd.get("chronic"), injuries: fd.get("injuries"),
        medications: fd.get("medications"), allergies: fd.get("allergies"),
        last_massage: fd.get("last_massage"), goals,
        consent: !!fd.get("consent"), filledAt: new Date().toISOString()
      };
      try {
        const r = await fetch("/api/intake", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) });
        if (r.ok) {
          e.target.style.display = "none";
          document.getElementById("successBlock").style.display = "block";
        } else { throw new Error(); }
      } catch {
        btn.disabled = false; btn.textContent = "Отправить карту →";
        alert("Ошибка. Попробуйте ещё раз.");
      }
    });
  </script>
</body>
</html>`;
}

function renderMedicalCardPage(clientName, profile) {
  const mc = profile.medCard || {};
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const goalsMap = { relaxation:"Расслабление", pain:"Боль / напряжение", rehab:"Реабилитация", prevention:"Профилактика", doctor:"Назначение врача" };
  const goalsList = (mc.goals || []).map(g => goalsMap[g] || g).join(", ") || "—";
  const row = (label, value) => `<tr><td style="padding:8px 12px;font-size:0.85rem;color:#7d6d60;width:40%;border-bottom:1px solid #e8ddd4;">${label}</td><td style="padding:8px 12px;font-size:0.9rem;font-weight:600;color:#241c17;border-bottom:1px solid #e8ddd4;">${escapeHtml(String(value || "—"))}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Медкарта — ${escapeHtml(clientName)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#241c17;padding:32px;max-width:800px;margin:0 auto;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #1a2e22;}
    .brand{font-size:1.4rem;font-weight:700;color:#1a2e22;}
    .brand-sub{font-size:0.78rem;color:#7d6d60;margin-top:2px;}
    .doc-title{text-align:right;}
    .doc-title h1{font-size:1rem;font-weight:700;color:#1a2e22;}
    .doc-title p{font-size:0.78rem;color:#7d6d60;margin-top:2px;}
    .client-name{font-size:1.2rem;font-weight:700;color:#1a2e22;margin-bottom:20px;padding:12px 16px;background:#f7f0e6;border-radius:8px;}
    .section{margin-bottom:20px;}
    .section-title{font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#b36d2c;margin-bottom:8px;}
    table{width:100%;border-collapse:collapse;background:#faf6f0;border-radius:8px;overflow:hidden;}
    .vitals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
    .vital-card{background:#f7f0e6;border-radius:8px;padding:12px;text-align:center;}
    .vital-value{font-size:1.6rem;font-weight:700;color:#1a2e22;}
    .vital-label{font-size:0.72rem;color:#7d6d60;margin-top:2px;}
    .contraindications{background:#fff8f0;border:1px solid #e8c99a;border-radius:8px;padding:14px 16px;font-size:0.78rem;color:#5a4e45;line-height:1.6;margin-bottom:20px;}
    .contraindications strong{color:#b36d2c;}
    .signature-block{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px;padding-top:20px;border-top:1px solid #e8ddd4;}
    .sign-line{border-bottom:1px solid #241c17;margin-bottom:6px;height:32px;}
    .sign-label{font-size:0.75rem;color:#7d6d60;}
    .print-btn{display:block;margin:20px auto;padding:12px 32px;background:#1a2e22;color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;}
    @media print{.print-btn{display:none!important;}body{padding:16px;}@page{margin:1cm;}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Mateev Spa Studio</div>
      <div class="brand-sub">Кишинёв · mateevmassage.com</div>
    </div>
    <div class="doc-title">
      <h1>Персональная карта пациента</h1>
      <p>Дата: ${escapeHtml(mc.date || new Date().toISOString().slice(0,10))}</p>
    </div>
  </div>

  <div class="client-name">
    <span style="font-size:0.78rem;font-weight:400;color:#7d6d60;display:block;margin-bottom:2px;">Пациент</span>
    ${escapeHtml(clientName)}
  </div>

  <div class="section">
    <div class="section-title">Показатели на сегодня</div>
    <div class="vitals">
      <div class="vital-card"><div class="vital-value">${escapeHtml(mc.bp_sys && mc.bp_dia ? mc.bp_sys+"/"+mc.bp_dia : "—")}</div><div class="vital-label">АД (мм рт.ст.)</div></div>
      <div class="vital-card"><div class="vital-value">${escapeHtml(String(mc.pulse || "—"))}</div><div class="vital-label">Пульс (уд/мин)</div></div>
      <div class="vital-card"><div class="vital-value">${escapeHtml(String(mc.wellbeing || "—"))}/10</div><div class="vital-label">Самочувствие</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Личные данные и цель визита</div>
    <table>
      ${row("Дата рождения", mc.dob)}
      ${row("Профессия", mc.profession)}
      ${row("Цель визита", goalsList)}
      ${row("Основная жалоба", mc.complaint)}
      ${row("Последний массаж", mc.last_massage)}
    </table>
  </div>

  <div class="section">
    <div class="section-title">Медицинский анамнез</div>
    <table>
      ${row("Хронические заболевания", mc.chronic)}
      ${row("Травмы и операции", mc.injuries)}
      ${row("Принимаемые препараты", mc.medications)}
      ${row("Аллергии", mc.allergies)}
    </table>
  </div>

  <div class="section">
    <div class="section-title">Зоны дискомфорта — отметьте на рисунке</div>
    <p style="font-size:0.78rem;color:#7d6d60;margin-bottom:12px;">Обведите или отметьте зоны где чувствуете боль, напряжение или дискомфорт</p>
      <img src="/body-diagram.jpg" alt="Схема тела для отметки зон дискомфорта"
           style="max-width:100%;width:600px;display:block;margin:0 auto;border-radius:8px;border:1px solid #e8ddd4;">
    </div>
    <p style="font-size:0.72rem;color:#9a8a7a;margin-top:8px;">Обозначения: ● боль &nbsp;&nbsp; ○ напряжение &nbsp;&nbsp; × онемение &nbsp;&nbsp; ↗ отдаёт в...</p>
  </div>

  <div class="section">
    <div class="section-title">Зоны работы (заполняет специалист)</div>
    <table>
      ${row("Зоны фокуса", mc.focus)}
      ${row("Зоны избегать", mc.avoid)}
    </table>
  </div>

  <div class="contraindications">
    <strong>Противопоказания к массажу:</strong> онкология, тромбоз, острые воспаления, варикоз в зоне работы,
    инфекционные заболевания, повышенная температура, острая сердечная/почечная/печеночная недостаточность,
    кожные поражения в зоне работы, психические расстройства, приём алкоголя.
  </div>

  <div class="signature-block">
    <div>
      <div class="sign-line"></div>
      <div class="sign-label">Подпись клиента / Semnătura clientului</div>
    </div>
    <div>
      <div class="sign-line"></div>
      <div class="sign-label">Специалист / Specialist — Матиевич Денис</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #e8ddd4;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(base + '/intake')}&bgcolor=faf6f0&margin=4"
         alt="QR карта пациента" width="100" height="100" style="border-radius:8px;border:1px solid #e8ddd4;">
    <div>
      <p style="font-size:0.8rem;font-weight:700;color:#1a2e22;margin-bottom:4px;">Заполните карту на телефоне</p>
      <p style="font-size:0.75rem;color:#7d6d60;line-height:1.5;">Отсканируйте QR-код камерой телефона<br>и заполните форму самостоятельно.<br><strong style="color:#b36d2c;">${base}/intake</strong></p>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨 Распечатать</button>
</body>
</html>`;
}

function render404Page() {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Страница не найдена — Mateev Spa Studio</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}
    .logo{width:64px;height:64px;object-fit:contain;margin-bottom:24px;opacity:0.6}
    .kicker{font-size:0.72rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#b36d2c;margin-bottom:12px}
    .title{font-family:'Cormorant Garamond',serif;font-size:clamp(1.8rem,5vw,3rem);font-weight:600;color:#1a2e22;line-height:1.15;margin-bottom:14px}
    .sub{color:#7d6d60;font-size:0.92rem;line-height:1.7;margin-bottom:32px;max-width:380px}
    .btn-wrap{display:flex;flex-direction:column;align-items:center;gap:12px}
    .btn-primary{display:inline-block;padding:14px 36px;background:#1a2e22;color:#fff;border-radius:50px;font-weight:700;font-size:0.92rem;text-decoration:none;transition:opacity .2s}
    .btn-primary:hover{opacity:0.85}
    .btn-book{display:inline-block;padding:12px 28px;background:#b36d2c;color:#fff;border-radius:50px;font-weight:600;font-size:0.88rem;text-decoration:none;transition:opacity .2s}
    .btn-book:hover{opacity:0.85}
    .divider{width:40px;height:1px;background:rgba(26,46,34,0.15);margin:28px auto}
    .links{display:flex;gap:20px;flex-wrap:wrap;justify-content:center}
    .link{font-size:0.82rem;color:#6b8d6b;text-decoration:none;font-weight:500}
    .link:hover{text-decoration:underline}
    .num{font-family:'Cormorant Garamond',serif;font-size:6rem;font-weight:700;color:#1a2e22;opacity:0.07;position:fixed;bottom:-10px;right:16px;line-height:1;pointer-events:none;user-select:none}
  </style>
</head>
<body>
  <img class="logo" src="${base}/mateev_logo.png" alt="Mateev Spa Studio">
  <p class="kicker">Ошибка 404</p>
  <h1 class="title">Эта страница<br>не существует</h1>
  <p class="sub">Возможно, ссылка устарела или адрес введён с опечаткой. Но мы здесь — и всегда рады вас принять.</p>
  <div class="btn-wrap">
    <a href="${base}/" class="btn-primary">На главную</a>
    <a href="${base}/#booking" class="btn-book">Записаться на сеанс →</a>
  </div>
  <div class="divider"></div>
  <div class="links">
    <a href="${base}/blog" class="link">Дневник практики</a>
    <a href="${base}/school" class="link">Школа</a>
    <a href="${base}/certificates" class="link">Сертификаты</a>
    <a href="${base}/card" class="link">Визитка</a>
  </div>
  <div class="num">404</div>
</body>
</html>`;
}

function renderSpecialistPage(specialist, services, site, recentPosts = [], lang = "ru") {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const isRo = lang === "ro";
  const t = (ru, ro) => isRo ? (ro || ru) : ru;
  const name = specialist.name || "Специалист";
  const role = t(specialist.role || "Массажист", specialist.roleRo);
  const bio = t(specialist.bio || "", specialist.bioRo);
  const description = bio ? bio.slice(0, 160) : `${name} — специалист Mateev Spa Studio`;
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(((specialist.address || "") + " " + (specialist.location || "")).trim())}`;
  const specialistServices = (specialist.specialties || [])
    .map(id => services.find(s => s.id === id))
    .filter(Boolean);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(name)} — Mateev Spa Studio</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${base}/team/${escapeHtml(specialist.id)}">
  <meta property="og:title" content="${escapeHtml(name)} — Mateev Spa Studio">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${base}/team/${escapeHtml(specialist.id)}">
  ${specialist.photo ? `<meta property="og:image" content="${base}${escapeHtml(specialist.photo)}">` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    "name": name,
    "jobTitle": specialist.role || "Массажист",
    "description": specialist.bio || "",
    "worksFor": { "@type": "HealthAndBeautyBusiness", "name": "Mateev Spa Studio", "url": base },
    "url": `${base}/team/${specialist.id}`,
    ...(specialist.photo ? { "image": `${base}${specialist.photo}` } : {})
  })}</script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Главная", "item": base },
      { "@type": "ListItem", "position": 2, "name": "Специалисты", "item": `${base}/#specialists` },
      { "@type": "ListItem", "position": 3, "name": name, "item": `${base}/team/${specialist.id}` }
    ]
  })}</script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;line-height:1.7}
    a{color:#6b8d6b;text-decoration:none}
    a:hover{text-decoration:underline}
    .topbar{background:rgba(250,242,233,0.95);border-bottom:1px solid rgba(71,49,28,0.08);padding:16px 0;position:sticky;top:0;z-index:10}
    .topbar__inner{max-width:960px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center}
    .topbar__brand{font-weight:700;font-size:0.9rem;color:#241c17}
    .topbar__back{font-size:0.85rem;color:#6b8d6b;font-weight:600}
    .container{max-width:960px;margin:0 auto;padding:0 24px}

    /* Hero */
    .hero{background:linear-gradient(135deg,#1a2e22,#243b2e);padding:72px 0;color:#fff}
    .hero__inner{display:grid;grid-template-columns:260px 1fr;gap:56px;align-items:center}
    .hero__photo{width:100%;border-radius:20px;object-fit:cover;aspect-ratio:3/4;border:3px solid rgba(255,255,255,0.12)}
    .hero__placeholder{width:100%;aspect-ratio:3/4;border-radius:20px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:5rem;font-weight:700;color:rgba(255,255,255,0.15)}
    .hero__kicker{font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(179,109,44,0.9);margin-bottom:12px}
    .hero__name{font-family:'Cormorant Garamond',serif;font-size:clamp(2.2rem,4vw,3.4rem);font-weight:600;color:#fff;margin-bottom:8px;line-height:1.1}
    .hero__role{color:rgba(255,255,255,0.6);font-size:0.95rem;margin-bottom:32px}
    .stats{display:flex;gap:32px;flex-wrap:wrap;margin-bottom:36px}
    .stat__value{display:block;font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;color:#fff;line-height:1}
    .stat__label{font-size:0.75rem;color:rgba(255,255,255,0.5);letter-spacing:0.06em;text-transform:uppercase}
    .hero__cta{display:inline-block;padding:14px 32px;background:#b36d2c;color:#fff;border-radius:12px;font-weight:700;font-size:0.95rem}
    .hero__cta:hover{background:#9a5c22;text-decoration:none}

    /* Sections */
    .section{padding:56px 0}
    .section + .section{border-top:1px solid rgba(71,49,28,0.08)}
    .section__title{font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:600;color:#1a2e22;margin-bottom:20px}
    .bio{font-size:1rem;color:#3a2e26;line-height:1.85;max-width:720px}
    .chips{display:flex;flex-wrap:wrap;gap:10px}
    .chip{padding:8px 18px;border-radius:999px;border:1px solid rgba(71,49,28,0.15);font-size:0.85rem;color:#5a4e45;background:rgba(255,255,255,0.7)}

    /* Services grid */
    .services-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
    .service-item{background:rgba(255,255,255,0.6);border:1px solid rgba(71,49,28,0.1);border-radius:16px;padding:20px 22px}
    .service-item__name{font-weight:600;color:#1a2e22;margin-bottom:4px}
    .service-item__meta{font-size:0.82rem;color:#7d6d60}

    /* Blog posts */
    .posts{display:grid;gap:16px}
    .post-card{background:rgba(255,255,255,0.6);border:1px solid rgba(71,49,28,0.1);border-radius:16px;padding:20px 24px;display:grid;gap:6px}
    .post-card__date{font-size:0.75rem;color:#7d6d60;letter-spacing:0.05em;text-transform:uppercase}
    .post-card__title{font-weight:600;color:#1a2e22}
    .post-card__link{font-size:0.85rem;color:#6b8d6b;font-weight:600}

    /* CTA section */
    .cta-section{background:#1a2e22;border-radius:24px;padding:48px;text-align:center;margin-bottom:64px}
    .cta-section__title{font-family:'Cormorant Garamond',serif;font-size:2rem;color:#fff;margin-bottom:8px}
    .cta-section__sub{color:rgba(255,255,255,0.6);margin-bottom:28px}
    .cta-btn{display:inline-block;padding:14px 36px;background:#b36d2c;color:#fff;border-radius:12px;font-weight:700;font-size:1rem}
    .cta-btn:hover{background:#9a5c22;text-decoration:none}

    footer{padding:24px 0;border-top:1px solid rgba(71,49,28,0.08);text-align:center;font-size:0.8rem;color:#7d6d60}
    @media(max-width:700px){
      .hero__inner{grid-template-columns:1fr}
      .hero__photo,.hero__placeholder{max-width:240px;margin:0 auto}
      .hero{padding:48px 0}
      .stats{gap:20px}
      .cta-section{padding:32px 24px}
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar__inner">
      <span class="topbar__brand">Mateev Spa Studio</span>
      <span style="display:flex;align-items:center;gap:16px;">
        <span style="display:flex;gap:2px;font-size:0.78rem;font-weight:700;">
          <a href="?lang=ru" style="padding:3px 8px;border-radius:12px;text-decoration:none;${!isRo ? "background:#1a2e22;color:#fff;" : "color:#6b8d6b;"}">RU</a>
          <a href="?lang=ro" style="padding:3px 8px;border-radius:12px;text-decoration:none;${isRo ? "background:#1a2e22;color:#fff;" : "color:#6b8d6b;"}">RO</a>
        </span>
        <a href="${base}/#specialists" class="topbar__back">← ${t("Специалисты", "Specialiști")}</a>
      </span>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <div class="hero__inner">
        ${specialist.photo
          ? `<img src="${escapeHtml(specialist.photo)}" alt="${escapeHtml(name)}" class="hero__photo" loading="lazy">`
          : `<div class="hero__placeholder">${escapeHtml(specialist.initials || "ДМ")}</div>`}
        <div>
          <p class="hero__kicker">${t("Специалист студии", "Specialist al studioului")}</p>
          <h1 class="hero__name">${escapeHtml(name)}${specialist.certified ? ` <span style="display:inline-block;font-size:0.85rem;vertical-align:middle;padding:5px 13px;border-radius:999px;background:rgba(255,255,255,0.16);color:#fff;font-family:'Manrope',sans-serif;font-weight:700;letter-spacing:0.02em;">✓ Mateev-certified</span>` : ""}</h1>
          <p class="hero__role">${escapeHtml(role)}${specialist.location ? ` · <a href="${mapUrl}" target="_blank" rel="noopener" style="color:rgba(255,255,255,0.85);text-decoration:underline;">📍 ${escapeHtml(specialist.location)}</a>` : ""}</p>
          ${specialist.address ? `<p style="color:rgba(255,255,255,0.6);font-size:0.9rem;margin:-24px 0 28px;">📍 ${escapeHtml(specialist.address)} · <a href="${mapUrl}" target="_blank" rel="noopener" style="color:rgba(179,109,44,0.95);">${t("на карте", "pe hartă")}</a></p>` : ""}
          <div class="stats">
            ${specialist.experience ? `<div><span class="stat__value">${escapeHtml(specialist.experience)}</span><span class="stat__label">${t("лет практики", "ani de practică")}</span></div>` : ""}
            ${specialistServices.length ? `<div><span class="stat__value">${specialistServices.length}</span><span class="stat__label">${t("процедур", "proceduri")}</span></div>` : ""}
          </div>
          <a href="${base}/?prefillSpecialist=${escapeHtml(specialist.id)}&lang=${lang}#booking" class="hero__cta">${t("Записаться к мастеру", "Programare la maestru")} →</a>
        </div>
      </div>
    </div>
  </section>

  <main>
    <div class="container">
      ${bio ? `
      <div class="section">
        <h2 class="section__title">${t("О специалисте", "Despre specialist")}</h2>
        <p class="bio">${escapeHtml(bio)}</p>
      </div>` : ""}

      ${specialistServices.length ? `
      <div class="section">
        <h2 class="section__title">${t("Процедуры", "Proceduri")}</h2>
        <div class="services-grid">
          ${specialistServices.map(s => `
            <div class="service-item">
              <div class="service-item__name">${escapeHtml(t(s.name, s.nameRo))}</div>
              <div class="service-item__meta">${s.duration} ${t("мин", "min")} · ${s.price} MDL</div>
            </div>`).join("")}
        </div>
      </div>` : ""}

      ${recentPosts.length ? `
      <div class="section">
        <h2 class="section__title">${t("Дневник практики", "Jurnalul practicii")}</h2>
        <div class="posts">
          ${recentPosts.map(p => {
            const date = new Date(p.publishedAt + "T00:00:00").toLocaleDateString(isRo ? "ro-RO" : "ru-RU", { day: "numeric", month: "long", year: "numeric" });
            return `<a href="${base}/blog/${escapeHtml(p.id)}" class="post-card">
              <span class="post-card__date">${date}</span>
              <span class="post-card__title">${escapeHtml(p.title)}</span>
              <span class="post-card__link">${t("Читать", "Citește")} →</span>
            </a>`;
          }).join("")}
        </div>
      </div>` : ""}

      <div class="cta-section">
        <div class="cta-section__title">${t("Записаться к", "Programare la")} ${escapeHtml(name.split(" ")[0])}</div>
        <p class="cta-section__sub">${t("Онлайн-запись без звонков — выберите удобное время", "Programare online fără apeluri — alegeți ora potrivită")}</p>
        <a href="${base}/?prefillSpecialist=${escapeHtml(specialist.id)}&lang=${lang}#booking" class="cta-btn">${t("Выбрать время", "Alege ora")}</a>
      </div>
    </div>
  </main>
  <footer><p>© ${new Date().getFullYear()} Mateev Spa Studio · Кишинёв</p></footer>
</body>
</html>`;
}

function slugifyCity(city) {
  return String(city || "").trim().toLowerCase()
    .replace(/ș/g, "s").replace(/ț/g, "t").replace(/ă/g, "a").replace(/â/g, "a").replace(/î/g, "i")
    .replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

function renderCityPage(city, specialists, services, lang = "ru") {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const isRo = lang === "ro";
  const t = (ru, ro) => isRo ? (ro || ru) : ru;
  const title = t(`Массаж в ${city} — Mateev Spa Studio`, `Masaj în ${city} — Mateev Spa Studio`);
  const desc = t(`Сертифицированные мастера массажа в ${city}. Онлайн-запись без звонков.`, `Maseuri certificați în ${city}. Programare online, fără apeluri.`);
  const cards = specialists.map(s => {
    const svcCount = (s.specialties || []).length;
    return `<article class="mc">
      ${s.photo ? `<img src="${escapeHtml(s.photo)}" alt="${escapeHtml(s.name)}" class="mc__ph" loading="lazy">` : `<div class="mc__ph mc__ph--ph">${escapeHtml(s.initials || "")}</div>`}
      <div class="mc__body">
        <div class="mc__role">${escapeHtml(t(s.role || "Массажист", s.roleRo))}</div>
        <h3 class="mc__name">${escapeHtml(s.name)}${s.certified ? ` <span class="mc__badge">✓ Mateev-certified</span>` : ""}</h3>
        ${s.address ? `<p class="mc__addr">📍 ${escapeHtml(s.address)}</p>` : ""}
        <p class="mc__meta">${s.experience ? escapeHtml(s.experience) + " · " : ""}${svcCount} ${t("процедур", "proceduri")}</p>
        <div class="mc__cta">
          <a href="${base}/?prefillSpecialist=${escapeHtml(s.id)}&lang=${lang}#booking" class="btn btn--p">${t("Записаться", "Programare")}</a>
          <a href="${base}/team/${escapeHtml(s.id)}?lang=${lang}" class="btn">${t("Подробнее", "Detalii")}</a>
        </div>
      </div>
    </article>`;
  }).join("");
  return `<!DOCTYPE html><html lang="${lang}"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(desc)}">
    <link rel="canonical" href="${base}/city/${slugifyCity(city)}">
    <meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(desc)}">
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Главная", "item": base },
        { "@type": "ListItem", "position": 2, "name": t("Массаж в", "Masaj în") + " " + city, "item": `${base}/city/${slugifyCity(city)}` }
      ]
    })}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;line-height:1.6}
      .top{background:rgba(250,242,233,0.95);border-bottom:1px solid rgba(71,49,28,0.08);padding:16px 0}
      .wrap{max-width:1000px;margin:0 auto;padding:0 24px}
      .top .wrap{display:flex;justify-content:space-between;align-items:center}
      .brand{font-weight:700}.back{color:#6b8d6b;text-decoration:none;font-size:0.85rem;font-weight:600}
      .hero{background:linear-gradient(135deg,#1a2e22,#243b2e);color:#fff;padding:56px 0}
      .hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,4vw,3rem);font-weight:600}
      .hero p{color:rgba(255,255,255,0.65);margin-top:8px}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;padding:48px 0}
      .mc{background:#fffaf4;border:1px solid rgba(71,49,28,0.1);border-radius:20px;overflow:hidden;display:flex;flex-direction:column}
      .mc__ph{width:100%;height:220px;object-fit:cover}.mc__ph--ph{display:flex;align-items:center;justify-content:center;background:#e8ddd0;font-family:'Cormorant Garamond',serif;font-size:3rem;color:#1a2e22}
      .mc__body{padding:20px;flex:1;display:flex;flex-direction:column}.mc__role{color:#b36d2c;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
      .mc__name{font-family:'Cormorant Garamond',serif;font-size:1.35rem;margin:4px 0 6px}
      .mc__badge{font-size:0.6rem;background:rgba(40,72,56,0.1);color:#1a2e22;padding:3px 8px;border-radius:999px;vertical-align:middle;font-family:'Manrope',sans-serif;font-weight:700}
      .mc__addr,.mc__meta{font-size:0.82rem;color:#7d6d60;margin-bottom:4px}
      .mc__cta{display:flex;gap:8px;margin-top:auto;padding-top:14px}
      .btn{flex:1;text-align:center;padding:11px;border-radius:10px;border:1px solid rgba(71,49,28,0.15);color:#241c17;text-decoration:none;font-weight:600;font-size:0.85rem}
      .btn--p{background:#b36d2c;color:#fff;border-color:#b36d2c}
      footer{padding:24px 0;text-align:center;font-size:0.8rem;color:#7d6d60;border-top:1px solid rgba(71,49,28,0.08)}
    </style></head><body>
    <header class="top"><div class="wrap"><span class="brand">Mateev Spa Studio</span><a href="${base}/" class="back">← ${t("На главную", "Acasă")}</a></div></header>
    <section class="hero"><div class="wrap"><h1>${t("Массаж в", "Masaj în")} ${escapeHtml(city)}</h1><p>${t("Сертифицированные мастера сети Mateev", "Maeștri certificați ai rețelei Mateev")} · ${specialists.length}</p></div></section>
    <div class="wrap"><div class="grid">${cards}</div></div>
    <footer>© ${new Date().getFullYear()} Mateev Spa Studio</footer>
    </body></html>`;
}

function renderBlogListPage(entries, site, lang = "ru", catFilter = "") {
  const isRo = lang === "ro";
  const locale = isRo ? "ro-RO" : "ru-RU";
  const t = (ru, ro) => isRo ? ro : ru;
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const categories = [...new Set(entries.map(e => e.category).filter(Boolean))];
  const filtered = catFilter ? entries.filter(e => e.category === catFilter) : entries;
  const GA_ID = process.env.GA_MEASUREMENT_ID || "";
  const gaSnippet = GA_ID
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>`
    : "";
  const sharedHead = `
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
    ${gaSnippet}`;
  const sharedStyle = `
    <style>
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;line-height:1.7}
      a{color:#6b8d6b;text-decoration:none}
      a:hover{text-decoration:underline}
      .topbar{background:rgba(250,242,233,0.95);border-bottom:1px solid rgba(71,49,28,0.08);padding:16px 0;position:sticky;top:0;z-index:10}
      .topbar__inner{max-width:840px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center}
      .topbar__brand{font-weight:700;font-size:0.9rem;color:#241c17}
      .topbar__back{font-size:0.85rem;color:#6b8d6b;font-weight:600}
      .container{max-width:840px;margin:0 auto;padding:0 24px}
      .page{padding:56px 0 80px}
      .page__kicker{font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b36d2c;margin-bottom:12px}
      .page__title{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,5vw,3rem);font-weight:600;color:#1a2e22;margin-bottom:8px}
      .page__subtitle{color:#7d6d60;margin-bottom:48px;font-size:0.95rem}
      .entries{display:grid;gap:20px}
      .entry-card{background:rgba(255,255,255,0.7);border:1px solid rgba(71,49,28,0.1);border-radius:20px;padding:28px 32px;transition:box-shadow 0.2s}
      .entry-card:hover{box-shadow:0 8px 24px rgba(36,28,23,0.08)}
      .entry-card__date{font-size:0.78rem;font-weight:600;letter-spacing:0.06em;color:#7d6d60;text-transform:uppercase;margin-bottom:10px}
      .entry-card__title{font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#1a2e22;margin-bottom:10px;line-height:1.3}
      .entry-card__excerpt{font-size:0.9rem;color:#5a4e45;line-height:1.7;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .entry-card__link{font-size:0.85rem;font-weight:600;color:#6b8d6b}
      .entry-card__cover{width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:16px;display:block}
      .entry-card__meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}
      .chip{display:inline-block;font-size:0.72rem;font-weight:600;padding:3px 9px;border-radius:20px;background:rgba(26,46,34,0.08);color:#1a2e22;letter-spacing:0.04em}
      .chip--cat{background:rgba(179,109,44,0.12);color:#7a4800}
      .chip--read{background:rgba(107,141,107,0.12);color:#2d5a3d}
      .filter-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px}
      .filter-btn{padding:6px 14px;border-radius:20px;font-size:0.8rem;font-weight:600;border:1.5px solid rgba(26,46,34,0.15);background:transparent;color:#7d6d60;cursor:pointer;text-decoration:none;transition:all 0.15s}
      .filter-btn.is-active,.filter-btn:hover{background:#1a2e22;color:#fff;border-color:#1a2e22}
      .empty{text-align:center;padding:80px 0;color:#7d6d60}
      footer{padding:24px 0;border-top:1px solid rgba(71,49,28,0.08);text-align:center;font-size:0.8rem;color:#7d6d60}
    </style>`;

  const filterBarHtml = categories.length ? `
    <div class="filter-bar">
      <a href="/blog${isRo ? '?lang=ro' : ''}" class="filter-btn${!catFilter ? ' is-active' : ''}">${t("Все", "Toate")}</a>
      ${categories.map(cat => `<a href="/blog?cat=${encodeURIComponent(cat)}${isRo ? '&lang=ro' : ''}" class="filter-btn${catFilter === cat ? ' is-active' : ''}">${escapeHtml(cat)}</a>`).join("")}
    </div>` : "";

  const entriesHtml = filtered.length
    ? filtered.map((e) => {
        const eTitle = isRo ? (e.titleRo || e.title) : e.title;
        const eBody  = isRo ? (e.bodyRo  || e.body)  : e.body;
        const date = new Date(e.publishedAt + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
        const langParam = isRo ? "?lang=ro" : "";
        const coverHtml = e.coverImage ? `<img class="entry-card__cover" src="${escapeHtml(e.coverImage)}" alt="${escapeHtml(eTitle)}" loading="lazy">` : "";
        const metaChips = [
          e.category ? `<span class="chip chip--cat">${escapeHtml(e.category)}</span>` : "",
          `<span class="chip">${date}</span>`,
          `<span class="chip chip--read">${e.readTime} ${t("мин", "min")}</span>`,
          ...(e.tags||[]).map(tag => `<span class="chip">#${escapeHtml(tag)}</span>`)
        ].filter(Boolean).join("");
        return `
          <a href="${base}/blog/${escapeHtml(e.id)}${langParam}" class="entry-card">
            ${coverHtml}
            <div class="entry-card__meta">${metaChips}</div>
            <div class="entry-card__title">${escapeHtml(eTitle)}</div>
            <div class="entry-card__excerpt">${escapeHtml(stripMarkdown(eBody))}</div>
            <span class="entry-card__link">${t("Читать полностью →", "Citește tot →")}</span>
          </a>`;
      }).join("")
    : `<div class="empty">${t("Записей пока нет", "Nu există înregistrări")}</div>`;

  const homeLink = isRo ? "/?lang=ro" : "/";

  const blogDesc = t("Заметки о работе с телом: техники массажа, наблюдения из практики, советы по восстановлению от Дениса Матиевича.", "Note despre lucrul cu corpul: tehnici de masaj, observații din practică, sfaturi de recuperare de la Denis Matievici.");
  return `<!DOCTYPE html>
<html lang="${isRo ? "ro" : "ru"}">
<head>
  ${sharedHead}
  <title>${t("Дневник практики", "Jurnalul practicii")} — Mateev Spa Studio</title>
  <meta name="description" content="${blogDesc}">
  <link rel="canonical" href="${base}/blog">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${t("Дневник практики", "Jurnalul practicii")} — Mateev Spa Studio">
  <meta property="og:description" content="${blogDesc}">
  <meta property="og:url" content="${base}/blog">
  <meta property="og:image" content="${base}/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t("Дневник практики", "Jurnalul practicii")} — Mateev Spa Studio">
  <meta name="twitter:description" content="${blogDesc}">
  ${sharedStyle}
</head>
<body>
  <header class="topbar">
    <div class="topbar__inner">
      <span class="topbar__brand">Mateev Spa Studio</span>
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="display:flex;gap:4px;">
          <a href="/blog" style="padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;text-decoration:none;${!isRo ? 'background:#1a2e22;color:#fff;' : 'color:#7d6d60;'}">RU</a>
          <a href="/blog?lang=ro" style="padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;text-decoration:none;${isRo ? 'background:#1a2e22;color:#fff;' : 'color:#7d6d60;'}">RO</a>
        </div>
        <a href="${homeLink}" class="topbar__back">← ${t("На главную", "Pagina principală")}</a>
      </div>
    </div>
  </header>
  <main>
    <div class="container">
      <div class="page">
        <p class="page__kicker">${t("Дневник практики", "Jurnalul practicii")}</p>
        <h1 class="page__title">${t("Заметки о работе с телом", "Note despre lucrul cu corpul")}</h1>
        <p class="page__subtitle">${t("Техники, наблюдения и случаи из практики — от Дениса Матиевича", "Tehnici, observații și cazuri din practică — de Denis Matievici")}</p>
        ${filterBarHtml}
        <div class="entries">${entriesHtml}</div>

        <div style="margin-top:56px;padding:36px;background:rgba(26,46,34,0.06);border:1px solid rgba(26,46,34,0.12);border-radius:20px;text-align:center;">
          <p style="font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b36d2c;margin-bottom:8px;">${t("Подписка", "Abonament")}</p>
          <h2 style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:#1a2e22;margin-bottom:8px;">${t("Новые записи — на почту", "Articole noi — pe email")}</h2>
          <p style="color:#7d6d60;font-size:0.9rem;margin-bottom:20px;">${t("Один email когда выйдет новая заметка. Без спама.", "Un email când apare un articol nou. Fără spam.")}</p>
          <form id="subscribeForm" style="display:flex;gap:10px;max-width:400px;margin:0 auto;flex-wrap:wrap;justify-content:center;">
            <input type="email" id="subscribeEmail" placeholder="${t("ваш@email.com", "email@dvs.com")}" required
              style="flex:1;min-width:200px;padding:12px 16px;border-radius:10px;border:1px solid rgba(71,49,28,0.2);background:#fff;font-size:0.9rem;font-family:inherit;">
            <button type="submit"
              style="padding:12px 24px;background:#1a2e22;color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">
              ${t("Подписаться", "Abonați-vă")}
            </button>
          </form>
          <p id="subscribeMsg" style="margin-top:12px;font-size:0.85rem;color:#6b8d6b;display:none;"></p>
        </div>
      </div>
    </div>
  </main>
  <script>
    document.getElementById("subscribeForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("subscribeEmail").value.trim();
      const msg = document.getElementById("subscribeMsg");
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      btn.textContent = "...";
      try {
        const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const data = await r.json();
        msg.textContent = data.message || "Готово!";
        msg.style.display = "block";
        e.target.reset();
      } catch {
        msg.textContent = "Ошибка. Попробуйте позже.";
        msg.style.color = "#c0392b";
        msg.style.display = "block";
      } finally {
        btn.disabled = false;
        btn.textContent = "Подписаться";
      }
    });
  </script>
  <footer><p>© ${new Date().getFullYear()} Mateev Spa Studio · Кишинёв</p></footer>
</body>
</html>`;
}

function renderDiplomaCertPage(diploma, notFound = false, signatureUrl = "") {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  if (notFound || !diploma) {
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Диплом не найден</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f0e4;color:#2d1a0a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center;padding:24px}.card{background:#fff;border-radius:18px;padding:40px;box-shadow:0 8px 40px rgba(0,0,0,.1);max-width:420px}</style></head>
<body><div class="card"><p style="font-size:2.4rem;margin:0;">❌</p><h1 style="color:#b91c1c;font-size:1.4rem;margin:12px 0;">Диплом не найден</h1><p style="color:#7a6a58;">Код неверный или диплом отозван. Проверьте код на дипломе или свяжитесь со студией.</p><a href="${base}/team" style="color:#4a6b52;font-weight:700;">Mateev Spa Studio →</a></div></body></html>`;
  }
  const dateFmt = (() => { try { return new Date(diploma.completionDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); } catch { return diploma.completionDate || ""; } })();
  const certUrl = `${base}/cert?code=${encodeURIComponent(diploma.code)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&qzone=1&color=2d4a35&bgcolor=f7f2e6&data=${encodeURIComponent(certUrl)}`;
  const name = escapeHtml(diploma.graduateName || "Выпускник");
  const course = escapeHtml(diploma.courseName || "");
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Диплом ${escapeHtml(diploma.graduateName || "")} — Mateev Spa Studio</title>
<meta name="description" content="Подтверждённый диплом Mateev Spa Studio: ${name} — ${course}. Код ${escapeHtml(diploma.code)}.">
<meta property="og:title" content="🎓 Диплом Mateev Spa Studio — ${name}">
<meta property="og:description" content="${course} · ${dateFmt}. Подлинность подтверждена студией.">
<meta property="og:image" content="${base}/diploma-bg.png">
<meta property="og:url" content="${certUrl}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Manrope',sans-serif;background:#e8e2d4;color:#2d1a0a;padding:20px 12px 60px}
  .bar{max-width:210mm;margin:0 auto 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .verified{display:inline-flex;align-items:center;gap:8px;background:#eaf3ea;border:1.5px solid #6b8d6b;color:#2d4a35;border-radius:999px;padding:8px 16px;font-weight:700;font-size:.9rem}
  .actions{display:flex;gap:8px;flex-wrap:wrap}
  .btn{background:#b36d2c;color:#fff;border:none;border-radius:10px;padding:9px 16px;font-weight:700;font-size:.85rem;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block}
  .btn--ghost{background:#fff;border:1.5px solid #cfc3ac;color:#2d1a0a}
  .sheet-wrap{max-width:210mm;margin:0 auto;overflow:hidden}
  .diploma-sheet{width:210mm;min-height:297mm;position:relative;background:#f5f0e4 url('/diploma-bg.png') center/cover no-repeat;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60mm 22mm 40mm;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.18);transform-origin:top left}
  .dk{font-size:8pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#4a6b52;margin-bottom:14pt}
  .dh{font-family:'Cormorant Garamond',Georgia,serif;font-size:38pt;font-weight:600;color:#2d4a35;line-height:1;margin-bottom:22pt;letter-spacing:.04em}
  .dsub{font-family:'Cormorant Garamond',serif;font-size:13pt;font-style:italic;color:#5a6e5c;margin-bottom:10pt}
  .dname{font-family:'Cormorant Garamond',serif;font-size:32pt;font-weight:700;color:#2d1a0a;line-height:1.1;margin-bottom:18pt;border-bottom:1.5pt solid rgba(179,109,44,.4);padding-bottom:10pt;width:80%}
  .dcl{font-size:7.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7a8c7c;margin-bottom:6pt}
  .dcourse{font-family:'Cormorant Garamond',serif;font-size:18pt;font-weight:600;color:#2d4a35;margin-bottom:28pt}
  .dmeta{display:flex;justify-content:center;gap:40pt;width:80%;margin-bottom:30pt}
  .dmi{display:flex;flex-direction:column;align-items:center;gap:4pt}
  .dml{font-size:6.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9aab9c}
  .dmv{font-family:'Cormorant Garamond',serif;font-size:13pt;color:#2d1a0a}
  .dsig{display:flex;flex-direction:column;align-items:center;gap:4pt;margin-top:4pt}
  .dsig__img{height:46pt;max-width:150pt;object-fit:contain;margin-bottom:-6pt;mix-blend-mode:multiply}
  .dsigline{width:100pt;height:1pt;background:rgba(45,74,53,.3);margin-bottom:4pt}
  .dsign{font-family:'Cormorant Garamond',serif;font-size:11pt;font-weight:600;color:#2d4a35}
  .dsigr{font-size:6.5pt;letter-spacing:.1em;text-transform:uppercase;color:#9aab9c}
  .dverify{display:flex;flex-direction:column;align-items:center;gap:7pt;margin-top:104pt}
  .dverify__qr{width:18mm;height:18mm;padding:4pt;background:#f7f2e6;border:1px solid rgba(45,74,53,.22);border-radius:8px;box-shadow:0 1px 5px rgba(45,26,10,.08)}
  .dverify__qr img{width:100%;height:100%;display:block}
  .dverify__code{font-family:'Manrope',monospace;font-size:8.5pt;letter-spacing:.08em;color:#4a6b52;font-weight:700}
  .foot{max-width:210mm;margin:16px auto 0;text-align:center;color:#7a6a58;font-size:.8rem}
  @media print{ body{background:#fff;padding:0} .bar,.foot{display:none} .diploma-sheet{box-shadow:none;transform:none!important} .sheet-wrap{max-width:none;overflow:visible} }
</style>
</head>
<body>
  <div class="bar">
    <span class="verified">✓ Подлинный диплом · Mateev Spa Studio</span>
    <div class="actions">
      <button class="btn" onclick="window.print()">🖨 Скачать / печать</button>
      <button class="btn btn--ghost" id="shareBtn">🔗 Поделиться</button>
    </div>
  </div>
  <div class="sheet-wrap">
    <div class="diploma-sheet" id="sheet">
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;">
        <p class="dk">Mateev Spa Studio · Школа массажа</p>
        <h2 class="dh">ДИПЛОМ</h2>
        <p class="dsub">Настоящим подтверждается, что</p>
        <p class="dname">${name}</p>
        <p class="dcl">успешно завершил(а) курс</p>
        <p class="dcourse">${course}</p>
        <div class="dmeta">
          <div class="dmi"><span class="dml">Дата окончания</span><span class="dmv">${escapeHtml(dateFmt)}</span></div>
          <div class="dmi"><span class="dml">Место проведения</span><span class="dmv">Кишинёв, Молдова</span></div>
        </div>
        <div class="dsig">${signatureUrl ? `<img class="dsig__img" src="${escapeHtml(signatureUrl)}" alt="Подпись">` : ""}<div class="dsigline"></div><p class="dsign">Денис Матиевич</p><p class="dsigr">Основатель · Преподаватель</p></div>
        <div class="dverify">
          <div class="dverify__qr"><img src="${qrUrl}" alt="QR проверки подлинности"></div>
          <span class="dverify__code">${escapeHtml(diploma.code)}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="foot">Этот диплом подтверждён студией Mateev Spa Studio. Код: <strong>${escapeHtml(diploma.code)}</strong> · Отсканируйте QR для проверки.<br><a href="${base}/graduates" style="color:#4a6b52;font-weight:700;">Все выпускники школы →</a></div>
  <script>
    // Масштабируем лист под ширину экрана (сохраняя дизайн)
    function fit(){
      var wrap=document.querySelector('.sheet-wrap'), sheet=document.getElementById('sheet');
      if(!wrap||!sheet) return;
      sheet.style.transform='none';
      var w=wrap.clientWidth, sw=sheet.offsetWidth;
      if(sw>w){ var s=w/sw; sheet.style.transform='scale('+s+')'; wrap.style.height=(sheet.offsetHeight*s)+'px'; }
      else { wrap.style.height=''; }
    }
    window.addEventListener('resize',fit); window.addEventListener('load',fit); fit();
    document.getElementById('shareBtn').addEventListener('click',async function(){
      var url=location.href;
      try{ if(navigator.share){ await navigator.share({title:'Мой диплом Mateev Spa Studio',url:url}); } else { await navigator.clipboard.writeText(url); this.textContent='✓ Ссылка скопирована'; } }catch(e){}
    });
  </script>
</body>
</html>`;
}

function renderSaasLandingPage() {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const feature = (icon, title, text) => `<div class="feat"><div class="feat__ic">${icon}</div><div><div class="feat__t">${title}</div><div class="feat__x">${text}</div></div></div>`;
  const tier = (name, price, note, items, hot) => `<div class="tier${hot ? " tier--hot" : ""}">${hot ? '<div class="tier__badge">Популярный</div>' : ""}<div class="tier__name">${name}</div><div class="tier__price">€${price}<span>/мес</span></div><div class="tier__note">${note}</div><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></div>`;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Платформа для массажных студий под ключ — от Mateev Spa Studio</title>
<meta name="description" content="Сайт, онлайн-запись, AI-ресепшн 24/7, кабинет клиента, CRM, аналитика, школа и дипломы — всё под ключ для вашей массажной студии. Ранний доступ.">
<meta property="og:title" content="Твоя массажная студия — под ключ">
<meta property="og:description" content="Всё, что построено для Mateev Spa Studio, теперь для тебя. Ранний доступ.">
<meta property="og:image" content="${base}/og-image.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;line-height:1.6}
  a{color:inherit}
  .wrap{max-width:920px;margin:0 auto;padding:0 24px}
  .top{padding:18px 0;display:flex;justify-content:space-between;align-items:center}
  .top__brand{font-weight:700;font-size:.9rem}
  .top__back{font-size:.85rem;color:#6b8d6b;font-weight:600;text-decoration:none}
  .hero{padding:56px 0 40px;text-align:center}
  .kick{font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#b36d2c;margin-bottom:14px}
  h1{font-family:'Cormorant Garamond',serif;font-size:clamp(2.2rem,6vw,3.6rem);font-weight:600;color:#1a2e22;line-height:1.1;margin-bottom:16px}
  .lead{color:#5a4a3c;max-width:620px;margin:0 auto 28px;font-size:1.05rem}
  .btn{display:inline-block;background:#b36d2c;color:#fff;border:none;border-radius:12px;padding:15px 34px;font-weight:700;font-size:1rem;cursor:pointer;text-decoration:none;font-family:inherit}
  .btn:hover{background:#9a5c22}
  .proof{margin-top:16px;font-size:.85rem;color:#7d6d60}
  .sec{padding:44px 0}
  .sec h2{font-family:'Cormorant Garamond',serif;font-size:2rem;color:#1a2e22;text-align:center;margin-bottom:28px}
  .feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
  .feat{display:flex;gap:14px;background:rgba(255,255,255,.7);border:1px solid rgba(71,49,28,.1);border-radius:16px;padding:18px 20px}
  .feat__ic{font-size:1.5rem;flex:0 0 auto}
  .feat__t{font-weight:700;color:#1a2e22}
  .feat__x{font-size:.88rem;color:#5a4e45;margin-top:2px}
  .tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;align-items:start}
  .tier{background:#fff;border:1px solid rgba(71,49,28,.12);border-radius:18px;padding:24px 22px;position:relative}
  .tier--hot{border-color:#b36d2c;box-shadow:0 8px 30px rgba(179,109,44,.15)}
  .tier__badge{position:absolute;top:-11px;left:22px;background:#b36d2c;color:#fff;font-size:.7rem;font-weight:700;padding:4px 12px;border-radius:20px}
  .tier__name{font-weight:700;color:#1a2e22;font-size:1.1rem}
  .tier__price{font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:700;color:#1a2e22;margin:6px 0 2px}
  .tier__price span{font-size:.9rem;font-family:'Manrope';color:#7d6d60;font-weight:500}
  .tier__note{font-size:.82rem;color:#7d6d60;margin-bottom:12px}
  .tier ul{list-style:none;display:grid;gap:6px}
  .tier li{font-size:.86rem;color:#3a2e26;padding-left:20px;position:relative}
  .tier li::before{content:"✓";position:absolute;left:0;color:#6b8d6b;font-weight:700}
  .note-price{text-align:center;color:#7d6d60;font-size:.82rem;margin-top:14px}
  .form-card{background:#1a2e22;border-radius:24px;padding:40px 32px;margin:24px 0 60px}
  .form-card h2{color:#fff}
  .form-card p.sub{color:rgba(255,255,255,.7);text-align:center;margin-bottom:22px;font-size:.92rem}
  form{max-width:460px;margin:0 auto;display:grid;gap:12px}
  form input,form select,form textarea{width:100%;padding:13px 15px;border-radius:10px;border:none;font-family:inherit;font-size:.95rem}
  form button{padding:15px;background:#b36d2c;color:#fff;border:none;border-radius:12px;font-weight:700;font-size:1rem;cursor:pointer;font-family:inherit}
  .msg{text-align:center;color:#ffd9a8;font-size:.88rem;min-height:1em}
  footer{padding:26px 0;text-align:center;font-size:.8rem;color:#7d6d60}
</style>
</head>
<body>
  <div class="wrap">
    <div class="top"><span class="top__brand">Mateev Spa Studio · Платформа</span><a class="top__back" href="${base}/">← На сайт студии</a></div>
    <section class="hero">
      <p class="kick">Ранний доступ · для массажистов и студий</p>
      <h1>Твоя массажная студия — под ключ</h1>
      <p class="lead">Сайт, онлайн-запись, AI-ресепшн 24/7, кабинет клиента, CRM и аналитика, школа и дипломы — всё, что мы построили и каждый день используем в Mateev Spa Studio. Теперь — для тебя.</p>
      <a class="btn" href="#join">Оставить заявку на ранний доступ</a>
      <p class="proof">🌿 Работает в реальной студии в Кишинёве каждый день</p>
    </section>

    <section class="sec">
      <h2>Что входит</h2>
      <div class="feats">
        ${feature("📅", "Онлайн-запись", "Сайт с записью, свободные окна, защита от двойных броней, закрытия студии.")}
        ${feature("🤖", "AI-ресепшн 24/7", "AI сам записывает клиентов в чате сайта и в Telegram — ловит заявки ночью.")}
        ${feature("👤", "Кабинет клиента", "Портал, PWA, напоминания в Telegram, история визитов, лояльность.")}
        ${feature("🗂️", "CRM и заметки", "Карточки клиентов, голосовые заметки → AI-карта, блокнот, долги.")}
        ${feature("📊", "Дашборд и аналитика", "Выручка, LTV, удержание, топ-услуги, P&L — вся студия как на ладони.")}
        ${feature("📣", "Маркетинг", "Генератор постов, посты для Google, AI-ответы на отзывы, рассылки, рефералы.")}
        ${feature("🎓", "Школа и дипломы", "Курсы, дипломы с QR-верификацией, стена выпускников, методички.")}
        ${feature("🕸️", "Сеть мастеров", "Выпускники → мастера с кабинетом и комиссией. Масштаб по городам.")}
      </div>
    </section>

    <section class="sec">
      <h2>Тарифы (ранний доступ)</h2>
      <div class="tiers">
        ${tier("Соло", 19, "для одного массажиста", ["Сайт + онлайн-запись", "Кабинет клиента", "AI-ресепшн", "Напоминания"], false)}
        ${tier("Студия", 39, "команда мастеров", ["Всё из «Соло»", "CRM + аналитика", "Маркетинг + рефералы", "Голосовые заметки"], true)}
        ${tier("Школа", 79, "студия + обучение", ["Всё из «Студия»", "Школа и дипломы + QR", "Методички, стена выпускников", "Сеть мастеров + комиссия"], false)}
      </div>
      <p class="note-price">Цены на этапе раннего доступа — предварительные. Ранние участники получат льготные условия.</p>
    </section>

    <section class="form-card" id="join">
      <h2>Заявка на ранний доступ</h2>
      <p class="sub">Оставь контакты — расскажем детали и дадим особые условия первым.</p>
      <form id="saasForm">
        <input type="text" id="sName" placeholder="Имя *" required>
        <input type="text" id="sContact" placeholder="Телефон / Telegram / Email *" required>
        <select id="sSize">
          <option value="">Размер студии…</option>
          <option>Работаю один</option>
          <option>2–5 мастеров</option>
          <option>Больше 5</option>
          <option>Пока только планирую</option>
        </select>
        <input type="text" id="sCity" placeholder="Город">
        <textarea id="sNote" rows="2" placeholder="Что для вас важнее всего? (необязательно)"></textarea>
        <button type="submit" id="sBtn">Отправить заявку</button>
        <p class="msg" id="sMsg"></p>
      </form>
    </section>
  </div>
  <footer>© ${new Date().getFullYear()} Mateev Spa Studio · Платформа для массажных студий</footer>
  <script>
    document.getElementById("saasForm").addEventListener("submit", async function(e){
      e.preventDefault();
      var btn=document.getElementById("sBtn"), msg=document.getElementById("sMsg");
      var body={ name:document.getElementById("sName").value.trim(), contact:document.getElementById("sContact").value.trim(), size:document.getElementById("sSize").value, city:document.getElementById("sCity").value.trim(), note:document.getElementById("sNote").value.trim() };
      if(!body.name||!body.contact){ msg.textContent="Заполните имя и контакт."; return; }
      btn.disabled=true; btn.textContent="Отправляем…"; msg.textContent="";
      try{
        var res=await fetch("/api/saas-lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
        var d=await res.json().catch(function(){return{};});
        if(!res.ok){ msg.textContent=d.message||"Не удалось отправить."; btn.disabled=false; btn.textContent="Отправить заявку"; return; }
        document.getElementById("saasForm").innerHTML='<div style="text-align:center;padding:16px 0;"><p style="font-size:2.4rem;margin:0;">✅</p><h3 style="color:#fff;font-family:\\'Cormorant Garamond\\',serif;font-size:1.6rem;margin:8px 0;">Заявка принята!</h3><p style="color:rgba(255,255,255,.75);">Спасибо! Свяжемся с вами в ближайшее время и расскажем детали.</p></div>';
      }catch(err){ msg.textContent="Ошибка сети. Попробуйте ещё раз."; btn.disabled=false; btn.textContent="Отправить заявку"; }
    });
  </script>
</body>
</html>`;
}

function renderGraduatesPage(diplomas, lang = "ru") {
  const ro = lang === "ro";
  const t = (r, o) => (ro ? o : r);
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const list = (diplomas || []).filter((d) => d.public).sort((a, b) => (b.completionDate || "").localeCompare(a.completionDate || ""));
  const fmt = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString(ro ? "ro-RO" : "ru-RU", { month: "long", year: "numeric" }); } catch { return d || ""; } };
  const initials = (name) => (name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  const cards = list.map((d) => `
    <a class="grad-card" href="${base}/cert?code=${encodeURIComponent(d.code)}${ro ? "&lang=ro" : ""}">
      <div class="grad-card__ava">${escapeHtml(initials(d.graduateName)) || "🎓"}</div>
      <div class="grad-card__body">
        <div class="grad-card__name">${escapeHtml(d.graduateName || t("Выпускник", "Absolvent"))}</div>
        <div class="grad-card__course">${escapeHtml(d.courseName || "")}</div>
        <div class="grad-card__meta">${escapeHtml(fmt(d.completionDate))} · ✓ ${t("подтверждён", "confirmat")}</div>
      </div>
      <span class="grad-card__arrow">→</span>
    </a>`).join("");
  return `<!DOCTYPE html>
<html lang="${ro ? "ro" : "ru"}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t("Выпускники школы", "Absolvenții școlii")} — Mateev Spa Studio</title>
<meta name="description" content="${t("Мастера, прошедшие обучение и сертификацию в школе массажа Mateev Spa Studio, Кишинёв. Подтверждённые дипломы с проверкой подлинности.", "Specialiști care au absolvit și au fost certificați la școala de masaj Mateev Spa Studio, Chișinău. Diplome confirmate cu verificarea autenticității.")}">
<link rel="canonical" href="${base}/graduates">
<meta property="og:title" content="${t("Выпускники школы Mateev Spa Studio", "Absolvenții școlii Mateev Spa Studio")}">
<meta property="og:description" content="${t("Сертифицированные мастера школы массажа. Подтверждённые дипломы.", "Maeștri certificați ai școlii de masaj. Diplome confirmate.")}">
<meta property="og:image" content="${base}/og-image.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;line-height:1.6}
  .topbar{background:rgba(250,242,233,.95);border-bottom:1px solid rgba(71,49,28,.08);padding:16px 0;position:sticky;top:0;z-index:10}
  .topbar__inner{max-width:820px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center}
  .topbar__brand{font-weight:700;font-size:.9rem;color:#241c17}
  .topbar__back{font-size:.85rem;color:#6b8d6b;font-weight:600;text-decoration:none}
  .wrap{max-width:820px;margin:0 auto;padding:48px 24px 80px}
  .kicker{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#b36d2c;margin-bottom:12px}
  h1{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,5vw,3rem);font-weight:600;color:#1a2e22;margin-bottom:10px;line-height:1.15}
  .sub{color:#7d6d60;max-width:560px;margin-bottom:36px;font-size:.98rem}
  .grid{display:grid;gap:14px}
  .grad-card{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.7);border:1px solid rgba(71,49,28,.1);border-radius:18px;padding:18px 22px;text-decoration:none;color:inherit;transition:box-shadow .2s,transform .2s}
  .grad-card:hover{box-shadow:0 10px 28px rgba(36,28,23,.09);transform:translateY(-2px)}
  .grad-card__ava{width:52px;height:52px;flex:0 0 52px;border-radius:50%;background:#1a2e22;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:600}
  .grad-card__body{flex:1;min-width:0}
  .grad-card__name{font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:#1a2e22;line-height:1.2}
  .grad-card__course{font-size:.9rem;color:#3a2e26;margin-top:2px}
  .grad-card__meta{font-size:.78rem;color:#6b8d6b;font-weight:600;margin-top:4px;text-transform:capitalize}
  .grad-card__arrow{color:#b36d2c;font-size:1.2rem;flex:0 0 auto}
  .empty{text-align:center;color:#7d6d60;padding:48px 0}
  .cta{margin-top:40px;background:#1a2e22;border-radius:20px;padding:32px;text-align:center}
  .cta h2{font-family:'Cormorant Garamond',serif;color:#fff;font-size:1.6rem;margin-bottom:6px}
  .cta p{color:rgba(255,255,255,.7);font-size:.92rem;margin-bottom:18px}
  .cta a{display:inline-block;background:#b36d2c;color:#fff;border-radius:12px;padding:12px 26px;font-weight:700;text-decoration:none;font-size:.92rem}
  footer{padding:24px 0;border-top:1px solid rgba(71,49,28,.08);text-align:center;font-size:.8rem;color:#7d6d60}
</style>
</head>
<body>
  <header class="topbar"><div class="topbar__inner"><span class="topbar__brand">Mateev Spa Studio · ${t("Школа массажа", "Școala de masaj")}</span><a href="${base}/" class="topbar__back">← ${t("На главную", "Acasă")}</a></div></header>
  <main class="wrap">
    <p class="kicker">${t("Выпускники", "Absolvenți")}</p>
    <h1>${t("Наши сертифицированные мастера", "Maeștrii noștri certificați")}</h1>
    <p class="sub">${t("Специалисты, прошедшие авторское обучение и сертификацию в школе Mateev Spa Studio. Каждый диплом подтверждён — нажмите, чтобы проверить подлинность.", "Specialiști care au absolvit cursurile de autor și au fost certificați la școala Mateev Spa Studio. Fiecare diplomă este confirmată — apăsați pentru a verifica autenticitatea.")}</p>
    ${cards ? `<div class="grid">${cards}</div>` : `<div class="empty">${t("Скоро здесь появятся наши выпускники.", "În curând aici vor apărea absolvenții noștri.")}</div>`}
    <div class="cta">
      <h2>${t("Хотите так же?", "Vreți la fel?")}</h2>
      <p>${t("Присоединяйтесь к обучению массажу в нашей школе.", "Alăturați-vă cursurilor de masaj din școala noastră.")}</p>
      <a href="${base}/school">${t("Узнать о курсах", "Despre cursuri")}</a>
    </div>
  </main>
  <footer>© ${new Date().getFullYear()} Mateev Spa Studio · ${t("Кишинёв", "Chișinău")}</footer>
</body>
</html>`;
}

function renderCareNotePage(note) {
  if (!note) {
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Памятка недоступна</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f7f0e6;color:#241c17;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center;padding:24px}</style></head>
<body><div><h1 style="color:#1a2e22;">Памятка недоступна</h1><p style="color:#7d6d60;">Ссылка неверна или устарела. Обратитесь к массажисту.</p></div></body></html>`;
  }
  const body = parseMarkdown(note.content || "");
  const hi = note.clientName ? `, ${escapeHtml(note.clientName)}` : "";
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  return `<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Памятка после сеанса — Mateev Spa Studio</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f7f0e6;color:#241c17;line-height:1.6;font-size:16px}
  .wrap{max-width:720px;margin:0 auto;padding:28px 22px 60px}
  .brand{font-weight:700;color:#1a2e22;margin-bottom:6px}
  .kicker{color:#b36d2c;font-weight:700;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase}
  h1{font-size:1.7rem;color:#1a2e22;margin:6px 0 18px;line-height:1.2}
  .content h2{font-size:1.25rem;color:#1a2e22;border-bottom:2px solid #b36d2c;padding-bottom:4px;margin:26px 0 10px}
  .content h3{font-size:1.05rem;color:#6b4a1f;margin:16px 0 6px}
  .content p{margin:10px 0}.content ul,.content ol{margin:8px 0 12px;padding-left:22px}.content li{margin:4px 0}.content strong{color:#1a2e22}
  .cta{display:inline-block;margin-top:24px;background:#1a2e22;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600}
  .foot{margin-top:34px;border-top:1px solid #ddd;padding-top:12px;color:#8a7a6c;font-size:.8rem}
</style></head>
<body><div class="wrap">
  <p class="brand">Mateev Spa Studio</p>
  <p class="kicker">Памятка после сеанса</p>
  <h1>Спасибо за визит${hi}!</h1>
  <div class="content">${body}</div>
  <a class="cta" href="${base}/#booking">Записаться снова →</a>
  <div class="foot">© ${new Date().getFullYear()} Mateev Spa Studio · Денис Матеев. Рекомендации носят общий характер и не заменяют консультацию врача. При острой боли или ухудшении — обратитесь к специалисту.</div>
</div></body></html>`;
}

function renderMaterialPage(material) {
  if (!material) {
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Материал не найден</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f7f0e6;color:#241c17;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center;padding:24px}</style></head>
<body><div><h1 style="color:#1a2e22;">Материал недоступен</h1><p style="color:#7d6d60;">Ссылка неверна или доступ отозван. Обратитесь к преподавателю.</p></div></body></html>`;
  }
  let body = parseMarkdown(material.content || "");
  // Оглавление: проставляем id заголовкам ## и собираем список
  let secIdx = 0;
  const toc = [];
  body = body.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
    const id = `sec-${secIdx++}`;
    toc.push({ id, label: inner.replace(/<[^>]+>/g, "").trim() });
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
  const tocHtml = toc.length > 1
    ? `<nav class="toc"><p class="toc__title">Содержание</p><ol>${toc.map(t => `<li><a href="#${t.id}">${escapeHtml(t.label)}</a></li>`).join("")}</ol></nav>`
    : "";
  const meta = [material.date, material.topics].filter(Boolean).join(" · ");
  const wm = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='340'%20height='200'%3E%3Ctext%20x='20'%20y='120'%20transform='rotate(-28%20170%20100)'%20fill='%23b36d2c'%20font-family='Arial'%20font-size='22'%3EMateev%20Spa%20Studio%3C/text%3E%3C/svg%3E";
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(material.title)} — Mateev Spa Studio</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f7f0e6;color:#241c17;line-height:1.6;font-size:16px}
  body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:5;background-image:url("${wm}");background-repeat:repeat;opacity:.05}
  .wrap{max-width:820px;margin:0 auto;padding:32px 24px 64px;position:relative;z-index:1}
  .topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap}
  .brand{font-weight:700;color:#1a2e22}
  .ro-badge{font-size:.78rem;font-weight:700;color:#6b4a1f;background:#f0e6d6;border:1px solid #dcc9a6;border-radius:999px;padding:5px 12px}
  .kicker{color:#b36d2c;font-weight:700;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase}
  h1{font-size:1.9rem;color:#1a2e22;margin:6px 0 4px;line-height:1.2}
  .meta{color:#8a7a6c;font-size:.9rem;margin-bottom:24px}
  .toc{background:#fffdf9;border:1px solid #e3d8c6;border-radius:14px;padding:16px 20px;margin:8px 0 28px}
  .toc__title{font-weight:700;color:#1a2e22;margin-bottom:8px;font-size:.95rem}
  .toc ol{margin:0;padding-left:20px}
  .toc li{margin:4px 0}
  .toc a{color:#6b8d6b;text-decoration:none;font-weight:600}
  .toc a:hover{text-decoration:underline}
  html{scroll-behavior:smooth}
  .content h1{font-size:1.6rem;margin:32px 0 10px}
  .content h2{font-size:1.4rem;color:#1a2e22;border-bottom:2px solid #b36d2c;padding-bottom:4px;margin:30px 0 12px;scroll-margin-top:16px}
  .content h3{font-size:1.12rem;color:#6b4a1f;margin:20px 0 6px}
  .content p{margin:10px 0}
  .content ul,.content ol{margin:8px 0 12px;padding-left:22px}
  .content li{margin:3px 0}
  .content strong{color:#1a2e22}
  .content figure{margin:16px 0;text-align:center;break-inside:avoid}
  .content img{max-width:100%;height:auto;max-height:60vh;border-radius:10px;display:block;margin:0 auto;pointer-events:none}
  .content figcaption{font-size:.85rem;color:#7d6d60;margin-top:6px}
  .foot{margin-top:40px;border-top:1px solid #ddd;padding-top:12px;color:#8a7a6c;font-size:.8rem}
  @media print{ html{display:none!important} }
</style>
</head>
<body oncontextmenu="return false" oncopy="return false" oncut="return false" ondragstart="return false">
<div class="wrap">
  <div class="topbar">
    <span class="brand">Mateev Spa Studio · Материалы семинара</span>
    <span class="ro-badge">🔒 Только для чтения</span>
  </div>
  <p class="kicker">Методичка</p>
  <h1>${escapeHtml(material.title)}</h1>
  ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
  ${tocHtml}
  <div class="content">${body}</div>
  <div class="foot">© ${new Date().getFullYear()} Mateev Spa Studio. Материал для участников семинара. Копирование и распространение без согласия автора не допускается. Информация носит образовательный характер и не заменяет медицинскую консультацию.</div>
</div>
<script>
  document.addEventListener('keydown', function(e){
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's' || k === 'c' || k === 'u')) { e.preventDefault(); }
  });
</script>
</body>
</html>`;
}

function renderCertificatesPage(site, lang = "ru") {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const phone = site?.brand?.phone || "+373 69 158 475";
  const telegram = site?.brand?.telegram || "";
  const ro = lang === "ro";
  const t = ro ? {
    title: "Certificate cadou — Mateev Spa Studio",
    metaDesc: "Dăruiește o ședință de masaj la Mateev Spa Studio. Certificate de orice valoare — cadoul perfect pentru cei dragi.",
    ogDesc: "Dăruiește o ședință de masaj. Certificate de la 500 MDL — cadoul perfect pentru cei dragi.",
    prodName: "Certificat cadou pentru masaj",
    prodDesc: "Certificat pentru o ședință de masaj la Mateev Spa Studio, Chișinău. Valori disponibile: 500, 1000, 1500, 2000 MDL și orice sumă.",
    back: "← Acasă",
    kicker: "Certificate cadou",
    heroTitle: "Dăruiește grijă pentru corp",
    heroSub: "Certificatul pentru masaj este un cadou care ajută la recuperare, eliberează tensiunea și te face să te simți mai bine. Potrivit pentru orice ocazie.",
    anySum: "Orice sumă — la alegerea ta",
    anySumSub: "Putem emite un certificat de orice valoare",
    anySumHint: "Precizați la comandă →",
    howTitle: "Cum funcționează",
    step1: "Scrieți-ne — indicați numele destinatarului și valoarea dorită",
    step2: "Pregătim un certificat frumos cu un cod unic și vi-l trimitem",
    step3: "Destinatarul se programează la o oră convenabilă și prezintă codul",
    orderTitle: "Comandă certificat",
    orderSub: "Completați formularul — vă contactăm pentru plată și pregătim certificatul",
    amountLabel: "Suma (MDL)",
    phRecipient: "Numele destinatarului (opțional)",
    phName: "Numele dvs. *",
    phPhone: "Telefonul dvs. *",
    phEmail: "Email (opțional)",
    phMessage: "Urare pentru destinatar (opțional)",
    submit: "Trimite comanda",
    orDirect: "Sau direct:",
    callWord: "sunați",
    city: "Chișinău",
    jsSending: "Se trimite…",
    jsFail: "Nu am putut trimite cererea.",
    jsSubmit: "Trimite comanda",
    jsDoneTitle: "Cerere primită!",
    jsDoneText: "Vă contactăm în cel mai scurt timp — stabilim plata și pregătim certificatul.",
    jsNetErr: "Eroare de rețea. Încercați din nou."
  } : {
    title: "Подарочные сертификаты — Mateev Spa Studio",
    metaDesc: "Подарите сеанс массажа в Mateev Spa Studio. Сертификаты на любую сумму — идеальный подарок для близких.",
    ogDesc: "Подарите сеанс массажа. Сертификаты от 500 MDL — идеальный подарок для близких.",
    prodName: "Подарочный сертификат на массаж",
    prodDesc: "Сертификат на сеанс массажа в Mateev Spa Studio, Кишинёв. Доступны номиналы 500, 1000, 1500, 2000 MDL и любая сумма.",
    back: "← На главную",
    kicker: "Подарочные сертификаты",
    heroTitle: "Подарите заботу о теле",
    heroSub: "Сертификат на массаж — подарок который помогает восстановиться, снять напряжение и почувствовать себя лучше. Подходит для любого повода.",
    anySum: "Любая сумма — на ваш выбор",
    anySumSub: "Можем оформить сертификат на любой номинал",
    anySumHint: "Уточните при заказе →",
    howTitle: "Как это работает",
    step1: "Напишите нам — укажите имя получателя и желаемый номинал",
    step2: "Мы оформляем красивый сертификат с уникальным кодом и отправляем вам",
    step3: "Получатель записывается на удобное время и предъявляет код",
    orderTitle: "Заказать сертификат",
    orderSub: "Заполните форму — мы свяжемся для оплаты и оформим сертификат",
    amountLabel: "Сумма (MDL)",
    phRecipient: "Имя получателя (необязательно)",
    phName: "Ваше имя *",
    phPhone: "Ваш телефон *",
    phEmail: "Email (необязательно)",
    phMessage: "Пожелание получателю (необязательно)",
    submit: "Оформить заказ",
    orDirect: "Или напрямую:",
    callWord: "позвонить",
    city: "Кишинёв",
    jsSending: "Отправляем…",
    jsFail: "Не удалось отправить заявку.",
    jsSubmit: "Оформить заказ",
    jsDoneTitle: "Заявка принята!",
    jsDoneText: "Мы свяжемся с вами в ближайшее время — согласуем оплату и оформим сертификат.",
    jsNetErr: "Ошибка сети. Попробуйте ещё раз."
  };
  const otherLang = ro ? "ru" : "ro";

  return `<!DOCTYPE html>
<html lang="${ro ? "ro" : "ru"}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${t.title}</title>
  <meta name="description" content="${t.metaDesc}">
  <link rel="canonical" href="${base}/certificates${ro ? "?lang=ro" : ""}">
  <link rel="alternate" hreflang="ru" href="${base}/certificates">
  <link rel="alternate" hreflang="ro" href="${base}/certificates?lang=ro">
  <meta property="og:title" content="${t.title}">
  <meta property="og:description" content="${t.ogDesc}">
  <meta property="og:url" content="${base}/certificates${ro ? "?lang=ro" : ""}">
  <meta property="og:image" content="${base}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": t.prodName,
    "description": t.prodDesc,
    "brand": { "@type": "Brand", "name": "Mateev Spa Studio" },
    "offers": [500, 1000, 1500, 2000].map(price => ({
      "@type": "Offer",
      "price": price,
      "priceCurrency": "MDL",
      "availability": "https://schema.org/InStock",
      "url": `${base}/certificates`
    }))
  })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Manrope',sans-serif;background:#f7f0e6;color:#241c17;line-height:1.7}
    a{color:#6b8d6b;text-decoration:none}
    .topbar{background:rgba(250,242,233,0.95);border-bottom:1px solid rgba(71,49,28,0.08);padding:16px 0;position:sticky;top:0;z-index:10}
    .topbar__inner{max-width:840px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center}
    .topbar__brand{font-weight:700;font-size:0.9rem;color:#241c17}
    .topbar__right{display:flex;align-items:center;gap:14px}
    .topbar__back{font-size:0.85rem;color:#6b8d6b;font-weight:600}
    .lang-switch{display:inline-flex;gap:2px;border:1px solid rgba(71,49,28,0.15);border-radius:999px;padding:2px;background:rgba(255,255,255,0.6)}
    .lang-switch a{font-size:0.78rem;font-weight:700;padding:4px 10px;border-radius:999px;color:#7d6d60}
    .lang-switch a.is-active{background:#1a2e22;color:#fff}
    .container{max-width:840px;margin:0 auto;padding:0 24px}
    .hero{padding:64px 0 48px;text-align:center}
    .hero__kicker{font-size:0.75rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b36d2c;margin-bottom:12px}
    .hero__title{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,5vw,3.2rem);font-weight:600;color:#1a2e22;margin-bottom:16px;line-height:1.2}
    .hero__subtitle{color:#7d6d60;max-width:520px;margin:0 auto 48px;font-size:0.95rem}
    .amounts{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
    .amount-card{background:rgba(255,255,255,0.7);border:1px solid rgba(71,49,28,0.1);border-radius:20px;padding:28px 20px;text-align:center}
    .amount-card__value{font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;color:#1a2e22}
    .amount-card__label{font-size:0.8rem;color:#7d6d60}
    .amount-custom{display:flex;align-items:center;justify-content:space-between;gap:20px;background:rgba(26,46,34,0.06);border:1.5px dashed rgba(26,46,34,0.25);border-radius:20px;padding:24px 32px;margin-bottom:48px}
    .amount-custom__text{font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:600;color:#1a2e22}
    .amount-custom__sub{font-size:0.85rem;color:#6b8d6b;margin-top:4px}
    .amount-custom__hint{font-size:0.85rem;color:#7d6d60;text-align:right}
    @media(max-width:600px){.amounts{grid-template-columns:repeat(2,1fr)}.amount-custom{flex-direction:column;text-align:center}.amount-custom__hint{text-align:center}}
    .how{background:rgba(255,255,255,0.5);border-radius:24px;padding:40px;margin-bottom:48px}
    .how__title{font-family:'Cormorant Garamond',serif;font-size:1.5rem;color:#1a2e22;margin-bottom:24px}
    .steps{display:grid;gap:16px}
    .step{display:flex;gap:16px;align-items:flex-start}
    .step__num{width:32px;height:32px;border-radius:50%;background:#1a2e22;color:#fff;font-weight:700;font-size:0.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .step__text{padding-top:4px;font-size:0.92rem;color:#3a2e26}
    .cta-block{background:#1a2e22;border-radius:24px;padding:40px;text-align:center;margin-bottom:64px}
    .cta-block__title{font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#fff;margin-bottom:8px}
    .cta-block__sub{color:rgba(255,255,255,0.65);margin-bottom:28px;font-size:0.9rem}
    .cta-btn{display:inline-block;padding:14px 32px;background:#b36d2c;color:#fff;border-radius:12px;font-weight:700;font-size:0.95rem;margin:6px}
    .cta-btn:hover{background:#9a5c22;text-decoration:none}
    .cta-btn--ghost{background:transparent;border:2px solid rgba(255,255,255,0.3);color:#fff}
    .cta-btn--ghost:hover{background:rgba(255,255,255,0.1)}
    footer{padding:24px 0;border-top:1px solid rgba(71,49,28,0.08);text-align:center;font-size:0.8rem;color:#7d6d60}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar__inner">
      <span class="topbar__brand">Mateev Spa Studio</span>
      <div class="topbar__right">
        <span class="lang-switch">
          <a href="/certificates" class="${ro ? "" : "is-active"}">RU</a>
          <a href="/certificates?lang=ro" class="${ro ? "is-active" : ""}">RO</a>
        </span>
        <a href="/${ro ? "?lang=ro" : ""}" class="topbar__back">${t.back}</a>
      </div>
    </div>
  </header>
  <main>
    <div class="container">
      <div class="hero">
        <p class="hero__kicker">${t.kicker}</p>
        <h1 class="hero__title">${t.heroTitle}</h1>
        <p class="hero__subtitle">${t.heroSub}</p>
      </div>

      <div class="amounts">
        <div class="amount-card"><div class="amount-card__value">500 MDL</div></div>
        <div class="amount-card"><div class="amount-card__value">1 000 MDL</div></div>
        <div class="amount-card"><div class="amount-card__value">1 500 MDL</div></div>
        <div class="amount-card"><div class="amount-card__value">2 000 MDL</div></div>
      </div>
      <div class="amount-custom">
        <div>
          <div class="amount-custom__text">${t.anySum}</div>
          <div class="amount-custom__sub">${t.anySumSub}</div>
        </div>
        <div class="amount-custom__hint">${t.anySumHint}</div>
      </div>

      <div class="how">
        <div class="how__title">${t.howTitle}</div>
        <div class="steps">
          <div class="step"><div class="step__num">1</div><div class="step__text">${t.step1}</div></div>
          <div class="step"><div class="step__num">2</div><div class="step__text">${t.step2}</div></div>
          <div class="step"><div class="step__num">3</div><div class="step__text">${t.step3}</div></div>
        </div>
      </div>

      <div class="cta-block" id="orderForm" style="text-align:left;">
        <div class="cta-block__title" style="text-align:center;">${t.orderTitle}</div>
        <div class="cta-block__sub" style="text-align:center;">${t.orderSub}</div>
        <form id="giftForm" style="max-width:440px;margin:24px auto 0;display:grid;gap:14px;">
          <div>
            <label style="display:block;font-size:0.82rem;color:rgba(255,255,255,0.7);margin-bottom:6px;">${t.amountLabel}</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
              ${[500,1000,1500,2000].map(v => `<button type="button" onclick="setAmount(${v})" style="flex:1;min-width:64px;padding:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;font-family:inherit;font-size:0.85rem;font-weight:600;cursor:pointer;">${v}</button>`).join("")}
            </div>
            <input type="number" id="gAmount" min="100" max="100000" step="50" value="1000" required
              style="width:100%;padding:12px 14px;border-radius:10px;border:none;font-family:inherit;font-size:1rem;">
          </div>
          <input type="text" id="gRecipient" placeholder="${t.phRecipient}" style="width:100%;padding:12px 14px;border-radius:10px;border:none;font-family:inherit;font-size:0.95rem;">
          <input type="text" id="gName" placeholder="${t.phName}" required style="width:100%;padding:12px 14px;border-radius:10px;border:none;font-family:inherit;font-size:0.95rem;">
          <input type="tel" id="gPhone" placeholder="${t.phPhone}" required style="width:100%;padding:12px 14px;border-radius:10px;border:none;font-family:inherit;font-size:0.95rem;">
          <input type="email" id="gEmail" placeholder="${t.phEmail}" style="width:100%;padding:12px 14px;border-radius:10px;border:none;font-family:inherit;font-size:0.95rem;">
          <textarea id="gMessage" rows="2" placeholder="${t.phMessage}" style="width:100%;padding:12px 14px;border-radius:10px;border:none;font-family:inherit;font-size:0.95rem;resize:vertical;"></textarea>
          <button type="submit" id="gSubmit" style="padding:14px;background:#b36d2c;color:#fff;border:none;border-radius:12px;font-family:inherit;font-size:0.95rem;font-weight:700;cursor:pointer;">${t.submit}</button>
          <p id="gMsg" style="text-align:center;font-size:0.85rem;margin:0;min-height:1em;"></p>
        </form>
        <p style="text-align:center;font-size:0.82rem;color:rgba(255,255,255,0.55);margin-top:18px;">
          ${t.orDirect} <a href="tel:${escapeHtml(phone)}" style="color:#fff;font-weight:600;">${t.callWord}</a>${telegram ? ` · <a href="https://t.me/${escapeHtml(telegram.replace("@", ""))}" style="color:#fff;font-weight:600;">Telegram</a>` : ""}
        </p>
      </div>
    </div>
  </main>
  <footer><p>© ${new Date().getFullYear()} Mateev Spa Studio · ${t.city}</p></footer>
  <script>
    var T = ${JSON.stringify({ sending: t.jsSending, fail: t.jsFail, submit: t.jsSubmit, doneTitle: t.jsDoneTitle, doneText: t.jsDoneText, netErr: t.jsNetErr })};
    function setAmount(v){ document.getElementById("gAmount").value = v; }
    document.getElementById("giftForm").addEventListener("submit", async function(e){
      e.preventDefault();
      var btn = document.getElementById("gSubmit"), msg = document.getElementById("gMsg");
      var body = {
        amount: document.getElementById("gAmount").value,
        recipient: document.getElementById("gRecipient").value.trim(),
        buyerName: document.getElementById("gName").value.trim(),
        buyerPhone: document.getElementById("gPhone").value.trim(),
        buyerEmail: document.getElementById("gEmail").value.trim(),
        message: document.getElementById("gMessage").value.trim()
      };
      btn.disabled = true; btn.textContent = T.sending; msg.textContent = "";
      try {
        var res = await fetch("/api/gift-certificate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
        var data = await res.json().catch(function(){return {};});
        if (!res.ok) { msg.style.color = "#ffb4a8"; msg.textContent = data.message || T.fail; btn.disabled = false; btn.textContent = T.submit; return; }
        document.getElementById("orderForm").innerHTML = '<div style="text-align:center;padding:24px 8px;"><p style="font-size:2.6rem;margin:0;">🎁</p><h2 style="font-family:\\'Cormorant Garamond\\',serif;color:#fff;font-size:1.7rem;margin:10px 0;">' + T.doneTitle + '</h2><p style="color:rgba(255,255,255,0.75);font-size:0.95rem;">' + T.doneText + '</p></div>';
      } catch (err) { msg.style.color = "#ffb4a8"; msg.textContent = T.netErr; btn.disabled = false; btn.textContent = T.submit; }
    });
  </script>
</body>
</html>`;
}

function parseMarkdown(text) {
  if (!text) return "";
  // HTML escape
  let s = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // Images: ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
    var caption = alt ? '<figcaption style="font-size:0.82rem;color:#7d6d60;margin-top:8px;text-align:center;">' + alt + '</figcaption>' : '';
    return '<figure style="margin:18px 0;text-align:center;page-break-inside:avoid;break-inside:avoid;"><img src="' + src + '" alt="' + alt + '" style="max-width:100%;height:auto;border-radius:12px;display:block;margin:0 auto;">' + caption + '</figure>';
  });
  // Links: [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:#6b8d6b;">$1</a>');
  // Bold+italic: ***text***
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g,'<strong><em>$1</em></strong>');
  // Bold: **text**
  s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  // Italic: *text*
  s = s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');

  // Построчный разбор: заголовки/списки/цитаты/абзацы не требуют пустых строк между собой
  const lines = s.split("\n");
  const out = [];
  let para = [];      // накопленные строки абзаца
  let list = null;    // { type: "ul"|"ol", items: [] }
  let quote = [];     // строки цитаты
  const flushPara = () => { if (para.length) { out.push(`<p style="margin-bottom:16px;">${para.join("<br>")}</p>`); para = []; } };
  const flushList = () => {
    if (list) {
      const tag = list.type;
      out.push(`<${tag} style="padding-left:24px;margin:14px 0;">${list.items.map(i => `<li style="margin-bottom:6px;">${i}</li>`).join("")}</${tag}>`);
      list = null;
    }
  };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote style="border-left:3px solid #b36d2c;padding:12px 20px;margin:20px 0;color:#5a4e45;font-style:italic;">${quote.join("<br>")}</blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushAll(); continue; }
    let m;
    if (line.startsWith("<figure") || line.startsWith("<img") || line.startsWith("<iframe")) { flushAll(); out.push(line); continue; }
    if (line === "---" || line === "***" || line === "___") { flushAll(); out.push('<hr style="border:none;border-top:1px solid rgba(71,49,28,0.15);margin:32px 0;">'); continue; }
    if (line.startsWith("#### ")) { flushAll(); out.push(`<h4 style="font-size:1rem;color:#1a2e22;margin:18px 0 6px;">${line.slice(5)}</h4>`); continue; }
    if (line.startsWith("### ")) { flushAll(); out.push(`<h3 style="font-family:'Georgia',serif;font-weight:600;font-size:1.2rem;color:#6b4a1f;margin:22px 0 8px;">${line.slice(4)}</h3>`); continue; }
    if (line.startsWith("## ")) { flushAll(); out.push(`<h2 style="font-family:'Georgia',serif;font-size:1.5rem;color:#1a2e22;margin:32px 0 10px;">${line.slice(3)}</h2>`); continue; }
    if (line.startsWith("# ")) { flushAll(); out.push(`<h1 style="font-family:'Georgia',serif;font-size:1.9rem;color:#1a2e22;margin:36px 0 12px;">${line.slice(2)}</h1>`); continue; }
    if (line.startsWith("- ") || line.startsWith("* ")) { flushPara(); flushQuote(); if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; } list.items.push(line.slice(2)); continue; }
    if ((m = line.match(/^(\d+)\.\s+(.*)/))) { flushPara(); flushQuote(); if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; } list.items.push(m[2]); continue; }
    if (line.startsWith("&gt; ")) { flushPara(); flushList(); quote.push(line.slice(5)); continue; }
    // обычная строка абзаца
    flushList(); flushQuote(); para.push(line);
  }
  flushAll();
  return out.filter(Boolean).join("\n");
}

function stripMarkdown(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,4} /gm, "")
    .replace(/^- /gm, "")
    .replace(/^> /gm, "")
    .replace(/---/g, "")
    .trim();
}

function renderBlogEntryPage(entry, lang = "ru", related = []) {
  const isRo = lang === "ro" && (entry.titleRo || entry.bodyRo);
  const title = isRo ? (entry.titleRo || entry.title) : entry.title;
  const body = isRo ? (entry.bodyRo || entry.body) : entry.body;
  const locale = isRo ? "ro-RO" : "ru-RU";
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const url = `${base}/blog/${entry.id}`;
  const description = body.replace(/\n/g, " ").slice(0, 160).trim();
  const dateFormatted = new Date(entry.publishedAt + "T00:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "long", year: "numeric"
  });
  const bodyHtml = parseMarkdown(body);

  const GA_ID_entry = process.env.GA_MEASUREMENT_ID || "";
  const gaEntry = GA_ID_entry ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID_entry}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID_entry}');</script>` : "";
  return `<!DOCTYPE html>
<html lang="${isRo ? "ro" : "ru"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Mateev Spa Studio</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Mateev Spa Studio">
  <meta property="og:image" content="${base}/og-image.jpg">
  <meta property="og:locale" content="${isRo ? "ro_RO" : "ru_RU"}">
  <meta property="article:published_time" content="${entry.publishedAt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${base}/og-image.jpg">
  ${gaEntry}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": entry.title,
    "description": description,
    "datePublished": entry.publishedAt,
    "author": { "@type": "Person", "name": "Денис Матиевич" },
    "publisher": { "@type": "Organization", "name": "Mateev Spa Studio", "url": base }
  })}</script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Главная", "item": base },
      { "@type": "ListItem", "position": 2, "name": "Дневник практики", "item": `${base}/blog` },
      { "@type": "ListItem", "position": 3, "name": entry.title, "item": url }
    ]
  })}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Manrope', sans-serif; background: #f7f0e6; color: #241c17; line-height: 1.7; }
    a { color: #6b8d6b; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .topbar { background: rgba(250,242,233,0.95); border-bottom: 1px solid rgba(71,49,28,0.08); padding: 16px 0; position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
    .topbar__inner { max-width: 760px; margin: 0 auto; padding: 0 24px; display: flex; justify-content: space-between; align-items: center; }
    .topbar__brand { font-weight: 700; font-size: 0.9rem; letter-spacing: 0.04em; color: #241c17; }
    .topbar__back { font-size: 0.85rem; color: #6b8d6b; font-weight: 600; }
    .container { max-width: 760px; margin: 0 auto; padding: 0 24px; }
    .article { padding: 56px 0 80px; }
    .article__kicker { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #b36d2c; margin-bottom: 16px; }
    .article__title { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.8rem, 5vw, 2.8rem); font-weight: 600; line-height: 1.2; color: #1a2e22; margin-bottom: 12px; }
    .article__cover { width: 100%; max-height: 420px; object-fit: cover; border-radius: 16px; margin-bottom: 32px; display: block; }
    .article__date { font-size: 0.82rem; color: #7d6d60; font-weight: 500; margin-bottom: 40px; padding-bottom: 32px; border-bottom: 1px solid rgba(71,49,28,0.1); }
    .article__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(71,49,28,0.1); }
    .tag-chip { font-size: 0.78rem; font-weight: 600; padding: 4px 10px; border-radius: 20px; background: rgba(26,46,34,0.07); color: #1a2e22; text-decoration: none; }
    .tag-chip:hover { background: #1a2e22; color: #fff; text-decoration: none; }
    .related { margin-top: 48px; }
    .related__title { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 600; color: #1a2e22; margin-bottom: 16px; }
    .related__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
    .related-card { display: block; background: rgba(255,255,255,0.7); border: 1px solid rgba(71,49,28,0.1); border-radius: 14px; padding: 18px 20px; transition: box-shadow 0.2s; }
    .related-card:hover { box-shadow: 0 6px 20px rgba(36,28,23,0.08); text-decoration: none; }
    .related-card__date { font-size: 0.72rem; color: #7d6d60; margin-bottom: 6px; font-weight: 600; }
    .related-card__title { font-size: 0.92rem; font-weight: 600; color: #1a2e22; line-height: 1.4; }
    .article__body p { margin-bottom: 20px; font-size: 1rem; color: #3a2e26; }
    .article__body p:last-child { margin-bottom: 0; }
    .cta-block { margin-top: 56px; padding: 32px; background: #1a2e22; border-radius: 20px; text-align: center; }
    .cta-block__title { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; color: #fff; margin-bottom: 8px; }
    .cta-block__text { font-size: 0.9rem; color: rgba(255,255,255,0.65); margin-bottom: 24px; }
    .cta-block__btn { display: inline-block; padding: 14px 32px; background: #b36d2c; color: #fff; border-radius: 10px; font-weight: 700; font-size: 0.95rem; }
    .cta-block__btn:hover { background: #9a5d24; text-decoration: none; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 40px; font-size: 0.85rem; color: #6b8d6b; font-weight: 600; }
    footer { padding: 24px 0; border-top: 1px solid rgba(71,49,28,0.08); text-align: center; font-size: 0.8rem; color: #7d6d60; }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar__inner">
      <span class="topbar__brand">Mateev Spa Studio</span>
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="display:flex;gap:4px;">
          <a href="/blog/${entry.id}" style="padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;text-decoration:none;${!isRo ? 'background:#1a2e22;color:#fff;' : 'color:#7d6d60;'}">RU</a>
          <a href="/blog/${entry.id}?lang=ro" style="padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;text-decoration:none;${isRo ? 'background:#1a2e22;color:#fff;' : 'color:#7d6d60;'}${!entry.titleRo ? ';opacity:0.4;pointer-events:none;' : ''}">RO${!entry.titleRo ? ' ·' : ''}</a>
        </div>
        <a href="/${isRo ? '?lang=ro#diary' : '#diary'}" class="topbar__back">← ${isRo ? 'Jurnalul practicii' : 'Дневник практики'}</a>
      </div>
    </div>
  </header>

  <main>
    <div class="container">
      <article class="article">
        <p class="article__kicker">${entry.category ? escapeHtml(entry.category) : (isRo ? 'Jurnalul practicii' : 'Дневник практики')}</p>
        <h1 class="article__title">${escapeHtml(title)}</h1>
        <p class="article__date">${dateFormatted} · Denis Matievici · ${entry.readTime} ${isRo ? 'min citire' : 'мин чтения'}</p>
        ${entry.coverImage ? `<img class="article__cover" src="${escapeHtml(entry.coverImage)}" alt="${escapeHtml(title)}" loading="lazy">` : ""}
        <div class="article__body">${bodyHtml}</div>

        ${(entry.tags||[]).length ? `<div class="article__tags">${(entry.tags||[]).map(tag => `<a href="/blog?cat=${encodeURIComponent(entry.category||'')}&tag=${encodeURIComponent(tag)}" class="tag-chip">#${escapeHtml(tag)}</a>`).join("")}</div>` : ""}

        ${related.length ? `<div class="related">
          <p class="related__title">${isRo ? 'Articole similare' : 'Похожие статьи'}</p>
          <div class="related__grid">
            ${related.map(r => {
              const rTitle = isRo ? (r.titleRo || r.title) : r.title;
              const rDate = new Date(r.publishedAt + "T00:00:00").toLocaleDateString(isRo ? "ro-RO" : "ru-RU", { day: "numeric", month: "long" });
              const langParam = isRo ? "?lang=ro" : "";
              return `<a href="/blog/${escapeHtml(r.id)}${langParam}" class="related-card">
                <div class="related-card__date">${rDate}</div>
                <div class="related-card__title">${escapeHtml(rTitle)}</div>
              </a>`;
            }).join("")}
          </div>
        </div>` : ""}

        <div class="cta-block">
          <p class="cta-block__title">${isRo ? 'Programare la ședință' : 'Записаться на сеанс'}</p>
          <p class="cta-block__text">${isRo ? 'Programare online fără apeluri — alegeți un timp convenabil' : 'Онлайн-запись без звонков — выберите удобное время'}</p>
          <a href="${base}/${isRo ? '?lang=ro#booking' : '#booking'}" class="cta-block__btn">${isRo ? 'Alegeți ora →' : 'Выбрать время →'}</a>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-top:40px;">
          <a href="/blog${isRo ? '?lang=ro' : ''}" class="back-link">← ${isRo ? 'Toate înregistrările' : 'Все записи дневника'}</a>
          <div style="display:flex;gap:10px;">
            <a href="https://wa.me/?text=${encodeURIComponent(title + " — " + url)}"
               target="_blank" rel="noopener"
               style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#25d366;color:#fff;border-radius:10px;font-size:0.85rem;font-weight:600;text-decoration:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.138.566 4.14 1.547 5.876L.057 23.7a.5.5 0 00.633.633l5.824-1.49A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.877 9.877 0 01-5.032-1.381l-.36-.214-3.733.955.972-3.648-.235-.374A9.872 9.872 0 012.1 12C2.1 6.526 6.526 2.1 12 2.1S21.9 6.526 21.9 12 17.474 21.9 12 21.9z"/></svg>
              WhatsApp
            </a>
            <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}"
               target="_blank" rel="noopener"
               style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#229ed9;color:#fff;border-radius:10px;font-size:0.85rem;font-weight:600;text-decoration:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.857l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.702z"/></svg>
              Telegram
            </a>
          </div>
        </div>
      </article>
    </div>
  </main>

  <footer>
    <p>© ${new Date().getFullYear()} Mateev Spa Studio · Кишинёв</p>
  </footer>
</body>
</html>`;
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      if (!request.url) {
        sendText(response, 400, "Bad request");
        return;
      }

      const host = request.headers.host || "localhost";
      const urlObject = new URL(request.url, `http://${host}`);

      if (urlObject.pathname.startsWith("/api/")) {
        await routeApi(request, response, urlObject);
        return;
      }

      if (urlObject.pathname.startsWith("/team/")) {
        const specialistId = urlObject.pathname.replace("/team/", "").replace(/\/$/, "");
        const [rawSpecialists, rawServices, site, diary] = await Promise.all([
          readJson("specialists.json").catch(() => []),
          readJson("services.json").catch(() => []),
          readJson("site.json").catch(() => ({})),
          readJson("diary.json").catch(() => [])
        ]);
        const services = normalizeServices(rawServices);
        const specialist = normalizeSpecialists(rawSpecialists, services).find(
          (s) => s.id === specialistId
        );
        if (!specialist) {
          response.writeHead(302, { Location: "/#specialists" });
          response.end();
          return;
        }
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
        const recentPosts = normalizeDiary(diary)
          .filter((e) => e.published && e.publishedAt <= today)
          .slice(0, 3);
        const teamLang = urlObject.searchParams.get("lang") === "ro" ? "ro" : "ru";
        const html = renderSpecialistPage(specialist, services, site, recentPosts, teamLang);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname.startsWith("/city/")) {
        const slug = decodeURIComponent(urlObject.pathname.replace("/city/", "").replace(/\/$/, "")).toLowerCase();
        const [rawSpecialists, rawServices] = await Promise.all([
          readJson("specialists.json").catch(() => []),
          readJson("services.json").catch(() => [])
        ]);
        const services = normalizeServices(rawServices);
        const inCity = normalizeSpecialists(rawSpecialists, services)
          .filter((s) => s.location && slugifyCity(s.location) === slug);
        if (!inCity.length) {
          response.writeHead(302, { Location: "/#specialists" });
          response.end();
          return;
        }
        const cityLang = urlObject.searchParams.get("lang") === "ro" ? "ro" : "ru";
        const html = renderCityPage(inCity[0].location, inCity, services, cityLang);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/confirm") {
        const bookingId = urlObject.searchParams.get("id") || "";
        const token = urlObject.searchParams.get("token") || "";
        const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");

        if (!bookingId || !verifyClientConfirmToken(bookingId, token)) {
          response.writeHead(302, { Location: `${base}/` });
          response.end();
          return;
        }

        const bookings = await readJson("bookings.json").catch(() => []);
        const idx = bookings.findIndex((b) => b.id === bookingId);

        if (idx === -1) {
          response.writeHead(302, { Location: `${base}/` });
          response.end();
          return;
        }

        const booking = bookings[idx];
        const alreadyConfirmed = booking.status === "confirmed";

        if (booking.status === "new") {
          bookings[idx] = { ...booking, status: "confirmed", confirmedByClientAt: new Date().toISOString() };
          await writeJson("bookings.json", bookings);

          // Telegram notification
          void (async () => {
            try {
              if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
                const ru = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
                const dateLabel = ru.format(new Date(`${booking.date}T12:00:00`));
                await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                  body: {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: `✅ Клиент подтвердил запись\n\n${booking.clientName} · ${booking.serviceName}\n${dateLabel}, ${booking.slot}–${booking.endsAt}`
                  }
                });
              }
            } catch {}
          })();
        }

        const html = renderConfirmSuccessPage(booking, alreadyConfirmed);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/first-visit" || urlObject.pathname === "/first-visit/") {
        const html = renderFirstVisitPage();
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/intake" || urlObject.pathname === "/intake/") {
        const html = renderIntakePage();
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }

      if (urlObject.pathname.startsWith("/medical-card/")) {
        const clientId = urlObject.pathname.replace("/medical-card/", "").replace(/\/$/, "");
        const { clients, bookings, services } = await loadStudioData();
        const profile = clients.find((c) => c.id === clientId);
        if (!profile) { response.writeHead(302, { Location: "/" }); response.end(); return; }
        // Find client name by matching generated ID from bookings
        const allClients = buildAdminClients(bookings, clients);
        const fullClient = allClients.find(c => c.id === clientId);
        const clientName = fullClient?.clientName || profile.medCard?.name || "Клиент";
        const html = renderMedicalCardPage(clientName, profile);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/blog" || urlObject.pathname === "/blog/") {
        const raw = await readJson("diary.json").catch(() => []);
        const site = await readJson("site.json").catch(() => ({}));
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
        const entries = normalizeDiary(raw)
          .filter((e) => e.published && e.publishedAt <= today)
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        const lang = urlObject.searchParams.get("lang") === "ro" ? "ro" : "ru";
        const catFilter = sanitizeText(urlObject.searchParams.get("cat") || "");
        const html = renderBlogListPage(entries, site, lang, catFilter);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/for-studios" || urlObject.pathname === "/for-studios/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(renderSaasLandingPage());
        return;
      }

      if (urlObject.pathname === "/graduates" || urlObject.pathname === "/graduates/") {
        const diplomas = await readJson("diplomas.json").catch(() => []);
        const gradLang = urlObject.searchParams.get("lang") === "ro" ? "ro" : "ru";
        const html = renderGraduatesPage(diplomas, gradLang);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/cert" || urlObject.pathname === "/cert/") {
        const code = (urlObject.searchParams.get("code") || "").toUpperCase();
        const diplomas = await readJson("diplomas.json").catch(() => []);
        const diploma = code ? diplomas.find((d) => (d.code || "").toUpperCase() === code) : null;
        const certSite = await readJson("site.json").catch(() => ({}));
        const html = renderDiplomaCertPage(diploma, !diploma, (certSite.brand && certSite.brand.signature) || "");
        response.writeHead(diploma ? 200 : 404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/seminar" || urlObject.pathname === "/seminar/") {
        const token = urlObject.searchParams.get("token") || "";
        const items = await readJson("materials.json").catch(() => []);
        const material = token ? items.find(m => m.token === token) : null;
        const html = renderMaterialPage(material);
        response.writeHead(material ? 200 : 404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/care" || urlObject.pathname === "/care/") {
        const token = urlObject.searchParams.get("token") || "";
        const items = await readJson("care-notes.json").catch(() => []);
        const note = token ? items.find(m => m.token === token) : null;
        const html = renderCareNotePage(note);
        response.writeHead(note ? 200 : 404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/certificates" || urlObject.pathname === "/certificates/") {
        const site = await readJson("site.json").catch(() => ({}));
        const certLang = urlObject.searchParams.get("lang") === "ro" ? "ro" : "ru";
        const html = renderCertificatesPage(site, certLang);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname.startsWith("/blog/") && urlObject.pathname.endsWith("/og.svg")) {
        const entryId = urlObject.pathname.replace("/blog/", "").replace("/og.svg", "");
        const raw = await readJson("diary.json").catch(() => []);
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
        const entry = normalizeDiary(raw).find((e) => e.id === entryId && e.published && e.publishedAt <= today);
        if (!entry) { sendText(response, 404, "Not found"); return; }
        const title = entry.title.length > 60 ? entry.title.slice(0, 57) + "..." : entry.title;
        const words = title.split(" ");
        const lines = [];
        let line = "";
        words.forEach((w) => {
          if ((line + " " + w).trim().length > 32) { lines.push(line.trim()); line = w; }
          else { line = (line + " " + w).trim(); }
        });
        if (line) lines.push(line);
        const linesSvg = lines.map((l, i) =>
          `<text x="492" y="${200 + i * 68}" font-family="Georgia,serif" font-size="52" font-weight="600" fill="#1a2e22" letter-spacing="-0.5">${escapeHtml(l)}</text>`
        ).join("");
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
          <rect width="1200" height="630" fill="#f7f0e6"/>
          <ellipse cx="0" cy="0" rx="480" ry="380" fill="rgba(201,147,80,0.14)"/>
          <rect x="0" y="0" width="420" height="630" fill="#1a2e22"/>
          <text x="56" y="184" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="rgba(179,109,44,0.9)" letter-spacing="4">ДНЕВНИК ПРАКТИКИ</text>
          <text x="56" y="244" font-family="Georgia,serif" font-size="42" font-weight="600" fill="#fff">Mateev</text>
          <text x="56" y="292" font-family="Georgia,serif" font-size="42" font-weight="600" fill="#fff">Spa Studio</text>
          <line x1="56" y1="324" x2="340" y2="324" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
          <text x="56" y="358" font-family="Arial,sans-serif" font-size="16" fill="rgba(255,255,255,0.55)">Денис Матиевич</text>
          <text x="56" y="380" font-family="Arial,sans-serif" font-size="16" fill="rgba(255,255,255,0.55)">mateevmassage.com</text>
          <text x="492" y="158" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#b36d2c" letter-spacing="3">ЗАМЕТКА</text>
          ${linesSvg}
          <rect x="0" y="618" width="1200" height="12" fill="rgba(179,109,44,0.5)"/>
        </svg>`;
        response.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" });
        response.end(svg);
        return;
      }

      if (urlObject.pathname.startsWith("/blog/")) {
        const entryId = urlObject.pathname.replace("/blog/", "").replace(/\/$/, "");
        const raw = await readJson("diary.json").catch(() => []);
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Chisinau" });
        const entry = normalizeDiary(raw).find(
          (e) => e.id === entryId && e.published && e.publishedAt <= today
        );
        if (!entry) {
          response.writeHead(302, { Location: "/#diary" });
          response.end();
          return;
        }
        const lang = urlObject.searchParams.get("lang") === "ro" ? "ro" : "ru";
        const allEntries = normalizeDiary(raw).filter(e => e.published && e.publishedAt <= today && e.id !== entryId);
        const related = allEntries.filter(e =>
          (entry.category && e.category === entry.category) ||
          (entry.tags?.length && e.tags?.some(t => entry.tags.includes(t)))
        ).slice(0, 3);
        const html = renderBlogEntryPage(entry, lang, related);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/sitemap.xml") {
        const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
        const now = new Date().toISOString().slice(0, 10);
        const [rawDiary, rawSpecialists, rawServices] = await Promise.all([
          readJson("diary.json").catch(() => []),
          readJson("specialists.json").catch(() => []),
          readJson("services.json").catch(() => [])
        ]);
        const services = normalizeServices(rawServices);
        const specialists = normalizeSpecialists(rawSpecialists, services);
        const published = normalizeDiary(rawDiary).filter((e) => e.published && e.publishedAt <= now);
        const blogUrls = published
          .map((e) => `  <url><loc>${base}/blog/${e.id}</loc><lastmod>${e.publishedAt}</lastmod><priority>0.7</priority></url>`)
          .join("\n");
        const teamUrls = specialists
          .map((s) => `  <url><loc>${base}/team/${s.id}</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>`)
          .join("\n");
        const cityUrls = [...new Set(specialists.map((s) => s.location).filter(Boolean).map(slugifyCity))]
          .map((slug) => `  <url><loc>${base}/city/${slug}</loc><lastmod>${now}</lastmod><priority>0.7</priority></url>`)
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>
  <url><loc>${base}/school</loc><lastmod>${now}</lastmod><priority>0.9</priority></url>
  <url><loc>${base}/graduates</loc><lastmod>${now}</lastmod><priority>0.7</priority></url>
  <url><loc>${base}/blog</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>
  <url><loc>${base}/certificates</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>
  <url><loc>${base}/first-visit</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>
${teamUrls}
${cityUrls}
${blogUrls}
</urlset>`;
        response.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" });
        response.end(xml);
        return;
      }

      if (urlObject.pathname === "/robots.txt") {
        const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`);
        return;
      }

      await serveStaticFile(urlObject.pathname, response);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(response, statusCode, {
        message: error.message || "Internal server error."
      });
    }
  });
}

async function start() {
  await ensureDataFiles();

  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Mateev Spa platform is running at http://localhost:${PORT}`);
  });

  function shutdown(signal) {
    console.log(`[${signal}] Shutting down gracefully…`);
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forced exit after 10s timeout.");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  ADMIN_PIN,
  BOOKING_STATUSES,
  buildAdminStats,
  calculateAvailability,
  createDataSnapshot,
  createServer,
  ensureDataFiles,
  withLock
};
