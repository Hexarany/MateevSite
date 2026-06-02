const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PIN = process.env.ADMIN_PIN;
if (!ADMIN_PIN) {
  process.stderr.write("[FATAL] ADMIN_PIN is required. Copy .env.example to .env and set it.\n");
  process.exit(1);
}
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const BACKUP_DIR = path.join(ROOT_DIR, "backups");
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads", "specialists");
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
const BACKUP_RETENTION_PER_FILE = Math.max(3, Number(process.env.BACKUP_RETENTION_PER_FILE) || 30);
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
const HTTP_OUTBOUND_TIMEOUT_MS = Math.max(1000, Number(process.env.HTTP_OUTBOUND_TIMEOUT_MS) || 8000);
const COOKIE_FORCE_SECURE = process.env.COOKIE_SECURE === "true";
const CANCEL_CUTOFF_HOURS = Math.max(0, Number(process.env.CANCEL_CUTOFF_HOURS) || 2);
const SITE_URL = sanitizeEnv(process.env.SITE_URL).replace(/\/$/, "");
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
  "/og-image.svg": "og-image.svg",
  "/founder.png": "founder.png",
  "/mateev_logo.png": "mateev_logo.png",
  "/mateev_logo.jpg": "mateev_logo.jpg",
  "/school": "school.html",
  "/school.html": "school.html",
  "/school.js": "school.js",
  "/styles.css": "styles.css",
  "/script.js": "script.js",
  "/admin.js": "admin.js",
  "/certificate": "certificate.html",
  "/certificate.html": "certificate.html"
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item) => sanitizeText(item))
    .filter((item, index, array) => item && array.indexOf(item) === index);
}

function sanitizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeInteger(value, fallback = 0) {
  return Math.max(0, Math.round(sanitizeNumber(value, fallback)));
}

function sanitizeSlug(value, fallback) {
  const slug = sanitizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function createFallbackId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function buildInitials(name) {
  const parts = sanitizeText(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "MS";
  }

  return parts
    .map((part) => Array.from(part)[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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
      return {
        enabled: m.enabled !== false,
        tagline: sanitizeText(m.tagline, dm.tagline),
        principles: (Array.isArray(m.principles) ? m.principles : dm.principles)
          .slice(0, 6)
          .map((p, i) => ({
            title: sanitizeText(p?.title, dm.principles[i]?.title || ""),
            text: sanitizeText(p?.text, dm.principles[i]?.text || "")
          }))
          .filter((p) => p.title)
      };
    })(),
    translations: input.translations || defaults.translations || {}
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

      return {
        id,
        name: name || `Услуга ${index + 1}`,
        category: category || "Категория",
        duration: sanitizeInteger(service?.duration, 60) || 60,
        price: sanitizeInteger(service?.price, 0),
        description,
        benefits
      };
    })
    .filter(Boolean);
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

      const workDays = (Array.isArray(specialist?.workDays) ? specialist.workDays : [])
        .map((day) => sanitizeInteger(day, -1))
        .filter((day, itemIndex, array) => day >= 0 && day <= 6 && array.indexOf(day) === itemIndex)
        .sort((left, right) => left - right);

      return {
        id,
        name: name || `Специалист ${index + 1}`,
        role: role || "Специалист",
        experience,
        bio,
        specialties,
        workDays: workDays.length ? workDays : [1, 2, 3, 4, 5],
        initials: sanitizeText(specialist?.initials) || buildInitials(name),
        photo: (typeof specialist?.photo === "string" && /^\/uploads\/specialists\/[\w.-]+$/.test(specialist.photo)) ? specialist.photo : null
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
    ["certificates.json", "[]"]
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

async function readJson(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function createTimestampSlug(date = new Date()) {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function pruneBackupFiles(fileStem) {
  try {
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    const matchingFiles = entries
      .filter(
        (entry) => entry.isFile() && entry.name.startsWith(`${fileStem}-`) && entry.name.endsWith(".json")
      )
      .map((entry) => entry.name)
      .sort()
      .reverse();

    await Promise.all(
      matchingFiles
        .slice(BACKUP_RETENTION_PER_FILE)
        .map((fileName) => fs.unlink(path.join(BACKUP_DIR, fileName)).catch(() => undefined))
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function backupExistingFile(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);

  try {
    const fileBuffer = await fs.readFile(fullPath);
    await ensureBackupDir();

    const parsed = path.parse(fileName);
    const backupName = `${parsed.name}-${createTimestampSlug()}${parsed.ext || ".json"}`;
    await fs.writeFile(path.join(BACKUP_DIR, backupName), fileBuffer);
    await pruneBackupFiles(parsed.name);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function writeJson(fileName, value) {
  await backupExistingFile(fileName);
  const fullPath = path.join(DATA_DIR, fileName);
  const tmpPath = `${fullPath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, fullPath);
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
    const fullPath = path.join(ROOT_DIR, "uploads", "specialists", safeName);
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
    sendText(response, 404, "Not found");
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

function isFutureOrToday(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
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

function createAdminSessionToken() {
  const now = Date.now();
  return createSignedToken(
    {
      purpose: "admin-session",
      key: ADMIN_PIN_FINGERPRINT,
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

async function requestJson(urlString, { method = "POST", headers = {}, body } = {}) {
  const urlObject = new URL(urlString);
  const payload = body ? JSON.stringify(body) : "";

  return new Promise((resolve, reject) => {
    const outboundRequest = https.request(
      urlObject,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers
        },
        timeout: HTTP_OUTBOUND_TIMEOUT_MS
      },
      (outboundResponse) => {
        const chunks = [];

        outboundResponse.on("data", (chunk) => {
          chunks.push(chunk);
        });

        outboundResponse.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");

          if (outboundResponse.statusCode && outboundResponse.statusCode >= 400) {
            reject(new Error(raw || `Upstream request failed with status ${outboundResponse.statusCode}`));
            return;
          }

          if (!raw) {
            resolve({});
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ raw });
          }
        });
      }
    );

    outboundRequest.on("timeout", () => {
      outboundRequest.destroy(new Error("Upstream request timed out"));
    });

    outboundRequest.on("error", (error) => {
      reject(error);
    });

    if (payload) {
      outboundRequest.write(payload);
    }

    outboundRequest.end();
  });
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
    booking.notes ? `Комментарий: ${booking.notes}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTelegramNotification(booking) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { channel: "telegram", skipped: true };
  }

  await requestJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    body: {
      chat_id: TELEGRAM_CHAT_ID,
      text: buildBookingNotificationText(booking)
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

async function sendClientConfirmationEmail(booking) {
  if (!RESEND_API_KEY || !EMAIL_FROM || !booking.email) {
    return { channel: "client-email", skipped: true };
  }

  const cancelUrl = SITE_URL
    ? `${SITE_URL}/cancel?ref=${encodeURIComponent(booking.reference)}`
    : null;

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

        ${cancelUrl ? `
        <tr>
          <td style="padding:0 36px 32px;">
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
    cancelUrl ? `\nОтменить запись: ${cancelUrl}` : "",
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

async function notifyBookingCreated(booking) {
  const tasks = [sendTelegramNotification(booking), sendEmailNotification(booking)];
  if (booking.email) tasks.push(sendClientConfirmationEmail(booking));

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Booking notification failed:", result.reason);
    }
  });
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
      makeOutboundRequest({
        hostname: "api.telegram.org",
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: "POST",
        body: { chat_id: TELEGRAM_CHAT_ID, text }
      }).catch((err) => console.error("Cancel telegram notify failed:", err))
    );
  }

  if (RESEND_API_KEY && EMAIL_FROM && EMAIL_NOTIFICATION_RECIPIENTS.length) {
    const html = text.split("\n").map((l) => `<p>${l}</p>`).join("");
    promises.push(
      makeOutboundRequest({
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
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

function phonesMatch(a, b) {
  const na = String(a || "").replace(/\D/g, "");
  const nb = String(b || "").replace(/\D/g, "");
  if (!na || !nb) return false;
  if (na === nb) return true;
  const minLen = Math.min(na.length, nb.length);
  return minLen >= 7 && na.slice(-minLen) === nb.slice(-minLen);
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

function calculateAvailability({ date, service, specialist, bookings }) {
  const dayIndex = getDayIndex(date);
  if (!specialist.workDays.includes(dayIndex)) {
    return {
      slots: [],
      message: "У выбранного специалиста нет приема в этот день."
    };
  }

  const dayConfig = specialist.daySchedules?.[dayIndex];
  const workHours = dayConfig ? { start: dayConfig.start, end: dayConfig.end } : (specialist.workHours || clone(DEFAULT_WORK_HOURS));
  const open = toMinutes(workHours.start);
  const close = toMinutes(workHours.end);
  const specialistBookings = bookings.filter(
    (booking) =>
      booking.date === date &&
      booking.specialistId === specialist.id &&
      booking.status !== "cancelled"
  );

  const slots = [];

  // For today: skip slots that have already started
  const todayString = new Date().toISOString().slice(0, 10);
  const nowMinutes = date === todayString
    ? new Date().getHours() * 60 + new Date().getMinutes()
    : 0;

  for (let current = open; current + service.duration <= close; current += 30) {
    const candidateStart = current;
    const candidateEnd = current + service.duration;

    // Skip past slots for today
    if (candidateStart <= nowMinutes) {
      continue;
    }

    const hasConflict = specialistBookings.some((booking) => {
      const bookingStart = toMinutes(booking.slot);
      const bookingEnd = bookingStart + booking.durationMins;
      return candidateStart < bookingEnd && candidateEnd > bookingStart;
    });

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

function validateBookingPayload(payload, services, specialists) {
  const requiredFields = [
    "serviceId",
    "specialistId",
    "date",
    "slot",
    "clientName",
    "phone"
  ];

  for (const field of requiredFields) {
    if (!payload[field] || typeof payload[field] !== "string") {
      throw new Error("Заполни обязательные поля формы.");
    }
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

  if (!isFutureOrToday(payload.date)) {
    throw new Error("Можно записаться только на сегодняшнюю или будущую дату.");
  }

  const trimmedName = payload.clientName.trim();
  const trimmedPhone = payload.phone.trim();
  const trimmedEmail = (payload.email || "").trim();
  const trimmedNotes = (payload.notes || "").trim();

  if (trimmedName.length < 2) {
    throw new Error("Имя клиента слишком короткое.");
  }

  if (trimmedPhone.replace(/\D/g, "").length < 8) {
    throw new Error("Укажи корректный номер телефона.");
  }

  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error("Email указан в неверном формате.");
  }

  return {
    service,
    specialist,
    cleanPayload: {
      clientName: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      notes: trimmedNotes
    }
  };
}

function createBookingRecord({ payload, cleanPayload, service, specialist }) {
  const startMins = toMinutes(payload.slot);
  const endMins = startMins + service.duration;

  return {
    id: crypto.randomUUID(),
    reference: `MS-${Date.now().toString().slice(-6)}`,
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    notes: cleanPayload.notes
  };
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
        photo: (typeof specialist?.photo === "string" && /^\/uploads\/specialists\/[\w.-]+$/.test(specialist.photo)) ? specialist.photo : null
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
          reason
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

function calculateAvailability({ date, service, specialist, bookings, schedule = { blocks: [] }, excludeBookingId = "" }) {
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

  // Skip past slots for today (timezone-aware: Moldova = Europe/Chisinau)
  const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Chisinau" }));
  const todayString = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,"0")}-${String(nowLocal.getDate()).padStart(2,"0")}`;
  const nowMinutes = date === todayString
    ? nowLocal.getHours() * 60 + nowLocal.getMinutes()
    : 0;

  for (let current = open; current + service.duration <= close; current += SLOT_STEP_MINUTES) {
    const candidateStart = current;
    const candidateEnd = current + service.duration;

    if (candidateStart <= nowMinutes) {
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
    totalPrice: service.price,
    clientName: cleanPayload.clientName,
    phone: cleanPayload.phone,
    email: cleanPayload.email,
    notes: cleanPayload.notes,
    source: meta.source || "public"
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

function createClientProfileId({ clientName = "", phone = "", email = "" }) {
  const fingerprint = [
    sanitizeText(phone).replace(/\D/g, ""),
    sanitizeText(email).toLowerCase(),
    sanitizeText(clientName).toLowerCase()
  ]
    .filter(Boolean)
    .join("|");

  return `client-${crypto.createHash("sha1").update(fingerprint || crypto.randomUUID()).digest("hex").slice(0, 12)}`;
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
        tag: sanitizeText(profile?.tag)
      };
    })
    .filter(Boolean);
}

function normalizePhoneDigits(phone) {
  return sanitizeText(phone).replace(/\D/g, "");
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
        clientName: client.clientName,
        phone: client.phone,
        email: client.email,
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
        history
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
    });
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

async function handleBootstrap(response) {
  const [rawServices, rawSpecialists, rawSite, bookings] = await Promise.all([
    readJson("services.json"),
    readJson("specialists.json"),
    readJson("site.json"),
    readJson("bookings.json")
  ]);

  const services = normalizeServices(rawServices);
  const specialists = normalizeSpecialists(rawSpecialists, services);
  const site = normalizeSiteContent(rawSite);

  sendJson(response, 200, {
    services,
    specialists,
    site,
    meta: {
      existingBookings: bookings.length,
      bookingProtectionToken: createBookingProtectionToken()
    }
  });
}

async function handleAvailability(urlObject, response) {
  const serviceId = urlObject.searchParams.get("serviceId");
  const specialistId = urlObject.searchParams.get("specialistId");
  const date = urlObject.searchParams.get("date");

  if (!serviceId || !specialistId || !date) {
    sendJson(response, 400, {
      message: "Для поиска слотов передай serviceId, specialistId и date."
    });
    return;
  }

  if (!isFutureOrToday(date)) {
    sendJson(response, 400, {
      message: "Нельзя получить доступность для прошедшей даты."
    });
    return;
  }

  const [rawServices, rawSpecialists, bookings] = await Promise.all([
    readJson("services.json"),
    readJson("specialists.json"),
    readJson("bookings.json")
  ]);

  const services = normalizeServices(rawServices);
  const specialists = normalizeSpecialists(rawSpecialists, services);

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

  const availability = calculateAvailability({
    date,
    service,
    specialist,
    bookings
  });

  sendJson(response, 200, availability);
}

async function handleBookingCreate(request, response) {
  const payload = await parseJsonBody(request);
  const [rawServices, rawSpecialists, bookings] = await Promise.all([
    readJson("services.json"),
    readJson("specialists.json"),
    readJson("bookings.json")
  ]);

  const services = normalizeServices(rawServices);
  const specialists = normalizeSpecialists(rawSpecialists, services);

  const { service, specialist, cleanPayload } = validateBookingPayload(
    payload,
    services,
    specialists
  );

  const availability = calculateAvailability({
    date: payload.date,
    service,
    specialist,
    bookings
  });

  const slotStillAvailable = availability.slots.some(
    (slot) => slot.time === payload.slot
  );

  if (!slotStillAvailable) {
    sendJson(response, 409, {
      message: "Это окно уже занято. Обнови слоты и выбери другое время."
    });
    return;
  }

  const booking = createBookingRecord({
    payload,
    cleanPayload,
    service,
    specialist
  });

  const nextBookings = sortBookings([...bookings, booking]);
  await writeJson("bookings.json", nextBookings);
  void notifyBookingCreated(booking);

  sendJson(response, 201, {
    message: "Запись успешно создана.",
    booking,
    meta: {
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
  if (sanitizeEnv(payload.pin) !== ADMIN_PIN) {
    const error = new Error("PIN не подошёл.");
    error.statusCode = 401;
    throw error;
  }

  const sessionToken = createAdminSessionToken();
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

async function handleAdminBookings(request, response) {
  assertAdminPin(request);

  const [bookings, rawSite] = await Promise.all([
    readJson("bookings.json"),
    readJson("site.json")
  ]);
  const site = normalizeSiteContent(rawSite);

  sendJson(response, 200, {
    stats: buildAdminStats(bookings),
    bookings: sortBookings(bookings),
    currency: site.brand.currency
  });
}

async function handleAdminContentUpdate(request, response) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);
  const site = normalizeSiteContent(payload.site);
  const services = normalizeServices(payload.services);
  const specialists = normalizeSpecialists(payload.specialists, services);

  await Promise.all([
    writeJson("site.json", site),
    writeJson("services.json", services),
    writeJson("specialists.json", specialists)
  ]);

  sendJson(response, 200, {
    message: "Контент студии обновлен.",
    site,
    services,
    specialists
  });
}

async function handleBookingStatusUpdate(request, response, bookingId) {
  assertAdminPin(request);

  const payload = await parseJsonBody(request);

  if (!payload.status || !BOOKING_STATUSES.includes(payload.status)) {
    sendJson(response, 400, {
      message: "Передай корректный статус записи."
    });
    return;
  }

  const bookings = await readJson("bookings.json");
  const bookingIndex = bookings.findIndex((booking) => booking.id === bookingId);

  if (bookingIndex === -1) {
    sendJson(response, 404, {
      message: "Запись не найдена."
    });
    return;
  }

  bookings[bookingIndex] = {
    ...bookings[bookingIndex],
    status: payload.status,
    updatedAt: new Date().toISOString()
  };

  const nextBookings = sortBookings(bookings);
  await writeJson("bookings.json", nextBookings);

  sendJson(response, 200, {
    message: "Статус записи обновлен.",
    booking: nextBookings.find((booking) => booking.id === bookingId)
  });
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
    await handleBookingCreate(request, response);
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

  if (request.method === "PUT" && urlObject.pathname === "/api/admin/content") {
    await handleAdminContentUpdate(request, response);
    return;
  }

  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/bookings/")) {
    const bookingId = urlObject.pathname.replace("/api/admin/bookings/", "");
    await handleBookingStatusUpdate(request, response, bookingId);
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      now: new Date().toISOString()
    });
    return;
  }

  sendJson(response, 404, {
    message: "API route not found."
  });
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

  if (!serviceId || !specialistId || !date) {
    sendJson(response, 400, {
      message: "Для поиска слотов передай serviceId, specialistId и date."
    });
    return;
  }

  if (!isFutureOrToday(date)) {
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
    excludeBookingId
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

  const booking = createBookingRecord({
    payload: safePayload,
    cleanPayload,
    service: effectiveService,
    specialist,
    meta: {
      source: "public"
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
      adminMode: true
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
  const availability = calculateAvailability({
    date: safePayload.date,
    service: effectiveService,
    specialist,
    bookings,
    schedule
  });

  if (!availability.slots.some((entry) => entry.time === safePayload.slot)) {
    sendJson(response, 409, {
      message: "Выбранный слот недоступен. Обновите расписание и попробуйте снова."
    });
    return;
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
      message: "Нельзя блокировать интервал, в котором уже есть активная запись."
    });
    return;
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
          reason
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
    tag: sanitizeText(payload.tag)
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
    await handleBookingCreate(request, response);
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/cancel") {
    await handleBookingCancel(request, response);
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

  if (request.method === "GET" && urlObject.pathname === "/api/admin/clients") {
    await handleAdminClients(request, response);
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/admin/day") {
    await handleAdminDay(request, response, urlObject);
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/admin/bookings") {
    await handleAdminBookingCreate(request, response);
    return;
  }

  if (request.method === "POST" && urlObject.pathname === "/api/admin/blocks") {
    await handleAdminBlockCreate(request, response);
    return;
  }

  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/blocks/")) {
    const blockId = urlObject.pathname.replace("/api/admin/blocks/", "");
    await handleAdminBlockDelete(request, response, blockId);
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
    await handleSpecialistScheduleUpdate(request, response, specialistId);
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

  if (request.method === "PUT" && urlObject.pathname === "/api/admin/content") {
    await handleAdminContentUpdate(request, response);
    return;
  }

  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/bookings/")) {
    const bookingId = urlObject.pathname.replace("/api/admin/bookings/", "");
    await handleBookingStatusUpdate(request, response, bookingId);
    return;
  }

  if (request.method === "DELETE" && urlObject.pathname.startsWith("/api/admin/bookings/")) {
    assertAdminPin(request);
    const bookingId = urlObject.pathname.replace("/api/admin/bookings/", "");
    const { bookings } = await loadStudioData();
    const next = bookings.filter(b => b.id !== bookingId);
    if (next.length === bookings.length) { sendJson(response, 404, { message: "Запись не найдена." }); return; }
    await writeJson("bookings.json", next);
    sendJson(response, 200, { ok: true });
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
    const service    = sanitizeText(payload.service || "");
    const specialist = sanitizeText(payload.specialist || "");
    const date       = sanitizeText(payload.date || "");
    if (!name || !phone) { sendJson(response, 400, { message: "Укажите имя и телефон." }); return; }
    void (async () => {
      try {
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          const text = `⏳ Лист ожидания\n\nИмя: ${name}\nТелефон: ${phone}${service ? `\nУслуга: ${service}` : ""}${specialist ? `\nСпециалист: ${specialist}` : ""}${date ? `\nДата: ${date}` : ""}`;
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
    assertAdminPin(request);
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
    const status = allowed.includes(payload.status) ? payload.status : enrollments[idx].status;
    enrollments[idx] = { ...enrollments[idx], status, updatedAt: new Date().toISOString() };
    await writeJson("enrollments.json", enrollments);
    sendJson(response, 200, { ok: true, enrollment: enrollments[idx] });
    return;
  }

  // GET /api/admin/certificates
  if (request.method === "GET" && urlObject.pathname === "/api/admin/certificates") {
    assertAdminPin(request);
    const certs = await readJson("certificates.json");
    sendJson(response, 200, { certificates: certs });
    return;
  }

  // POST /api/admin/certificates - create new certificate
  if (request.method === "POST" && urlObject.pathname === "/api/admin/certificates") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const cert = {
      id: crypto.randomUUID(),
      code: sanitizeText(payload.code || `GC-${Date.now().toString().slice(-6)}`),
      recipient: sanitizeText(payload.recipient || ""),
      procedure: sanitizeText(payload.procedure || ""),
      amount: Math.max(0, parseInt(payload.amount || "0", 10)),
      validityMonths: Math.max(1, parseInt(payload.validityMonths || "12", 10)),
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + parseInt(payload.validityMonths || "12", 10) * 30 * 24 * 3600 * 1000).toISOString(),
      status: "active",
      usedAt: null,
      usedInBooking: null
    };
    const certs = await readJson("certificates.json");
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

  // PATCH /api/admin/certificates/:id - update status
  if (request.method === "PATCH" && urlObject.pathname.startsWith("/api/admin/certificates/")) {
    assertAdminPin(request);
    const certId = urlObject.pathname.replace("/api/admin/certificates/", "");
    const payload = await parseJsonBody(request);
    const certs = await readJson("certificates.json");
    const idx = certs.findIndex(c => c.id === certId);
    if (idx === -1) { sendJson(response, 404, { message: "Сертификат не найден." }); return; }
    const allowed = ["active", "used", "cancelled"];
    if (allowed.includes(payload.status)) certs[idx].status = payload.status;
    await writeJson("certificates.json", certs);
    sendJson(response, 200, { ok: true, certificate: certs[idx] });
    return;
  }

  if (request.method === "GET" && urlObject.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      now: new Date().toISOString()
    });
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

  // GET /api/admin/diary — all entries
  if (request.method === "GET" && urlObject.pathname === "/api/admin/diary") {
    assertAdminPin(request);
    const raw = await readJson("diary.json").catch(() => []);
    const entries = normalizeDiary(raw).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    sendJson(response, 200, { entries });
    return;
  }

  // POST /api/admin/diary — create entry
  if (request.method === "POST" && urlObject.pathname === "/api/admin/diary") {
    assertAdminPin(request);
    const payload = await parseJsonBody(request);
    const entries = normalizeDiary(await readJson("diary.json").catch(() => []));
    const now = new Date().toISOString().slice(0, 7).replace("-", "");
    const newId = `diary-${now}-${String(entries.length + 1).padStart(3, "0")}`;
    const entry = normalizeDiaryEntry({ ...payload, id: newId }, 0);
    await writeJson("diary.json", [entry, ...entries]);
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

  sendJson(response, 404, {
    message: "API route not found."
  });
}

function normalizeDiaryEntry(entry, index) {
  const id = sanitizeText(entry?.id) || `diary-${Date.now()}-${index}`;
  return {
    id,
    title: sanitizeText(entry?.title) || "",
    body: sanitizeText(entry?.body) || "",
    publishedAt: sanitizeText(entry?.publishedAt) || new Date().toISOString().slice(0, 10),
    published: entry?.published !== false
  };
}

function normalizeDiary(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(normalizeDiaryEntry).filter((e) => e.title);
}

function renderBlogEntryPage(entry) {
  const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
  const url = `${base}/blog/${entry.id}`;
  const description = entry.body.replace(/\n/g, " ").slice(0, 160).trim();
  const dateFormatted = new Date(entry.publishedAt + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric"
  });
  const bodyHtml = escapeHtml(entry.body)
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(entry.title)} — Mateev Spa Studio</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(entry.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Mateev Spa Studio">
  <meta property="article:published_time" content="${entry.publishedAt}">
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
    .article__date { font-size: 0.82rem; color: #7d6d60; font-weight: 500; margin-bottom: 40px; padding-bottom: 32px; border-bottom: 1px solid rgba(71,49,28,0.1); }
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
      <a href="/#diary" class="topbar__back">← Дневник практики</a>
    </div>
  </header>

  <main>
    <div class="container">
      <article class="article">
        <p class="article__kicker">Дневник практики</p>
        <h1 class="article__title">${escapeHtml(entry.title)}</h1>
        <p class="article__date">${dateFormatted} · Денис Матиевич</p>
        <div class="article__body">${bodyHtml}</div>

        <div class="cta-block">
          <p class="cta-block__title">Записаться на сеанс</p>
          <p class="cta-block__text">Онлайн-запись без звонков — выберите удобное время</p>
          <a href="${base}/#booking" class="cta-block__btn">Выбрать время →</a>
        </div>

        <a href="/#diary" class="back-link">← Все записи дневника</a>
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
        const html = renderBlogEntryPage(entry);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
        response.end(html);
        return;
      }

      if (urlObject.pathname === "/sitemap.xml") {
        const site = await readJson("site.json").catch(() => ({}));
        const base = (process.env.SITE_URL || "https://mateevmassage.com").replace(/\/$/, "");
        const now = new Date().toISOString().slice(0, 10);
        const raw = await readJson("diary.json").catch(() => []);
        const published = normalizeDiary(raw).filter((e) => e.published && e.publishedAt <= now);
        const blogUrls = published
          .map((e) => `  <url><loc>${base}/blog/${e.id}</loc><lastmod>${e.publishedAt}</lastmod><priority>0.7</priority></url>`)
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>
  <url><loc>${base}/school</loc><lastmod>${now}</lastmod><priority>0.9</priority></url>
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
  ensureDataFiles
};
