const state = {
  services: [],
  specialists: [],
  site: null,
  selectedSlot: null,
  availability: [],
  currency: "MDL",
  bookingProtectionToken: "",
  bookingFormStartedAt: 0,
  superUserTapCount: 0,
  superUserTapTimer: null
};

let revealObserver;
let availabilityRequestToken = 0;

const elements = {
  metaDescription: document.getElementById("metaDescription"),
  brandEyebrow: document.getElementById("brandEyebrow"),
  brandName: document.getElementById("brandName"),
  navOverviewLink: document.getElementById("navOverviewLink"),
  navServicesLink: document.getElementById("navServicesLink"),
  navSpecialistsLink: document.getElementById("navSpecialistsLink"),
  navBookingLink: document.getElementById("navBookingLink"),
  heroKicker: document.getElementById("heroKicker"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  heroPrimaryCta: document.getElementById("heroPrimaryCta"),
  heroSecondaryCta: document.getElementById("heroSecondaryCta"),
  heroBadges: document.getElementById("heroBadges"),
  heroStats: document.getElementById("heroStats"),
  heroAsideEyebrow: document.getElementById("heroAsideEyebrow"),
  heroAsideTitle: document.getElementById("heroAsideTitle"),
  heroAsideFooter: document.getElementById("heroAsideFooter"),
  heroHighlights: document.getElementById("heroHighlights"),
  overviewSectionKicker: document.getElementById("overviewSectionKicker"),
  overviewSectionTitle: document.getElementById("overviewSectionTitle"),
  overviewSectionCopy: document.getElementById("overviewSectionCopy"),
  featureGrid: document.getElementById("featureGrid"),
  servicesSectionKicker: document.getElementById("servicesSectionKicker"),
  servicesSectionTitle: document.getElementById("servicesSectionTitle"),
  servicesSectionCopy: document.getElementById("servicesSectionCopy"),
  servicesGrid: document.getElementById("servicesGrid"),
  specialistsSectionKicker: document.getElementById("specialistsSectionKicker"),
  specialistsSectionTitle: document.getElementById("specialistsSectionTitle"),
  specialistsSectionCopy: document.getElementById("specialistsSectionCopy"),
  specialistsGrid: document.getElementById("specialistsGrid"),
  processSectionKicker: document.getElementById("processSectionKicker"),
  processSectionTitle: document.getElementById("processSectionTitle"),
  processSectionCopy: document.getElementById("processSectionCopy"),
  processGrid: document.getElementById("processGrid"),
  bookingSectionKicker: document.getElementById("bookingSectionKicker"),
  bookingSectionTitle: document.getElementById("bookingSectionTitle"),
  bookingSectionCopy: document.getElementById("bookingSectionCopy"),
  reviewsGrid: document.getElementById("reviewsGrid"),
  faqList: document.getElementById("faqList"),
  reviewsSectionKicker: document.getElementById("reviewsSectionKicker"),
  reviewsSectionTitle: document.getElementById("reviewsSectionTitle"),
  reviewsSectionCopy: document.getElementById("reviewsSectionCopy"),
  serviceLabel: document.getElementById("serviceLabel"),
  serviceSelect: document.getElementById("serviceSelect"),
  specialistLabel: document.getElementById("specialistLabel"),
  specialistSelect: document.getElementById("specialistSelect"),
  dateLabel: document.getElementById("dateLabel"),
  dateInput: document.getElementById("dateInput"),
  slotsLabel: document.getElementById("slotsLabel"),
  slotGrid: document.getElementById("slotGrid"),
  slotStatus: document.getElementById("slotStatus"),
  bookingForm: document.getElementById("bookingForm"),
  submitBookingBtn: document.getElementById("submitBookingBtn"),
  bookingFormNote: document.getElementById("bookingFormNote"),
  clientNameLabel: document.getElementById("clientNameLabel"),
  clientName: document.getElementById("clientName"),
  clientPhoneLabel: document.getElementById("clientPhoneLabel"),
  clientPhone: document.getElementById("clientPhone"),
  clientEmailLabel: document.getElementById("clientEmailLabel"),
  clientEmail: document.getElementById("clientEmail"),
  clientNotesLabel: document.getElementById("clientNotesLabel"),
  clientNotes: document.getElementById("clientNotes"),
  clientWebsite: document.getElementById("clientWebsite"),
  formStartedAt: document.getElementById("formStartedAt"),
  bookingSummaryKicker: document.getElementById("bookingSummaryKicker"),
  bookingSummary: document.getElementById("bookingSummary"),
  contactCardKicker: document.getElementById("contactCardKicker"),
  contactInfo: document.getElementById("contactInfo"),
  footerEyebrow: document.getElementById("footerEyebrow"),
  footerBrandTitle: document.getElementById("footerBrandTitle"),
  footerCopy: document.getElementById("footerCopy"),
  footerContacts: document.getElementById("footerContacts"),
  footerOverviewLink: document.getElementById("footerOverviewLink"),
  footerServicesLink: document.getElementById("footerServicesLink"),
  footerSpecialistsLink: document.getElementById("footerSpecialistsLink"),
  footerBookingLink: document.getElementById("footerBookingLink"),
  toastStack: document.getElementById("toastStack"),
  navToggle: document.getElementById("navToggle"),
  siteNav: document.getElementById("siteNav"),
  superUserTrigger: document.getElementById("superUserTrigger"),
  adminAccessModal: document.getElementById("adminAccessModal"),
  superUserForm: document.getElementById("superUserForm"),
  superUserPin: document.getElementById("superUserPin"),
  superUserSubmitBtn: document.getElementById("superUserSubmitBtn"),
  superUserCancelBtn: document.getElementById("superUserCancelBtn")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  setDateConstraints();
  initRevealObserver();

  try {
    await loadBootstrap();
  } catch (error) {
    showToast(error.message || "Не удалось загрузить информацию о студии.", "error");
  }
}

function bindEvents() {
  elements.navToggle.addEventListener("click", toggleMobileNav);
  elements.superUserTrigger.addEventListener("click", handleSuperUserTrigger);
  elements.superUserForm.addEventListener("submit", handleSuperUserSubmit);
  elements.superUserCancelBtn.addEventListener("click", closeAdminAccessModal);

  document.addEventListener("keydown", handleGlobalKeydown);

  document.addEventListener("click", async (event) => {
    const navLink = event.target.closest(".nav__link");
    if (navLink) {
      closeMobileNav();
    }

    const serviceButton = event.target.closest("[data-prefill-service]");
    if (serviceButton) {
      elements.serviceSelect.value = serviceButton.dataset.prefillService;
      updateSpecialistOptions();
      await refreshAvailability();
      refreshBookingSummary();
      document.getElementById("booking").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const specialistButton = event.target.closest("[data-prefill-specialist]");
    if (specialistButton) {
      const serviceId = specialistButton.dataset.prefillService || elements.serviceSelect.value;
      if (serviceId) {
        elements.serviceSelect.value = serviceId;
      }
      updateSpecialistOptions();
      elements.specialistSelect.value = specialistButton.dataset.prefillSpecialist;
      state.selectedSlot = null;
      await refreshAvailability();
      refreshBookingSummary();
      document.getElementById("booking").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const slotButton = event.target.closest("[data-slot-time]");
    if (slotButton) {
      state.selectedSlot = slotButton.dataset.slotTime;
      renderSlotButtons();
      refreshBookingSummary();
      return;
    }

    if (
      elements.adminAccessModal &&
      !elements.adminAccessModal.hidden &&
      event.target.closest("[data-close-admin-modal]")
    ) {
      closeAdminAccessModal();
    }
  });

  [elements.serviceSelect, elements.specialistSelect, elements.dateInput].forEach((control) => {
    control.addEventListener("change", async (event) => {
      if (event.target === elements.serviceSelect) {
        updateSpecialistOptions();
      }

      state.selectedSlot = null;
      await refreshAvailability();
      refreshBookingSummary();
    });
  });

  [elements.clientName, elements.clientPhone, elements.clientEmail, elements.clientNotes].forEach((input) => {
    input.addEventListener("input", refreshBookingSummary);
  });

  elements.bookingForm.addEventListener("submit", handleBookingSubmit);
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && elements.adminAccessModal && !elements.adminAccessModal.hidden) {
    closeAdminAccessModal();
    return;
  }

  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    openAdminAccessModal();
  }
}

function handleSuperUserTrigger(event) {
  state.superUserTapCount += 1;

  if (state.superUserTapTimer) {
    window.clearTimeout(state.superUserTapTimer);
  }

  state.superUserTapTimer = window.setTimeout(() => {
    state.superUserTapCount = 0;
  }, 1800);

  if (state.superUserTapCount >= 5) {
    event.preventDefault();
    state.superUserTapCount = 0;
    openAdminAccessModal();
  }
}

function openAdminAccessModal() {
  elements.adminAccessModal.hidden = false;
  document.body.classList.add("has-modal");
  elements.superUserPin.value = "";
  window.setTimeout(() => {
    elements.superUserPin.focus();
  }, 30);
}

function closeAdminAccessModal() {
  elements.adminAccessModal.hidden = true;
  document.body.classList.remove("has-modal");
}

async function handleSuperUserSubmit(event) {
  event.preventDefault();

  const pin = elements.superUserPin.value.trim();

  if (!pin) {
    showToast("Введите служебный PIN.", "info");
    return;
  }

  elements.superUserSubmitBtn.disabled = true;
  elements.superUserSubmitBtn.textContent = "Проверяю...";

  try {
    await fetchJson("/api/admin/session", {
      method: "POST",
      body: JSON.stringify({
        pin
      })
    });

    window.location.href = "/admin";
  } catch (error) {
    showToast(error.message || "PIN не подошел.", "error");
  } finally {
    elements.superUserSubmitBtn.disabled = false;
    elements.superUserSubmitBtn.textContent = "Открыть кабинет";
  }
}

async function loadBootstrap() {
  const payload = await fetchJson("/api/bootstrap");
  state.services = payload.services;
  state.specialists = payload.specialists;
  state.site = payload.site;
  state.currency = payload.site?.brand?.currency || "MDL";
  state.bookingProtectionToken = payload.meta?.bookingProtectionToken || "";

  renderStaticContent();
  populateServiceOptions();
  updateSpecialistOptions();
  resetBookingFormProtection();
  refreshBookingSummary();
  syncRevealTargets();
}

function renderStaticContent() {
  if (!state.site) {
    return;
  }

  const { site } = state;
  const sections = site.sections || {};
  const bookingSection = sections.booking || {};
  const bookingForm = site.bookingForm || {};
  const navigation = site.navigation || {};
  const ui = site.ui || {};

  document.title = site.seo?.title || document.title;
  if (elements.metaDescription) {
    elements.metaDescription.setAttribute(
      "content",
      site.seo?.description || elements.metaDescription.getAttribute("content") || ""
    );
  }

  elements.brandEyebrow.textContent = site.brand.eyebrow || "";
  elements.brandName.textContent = site.brand.name;
  elements.navOverviewLink.textContent = navigation.overview || "";
  elements.navServicesLink.textContent = navigation.services || "";
  elements.navSpecialistsLink.textContent = navigation.specialists || "";
  elements.navBookingLink.textContent = navigation.booking || "";
  elements.heroKicker.textContent = site.hero.kicker || "";
  elements.heroTitle.textContent = site.hero.title;
  elements.heroSubtitle.textContent = site.hero.subtitle;
  elements.heroPrimaryCta.textContent = site.hero.primaryCta || "";
  elements.heroSecondaryCta.textContent = site.hero.secondaryCta || "";
  elements.heroAsideEyebrow.textContent = site.hero.asideEyebrow || "";
  elements.heroAsideTitle.textContent = site.hero.asideTitle || "";
  elements.footerEyebrow.textContent = sections.footer?.eyebrow || site.brand.name;
  elements.footerBrandTitle.textContent = site.brand.tagline;
  elements.footerCopy.textContent = sections.footer?.copy || "";
  elements.footerOverviewLink.textContent = navigation.overview || "";
  elements.footerServicesLink.textContent = navigation.services || "";
  elements.footerSpecialistsLink.textContent = navigation.specialists || "";
  elements.footerBookingLink.textContent = navigation.booking || "";

  elements.overviewSectionKicker.textContent = sections.overview?.kicker || "";
  elements.overviewSectionTitle.textContent = sections.overview?.title || "";
  elements.overviewSectionCopy.textContent = sections.overview?.copy || "";
  elements.servicesSectionKicker.textContent = sections.services?.kicker || "";
  elements.servicesSectionTitle.textContent = sections.services?.title || "";
  elements.servicesSectionCopy.textContent = sections.services?.copy || "";
  elements.specialistsSectionKicker.textContent = sections.specialists?.kicker || "";
  elements.specialistsSectionTitle.textContent = sections.specialists?.title || "";
  elements.specialistsSectionCopy.textContent = sections.specialists?.copy || "";
  elements.processSectionKicker.textContent = sections.process?.kicker || "";
  elements.processSectionTitle.textContent = sections.process?.title || "";
  elements.processSectionCopy.textContent = sections.process?.copy || "";
  elements.bookingSectionKicker.textContent = bookingSection.kicker || "";
  elements.bookingSectionTitle.textContent = bookingSection.title || "";
  elements.bookingSectionCopy.textContent = bookingSection.copy || "";
  elements.reviewsSectionKicker.textContent = sections.reviews?.kicker || "";
  elements.reviewsSectionTitle.textContent = sections.reviews?.title || "";
  elements.reviewsSectionCopy.textContent = sections.reviews?.copy || "";

  elements.serviceLabel.textContent = bookingForm.serviceLabel || "";
  elements.specialistLabel.textContent = bookingForm.specialistLabel || "";
  elements.dateLabel.textContent = bookingForm.dateLabel || "";
  elements.slotsLabel.textContent = bookingForm.slotsLabel || "";
  elements.slotStatus.textContent = bookingSection.slotHint || "";
  elements.clientNameLabel.textContent = bookingForm.nameLabel || "";
  elements.clientName.placeholder = bookingForm.namePlaceholder || "";
  elements.clientPhoneLabel.textContent = bookingForm.phoneLabel || "";
  elements.clientPhone.placeholder = bookingForm.phonePlaceholder || "";
  elements.clientEmailLabel.textContent = bookingForm.emailLabel || "";
  elements.clientEmail.placeholder = bookingForm.emailPlaceholder || "";
  elements.clientNotesLabel.textContent = bookingForm.notesLabel || "";
  elements.clientNotes.placeholder = bookingForm.notesPlaceholder || "";
  elements.submitBookingBtn.textContent = bookingForm.submitLabel || "";
  elements.bookingFormNote.textContent = bookingSection.note || "";
  elements.bookingSummaryKicker.textContent = bookingSection.summaryKicker || "";
  elements.contactCardKicker.textContent = bookingSection.contactsKicker || "";

  elements.heroBadges.innerHTML = site.hero.badges
    .map((badge) => `<span class="pill">${escapeHtml(badge)}</span>`)
    .join("");

  elements.heroStats.innerHTML = site.hero.stats
    .map(
      (item) => `
        <div class="stat-card">
          <strong>${escapeHtml(item.value)}</strong>
          <span>${escapeHtml(item.label)}</span>
        </div>
      `
    )
    .join("");

  elements.heroHighlights.innerHTML = site.overview
    .map(
      (item) => `
        <div class="hero-card__item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `
    )
    .join("");

  elements.heroAsideFooter.innerHTML = (site.hero.asideTags || [])
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  elements.featureGrid.innerHTML = site.overview
    .map(
      (item, index) => `
        <article class="feature-card reveal">
          <span class="feature-card__index">${escapeHtml(ui.featurePrefix || "Преимущество")} ${String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </article>
      `
    )
    .join("");

  elements.servicesGrid.innerHTML = state.services
    .map(
      (service) => `
        <article class="service-card reveal">
          <span class="feature-card__index">${escapeHtml(service.category)}</span>
          <h3>${escapeHtml(service.name)}</h3>
          <p>${escapeHtml(service.description)}</p>

          <div class="service-card__meta">
            <span class="meta-chip">${formatCurrency(service.price)}</span>
            <span class="meta-chip">${service.duration} мин</span>
          </div>

          <div class="service-card__benefits">
            ${service.benefits.map((benefit) => `<span>${escapeHtml(benefit)}</span>`).join("")}
          </div>

          <div class="service-card__actions">
            <button type="button" class="button button--primary" data-prefill-service="${escapeHtml(service.id)}">
              ${escapeHtml(ui.serviceCardCta || "Выбрать")}
            </button>
          </div>
        </article>
      `
    )
    .join("");

  elements.specialistsGrid.innerHTML = state.specialists
    .map((specialist) => {
      const specialties = specialist.specialties
        .map((serviceId) => findService(serviceId)?.name)
        .filter(Boolean)
        .slice(0, 3)
        .map((name) => `<span class="meta-chip">${escapeHtml(name)}</span>`)
        .join("");

      const preferredService = specialist.specialties[0] || "";

      return `
        <article class="specialist-card reveal">
          <div class="specialist-card__avatar">${escapeHtml(specialist.initials)}</div>
          <div class="specialist-card__role">${escapeHtml(specialist.role)}</div>
          <h3>${escapeHtml(specialist.name)}</h3>
          <p>${escapeHtml(specialist.bio)}</p>

          <div class="specialist-card__meta">
            <span class="meta-chip">${escapeHtml(specialist.experience)}</span>
            ${specialties}
          </div>

          <div class="specialist-card__actions">
            <button
              type="button"
              class="button button--ghost"
              data-prefill-specialist="${escapeHtml(specialist.id)}"
              data-prefill-service="${escapeHtml(preferredService)}"
            >
              ${escapeHtml(ui.specialistCardCta || "Выбрать мастера")}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.processGrid.innerHTML = site.process
    .map(
      (item, index) => `
        <article class="process-card reveal">
          <span class="process-card__index">${escapeHtml(ui.processPrefix || "Шаг")} ${index + 1}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");

  elements.reviewsGrid.innerHTML = site.reviews
    .map(
      (review) => `
        <article class="review-card reveal">
          <h3>${escapeHtml(review.author)}</h3>
          <div class="review-card__meta">${escapeHtml(review.meta)}</div>
          <p>${escapeHtml(review.text)}</p>
        </article>
      `
    )
    .join("");

  elements.faqList.innerHTML = site.faq
    .map(
      (item) => `
        <details class="faq-item reveal">
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>
      `
    )
    .join("");

  elements.contactInfo.innerHTML = `
    <div class="contact-list">
      <div class="contact-item">
        <strong>${escapeHtml(ui.contactAddressLabel || "Адрес")}</strong>
        <span>${escapeHtml(site.brand.city)}, ${escapeHtml(site.brand.address)}</span>
      </div>
      <div class="contact-item">
        <strong>${escapeHtml(ui.contactPhoneLabel || "Телефон")}</strong>
        <span>${escapeHtml(site.brand.phone)}</span>
      </div>
      <div class="contact-item">
        <strong>${escapeHtml(ui.contactEmailLabel || "Email")}</strong>
        <span>${escapeHtml(site.brand.email)}</span>
      </div>
      <div class="contact-item">
        <strong>${escapeHtml(ui.contactHoursLabel || "График")}</strong>
        <span>${escapeHtml(site.brand.hours)}</span>
      </div>
    </div>
  `;

  elements.footerContacts.innerHTML = `
    <div class="footer-contact">
      <strong>${escapeHtml(ui.footerPhoneLabel || "Телефон")}</strong>
      <span>${escapeHtml(site.brand.phone)}</span>
    </div>
    <div class="footer-contact">
      <strong>${escapeHtml(ui.footerEmailLabel || "Email")}</strong>
      <span>${escapeHtml(site.brand.email)}</span>
    </div>
    <div class="footer-contact">
      <strong>${escapeHtml(ui.footerAddressLabel || "Адрес")}</strong>
      <span>${escapeHtml(site.brand.city)}, ${escapeHtml(site.brand.address)}</span>
    </div>
    <div class="footer-contact">
      <strong>${escapeHtml(ui.footerTelegramLabel || "Telegram")}</strong>
      <span>${escapeHtml(site.brand.telegram)}</span>
    </div>
  `;
}

function populateServiceOptions() {
  const currentValue = elements.serviceSelect.value;
  const serviceLabel = state.site?.bookingForm?.serviceLabel || "Процедура";

  elements.serviceSelect.innerHTML = [
    `<option value="">Выберите ${escapeHtml(serviceLabel).toLowerCase()}</option>`,
    ...state.services.map(
      (service) =>
        `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)} · ${service.duration} мин · ${formatCurrency(service.price)}</option>`
    )
  ].join("");

  if (state.services.some((service) => service.id === currentValue)) {
    elements.serviceSelect.value = currentValue;
  }
}

function updateSpecialistOptions() {
  const serviceId = elements.serviceSelect.value;
  const currentValue = elements.specialistSelect.value;
  const specialistLabel = state.site?.bookingForm?.specialistLabel || "специалиста";
  const serviceLabel = state.site?.bookingForm?.serviceLabel || "процедуру";

  const availableSpecialists = serviceId
    ? state.specialists.filter((specialist) => specialist.specialties.includes(serviceId))
    : state.specialists;

  const placeholder = serviceId
    ? `Выберите ${specialistLabel.toLowerCase()}`
    : `Сначала выберите ${serviceLabel.toLowerCase()}`;

  elements.specialistSelect.innerHTML = [
    `<option value="">${placeholder}</option>`,
    ...availableSpecialists.map(
      (specialist) =>
        `<option value="${escapeHtml(specialist.id)}">${escapeHtml(specialist.name)} · ${escapeHtml(specialist.role)}</option>`
    )
  ].join("");

  if (availableSpecialists.some((specialist) => specialist.id === currentValue)) {
    elements.specialistSelect.value = currentValue;
  } else {
    elements.specialistSelect.value = "";
  }
}

async function refreshAvailability() {
  const serviceId = elements.serviceSelect.value;
  const specialistId = elements.specialistSelect.value;
  const date = elements.dateInput.value;

  if (!serviceId || !specialistId || !date) {
    state.availability = [];
    state.selectedSlot = null;
    elements.slotGrid.innerHTML = "";
    elements.slotStatus.textContent =
      state.site?.sections?.booking?.slotHint || "Сначала выберите процедуру, специалиста и дату.";
    return;
  }

  const currentToken = ++availabilityRequestToken;
  elements.slotStatus.textContent = "Проверяю свободные окна...";
  elements.slotGrid.innerHTML = '<div class="empty-state">Загружаю доступные слоты...</div>';

  try {
    const params = new URLSearchParams({
      serviceId,
      specialistId,
      date
    });

    const payload = await fetchJson(`/api/availability?${params.toString()}`);

    if (currentToken !== availabilityRequestToken) {
      return;
    }

    state.availability = payload.slots;

    if (!state.availability.some((slot) => slot.time === state.selectedSlot)) {
      state.selectedSlot = null;
    }

    elements.slotStatus.textContent = payload.message;
    renderSlotButtons();
  } catch (error) {
    state.availability = [];
    state.selectedSlot = null;
    elements.slotStatus.textContent = "Не удалось загрузить слоты.";
    elements.slotGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderSlotButtons() {
  if (!state.availability.length) {
    elements.slotGrid.innerHTML =
      '<div class="empty-state">Для выбранных параметров свободных окон нет. Попробуй другую дату или специалиста.</div>';
    return;
  }

  elements.slotGrid.innerHTML = state.availability
    .map(
      (slot) => `
        <button
          type="button"
          class="slot-button ${slot.time === state.selectedSlot ? "is-active" : ""}"
          data-slot-time="${escapeHtml(slot.time)}"
        >
          <strong>${escapeHtml(slot.time)}</strong>
          <span>до ${escapeHtml(slot.endsAt)}</span>
        </button>
      `
    )
    .join("");
}

function refreshBookingSummary() {
  const service = findService(elements.serviceSelect.value);
  const specialist = findSpecialist(elements.specialistSelect.value);
  const slot = state.availability.find((item) => item.time === state.selectedSlot);
  const ui = state.site?.ui || {};

  elements.bookingSummary.innerHTML = `
    <div class="summary-list">
      ${summaryRow(ui.summaryServiceLabel || "Процедура", service ? service.name : "Не выбрана")}
      ${summaryRow(ui.summarySpecialistLabel || "Специалист", specialist ? specialist.name : "Не выбран")}
      ${summaryRow(ui.summaryDateLabel || "Дата", elements.dateInput.value ? formatDate(elements.dateInput.value) : "Не выбрана")}
      ${summaryRow(ui.summaryTimeLabel || "Время", state.selectedSlot ? `${state.selectedSlot} - ${slot?.endsAt || ""}` : "Слот не выбран")}
      ${summaryRow(ui.summaryPriceLabel || "Стоимость", service ? formatCurrency(service.price) : "Будет показана после выбора")}
      ${summaryRow(ui.summaryClientLabel || "Клиент", elements.clientName.value.trim() || "Имя еще не заполнено")}
      ${summaryRow(ui.summaryContactLabel || "Контакт", elements.clientPhone.value.trim() || "Телефон еще не заполнен")}
    </div>
  `;
}

async function handleBookingSubmit(event) {
  event.preventDefault();

  if (!state.selectedSlot) {
    showToast("Сначала выбери свободный слот для записи.", "error");
    return;
  }

  if (!state.bookingProtectionToken) {
    showToast("Обновите страницу и попробуйте снова.", "error");
    return;
  }

  const emailRaw = elements.clientEmail.value.trim();
  if (!emailRaw) {
    showToast("Укажите email — на него придёт подтверждение записи.", "error");
    elements.clientEmail.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    showToast("Проверьте формат email.", "error");
    elements.clientEmail.focus();
    return;
  }

  const payload = {
    serviceId: elements.serviceSelect.value,
    specialistId: elements.specialistSelect.value,
    date: elements.dateInput.value,
    slot: state.selectedSlot,
    clientName: elements.clientName.value.trim(),
    phone: elements.clientPhone.value.trim(),
    email: elements.clientEmail.value.trim(),
    notes: elements.clientNotes.value.trim(),
    website: elements.clientWebsite?.value?.trim() || "",
    formToken: state.bookingProtectionToken,
    formStartedAt: Number(elements.formStartedAt?.value || state.bookingFormStartedAt)
  };

  elements.submitBookingBtn.disabled = true;
  elements.submitBookingBtn.textContent = "Сохраняю запись...";

  try {
    const result = await fetchJson("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    showBookingSuccess(result.booking);
    state.bookingProtectionToken = result.meta?.bookingProtectionToken || state.bookingProtectionToken;
    elements.bookingForm.reset();
    resetBookingFormProtection();
    setDateConstraints();
    state.selectedSlot = null;
    updateSpecialistOptions();
    await refreshAvailability();
    refreshBookingSummary();
  } catch (error) {
    showToast(error.message || "Не удалось создать запись.", "error");
  } finally {
    elements.submitBookingBtn.disabled = false;
    elements.submitBookingBtn.textContent =
      state.site?.bookingForm?.submitLabel || "Подтвердить запись";
  }
}

function setDateConstraints() {
  const today = getLocalDateString();
  elements.dateInput.min = today;

  if (!elements.dateInput.value || elements.dateInput.value < today) {
    elements.dateInput.value = today;
  }
}

function resetBookingFormProtection() {
  state.bookingFormStartedAt = Date.now();

  if (elements.formStartedAt) {
    elements.formStartedAt.value = String(state.bookingFormStartedAt);
  }

  if (elements.clientWebsite) {
    elements.clientWebsite.value = "";
  }
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
      threshold: 0.16,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  syncRevealTargets();
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
  });
}

function toggleMobileNav() {
  const expanded = elements.navToggle.getAttribute("aria-expanded") === "true";
  elements.navToggle.setAttribute("aria-expanded", String(!expanded));
  elements.siteNav.classList.toggle("is-open", !expanded);
}

function closeMobileNav() {
  elements.navToggle.setAttribute("aria-expanded", "false");
  elements.siteNav.classList.remove("is-open");
}

function findService(serviceId) {
  return state.services.find((service) => service.id === serviceId);
}

function findSpecialist(specialistId) {
  return state.specialists.find((specialist) => specialist.id === specialistId);
}

function summaryRow(label, value) {
  return `
    <div class="summary-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
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

function showToast(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.textContent = message;
  elements.toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

function showBookingSuccess(booking) {
  const cancelUrl = `/cancel?ref=${encodeURIComponent(booking.reference)}`;
  const toast = document.createElement("div");
  toast.className = "toast toast--success";
  toast.style.cssText = "max-width:360px; line-height:1.5;";
  toast.innerHTML =
    `Запись создана. Номер: <strong>${booking.reference}</strong><br>` +
    `<a href="${cancelUrl}" style="color:inherit; opacity:0.8; font-size:0.8125rem;">Отменить запись</a>`;
  elements.toastStack.appendChild(toast);

  window.setTimeout(() => toast.remove(), 7000);
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
