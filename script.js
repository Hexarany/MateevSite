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
  superUserTapTimer: null,
  lang: localStorage.getItem('lang') || 'ru',
  bookingDuration: 0,
  appliedCert: null,
  serviceFilter: "all",
  servicesExpanded: false
};

function tr(ruValue, roValue) {
  if (state.lang === 'ro' && roValue != null) return roValue;
  return ruValue;
}

function trSite(path, fallback) {
  const keys = path.split('.');
  if (state.lang === 'ro') {
    let ro = state.site?.translations?.ro;
    for (const k of keys) { ro = ro?.[k]; }
    if (ro) return ro;
  }
  let val = state.site;
  for (const k of keys) { val = val?.[k]; }
  return val || fallback || '';
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-ru]").forEach(el => {
    el.textContent = tr(el.dataset.ru, el.dataset.ro);
  });
}

function trArr(key) {
  if (state.lang === 'ro') {
    const ro = state.site?.translations?.ro?.[key];
    if (Array.isArray(ro) && ro.length) return ro;
  }
  return state.site?.[key] || [];
}

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
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("is-active", b.dataset.lang === state.lang));
  applyStaticTranslations();

  try {
    await loadBootstrap();
    applyUrlPrefill();
  } catch (error) {
    showToast(error.message || "Не удалось загрузить информацию о студии.", "error");
  }
}

function applyUrlPrefill() {
  const params = new URLSearchParams(location.search || location.hash.replace(/^#booking\?/, ""));
  const serviceId    = params.get("prefillService");
  const specialistId = params.get("prefillSpecialist");
  if (!serviceId && !specialistId) return;

  if (serviceId) elements.serviceSelect.value = serviceId;
  updateSpecialistOptions();
  if (specialistId) elements.specialistSelect.value = specialistId;

  document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  refreshAvailability();
  refreshBookingSummary();
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

  document.addEventListener("click", (event) => {
    const langBtn = event.target.closest(".lang-btn");
    if (langBtn && langBtn.dataset.lang) {
      state.lang = langBtn.dataset.lang;
      localStorage.setItem('lang', state.lang);
      document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("is-active", b.dataset.lang === state.lang));
      if (state.site) {
        renderStaticContent();
        applyStaticTranslations();
        document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));
      }
    }
  });

  [elements.serviceSelect, elements.specialistSelect, elements.dateInput].forEach((control) => {
    control.addEventListener("change", async (event) => {
      if (event.target === elements.serviceSelect) {
        updateSpecialistOptions();
        updateDurationCalc();
      }

      state.selectedSlot = null;
      await refreshAvailability();
      refreshBookingSummary();
    });
  });

  document.getElementById("certApplyBtn")?.addEventListener("click", handleCertApply);

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".waitlist-submit");
    if (!btn) return;
    const block = btn.closest(".waitlist-block");
    const name  = block.querySelector(".waitlist-name").value.trim();
    const phone = block.querySelector(".waitlist-phone").value.trim();
    if (!name || !phone) { showToast(tr("Введите имя и телефон","Introduceți numele și telefonul"), "error"); return; }
    btn.disabled = true;
    btn.textContent = tr("Отправляю…","Trimit…");
    try {
      await fetchJson("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ name, phone, service: btn.dataset.service, specialist: btn.dataset.specialist, date: btn.dataset.date })
      });
      block.innerHTML = `<p class="waitlist-block__text" style="color:var(--success);font-weight:600;">✓ ${tr("Записали! Сообщим как только появится место.","V-am înregistrat! Vă vom anunța când apare un loc.")}</p>`;
    } catch {
      btn.disabled = false;
      btn.textContent = tr("Уведомить меня","Anunță-mă");
      showToast(tr("Ошибка. Попробуйте ещё раз.","Eroare. Încercați din nou."), "error");
    }
  });
  document.getElementById("certCode")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleCertApply(); }
  });

  document.getElementById("durationMinus")?.addEventListener("click", async () => {
    const svc = findService(elements.serviceSelect.value);
    if (!svc) return;
    const min = svc.duration;
    if (state.bookingDuration - 30 >= min) {
      state.bookingDuration -= 30;
      updateDurationCalc();
      state.selectedSlot = null;
      await refreshAvailability();
      refreshBookingSummary();
    }
  });

  document.getElementById("durationPlus")?.addEventListener("click", async () => {
    const svc = findService(elements.serviceSelect.value);
    if (!svc) return;
    state.bookingDuration += 30;
    updateDurationCalc();
    state.selectedSlot = null;
    await refreshAvailability();
    refreshBookingSummary();
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
  updateDurationCalc();
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

  elements.brandEyebrow.textContent = trSite('brand.eyebrow') || "";
  elements.brandName.textContent = site.brand.name;
  elements.navOverviewLink.textContent = trSite('navigation.overview') || "";
  elements.navServicesLink.textContent = trSite('navigation.services') || "";
  elements.navSpecialistsLink.textContent = trSite('navigation.specialists') || "";
  elements.navBookingLink.textContent = trSite('navigation.booking') || "";
  elements.heroKicker.textContent = trSite('hero.kicker') || "";
  elements.heroTitle.textContent = trSite('hero.title') || "";
  elements.heroSubtitle.textContent = trSite('hero.subtitle') || "";
  elements.heroPrimaryCta.textContent = trSite('hero.primaryCta') || "";
  elements.heroSecondaryCta.textContent = trSite('hero.secondaryCta') || "";
  elements.heroAsideEyebrow.textContent = trSite('hero.asideEyebrow') || "";
  elements.heroAsideTitle.textContent = trSite('hero.asideTitle') || "";
  elements.footerEyebrow.textContent = trSite('sections.footer.eyebrow') || site.brand.name;
  elements.footerBrandTitle.textContent = trSite('brand.tagline') || "";
  elements.footerCopy.textContent = trSite('sections.footer.copy') || "";
  elements.footerOverviewLink.textContent = trSite('navigation.overview') || "";
  elements.footerServicesLink.textContent = trSite('navigation.services') || "";
  elements.footerSpecialistsLink.textContent = trSite('navigation.specialists') || "";
  elements.footerBookingLink.textContent = trSite('navigation.booking') || "";

  elements.overviewSectionKicker.textContent = trSite('sections.overview.kicker') || "";
  elements.overviewSectionTitle.textContent = trSite('sections.overview.title') || "";
  elements.overviewSectionCopy.textContent = trSite('sections.overview.copy') || "";
  elements.servicesSectionKicker.textContent = trSite('sections.services.kicker') || "";
  elements.servicesSectionTitle.textContent = trSite('sections.services.title') || "";
  elements.servicesSectionCopy.textContent = trSite('sections.services.copy') || "";
  elements.specialistsSectionKicker.textContent = trSite('sections.specialists.kicker') || "";
  elements.specialistsSectionTitle.textContent = trSite('sections.specialists.title') || "";
  elements.specialistsSectionCopy.textContent = trSite('sections.specialists.copy') || "";
  elements.processSectionKicker.textContent = trSite('sections.process.kicker') || "";
  elements.processSectionTitle.textContent = trSite('sections.process.title') || "";
  elements.processSectionCopy.textContent = trSite('sections.process.copy') || "";
  elements.bookingSectionKicker.textContent = trSite('sections.booking.kicker') || "";
  elements.bookingSectionTitle.textContent = trSite('sections.booking.title') || "";
  elements.bookingSectionCopy.textContent = trSite('sections.booking.copy') || "";
  elements.reviewsSectionKicker.textContent = trSite('sections.reviews.kicker') || "";
  elements.reviewsSectionTitle.textContent = trSite('sections.reviews.title') || "";
  elements.reviewsSectionCopy.textContent = trSite('sections.reviews.copy') || "";

  elements.serviceLabel.textContent = trSite('bookingForm.serviceLabel') || "";
  elements.specialistLabel.textContent = trSite('bookingForm.specialistLabel') || "";
  elements.dateLabel.textContent = trSite('bookingForm.dateLabel') || "";
  elements.slotsLabel.textContent = trSite('bookingForm.slotsLabel') || "";
  elements.slotStatus.textContent = trSite('sections.booking.slotHint') || "";
  elements.clientNameLabel.textContent = trSite('bookingForm.nameLabel') || "";
  elements.clientName.placeholder = trSite('bookingForm.namePlaceholder') || "";
  elements.clientPhoneLabel.textContent = trSite('bookingForm.phoneLabel') || "";
  elements.clientPhone.placeholder = trSite('bookingForm.phonePlaceholder') || "";
  elements.clientEmailLabel.textContent = trSite('bookingForm.emailLabel') || "";
  elements.clientEmail.placeholder = trSite('bookingForm.emailPlaceholder') || "";
  elements.clientNotesLabel.textContent = trSite('bookingForm.notesLabel') || "";
  elements.clientNotes.placeholder = trSite('bookingForm.notesPlaceholder') || "";
  elements.submitBookingBtn.textContent = trSite('bookingForm.submitLabel') || "";
  elements.bookingFormNote.textContent = trSite('sections.booking.note') || "";
  elements.bookingSummaryKicker.textContent = trSite('sections.booking.summaryKicker') || "";
  elements.contactCardKicker.textContent = trSite('sections.booking.contactsKicker') || "";

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

  elements.heroHighlights.innerHTML = trArr("overview")
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

  elements.featureGrid.innerHTML = trArr("overview")
    .map(
      (item, index) => `
        <article class="feature-card reveal">
          <span class="feature-card__index">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </article>
      `
    )
    .join("");

  // Build category filter buttons
  const filtersEl = document.getElementById("serviceFilters");
  if (filtersEl && state.services.length) {
    const cats = [...new Set(state.services.map(s => s.category).filter(Boolean))];
    filtersEl.innerHTML = [
      `<button class="school-filter-btn${state.serviceFilter === "all" ? " is-active" : ""}" data-cat="all">${tr("Все процедуры","Toate procedurile")}</button>`,
      ...cats.map(c => `<button class="school-filter-btn${state.serviceFilter === c ? " is-active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    ].join("");
    filtersEl.querySelectorAll(".school-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.serviceFilter = btn.dataset.cat;
        state.servicesExpanded = false;
        renderStaticContent();
        document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));
      });
    });
  }

  const filteredServices = state.serviceFilter === "all"
    ? state.services
    : state.services.filter(s => s.category === state.serviceFilter);

  const PREVIEW_COUNT = 3;
  const visibleServices = state.servicesExpanded
    ? filteredServices
    : filteredServices.slice(0, PREVIEW_COUNT);

  elements.servicesGrid.innerHTML = visibleServices
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
              ${escapeHtml(trSite('ui.serviceCardCta') || "Выбрать")}
            </button>
          </div>
        </article>
      `
    )
    .join("");

  // Show more / show less button
  const existingBtn = document.getElementById("servicesShowMoreBtn");
  if (existingBtn) existingBtn.remove();

  if (filteredServices.length > PREVIEW_COUNT) {
    const btn = document.createElement("div");
    btn.id = "servicesShowMoreBtn";
    btn.style.cssText = "text-align:center; margin-top:28px;";
    if (!state.servicesExpanded) {
      btn.innerHTML = `<button class="button button--ghost" id="_servicesExpandBtn">
        ${tr(`Показать все (${filteredServices.length})`, `Arată toate (${filteredServices.length})`)}
      </button>`;
    } else {
      btn.innerHTML = `<button class="button button--ghost" id="_servicesExpandBtn">
        ${tr("Скрыть", "Ascunde")}
      </button>`;
    }
    elements.servicesGrid.insertAdjacentElement("afterend", btn);
    document.getElementById("_servicesExpandBtn")?.addEventListener("click", () => {
      state.servicesExpanded = !state.servicesExpanded;
      renderStaticContent();
      document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));
      if (!state.servicesExpanded) {
        document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

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
          ${specialist.photo
            ? `<img class="specialist-card__photo" src="${escapeHtml(specialist.photo)}" alt="${escapeHtml(specialist.name)}" loading="lazy">`
            : `<div class="specialist-card__avatar">${escapeHtml(specialist.initials)}</div>`
          }
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
              ${escapeHtml(trSite('ui.specialistCardCta') || "Выбрать мастера")}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.processGrid.innerHTML = trArr("process")
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

  elements.reviewsGrid.innerHTML = trArr("reviews")
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

  elements.faqList.innerHTML = trArr("faq")
    .map(
      (item) => `
        <details class="faq-item reveal">
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>
      `
    )
    .join("");

  const mapQuery = encodeURIComponent(`${site.brand.address}, ${site.brand.city}`);
  const mapEmbedUrl = `https://maps.google.com/maps?q=${mapQuery}&output=embed&z=16&hl=ru`;
  const mapOpenUrl  = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  elements.contactInfo.innerHTML = `
    <div class="contact-map">
      <iframe
        src="${mapEmbedUrl}"
        width="100%"
        height="180"
        style="border:0; border-radius:12px; display:block;"
        allowfullscreen=""
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        title="Расположение студии на карте"
      ></iframe>
      <a href="${mapOpenUrl}" target="_blank" rel="noopener" class="contact-map__link">
        Открыть на Google Maps →
      </a>
    </div>
    <div class="contact-list">
      <div class="contact-item">
        <strong>${escapeHtml(trSite('ui.contactAddressLabel') || "Адрес")}</strong>
        <span>${escapeHtml(site.brand.city)}, ${escapeHtml(site.brand.address)}</span>
      </div>
      <div class="contact-item">
        <strong>${escapeHtml(trSite('ui.contactPhoneLabel') || "Телефон")}</strong>
        <span>${escapeHtml(site.brand.phone)}</span>
      </div>
      <div class="contact-item">
        <strong>${escapeHtml(trSite('ui.contactEmailLabel') || "Email")}</strong>
        <span>${escapeHtml(site.brand.email)}</span>
      </div>
      <div class="contact-item">
        <strong>${escapeHtml(trSite('ui.contactHoursLabel') || "График")}</strong>
        <span>${escapeHtml(site.brand.hours)}</span>
      </div>
    </div>
  `;

  elements.footerContacts.innerHTML = `
    <div class="footer-contact">
      <strong>${escapeHtml(trSite('ui.contactPhoneLabel') || "Телефон")}</strong>
      <span>${escapeHtml(site.brand.phone)}</span>
    </div>
    <div class="footer-contact">
      <strong>${escapeHtml(trSite('ui.contactEmailLabel') || "Email")}</strong>
      <span>${escapeHtml(site.brand.email)}</span>
    </div>
    <div class="footer-contact">
      <strong>${escapeHtml(trSite('ui.contactAddressLabel') || "Адрес")}</strong>
      <span>${escapeHtml(site.brand.city)}, ${escapeHtml(site.brand.address)}</span>
    </div>
    <div class="footer-contact">
      <strong>Telegram</strong>
      <span>${escapeHtml(site.brand.telegram)}</span>
    </div>
    ${site.brand.instagram ? `
    <div class="footer-contact">
      <strong>Instagram</strong>
      <a href="https://instagram.com/${escapeHtml(site.brand.instagram.replace('@',''))}" target="_blank" rel="noopener" style="color:inherit; font-weight:600;">@${escapeHtml(site.brand.instagram.replace('@',''))}</a>
    </div>` : ""}
    <div class="footer-social">
      <a href="https://instagram.com/_mateevspa_" target="_blank" rel="noopener" class="social-btn" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
      <a href="https://t.me/Hardyty" target="_blank" rel="noopener" class="social-btn" aria-label="Telegram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>
      <a href="https://wa.me/37369158475" target="_blank" rel="noopener" class="social-btn" aria-label="WhatsApp"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>
    </div>
  `;
}

function populateServiceOptions() {
  const currentValue = elements.serviceSelect.value;
  const serviceLabel = state.site?.bookingForm?.serviceLabel || "Процедура";

  elements.serviceSelect.innerHTML = [
    `<option value="">${tr("Выберите процедуру", "Selectați procedura")}</option>`,
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
    ? tr("Выберите специалиста", "Selectați specialistul")
    : tr("Сначала выберите процедуру", "Mai întâi selectați procedura");

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
      trSite('sections.booking.slotHint') || "Сначала выберите процедуру, специалиста и дату.";
    return;
  }

  const currentToken = ++availabilityRequestToken;
  elements.slotStatus.textContent = "Проверяю свободные окна...";
  elements.slotGrid.innerHTML = '<div class="empty-state">Загружаю доступные слоты...</div>';

  try {
    const params = new URLSearchParams({ serviceId, specialistId, date });
    const svc = findService(serviceId);
    if (state.bookingDuration > 0 && svc && state.bookingDuration !== svc.duration) {
      params.set("customDuration", String(state.bookingDuration));
    }

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
    const service   = findService(elements.serviceSelect.value);
    const specialist = findSpecialist(elements.specialistSelect.value);
    const date      = elements.dateInput.value;
    const svcName   = service?.name || "";
    const specName  = specialist?.name || "";
    elements.slotGrid.innerHTML = `
      <div class="waitlist-block">
        <p class="waitlist-block__text">${tr(
          "На эту дату свободных окон нет. Оставьте контакт — сообщим если появится место.",
          "Nu sunt intervale disponibile. Lăsați contactul — vă vom anunța dacă apare un loc."
        )}</p>
        <div class="waitlist-block__form">
          <input type="text" class="waitlist-name" placeholder="${tr("Ваше имя","Numele dvs.")}" style="flex:1;">
          <input type="tel" class="waitlist-phone" placeholder="+373..." style="flex:1;">
          <button type="button" class="button button--ghost waitlist-submit"
            data-service="${escapeHtml(svcName)}" data-specialist="${escapeHtml(specName)}" data-date="${escapeHtml(date)}">
            ${tr("Уведомить меня","Anunță-mă")}
          </button>
        </div>
      </div>`;
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

  const rows = [
    summaryRow(trSite('ui.summaryServiceLabel') || "Процедура", service?.name),
    summaryRow(trSite('ui.summarySpecialistLabel') || "Специалист", specialist?.name),
    summaryRow(trSite('ui.summaryDateLabel') || "Дата", elements.dateInput.value ? formatDate(elements.dateInput.value) : ""),
    summaryRow(trSite('ui.summaryTimeLabel') || "Время", state.selectedSlot ? `${state.selectedSlot} — ${slot?.endsAt || ""}` : ""),
    summaryRow(trSite('ui.summaryPriceLabel') || "Стоимость", service ? (() => {
      if (state.bookingDuration > 0 && state.bookingDuration !== service.duration) {
        const p = Math.round((service.price / service.duration) * state.bookingDuration / 50) * 50;
        return `${formatCurrency(p)} (${state.bookingDuration} мин)`;
      }
      return formatCurrency(service.price);
    })() : ""),
    summaryRow(trSite('ui.summaryClientLabel') || "Клиент", elements.clientName.value.trim()),
    summaryRow(trSite('ui.summaryContactLabel') || "Контакт", elements.clientPhone.value.trim()),
    state.appliedCert ? summaryRow(tr("Сертификат", "Certificat"), `${state.appliedCert.code} (−${state.appliedCert.amount} MDL)`) : "",
  ].join("");

  elements.bookingSummary.innerHTML = rows
    ? `<div class="summary-list">${rows}</div>`
    : `<p class="summary-empty">Выберите процедуру, специалиста и дату — резюме появится здесь.</p>`;
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

  const svcForPayload = findService(elements.serviceSelect.value);
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
    formStartedAt: Number(elements.formStartedAt?.value || state.bookingFormStartedAt),
    ...(state.bookingDuration > 0 && svcForPayload && state.bookingDuration !== svcForPayload.duration
      ? { customDuration: state.bookingDuration }
      : {}),
    ...(state.appliedCert ? { certificateCode: state.appliedCert.code } : {})
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
    state.bookingDuration = 0;
    state.appliedCert = null;
    const calc = document.getElementById("durationCalc");
    if (calc) calc.hidden = true;
    const certStatus = document.getElementById("certStatus");
    if (certStatus) certStatus.hidden = true;
    const certCode = document.getElementById("certCode");
    if (certCode) certCode.value = "";
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
  initFabObserver();
}

function initFabObserver() {
  const fab = document.getElementById("fabBooking");
  const bookingSection = document.getElementById("booking");
  const heroSection = document.getElementById("home");
  if (!fab || !bookingSection) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const bookingVisible = entries.some(
        (e) => e.target === bookingSection && e.isIntersecting
      );
      const heroVisible = entries.some(
        (e) => e.target === heroSection && e.isIntersecting
      );
      fab.classList.toggle("is-visible", !bookingVisible && !heroVisible);
    },
    { threshold: 0.15 }
  );

  observer.observe(bookingSection);
  if (heroSection) observer.observe(heroSection);
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

async function handleCertApply() {
  const input = document.getElementById("certCode");
  const statusEl = document.getElementById("certStatus");
  if (!input || !statusEl) return;

  const code = input.value.trim().toUpperCase();
  if (!code) return;

  try {
    const data = await fetchJson(`/api/certificates/validate?code=${encodeURIComponent(code)}`);
    state.appliedCert = data.certificate;
    const cert = data.certificate;
    const msg = tr(
      `✓ Сертификат принят — ${cert.amount} MDL${cert.procedure ? ` (${cert.procedure})` : ""}${cert.recipient ? `, для ${cert.recipient}` : ""}`,
      `✓ Certificat acceptat — ${cert.amount} MDL`
    );
    statusEl.textContent = msg;
    statusEl.className = "cert-status cert-status--ok";
    statusEl.hidden = false;
    refreshBookingSummary();
  } catch (err) {
    state.appliedCert = null;
    statusEl.textContent = err.message || tr("Сертификат не найден или недействителен.", "Certificat invalid.");
    statusEl.className = "cert-status cert-status--err";
    statusEl.hidden = false;
  }
}

function updateDurationCalc() {
  const calc = document.getElementById("durationCalc");
  const svc = findService(elements.serviceSelect.value);
  if (!svc || !calc) { if (calc) calc.hidden = true; return; }

  if (state.bookingDuration === 0 || state.bookingDuration < svc.duration) {
    state.bookingDuration = svc.duration;
  }

  const price = Math.round((svc.price / svc.duration) * state.bookingDuration / 50) * 50;
  const minusBtn = document.getElementById("durationMinus");

  document.getElementById("durationValue").textContent = `${state.bookingDuration} мин`;
  document.getElementById("durationPrice").textContent = formatCurrency(price);
  if (minusBtn) minusBtn.disabled = state.bookingDuration <= svc.duration;

  calc.hidden = false;
}

function findSpecialist(specialistId) {
  return state.specialists.find((specialist) => specialist.id === specialistId);
}

function summaryRow(label, value) {
  if (!value) return "";
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
  const p = new URLSearchParams({
    ref:          booking.reference || "",
    service:      booking.serviceName || "",
    serviceId:    booking.serviceId || "",
    specialist:   booking.specialistName || "",
    specialistId: booking.specialistId || "",
    date:         booking.date || "",
    time:         booking.slot ? `${booking.slot} — ${booking.endsAt || ""}` : "",
    price:        booking.totalPrice ? `${booking.totalPrice} MDL` : "",
    name:         booking.clientName || ""
  });
  location.href = `/success?${p.toString()}`;
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
