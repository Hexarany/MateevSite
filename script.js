// Реферальная ссылка: сохраняем код из ?ref= для будущей записи
(function captureReferral() {
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref && /^REF-[A-Z0-9]+$/i.test(ref)) localStorage.setItem("referralCode", ref.toUpperCase());
})();

const state = {
  services: [],
  specialists: [],
  site: null,
  diary: [],
  selectedSlot: null,
  availability: [],
  currency: "MDL",
  bookingProtectionToken: "",
  bookingFormStartedAt: 0,
  superUserTapCount: 0,
  superUserTapTimer: null,
  lang: (() => { const p = new URLSearchParams(location.search).get('lang'); if (p === 'ro' || p === 'ru') { localStorage.setItem('lang', p); return p; } return localStorage.getItem('lang') || 'ru'; })(),
  bookingDuration: 0,
  appliedCert: null,
  serviceFilter: "all",
  servicesExpanded: false,
  diaryExpanded: false,
  diaryOpenIds: new Set()
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
  specialistLocationFilter: document.getElementById("specialistLocationFilter"),
  processSectionKicker: document.getElementById("processSectionKicker"),
  processSectionTitle: document.getElementById("processSectionTitle"),
  processSectionCopy: document.getElementById("processSectionCopy"),
  processGrid: document.getElementById("processGrid"),
  bookingSectionKicker: document.getElementById("bookingSectionKicker"),
  bookingSectionTitle: document.getElementById("bookingSectionTitle"),
  bookingSectionCopy: document.getElementById("bookingSectionCopy"),
  methodTagline: document.getElementById("methodTagline"),
  methodGrid: document.getElementById("methodGrid"),
  diaryGrid: document.getElementById("diaryGrid"),
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

// ── Cookie Consent ──────────────────────────────────────────────────────────
function cookieConsent(choice) {
  localStorage.setItem("cookieConsent", choice);
  document.getElementById("cookieBanner").style.display = "none";
  if (choice === "all" && typeof gtag === "function") {
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("event", "page_view");
  }
}

function initCookieBanner() {
  const stored = localStorage.getItem("cookieConsent");
  if (!stored) {
    setTimeout(() => {
      const banner = document.getElementById("cookieBanner");
      if (banner) banner.style.display = "";
    }, 1500);
  } else if (stored === "all" && typeof gtag === "function") {
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("event", "page_view");
  }
}

document.addEventListener("DOMContentLoaded", init);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

// ── PWA install prompt ─────────────────────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (localStorage.getItem("pwaInstallDismissed") === "1") return;
  showInstallPill();
});

function showInstallPill() {
  if (document.getElementById("installPill")) return;
  const isRo = (typeof state !== "undefined" && state.lang === "ro");
  const pill = document.createElement("div");
  pill.id = "installPill";
  pill.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:420px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#1a2e22;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.28);font-size:0.9rem;";
  pill.innerHTML = `
    <span style="font-size:1.4rem;line-height:1;">📲</span>
    <span style="flex:1;line-height:1.35;">${isRo ? "Instalează aplicația — programare rapidă într-un clic" : "Установите приложение — запись в один тап"}</span>
    <button id="installPillYes" style="flex-shrink:0;padding:8px 14px;border:none;border-radius:10px;background:#c49e5a;color:#111;font-weight:700;font-family:inherit;cursor:pointer;">${isRo ? "Instalează" : "Установить"}</button>
    <button id="installPillNo" aria-label="Закрыть" style="flex-shrink:0;padding:6px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.6);font-size:1.2rem;line-height:1;cursor:pointer;">✕</button>`;
  document.body.appendChild(pill);
  document.getElementById("installPillYes").addEventListener("click", async () => {
    pill.remove();
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => {});
    deferredInstallPrompt = null;
  });
  document.getElementById("installPillNo").addEventListener("click", () => {
    pill.remove();
    localStorage.setItem("pwaInstallDismissed", "1");
  });
}

window.addEventListener("appinstalled", () => {
  document.getElementById("installPill")?.remove();
  localStorage.setItem("pwaInstallDismissed", "1");
});

async function init() {
  initCookieBanner();
  bindEvents();
  setDateConstraints();
  initRevealObserver();
  initMessengerToggle();
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("is-active", b.dataset.lang === state.lang));
  applyStaticTranslations();

  try {
    await loadBootstrap();
    applyUrlPrefill();
  } catch (error) {
    showToast(error.message || "Не удалось загрузить информацию о студии.", "error");
  }

  loadPublicGallery();
}

async function loadPublicGallery() {
  try {
    const items = await fetchJson("/api/gallery");
    if (!items.length) return;
    const section = document.getElementById("gallery-section");
    const grid = document.getElementById("siteGalleryGrid");
    if (!section || !grid) return;
    grid.innerHTML = items.map(item => `
      <div class="gallery-grid__item">
        <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt || 'Mateev Spa Studio')}" loading="lazy">
      </div>
    `).join("");
    section.hidden = false;
  } catch {}
}

function applyUrlPrefill() {
  const params = new URLSearchParams(location.search || location.hash.replace(/^#booking\?/, ""));
  const serviceId    = params.get("prefillService");
  const specialistId = params.get("prefillSpecialist");
  if (!serviceId && !specialistId) return;

  if (serviceId) elements.serviceSelect.value = serviceId;
  updateSpecialistOptions();
  if (specialistId) elements.specialistSelect.value = specialistId;

  document.getElementById("booking")?.scrollIntoView({ behavior: window.innerWidth <= 980 ? "instant" : "smooth", block: "start" });
  refreshAvailability();
  refreshBookingSummary();
}

function bindEvents() {
  elements.navToggle.addEventListener("click", toggleMobileNav);
  elements.siteNav.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMobileNav();
  });
  document.getElementById("navBackdrop")?.addEventListener("click", closeMobileNav);
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
        renderMethodBlock();
        renderDiarySection();
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
  const [payload, diaryPayload] = await Promise.all([
    fetchJson("/api/bootstrap"),
    fetchJson("/api/diary").catch(() => ({ entries: [] }))
  ]);
  state.services = payload.services;
  state.specialists = payload.specialists;
  state.site = payload.site;
  state.credentials = payload.credentials || [];
  if (payload.closure) renderClosureBanner(payload.closure);
  if (payload.site?.promoBanner?.enabled) renderPromoBanner(payload.site.promoBanner);
  state.currency = payload.site?.brand?.currency || "MDL";
  state.bookingProtectionToken = payload.meta?.bookingProtectionToken || "";
  state.diary = diaryPayload.entries || [];

  renderStaticContent();
  renderMethodBlock();
  renderDiarySection();
  renderFounderDiplomas();
  injectStructuredData();
  populateServiceOptions();
  updateSpecialistOptions();
  updateDurationCalc();
  resetBookingFormProtection();
  refreshBookingSummary();
  syncRevealTargets();
  scrollToHashAfterLoad();
  injectServicesSchema();
}

function injectServicesSchema() {
  if (!state.services.length) return;
  const base = "https://mateevmassage.com";
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Процедуры Mateev Spa Studio",
    "itemListElement": state.services.map((s, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Service",
        "name": s.name,
        "description": s.description || "",
        "offers": { "@type": "Offer", "price": s.price, "priceCurrency": "MDL" },
        "provider": { "@type": "LocalBusiness", "name": "Mateev Spa Studio", "url": base }
      }
    }))
  };
  let el = document.getElementById("services-schema");
  if (!el) {
    el = document.createElement("script");
    el.id = "services-schema";
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(schema);
}

function renderMethodBlock() {
  const method = state.site?.method;
  if (!method || method.enabled === false || !elements.methodGrid) return;
  if (elements.methodTagline) elements.methodTagline.textContent = tr(method.tagline, method.taglineRo) || "";
  elements.methodGrid.innerHTML = (method.principles || [])
    .map((p, i) => `
      <div class="method-card reveal">
        <span class="method-card__num">0${i + 1}</span>
        <h3 class="method-card__title">${escapeHtml(tr(p.title, p.titleRo))}</h3>
        <p class="method-card__text">${escapeHtml(tr(p.text, p.textRo))}</p>
      </div>
    `)
    .join("");
  document.getElementById("method").hidden = false;
}

function renderDiarySection() {
  if (!elements.diaryGrid) return;
  const entries = state.diary || [];
  const section = document.getElementById("diary");
  if (!entries.length) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";

  // Show only the latest entry as a teaser — full listing at /blog
  const latest = entries[0];
  const diaryLocale = state.lang === "ro" ? "ro-RO" : "ru-RU";
  const date = new Date(latest.publishedAt + "T00:00:00").toLocaleDateString(diaryLocale, {
    day: "numeric", month: "long", year: "numeric"
  });
  const bodyForExcerpt = tr(latest.body, latest.bodyRo);
  const plainBody = bodyForExcerpt
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/^#{1,4} /gm, "")
    .replace(/^[-*] /gm, "")
    .replace(/^> /gm, "")
    .replace(/---/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const excerpt = plainBody.slice(0, 200) + (plainBody.length > 200 ? "..." : "");

  elements.diaryGrid.innerHTML = `
    <article class="diary-card reveal">
      <time class="diary-card__date">${date}</time>
      <h3 class="diary-card__title">${escapeHtml(tr(latest.title, latest.titleRo))}</h3>
      <p class="diary-card__body diary-card__body--open" style="-webkit-line-clamp:unset;display:block;">${escapeHtml(excerpt)}</p>
      ${state.lang === "ro" && !latest.titleRo ? `<span style="font-size:0.75rem;color:var(--muted);display:block;margin-top:4px;">↳ ${tr("","Articol disponibil în rusă")}</span>` : ""}
      <div class="diary-card__actions">
        <a href="/blog/${escapeHtml(latest.id)}${state.lang === 'ro' ? '?lang=ro' : ''}" class="diary-read-more" style="text-decoration:underline;">${tr("Читать полностью →", "Citește tot →")}</a>
        ${entries.length > 1 ? `<a href="/blog${state.lang === 'ro' ? '?lang=ro' : ''}" class="diary-card__link">${tr(`Все записи (${entries.length}) ↗`, `Toate înregistrările (${entries.length}) ↗`)}</a>` : ""}
      </div>
    </article>
  `;

}

let diplomaState = { items: [], index: 0 };
let diplomaLbInit = false;

function renderFounderDiplomas() {
  const el = document.getElementById("founderDiplomas");
  if (!el) return;
  const items = state.credentials || [];
  diplomaState.items = items;
  if (!items.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  if (!diplomaLbInit) { initDiplomaLightbox(); diplomaLbInit = true; }
  const PREVIEW = 8;
  const showAll = el.dataset.expanded === "1";
  const visible = showAll ? items : items.slice(0, PREVIEW);
  el.innerHTML = `
    <div class="section-heading reveal is-visible" style="max-width:none;margin-bottom:22px;">
      <p class="section-kicker">${tr("Квалификация", "Calificare")}</p>
      <h2>${tr("Дипломы и сертификаты", "Diplome și certificate")}</h2>
      <p class="section-copy">${tr("Подтверждённая экспертиза — обучение, чемпионаты и профессиональные сертификаты.", "Expertiză confirmată — instruire, campionate și certificate profesionale.")}</p>
    </div>
    <div class="diploma-grid">
      ${visible.map((c, i) => `<button type="button" class="diploma-thumb" data-diploma="${i}" title="${escapeHtml(c.title || "Диплом")}">
        <img src="${escapeHtml(c.url)}" alt="${escapeHtml((c.title || "Диплом Mateev Spa") + (c.year ? ", " + c.year : ""))}" loading="lazy">
      </button>`).join("")}
    </div>
    ${items.length > PREVIEW ? `<div style="text-align:center;margin-top:22px;"><button type="button" class="button button--ghost" id="diplomaToggle">${showAll ? tr("Свернуть", "Restrânge") : tr("Показать все", "Arată toate") + " (" + items.length + ")"}</button></div>` : ""}
  `;
  el.querySelectorAll("[data-diploma]").forEach(b => b.addEventListener("click", () => openDiploma(Number(b.dataset.diploma))));
  const toggle = document.getElementById("diplomaToggle");
  if (toggle) toggle.addEventListener("click", () => { el.dataset.expanded = showAll ? "0" : "1"; renderFounderDiplomas(); });
}

function openDiploma(i) {
  const items = diplomaState.items;
  if (!items.length) return;
  diplomaState.index = (i + items.length) % items.length;
  const c = items[diplomaState.index];
  const lb = document.getElementById("diplomaLightbox");
  document.getElementById("diplomaImg").src = c.url;
  document.getElementById("diplomaImg").alt = c.title || "Диплом";
  document.getElementById("diplomaCaption").textContent = [c.title, c.year].filter(Boolean).join(" · ");
  lb.hidden = false;
}

function initDiplomaLightbox() {
  const lb = document.getElementById("diplomaLightbox");
  if (!lb) return;
  const close = () => { lb.hidden = true; };
  document.getElementById("diplomaClose")?.addEventListener("click", close);
  document.getElementById("diplomaPrev")?.addEventListener("click", () => openDiploma(diplomaState.index - 1));
  document.getElementById("diplomaNext")?.addEventListener("click", () => openDiploma(diplomaState.index + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") openDiploma(diplomaState.index - 1);
    else if (e.key === "ArrowRight") openDiploma(diplomaState.index + 1);
  });
}

function addJsonLd(id, obj) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const el = document.createElement("script");
  el.type = "application/ld+json";
  el.id = id;
  el.textContent = JSON.stringify(obj);
  document.head.appendChild(el);
}

// Динамическая structured data: FAQ + каталог услуг (для расширенных сниппетов Google)
function injectStructuredData() {
  try {
    const faq = Array.isArray(state.site?.faq) ? state.site.faq : [];
    if (faq.length) {
      addJsonLd("ld-faq", {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq.filter(f => f && f.question).map(f => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": { "@type": "Answer", "text": f.answer || "" }
        }))
      });
    }
    const services = state.services || [];
    if (services.length) {
      addJsonLd("ld-offers", {
        "@context": "https://schema.org",
        "@type": "OfferCatalog",
        "name": "Услуги массажа — Mateev Spa Studio",
        "itemListElement": services.map(s => ({
          "@type": "Offer",
          "priceCurrency": "MDL",
          "price": s.price,
          "itemOffered": {
            "@type": "Service",
            "name": s.name,
            "description": (s.description || "").slice(0, 200),
            "provider": { "@type": "HealthAndBeautyBusiness", "name": "Mateev Spa Studio" }
          }
        }))
      });
    }
  } catch {}
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

  const certCodeLabelEl = document.getElementById("certCodeLabel");
  if (certCodeLabelEl) certCodeLabelEl.textContent = tr("Подарочный сертификат", "Card cadou");
  const certApplyBtn = document.getElementById("certApplyBtn");
  if (certApplyBtn) certApplyBtn.textContent = tr("Применить", "Aplicați");

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
    // Build ru→ro category name map
    const catRoMap = {};
    state.services.forEach(s => { if (s.category && s.categoryRo) catRoMap[s.category] = s.categoryRo; });
    filtersEl.innerHTML = [
      `<button class="school-filter-btn${state.serviceFilter === "all" ? " is-active" : ""}" data-cat="all">${tr("Все процедуры","Toate procedurile")}</button>`,
      ...cats.map(c => `<button class="school-filter-btn${state.serviceFilter === c ? " is-active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(tr(c, catRoMap[c]))}</button>`)
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

  const durLabel = tr("мин", "min");
  elements.servicesGrid.innerHTML = visibleServices
    .map(
      (service) => `
        <article class="service-card reveal">
          <span class="feature-card__index">${escapeHtml(tr(service.category, service.categoryRo))}</span>
          <h3>${escapeHtml(tr(service.name, service.nameRo))}</h3>
          <p>${escapeHtml(tr(service.description, service.descriptionRo))}</p>

          <div class="service-card__meta">
            <span class="meta-chip">${formatCurrency(service.price)}</span>
            <span class="meta-chip">${service.duration} ${durLabel}</span>
          </div>

          <div class="service-card__benefits">
            ${(tr(service.benefits, service.benefitsRo) || service.benefits).map((benefit) => `<span>${escapeHtml(benefit)}</span>`).join("")}
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
        .map((serviceId) => {
          const svc = findService(serviceId);
          return svc ? tr(svc.name, svc.nameRo) : null;
        })
        .filter(Boolean)
        .slice(0, 3)
        .map((name) => `<span class="meta-chip">${escapeHtml(name)}</span>`)
        .join("");

      const preferredService = specialist.specialties[0] || "";

      return `
        <article class="specialist-card reveal" data-location="${escapeHtml((specialist.location || '').toLowerCase())}">
          ${specialist.photo
            ? `<img class="specialist-card__photo" src="${escapeHtml(specialist.photo)}" alt="${escapeHtml(specialist.name)}" loading="lazy">`
            : `<div class="specialist-card__avatar">${escapeHtml(specialist.initials)}</div>`
          }
          <div class="specialist-card__role">${escapeHtml(tr(specialist.role, specialist.roleRo))}</div>
          <h3>${escapeHtml(specialist.name)}${specialist.certified ? ` <span class="cert-badge" title="Сертифицированный мастер Mateev">✓ Mateev-certified</span>` : ""}</h3>
          <p>${escapeHtml(tr(specialist.bio, specialist.bioRo))}</p>

          <div class="specialist-card__meta">
            <span class="meta-chip">${escapeHtml(specialist.experience)}</span>
            ${specialist.location ? `<a class="meta-chip meta-chip--loc" href="https://maps.google.com/?q=${encodeURIComponent(((specialist.address || '') + ' ' + specialist.location).trim())}" target="_blank" rel="noopener" title="${tr('Открыть на карте','Deschide pe hartă')}" style="text-decoration:none;">📍 ${escapeHtml(specialist.location)}</a>` : ""}
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
            <a href="/team/${escapeHtml(specialist.id)}?lang=${state.lang}" class="button button--ghost" style="font-size:0.85rem;">${tr("Подробнее","Mai mult")}</a>
          </div>
        </article>
      `;
    })
    .join("");

  // ── Каталог «найди мастера рядом»: фильтр по городу (только при 2+ локациях) ──
  if (elements.specialistLocationFilter) {
    const locations = [...new Set(state.specialists.map(s => (s.location || "").trim()).filter(Boolean))];
    if (locations.length >= 2) {
      const chip = (label, value, active) => `<button type="button" class="school-filter-btn${active ? " is-active" : ""}" data-loc-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
      elements.specialistLocationFilter.innerHTML =
        chip(tr("Все города", "Toate orașele"), "", true) +
        locations.map(l => chip("📍 " + l, l.toLowerCase(), false)).join("");
      elements.specialistLocationFilter.querySelectorAll("[data-loc-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
          const val = btn.dataset.locFilter;
          elements.specialistLocationFilter.querySelectorAll("[data-loc-filter]").forEach(b => b.classList.toggle("is-active", b === btn));
          elements.specialistsGrid.querySelectorAll(".specialist-card").forEach(card => {
            card.style.display = (!val || card.dataset.location === val) ? "" : "none";
          });
        });
      });
    } else {
      elements.specialistLocationFilter.innerHTML = "";
    }
  }

  elements.processGrid.innerHTML = trArr("process")
    .map(
      (item, index) => `
        <article class="process-card reveal">
          <span class="process-card__index">${escapeHtml(trSite('ui.processPrefix') || ui.processPrefix || tr("Шаг","Pasul"))} ${index + 1}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");

  const reviews = trArr("reviews");
  const REVIEWS_VISIBLE = 3;
  elements.reviewsGrid.innerHTML = reviews
    .map(
      (review, i) => `
        <article class="review-card reveal${i >= REVIEWS_VISIBLE ? ' review-card--hidden' : ''}">
          <h3>${escapeHtml(review.author)}</h3>
          <div class="review-card__meta">${escapeHtml(review.meta)}</div>
          <p>${escapeHtml(review.text)}</p>
        </article>
      `
    )
    .join("");

  if (reviews.length > REVIEWS_VISIBLE) {
    const btn = document.createElement("button");
    btn.className = "button button--ghost show-all-btn";
    btn.textContent = tr(`Показать все отзывы (${reviews.length})`, `Arată toate recenziile (${reviews.length})`);
    btn.addEventListener("click", () => {
      elements.reviewsGrid.querySelectorAll("article.review-card--hidden").forEach(el => el.classList.remove("review-card--hidden"));
      btn.remove();
    });
    elements.reviewsGrid.appendChild(btn);
  }

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
        <span>${escapeHtml(trSite('brand.address') || `${site.brand.city}, ${site.brand.address}`)}</span>
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
        <span>${escapeHtml(trSite('brand.hours') || site.brand.hours)}</span>
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
      <a href="https://t.me/Hardyty" target="_blank" rel="noopener" class="social-btn" aria-label="Telegram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>
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
        `<option value="${escapeHtml(specialist.id)}">${escapeHtml(specialist.name)} · ${escapeHtml(tr(specialist.role, specialist.roleRo))}</option>`
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
    specialist?.address ? summaryRow(tr("Адрес", "Adresa"), `📍 ${specialist.address}${specialist.location ? ", " + specialist.location : ""}`) : "",
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
    ...(state.appliedCert ? { certificateCode: state.appliedCert.code } : {}),
    ...(localStorage.getItem("referralCode") ? { referralCode: localStorage.getItem("referralCode") } : {})
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
  // Min: tomorrow (24h notice) for public booking
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = `${minDate.getFullYear()}-${String(minDate.getMonth()+1).padStart(2,"0")}-${String(minDate.getDate()).padStart(2,"0")}`;
  elements.dateInput.min = minDateStr;

  // Max: 14 days ahead
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 14);
  elements.dateInput.max = `${maxDate.getFullYear()}-${String(maxDate.getMonth()+1).padStart(2,"0")}-${String(maxDate.getDate()).padStart(2,"0")}`;

  if (!elements.dateInput.value || elements.dateInput.value < minDateStr) {
    elements.dateInput.value = minDateStr;
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

function initMessengerToggle() {
  const toggle = document.getElementById("messengerToggle");
  const btns = document.getElementById("messengerBtns");
  if (!toggle || !btns) return;
  toggle.addEventListener("click", () => {
    const open = btns.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open);
  });
  document.addEventListener("click", (e) => {
    if (!btns.contains(e.target)) btns.classList.remove("is-open");
  });
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

function renderPromoBanner(banner) {
  if (document.getElementById("promoBanner")) return;
  const colors = {
    brand: "background:#b36d2c;color:#fff;",
    forest: "background:#1a2e22;color:#fff;",
    sage: "background:#6b8d6b;color:#fff;",
    warm: "background:#f5e6d3;color:#241c17;"
  };
  const style = colors[banner.color] || colors.brand;
  const el = document.createElement("div");
  el.id = "promoBanner";
  el.style.cssText = `${style}text-align:center;padding:10px 20px;font-size:0.88rem;font-weight:600;position:relative;z-index:24;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;`;
  el.innerHTML = `
    <span>${escapeHtml(banner.text)}</span>
    ${banner.cta && banner.ctaUrl ? `<a href="${escapeHtml(banner.ctaUrl)}" style="padding:4px 14px;border:1.5px solid currentColor;border-radius:8px;text-decoration:none;color:inherit;font-size:0.82rem;flex-shrink:0;">${escapeHtml(banner.cta)}</a>` : ""}
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;color:inherit;position:absolute;right:12px;top:50%;transform:translateY(-50%);">×</button>
  `;
  document.querySelector(".topbar")?.insertAdjacentElement("afterend", el);
}

function renderClosureBanner(closure) {
  const existing = document.getElementById("closureBanner");
  if (existing) return;
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const banner = document.createElement("div");
  banner.id = "closureBanner";
  banner.style.cssText = "background:#1a2e22;color:#fff;text-align:center;padding:12px 20px;font-size:0.88rem;line-height:1.5;position:relative;z-index:25;";
  if (closure.note) {
    banner.innerHTML = `🌿 ${escapeHtml(closure.note)}`;
  } else {
    banner.innerHTML = `🌿 Студия закрыта с <strong>${fmt(closure.from)}</strong> по <strong>${fmt(closure.to)}</strong> включительно. Запись откроется после возвращения.`;
  }
  document.querySelector(".topbar")?.insertAdjacentElement("afterend", banner);
}

function scrollToHashAfterLoad() {
  const hash = window.location.hash;
  if (!hash) return;
  const target = document.querySelector(hash);
  if (target) {
    setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }
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
  const open = !expanded;
  elements.navToggle.setAttribute("aria-expanded", String(open));
  elements.siteNav.classList.toggle("is-open", open);
  const backdrop = document.getElementById("navBackdrop");
  if (backdrop) backdrop.classList.toggle("is-visible", open);
}

function closeMobileNav() {
  elements.navToggle.setAttribute("aria-expanded", "false");
  elements.siteNav.classList.remove("is-open");
  const backdrop = document.getElementById("navBackdrop");
  if (backdrop) backdrop.classList.remove("is-visible");
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

// ── AI consultant widget ───────────────────────────────────────────────
(function initAiChat() {
  const launcher = document.getElementById("aiLauncher");
  const panel = document.getElementById("aiChat");
  if (!launcher || !panel) return;
  const body = document.getElementById("aiChatBody");
  const form = document.getElementById("aiChatForm");
  const input = document.getElementById("aiChatInput");
  const closeBtn = document.getElementById("aiChatClose");
  const sendBtn = document.getElementById("aiChatSend");
  const history = [];
  let greeted = false;

  function isRo() { return (typeof state !== "undefined" && state.lang === "ro"); }

  function addMsg(role, text) {
    const el = document.createElement("div");
    el.className = "ai-msg ai-msg--" + (role === "user" ? "user" : "bot");
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function open() {
    document.getElementById("messengerBtns")?.classList.remove("is-open");
    panel.hidden = false;
    launcher.classList.add("is-hidden");
    if (!greeted) {
      greeted = true;
      addMsg("bot", isRo()
        ? "Bună! Sunt asistentul Mateev Spa. Vă pot spune despre proceduri, prețuri, program și vă ajut să vă programați. Cu ce vă pot ajuta?"
        : "Здравствуйте! Я ассистент Mateev Spa. Расскажу о процедурах, ценах, графике и помогу записаться. Чем могу помочь?");
    }
    setTimeout(() => input.focus(), 50);
  }

  function close() {
    panel.hidden = true;
    launcher.classList.remove("is-hidden");
  }

  launcher.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    input.value = "";
    addMsg("user", msg);
    sendBtn.disabled = true;
    const typing = addMsg("bot", "…");
    typing.classList.add("ai-msg--typing");
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: history.slice(-8) })
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (res.ok && data.reply) {
        addMsg("bot", data.reply);
        history.push({ role: "user", content: msg }, { role: "assistant", content: data.reply });
      } else {
        addMsg("bot", data.message || (isRo() ? "Scuze, nu am putut răspunde. Scrieți-ne în Telegram." : "Извините, не получилось ответить. Напишите нам в Telegram."));
      }
    } catch {
      typing.remove();
      addMsg("bot", isRo() ? "Eroare de rețea. Încercați din nou." : "Ошибка сети. Попробуйте ещё раз.");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  });
})();
