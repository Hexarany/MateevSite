const state = {
  adminPin: "",
  role: "admin",
  adminData: null,
  enrollments: [],
  certificates: [],
  diplomas: [],
  packages: [],
  diary: [],
  daySchedule: null,
  clients: [],
  selectedClientId: "",
  services: [],
  specialists: [],
  courses: [],
  teachers: [],
  site: null,
  currency: "MDL",
  filters: {
    status: "all",
    search: "",
    period: "month",
    sortDir: "desc"
  },
  clientFilters: {
    search: ""
  },
  bookingPage: 0,
  clientPage: 0,
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
      daySchedules: buildDefaultDaySchedules(),
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
  scheduleDayRows: document.getElementById("scheduleDayRows"),
  scheduleBreaks: document.getElementById("scheduleBreaks"),
  addBreakBtn: document.getElementById("addBreakBtn"),
  adminTableBody: document.getElementById("adminTableBody"),
  statusFilter: document.getElementById("statusFilter"),
  bookingSearch: document.getElementById("bookingSearch"),
  diaryEntryForm: document.getElementById("diaryEntryForm"),
  diaryEntryId: document.getElementById("diaryEntryId"),
  diaryEntryTitle: document.getElementById("diaryEntryTitle"),
  diaryEntryDate: document.getElementById("diaryEntryDate"),
  diaryEntryBody: document.getElementById("diaryEntryBody"),
  diaryEntryPublished: document.getElementById("diaryEntryPublished"),
  diaryEntriesList: document.getElementById("diaryEntriesList"),
  addDiaryEntryBtn: document.getElementById("addDiaryEntryBtn"),
  diaryEntryCancelBtn: document.getElementById("diaryEntryCancelBtn"),
  reviewsEditor: document.getElementById("reviewsEditor"),
  addReviewBtn: document.getElementById("addReviewBtn"),
  saveReviewsBtn: document.getElementById("saveReviewsBtn"),
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
  initSectionNav();
  renderCurrentDate();

  try {
    await loadBootstrap();
    await tryAutoLoginFromSession();
  } catch (error) {
    showToast(error.message || "Не удалось загрузить данные студии.", "error");
  }
}

function activateSection(sectionId) {
  const panel = document.getElementById("adminPanel");
  if (!panel) return;

  const resolvedId = sectionId === "overview" ? "analyticsWidget" : sectionId;

  panel.classList.add("has-active-section");

  panel.querySelectorAll(":scope > .admin-section-block").forEach(el => {
    el.classList.toggle("is-active-section", el.id === resolvedId);
  });

  document.querySelectorAll(".admin-sidebar__nav a[data-section]").forEach(a => {
    a.classList.toggle("is-active", a.dataset.section === sectionId);
  });

  localStorage.setItem("adminSection", resolvedId === "analyticsWidget" ? "overview" : sectionId);
}

function initSectionNav() {
  const saved = localStorage.getItem("adminSection") || "overview";
  activateSection(saved);

  document.querySelectorAll(".admin-sidebar__nav a[data-section]").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      activateSection(a.dataset.section);
    });
  });
}

function bindEvents() {
  elements.adminLoginBtn.addEventListener("click", handleAdminLogin);
  elements.adminLogoutBtn.addEventListener("click", handleAdminLogout);
  document.getElementById("expenseMonth")?.addEventListener("change", loadExpenses);
  bindPackageEvents();
  document.getElementById("pkgFilterBtns")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".pkg-filter-btn");
    if (!btn) return;
    document.querySelectorAll(".pkg-filter-btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    pkgFilter = btn.dataset.filter;
    renderPackagesTable();
  });

  // New client form
  document.getElementById("addClientBtn")?.addEventListener("click", () => {
    document.getElementById("newClientModal").style.display = "block";
    document.getElementById("newClientName").focus();
  });
  document.getElementById("cancelNewClientBtn")?.addEventListener("click", () => {
    document.getElementById("newClientModal").style.display = "none";
  });
  document.getElementById("saveNewClientBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("newClientName").value.trim();
    const phone = document.getElementById("newClientPhone").value.trim();
    const email = document.getElementById("newClientEmail").value.trim();
    const note = document.getElementById("newClientNote").value.trim();
    if (!name || !phone) { showToast("Введите имя и телефон.", "error"); return; }
    try {
      await fetchJson("/api/admin/clients", { method: "POST", body: JSON.stringify({ clientName: name, phone, email, note }) });
      showToast(`Клиент ${name} добавлен.`, "success");
      document.getElementById("newClientModal").style.display = "none";
      document.getElementById("newClientName").value = "";
      document.getElementById("newClientPhone").value = "";
      document.getElementById("newClientEmail").value = "";
      document.getElementById("newClientNote").value = "";
      await loadClientsData();
    } catch (e) { showToast(e.message || "Ошибка.", "error"); }
  });

  // Client autocomplete — autofill phone/email when name selected
  elements.adminBookingClientName?.addEventListener("change", () => {
    const val = elements.adminBookingClientName.value.trim();
    const client = state.clients.find(c => c.clientName === val);
    if (client) {
      if (elements.adminBookingPhone && !elements.adminBookingPhone.value) elements.adminBookingPhone.value = client.phone || "";
      if (elements.adminBookingEmail && !elements.adminBookingEmail.value) elements.adminBookingEmail.value = client.email || "";
    }
  });

  document.getElementById("periodBtns")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".period-btn");
    if (!btn) return;
    document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.filters.period = btn.dataset.period;
    state.bookingPage = 0;
    renderAdminTable();
  });

  document.getElementById("sortDirBtn")?.addEventListener("click", () => {
    state.filters.sortDir = state.filters.sortDir === "desc" ? "asc" : "desc";
    const btn = document.getElementById("sortDirBtn");
    if (btn) btn.textContent = state.filters.sortDir === "desc" ? "↓ Новые первыми" : "↑ Старые первыми";
    renderAdminTable();
  });
  elements.statusFilter.addEventListener("change", () => {
    state.filters.status = elements.statusFilter.value;
    state.bookingPage = 0;
    renderAdminTable();
  });
  elements.bookingSearch.addEventListener("input", () => {
    state.filters.search = elements.bookingSearch.value.trim().toLowerCase();
    state.bookingPage = 0;
    renderAdminTable();
  });
  elements.clientSearch.addEventListener("input", () => {
    state.clientFilters.search = elements.clientSearch.value.trim().toLowerCase();
    state.clientPage = 0;
    renderClientsWorkspace();
  });
  elements.adminTableBody.addEventListener("change", handleAdminStatusChange);

  document.addEventListener("change", async (event) => {
    const select = event.target.closest(".enrollment-status-select");
    if (!select) return;
    try {
      await fetchJson(`/api/admin/enrollments/${select.dataset.enrollmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value })
      });
      const idx = state.enrollments.findIndex((e) => e.id === select.dataset.enrollmentId);
      if (idx !== -1) state.enrollments[idx].status = select.value;
    } catch {
      showToast("Не удалось обновить статус.", "error");
    }
  });

  document.addEventListener("change", async (e) => {
    const sel = e.target.closest(".cert-status-select");
    if (!sel) return;
    try {
      await fetchJson(`/api/admin/certificates/${sel.dataset.certId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: sel.value })
      });
      const idx = state.certificates.findIndex(c => c.id === sel.dataset.certId);
      if (idx !== -1) state.certificates[idx].status = sel.value;
    } catch { showToast("Не удалось обновить статус.", "error"); }
  });

  document.getElementById("enrollmentStatusFilter")?.addEventListener("change", renderEnrollmentsTable);
  document.getElementById("enrollmentSearch")?.addEventListener("input", renderEnrollmentsTable);

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".enrollment-delete-btn");
    if (!btn) return;
    if (!confirm("Удалить заявку навсегда?")) return;
    const id = btn.dataset.enrollmentId;
    try {
      await fetchJson(`/api/admin/enrollments/${id}`, { method: "DELETE" });
      state.enrollments = state.enrollments.filter(en => en.id !== id);
      renderEnrollmentsTable();
      showToast("Заявка удалена.", "success");
    } catch { showToast("Не удалось удалить заявку.", "error"); }
  });
  elements.clientsList.addEventListener("click", handleClientListClick);
  elements.clientDetail.addEventListener("submit", handleClientProfileSubmit);
  elements.clientDetail.addEventListener("click", handleClientDetailClick);
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".chart-period-btn");
    if (!btn) return;
    document.querySelectorAll(".chart-period-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    renderRevenueChart(state.adminData?.bookings || [], Number(btn.dataset.period));
  });
  // Markdown format buttons
  document.addEventListener("click", (e) => {
    const fmtBtn = e.target.closest(".diary-fmt-btn");
    if (!fmtBtn) return;
    const ta = elements.diaryEntryBody;
    const fmt = fmtBtn.dataset.fmt;
    const wrap = fmtBtn.dataset.wrap === "true";
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    let replacement;
    if (wrap) {
      replacement = selected ? `${fmt}${selected}${fmt}` : `${fmt}текст${fmt}`;
    } else {
      replacement = `\n${fmt}${selected || "текст"}`;
    }
    ta.setRangeText(replacement, start, end, "select");
    ta.focus();
  });

  // Image upload for diary
  document.getElementById("diaryImageUpload")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = await fetchJson("/api/admin/diary/upload", {
          method: "POST",
          body: JSON.stringify({ image: reader.result })
        });
        const ta = elements.diaryEntryBody;
        const pos = ta.selectionStart;
        const mdImg = `\n![Описание фото](${data.url})\n`;
        ta.setRangeText(mdImg, pos, pos, "end");
        ta.focus();
        showToast("Фото загружено — вставлено в текст.", "success");
      } catch {
        showToast("Не удалось загрузить фото.", "error");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  // Preview toggle
  document.getElementById("diaryPreviewBtn")?.addEventListener("click", () => {
    const preview = document.getElementById("diaryPreview");
    const ta = elements.diaryEntryBody;
    if (preview.style.display === "none") {
      preview.innerHTML = parseMarkdownAdmin(ta.value);
      preview.style.display = "block";
      document.getElementById("diaryPreviewBtn").textContent = "✎ Редактор";
    } else {
      preview.style.display = "none";
      document.getElementById("diaryPreviewBtn").textContent = "👁 Предпросмотр";
    }
  });

  elements.addDiaryEntryBtn.addEventListener("click", handleAddDiaryEntry);
  elements.diaryEntryCancelBtn.addEventListener("click", handleDiaryEntryCancel);
  elements.diaryEntryForm.addEventListener("submit", handleDiaryEntrySubmit);
  document.getElementById("diaryTranslateBtn")?.addEventListener("click", handleDiaryTranslate);
  elements.diaryEntriesList.addEventListener("click", handleDiaryListClick);
  document.getElementById("exportClientsCsvBtn")?.addEventListener("click", handleExportClientsCsv);
  elements.addReviewBtn.addEventListener("click", handleAddReview);
  elements.saveReviewsBtn.addEventListener("click", handleSaveReviews);
  elements.reviewsEditor.addEventListener("input", handleReviewEditorInput);
  elements.reviewsEditor.addEventListener("click", handleReviewEditorClick);
  elements.saveSiteContentBtn.addEventListener("click", () => handleContentSave("site"));
  elements.saveServicesBtn.addEventListener("click", () => handleContentSave("services"));
  elements.saveSpecialistsBtn.addEventListener("click", () => handleContentSave("specialists"));
  elements.addServiceBtn.addEventListener("click", handleAddService);
  elements.addSpecialistBtn.addEventListener("click", handleAddSpecialist);

  document.getElementById("saveCoursesBtn")?.addEventListener("click", handleSaveSchool);
  document.getElementById("saveTeachersBtn")?.addEventListener("click", handleSaveSchool);
  document.getElementById("addCourseBtn")?.addEventListener("click", handleAddCourse);
  document.getElementById("addTeacherBtn")?.addEventListener("click", handleAddTeacher);

  document.addEventListener("click", (e) => {
    const rmCourse = e.target.closest("[data-remove-course-index]");
    if (rmCourse) { state.courses.splice(+rmCourse.dataset.removeCourseIndex, 1); renderSchoolEditors(); }
    const rmTeacher = e.target.closest("[data-remove-teacher-index]");
    if (rmTeacher) { state.teachers.splice(+rmTeacher.dataset.removeTeacherIndex, 1); renderSchoolEditors(); }
  });

  document.addEventListener("input", (e) => {
    const ci = e.target.dataset.courseIndex;
    if (ci !== undefined && e.target.dataset.courseField) {
      state.courses[+ci] = { ...state.courses[+ci], [e.target.dataset.courseField]: e.target.value };
    }
    const ti = e.target.dataset.teacherIndex;
    if (ti !== undefined && e.target.dataset.teacherField) {
      state.teachers[+ti] = { ...state.teachers[+ti], [e.target.dataset.teacherField]: e.target.value };
    }
  });

  document.addEventListener("change", (e) => {
    const dirInput = e.target.closest("[data-teacher-direction]");
    if (!dirInput) return;
    const ti = +dirInput.dataset.teacherIndex;
    const dir = dirInput.dataset.teacherDirection;
    const current = state.teachers[ti]?.directions || [];
    state.teachers[ti] = {
      ...state.teachers[ti],
      directions: dirInput.checked
        ? [...new Set([...current, dir])]
        : current.filter(d => d !== dir)
    };
  });
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
  document.getElementById("adminBookingDuration")?.addEventListener("change", () => refreshBookingSlots(false));
  elements.adminBookingSpecialist.addEventListener("change", handleBookingServiceOrSpecialistChange);
  elements.adminBookingDate.addEventListener("change", handleBookingServiceOrSpecialistChange);
  elements.scheduleBoard.addEventListener("click", handleScheduleBoardClick);
  elements.adminBlockForm.addEventListener("submit", handleAdminBlockSubmit);
  elements.scheduleSpecialistSelect.addEventListener("change", handleScheduleSpecialistSelect);
  elements.specialistScheduleForm.addEventListener("submit", handleSpecialistScheduleSubmit);
  document.getElementById("openVacationModalBtn")?.addEventListener("click", showVacationModal);
  elements.addBreakBtn.addEventListener("click", handleAddScheduleBreak);
  elements.scheduleBreaks.addEventListener("click", handleScheduleBreakClick);
  elements.scheduleBreaks.addEventListener("input", handleScheduleBreakInput);
  elements.scheduleDayRows.addEventListener("change", handleDayRowChange);
  elements.scheduleDayRows.addEventListener("input", handleDayRowInput);

  elements.adminPin.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdminLogin();
    }
  });

  elements.exportCsvBtn.addEventListener("click", handleExportCsv);

  document.addEventListener("change", async (event) => {
    const teacherInput = event.target.closest(".admin-teacher-photo-input");
    if (teacherInput) {
      const file = teacherInput.files[0];
      if (!file) return;
      const teacherId = teacherInput.dataset.teacherId;
      const uploadBlock = document.querySelector(`.admin-photo-upload[data-teacher-id="${teacherId}"]`);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await fetchJson(`/api/admin/teachers/${encodeURIComponent(teacherId)}/photo`, {
            method: "POST",
            body: JSON.stringify({ photo: e.target.result })
          });
          if (uploadBlock) {
            uploadBlock.querySelector(".admin-photo-upload__preview").innerHTML =
              `<img class="admin-photo-img" src="${res.photo}?t=${Date.now()}" alt="">`;
            uploadBlock.querySelector(".admin-photo-upload__btn").childNodes[0].textContent = "Заменить фото";
          }
          const idx = state.teachers.findIndex(t => t.id === teacherId);
          if (idx !== -1) state.teachers[idx].photo = res.photo;
          showToast("Фото преподавателя загружено.", "success");
        } catch { showToast("Ошибка загрузки фото.", "error"); }
      };
      reader.readAsDataURL(file);
      return;
    }

    const input = event.target.closest(".admin-photo-input");
    if (!input) return;

    const file = input.files[0];
    if (!file) return;

    const specialistId = input.dataset.specialistId;
    const uploadBlock = document.querySelector(`.admin-photo-upload[data-specialist-id="${specialistId}"]`);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      try {
        const res = await fetchJson(`/api/admin/specialists/${encodeURIComponent(specialistId)}/photo`, {
          method: "POST",
          body: JSON.stringify({ photo: base64 })
        });
        if (uploadBlock) {
          const preview = uploadBlock.querySelector(".admin-photo-upload__preview");
          preview.innerHTML = `<img class="admin-photo-img" src="${res.photo}?t=${Date.now()}" alt="">`;
          const btn = uploadBlock.querySelector(".admin-photo-upload__btn");
          btn.childNodes[0].textContent = "Заменить фото";
        }
        showToast("Фото загружено.", "success");
      } catch (err) {
        showToast("Ошибка загрузки фото.", "error");
      }
    };
    reader.readAsDataURL(file);
  });
}

async function loadAnalytics() {
  try {
    const data = await fetchJson("/api/admin/analytics");
    document.getElementById("gaUsers").textContent = Number(data.users).toLocaleString("ru");
    document.getElementById("gaSessions").textContent = Number(data.sessions).toLocaleString("ru");
    document.getElementById("gaPageviews").textContent = Number(data.pageviews).toLocaleString("ru");
    const maxViews = Math.max(...(data.topPages || []).map(p => Number(p.views)), 1);
    document.getElementById("gaTopPages").innerHTML = (data.topPages || []).map(p => {
      const pct = Math.round(Number(p.views) / maxViews * 100);
      const label = p.page === "/" ? "Главная" : p.page;
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;">
        <div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--ink);margin-bottom:3px;">${escapeHtml(label)}</div>
          <div style="height:4px;border-radius:2px;background:var(--line);overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--forest);border-radius:2px;"></div>
          </div>
        </div>
        <span style="font-size:0.82rem;color:var(--muted);white-space:nowrap;">${Number(p.views).toLocaleString("ru")} просм.</span>
      </div>`;
    }).join("");
  } catch(e) {
    document.getElementById("analyticsBody").innerHTML =
      `<p style="color:var(--muted);font-size:0.88rem;">Аналитика недоступна: ${escapeHtml(e.message)}</p>`;
  }
}

async function loadBootstrap() {
  const payload = await fetchJson("/api/bootstrap");
  state.services = payload.services;
  state.specialists = payload.specialists;
  state.site = payload.site;
  state.currency = payload.site?.brand?.currency || "MDL";

  // Load school data
  try {
    const school = await fetchJson("/api/school/data");
    state.courses = school.courses || [];
    state.teachers = school.teachers || [];
  } catch {}

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
  renderReviewsEditor();
  renderSchoolEditors();
  renderBannerEditor();
}

function renderBannerEditor() {
  const banner = state.site?.promoBanner;
  const enabledEl = document.getElementById("bannerEnabled");
  const textEl = document.getElementById("bannerText");
  const ctaEl = document.getElementById("bannerCta");
  const ctaUrlEl = document.getElementById("bannerCtaUrl");
  const colorEl = document.getElementById("bannerColor");
  if (!enabledEl) return;
  enabledEl.checked = !!(banner?.enabled);
  if (textEl) textEl.value = banner?.text || "";
  if (ctaEl) ctaEl.value = banner?.cta || "";
  if (ctaUrlEl) ctaUrlEl.value = banner?.ctaUrl || "";
  if (colorEl) colorEl.value = banner?.color || "brand";
}

function renderSchoolEditors() {
  const coursesEl  = document.getElementById("coursesEditor");
  const teachersEl = document.getElementById("teachersEditor");
  if (coursesEl)  coursesEl.innerHTML  = renderCoursesEditor();
  if (teachersEl) teachersEl.innerHTML = renderTeachersEditor();
}

function renderCoursesEditor() {
  if (!state.courses.length) return '<div class="admin-empty-editor">Курсов пока нет. Добавьте первый.</div>';
  const directions = { massage: "Массаж", cosmetology: "Косметология" };
  const levels = { beginner: "С нуля", intermediate: "Средний", advanced: "Продвинутый", any: "Любой" };
  return `<div class="admin-editor-stack">${state.courses.map((c, i) => `
    <article class="admin-entry-card">
      <div class="admin-entry-card__head">
        <div>
          <h4 class="admin-entry-card__title">${escapeHtml(c.name || `Курс ${i+1}`)}</h4>
          <p class="admin-entry-card__copy">${directions[c.direction] || c.direction} · ${levels[c.level] || c.level}</p>
        </div>
        <button type="button" class="button button--ghost" data-remove-course-index="${i}">Удалить</button>
      </div>
      <div class="admin-entry-card__grid">
        <label class="field"><span>Название</span><input type="text" value="${escapeHtml(c.name||"")}" data-course-index="${i}" data-course-field="name"></label>
        <label class="field"><span>Направление</span><select data-course-index="${i}" data-course-field="direction">
          <option value="massage"${c.direction==="massage"?" selected":""}>Массаж</option>
          <option value="cosmetology"${c.direction==="cosmetology"?" selected":""}>Косметология</option>
        </select></label>
        <label class="field"><span>Подзаголовок</span><input type="text" value="${escapeHtml(c.subtitle||"")}" data-course-index="${i}" data-course-field="subtitle"></label>
        <label class="field"><span>Уровень</span><select data-course-index="${i}" data-course-field="level">
          <option value="beginner"${c.level==="beginner"?" selected":""}>С нуля</option>
          <option value="intermediate"${c.level==="intermediate"?" selected":""}>Средний</option>
          <option value="advanced"${c.level==="advanced"?" selected":""}>Продвинутый</option>
          <option value="any"${c.level==="any"?" selected":""}>Любой</option>
        </select></label>
        <label class="field"><span>Формат</span><select data-course-index="${i}" data-course-field="format">
          <option value="group"${c.format==="group"?" selected":""}>Групповой</option>
          <option value="individual"${c.format==="individual"?" selected":""}>Индивидуальный</option>
        </select></label>
        <label class="field"><span>Длительность</span><input type="text" value="${escapeHtml(c.duration||"")}" data-course-index="${i}" data-course-field="duration" placeholder="3 недели"></label>
        <label class="field"><span>Цена (EUR)</span><input type="number" value="${c.price||0}" data-course-index="${i}" data-course-field="price" min="0"></label>
        <label class="field"><span>Размер группы</span><input type="text" value="${escapeHtml(c.groupSize||"")}" data-course-index="${i}" data-course-field="groupSize" placeholder="до 6 человек"></label>
        <label class="field"><span>Лимит мест (0 = без лимита)</span><input type="number" value="${c.maxStudents||0}" data-course-index="${i}" data-course-field="maxStudents" min="0"></label>
        <label class="field field--full"><span>Описание</span><textarea rows="3" data-course-index="${i}" data-course-field="description">${escapeHtml(c.description||"")}</textarea></label>
        <label class="field field--full"><span>Что входит (по одному на строку)</span><textarea rows="4" data-course-index="${i}" data-course-field="benefits">${escapeHtml((c.benefits||[]).join("\n"))}</textarea></label>
        <label class="field field--full"><span>Даты старта групп (по одной на строку, напр. "15 июня 2026")</span><textarea rows="3" data-course-index="${i}" data-course-field="startDates" placeholder="15 июня 2026&#10;1 сентября 2026">${escapeHtml((c.startDates||[]).join("\n"))}</textarea></label>
      </div>
    </article>`).join("")}</div>`;
}

function renderTeachersEditor() {
  if (!state.teachers.length) return '<div class="admin-empty-editor">Преподавателей пока нет. Добавьте первого.</div>';
  return `<div class="admin-editor-stack">${state.teachers.map((t, i) => `
    <article class="admin-entry-card">
      <div class="admin-entry-card__head">
        <div>
          <h4 class="admin-entry-card__title">${escapeHtml(t.name || `Преподаватель ${i+1}`)}</h4>
          <p class="admin-entry-card__copy">ID: ${escapeHtml(t.id||"")}</p>
        </div>
        <button type="button" class="button button--ghost" data-remove-teacher-index="${i}">Удалить</button>
      </div>
              <div class="admin-photo-upload" data-teacher-id="${escapeHtml(t.id)}">
                <div class="admin-photo-upload__preview">
                  ${t.photo
                    ? `<img class="admin-photo-img" src="${escapeHtml(t.photo)}?t=${Date.now()}" alt="${escapeHtml(t.name)}">`
                    : `<div class="specialist-card__avatar" style="width:56px;height:56px;font-size:0.9rem;">${escapeHtml(t.initials||"?")}</div>`
                  }
                </div>
                <label class="button button--ghost admin-photo-upload__btn">
                  ${t.photo ? "Заменить фото" : "Загрузить фото"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" class="admin-teacher-photo-input" hidden data-teacher-id="${escapeHtml(t.id)}">
                </label>
              </div>
      <div class="admin-entry-card__grid">
        <label class="field"><span>Имя</span><input type="text" value="${escapeHtml(t.name||"")}" data-teacher-index="${i}" data-teacher-field="name"></label>
        <label class="field"><span>ID (slug)</span><input type="text" value="${escapeHtml(t.id||"")}" data-teacher-index="${i}" data-teacher-field="id"></label>
        <label class="field"><span>Роль</span><input type="text" value="${escapeHtml(t.role||"")}" data-teacher-index="${i}" data-teacher-field="role"></label>
        <label class="field"><span>Опыт</span><input type="text" value="${escapeHtml(t.experience||"")}" data-teacher-index="${i}" data-teacher-field="experience"></label>
        <label class="field"><span>Инициалы</span><input type="text" value="${escapeHtml(t.initials||"")}" data-teacher-index="${i}" data-teacher-field="initials"></label>
        <label class="field field--full"><span>Биография</span><textarea rows="4" data-teacher-index="${i}" data-teacher-field="bio">${escapeHtml(t.bio||"")}</textarea></label>
        <div class="field field--full">
          <span>Направления</span>
          <div class="admin-check-grid admin-check-grid--services" style="margin-top:8px;">
            ${[
              { value: "massage", label: "Массаж" },
              { value: "cosmetology", label: "Косметология" },
              { value: "styling", label: "Стилисты" },
              { value: "manicure", label: "Маникюр" },
              { value: "brows", label: "Брови" },
              { value: "sugaring", label: "Шугаринг / Эпиляция" }
            ].map(dir => `
              <label class="admin-check-option">
                <input type="checkbox"
                  data-teacher-direction="${escapeHtml(dir.value)}"
                  data-teacher-index="${i}"
                  value="${escapeHtml(dir.value)}"
                  ${(t.directions||[]).includes(dir.value) ? "checked" : ""}>
                <span>${escapeHtml(dir.label)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      </div>
    </article>`).join("")}</div>`;
}

async function handleSaveSchool() {
  try {
    const processed = state.courses.map(c => ({
      ...c,
      price: Number(c.price) || 0,
      benefits: typeof c.benefits === "string" ? c.benefits.split("\n").map(s => s.trim()).filter(Boolean) : (c.benefits || []),
      startDates: typeof c.startDates === "string" ? c.startDates.split("\n").map(s => s.trim()).filter(Boolean) : (c.startDates || [])
    }));
    await fetchJson("/api/admin/school", {
      method: "PUT",
      body: JSON.stringify({ courses: processed, teachers: state.teachers })
    });
    state.courses = processed;
    renderSchoolEditors();
    showToast("Данные школы сохранены.", "success");
  } catch {
    showToast("Ошибка сохранения.", "error");
  }
}

function handleAddCourse() {
  state.courses.push({ id: `course-${Date.now()}`, direction: "massage", name: "", subtitle: "", level: "beginner", format: "group", duration: "", price: 0, currency: "EUR", description: "", benefits: [], groupSize: "", certificate: true });
  renderSchoolEditors();
}

function handleAddTeacher() {
  state.teachers.push({ id: `teacher-${Date.now()}`, name: "", role: "", experience: "", bio: "", directions: [], initials: "", photo: null });
  renderSchoolEditors();
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
    <div class="admin-list-grid">
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
                ${renderCollectionField("ID (slug)", index, "id", service.id || "", "service")}
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
              <div class="admin-photo-upload" data-specialist-id="${escapeHtml(specialist.id)}">
                <div class="admin-photo-upload__preview">
                  ${specialist.photo
                    ? `<img class="admin-photo-img" src="${escapeHtml(specialist.photo)}?t=${Date.now()}" alt="${escapeHtml(specialist.name)}">`
                    : `<div class="specialist-card__avatar">${escapeHtml(specialist.initials)}</div>`
                  }
                </div>
                <label class="button button--ghost admin-photo-upload__btn">
                  ${specialist.photo ? "Заменить фото" : "Загрузить фото"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" class="admin-photo-input" hidden data-specialist-id="${escapeHtml(specialist.id)}">
                </label>
              </div>
              <div class="admin-entry-card__grid">
                ${renderCollectionField("ID (slug)", index, "id", specialist.id || "", "specialist")}
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
    // Merge banner from form into site before saving
    if (scope === "site" && state.site) {
      state.site.promoBanner = {
        enabled: document.getElementById("bannerEnabled")?.checked || false,
        text: document.getElementById("bannerText")?.value.trim() || "",
        cta: document.getElementById("bannerCta")?.value.trim() || "",
        ctaUrl: document.getElementById("bannerCtaUrl")?.value.trim() || "",
        color: document.getElementById("bannerColor")?.value || "brand"
      };
    }
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
    const loginData = await fetchJson("/api/admin/session", {
      method: "POST",
      body: JSON.stringify({ pin })
    });
    state.adminPin = "__session__";
    state.role = loginData.role || "admin";
    await loadAdminData();
    elements.adminPin.value = "";
    elements.adminPanel.hidden = false;
    elements.adminGateMessage.textContent =
      state.role === "staff"
        ? "Вы вошли как сотрудник — доступен журнал записей."
        : "Доступ открыт. Панель загружена, статусы можно менять прямо в журнале.";
    applyRoleRestrictions();
    syncRevealTargets();
    showToast("Админ-панель подключена.", "success");
    loadAnalytics();
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
  await Promise.all([loadDaySchedule(), loadClientsData(), loadEnrollments()]);
  try {
    const certData = await fetchJson("/api/admin/certificates");
    state.certificates = certData.certificates || [];
    renderCertificatesTable();
  } catch {}
  try {
    state.diplomas = await fetchJson("/api/admin/diplomas");
    renderDiplomasTable();
  } catch {}
  loadExpenses();
  loadPackages();
  try {
    const diaryData = await fetchJson("/api/admin/diary");
    state.diary = diaryData.entries || [];
    renderDiaryEntriesList();
  } catch {}
  try {
    const intakesData = await fetchJson("/api/admin/intakes");
    renderIntakesList(intakesData.intakes || []);
  } catch {}
  renderDashboard();
}

async function loadEnrollments() {
  try {
    const payload = await fetchJson("/api/admin/enrollments");
    state.enrollments = payload.enrollments || [];
    renderEnrollmentsTable();
  } catch {}
}

function renderCertificatesTable() {
  const tbody = document.getElementById("certificatesTableBody");
  if (!tbody) return;
  if (!state.certificates.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Сертификатов пока нет. Нажмите «Создать сертификат».</div></td></tr>';
    return;
  }
  const statusLabels = { active: "Активен", used: "Использован", cancelled: "Отменён" };
  const statusColors = { active: "var(--success)", used: "var(--muted)", cancelled: "var(--danger)" };
  tbody.innerHTML = state.certificates
    .slice().reverse()
    .map(c => {
      const expires = new Date(c.expiresAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
      const isExpired = new Date(c.expiresAt) < new Date() && c.status === "active";
      return `<tr>
        <td><span class="table-main" style="font-family:monospace;">${escapeHtml(c.code)}</span></td>
        <td><span class="table-main">${escapeHtml(c.recipient || "—")}</span></td>
        <td><span class="table-main">${escapeHtml(c.procedure || "Любая процедура")}</span></td>
        <td><span class="table-main">${escapeHtml(String(c.amount))} MDL</span></td>
        <td><span class="table-main${isExpired ? '" style="color:var(--danger)' : ''}">${expires}</span></td>
        <td>
          <select class="cert-status-select" data-cert-id="${escapeHtml(c.id)}" style="font-size:0.82rem;color:${statusColors[c.status]||''};">
            ${["active","used","cancelled"].map(s => `<option value="${s}"${c.status===s?" selected":""}>${statusLabels[s]}</option>`).join("")}
          </select>
        </td>
      </tr>`;
    }).join("");
}

// ─── Expense Calculator ───────────────────────────────────────────────────────
let expenseItems = [];

function expCurrentMonth() {
  return document.getElementById("expenseMonth")?.value || new Date().toISOString().slice(0, 7);
}

async function loadExpenses() {
  const monthEl = document.getElementById("expenseMonth");
  if (!monthEl) return;
  const today = new Date().toISOString().slice(0, 7);
  if (!monthEl.value) monthEl.value = today;
  try {
    const data = await fetchJson(`/api/admin/expenses?month=${expCurrentMonth()}`);
    expenseItems = data.items || [];
  } catch { expenseItems = []; }
  renderExpenseRows();
  renderExpenseSummary();
}

function addExpenseRow(name = "") {
  expenseItems.push({ id: crypto.randomUUID(), name, amount: 0, category: "other" });
  renderExpenseRows();
  renderExpenseSummary();
}

function addPreset(name) { addExpenseRow(name); }

function removeExpenseRow(id) {
  expenseItems = expenseItems.filter(i => i.id !== id);
  renderExpenseRows();
  renderExpenseSummary();
}

function renderExpenseRows() {
  const container = document.getElementById("expenseRows");
  if (!container) return;
  if (!expenseItems.length) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;padding:4px 0;">Нет статей. Нажмите «+ Добавить» или выберите из быстрых кнопок.</p>';
    return;
  }
  container.innerHTML = expenseItems.map(item => `
    <div style="display:grid;grid-template-columns:1fr 130px 32px;gap:8px;align-items:center;">
      <input type="text" value="${escapeHtml(item.name)}" placeholder="Название статьи"
        style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:0.85rem;font-family:inherit;background:#fafafa;width:100%;"
        oninput="expenseItems.find(i=>i.id==='${item.id}').name=this.value;">
      <div style="position:relative;">
        <input type="number" value="${item.amount || ""}" placeholder="0" min="0"
          style="border:1px solid var(--line);border-radius:8px;padding:8px 32px 8px 10px;font-size:0.85rem;font-family:inherit;background:#fafafa;width:100%;text-align:right;"
          oninput="expenseItems.find(i=>i.id==='${item.id}').amount=parseFloat(this.value)||0;renderExpenseSummary();">
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:0.75rem;color:var(--muted);pointer-events:none;">MDL</span>
      </div>
      <button onclick="removeExpenseRow('${item.id}')"
        style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:1rem;padding:4px;border-radius:6px;line-height:1;"
        title="Удалить">×</button>
    </div>
  `).join("");
}

function renderExpenseSummary() {
  const total = expenseItems.reduce((s, i) => s + (i.amount || 0), 0);
  const totalEl = document.getElementById("expTotalDisplay");
  if (totalEl) totalEl.textContent = total.toLocaleString("ru") + " MDL";

  // revenue from bookings for the selected month
  const month = expCurrentMonth();
  const bookings = state.adminData?.bookings || [];
  const revenue = bookings
    .filter(b => b.status === "done" && b.date?.startsWith(month))
    .reduce((s, b) => s + (b.price || 0), 0);

  const revEl = document.getElementById("expRevenueDisplay");
  if (revEl) revEl.textContent = revenue ? revenue.toLocaleString("ru") + " MDL" : "— MDL";

  const profit = revenue ? revenue - total : null;
  const profitEl = document.getElementById("expProfitDisplay");
  const profitCard = document.getElementById("expProfitCard");
  if (profitEl) {
    profitEl.textContent = profit !== null ? profit.toLocaleString("ru") + " MDL" : "— MDL";
    if (profitCard) profitCard.style.setProperty("--kpi-color", profit !== null ? (profit >= 0 ? "var(--success)" : "var(--danger)") : "");
    if (profitEl) profitEl.style.color = profit !== null ? (profit >= 0 ? "var(--success)" : "var(--danger)") : "";
  }

  // breakdown by category
  const breakdown = document.getElementById("expBreakdown");
  if (breakdown && expenseItems.length) {
    const sorted = [...expenseItems].sort((a, b) => b.amount - a.amount);
    breakdown.innerHTML = sorted.map(i => {
      const pct = total > 0 ? Math.round(i.amount / total * 100) : 0;
      return `<div style="display:grid;gap:3px;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;">
          <span style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%;">${escapeHtml(i.name||"—")}</span>
          <span style="font-weight:600;">${(i.amount||0).toLocaleString("ru")} MDL <span style="color:var(--muted);font-weight:400;">${pct}%</span></span>
        </div>
        <div style="height:4px;background:var(--line);border-radius:2px;">
          <div style="height:100%;width:${pct}%;background:var(--brand);border-radius:2px;"></div>
        </div>
      </div>`;
    }).join("");
  } else if (breakdown) { breakdown.innerHTML = ""; }
}

async function saveExpenses() {
  try {
    await fetchJson("/api/admin/expenses", {
      method: "POST",
      body: JSON.stringify({ month: expCurrentMonth(), items: expenseItems })
    });
    showToast("Расходы сохранены.", "success");
  } catch (e) { showToast(e.message || "Ошибка сохранения.", "error"); }
}

// ─── Packages (Абонементы) ────────────────────────────────────────────────────
let pkgFilter = "all";

async function loadPackages() {
  try {
    state.packages = await fetchJson("/api/admin/packages");
  } catch { state.packages = []; }
  renderPackagesTable();
  updatePackageSelectInBookingForm();
}

function renderPackagesTable() {
  const tbody = document.getElementById("packagesTableBody");
  if (!tbody) return;
  const packages = (state.packages || []).filter(p => pkgFilter === "all" || p.status === pkgFilter);
  if (!packages.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Абонементов пока нет.</div></td></tr>`;
    return;
  }
  const statusLabel = { active: "Активен", exhausted: "Исчерпан", cancelled: "Отменён" };
  const statusColor = { active: "var(--success)", exhausted: "var(--muted)", cancelled: "var(--danger)" };
  tbody.innerHTML = packages.slice().reverse().map(p => {
    const pct = p.totalSessions > 0 ? Math.round(p.usedSessions / p.totalSessions * 100) : 0;
    const rem = p.totalSessions - p.usedSessions;
    const expires = p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("ru-RU") : "—";
    return `<tr>
      <td><span class="table-main" style="font-family:monospace;font-size:0.8rem;">${escapeHtml(p.code)}</span></td>
      <td>
        <span class="table-main">${escapeHtml(p.clientName)}</span>
        <span class="table-sub">${escapeHtml(p.phone||"")}</span>
      </td>
      <td><span class="table-main">${escapeHtml(p.serviceName||p.title||"—")}</span></td>
      <td>
        <span class="table-main">${p.usedSessions}/${p.totalSessions} сеансов</span>
        <div style="height:5px;background:var(--line);border-radius:3px;margin-top:5px;width:100px;">
          <div style="height:100%;width:${pct}%;background:${p.status==='active'?'var(--success)':'var(--muted)'};border-radius:3px;"></div>
        </div>
      </td>
      <td><span class="table-main">${(p.priceTotal||0).toLocaleString("ru")} MDL</span>
        <span class="table-sub">до ${expires}</span>
      </td>
      <td><span style="color:${statusColor[p.status]||''};font-weight:700;font-size:0.82rem;">${statusLabel[p.status]||p.status}</span></td>
      <td>
        ${p.status==="active" ? `<button class="button button--ghost button--mini" data-use-pkg="${escapeHtml(p.id)}" title="Списать сеанс">−1 сеанс</button>` : ""}
        ${p.status==="active" ? `<button class="button button--ghost button--mini" data-cancel-pkg="${escapeHtml(p.id)}" style="color:var(--danger);">Отменить</button>` : ""}
      </td>
    </tr>`;
  }).join("");
}

function updatePkgClientSuggestions() {
  const dl = document.getElementById("pkgClientSuggestions");
  if (!dl) return;
  dl.innerHTML = (state.clients||[]).map(c =>
    `<option value="${escapeHtml(c.clientName)}" data-phone="${escapeHtml(c.phone||'')}" data-id="${escapeHtml(c.id||'')}"></option>`
  ).join("");
}

function updatePackageSelectInBookingForm() {
  const sel = document.getElementById("adminBookingPackage");
  if (!sel) return;
  const name = elements.adminBookingClientName?.value?.trim() || "";
  const active = (state.packages||[]).filter(p =>
    p.status === "active" && (!name || p.clientName.toLowerCase().includes(name.toLowerCase()))
  );
  const prev = sel.value;
  sel.innerHTML = `<option value="">— без абонемента —</option>` +
    active.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.code)} · ${escapeHtml(p.serviceName||p.title)} · ${p.totalSessions-p.usedSessions} ост.</option>`).join("");
  if (prev) sel.value = prev;
}

function bindPackageEvents() {
  document.getElementById("showCreatePackageBtn")?.addEventListener("click", () => {
    document.getElementById("createPackageForm").style.display = "block";
    updatePkgClientSuggestions();
    const svcSel = document.getElementById("pkgServiceSelect");
    svcSel.innerHTML = `<option value="">— выберите —</option>` +
      (state.services||[]).map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("");
  });

  document.getElementById("cancelPackageBtn")?.addEventListener("click", () => {
    document.getElementById("createPackageForm").style.display = "none";
  });

  document.getElementById("pkgClientName")?.addEventListener("change", () => {
    const val = document.getElementById("pkgClientName").value.trim();
    const client = (state.clients||[]).find(c => c.clientName === val);
    if (client && !document.getElementById("pkgClientPhone").value) {
      document.getElementById("pkgClientPhone").value = client.phone || "";
    }
  });

  document.getElementById("savePackageBtn")?.addEventListener("click", async () => {
    const clientName = document.getElementById("pkgClientName").value.trim();
    const phone = document.getElementById("pkgClientPhone").value.trim();
    const serviceId = document.getElementById("pkgServiceSelect").value;
    const sessions = parseInt(document.getElementById("pkgSessions").value || "5", 10);
    const price = parseFloat(document.getElementById("pkgPrice").value || "0");
    const title = document.getElementById("pkgTitle").value.trim();
    const expiresAt = document.getElementById("pkgExpires").value;
    if (!clientName) { showToast("Введите имя клиента.", "error"); return; }
    if (!serviceId) { showToast("Выберите услугу.", "error"); return; }
    if (!price) { showToast("Укажите цену пакета.", "error"); return; }
    const client = (state.clients||[]).find(c => c.clientName === clientName);
    const service = (state.services||[]).find(s => s.id === serviceId);
    try {
      const result = await fetchJson("/api/admin/packages", { method: "POST", body: JSON.stringify({
        clientId: client?.id || "", clientName, phone, serviceId,
        serviceName: service?.name || "", title: title || `${sessions} × ${service?.name||""}`,
        totalSessions: sessions, priceTotal: price, expiresAt
      })});
      state.packages = state.packages || [];
      state.packages.push(result.package);
      renderPackagesTable();
      updatePackageSelectInBookingForm();
      document.getElementById("createPackageForm").style.display = "none";
      showToast(`Абонемент ${result.package.code} создан.`, "success");
      ["pkgClientName","pkgClientPhone","pkgTitle","pkgPrice","pkgExpires"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
      });
      document.getElementById("pkgSessions").value = "5";
      document.getElementById("pkgServiceSelect").value = "";
    } catch (e) { showToast(e.message || "Ошибка.", "error"); }
  });

  document.getElementById("packagesTableBody")?.addEventListener("click", async (e) => {
    const useBtn = e.target.closest("[data-use-pkg]");
    const cancelBtn = e.target.closest("[data-cancel-pkg]");
    if (useBtn) {
      const id = useBtn.dataset.usePkg;
      const pkg = (state.packages||[]).find(p => p.id === id);
      if (!pkg) return;
      if (!confirm(`Списать 1 сеанс из абонемента ${pkg.code}? Останется: ${pkg.totalSessions - pkg.usedSessions - 1}`)) return;
      try {
        const res = await fetchJson(`/api/admin/packages/${id}/use`, { method: "POST", body: JSON.stringify({ date: new Date().toISOString().slice(0,10) }) });
        const idx = state.packages.findIndex(p => p.id === id);
        if (idx !== -1) state.packages[idx] = res.package;
        renderPackagesTable();
        updatePackageSelectInBookingForm();
        showToast(`Сеанс списан. Остаток: ${res.package.totalSessions - res.package.usedSessions}`, "success");
      } catch (e) { showToast(e.message||"Ошибка.","error"); }
    }
    if (cancelBtn) {
      const id = cancelBtn.dataset.cancelPkg;
      if (!confirm("Отменить абонемент?")) return;
      try {
        await fetchJson(`/api/admin/packages/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
        const idx = state.packages.findIndex(p => p.id === id);
        if (idx !== -1) state.packages[idx].status = "cancelled";
        renderPackagesTable();
        updatePackageSelectInBookingForm();
        showToast("Абонемент отменён.", "success");
      } catch (e) { showToast(e.message||"Ошибка.","error"); }
    }
  });

  document.getElementById("pkgFilterBtns")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".pkg-filter-btn");
    if (!btn) return;
    document.querySelectorAll(".pkg-filter-btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    pkgFilter = btn.dataset.filter;
    renderPackagesTable();
  });

  elements.adminBookingClientName?.addEventListener("input", () => {
    updatePackageSelectInBookingForm();
  });
}

function renderDiplomasTable() {
  const tbody = document.getElementById("diplomasTableBody");
  if (!tbody) return;
  if (!state.diplomas.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Дипломов пока нет. Нажмите «Создать диплом».</div></td></tr>';
    return;
  }
  tbody.innerHTML = state.diplomas
    .slice().reverse()
    .map(d => {
      const date = d.completionDate
        ? new Date(d.completionDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "—";
      return `<tr>
        <td><span class="table-main" style="font-family:monospace;">${escapeHtml(d.code)}</span></td>
        <td><span class="table-main">${escapeHtml(d.graduateName || "—")}</span></td>
        <td><span class="table-main">${escapeHtml(d.courseName || "—")}</span></td>
        <td><span class="table-main">${date}</span></td>
        <td>
          <a href="/diploma.html?code=${encodeURIComponent(d.code)}" target="_blank"
             class="button button--ghost" style="font-size:0.78rem;padding:5px 10px;">
            Открыть
          </a>
        </td>
      </tr>`;
    }).join("");
}

function renderReviewsEditor() {
  const el = elements.reviewsEditor;
  if (!el) return;
  const reviews = state.site?.reviews || [];
  if (!reviews.length) {
    el.innerHTML = '<p class="empty-state">Отзывов пока нет. Нажмите «Добавить отзыв».</p>';
    return;
  }
  el.innerHTML = reviews
    .map((r, i) => `
      <div class="admin-editor-item" style="padding:16px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,0.56);display:grid;gap:10px;">
        <div class="field-grid">
          <label class="field">
            <span>Имя автора</span>
            <input type="text" data-review-index="${i}" data-review-field="author" value="${escapeHtml(r.author || "")}" placeholder="Имя Фамилия">
          </label>
          <label class="field">
            <span>Подпись</span>
            <input type="text" data-review-index="${i}" data-review-field="meta" value="${escapeHtml(r.meta || "")}" placeholder="Клиент студии · 2025">
          </label>
        </div>
        <label class="field field--full">
          <span>Текст отзыва</span>
          <textarea data-review-index="${i}" data-review-field="text" rows="3" style="resize:vertical;">${escapeHtml(r.text || "")}</textarea>
        </label>
        <button type="button" class="button button--ghost button--mini" style="color:var(--danger);justify-self:start;" data-delete-review="${i}">Удалить</button>
      </div>
    `)
    .join("");
}

function handleAddReview() {
  if (!state.site) return;
  if (!Array.isArray(state.site.reviews)) state.site.reviews = [];
  state.site.reviews.push({ author: "", meta: "Клиент студии", text: "" });
  renderReviewsEditor();
  elements.reviewsEditor.lastElementChild?.scrollIntoView({ behavior: "smooth" });
}

function handleReviewEditorInput(event) {
  const target = event.target;
  const index = Number(target.dataset.reviewIndex);
  const field = target.dataset.reviewField;
  if (!field || !Number.isInteger(index) || !state.site?.reviews?.[index]) return;
  state.site.reviews[index][field] = target.value;
}

function handleReviewEditorClick(event) {
  const btn = event.target.closest("[data-delete-review]");
  if (!btn) return;
  const index = Number(btn.dataset.deleteReview);
  if (!confirm("Удалить этот отзыв?")) return;
  state.site.reviews.splice(index, 1);
  renderReviewsEditor();
}

async function handleSaveReviews() {
  await handleContentSave("site");
}

function renderIntakesList(intakes) {
  const el = document.getElementById("intakesList");
  if (!el) return;
  if (!intakes.length) {
    el.innerHTML = '<p class="empty-state">Анкет пока нет. Когда клиент заполнит QR-форму — она появится здесь.</p>';
    return;
  }
  const goalsMap = { relaxation:"Расслабление", pain:"Боль", rehab:"Реабилитация", prevention:"Профилактика", doctor:"Назначение врача" };
  el.innerHTML = intakes.map(entry => {
    const date = new Date(entry.submittedAt).toLocaleString("ru-RU", { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" });
    const goals = (entry.goals || []).map(g => goalsMap[g] || g).join(", ") || "—";
    return `
      <div class="diary-admin-card" style="border-left:3px solid ${entry.linked ? "var(--sage)" : "var(--brand)"};">
        <div class="diary-admin-card__meta">${date} ${entry.linked ? "· ✅ Привязана" : "· 🆕 Новая"}</div>
        <div class="diary-admin-card__title">${escapeHtml(entry.name || "—")} ${entry.phone ? "· " + escapeHtml(entry.phone) : ""}</div>
        <div class="diary-admin-card__excerpt">Цель: ${escapeHtml(goals)} · ${escapeHtml(entry.complaint || "жалоб нет")}</div>
        ${entry.chronic && entry.chronic !== "Нет" ? `<div style="font-size:0.8rem;color:var(--danger);">⚠ ${escapeHtml(entry.chronic)}</div>` : ""}
      </div>`;
  }).join("");
}

async function handleDiaryTranslate() {
  const id = elements.diaryEntryId.value;
  if (!id) { showToast("Сначала сохраните запись, затем переводите.", "info"); return; }
  const btn = document.getElementById("diaryTranslateBtn");
  btn.disabled = true;
  btn.textContent = "Перевожу...";
  try {
    const data = await fetchJson(`/api/admin/diary/${id}/translate`, { method: "POST" });
    if (diaryRoTitle()) diaryRoTitle().value = data.titleRo || "";
    if (diaryRoBody())  diaryRoBody().value  = data.bodyRo  || "";
    showToast("Перевод готов. Проверьте и сохраните запись.", "success");
  } catch (err) {
    showToast(err.message || "Ошибка DeepL перевода.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "🌐 Перевести через DeepL";
  }
}

function renderDiaryEntriesList() {
  const el = elements.diaryEntriesList;
  if (!el) return;
  if (!state.diary.length) {
    el.innerHTML = '<p class="empty-state">Записей пока нет. Нажмите «Новая запись».</p>';
    return;
  }
  el.innerHTML = state.diary
    .map((entry) => {
      const date = new Date(entry.publishedAt + "T00:00:00").toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric"
      });
      return `
        <div class="diary-admin-card">
          <div class="diary-admin-card__meta">${date}${entry.published ? "" : " · <em>Черновик</em>"}</div>
          <div class="diary-admin-card__title">${escapeHtml(entry.title)}</div>
          <div class="diary-admin-card__excerpt">${escapeHtml(entry.body)}</div>
          <div class="diary-admin-card__actions">
            <button type="button" class="button button--ghost button--mini" data-diary-edit="${escapeHtml(entry.id)}">Ред.</button>
            <button type="button" class="button button--ghost button--mini diary-admin-card__delete" data-diary-delete="${escapeHtml(entry.id)}">Удалить</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function diaryRoTitle() { return document.getElementById("diaryEntryTitleRo"); }
function diaryRoBody()  { return document.getElementById("diaryEntryBodyRo"); }

function handleAddDiaryEntry() {
  elements.diaryEntryId.value = "";
  elements.diaryEntryTitle.value = "";
  elements.diaryEntryDate.value = new Date().toISOString().slice(0, 10);
  elements.diaryEntryBody.value = "";
  elements.diaryEntryPublished.checked = true;
  if (diaryRoTitle()) diaryRoTitle().value = "";
  if (diaryRoBody())  diaryRoBody().value  = "";
  elements.diaryEntryForm.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.diaryEntryTitle.focus();
}

function handleDiaryEntryCancel() {
  elements.diaryEntryId.value = "";
  elements.diaryEntryTitle.value = "";
  elements.diaryEntryBody.value = "";
  elements.diaryEntryPublished.checked = true;
  if (diaryRoTitle()) diaryRoTitle().value = "";
  if (diaryRoBody())  diaryRoBody().value  = "";
}

async function handleDiaryEntrySubmit(event) {
  event.preventDefault();
  const id = elements.diaryEntryId.value;
  const titleRo = diaryRoTitle()?.value.trim() || undefined;
  const bodyRo  = diaryRoBody()?.value.trim()  || undefined;
  const payload = {
    title: elements.diaryEntryTitle.value.trim(),
    body: elements.diaryEntryBody.value.trim(),
    publishedAt: elements.diaryEntryDate.value || new Date().toISOString().slice(0, 10),
    published: elements.diaryEntryPublished.checked,
    ...(titleRo && { titleRo }),
    ...(bodyRo  && { bodyRo  })
  };

  try {
    if (id) {
      await fetchJson(`/api/admin/diary/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      showToast("Запись обновлена.", "success");
    } else {
      await fetchJson("/api/admin/diary", { method: "POST", body: JSON.stringify(payload) });
      showToast("Запись добавлена.", "success");
    }
    const diaryData = await fetchJson("/api/admin/diary");
    state.diary = diaryData.entries || [];
    renderDiaryEntriesList();
    handleDiaryEntryCancel();
  } catch (error) {
    showToast(error.message || "Не удалось сохранить запись.", "error");
  }
}

async function handleDiaryListClick(event) {
  const editBtn = event.target.closest("[data-diary-edit]");
  if (editBtn) {
    const entry = state.diary.find((e) => e.id === editBtn.dataset.diaryEdit);
    if (!entry) return;
    elements.diaryEntryId.value = entry.id;
    elements.diaryEntryTitle.value = entry.title;
    elements.diaryEntryDate.value = entry.publishedAt;
    elements.diaryEntryBody.value = entry.body;
    elements.diaryEntryPublished.checked = entry.published;
    if (diaryRoTitle()) diaryRoTitle().value = entry.titleRo || "";
    if (diaryRoBody())  diaryRoBody().value  = entry.bodyRo  || "";
    elements.diaryEntryForm.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.diaryEntryTitle.focus();
    return;
  }
  const deleteBtn = event.target.closest("[data-diary-delete]");
  if (deleteBtn) {
    if (!confirm("Удалить запись навсегда?")) return;
    try {
      await fetchJson(`/api/admin/diary/${deleteBtn.dataset.diaryDelete}`, { method: "DELETE" });
      const diaryData = await fetchJson("/api/admin/diary");
      state.diary = diaryData.entries || [];
      renderDiaryEntriesList();
      showToast("Запись удалена.", "success");
    } catch (error) {
      showToast(error.message || "Не удалось удалить запись.", "error");
    }
  }
}

async function tryAutoLoginFromSession() {
  try {
    const response = await fetch("/api/admin/session", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    state.adminPin = "__session__";
    state.role = data.role || "admin";
    await loadAdminData();
    elements.adminPanel.hidden = false;
    elements.adminGateMessage.textContent =
      "Super-user сессия восстановлена. Кабинет открыт автоматически.";
    applyRoleRestrictions();
    syncRevealTargets();
    loadAnalytics();
  } catch {
    state.adminPin = "";
    elements.adminPin.value = "";
  }
}

function applyRoleRestrictions() {
  if (state.role !== "staff") return;

  // Staff: show only requests journal and clients (read-only hint)
  const staffSections = ["overview", "requests", "clients"];
  const nav = document.querySelector(".admin-sidebar__nav");
  if (!nav) return;

  nav.querySelectorAll("a[data-section]").forEach((link) => {
    if (!staffSections.includes(link.dataset.section)) {
      link.style.display = "none";
    }
  });
  nav.querySelectorAll("hr").forEach((hr) => hr.style.display = "none");

  // Hide client profile save button (read-only for staff)
  document.querySelectorAll(".client-detail__save, [data-rebook-client]").forEach((el) => {
    el.style.display = "none";
  });

  showToast("Вы вошли как сотрудник — доступен только журнал записей.", "info");
  activateSection("requests");
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
  renderRevenueChart(state.adminData?.bookings || []);
  renderSlotHeatmap(state.adminData?.bookings || []);
  renderUpcomingBirthdays();
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
    },
    (() => {
      const phoneMap = new Map();
      bookings.filter((b) => b.status === "completed" || b.status === "confirmed").forEach((b) => {
        const key = (b.phone || "").replace(/\D/g, "").slice(-8);
        if (key) phoneMap.set(key, (phoneMap.get(key) || 0) + 1);
      });
      const total = phoneMap.size;
      const returning = [...phoneMap.values()].filter((c) => c > 1).length;
      const pct = total > 0 ? Math.round((returning / total) * 100) : 0;
      return {
        label: "Возврат",
        value: total > 0 ? `${pct}%` : "—",
        hint: total > 0 ? `${returning} из ${total} клиентов приходят повторно` : "появится после первых визитов"
      };
    })()
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

let chartPeriod = 30;

function renderRevenueChart(bookings, period) {
  const chartEl = document.getElementById("revenueChart");
  const totalEl = document.getElementById("revenueChartTotal");
  if (!chartEl) return;

  if (period !== undefined) chartPeriod = period;
  const days = chartPeriod;
  const today = new Date();
  const monthNames = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

  // Build daily data
  const dailyMap = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyMap.set(dateStr, { d, revenue: 0 });
  }
  bookings.forEach((b) => {
    if (dailyMap.has(b.date) && (b.status === "confirmed" || b.status === "completed")) {
      dailyMap.get(b.date).revenue += Number(b.totalPrice || 0);
    }
  });

  // Group by week if > 30 days
  let data;
  if (days <= 30) {
    data = [...dailyMap.values()].map((item) => ({
      label: `${item.d.getDate()} ${monthNames[item.d.getMonth()]}`,
      revenue: item.revenue
    }));
  } else if (days <= 90) {
    // Group by week
    const weeks = new Map();
    [...dailyMap.values()].forEach(({ d, revenue }) => {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toISOString().slice(0, 10);
      if (!weeks.has(key)) weeks.set(key, { d: weekStart, revenue: 0 });
      weeks.get(key).revenue += revenue;
    });
    data = [...weeks.values()].map(({ d, revenue }) => ({
      label: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      revenue
    }));
  } else {
    // Group by month
    const months = new Map();
    [...dailyMap.values()].forEach(({ d, revenue }) => {
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!months.has(key)) months.set(key, { d, revenue: 0 });
      months.get(key).revenue += revenue;
    });
    data = [...months.values()].map(({ d, revenue }) => ({
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      revenue
    }));
  }

  const totalRevenue = data.reduce((s, item) => s + item.revenue, 0);
  const prevPeriodRevenue = (() => {
    let prev = 0;
    bookings.forEach((b) => {
      const d = new Date(b.date + "T00:00:00");
      const diffDays = (today - d) / 86400000;
      if (diffDays >= days && diffDays < days * 2 && (b.status === "confirmed" || b.status === "completed")) {
        prev += Number(b.totalPrice || 0);
      }
    });
    return prev;
  })();
  const trend = prevPeriodRevenue > 0
    ? Math.round(((totalRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100)
    : null;

  if (totalEl) {
    const trendHtml = trend !== null
      ? `<span style="font-size:0.72rem;font-weight:600;color:${trend >= 0 ? "var(--success)" : "var(--danger)"};margin-left:8px;">${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}%</span>`
      : "";
    totalEl.innerHTML = `${totalRevenue > 0 ? formatCurrency(totalRevenue) : "—"}${trendHtml}`;
  }

  const maxRevenue = Math.max(1, ...data.map((item) => item.revenue));
  const barWidth = Math.max(8, Math.min(20, Math.floor(480 / data.length) - 4));
  const gap = Math.max(2, Math.round(barWidth * 0.3));
  const chartH = 120;
  const svgW = data.length * (barWidth + gap) - gap;

  const bars = data.map((item, i) => {
    const barH = item.revenue > 0 ? Math.max(4, Math.round((item.revenue / maxRevenue) * chartH)) : 2;
    const x = i * (barWidth + gap);
    const y = chartH - barH;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3"
      fill="${item.revenue > 0 ? "var(--brand)" : "var(--line-strong)"}"
      opacity="${item.revenue > 0 ? "0.85" : "0.4"}">
      <title>${item.label}: ${formatCurrency(item.revenue)}</title>
    </rect>`;
  }).join("");

  const labelStep = Math.max(1, Math.round(data.length / 6));
  const labels = data
    .filter((_, i) => i % labelStep === 0 || i === data.length - 1)
    .map((item) => {
      const i = data.indexOf(item);
      const x = i * (barWidth + gap) + barWidth / 2;
      return `<text x="${x}" y="${chartH + 16}" text-anchor="middle" font-size="9" fill="var(--muted)">${item.label}</text>`;
    }).join("");

  chartEl.innerHTML = `
    <svg width="100%" viewBox="0 0 ${svgW} ${chartH + 24}" preserveAspectRatio="none" style="display:block;overflow:visible;margin-top:12px;">
      ${bars}${labels}
    </svg>`;
}

function renderUpcomingBirthdays() {
  const el = document.getElementById("birthdayWidget");
  if (!el) return;
  const today = new Date();
  const mm = today.getMonth() + 1;
  const dd = today.getDate();
  const upcoming = (state.clients || [])
    .filter(c => c.medCard?.dob)
    .map(c => {
      const [y, m, d] = c.medCard.dob.split("-").map(Number);
      let next = new Date(today.getFullYear(), m - 1, d);
      if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
      const days = Math.round((next - today) / 86400000);
      return { name: c.clientName, days, date: `${d} ${["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"][m-1]}` };
    })
    .filter(c => c.days <= 14)
    .sort((a, b) => a.days - b.days);

  if (!upcoming.length) { el.closest(".admin-widget")?.setAttribute("data-empty","true"); return; }
  el.closest(".admin-widget")?.removeAttribute("data-empty");
  el.innerHTML = upcoming.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);">
      <span style="font-weight:600;">🎂 ${escapeHtml(c.name)}</span>
      <span style="font-size:0.82rem;color:var(--muted);">${c.date} · ${c.days === 0 ? "сегодня!" : c.days === 1 ? "завтра" : `через ${c.days} дн.`}</span>
    </div>`).join("");
}

function renderSlotHeatmap(bookings) {
  const el = document.getElementById("slotHeatmap");
  if (!el) return;

  const completed = bookings.filter((b) => b.status === "completed" || b.status === "confirmed");
  if (!completed.length) {
    el.innerHTML = '<div class="empty-state">Нет данных — появится после первых завершённых записей.</div>';
    return;
  }

  // Build grid: day of week (0=Mon..6=Sun) × hour (9..20)
  const hours = Array.from({ length: 12 }, (_, i) => i + 9); // 9..20
  const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const grid = Array.from({ length: 7 }, () => new Array(hours.length).fill(0));

  completed.forEach((b) => {
    if (!b.date || !b.slot) return;
    const dow = new Date(b.date + "T00:00:00").getDay(); // 0=Sun
    const jsDay = (dow + 6) % 7; // 0=Mon
    const hour = parseInt(b.slot.split(":")[0], 10);
    const hIdx = hours.indexOf(hour);
    if (hIdx !== -1) grid[jsDay][hIdx]++;
  });

  const maxVal = Math.max(1, ...grid.flat());
  const cellW = 36;
  const cellH = 28;
  const labelW = 28;
  const labelH = 20;
  const cols = hours.length;
  const rows = 7;
  const svgW = labelW + cols * cellW;
  const svgH = labelH + rows * cellH;

  const cells = grid.flatMap((row, dayIdx) =>
    row.map((val, hIdx) => {
      const x = labelW + hIdx * cellW;
      const y = labelH + dayIdx * cellH;
      const intensity = val / maxVal;
      const alpha = val === 0 ? 0.06 : 0.15 + intensity * 0.8;
      const color = val === 0 ? "var(--line-strong)" : `rgba(179,109,44,${alpha.toFixed(2)})`;
      const textColor = intensity > 0.6 ? "#fff" : "var(--ink)";
      return `
        <rect x="${x+1}" y="${y+1}" width="${cellW-2}" height="${cellH-2}" rx="4" fill="${color}"/>
        ${val > 0 ? `<text x="${x+cellW/2}" y="${y+cellH/2+4}" text-anchor="middle" font-size="10" fill="${textColor}" font-weight="600">${val}</text>` : ""}
        <title>${dayLabels[dayIdx]}, ${hours[hIdx]}:00 — ${val} записей</title>`;
    })
  ).join("");

  const hourLabels = hours.map((h, i) =>
    `<text x="${labelW + i * cellW + cellW/2}" y="${labelH - 4}" text-anchor="middle" font-size="9" fill="var(--muted)">${h}:00</text>`
  ).join("");

  const dayLabelsSvg = dayLabels.map((d, i) =>
    `<text x="${labelW - 4}" y="${labelH + i * cellH + cellH/2 + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${d}</text>`
  ).join("");

  el.innerHTML = `
    <svg width="${svgW}" height="${svgH}" style="display:block;min-width:${svgW}px;">
      ${hourLabels}
      ${dayLabelsSvg}
      ${cells}
    </svg>
    <div style="margin-top:8px;display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--muted);">
      <span>Мало</span>
      ${[0.15,0.35,0.55,0.75,0.95].map(a => `<span style="display:inline-block;width:16px;height:10px;border-radius:3px;background:rgba(179,109,44,${a});"></span>`).join("")}
      <span>Много</span>
    </div>`;
}

function renderTodayTimeline(bookings) {
  const widget = elements.todayTimeline.closest(".admin-widget");
  if (!bookings.length) {
    elements.todayTimeline.innerHTML = `
      <div class="empty-state">На сегодня записей нет.</div>
    `;
    if (widget) widget.dataset.empty = "true";
    return;
  }
  if (widget) delete widget.dataset.empty;

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
            ${booking.status === "completed" ? `
            <div style="margin-top:6px;">
              <textarea class="session-notes-input" data-booking-id="${escapeHtml(booking.id)}"
                placeholder="Заметки специалиста: что делали, результат, рекомендации..."
                style="width:100%;font-size:0.78rem;padding:6px 8px;border-radius:8px;border:1px solid var(--line);resize:vertical;min-height:52px;font-family:inherit;">${escapeHtml(booking.sessionNotes || "")}</textarea>
              <button type="button" class="button button--ghost button--mini save-session-notes" data-booking-id="${escapeHtml(booking.id)}" style="margin-top:4px;">Сохранить</button>
            </div>` : ""}
          </td>
        </tr>
      `
    )
    .join("");

  // Session notes save handler
  elements.adminTableBody.querySelectorAll(".save-session-notes").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.bookingId;
      const notes = elements.adminTableBody.querySelector(`.session-notes-input[data-booking-id="${id}"]`)?.value || "";
      try {
        await fetchJson(`/api/admin/bookings/${id}/session-notes`, {
          method: "PATCH",
          body: JSON.stringify({ sessionNotes: notes })
        });
        const booking = state.adminData?.bookings?.find(b => b.id === id);
        if (booking) booking.sessionNotes = notes;
        showToast("Заметка сохранена.", "success");
      } catch { showToast("Ошибка сохранения.", "error"); }
    });
  });
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
                    <input
                      type="text"
                      class="admin-inline-input"
                      value="${escapeHtml(item)}"
                      placeholder="${escapeHtml(placeholder)}"
                      data-site-list-path="${escapeHtml(path)}"
                      data-index="${index}"
                    >
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
  // Disabled — handled by initSectionNav / activateSection
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

function parseMarkdownAdmin(text) {
  if (!text) return "";
  let s = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%;border-radius:10px;margin:12px 0;display:block;">');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" style="color:#6b8d6b;">$1</a>');
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g,'<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
  return s.split(/\n{2,}/).map(b => {
    b = b.trim(); if (!b) return "";
    if (b.startsWith("### ")) return `<h3 style="font-size:1.15rem;margin:16px 0 8px;color:#1a2e22;">${b.slice(4)}</h3>`;
    if (b.startsWith("## ")) return `<h2 style="font-size:1.35rem;margin:20px 0 10px;color:#1a2e22;">${b.slice(3)}</h2>`;
    if (b.startsWith("# ")) return `<h1 style="font-size:1.6rem;margin:24px 0 12px;color:#1a2e22;">${b.slice(2)}</h1>`;
    if (b === "---") return '<hr style="border:none;border-top:1px solid var(--line);margin:20px 0;">';
    if (b.startsWith("&gt; ")) return `<blockquote style="border-left:3px solid #b36d2c;padding:8px 16px;color:#5a4e45;font-style:italic;">${b.slice(5)}</blockquote>`;
    if (b.match(/^- /m)) {
      const items = b.split("\n").filter(l=>l.startsWith("- ")).map(l=>`<li>${l.slice(2)}</li>`).join("");
      return `<ul style="padding-left:20px;">${items}</ul>`;
    }
    if (b.includes("<img")) return b;
    return `<p style="margin-bottom:12px;">${b.replace(/\n/g,"<br>")}</p>`;
  }).filter(Boolean).join("\n");
}

function buildDefaultDaySchedules() {
  return Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: d >= 1 && d <= 5, start: "09:00", end: "20:00" }])
  );
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

function handleExportClientsCsv() {
  const clients = state.clients || [];
  if (!clients.length) { showToast("Клиентов пока нет.", "info"); return; }
  const headers = ["Имя", "Телефон", "Email", "Статус", "Всего визитов", "Завершено", "Выручка", "Последний визит", "Профессия", "Дата рождения", "Заметка"];
  const rows = clients.map(c => [
    c.clientName, c.phone || "", c.email || "",
    clientStatusLabels[c.status] || c.status,
    c.totalVisits, c.completedVisits,
    c.totalSpent,
    c.lastBooking ? `${c.lastBooking.date} ${c.lastBooking.slot}` : "",
    c.medCard?.profession || "",
    c.medCard?.dob || "",
    c.note || ""
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mateev-clients-${getLocalDateString()}.csv`;
  a.click();
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

  let daySchedules;
  if (specialist.daySchedules && typeof specialist.daySchedules === "object") {
    daySchedules = Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const raw = specialist.daySchedules[d] ?? specialist.daySchedules[String(d)];
        return [d, {
          enabled: !!(raw?.enabled),
          start: raw?.start || "09:00",
          end: raw?.end || "20:00"
        }];
      })
    );
  } else {
    const workDays = specialist.workDays || [1, 2, 3, 4, 5];
    const start = specialist.workHours?.start || "09:00";
    const end = specialist.workHours?.end || "20:00";
    daySchedules = Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: workDays.includes(d), start, end }])
    );
  }

  state.operations.scheduleForm = {
    specialistId: specialist.id,
    daySchedules,
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

function updateClientSuggestions() {
  const dl = document.getElementById("clientNameSuggestions");
  if (!dl) return;
  dl.innerHTML = state.clients.map(c =>
    `<option value="${escapeHtml(c.clientName)}" data-phone="${escapeHtml(c.phone||'')}" data-email="${escapeHtml(c.email||'')}"></option>`
  ).join("");
}

function renderOperationsSelects() {
  const bookingForm = state.operations.bookingForm;
  updateClientSuggestions();
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

  // Sort: most visits first, then by name
  clients.sort((a, b) => b.totalVisits - a.totalVisits || a.clientName.localeCompare(b.clientName, "ru"));

  const CLIENT_PAGE_SIZE = 20;
  const totalClientPages = Math.ceil(clients.length / CLIENT_PAGE_SIZE);
  state.clientPage = Math.min(state.clientPage, Math.max(0, totalClientPages - 1));
  const pageClients = clients.slice(state.clientPage * CLIENT_PAGE_SIZE, (state.clientPage + 1) * CLIENT_PAGE_SIZE);

  const selectedClient =
    pageClients.find((client) => client.id === state.selectedClientId) ||
    clients.find((client) => client.id === state.selectedClientId) ||
    pageClients[0] || clients[0];
  state.selectedClientId = selectedClient?.id || "";

  const paginationHtml = totalClientPages > 1 ? `
    <div class="table-pagination" style="padding:8px 12px;">
      <span class="table-pagination__info">Стр. ${state.clientPage + 1}/${totalClientPages} · ${clients.length} клиентов</span>
      <div class="table-pagination__btns">
        <button type="button" class="button button--ghost button--mini" id="clientPgPrev" ${state.clientPage === 0 ? "disabled" : ""}>←</button>
        <button type="button" class="button button--ghost button--mini" id="clientPgNext" ${state.clientPage >= totalClientPages - 1 ? "disabled" : ""}>→</button>
      </div>
    </div>` : "";

  elements.clientsList.innerHTML = `
    <div class="client-list">
      ${pageClients
        .map(
          (client) => `
            <button
              type="button"
              class="client-list-item ${client.id === selectedClient?.id ? "is-active" : ""}"
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
    ${paginationHtml}
  `;

  document.getElementById("clientPgPrev")?.addEventListener("click", () => { state.clientPage--; renderClientsWorkspace(); });
  document.getElementById("clientPgNext")?.addEventListener("click", () => { state.clientPage++; renderClientsWorkspace(); });

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
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <div>
              <p class="section-kicker">Карточка клиента</p>
              <h3 class="admin-widget__title">${escapeHtml(client.clientName)}</h3>
            </div>
            <button type="button" class="button button--secondary button--mini"
              data-rebook-client="${escapeHtml(client.id)}"
              style="flex-shrink:0;">
              + Записать снова
            </button>
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
        <!-- ── Медицинская карта ── -->
        <div style="background:rgba(26,46,34,0.05);border:1px solid rgba(26,46,34,0.15);border-radius:16px;padding:20px 24px;display:grid;gap:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <p class="section-kicker" style="margin-bottom:4px;">Персональная карта пациента</p>
              <p style="font-size:0.82rem;color:var(--muted);">Заполняется при первом визите</p>
            </div>
            <a href="/medical-card/${escapeHtml(client.id)}" target="_blank" class="button button--ghost button--mini">🖨 Распечатать</a>
          </div>

          <div class="field-grid">
            <label class="field"><span>Дата рождения</span>
              <input type="date" name="mc_dob" value="${escapeHtml(client.medCard?.dob || "")}"></label>
            <label class="field"><span>Профессия / тип работы</span>
              <input type="text" name="mc_profession" placeholder="Программист, водитель..." value="${escapeHtml(client.medCard?.profession || "")}"></label>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            <label class="field"><span>АД верхнее</span>
              <input type="number" name="mc_bp_sys" placeholder="120" value="${escapeHtml(String(client.medCard?.bp_sys || ""))}"></label>
            <label class="field"><span>АД нижнее</span>
              <input type="number" name="mc_bp_dia" placeholder="80" value="${escapeHtml(String(client.medCard?.bp_dia || ""))}"></label>
            <label class="field"><span>Пульс</span>
              <input type="number" name="mc_pulse" placeholder="72" value="${escapeHtml(String(client.medCard?.pulse || ""))}"></label>
          </div>

          <div class="field-grid">
            <label class="field"><span>Самочувствие сегодня (1–10)</span>
              <input type="number" name="mc_wellbeing" min="1" max="10" placeholder="7" value="${escapeHtml(String(client.medCard?.wellbeing || ""))}"></label>
            <label class="field"><span>Последний массаж</span>
              <input type="text" name="mc_last_massage" placeholder="6 месяцев назад / никогда" value="${escapeHtml(client.medCard?.last_massage || "")}"></label>
          </div>

          <label class="field field--full"><span>Цель визита</span>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
              ${[["relaxation","Расслабление"],["pain","Боль / напряжение"],["rehab","Реабилитация"],["prevention","Профилактика"],["doctor","Назначение врача"]].map(([v,l]) =>
                `<label style="display:flex;align-items:center;gap:5px;font-size:0.85rem;cursor:pointer;">
                  <input type="checkbox" name="mc_goals" value="${v}" ${(client.medCard?.goals||[]).includes(v)?"checked":""}> ${l}
                </label>`).join("")}
            </div>
          </label>

          <label class="field field--full"><span>Основная жалоба / запрос</span>
            <textarea rows="2" name="mc_complaint" placeholder="Боль в шее, скованность по утрам...">${escapeHtml(client.medCard?.complaint || "")}</textarea></label>

          <label class="field field--full"><span>Хронические заболевания</span>
            <input type="text" name="mc_chronic" placeholder="Нет / Гипертония / Диабет..." value="${escapeHtml(client.medCard?.chronic || "")}"></label>

          <div class="field-grid">
            <label class="field"><span>Травмы и операции</span>
              <input type="text" name="mc_injuries" placeholder="Нет / Перелом 2018..." value="${escapeHtml(client.medCard?.injuries || "")}"></label>
            <label class="field"><span>Принимаемые препараты</span>
              <input type="text" name="mc_medications" placeholder="Нет / Конкор..." value="${escapeHtml(client.medCard?.medications || "")}"></label>
          </div>

          <label class="field field--full"><span>Аллергии (масла, ароматы, кремы)</span>
            <input type="text" name="mc_allergies" placeholder="Нет / Лаванда..." value="${escapeHtml(client.medCard?.allergies || "")}"></label>

          <label class="field field--full"><span>Зоны фокуса (где работать)</span>
            <input type="text" name="mc_focus" placeholder="Шея, плечи, поясница..." value="${escapeHtml(client.medCard?.focus || "")}"></label>

          <label class="field field--full"><span>Зоны избегать</span>
            <input type="text" name="mc_avoid" placeholder="Нет / Правое колено..." value="${escapeHtml(client.medCard?.avoid || "")}"></label>

          <label style="display:flex;align-items:flex-start;gap:8px;font-size:0.85rem;cursor:pointer;">
            <input type="checkbox" name="mc_contraindications" ${client.medCard?.contraindications_ok?"checked":""} style="margin-top:2px;">
            <span>Клиент ознакомлен с противопоказаниями и подтверждает отсутствие запретов</span>
          </label>

          <div class="field-grid">
            <label class="field"><span>Дата заполнения</span>
              <input type="date" name="mc_date" value="${escapeHtml(client.medCard?.date || new Date().toISOString().slice(0,10))}"></label>
            <label class="field"><span>Карта заполнена</span>
              <select name="mc_status">
                <option value="">Не заполнена</option>
                <option value="filled" ${client.medCard?.status==="filled"?"selected":""}>Заполнена</option>
                <option value="signed" ${client.medCard?.status==="signed"?"selected":""}>Подписана</option>
              </select>
            </label>
          </div>
        </div>
        <!-- ── конец медкарты ── -->
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

      ${(() => {
        const clientPkgs = (state.packages||[]).filter(p => p.clientName === client.clientName || (client.phone && p.phone === client.phone));
        const pkgRows = clientPkgs.map(p => {
          const rem = p.totalSessions - p.usedSessions;
          const pct = p.totalSessions > 0 ? Math.round(p.usedSessions / p.totalSessions * 100) : 0;
          const color = p.status === "active" ? "var(--success)" : "var(--muted)";
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);">
            <div style="flex:1;min-width:0;">
              <strong style="font-size:0.88rem;">${escapeHtml(p.code)}</strong>
              <span style="display:block;font-size:0.78rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.serviceName||p.title)}</span>
              <div style="height:4px;background:var(--line);border-radius:2px;width:100%;max-width:120px;margin-top:5px;">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;"></div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <strong style="color:${color};">${rem} ост.</strong>
              <span style="display:block;font-size:0.75rem;color:var(--muted);">${p.usedSessions}/${p.totalSessions}</span>
            </div>
            ${p.status === "active" ? `<button class="button button--ghost button--mini" data-use-pkg="${escapeHtml(p.id)}" style="flex-shrink:0;">−1</button>` : ""}
          </div>`;
        }).join("");

        return `<div class="admin-editor-item" style="margin-bottom:16px;">
          <div class="admin-editor-item__toolbar">
            <span class="admin-editor-item__index">Абонементы</span>
            <button class="button button--ghost button--mini"
              data-new-pkg-client="${escapeHtml(client.clientName)}"
              data-new-pkg-phone="${escapeHtml(client.phone||'')}">+ Новый</button>
          </div>
          <div style="padding:${clientPkgs.length?'0 16px':'12px 16px'};">
            ${pkgRows || '<p style="font-size:0.82rem;color:var(--muted);">Абонементов нет. Нажмите «+ Новый».</p>'}
          </div>
        </div>`;
      })()}

      <div class="admin-editor-item">
        <div class="admin-editor-item__toolbar">
          <span class="admin-editor-item__index">История визитов</span>
        </div>
        <div class="client-history">
          ${client.history
            .map(
              (booking) => `
                <div class="client-history__item" style="display:block;padding:12px 16px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
                    <div>
                      <strong>${escapeHtml(booking.serviceName)}</strong>
                      <span style="display:block;font-size:0.82rem;color:var(--muted);">${escapeHtml(formatDate(booking.date))} · ${escapeHtml(booking.slot)} · ${escapeHtml(booking.specialistName)}</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                      <span class="meta-chip">${escapeHtml(statusLabels[booking.status] || booking.status)}</span>
                      <span style="font-weight:600;">${formatCurrency(booking.totalPrice)}</span>
                    </div>
                  </div>
                  ${booking.sessionNotes ? `<p style="margin-top:8px;font-size:0.82rem;color:var(--forest);background:rgba(107,141,107,0.08);padding:8px 10px;border-radius:8px;border-left:2px solid var(--sage);">📝 ${escapeHtml(booking.sessionNotes)}</p>` : ""}
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function handleClientDetailClick(event) {
  // Quick use package from client card
  const useBtn = event.target.closest("[data-use-pkg]");
  if (useBtn) {
    const id = useBtn.dataset.usePkg;
    const pkg = (state.packages||[]).find(p => p.id === id);
    if (!pkg) return;
    if (!confirm(`Списать 1 сеанс из ${pkg.code}? Останется: ${pkg.totalSessions - pkg.usedSessions - 1}`)) return;
    fetchJson(`/api/admin/packages/${id}/use`, { method: "POST", body: JSON.stringify({ date: new Date().toISOString().slice(0,10) }) })
      .then(res => {
        const idx = state.packages.findIndex(p => p.id === id);
        if (idx !== -1) state.packages[idx] = res.package;
        const selectedClient = state.clients.find(c => c.id === state.selectedClientId);
        if (selectedClient) renderClientDetail(selectedClient);
        showToast(`Сеанс списан. Остаток: ${res.package.totalSessions - res.package.usedSessions}`, "success");
      }).catch(e => showToast(e.message||"Ошибка.","error"));
    return;
  }

  // Create new package for this client
  const newPkgBtn = event.target.closest("[data-new-pkg-client]");
  if (newPkgBtn) {
    activateSection("packages");
    setTimeout(() => {
      document.getElementById("showCreatePackageBtn")?.click();
      const nameEl = document.getElementById("pkgClientName");
      const phoneEl = document.getElementById("pkgClientPhone");
      if (nameEl) nameEl.value = newPkgBtn.dataset.newPkgClient;
      if (phoneEl) phoneEl.value = newPkgBtn.dataset.newPkgPhone || "";
    }, 100);
    return;
  }

  const btn = event.target.closest("[data-rebook-client]");
  if (!btn) return;

  const client = state.clients.find((c) => c.id === btn.dataset.rebookClient);
  if (!client) return;

  // Pre-fill booking form with client's data and favourite service/specialist
  const favService = client.favoriteServices[0];
  const favSpecialist = client.favoriteSpecialists[0];

  const bookingForm = state.operations.bookingForm;
  bookingForm.mode = "create";
  bookingForm.id = "";
  bookingForm.clientName = client.clientName;
  bookingForm.phone = client.phone || "";
  bookingForm.email = client.email || "";
  bookingForm.notes = "";
  bookingForm.status = "confirmed";

  if (favService) {
    const svc = state.services.find((s) => s.name === favService.name || s.id === favService.id);
    if (svc) bookingForm.serviceId = svc.id;
  }
  if (favSpecialist) {
    const sp = state.specialists.find((s) => s.name === favSpecialist.name || s.id === favSpecialist.id);
    if (sp) bookingForm.specialistId = sp.id;
  }

  // Switch to schedule section and populate form fields
  activateSection("schedule");
  setTimeout(() => {
    renderOperationsSelects();
    // Populate form fields directly
    if (elements.adminBookingClientName) elements.adminBookingClientName.value = client.clientName;
    if (elements.adminBookingPhone) elements.adminBookingPhone.value = client.phone || "";
    if (elements.adminBookingEmail) elements.adminBookingEmail.value = client.email || "";
    if (elements.adminBookingStatus) elements.adminBookingStatus.value = "confirmed";
    if (favService && elements.adminBookingService) {
      const svc = state.services.find((s) => s.name === favService.name);
      if (svc) { elements.adminBookingService.value = svc.id; elements.adminBookingService.dispatchEvent(new Event("change")); }
    }
    document.getElementById("adminBookingForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 150);

  showToast(`Форма заполнена для ${client.clientName}`, "success");
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

  const goals = [...form.querySelectorAll('[name="mc_goals"]:checked')].map(el => el.value);
  const payload = {
    status: form.querySelector('[name="status"]').value,
    tag: form.querySelector('[name="tag"]').value.trim(),
    note: form.querySelector('[name="note"]').value.trim(),
    medCard: {
      dob: form.querySelector('[name="mc_dob"]')?.value || "",
      profession: form.querySelector('[name="mc_profession"]')?.value.trim() || "",
      bp_sys: Number(form.querySelector('[name="mc_bp_sys"]')?.value) || null,
      bp_dia: Number(form.querySelector('[name="mc_bp_dia"]')?.value) || null,
      pulse: Number(form.querySelector('[name="mc_pulse"]')?.value) || null,
      wellbeing: Number(form.querySelector('[name="mc_wellbeing"]')?.value) || null,
      last_massage: form.querySelector('[name="mc_last_massage"]')?.value.trim() || "",
      goals,
      complaint: form.querySelector('[name="mc_complaint"]')?.value.trim() || "",
      chronic: form.querySelector('[name="mc_chronic"]')?.value.trim() || "",
      injuries: form.querySelector('[name="mc_injuries"]')?.value.trim() || "",
      medications: form.querySelector('[name="mc_medications"]')?.value.trim() || "",
      allergies: form.querySelector('[name="mc_allergies"]')?.value.trim() || "",
      focus: form.querySelector('[name="mc_focus"]')?.value.trim() || "",
      avoid: form.querySelector('[name="mc_avoid"]')?.value.trim() || "",
      contraindications_ok: form.querySelector('[name="mc_contraindications"]')?.checked || false,
      date: form.querySelector('[name="mc_date"]')?.value || new Date().toISOString().slice(0,10),
      status: form.querySelector('[name="mc_status"]')?.value || ""
    }
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
    notes: elements.adminBookingNotes.value.trim(),
    customDuration: parseInt(document.getElementById("adminBookingDuration")?.value || "0", 10) || 0,
    customPrice: parseInt(document.getElementById("adminBookingPrice")?.value || "0", 10) || 0
  };

  return state.operations.bookingForm;
}

async function refreshBookingSlots(preserveCurrent = false) {
  const bookingForm = readBookingFormState();

  if (!bookingForm.serviceId || !bookingForm.specialistId || !bookingForm.date || !state.adminPin) {
    elements.adminBookingSlot.innerHTML = `<option value="">Сначала выберите услугу, мастера и дату</option>`;
    return;
  }

  const durationInput = document.getElementById("adminBookingDuration");
  const customDuration = durationInput ? parseInt(durationInput.value, 10) || 0 : 0;

  const query = new URLSearchParams({
    serviceId: bookingForm.serviceId,
    specialistId: bookingForm.specialistId,
    date: bookingForm.date,
    admin: "true"
  });

  if (customDuration > 0) query.set("customDuration", String(customDuration));

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

  // Auto-fill duration from selected service
  const durationInput = document.getElementById("adminBookingDuration");
  if (durationInput && bookingForm.serviceId) {
    const svc = state.services.find(s => s.id === bookingForm.serviceId);
    if (svc?.duration) durationInput.value = svc.duration;
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
    notes: booking.notes || "",
    customDuration: booking.durationMins || 0
  };

  state.operations.date = booking.date;
  renderOperationsWorkspace();

  // Fill duration field and scroll to form after render
  setTimeout(() => {
    const durationInput = document.getElementById("adminBookingDuration");
    if (durationInput && booking.durationMins) {
      durationInput.value = booking.durationMins;
    }
    const priceInput = document.getElementById("adminBookingPrice");
    if (priceInput) priceInput.value = booking.totalPrice || 0;
    const form = document.getElementById("adminBookingForm");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);

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
        notes: bookingForm.notes,
        ...(bookingForm.customDuration > 0 ? { customDuration: bookingForm.customDuration } : {}),
        ...(bookingForm.customPrice > 0 ? { customPrice: bookingForm.customPrice } : {})
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
  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  elements.scheduleDayRows.innerHTML = [0, 1, 2, 3, 4, 5, 6]
    .map((d) => {
      const ds = scheduleForm.daySchedules[d] || { enabled: false, start: "09:00", end: "20:00" };
      return `
        <div class="schedule-day-row ${ds.enabled ? "is-on" : "is-off"}">
          <label class="schedule-day-row__toggle">
            <input type="checkbox" data-day="${d}" ${ds.enabled ? "checked" : ""}>
            <span>${dayNames[d]}</span>
          </label>
          <input type="time" class="schedule-day-row__time" data-day-start="${d}" value="${escapeHtml(ds.start)}" ${!ds.enabled ? "disabled" : ""}>
          <input type="time" class="schedule-day-row__time" data-day-end="${d}" value="${escapeHtml(ds.end)}" ${!ds.enabled ? "disabled" : ""}>
        </div>
      `;
    })
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

function handleDayRowChange(event) {
  const input = event.target.closest("input[data-day]");
  if (!input) return;
  const d = Number(input.dataset.day);
  const ds = state.operations.scheduleForm.daySchedules;
  if (!ds[d]) return;
  ds[d].enabled = input.checked;
  const row = input.closest(".schedule-day-row");
  if (row) {
    row.classList.toggle("is-on", input.checked);
    row.classList.toggle("is-off", !input.checked);
    row.querySelectorAll("input[type='time']").forEach((el) => {
      el.disabled = !input.checked;
    });
  }
}

function handleDayRowInput(event) {
  const target = event.target;
  const ds = state.operations.scheduleForm.daySchedules;
  if (target.dataset.dayStart !== undefined) {
    const d = Number(target.dataset.dayStart);
    if (ds[d]) ds[d].start = target.value;
  } else if (target.dataset.dayEnd !== undefined) {
    const d = Number(target.dataset.dayEnd);
    if (ds[d]) ds[d].end = target.value;
  }
}

async function showVacationModal() {
  if (!state.adminPin) { showToast("Сначала откройте админ-панель по PIN.", "info"); return; }

  const specialists = state.specialists || [];
  const today = getLocalDateString();

  const backdrop = document.createElement("div");
  backdrop.className = "confirm-backdrop";

  let allBlocks = [];

  async function loadBlocks() {
    try {
      const data = await fetchJson("/api/admin/schedule");
      allBlocks = (data.schedule?.blocks || [])
        .filter(b => b.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.specialistId.localeCompare(b.specialistId));
    } catch { allBlocks = []; }
  }

  function specialistName(id) {
    return specialists.find(s => s.id === id)?.name || id;
  }

  function renderBlocksList() {
    const listEl = backdrop.querySelector("#vacationBlocksList");
    if (!listEl) return;
    if (!allBlocks.length) {
      listEl.innerHTML = `<p class="empty-state" style="padding:12px 0;">Активных блокировок нет.</p>`;
      return;
    }
    listEl.innerHTML = allBlocks.map(b => `
      <div class="vacation-block-row">
        <div class="vacation-block-row__info">
          <strong>${escapeHtml(specialistName(b.specialistId))}</strong>
          <span>${escapeHtml(b.date)}</span>
          <span class="vacation-block-row__reason">${escapeHtml(b.reason || "Блокировка")}</span>
        </div>
        <button type="button" class="button button--ghost button--mini" data-delete-vacation-block="${escapeHtml(b.id)}">Удалить</button>
      </div>
    `).join("");
  }

  backdrop.innerHTML = `
    <div class="vacation-modal" role="dialog" aria-modal="true">
      <div class="vacation-modal__head">
        <div>
          <p class="section-kicker">Расписание</p>
          <h3 class="vacation-modal__title">Отпуск и закрытие дней</h3>
        </div>
        <button type="button" class="button button--ghost button--mini" data-action="close">✕</button>
      </div>

      <form id="vacationModalForm" class="admin-form-stack vacation-modal__form">
        <div class="field-grid">
          <label class="field">
            <span>Специалист</span>
            <select id="vmSpecialist">
              ${specialists.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Причина</span>
            <input type="text" id="vmReason" placeholder="Отпуск" value="Отпуск">
          </label>
        </div>
        <div class="field-grid">
          <label class="field">
            <span>С даты</span>
            <input type="date" id="vmStart" min="${today}">
          </label>
          <label class="field">
            <span>По дату</span>
            <input type="date" id="vmEnd" min="${today}">
          </label>
        </div>
        <button type="submit" class="button button--secondary">Закрыть период</button>
      </form>

      <div class="vacation-modal__divider"></div>

      <div class="vacation-modal__list-head">
        <p class="section-kicker">Активные блокировки (с сегодня)</p>
      </div>
      <div id="vacationBlocksList" class="vacation-modal__list">
        <p class="empty-state" style="padding:12px 0;">Загрузка...</p>
      </div>
    </div>
  `;

  backdrop.querySelector("#vacationModalForm").addEventListener("submit", handleSubmit);
  backdrop.addEventListener("click", handleClick);
  document.body.appendChild(backdrop);

  await loadBlocks();
  renderBlocksList();

  async function handleSubmit(e) {
    e.preventDefault();
    const specialistId = backdrop.querySelector("#vmSpecialist").value;
    const start = backdrop.querySelector("#vmStart").value;
    const end = backdrop.querySelector("#vmEnd").value;
    const reason = backdrop.querySelector("#vmReason").value.trim() || "Отпуск";

    if (!start || !end || start > end) { showToast("Укажите корректный период.", "error"); return; }

    // Build date list using local date parts to avoid UTC timezone shift
    const dates = [];
    const cur = new Date(start + "T12:00:00");
    const last = new Date(end + "T12:00:00");
    while (cur <= last) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }

    const btn = backdrop.querySelector("#vacationModalForm button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Закрываю...";

    try {
      // Sequential — parallel writes cause race condition on schedule.json.tmp
      for (const date of dates) {
        await fetchJson("/api/admin/blocks", {
          method: "POST",
          body: JSON.stringify({ specialistId, date, start: "00:00", end: "23:59", reason, force: true })
        });
      }
      showToast(`Закрыто ${dates.length} дн. (${start} — ${end}). Проверь записи клиентов.`, "success");
      backdrop.querySelector("#vmStart").value = "";
      backdrop.querySelector("#vmEnd").value = "";
      backdrop.querySelector("#vmReason").value = "Отпуск";
      await Promise.all([loadBlocks(), loadDaySchedule()]);
      renderBlocksList();
      renderScheduleBoard();
    } catch (err) {
      showToast(err.message || "Не удалось закрыть период.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Закрыть период";
    }
  }

  async function handleClick(e) {
    if (e.target === backdrop || e.target.dataset.action === "close") {
      backdrop.remove();
      return;
    }
    const blockId = e.target.closest("[data-delete-vacation-block]")?.dataset.deleteVacationBlock;
    if (!blockId) return;
    try {
      await fetchJson(`/api/admin/blocks/${blockId}`, { method: "DELETE" });
      await Promise.all([loadBlocks(), loadDaySchedule()]);
      renderBlocksList();
      renderScheduleBoard();
      showToast("Блокировка удалена.", "success");
    } catch (err) {
      showToast(err.message || "Не удалось удалить.", "error");
    }
  }
}

async function handleSpecialistScheduleSubmit(event) {
  event.preventDefault();

  if (!state.adminPin) {
    showToast("Сначала откройте админ-панель по PIN.", "info");
    return;
  }

  const specialistId = elements.scheduleSpecialistSelect.value;

  try {
    await fetchJson(`/api/admin/specialists/${specialistId}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({
        daySchedules: state.operations.scheduleForm.daySchedules,
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

async function handleAdminTableClick(event) {
  const editButton = event.target.closest("[data-edit-booking-id]");
  if (editButton) {
    const booking = state.adminData?.bookings?.find((item) => item.id === editButton.dataset.editBookingId);
    if (booking) {
      populateBookingForm(booking);
    }
    return;
  }

  const deleteBookingBtn = event.target.closest("[data-delete-booking-id]");
  if (deleteBookingBtn) {
    const id = deleteBookingBtn.dataset.deleteBookingId;
    if (!confirm("Удалить запись навсегда? Это действие нельзя отменить.")) return;
    try {
      await fetchJson(`/api/admin/bookings/${id}`, { method: "DELETE" });
      await loadAdminData();
      showToast("Запись удалена.", "success");
    } catch { showToast("Не удалось удалить запись.", "error"); }
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

  // Period filter
  const now = new Date();
  const today = getLocalDateString();
  let periodFrom = null;
  if (state.filters.period === "today") {
    periodFrom = today;
  } else if (state.filters.period === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    periodFrom = d.toISOString().slice(0, 10);
  } else if (state.filters.period === "month") {
    periodFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const filtered = bookings.filter((booking) => {
    if (state.filters.status !== "all" && booking.status !== state.filters.status) return false;
    if (periodFrom && booking.date < periodFrom) return false;
    if (!state.filters.search) return true;
    return [booking.reference, booking.clientName, booking.phone, booking.email, booking.serviceName, booking.specialistName, booking.notes]
      .filter(Boolean).join(" ").toLowerCase().includes(state.filters.search);
  });

  // Sort
  filtered.sort((a, b) => {
    const ta = getBookingTimestamp(a), tb = getBookingTimestamp(b);
    return state.filters.sortDir === "desc" ? tb - ta : ta - tb;
  });

  // Counter
  const countEl = document.getElementById("bookingCount");
  if (countEl) countEl.textContent = `${filtered.length} из ${bookings.length} заявок`;

  if (!filtered.length) {
    elements.adminTableBody.innerHTML = `
      <tr><td colspan="6"><div class="empty-state">По текущим фильтрам ничего не найдено.</div></td></tr>
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
                .map(([value, label]) =>
                  `<option value="${escapeHtml(value)}" ${booking.status === value ? "selected" : ""}>${escapeHtml(label)}</option>`
                ).join("")}
            </select>
          </td>
          <td>
            <span class="table-main">${booking.notes ? escapeHtml(booking.notes) : "—"}</span>
            <span class="table-sub">Статус: ${escapeHtml(statusLabels[booking.status])}</span>
            <div class="table-actions">
              <button type="button" class="button button--ghost button--mini" data-edit-booking-id="${escapeHtml(booking.id)}">Редактировать</button>
              <button type="button" class="button button--ghost button--mini" data-cancel-booking-id="${escapeHtml(booking.id)}">Отменить</button>
              <button type="button" class="button button--ghost button--mini" data-delete-booking-id="${escapeHtml(booking.id)}" style="color:var(--danger);border-color:var(--danger-soft);">Удалить</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderTablePagination(total, totalPages) {
  let el = document.getElementById("bookingPagination");
  if (!el) {
    el = document.createElement("div");
    el.id = "bookingPagination";
    el.className = "table-pagination";
    elements.adminTableBody.closest("table")?.after(el);
  }
  if (totalPages <= 1) { el.hidden = true; return; }
  el.hidden = false;
  const cur = state.bookingPage;
  el.innerHTML = `
    <span class="table-pagination__info">Страница ${cur + 1} из ${totalPages} · ${total} записей</span>
    <div class="table-pagination__btns">
      <button type="button" class="button button--ghost button--mini" id="pgPrev" ${cur === 0 ? "disabled" : ""}>← Назад</button>
      <button type="button" class="button button--ghost button--mini" id="pgNext" ${cur >= totalPages - 1 ? "disabled" : ""}>Вперёд →</button>
    </div>
  `;
  el.querySelector("#pgPrev")?.addEventListener("click", () => { state.bookingPage--; renderAdminTable(); });
  el.querySelector("#pgNext")?.addEventListener("click", () => { state.bookingPage++; renderAdminTable(); });
}

function renderEnrollmentsTable() {
  const tbody = document.getElementById("enrollmentsTableBody");
  const searchInput = document.getElementById("enrollmentSearch");
  const statusSelect = document.getElementById("enrollmentStatusFilter");
  if (!tbody) return;

  const statusFilter = statusSelect?.value || "all";
  const search = (searchInput?.value || "").trim().toLowerCase();
  const statusLabels = { new: "Новая", contacted: "Связались", confirmed: "Записан", cancelled: "Отменена" };

  const filtered = state.enrollments.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (!search) return true;
    return [e.reference, e.name, e.phone, e.email, e.courseName, e.notes]
      .filter(Boolean).join(" ").toLowerCase().includes(search);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Заявок пока нет.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((e) => `
    <tr>
      <td>
        <span class="table-main">${escapeHtml(e.reference)}</span>
        <span class="table-sub">${escapeHtml(formatDateTime(e.createdAt))}</span>
      </td>
      <td>
        <span class="table-main">${escapeHtml(e.name)}</span>
        <span class="table-sub">${escapeHtml(e.phone)}${e.email ? `<br>${escapeHtml(e.email)}` : ""}</span>
      </td>
      <td>
        <span class="table-main">${escapeHtml(e.courseName)}</span>
        <span class="table-sub">${e.direction === "massage" ? "Массаж" : "Косметология"}</span>
      </td>
      <td><span class="table-main">${e.notes ? escapeHtml(e.notes) : "—"}</span></td>
      <td>
        <select class="enrollment-status-select" data-enrollment-id="${escapeHtml(e.id)}">
          ${["new","contacted","confirmed","cancelled"].map((s) =>
            `<option value="${s}"${e.status === s ? " selected" : ""}>${statusLabels[s]}</option>`
          ).join("")}
        </select>
        <button type="button" class="button button--ghost button--mini enrollment-delete-btn" data-enrollment-id="${escapeHtml(e.id)}" style="margin-top:6px;color:var(--danger);border-color:var(--danger-soft);">Удалить</button>
      </td>
    </tr>
  `).join("");
}
