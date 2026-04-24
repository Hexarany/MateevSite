const state = {
  adminPin: "",
  adminData: null,
  daySchedule: null,
  clients: [],
  selectedClientId: "",
  services: [],
  specialists: [],
  site: null,
  currency: "MDL",
  filters: {
    status: "all",
    search: ""
  },
  clientFilters: {
    search: ""
  },
  operations: {
    date: getLocalDateString(),
    selectedBookingId: "",
    selectedSpecialistId: "",
    bookingForm: {
      mode: "create",
      id: "",
      serviceId: "",
      specialistId: "",
      date: getLocalDateString(),
      slot: "",
      status: "confirmed",
      clientName: "",
      phone: "",
      email: "",
      notes: ""
    },
    blockForm: {
      specialistId: "",
      date: getLocalDateString(),
      start: "13:00",
      end: "14:00",
      reason: ""
    },
    scheduleForm: {
      specialistId: "",
      workDays: [1, 2, 3, 4, 5],
      workStart: "09:00",
      workEnd: "20:00",
      breaks: [
        { start: "13:00", end: "14:00", label: "Перерыв" }
      ]
    }
  }
};

const statusLabels = {
  new: "Новая",
  confirmed: "Подтверждена",
  completed: "Завершена",
  cancelled: "Отменена"
};

const clientStatusLabels = {
  new: "Новый",
  regular: "Постоянный",
  vip: "VIP",
  attention: "Нужен контакт"
};

const weekdayLabels = [
  { value: 0, label: "Вс" },
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" }
];

const siteListFactories = {
  "hero.badges": () => "",
  "hero.stats": () => ({ value: "", label: "" }),
  "hero.asideTags": () => "",
  overview: () => ({ title: "", text: "" }),
  process: () => ({ title: "", text: "" }),
  reviews: () => ({ author: "", meta: "", text: "" }),
  faq: () => ({ question: "", answer: "" })
};

let revealObserver;

const elements = {
  adminBrandName: document.getElementById("adminBrandName"),
  adminStudioMeta: document.getElementById("adminStudioMeta"),
  adminSidebarSummary: document.getElementById("adminSidebarSummary"),
  adminCurrentDate: document.getElementById("adminCurrentDate"),
  adminHeroMeta: document.getElementById("adminHeroMeta"),
  adminFooterContacts: document.getElementById("adminFooterContacts"),
  adminPin: document.getElementById("adminPin"),
  adminLoginBtn: document.getElementById("adminLoginBtn"),
  adminLogoutBtn: document.getElementById("adminLogoutBtn"),
  adminGateMessage: document.getElementById("adminGateMessage"),
  adminPanel: document.getElementById("adminPanel"),
  adminStats: document.getElementById("adminStats"),
  todayTimeline: document.getElementById("todayTimeline"),
  upcomingQueue: document.getElementById("upcomingQueue"),
  clientSearch: document.getElementById("clientSearch"),
  clientsList: document.getElementById("clientsList"),
  clientDetail: document.getElementById("clientDetail"),
  specialistLoad: document.getElementById("specialistLoad"),
  serviceBoard: document.getElementById("serviceBoard"),
  pipelineBoard: document.getElementById("pipelineBoard"),
  attentionBoard: document.getElementById("attentionBoard"),
  scheduleDateInput: document.getElementById("scheduleDateInput"),
  schedulePrevBtn: document.getElementById("schedulePrevBtn"),
  scheduleTodayBtn: document.getElementById("scheduleTodayBtn"),
  scheduleNextBtn: document.getElementById("scheduleNextBtn"),
  scheduleRefreshBtn: document.getElementById("scheduleRefreshBtn"),
  scheduleSummary: document.getElementById("scheduleSummary"),
  scheduleBoard: document.getElementById("scheduleBoard"),
  adminBookingForm: document.getElementById("adminBookingForm"),
  bookingFormMode: document.getElementById("bookingFormMode"),
  bookingReference: document.getElementById("bookingReference"),
  adminBookingService: document.getElementById("adminBookingService"),
  adminBookingSpecialist: document.getElementById("adminBookingSpecialist"),
  adminBookingDate: document.getElementById("adminBookingDate"),
  adminBookingSlot: document.getElementById("adminBookingSlot"),
  adminBookingStatus: document.getElementById("adminBookingStatus"),
  adminBookingClientName: document.getElementById("adminBookingClientName"),
  adminBookingPhone: document.getElementById("adminBookingPhone"),
  adminBookingEmail: document.getElementById("adminBookingEmail"),
  adminBookingNotes: document.getElementById("adminBookingNotes"),
  adminBookingResetBtn: document.getElementById("adminBookingResetBtn"),
  adminBookingCancelBtn: document.getElementById("adminBookingCancelBtn"),
  adminBlockForm: document.getElementById("adminBlockForm"),
  adminBlockSpecialist: document.getElementById("adminBlockSpecialist"),
  adminBlockDate: document.getElementById("adminBlockDate"),
  adminBlockStart: document.getElementById("adminBlockStart"),
  adminBlockEnd: document.getElementById("adminBlockEnd"),
  adminBlockReason: document.getElementById("adminBlockReason"),
  specialistScheduleForm: document.getElementById("specialistScheduleForm"),
  scheduleSpecialistSelect: document.getElementById("scheduleSpecialistSelect"),
  scheduleWorkStart: document.getElementById("scheduleWorkStart"),
  scheduleWorkEnd: document.getElementById("scheduleWorkEnd"),
  scheduleWorkDays: document.getElementById("scheduleWorkDays"),
  scheduleBreaks: document.getElementById("scheduleBreaks"),
  addBreakBtn: document.getElementById("addBreakBtn"),
  adminTableBody: document.getElementById("adminTableBody"),
  statusFilter: document.getElementById("statusFilter"),
  bookingSearch: document.getElementById("bookingSearch"),
  siteContentEditor: document.getElementById("siteContentEditor"),
  servicesEditor: document.getElementById("servicesEditor"),
  specialistsEditor: document.getElementById("specialistsEditor"),
  saveSiteContentBtn: document.getElementById("saveSiteContentBtn"),
  saveServicesBtn: document.getElementById("saveServicesBtn"),
  saveSpecialistsBtn: document.getElementById("saveSpecialistsBtn"),
  addServiceBtn: document.getElementById("addServiceBtn"),
  addSpecialistBtn: document.getElementById("addSpecialistBtn"),
  toastStack: document.getElementById("toastStack"),
  exportCsvBtn: document.getElementById("exportCsvBtn")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  initRevealObserver();
  initNavHighlight();
  renderCurrentDate();

  try {
    await loadBootstrap();
    await tryAutoLoginFromSession();
  } catch (error) {
    showToast(error.message || "Не удалось загрузить данные студии.", "error");
  }
}

function bindEvents() {
  elements.adminLoginBtn.addEventListener("click", handleAdminLogin);
  elements.adminLogoutBtn.addEventListener("click", handleAdminLogout);
  elements.statusFilter.addEventListener("change", () => {
    state.filters.status = elements.statusFilter.value;
    renderAdminTable();
  });
  elements.bookingSearch.addEventListener("input", () => {
    state.filters.search = elements.bookingSearch.value.trim().toLowerCase();
    renderAdminTable();
  });
  elements.clientSearch.addEventListener("input", () => {
    state.clientFilters.search = elements.clientSearch.value.trim().toLowerCase();
    renderClientsWorkspace();
  });
  elements.adminTableBody.addEventListener("change", handleAdminStatusChange);
  elements.clientsList.addEventListener("click", handleClientListClick);
  elements.clientDetail.addEventListener("submit", handleClientProfileSubmit);
  elements.saveSiteContentBtn.addEventListener("click", () => handleContentSave("site"));
  elements.saveServicesBtn.addEventListener("click", () => handleContentSave("services"));
  elements.saveSpecialistsBtn.addEventListener("click", () => handleContentSave("specialists"));
  elements.addServiceBtn.addEventListener("click", handleAddService);
  elements.addSpecialistBtn.addEventListener("click", handleAddSpecialist);
  elements.siteContentEditor.addEventListener("input", handleSiteEditorInput);
  elements.siteContentEditor.addEventListener("click", handleSiteEditorClick);
  elements.servicesEditor.addEventListener("input", handleServiceEditorInput);
  elements.servicesEditor.addEventListener("click", handleServiceEditorClick);
  elements.specialistsEditor.addEventListener("input", handleSpecialistEditorInput);
  elements.specialistsEditor.addEventListener("click", handleSpecialistEditorClick);
  elements.specialistsEditor.addEventListener("change", handleSpecialistEditorChange);
  elements.adminTableBody.addEventListener("click", handleAdminTableClick);
  elements.scheduleDateInput.addEventListener("change", handleScheduleDateChange);
  elements.schedulePrevBtn.addEventListener("click", () => shiftScheduleDate(-1));
  elements.scheduleTodayBtn.addEventListener("click", handleScheduleToday);
  elements.scheduleNextBtn.addEventListener("click", () => shiftScheduleDate(1));
  elements.scheduleRefreshBtn.addEventListener("click", loadDaySchedule);
  elements.adminBookingForm.addEventListener("submit", handleAdminBookingSubmit);
  elements.adminBookingResetBtn.addEventListener("click", resetAdminBookingForm);
  elements.adminBookingCancelBtn.addEventListener("click", handleAdminBookingCancel);
  elements.adminBookingService.addEventListener("change", handleBookingServiceOrSpecialistChange);
  elements.adminBookingSpecialist.addEventListener("change", handleBookingServiceOrSpecialistChange);
  elements.adminBookingDate.addEventListener("change", handleBookingServiceOrSpecialistChange);
  elements.scheduleBoard.addEventListener("click", handleScheduleBoardClick);
  elements.adminBlockForm.addEventListener("submit", handleAdminBlockSubmit);
  elements.scheduleSpecialistSelect.addEventListener("change", handleScheduleSpecialistSelect);
  elements.specialistScheduleForm.addEventListener("submit", handleSpecialistScheduleSubmit);
  elements.addBreakBtn.addEventListener("click", handleAddScheduleBreak);
  elements.scheduleBreaks.addEventListener("click", handleScheduleBreakClick);
  elements.scheduleBreaks.addEventListener("input", handleScheduleBreakInput);

  elements.adminPin.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdminLogin();
    }
  });

  elements.exportCsvBtn.addEventListener("click", handleExportCsv);
}

async function loadBootstrap() {
  const payload = await fetchJson("/api/bootstrap");
  state.services = payload.services;
  state.specialists = payload.specialists;
  state.site = payload.site;
  state.currency = payload.site?.brand?.currency || "MDL";

  renderStudioShell(payload.meta?.existingBookings || 0);
  renderContentManagement();
  syncRevealTargets();
}

function renderStudioShell(existingBookings) {
  if (!state.site) {
    return;
  }

  const { brand } = state.site;

  elements.adminBrandName.textContent = brand.name;
  elements.adminHeroMeta.innerHTML = [
    `${state.services.length} процедур`,
    `${state.specialists.length} специалистов`,
    `${existingBookings} записей в системе`
  ]
    .map((item) => `<span class="meta-chip">${escapeHtml(item)}</span>`)
    .join("");

  elements.adminStudioMeta.innerHTML = `
    <div class="admin-mini-card">
      <span>Телефон</span>
      <strong>${escapeHtml(brand.phone)}</strong>
    </div>
    <div class="admin-mini-card">
      <span>Email</span>
      <strong>${escapeHtml(brand.email)}</strong>
    </div>
    <div class="admin-mini-card">
      <span>Адрес</span>
      <strong>${escapeHtml(brand.city)}, ${escapeHtml(brand.address)}</strong>
    </div>
    <div class="admin-mini-card">
      <span>График</span>
      <strong>${escapeHtml(brand.hours)}</strong>
    </div>
  `;

  elements.adminSidebarSummary.innerHTML = `
    <div class="admin-summary-card">
      <span>Каталог</span>
      <strong>${state.services.length}</strong>
      <small>активных услуг</small>
    </div>
    <div class="admin-summary-card">
      <span>Команда</span>
      <strong>${state.specialists.length}</strong>
      <small>специалистов в системе</small>
    </div>
    <div class="admin-summary-card">
      <span>Статус</span>
      <strong>Готово</strong>
      <small>admin route разведен отдельно</small>
    </div>
  `;

  elements.adminFooterContacts.innerHTML = `
    <div class="footer-contact">
      <strong>Телефон</strong>
      <span>${escapeHtml(brand.phone)}</span>
    </div>
    <div class="footer-contact">
      <strong>Email</strong>
      <span>${escapeHtml(brand.email)}</span>
    </div>
    <div class="footer-contact">
      <strong>Адрес</strong>
      <span>${escapeHtml(brand.city)}, ${escapeHtml(brand.address)}</span>
    </div>
    <div class="footer-contact">
      <strong>График</strong>
      <span>${escapeHtml(brand.hours)}</span>
    </div>
  `;
}

function renderContentManagement() {
  if (!state.site) {
    return;
  }

  elements.siteContentEditor.innerHTML = renderSiteContentEditor();
  elements.servicesEditor.innerHTML = renderServicesEditor();
  elements.specialistsEditor.innerHTML = renderSpecialistsEditor();
}

function renderSiteContentEditor() {
  const site = state.site;

  return `
    <div class="admin-editor-grid">
      ${renderEditorCard(
        "Контакты студии",
        "Телефон, email, адрес, график и прочие данные, которые видит клиент.",
        `<div class="field-grid">
          ${renderSiteField("Название бренда", "brand.name", site.brand?.name || "")}
          ${renderSiteField("Город", "brand.city", site.brand?.city || "")}
          ${renderSiteField("Адрес", "brand.address", site.brand?.address || "")}
          ${renderSiteField("Телефон", "brand.phone", site.brand?.phone || "")}
          ${renderSiteField("Email", "brand.email", site.brand?.email || "")}
          ${renderSiteField("Telegram", "brand.telegram", site.brand?.telegram || "")}
          ${renderSiteField("График", "brand.hours", site.brand?.hours || "")}
          ${renderSiteField("Валюта", "brand.currency", site.brand?.currency || "")}
        </div>`
      )}
      ${renderEditorCard(
        "SEO и бренд",
        "Вкладка браузера, строка над логотипом и общий слоган студии.",
        [
          renderSiteField("SEO title", "seo.title", site.seo?.title || ""),
          renderSiteField("SEO description", "seo.description", site.seo?.description || "", { multiline: true, rows: 4 }),
          renderSiteField("Строка над логотипом", "brand.eyebrow", site.brand?.eyebrow || ""),
          renderSiteField("Теглайн в footer", "brand.tagline", site.brand?.tagline || "", { multiline: true, rows: 3 })
        ].join("")
      )}
      ${renderEditorCard(
        "Навигация и hero",
        "Навигационные подписи, главный экран и CTA-кнопки.",
        [
          renderFieldGroup("Пункты меню", [
            renderSiteField("Пункт 1", "navigation.overview", site.navigation?.overview || ""),
            renderSiteField("Пункт 2", "navigation.services", site.navigation?.services || ""),
            renderSiteField("Пункт 3", "navigation.specialists", site.navigation?.specialists || ""),
            renderSiteField("Пункт 4", "navigation.booking", site.navigation?.booking || "")
          ].join("")),
          renderSiteField("Kicker hero", "hero.kicker", site.hero?.kicker || "", { full: true }),
          renderSiteField("Заголовок hero", "hero.title", site.hero?.title || "", { multiline: true, rows: 3 }),
          renderSiteField("Подзаголовок hero", "hero.subtitle", site.hero?.subtitle || "", { multiline: true, rows: 3 }),
          renderFieldGroup("Кнопки hero", [
            renderSiteField("CTA 1", "hero.primaryCta", site.hero?.primaryCta || ""),
            renderSiteField("CTA 2", "hero.secondaryCta", site.hero?.secondaryCta || "")
          ].join(""))
        ].join("")
      )}
      ${renderEditorCard(
        "Правая колонка hero",
        "Небольшой продающий блок справа в первом экране.",
        [
          renderSiteField("Eyebrow блока", "hero.asideEyebrow", site.hero?.asideEyebrow || ""),
          renderSiteField("Заголовок блока", "hero.asideTitle", site.hero?.asideTitle || "", { multiline: true, rows: 4 })
        ].join("")
      )}
      ${renderEditorCard(
        "Заголовки секций",
        "Тексты над каталогом, командой, процессом и отзывами.",
        [
          renderSectionGroup("overview", "Почему мы", site.sections?.overview),
          renderSectionGroup("services", "Процедуры", site.sections?.services),
          renderSectionGroup("specialists", "Команда", site.sections?.specialists),
          renderSectionGroup("process", "Как это работает", site.sections?.process),
          renderSectionGroup("reviews", "Отзывы и FAQ", site.sections?.reviews)
        ].join("")
      )}
      ${renderEditorCard(
        "Блок записи",
        "Заголовок секции записи, подписи формы и правой колонки.",
        [
          renderSectionGroup("booking", "Секция записи", site.sections?.booking, true),
          renderFieldGroup("Подписи полей", [
            renderSiteField("Процедура", "bookingForm.serviceLabel", site.bookingForm?.serviceLabel || ""),
            renderSiteField("Специалист", "bookingForm.specialistLabel", site.bookingForm?.specialistLabel || ""),
            renderSiteField("Дата", "bookingForm.dateLabel", site.bookingForm?.dateLabel || ""),
            renderSiteField("Слоты", "bookingForm.slotsLabel", site.bookingForm?.slotsLabel || ""),
            renderSiteField("Имя", "bookingForm.nameLabel", site.bookingForm?.nameLabel || ""),
            renderSiteField("Placeholder имени", "bookingForm.namePlaceholder", site.bookingForm?.namePlaceholder || ""),
            renderSiteField("Телефон", "bookingForm.phoneLabel", site.bookingForm?.phoneLabel || ""),
            renderSiteField("Placeholder телефона", "bookingForm.phonePlaceholder", site.bookingForm?.phonePlaceholder || ""),
            renderSiteField("Email", "bookingForm.emailLabel", site.bookingForm?.emailLabel || ""),
            renderSiteField("Placeholder email", "bookingForm.emailPlaceholder", site.bookingForm?.emailPlaceholder || ""),
            renderSiteField("Комментарий", "bookingForm.notesLabel", site.bookingForm?.notesLabel || ""),
            renderSiteField("Placeholder комментария", "bookingForm.notesPlaceholder", site.bookingForm?.notesPlaceholder || ""),
            renderSiteField("Кнопка отправки", "bookingForm.submitLabel", site.bookingForm?.submitLabel || "")
          ].join(""))
        ].join("")
      )}
      ${renderEditorCard(
        "Footer",
        "Нижний блок сайта и короткое описание студии.",
        [
          renderSiteField("Eyebrow", "sections.footer.eyebrow", site.sections?.footer?.eyebrow || ""),
          renderSiteField("Текст", "sections.footer.copy", site.sections?.footer?.copy || "", { multiline: true, rows: 4 })
        ].join("")
      )}
      ${renderEditorCard(
        "UI и CTA",
        "Кнопки, подписи карточек и лейблы.",
        [
          renderFieldGroup("Кнопки и префиксы", [
            renderSiteField("Кнопка услуги", "ui.serviceCardCta", site.ui?.serviceCardCta || ""),
            renderSiteField("Кнопка специалиста", "ui.specialistCardCta", site.ui?.specialistCardCta || ""),
            renderSiteField("Префикс преимуществ", "ui.featurePrefix", site.ui?.featurePrefix || ""),
            renderSiteField("Префикс шагов", "ui.processPrefix", site.ui?.processPrefix || "")
          ].join("")),
          renderFieldGroup("Лейблы контактов", [
            renderSiteField("Адрес", "ui.contactAddressLabel", site.ui?.contactAddressLabel || ""),
            renderSiteField("Телефон", "ui.contactPhoneLabel", site.ui?.contactPhoneLabel || ""),
            renderSiteField("Email", "ui.contactEmailLabel", site.ui?.contactEmailLabel || ""),
            renderSiteField("График", "ui.contactHoursLabel", site.ui?.contactHoursLabel || "")
          ].join("")),
          renderFieldGroup("Лейблы footer", [
            renderSiteField("Телефон", "ui.footerPhoneLabel", site.ui?.footerPhoneLabel || ""),
            renderSiteField("Email", "ui.footerEmailLabel", site.ui?.footerEmailLabel || ""),
            renderSiteField("Адрес", "ui.footerAddressLabel", site.ui?.footerAddressLabel || ""),
            renderSiteField("Telegram", "ui.footerTelegramLabel", site.ui?.footerTelegramLabel || "")
          ].join("")),
          renderFieldGroup("Резюме записи", [
            renderSiteField("Процедура", "ui.summaryServiceLabel", site.ui?.summaryServiceLabel || ""),
            renderSiteField("Специалист", "ui.summarySpecialistLabel", site.ui?.summarySpecialistLabel || ""),
            renderSiteField("Дата", "ui.summaryDateLabel", site.ui?.summaryDateLabel || ""),
            renderSiteField("Время", "ui.summaryTimeLabel", site.ui?.summaryTimeLabel || ""),
            renderSiteField("Стоимость", "ui.summaryPriceLabel", site.ui?.summaryPriceLabel || ""),
            renderSiteField("Клиент", "ui.summaryClientLabel", site.ui?.summaryClientLabel || ""),
            renderSiteField("Контакт", "ui.summaryContactLabel", site.ui?.summaryContactLabel || "")
          ].join(""))
        ].join("")
      )}
    </div>
    <div class="admin-editor-stack">
      ${renderStringListEditor("Бейджи hero", "hero.badges", site.hero?.badges || [], "Добавить бейдж", "Новый бейдж")}
      ${renderObjectListEditor(
        "Статистика hero",
        "hero.stats",
        site.hero?.stats || [],
        [
          { key: "value", label: "Значение" },
          { key: "label", label: "Подпись" }
        ],
        "Добавить показатель"
      )}
      ${renderStringListEditor("Теги в hero справа", "hero.asideTags", site.hero?.asideTags || [], "Добавить тег", "Новый тег")}
      ${renderObjectListEditor(
        "Карточки преимуществ",
        "overview",
        site.overview || [],
        [
          { key: "title", label: "Заголовок" },
          { key: "text", label: "Описание", multiline: true, rows: 4 }
        ],
        "Добавить преимущество"
      )}
      ${renderObjectListEditor(
        "Шаги процесса",
        "process",
        site.process || [],
        [
          { key: "title", label: "Заголовок" },
          { key: "text", label: "Описание", multiline: true, rows: 4 }
        ],
        "Добавить шаг"
      )}
      ${renderObjectListEditor(
        "Отзывы",
        "reviews",
        site.reviews || [],
        [
          { key: "author", label: "Автор" },
          { key: "meta", label: "Подпись" },
          { key: "text", label: "Текст", multiline: true, rows: 4 }
        ],
        "Добавить отзыв"
      )}
      ${renderObjectListEditor(
        "FAQ",
        "faq",
        site.faq || [],
        [
          { key: "question", label: "Вопрос", multiline: true, rows: 3 },
          { key: "answer", label: "Ответ", multiline: true, rows: 4 }
        ],
        "Добавить вопрос"
      )}
    </div>
  `;
}

function renderServicesEditor() {
  if (!state.services.length) {
    return '<div class="admin-empty-editor">Каталог пуст. Добавьте первую услугу.</div>';
  }

  return `
    <div class="admin-editor-stack">
      ${state.services
        .map(
          (service, index) => `
            <article class="admin-entry-card">
              <div class="admin-entry-card__head">
                <div>
                  <h4 class="admin-entry-card__title">${escapeHtml(service.name || `Услуга ${index + 1}`)}</h4>
                  <p class="admin-entry-card__copy">ID: ${escapeHtml(service.id)}</p>
                </div>
                <button type="button" class="button button--ghost" data-remove-service-index="${index}">Удалить</button>
              </div>
              <div class="admin-entry-card__grid">
                ${renderCollectionField("Название", index, "name", service.name || "", "service")}
                ${renderCollectionField("Категория", index, "category", service.category || "", "service")}
                ${renderCollectionField("Длительность, мин", index, "duration", service.duration || 60, "service", { type: "number", min: "30", step: "15" })}
                ${renderCollectionField("Цена", index, "price", service.price || 0, "service", { type: "number", min: "0", step: "10" })}
                ${renderCollectionField("Описание", index, "description", service.description || "", "service", { multiline: true, rows: 4 })}
                ${renderCollectionField("Преимущества, по одному на строку", index, "benefits", (service.benefits || []).join("\n"), "service", { multiline: true, rows: 5 })}
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSpecialistsEditor() {
  if (!state.specialists.length) {
    return '<div class="admin-empty-editor">Команда пока пуста. Добавьте первого специалиста.</div>';
  }

  return `
    <div class="admin-editor-stack">
      ${state.specialists
        .map(
          (specialist, index) => `
            <article class="admin-entry-card">
              <div class="admin-entry-card__head">
                <div>
                  <h4 class="admin-entry-card__title">${escapeHtml(specialist.name || `Специалист ${index + 1}`)}</h4>
                  <p class="admin-entry-card__copy">ID: ${escapeHtml(specialist.id)}</p>
                </div>
                <button type="button" class="button button--ghost" data-remove-specialist-index="${index}">Удалить</button>
              </div>
              <div class="admin-entry-card__grid">
                ${renderCollectionField("Имя", index, "name", specialist.name || "", "specialist")}
                ${renderCollectionField("Роль", index, "role", specialist.role || "", "specialist")}
                ${renderCollectionField("Опыт", index, "experience", specialist.experience || "", "specialist")}
                ${renderCollectionField("Инициалы", index, "initials", specialist.initials || "", "specialist")}
                ${renderCollectionField("Bio", index, "bio", specialist.bio || "", "specialist", { multiline: true, rows: 5 })}
                <div class="field field--full">
                  <span>Услуги специалиста</span>
                  <div class="admin-check-grid admin-check-grid--services">
                    ${state.services
                      .map(
                        (service) => `
                          <label class="admin-check-option">
                            <input
                              type="checkbox"
                              data-specialist-array-field="specialties"
                              data-specialist-index="${index}"
                              value="${escapeHtml(service.id)}"
                              ${specialist.specialties?.includes(service.id) ? "checked" : ""}
                            >
                            <span>${escapeHtml(service.name)}</span>
                          </label>
                        `
                      )
                      .join("") || '<div class="admin-empty-editor">Сначала создайте услуги.</div>'}
                  </div>
                </div>
                <div class="field field--full">
                  <span>Дни работы</span>
                  <div class="admin-check-grid admin-check-grid--days">
                    ${weekdayLabels
                      .map(
                        (day) => `
                          <label class="admin-check-option">
                            <input
                              type="checkbox"
                              data-specialist-array-field="workDays"
                              data-specialist-index="${index}"
                              value="${day.value}"
                              ${specialist.workDays?.includes(day.value) ? "checked" : ""}
                            >
                            <span>${escapeHtml(day.label)}</span>
                          </label>
                        `
                      )
                      .join("")}
                  </div>
                </div>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function handleSiteEditorInput(event) {
  const target = event.target;

  if (target.dataset.sitePath) {
    setByPath(state.site, target.dataset.sitePath, target.value);
    return;
  }

  if (target.dataset.siteListPath) {
    const list = getByPath(state.site, target.dataset.siteListPath);
    const index = Number(target.dataset.index);
    if (Array.isArray(list) && Number.isInteger(index) && index >= 0) {
      list[index] = target.value;
    }
    return;
  }

  if (target.dataset.siteListFieldPath) {
    const list = getByPath(state.site, target.dataset.siteListFieldPath);
    const index = Number(target.dataset.index);
    const field = target.dataset.field;

    if (Array.isArray(list) && list[index] && field) {
      list[index][field] = target.value;
    }
  }
}

function handleSiteEditorClick(event) {
  const addButton = event.target.closest("[data-add-site-list]");
  if (addButton) {
    const path = addButton.dataset.addSiteList;
    const list = getByPath(state.site, path);
    if (Array.isArray(list) && siteListFactories[path]) {
      list.push(siteListFactories[path]());
      elements.siteContentEditor.innerHTML = renderSiteContentEditor();
    }
    return;
  }

  const removeButton = event.target.closest("[data-remove-site-list-item]");
  if (removeButton) {
    const path = removeButton.dataset.removeSiteListItem;
    const index = Number(removeButton.dataset.index);
    const list = getByPath(state.site, path);
    if (Array.isArray(list) && Number.isInteger(index)) {
      list.splice(index, 1);
      elements.siteContentEditor.innerHTML = renderSiteContentEditor();
    }
  }
}

function handleAddService() {
  state.services.push({
    id: createDraftId("service"),
    name: "",
    category: "",
    duration: 60,
    price: 0,
    description: "",
    benefits: []
  });
  elements.servicesEditor.innerHTML = renderServicesEditor();
  elements.specialistsEditor.innerHTML = renderSpecialistsEditor();
}

function handleServiceEditorInput(event) {
  const target = event.target;
  const index = Number(target.dataset.serviceIndex);
  const field = target.dataset.serviceField;

  if (!Number.isInteger(index) || index < 0 || !field || !state.services[index]) {
    return;
  }

  if (field === "benefits") {
    state.services[index][field] = splitLines(target.value);
  } else if (field === "duration" || field === "price") {
    state.services[index][field] = Number(target.value || 0);
  } else {
    state.services[index][field] = target.value;
  }

  if (field === "name") {
    elements.specialistsEditor.innerHTML = renderSpecialistsEditor();
  }
}

function handleServiceEditorClick(event) {
  const removeButton = event.target.closest("[data-remove-service-index]");
  if (!removeButton) {
    return;
  }

  const index = Number(removeButton.dataset.removeServiceIndex);
  const service = state.services[index];
  if (!service) {
    return;
  }

  state.services.splice(index, 1);
  state.specialists.forEach((specialist) => {
    specialist.specialties = (specialist.specialties || []).filter((item) => item !== service.id);
  });
  elements.servicesEditor.innerHTML = renderServicesEditor();
  elements.specialistsEditor.innerHTML = renderSpecialistsEditor();
}

function handleAddSpecialist() {
  state.specialists.push({
    id: createDraftId("specialist"),
    name: "",
    role: "",
    experience: "",
    bio: "",
    specialties: [],
    workDays: [1, 2, 3, 4, 5],
    workHours: {
      start: "09:00",
      end: "20:00"
    },
    breaks: [
      {
        start: "13:00",
        end: "14:00",
        label: "Перерыв"
      }
    ],
    initials: ""
  });
  elements.specialistsEditor.innerHTML = renderSpecialistsEditor();
}

function handleSpecialistEditorInput(event) {
  const target = event.target;
  const index = Number(target.dataset.specialistIndex);
  const field = target.dataset.specialistField;

  if (!Number.isInteger(index) || index < 0 || !field || !state.specialists[index]) {
    return;
  }

  state.specialists[index][field] = target.value;
}

function handleSpecialistEditorClick(event) {
  const removeButton = event.target.closest("[data-remove-specialist-index]");
  if (!removeButton) {
    return;
  }

  const index = Number(removeButton.dataset.removeSpecialistIndex);
  if (!state.specialists[index]) {
    return;
  }

  state.specialists.splice(index, 1);
  elements.specialistsEditor.innerHTML = renderSpecialistsEditor();
}

function handleSpecialistEditorChange(event) {
  const target = event.target;
  const index = Number(target.dataset.specialistIndex);
  const field = target.dataset.specialistArrayField;

  if (!Number.isInteger(index) || index < 0 || !field || !state.specialists[index]) {
    return;
  }

  const collection = Array.isArray(state.specialists[index][field])
    ? state.specialists[index][field]
    : [];
  const value = field === "workDays" ? Number(target.value) : target.value;
  const next = new Set(collection);

  if (target.checked) {
    next.add(value);
  } else {
    next.delete(value);
  }

  state.specialists[index][field] = Array.from(next).sort((left, right) =>
    typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))
  );
}

async function handleContentSave(scope) {
  if (!state.adminPin) {
    showToast("Сначала откройте админ-панель по PIN.", "info");
    return;
  }

  const buttonMap = {
    site: elements.saveSiteContentBtn,
    services: elements.saveServicesBtn,
    specialists: elements.saveSpecialistsBtn
  };
  const labelMap = {
    site: "Сохраняю витрину...",
    services: "Сохраняю услуги...",
    specialists: "Сохраняю специалистов..."
  };
  const successMap = {
    site: "Контент витрины обновлен.",
    services: "Каталог услуг обновлен.",
    specialists: "Состав команды обновлен."
  };

  const button = buttonMap[scope];
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = labelMap[scope];

  try {
    const payload = await fetchJson("/api/admin/content", {
      method: "PUT",
      body: JSON.stringify({
        site: state.site,
        services: state.services,
        specialists: state.specialists
      })
    });

    state.site = payload.site;
    state.services = payload.services;
    state.specialists = payload.specialists;
    state.currency = payload.site?.brand?.currency || state.currency;

    renderStudioShell(state.adminData?.bookings?.length || 0);
    renderContentManagement();
    if (state.adminData) {
      renderDashboard();
    }
    syncRevealTargets();
    showToast(successMap[scope], "success");
  } catch (error) {
    showToast(error.message || "Не удалось сохранить контент.", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderCurrentDate() {
  elements.adminCurrentDate.innerHTML = `
    <div class="admin-date-card">
      <span>Сегодня</span>
      <strong>${escapeHtml(formatLongDate(new Date()))}</strong>
    </div>
  `;
}

async function handleAdminLogin() {
  const pin = elements.adminPin.value.trim();

  if (!pin) {
    showToast("Введите PIN для доступа к админ-панели.", "info");
    return;
  }

  elements.adminLoginBtn.disabled = true;
  elements.adminLoginBtn.textContent = "Проверяю...";

  try {
    await fetchJson("/api/admin/session", {
      method: "POST",
      body: JSON.stringify({
        pin
      })
    });
    state.adminPin = "__session__";
    await loadAdminData();
    elements.adminPin.value = "";
    elements.adminPanel.hidden = false;
    elements.adminGateMessage.textContent =
      "Доступ открыт. Панель загружена, статусы можно менять прямо в журнале.";
    syncRevealTargets();
    showToast("Админ-панель подключена.", "success");
  } catch (error) {
    state.adminPin = "";
    elements.adminPanel.hidden = true;
    elements.adminGateMessage.textContent = error.message || "PIN не подошел.";
    showToast(error.message || "Не удалось открыть админ-панель.", "error");
  } finally {
    elements.adminLoginBtn.disabled = false;
    elements.adminLoginBtn.textContent = "Открыть";
  }
}

async function loadAdminData() {
  const payload = await fetchJson("/api/admin/bookings");

  state.adminData = payload;
  state.currency = payload.currency || state.currency;
  await Promise.all([loadDaySchedule(), loadClientsData()]);
  renderDashboard();
}

async function tryAutoLoginFromSession() {
  try {
    const response = await fetch("/api/admin/session", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      return;
    }

    state.adminPin = "__session__";
    await loadAdminData();
    elements.adminPanel.hidden = false;
    elements.adminGateMessage.textContent =
      "Super-user сессия восстановлена. Кабинет открыт автоматически.";
    syncRevealTargets();
  } catch {
    state.adminPin = "";
    elements.adminPin.value = "";
  }
}

async function handleAdminLogout() {
  try {
    await fetchJson("/api/admin/session", {
      method: "DELETE"
    });
  } catch {
    // Keep local cleanup even if the session is already gone.
  }

  state.adminPin = "";
  state.adminData = null;
  elements.adminPin.value = "";
  elements.adminPanel.hidden = true;
  elements.adminGateMessage.textContent =
    "Сессия суперпользователя очищена. Для повторного входа снова введи PIN.";
  showToast("Super-user доступ очищен.", "info");
}

function renderDashboard() {
  const model = buildDashboardModel();

  renderOperationsWorkspace();
  renderClientsWorkspace();
  renderAdminStats(model.statCards);
  renderTodayTimeline(model.todayBookings);
  renderUpcomingQueue(model.upcomingBookings);
  renderSpecialistLoad(model.specialistRows);
  renderServiceBoard(model.serviceRows);
  renderPipelineBoard(model.statusRows);
  renderAttentionBoard(model.attentionItems);
  renderAdminTable();

  elements.adminHeroMeta.innerHTML = [
    `${model.statCards[0].value} на сегодня`,
    `${model.statCards[2].value} новых`,
    `${model.statCards[4].value} выручка`
  ]
    .map((item) => `<span class="meta-chip">${escapeHtml(item)}</span>`)
    .join("");
}

function buildDashboardModel() {
  const bookings = sortBookings(state.adminData?.bookings || []);
  const now = Date.now();
  const todayString = getLocalDateString();
  const weekLimit = new Date();
  weekLimit.setDate(weekLimit.getDate() + 7);
  weekLimit.setHours(23, 59, 59, 999);
  const weekLimitTime = weekLimit.getTime();

  const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const upcomingBookings = activeBookings.filter((booking) => getBookingTimestamp(booking) >= now);
  const todayBookings = activeBookings.filter((booking) => booking.date === todayString);
  const weekBookings = upcomingBookings.filter((booking) => getBookingTimestamp(booking) <= weekLimitTime);
  const payableBookings = bookings.filter(
    (booking) => booking.status === "confirmed" || booking.status === "completed"
  );
  const revenue = payableBookings.reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);
  const uniqueClients = new Set(
    bookings.map((booking) =>
      `${(booking.phone || "").trim()}|${(booking.email || "").trim()}|${(booking.clientName || "").trim()}`
    )
  );

  const statCards = [
    {
      label: "Сегодня",
      value: String(todayBookings.length),
      hint: todayBookings.length ? "визитов запланировано" : "сегодня визитов нет"
    },
    {
      label: "На 7 дней",
      value: String(weekBookings.length),
      hint: "записей в ближайшей неделе"
    },
    {
      label: "Новые",
      value: String(bookings.filter((booking) => booking.status === "new").length),
      hint: "ожидают реакции администратора"
    },
    {
      label: "Клиенты",
      value: String(bookings.length ? uniqueClients.size : 0),
      hint: "уникальных контактов в системе"
    },
    {
      label: "Выручка",
      value: formatCurrency(revenue),
      hint: "по подтвержденным и завершенным"
    },
    {
      label: "Средний чек",
      value: formatCurrency(payableBookings.length ? revenue / payableBookings.length : 0),
      hint: payableBookings.length ? "по оплачиваемому потоку" : "появится после подтверждений"
    }
  ];

  const specialistRows = state.specialists
    .map((specialist) => {
      const specialistBookings = activeBookings.filter(
        (booking) => booking.specialistId === specialist.id
      );
      const todayCount = specialistBookings.filter((booking) => booking.date === todayString).length;
      const upcomingCount = specialistBookings.filter(
        (booking) => getBookingTimestamp(booking) >= now
      ).length;
      const revenueShare = payableBookings
        .filter((booking) => booking.specialistId === specialist.id)
        .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);

      return {
        ...specialist,
        totalBookings: specialistBookings.length,
        todayCount,
        upcomingCount,
        revenueShare,
        serviceNames: specialist.specialties
          .map((serviceId) => state.services.find((service) => service.id === serviceId)?.name)
          .filter(Boolean)
      };
    })
    .sort((left, right) => right.upcomingCount - left.upcomingCount || right.totalBookings - left.totalBookings);

  const maxSpecialistLoad = Math.max(1, ...specialistRows.map((item) => item.upcomingCount));
  specialistRows.forEach((item) => {
    item.loadPercent = Math.round((item.upcomingCount / maxSpecialistLoad) * 100);
  });

  const serviceRows = state.services
    .map((service) => {
      const serviceBookings = activeBookings.filter((booking) => booking.serviceId === service.id);
      const revenueShare = payableBookings
        .filter((booking) => booking.serviceId === service.id)
        .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);

      return {
        ...service,
        bookingCount: serviceBookings.length,
        upcomingCount: serviceBookings.filter((booking) => getBookingTimestamp(booking) >= now).length,
        revenueShare
      };
    })
    .sort((left, right) => right.bookingCount - left.bookingCount || right.revenueShare - left.revenueShare);

  const maxServiceCount = Math.max(1, ...serviceRows.map((item) => item.bookingCount));
  serviceRows.forEach((item) => {
    item.sharePercent = Math.round((item.bookingCount / maxServiceCount) * 100);
  });

  const statusRows = Object.entries(statusLabels).map(([status, label]) => {
    const count = bookings.filter((booking) => booking.status === status).length;

    return {
      status,
      label,
      count,
      percent: bookings.length ? Math.round((count / bookings.length) * 100) : 0
    };
  });

  const attentionItems = [
    ...bookings
      .filter((booking) => booking.status === "new")
      .slice(0, 4)
      .map((booking) => ({
        title: `${booking.clientName} ждет подтверждения`,
        meta: `${booking.serviceName} · ${formatShortBookingSlot(booking)}`,
        tone: "new"
      })),
    ...upcomingBookings
      .filter((booking) => getBookingTimestamp(booking) - now <= 1000 * 60 * 60 * 24)
      .slice(0, 4)
      .map((booking) => ({
        title: `Ближайший визит: ${booking.clientName}`,
        meta: `${booking.serviceName} · ${formatShortBookingSlot(booking)}`,
        tone: "confirmed"
      }))
  ].slice(0, 6);

  return {
    statCards,
    todayBookings,
    upcomingBookings: upcomingBookings.slice(0, 7),
    specialistRows,
    serviceRows,
    statusRows,
    attentionItems
  };
}

function renderAdminStats(cards) {
  elements.adminStats.innerHTML = cards
    .map(
      (card) => `
        <article class="admin-kpi-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.hint)}</small>
        </article>
      `
    )
    .join("");
}

function renderTodayTimeline(bookings) {
  if (!bookings.length) {
    elements.todayTimeline.innerHTML = `
      <div class="empty-state">
        На сегодня активных записей пока нет. Панель останется полной, даже если журнал еще пустой.
      </div>
    `;
    return;
  }

  elements.todayTimeline.innerHTML = `
    <div class="admin-list">
      ${bookings
        .map(
          (booking) => `
            <div class="admin-list-item">
              <div class="admin-list-item__time">${escapeHtml(booking.slot)}</div>
              <div class="admin-list-item__body">
                <strong>${escapeHtml(booking.clientName)}</strong>
                <span>${escapeHtml(booking.serviceName)} · ${escapeHtml(booking.specialistName)}</span>
              </div>
              <div class="admin-pill admin-pill--${escapeHtml(booking.status)}">
                ${escapeHtml(statusLabels[booking.status])}
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderUpcomingQueue(bookings) {
  if (!bookings.length) {
    elements.upcomingQueue.innerHTML = `
      <div class="empty-state">
        Ближайших визитов пока нет. Как только появятся записи, здесь будет живая очередь на ближайшие дни.
      </div>
    `;
    return;
  }

  elements.upcomingQueue.innerHTML = `
    <div class="admin-queue">
      ${bookings
        .map(
          (booking) => `
            <div class="admin-queue-item">
              <div>
                <strong>${escapeHtml(booking.clientName)}</strong>
                <span>${escapeHtml(booking.serviceName)}</span>
              </div>
              <div class="admin-queue-item__meta">
                <span>${escapeHtml(formatShortBookingSlot(booking))}</span>
                <span>${escapeHtml(booking.specialistName)}</span>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSpecialistLoad(rows) {
  elements.specialistLoad.innerHTML = rows
    .map(
      (row) => `
        <article class="admin-entity-card">
          <div class="admin-entity-card__head">
            <div>
              <strong>${escapeHtml(row.name)}</strong>
              <span>${escapeHtml(row.role)}</span>
            </div>
            <div class="admin-entity-card__metric">${row.todayCount} сегодня</div>
          </div>
          <div class="admin-loadbar">
            <div class="admin-loadbar__fill" style="width: ${row.loadPercent}%"></div>
          </div>
          <div class="admin-entity-card__stats">
            <span>${row.upcomingCount} впереди</span>
            <span>${row.totalBookings} всего</span>
            <span>${formatCurrency(row.revenueShare)}</span>
          </div>
          <div class="admin-chip-row">
            ${row.serviceNames.map((name) => `<span class="meta-chip">${escapeHtml(name)}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderServiceBoard(rows) {
  elements.serviceBoard.innerHTML = rows
    .map(
      (row) => `
        <article class="admin-entity-card">
          <div class="admin-entity-card__head">
            <div>
              <strong>${escapeHtml(row.name)}</strong>
              <span>${escapeHtml(row.category)}</span>
            </div>
            <div class="admin-entity-card__metric">${row.bookingCount} записей</div>
          </div>
          <div class="admin-loadbar">
            <div class="admin-loadbar__fill admin-loadbar__fill--warm" style="width: ${row.sharePercent}%"></div>
          </div>
          <div class="admin-entity-card__stats">
            <span>${row.duration} мин</span>
            <span>${row.upcomingCount} впереди</span>
            <span>${formatCurrency(row.revenueShare)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderPipelineBoard(rows) {
  elements.pipelineBoard.innerHTML = `
    <div class="admin-status-grid">
      ${rows
        .map(
          (row) => `
            <div class="admin-status-row">
              <div class="admin-status-row__head">
                <strong>${escapeHtml(row.label)}</strong>
                <span>${row.count}</span>
              </div>
              <div class="admin-loadbar">
                <div class="admin-loadbar__fill admin-loadbar__fill--dark" style="width: ${row.percent}%"></div>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAttentionBoard(items) {
  if (!items.length) {
    elements.attentionBoard.innerHTML = `
      <div class="empty-state">
        Срочных действий нет. Как только появятся новые заявки или близкие визиты, они будут показаны здесь.
      </div>
    `;
    return;
  }

  elements.attentionBoard.innerHTML = `
    <div class="admin-alert-list">
      ${items
        .map(
          (item) => `
            <div class="admin-alert-item">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.meta)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAdminTable() {
  const bookings = state.adminData?.bookings || [];
  const filtered = bookings.filter((booking) => {
    const matchesStatus =
      state.filters.status === "all" || booking.status === state.filters.status;

    if (!matchesStatus) {
      return false;
    }

    if (!state.filters.search) {
      return true;
    }

    const haystack = [
      booking.reference,
      booking.clientName,
      booking.phone,
      booking.email,
      booking.serviceName,
      booking.specialistName,
      booking.notes
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.filters.search);
  });

  if (!filtered.length) {
    elements.adminTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">По текущим фильтрам ничего не найдено.</div>
        </td>
      </tr>
    `;
    return;
  }

  elements.adminTableBody.innerHTML = filtered
    .map(
      (booking) => `
        <tr>
          <td>
            <span class="table-main">${escapeHtml(booking.reference)}</span>
            <span class="table-sub">Создана ${escapeHtml(formatDateTime(booking.createdAt))}</span>
          </td>
          <td>
            <span class="table-main">${escapeHtml(booking.clientName)}</span>
            <span class="table-sub">${escapeHtml(booking.phone)}${booking.email ? `<br>${escapeHtml(booking.email)}` : ""}</span>
          </td>
          <td>
            <span class="table-main">${escapeHtml(booking.serviceName)}</span>
            <span class="table-sub">${escapeHtml(booking.specialistName)} · ${formatCurrency(booking.totalPrice)}</span>
          </td>
          <td>
            <span class="table-main">${escapeHtml(formatDate(booking.date))}</span>
            <span class="table-sub">${escapeHtml(booking.slot)} - ${escapeHtml(booking.endsAt)}</span>
          </td>
          <td>
            <select class="status-select" data-booking-id="${escapeHtml(booking.id)}">
              ${Object.entries(statusLabels)
                .map(
                  ([value, label]) =>
                    `<option value="${escapeHtml(value)}" ${booking.status === value ? "selected" : ""}>${escapeHtml(label)}</option>`
                )
                .join("")}
            </select>
          </td>
          <td>
            <span class="table-main">${booking.notes ? escapeHtml(booking.notes) : "—"}</span>
            <span class="table-sub">Статус: ${escapeHtml(statusLabels[booking.status])}</span>
          </td>
        </tr>
      `
    )
    .join("");
}

async function handleAdminStatusChange(event) {
  const select = event.target.closest("[data-booking-id]");

  if (!select || !state.adminPin) {
    return;
  }

  select.disabled = true;

  try {
    await fetchJson(`/api/admin/bookings/${select.dataset.bookingId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value })
    });

    await loadAdminData();
    showToast("Статус записи обновлен.", "success");
  } catch (error) {
    showToast(error.message || "Не удалось обновить статус.", "error");
  } finally {
    select.disabled = false;
  }
}

function renderEditorCard(title, copy, content) {
  return `
    <section class="admin-editor-card">
      <div class="admin-editor-card__head">
        <div>
          <h4 class="admin-editor-card__title">${escapeHtml(title)}</h4>
          <p class="admin-editor-card__copy">${escapeHtml(copy)}</p>
        </div>
      </div>
      <div class="admin-editor-stack">
        ${content}
      </div>
    </section>
  `;
}

function renderFieldGroup(label, fieldsHtml) {
  return `
    <div class="admin-field-group">
      <p class="admin-field-group__label">${escapeHtml(label)}</p>
      <div class="field-grid">
        ${fieldsHtml}
      </div>
    </div>
  `;
}

function renderSiteField(label, path, value, options = {}) {
  const fieldClass = options.full || options.multiline ? "field field--full" : "field";

  if (options.multiline) {
    return `
      <label class="${fieldClass}">
        <span>${escapeHtml(label)}</span>
        <textarea rows="${options.rows || 3}" data-site-path="${escapeHtml(path)}">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  return `
    <label class="${fieldClass}">
      <span>${escapeHtml(label)}</span>
      <input
        type="${escapeHtml(options.type || "text")}"
        value="${escapeHtml(value)}"
        data-site-path="${escapeHtml(path)}"
        ${options.min ? `min="${escapeHtml(options.min)}"` : ""}
        ${options.step ? `step="${escapeHtml(options.step)}"` : ""}
      >
    </label>
  `;
}

function renderSectionGroup(key, label, section, withBookingExtras = false) {
  const sectionValue = section || {};
  const extraFields = withBookingExtras
    ? [
        renderSiteField("Подсказка до выбора слота", `sections.${key}.slotHint`, sectionValue.slotHint || "", { multiline: true, rows: 3 }),
        renderSiteField("Kicker резюме записи", `sections.${key}.summaryKicker`, sectionValue.summaryKicker || ""),
        renderSiteField("Kicker карточки контактов", `sections.${key}.contactsKicker`, sectionValue.contactsKicker || ""),
        renderSiteField("Примечание под кнопкой", `sections.${key}.note`, sectionValue.note || "", { multiline: true, rows: 4 })
      ].join("")
    : "";

  return `
    <div class="admin-editor-item">
      <div class="admin-editor-item__toolbar">
        <span class="admin-editor-item__index">${escapeHtml(label)}</span>
      </div>
      <div class="admin-editor-item__grid">
        ${renderSiteField("Kicker", `sections.${key}.kicker`, sectionValue.kicker || "")}
        ${renderSiteField("Заголовок", `sections.${key}.title`, sectionValue.title || "", { multiline: true, rows: 4 })}
        ${renderSiteField("Описание", `sections.${key}.copy`, sectionValue.copy || "", { multiline: true, rows: 4 })}
        ${extraFields}
      </div>
    </div>
  `;
}

function renderStringListEditor(title, path, items, addLabel, placeholder) {
  return `
    <section class="admin-editor-list">
      <div class="admin-editor-list__head">
        <div>
          <h4 class="admin-editor-card__title">${escapeHtml(title)}</h4>
        </div>
        <button type="button" class="button button--ghost" data-add-site-list="${escapeHtml(path)}">${escapeHtml(addLabel)}</button>
      </div>
      <div class="admin-editor-list__items">
        ${items.length
          ? items
              .map(
                (item, index) => `
                  <div class="admin-editor-item">
                    <div class="admin-editor-item__toolbar">
                      <span class="admin-editor-item__index">Элемент ${index + 1}</span>
                      <button type="button" class="button button--ghost" data-remove-site-list-item="${escapeHtml(path)}" data-index="${index}">Удалить</button>
                    </div>
                    <label class="field">
                      <span>${escapeHtml(title)}</span>
                      <input
                        type="text"
                        value="${escapeHtml(item)}"
                        placeholder="${escapeHtml(placeholder)}"
                        data-site-list-path="${escapeHtml(path)}"
                        data-index="${index}"
                      >
                    </label>
                  </div>
                `
              )
              .join("")
          : '<div class="admin-empty-editor">Пока нет элементов. Добавьте первый.</div>'}
      </div>
    </section>
  `;
}

function renderObjectListEditor(title, path, items, fields, addLabel) {
  return `
    <section class="admin-editor-list">
      <div class="admin-editor-list__head">
        <div>
          <h4 class="admin-editor-card__title">${escapeHtml(title)}</h4>
        </div>
        <button type="button" class="button button--ghost" data-add-site-list="${escapeHtml(path)}">${escapeHtml(addLabel)}</button>
      </div>
      <div class="admin-editor-list__items">
        ${items.length
          ? items
              .map(
                (item, index) => `
                  <div class="admin-editor-item">
                    <div class="admin-editor-item__toolbar">
                      <span class="admin-editor-item__index">Элемент ${index + 1}</span>
                      <button type="button" class="button button--ghost" data-remove-site-list-item="${escapeHtml(path)}" data-index="${index}">Удалить</button>
                    </div>
                    <div class="admin-editor-item__grid">
                      ${fields
                        .map((field) =>
                          renderObjectListField(path, index, field, item?.[field.key] || "")
                        )
                        .join("")}
                    </div>
                  </div>
                `
              )
              .join("")
          : '<div class="admin-empty-editor">Пока нет элементов. Добавьте первый.</div>'}
      </div>
    </section>
  `;
}

function renderObjectListField(path, index, field, value) {
  const fieldClass = field.full || field.multiline ? "field field--full" : "field";

  if (field.multiline) {
    return `
      <label class="${fieldClass}">
        <span>${escapeHtml(field.label)}</span>
        <textarea
          rows="${field.rows || 4}"
          data-site-list-field-path="${escapeHtml(path)}"
          data-index="${index}"
          data-field="${escapeHtml(field.key)}"
        >${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  return `
    <label class="${fieldClass}">
      <span>${escapeHtml(field.label)}</span>
      <input
        type="text"
        value="${escapeHtml(value)}"
        data-site-list-field-path="${escapeHtml(path)}"
        data-index="${index}"
        data-field="${escapeHtml(field.key)}"
      >
    </label>
  `;
}

function renderCollectionField(label, index, field, value, namespace, options = {}) {
  const fieldClass = options.full || options.multiline ? "field field--full" : "field";

  if (options.multiline) {
    return `
      <label class="${fieldClass}">
        <span>${escapeHtml(label)}</span>
        <textarea rows="${options.rows || 4}" data-${namespace}-index="${index}" data-${namespace}-field="${escapeHtml(field)}">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  return `
    <label class="${fieldClass}">
      <span>${escapeHtml(label)}</span>
      <input
        type="${escapeHtml(options.type || "text")}"
        value="${escapeHtml(value)}"
        data-${namespace}-index="${index}"
        data-${namespace}-field="${escapeHtml(field)}"
        ${options.min ? `min="${escapeHtml(options.min)}"` : ""}
        ${options.step ? `step="${escapeHtml(options.step)}"` : ""}
      >
    </label>
  `;
}

function getByPath(source, path) {
  return String(path)
    .split(".")
    .reduce((result, key) => (result ? result[key] : undefined), source);
}

function setByPath(source, path, value) {
  const keys = String(path).split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((result, key) => {
    if (!result[key] || typeof result[key] !== "object") {
      result[key] = {};
    }
    return result[key];
  }, source);

  if (lastKey) {
    target[lastKey] = value;
  }
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createDraftId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortBookings(bookings) {
  return [...bookings].sort((left, right) => getBookingTimestamp(left) - getBookingTimestamp(right));
}

function getBookingTimestamp(booking) {
  return new Date(`${booking.date}T${booking.slot}:00`).getTime();
}

function formatShortBookingSlot(booking) {
  return `${formatDate(booking.date)}, ${booking.slot}`;
}

function initRevealObserver() {
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  syncRevealTargets();
}

function initNavHighlight() {
  const navLinks = document.querySelectorAll(".admin-sidebar__nav a[href^='#']");
  if (!navLinks.length) return;

  const sectionIds = Array.from(navLinks).map((a) => a.getAttribute("href").slice(1));
  const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((a) => {
            a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`);
          });
        }
      });
    },
    { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
  );

  sections.forEach((s) => observer.observe(s));
}

function syncRevealTargets() {
  if (!revealObserver) {
    return;
  }

  document.querySelectorAll(".reveal").forEach((element) => {
    if (!element.dataset.revealBound) {
      element.dataset.revealBound = "true";
      revealObserver.observe(element);
    }

    if (isElementInViewport(element)) {
      element.classList.add("is-visible");
    }
  });
}

function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return rect.bottom > 0 && rect.top < viewportHeight * 0.95;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: state.currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long"
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function getLocalDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showConfirm(title, message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-backdrop";
    backdrop.innerHTML = `
      <div class="confirm-card" role="dialog" aria-modal="true">
        <p class="confirm-card__title">${escapeHtml(title)}</p>
        <p class="confirm-card__message">${escapeHtml(message)}</p>
        <div class="confirm-card__actions">
          <button type="button" class="button button--ghost" data-action="cancel">Отмена</button>
          <button type="button" class="button button--secondary" data-action="confirm" style="background:var(--danger)">Подтвердить</button>
        </div>
      </div>
    `;

    function close(result) {
      backdrop.remove();
      resolve(result);
    }

    backdrop.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "confirm") close(true);
      else if (action === "cancel" || event.target === backdrop) close(false);
    });

    document.body.appendChild(backdrop);
    backdrop.querySelector("[data-action='confirm']").focus();
  });
}

function handleExportCsv() {
  const bookings = state.adminData?.bookings || [];
  const filtered = bookings.filter((booking) => {
    const matchesStatus =
      state.filters.status === "all" || booking.status === state.filters.status;
    if (!matchesStatus) return false;
    if (!state.filters.search) return true;
    const haystack = [
      booking.reference, booking.clientName, booking.phone,
      booking.email, booking.serviceName, booking.specialistName, booking.notes
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(state.filters.search);
  });

  if (!filtered.length) {
    showToast("Нет записей для экспорта по текущим фильтрам.", "info");
    return;
  }

  const currency = state.currency || "MDL";
  const headers = [
    "Номер", "Клиент", "Телефон", "Email",
    "Услуга", "Специалист", "Дата", "Начало", "Конец",
    `Стоимость (${currency})`, "Статус", "Комментарий", "Создана"
  ];

  const rows = filtered.map((b) => [
    b.reference, b.clientName, b.phone, b.email ?? "",
    b.serviceName, b.specialistName, b.date, b.slot, b.endsAt,
    b.totalPrice ?? "", statusLabels[b.status] ?? b.status,
    b.notes ?? "", b.createdAt ? formatDateTime(b.createdAt) : ""
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = getLocalDateString();
  const statusSuffix = state.filters.status !== "all" ? `-${state.filters.status}` : "";
  a.href = url;
  a.download = `mateev-bookings-${date}${statusSuffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.textContent = message;
  elements.toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    body: options.body
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      state.adminPin = "";
      state.adminData = null;
      elements.adminPanel.hidden = true;
      elements.adminPin.value = "";
      elements.adminGateMessage.textContent =
        "Сессия администратора истекла. Войдите заново, чтобы продолжить.";
    }
    throw new Error(payload.message || "Ошибка запроса.");
  }

  return payload;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCompatibleSpecialists(serviceId) {
  if (!serviceId) {
    return state.specialists;
  }

  return state.specialists.filter((specialist) => (specialist.specialties || []).includes(serviceId));
}

function ensureOperationsDefaults() {
  if (!state.services.length || !state.specialists.length) {
    return;
  }

  const bookingForm = state.operations.bookingForm;
  if (!state.services.some((service) => service.id === bookingForm.serviceId)) {
    bookingForm.serviceId = state.services[0].id;
  }

  const compatibleSpecialists = getCompatibleSpecialists(bookingForm.serviceId);
  if (!compatibleSpecialists.some((specialist) => specialist.id === bookingForm.specialistId)) {
    bookingForm.specialistId = compatibleSpecialists[0]?.id || state.specialists[0].id;
  }

  if (!bookingForm.date) {
    bookingForm.date = state.operations.date;
  }

  if (!state.specialists.some((specialist) => specialist.id === state.operations.blockForm.specialistId)) {
    state.operations.blockForm.specialistId = bookingForm.specialistId;
  }

  if (!state.specialists.some((specialist) => specialist.id === state.operations.scheduleForm.specialistId)) {
    state.operations.scheduleForm.specialistId = bookingForm.specialistId;
    syncScheduleFormFromSpecialist(false);
  }
}

function syncScheduleFormFromSpecialist(shouldRender = true) {
  const specialist = state.specialists.find(
    (item) => item.id === state.operations.scheduleForm.specialistId
  );

  if (!specialist) {
    return;
  }

  state.operations.scheduleForm = {
    specialistId: specialist.id,
    workDays: [...(specialist.workDays || [])],
    workStart: specialist.workHours?.start || "09:00",
    workEnd: specialist.workHours?.end || "20:00",
    breaks: (specialist.breaks || []).map((entry) => ({
      start: entry.start || "13:00",
      end: entry.end || "14:00",
      label: entry.label || "Перерыв"
    }))
  };

  if (!state.operations.scheduleForm.breaks.length) {
    state.operations.scheduleForm.breaks = [
      { start: "13:00", end: "14:00", label: "Перерыв" }
    ];
  }

  if (shouldRender) {
    renderScheduleSettingsForm();
  }
}

function renderOperationsWorkspace() {
  ensureOperationsDefaults();
  renderOperationsSelects();
  renderScheduleSettingsForm();
  renderScheduleSummary();
  renderScheduleBoard();
  fillBookingFormFromState();
  void refreshBookingSlots(true);
}

function renderOperationsSelects() {
  const bookingForm = state.operations.bookingForm;
  const blockForm = state.operations.blockForm;
  const scheduleForm = state.operations.scheduleForm;

  elements.scheduleDateInput.value = state.operations.date;
  elements.adminBookingDate.value = bookingForm.date;
  elements.adminBlockDate.value = blockForm.date;
  elements.adminBlockStart.value = blockForm.start;
  elements.adminBlockEnd.value = blockForm.end;
  elements.adminBlockReason.value = blockForm.reason;

  elements.adminBookingService.innerHTML = state.services
    .map(
      (service) =>
        `<option value="${escapeHtml(service.id)}" ${bookingForm.serviceId === service.id ? "selected" : ""}>${escapeHtml(service.name)}</option>`
    )
    .join("");

  const compatibleSpecialists = getCompatibleSpecialists(bookingForm.serviceId);
  elements.adminBookingSpecialist.innerHTML = compatibleSpecialists
    .map(
      (specialist) =>
        `<option value="${escapeHtml(specialist.id)}" ${bookingForm.specialistId === specialist.id ? "selected" : ""}>${escapeHtml(specialist.name)}</option>`
    )
    .join("");

  const specialistOptions = state.specialists
    .map(
      (specialist) =>
        `<option value="${escapeHtml(specialist.id)}">${escapeHtml(specialist.name)}</option>`
    )
    .join("");

  elements.adminBlockSpecialist.innerHTML = specialistOptions;
  elements.scheduleSpecialistSelect.innerHTML = specialistOptions;
  elements.adminBlockSpecialist.value = blockForm.specialistId;
  elements.scheduleSpecialistSelect.value = scheduleForm.specialistId;
}

function fillBookingFormFromState() {
  const bookingForm = state.operations.bookingForm;
  elements.bookingFormMode.textContent =
    bookingForm.mode === "edit" ? "Редактирование записи" : "Ручное создание";
  elements.bookingReference.textContent =
    bookingForm.mode === "edit" && bookingForm.id
      ? `ID: ${bookingForm.id.slice(0, 8)}`
      : "Новая запись";
  elements.adminBookingService.value = bookingForm.serviceId;
  elements.adminBookingSpecialist.value = bookingForm.specialistId;
  elements.adminBookingDate.value = bookingForm.date;
  elements.adminBookingStatus.value = bookingForm.status;
  elements.adminBookingClientName.value = bookingForm.clientName;
  elements.adminBookingPhone.value = bookingForm.phone;
  elements.adminBookingEmail.value = bookingForm.email;
  elements.adminBookingNotes.value = bookingForm.notes;
  elements.adminBookingCancelBtn.hidden = bookingForm.mode !== "edit";
}

function renderScheduleSummary() {
  if (!state.daySchedule) {
    elements.scheduleSummary.innerHTML = `
      <article class="admin-kpi-card">
        <span>Расписание</span>
        <strong>—</strong>
        <small>Откройте кабинет и выберите дату.</small>
      </article>
    `;
    return;
  }

  const cards = [
    {
      label: "На смене",
      value: String(state.daySchedule.summary.specialistsOnDuty),
      hint: "специалистов в работе"
    },
    {
      label: "Записей",
      value: String(state.daySchedule.summary.totalBookings),
      hint: "активных визитов на день"
    },
    {
      label: "Новые",
      value: String(state.daySchedule.summary.newBookings),
      hint: "ждут подтверждения"
    },
    {
      label: "Подтверждены",
      value: String(state.daySchedule.summary.confirmedBookings),
      hint: "запланированы"
    },
    {
      label: "Блокировки",
      value: String(state.daySchedule.summary.blockedPeriods),
      hint: "закрытых интервалов"
    }
  ];

  elements.scheduleSummary.innerHTML = cards
    .map(
      (card) => `
        <article class="admin-kpi-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.hint)}</small>
        </article>
      `
    )
    .join("");
}

function renderScheduleBoard() {
  if (!state.daySchedule) {
    elements.scheduleBoard.innerHTML = `
      <div class="empty-state">Откройте админ-панель и выберите дату, чтобы увидеть календарь дня.</div>
    `;
    return;
  }

  elements.scheduleBoard.innerHTML = `
    <div class="admin-schedule-grid">
      ${state.daySchedule.specialists
        .map((specialist) => {
          const headerMeta = specialist.isWorkingDay
            ? `${specialist.workHours.start} - ${specialist.workHours.end}`
            : "Выходной";

          return `
            <article class="admin-schedule-card ${specialist.isWorkingDay ? "" : "admin-schedule-card--off"}">
              <div class="admin-schedule-card__head">
                <div>
                  <strong>${escapeHtml(specialist.name)}</strong>
                  <span>${escapeHtml(specialist.role)}</span>
                </div>
                <div class="meta-chip">${escapeHtml(headerMeta)}</div>
              </div>
              ${
                specialist.events.length
                  ? `<div class="admin-schedule-events">
                      ${specialist.events
                        .map((event) => {
                          if (event.type === "booking") {
                            return `
                              <button type="button" class="admin-schedule-event admin-schedule-event--booking" data-edit-booking-id="${escapeHtml(event.booking.id)}">
                                <span>${escapeHtml(event.start)} - ${escapeHtml(event.end)}</span>
                                <strong>${escapeHtml(event.title)}</strong>
                                <small>${escapeHtml(statusLabels[event.status] || event.status)}</small>
                              </button>
                            `;
                          }

                          if (event.type === "block") {
                            return `
                              <div class="admin-schedule-event admin-schedule-event--block">
                                <span>${escapeHtml(event.start)} - ${escapeHtml(event.end)}</span>
                                <strong>${escapeHtml(event.title)}</strong>
                                <button type="button" class="button button--ghost button--mini" data-delete-block-id="${escapeHtml(event.id)}">Удалить</button>
                              </div>
                            `;
                          }

                          return `
                            <div class="admin-schedule-event admin-schedule-event--break">
                              <span>${escapeHtml(event.start)} - ${escapeHtml(event.end)}</span>
                              <strong>${escapeHtml(event.title)}</strong>
                            </div>
                          `;
                        })
                        .join("")}
                    </div>`
                  : `<div class="empty-state">На этот день событий нет.</div>`
              }
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

async function loadDaySchedule() {
  if (!state.adminPin) {
    return;
  }

  ensureOperationsDefaults();
  elements.scheduleDateInput.value = state.operations.date;

  const payload = await fetchJson(`/api/admin/day?date=${encodeURIComponent(state.operations.date)}`);

  state.daySchedule = payload;
  renderScheduleSummary();
  renderScheduleBoard();
}

async function loadClientsData() {
  if (!state.adminPin) {
    return;
  }

  const payload = await fetchJson("/api/admin/clients");

  state.clients = payload.clients || [];

  if (!state.selectedClientId || !state.clients.some((client) => client.id === state.selectedClientId)) {
    state.selectedClientId = state.clients[0]?.id || "";
  }
}

function getFilteredClients() {
  const query = state.clientFilters.search;
  if (!query) {
    return state.clients;
  }

  return state.clients.filter((client) => {
    const haystack = [
      client.clientName,
      client.phone,
      client.email,
      client.note,
      client.favoriteServices.map((item) => item.name).join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function renderClientsWorkspace() {
  const totalClients = state.clients;
  const clients = getFilteredClients();

  if (!totalClients.length) {
    elements.clientsList.innerHTML = `
      <div class="empty-state">
        Клиентская база пока пуста. Создайте первую запись в разделе расписания, и карточка клиента появится автоматически.
      </div>
    `;
    elements.clientDetail.innerHTML = `
      <div class="empty-state">
        Здесь будут храниться контакты, история визитов, любимые услуги и заметки администратора по каждому клиенту.
      </div>
    `;
    return;
  }

  if (!clients.length) {
    elements.clientsList.innerHTML = `
      <div class="empty-state">По этому запросу клиенты не найдены. Попробуйте имя, телефон или email.</div>
    `;
    elements.clientDetail.innerHTML = `
      <div class="empty-state">Сбросьте поиск, чтобы снова открыть карточку клиента.</div>
    `;
    return;
  }

  const selectedClient =
    clients.find((client) => client.id === state.selectedClientId) || clients[0];
  state.selectedClientId = selectedClient.id;

  elements.clientsList.innerHTML = `
    <div class="client-list">
      ${clients
        .map(
          (client) => `
            <button
              type="button"
              class="client-list-item ${client.id === selectedClient.id ? "is-active" : ""}"
              data-client-id="${escapeHtml(client.id)}"
            >
              <div class="client-list-item__head">
                <strong>${escapeHtml(client.clientName)}</strong>
                <span class="meta-chip">${escapeHtml(clientStatusLabels[client.status] || client.status)}</span>
              </div>
              <div class="client-list-item__meta">
                <span>${escapeHtml(client.phone || "Телефон не указан")}</span>
                <span>${client.totalVisits} визитов</span>
                <span>${formatCurrency(client.totalSpent)}</span>
              </div>
            </button>
          `
        )
        .join("")}
    </div>
  `;

  renderClientDetail(selectedClient);
}

function renderClientDetail(client) {
  const statusLabel = clientStatusLabels[client.status] || client.status;
  const tagLabel = client.tag ? `<span class="meta-chip">${escapeHtml(client.tag)}</span>` : "";
  const upcomingVisit = client.upcomingBooking
    ? `${escapeHtml(formatShortBookingSlot(client.upcomingBooking))} · ${escapeHtml(client.upcomingBooking.serviceName)}`
    : "Пока без запланированного визита";
  const lastVisit = client.lastBooking
    ? `${escapeHtml(formatShortBookingSlot(client.lastBooking))} · ${escapeHtml(client.lastBooking.specialistName)}`
    : "История еще не сформирована";
  const favoriteServices = client.favoriteServices.length
    ? client.favoriteServices
        .map((item) => `<span class="meta-chip">${escapeHtml(item.name)} · ${item.count}</span>`)
        .join("")
    : `<span class="meta-chip">Пока только первый визит</span>`;
  const favoriteSpecialists = client.favoriteSpecialists.length
    ? client.favoriteSpecialists
        .map((item) => `<span class="meta-chip">${escapeHtml(item.name)} · ${item.count}</span>`)
        .join("")
    : `<span class="meta-chip">Мастер еще не определился</span>`;

  elements.clientDetail.innerHTML = `
    <div class="client-detail">
      <div class="client-detail__hero">
        <div class="client-detail__hero-copy">
          <div>
          <p class="section-kicker">Карточка клиента</p>
          <h3 class="admin-widget__title">${escapeHtml(client.clientName)}</h3>
          </div>
          <div class="client-detail__meta">
            <span class="meta-chip">${escapeHtml(statusLabel)}</span>
            ${tagLabel}
            <span class="meta-chip">Следующий визит: ${upcomingVisit}</span>
            <span class="meta-chip">Последний визит: ${lastVisit}</span>
          </div>
        </div>
      </div>

      <div class="client-detail__metrics">
        <div class="admin-mini-card">
          <span>Телефон</span>
          <strong>${escapeHtml(client.phone || "Не указан")}</strong>
        </div>
        <div class="admin-mini-card">
          <span>Email</span>
          <strong>${escapeHtml(client.email || "Не указан")}</strong>
        </div>
        <div class="admin-mini-card">
          <span>Всего визитов</span>
          <strong>${client.totalVisits}</strong>
        </div>
        <div class="admin-mini-card">
          <span>Завершено</span>
          <strong>${client.completedVisits}</strong>
        </div>
        <div class="admin-mini-card">
          <span>Запланировано</span>
          <strong>${client.upcomingVisits}</strong>
        </div>
        <div class="admin-mini-card">
          <span>Отменено</span>
          <strong>${client.cancelledVisits}</strong>
        </div>
        <div class="admin-mini-card">
          <span>Выручка</span>
          <strong>${formatCurrency(client.totalSpent)}</strong>
        </div>
      </div>

      <form class="admin-form-stack" data-client-profile-form>
        <div class="field-grid">
          <label class="field">
            <span>Статус клиента</span>
            <select name="status">
              ${Object.entries(clientStatusLabels)
                .map(
                  ([value, label]) =>
                    `<option value="${escapeHtml(value)}" ${client.status === value ? "selected" : ""}>${escapeHtml(label)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>Тег</span>
            <input type="text" name="tag" value="${escapeHtml(client.tag || "")}" placeholder="Например, любит вечерние визиты">
          </label>
        </div>

        <label class="field field--full">
          <span>Заметка администратора</span>
          <textarea rows="4" name="note" placeholder="Важные детали по клиенту, предпочтения, ограничения">${escapeHtml(client.note || "")}</textarea>
        </label>

        <div class="admin-form-actions">
          <button type="submit" class="button button--secondary" data-client-id="${escapeHtml(client.id)}">Сохранить карточку</button>
        </div>
      </form>

      <div class="client-detail__columns">
        <div class="admin-editor-item">
          <div class="admin-editor-item__toolbar">
            <span class="admin-editor-item__index">Частые услуги</span>
          </div>
          <div class="admin-chip-row">${favoriteServices}</div>
        </div>

        <div class="admin-editor-item">
          <div class="admin-editor-item__toolbar">
            <span class="admin-editor-item__index">Частые специалисты</span>
          </div>
          <div class="admin-chip-row">${favoriteSpecialists}</div>
        </div>
      </div>

      <div class="admin-editor-item">
        <div class="admin-editor-item__toolbar">
          <span class="admin-editor-item__index">История визитов</span>
        </div>
        <div class="client-history">
          ${client.history
            .map(
              (booking) => `
                <div class="client-history__item">
                  <div>
                    <strong>${escapeHtml(booking.serviceName)}</strong>
                    <span>${escapeHtml(formatDate(booking.date))} · ${escapeHtml(booking.slot)} · ${escapeHtml(booking.specialistName)}</span>
                  </div>
                  <div class="client-history__meta">
                    <span class="meta-chip">${escapeHtml(statusLabels[booking.status] || booking.status)}</span>
                    <span>${formatCurrency(booking.totalPrice)}</span>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function handleClientListClick(event) {
  const button = event.target.closest("[data-client-id]");
  if (!button) {
    return;
  }

  state.selectedClientId = button.dataset.clientId;
  renderClientsWorkspace();
}

async function handleClientProfileSubmit(event) {
  const form = event.target.closest("[data-client-profile-form]");
  if (!form || !state.adminPin) {
    return;
  }

  event.preventDefault();

  const clientId = form.querySelector("[data-client-id]")?.dataset.clientId || state.selectedClientId;
  if (!clientId) {
    return;
  }

  const payload = {
    status: form.querySelector('[name="status"]').value,
    tag: form.querySelector('[name="tag"]').value.trim(),
    note: form.querySelector('[name="note"]').value.trim()
  };

  try {
    await fetchJson(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    await loadClientsData();
    renderClientsWorkspace();
    showToast("Карточка клиента обновлена.", "success");
  } catch (error) {
    showToast(error.message || "Не удалось сохранить карточку клиента.", "error");
  }
}

function handleScheduleDateChange() {
  state.operations.date = elements.scheduleDateInput.value || getLocalDateString();
  state.operations.bookingForm.date = state.operations.date;
  state.operations.blockForm.date = state.operations.date;
  elements.adminBookingDate.value = state.operations.bookingForm.date;
  elements.adminBlockDate.value = state.operations.blockForm.date;
  void loadDaySchedule();
  void refreshBookingSlots(true);
}

function shiftScheduleDate(offsetDays) {
  const baseDate = new Date(`${state.operations.date}T00:00:00`);
  baseDate.setDate(baseDate.getDate() + offsetDays);
  state.operations.date = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${String(baseDate.getDate()).padStart(2, "0")}`;
  state.operations.bookingForm.date = state.operations.date;
  state.operations.blockForm.date = state.operations.date;
  elements.scheduleDateInput.value = state.operations.date;
  elements.adminBookingDate.value = state.operations.bookingForm.date;
  elements.adminBlockDate.value = state.operations.blockForm.date;
  void loadDaySchedule();
  void refreshBookingSlots(true);
}

function handleScheduleToday() {
  state.operations.date = getLocalDateString();
  state.operations.bookingForm.date = state.operations.date;
  state.operations.blockForm.date = state.operations.date;
  elements.scheduleDateInput.value = state.operations.date;
  elements.adminBookingDate.value = state.operations.bookingForm.date;
  elements.adminBlockDate.value = state.operations.blockForm.date;
  void loadDaySchedule();
  void refreshBookingSlots(true);
}

function readBookingFormState() {
  state.operations.bookingForm = {
    ...state.operations.bookingForm,
    serviceId: elements.adminBookingService.value,
    specialistId: elements.adminBookingSpecialist.value,
    date: elements.adminBookingDate.value,
    slot: elements.adminBookingSlot.value,
    status: elements.adminBookingStatus.value,
    clientName: elements.adminBookingClientName.value.trim(),
    phone: elements.adminBookingPhone.value.trim(),
    email: elements.adminBookingEmail.value.trim(),
    notes: elements.adminBookingNotes.value.trim()
  };

  return state.operations.bookingForm;
}

async function refreshBookingSlots(preserveCurrent = false) {
  const bookingForm = readBookingFormState();

  if (!bookingForm.serviceId || !bookingForm.specialistId || !bookingForm.date || !state.adminPin) {
    elements.adminBookingSlot.innerHTML = `<option value="">Сначала выберите услугу, мастера и дату</option>`;
    return;
  }

  const query = new URLSearchParams({
    serviceId: bookingForm.serviceId,
    specialistId: bookingForm.specialistId,
    date: bookingForm.date
  });

  if (bookingForm.mode === "edit" && bookingForm.id) {
    query.set("excludeBookingId", bookingForm.id);
  }

  try {
    const payload = await fetchJson(`/api/availability?${query.toString()}`);
    const slots = payload.slots || [];
    const preferredSlot = preserveCurrent ? bookingForm.slot : "";
    const selectedSlot =
      slots.find((entry) => entry.time === preferredSlot)?.time ||
      slots[0]?.time ||
      "";

    elements.adminBookingSlot.innerHTML = slots.length
      ? slots
          .map(
            (entry) =>
              `<option value="${escapeHtml(entry.time)}" ${selectedSlot === entry.time ? "selected" : ""}>${escapeHtml(entry.time)} - ${escapeHtml(entry.endsAt)}</option>`
          )
          .join("")
      : `<option value="">Нет свободных слотов</option>`;

    state.operations.bookingForm.slot = selectedSlot;
  } catch (error) {
    elements.adminBookingSlot.innerHTML = `<option value="">Слоты недоступны</option>`;
    showToast(error.message || "Не удалось загрузить слоты.", "error");
  }
}

function handleBookingServiceOrSpecialistChange() {
  const bookingForm = readBookingFormState();
  const compatibleSpecialists = getCompatibleSpecialists(bookingForm.serviceId);

  if (!compatibleSpecialists.some((specialist) => specialist.id === bookingForm.specialistId)) {
    bookingForm.specialistId = compatibleSpecialists[0]?.id || "";
  }

  renderOperationsSelects();
  fillBookingFormFromState();
  void refreshBookingSlots(false);
}

function resetAdminBookingForm() {
  state.operations.bookingForm = {
    mode: "create",
    id: "",
    serviceId: state.services[0]?.id || "",
    specialistId: getCompatibleSpecialists(state.services[0]?.id || "")[0]?.id || state.specialists[0]?.id || "",
    date: state.operations.date,
    slot: "",
    status: "confirmed",
    clientName: "",
    phone: "",
    email: "",
    notes: ""
  };

  renderOperationsWorkspace();
}

function populateBookingForm(booking) {
  state.operations.bookingForm = {
    mode: "edit",
    id: booking.id,
    serviceId: booking.serviceId,
    specialistId: booking.specialistId,
    date: booking.date,
    slot: booking.slot,
    status: booking.status,
    clientName: booking.clientName,
    phone: booking.phone,
    email: booking.email || "",
    notes: booking.notes || ""
  };

  state.operations.date = booking.date;
  renderOperationsWorkspace();
  void loadDaySchedule();
}

async function handleAdminBookingSubmit(event) {
  event.preventDefault();

  if (!state.adminPin) {
    showToast("Сначала откройте админ-панель по PIN.", "info");
    return;
  }

  const bookingForm = readBookingFormState();
  const url =
    bookingForm.mode === "edit" && bookingForm.id
      ? `/api/admin/bookings/${bookingForm.id}`
      : "/api/admin/bookings";
  const method = bookingForm.mode === "edit" ? "PATCH" : "POST";

  try {
    await fetchJson(url, {
      method,
      body: JSON.stringify({
        serviceId: bookingForm.serviceId,
        specialistId: bookingForm.specialistId,
        date: bookingForm.date,
        slot: bookingForm.slot,
        status: bookingForm.status,
        clientName: bookingForm.clientName,
        phone: bookingForm.phone,
        email: bookingForm.email,
        notes: bookingForm.notes
      })
    });

    state.operations.date = bookingForm.date;
    await loadAdminData();
    resetAdminBookingForm();
    showToast(
      bookingForm.mode === "edit" ? "Запись обновлена." : "Запись создана.",
      "success"
    );
  } catch (error) {
    showToast(error.message || "Не удалось сохранить запись.", "error");
  }
}

async function handleAdminBookingCancel() {
  const bookingForm = state.operations.bookingForm;

  if (bookingForm.mode !== "edit" || !bookingForm.id || !state.adminPin) {
    return;
  }

  const confirmed = await showConfirm(
    "Отменить визит?",
    `Запись будет переведена в статус «Отменена». Это действие нельзя отменить автоматически.`
  );
  if (!confirmed) return;

  try {
    await fetchJson(`/api/admin/bookings/${bookingForm.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" })
    });

    await loadAdminData();
    resetAdminBookingForm();
    showToast("Запись отменена.", "success");
  } catch (error) {
    showToast(error.message || "Не удалось отменить запись.", "error");
  }
}

async function handleAdminBlockSubmit(event) {
  event.preventDefault();

  if (!state.adminPin) {
    showToast("Сначала откройте админ-панель по PIN.", "info");
    return;
  }

  state.operations.blockForm = {
    specialistId: elements.adminBlockSpecialist.value,
    date: elements.adminBlockDate.value,
    start: elements.adminBlockStart.value,
    end: elements.adminBlockEnd.value,
    reason: elements.adminBlockReason.value.trim()
  };

  try {
    await fetchJson("/api/admin/blocks", {
      method: "POST",
      body: JSON.stringify(state.operations.blockForm)
    });

    await loadDaySchedule();
    showToast("Блокировка добавлена.", "success");
  } catch (error) {
    showToast(error.message || "Не удалось создать блокировку.", "error");
  }
}

function renderScheduleSettingsForm() {
  const scheduleForm = state.operations.scheduleForm;
  elements.scheduleSpecialistSelect.value = scheduleForm.specialistId;
  elements.scheduleWorkStart.value = scheduleForm.workStart;
  elements.scheduleWorkEnd.value = scheduleForm.workEnd;
  elements.scheduleWorkDays.innerHTML = weekdayLabels
    .map(
      (day) => `
        <label class="admin-check-option ${scheduleForm.workDays.includes(day.value) ? "is-checked" : ""}">
          <input type="checkbox" value="${day.value}" ${scheduleForm.workDays.includes(day.value) ? "checked" : ""}>
          <span>${escapeHtml(day.label)}</span>
        </label>
      `
    )
    .join("");
  elements.scheduleBreaks.innerHTML = scheduleForm.breaks
    .map(
      (entry, index) => `
        <div class="admin-break-row">
          <div class="field-grid">
            <label class="field">
              <span>Начало</span>
              <input type="time" data-break-index="${index}" data-break-field="start" value="${escapeHtml(entry.start)}">
            </label>
            <label class="field">
              <span>Конец</span>
              <input type="time" data-break-index="${index}" data-break-field="end" value="${escapeHtml(entry.end)}">
            </label>
          </div>
          <label class="field field--full">
            <span>Подпись</span>
            <input type="text" data-break-index="${index}" data-break-field="label" value="${escapeHtml(entry.label)}">
          </label>
          <button type="button" class="button button--ghost button--mini" data-remove-break-index="${index}">Удалить</button>
        </div>
      `
    )
    .join("");
}

function handleScheduleSpecialistSelect() {
  state.operations.scheduleForm.specialistId = elements.scheduleSpecialistSelect.value;
  syncScheduleFormFromSpecialist(true);
}

function handleAddScheduleBreak() {
  state.operations.scheduleForm.breaks.push({
    start: "13:00",
    end: "14:00",
    label: "Перерыв"
  });
  renderScheduleSettingsForm();
}

function handleScheduleBreakClick(event) {
  const button = event.target.closest("[data-remove-break-index]");
  if (!button) {
    return;
  }

  const index = Number(button.dataset.removeBreakIndex);
  state.operations.scheduleForm.breaks.splice(index, 1);
  if (!state.operations.scheduleForm.breaks.length) {
    state.operations.scheduleForm.breaks.push({
      start: "13:00",
      end: "14:00",
      label: "Перерыв"
    });
  }
  renderScheduleSettingsForm();
}

function handleScheduleBreakInput(event) {
  const target = event.target;
  const index = Number(target.dataset.breakIndex);
  const field = target.dataset.breakField;

  if (!Number.isInteger(index) || !field || !state.operations.scheduleForm.breaks[index]) {
    return;
  }

  state.operations.scheduleForm.breaks[index][field] = target.value;
}

async function handleSpecialistScheduleSubmit(event) {
  event.preventDefault();

  if (!state.adminPin) {
    showToast("Сначала откройте админ-панель по PIN.", "info");
    return;
  }

  const specialistId = elements.scheduleSpecialistSelect.value;
  const workDays = Array.from(
    elements.scheduleWorkDays.querySelectorAll("input:checked"),
    (input) => Number(input.value)
  ).sort((left, right) => left - right);

  try {
    await fetchJson(`/api/admin/specialists/${specialistId}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({
        workDays,
        workHours: {
          start: elements.scheduleWorkStart.value,
          end: elements.scheduleWorkEnd.value
        },
        breaks: state.operations.scheduleForm.breaks
      })
    });

    await loadBootstrap();
    await loadAdminData();
    state.operations.scheduleForm.specialistId = specialistId;
    syncScheduleFormFromSpecialist(true);
    showToast("График специалиста сохранен.", "success");
  } catch (error) {
    showToast(error.message || "Не удалось сохранить график.", "error");
  }
}

function handleAdminTableClick(event) {
  const editButton = event.target.closest("[data-edit-booking-id]");
  if (editButton) {
    const booking = state.adminData?.bookings?.find((item) => item.id === editButton.dataset.editBookingId);
    if (booking) {
      populateBookingForm(booking);
    }
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-booking-id]");
  if (cancelButton) {
    state.operations.bookingForm.id = cancelButton.dataset.cancelBookingId;
    state.operations.bookingForm.mode = "edit";
    void handleAdminBookingCancel();
  }
}

function handleScheduleBoardClick(event) {
  const editButton = event.target.closest("[data-edit-booking-id]");
  if (editButton) {
    const booking = state.adminData?.bookings?.find((item) => item.id === editButton.dataset.editBookingId);
    if (booking) {
      populateBookingForm(booking);
    }
    return;
  }

  const deleteBlockButton = event.target.closest("[data-delete-block-id]");
  if (!deleteBlockButton || !state.adminPin) {
    return;
  }

  void (async () => {
    try {
      await fetchJson(`/api/admin/blocks/${deleteBlockButton.dataset.deleteBlockId}`, {
        method: "DELETE"
      });
      await loadDaySchedule();
      showToast("Блокировка удалена.", "success");
    } catch (error) {
      showToast(error.message || "Не удалось удалить блокировку.", "error");
    }
  })();
}

function renderAdminTable() {
  const bookings = state.adminData?.bookings || [];
  const filtered = bookings.filter((booking) => {
    const matchesStatus =
      state.filters.status === "all" || booking.status === state.filters.status;

    if (!matchesStatus) {
      return false;
    }

    if (!state.filters.search) {
      return true;
    }

    const haystack = [
      booking.reference,
      booking.clientName,
      booking.phone,
      booking.email,
      booking.serviceName,
      booking.specialistName,
      booking.notes
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.filters.search);
  });

  if (!filtered.length) {
    elements.adminTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">По текущим фильтрам ничего не найдено.</div>
        </td>
      </tr>
    `;
    return;
  }

  elements.adminTableBody.innerHTML = filtered
    .map(
      (booking) => `
        <tr>
          <td>
            <span class="table-main">${escapeHtml(booking.reference)}</span>
            <span class="table-sub">Создана ${escapeHtml(formatDateTime(booking.createdAt))}</span>
          </td>
          <td>
            <span class="table-main">${escapeHtml(booking.clientName)}</span>
            <span class="table-sub">${escapeHtml(booking.phone)}${booking.email ? `<br>${escapeHtml(booking.email)}` : ""}</span>
          </td>
          <td>
            <span class="table-main">${escapeHtml(booking.serviceName)}</span>
            <span class="table-sub">${escapeHtml(booking.specialistName)} · ${formatCurrency(booking.totalPrice)}</span>
          </td>
          <td>
            <span class="table-main">${escapeHtml(formatDate(booking.date))}</span>
            <span class="table-sub">${escapeHtml(booking.slot)} - ${escapeHtml(booking.endsAt)}</span>
          </td>
          <td>
            <select class="status-select" data-booking-id="${escapeHtml(booking.id)}">
              ${Object.entries(statusLabels)
                .map(
                  ([value, label]) =>
                    `<option value="${escapeHtml(value)}" ${booking.status === value ? "selected" : ""}>${escapeHtml(label)}</option>`
                )
                .join("")}
            </select>
          </td>
          <td>
            <span class="table-main">${booking.notes ? escapeHtml(booking.notes) : "—"}</span>
            <span class="table-sub">Статус: ${escapeHtml(statusLabels[booking.status])}</span>
            <div class="table-actions">
              <button type="button" class="button button--ghost button--mini" data-edit-booking-id="${escapeHtml(booking.id)}">Редактировать</button>
              <button type="button" class="button button--ghost button--mini" data-cancel-booking-id="${escapeHtml(booking.id)}">Отменить</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}
