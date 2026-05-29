(function () {
  "use strict";

  /* ── Language ────────────────────────────────────────────────────────────── */
  var lang = localStorage.getItem('lang') || 'ru';

  function tr(ru, ro) { return lang === 'ro' && ro ? ro : ru; }

  function applyLang() {
    document.querySelectorAll('[data-ru]').forEach(function(el) {
      el.textContent = tr(el.dataset.ru, el.dataset.ro);
    });
    document.querySelectorAll('.lang-btn').forEach(function(b) {
      b.classList.toggle('is-active', b.dataset.lang === lang);
    });
  }

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.lang-btn');
    if (!btn || !btn.dataset.lang) return;
    lang = btn.dataset.lang;
    localStorage.setItem('lang', lang);
    applyLang();
    renderAll();
  });

  /* ── Label maps ──────────────────────────────────────────────────────────── */
  const DIRECTION_LABELS = {
    massage: tr("Массаж", "Masaj"),
    cosmetology: tr("Косметология", "Cosmetologie")
  };

  const LEVEL_LABELS = {
    beginner: tr("С нуля", "De la zero"),
    intermediate: tr("Средний уровень", "Nivel mediu"),
    advanced: tr("Продвинутый", "Avansat"),
    any: tr("Любой уровень", "Orice nivel")
  };

  const FORMAT_LABELS = {
    group: tr("Групповой", "De grup"),
    individual: tr("Individual", "Individual")
  };

  function getLabels() {
    return {
      direction: { massage: tr("Массаж","Masaj"), cosmetology: tr("Косметология","Cosmetologie") },
      level: { beginner: tr("С нуля","De la zero"), intermediate: tr("Средний уровень","Nivel mediu"), advanced: tr("Продвинутый","Avansat"), any: tr("Любой уровень","Orice nivel") },
      format: { group: tr("Групповой","De grup"), individual: tr("Индивидуальный","Individual") },
      certificate: tr("Да","Da"),
      duration: tr("Длительность","Durată"),
      groupSize: tr("Группа","Grupă"),
      format_label: tr("Формат","Format"),
      cert_label: tr("Сертификат","Certificat"),
      enroll_btn: tr("Записаться на курс","Înscrie-te la curs"),
      price_on_request: tr("Уточняется","La cerere"),
      filter_all: tr("Все курсы","Toate cursurile"),
      enroll_course: tr("Курс","Curs"),
      enroll_name: tr("Имя","Nume"),
      enroll_phone: tr("Телефон","Telefon"),
      enroll_email: "Email",
      enroll_notes: tr("Комментарий","Comentariu"),
      enroll_submit: tr("Отправить заявку","Trimite cererea"),
      enroll_placeholder_course: tr("Выберите курс","Selectați cursul"),
      enroll_placeholder_name: tr("Ваше имя","Numele dumneavoastră"),
      enroll_placeholder_notes: tr("Ваш уровень подготовки, вопросы или пожелания","Nivelul dvs., întrebări sau preferințe"),
    };
  }

  function renderAll() {
    applyLang();
    if (window._schoolData) {
      renderCourses(window._schoolData.courses);
      renderTeachers(window._schoolData.teachers);
      populateEnrollSelect(window._schoolData.courses);
    }
    updateFormLabels();
  }

  function updateFormLabels() {
    var L = getLabels();
    var sel = document.getElementById('enrollCourse');
    if (sel && sel.options[0]) sel.options[0].text = L.enroll_placeholder_course;
    var nameLabel = document.querySelector('label[for-enroll-name] span, #enrollForm label:nth-child(2) span');
    ['enrollName','enrollPhone','enrollEmail','enrollNotes','enrollSubmitBtn'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === 'enrollSubmitBtn') { el.textContent = L.enroll_submit; return; }
    });
  }

  /* ── State ───────────────────────────────────────────────────────────────── */
  let allCourses = [];
  let activeDirection = "all";

  /* ── Toast ───────────────────────────────────────────────────────────────── */
  function showToast(message, type) {
    var stack = document.getElementById("toastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.id = "toastStack";
      stack.setAttribute("aria-live", "polite");
      stack.setAttribute("aria-atomic", "true");
      document.body.appendChild(stack);
    }

    var toast = document.createElement("div");
    toast.className = "toast toast--" + (type || "info");
    toast.textContent = message;
    stack.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("toast--visible");
    });

    setTimeout(function () {
      toast.classList.remove("toast--visible");
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 350);
    }, 4000);
  }

  /* ── Escape HTML ─────────────────────────────────────────────────────────── */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ── Render course card ──────────────────────────────────────────────────── */
  function renderCourseCard(course) {
    var L = getLabels();
    var directionLabel = L.direction[course.direction] || course.direction;
    var levelLabel = L.level[course.level] || course.level;
    var formatLabel = L.format[course.format] || course.format;

    var priceHtml;
    if (course.price === 0) {
      priceHtml = '<span class="school-course-card__price">' + L.price_on_request + '</span>';
    } else {
      priceHtml =
        '<span class="school-course-card__price">' +
        esc(course.price) +
        " " +
        esc(course.currency) +
        "</span>";
    }

    var benefitsHtml = (course.benefits || [])
      .map(function (b) {
        return "<li>" + esc(b) + "</li>";
      })
      .join("");

    var groupSizeHtml =
      course.groupSize
        ? '<div class="school-meta-item"><span>' + L.groupSize + '</span><strong>' +
          esc(course.groupSize) +
          "</strong></div>"
        : "";

    return (
      '<article class="school-course-card" data-direction="' +
      esc(course.direction) +
      '">' +
      '<div class="school-course-card__head">' +
      '<span class="school-course-card__direction">' +
      esc(directionLabel) +
      "</span>" +
      '<span class="school-course-card__level">' +
      esc(levelLabel) +
      "</span>" +
      "</div>" +
      "<h3>" +
      esc(course.name) +
      "</h3>" +
      '<p class="school-course-card__subtitle">' +
      esc(course.subtitle) +
      "</p>" +
      '<p class="school-course-card__desc">' +
      esc(course.description) +
      "</p>" +
      '<ul class="school-course-card__benefits">' +
      benefitsHtml +
      "</ul>" +
      '<div class="school-course-card__meta">' +
      '<div class="school-meta-item"><span>' + L.format_label + '</span><strong>' +
      esc(formatLabel) +
      "</strong></div>" +
      '<div class="school-meta-item"><span>' + L.duration + '</span><strong>' +
      esc(course.duration) +
      "</strong></div>" +
      groupSizeHtml +
      '<div class="school-meta-item"><span>' + L.cert_label + '</span><strong>' + L.certificate + '</strong></div>' +
      "</div>" +
      '<div class="school-course-card__footer">' +
      priceHtml +
      '<button type="button" class="button button--primary" data-enroll-course="' +
      esc(course.id) +
      '" data-course-name="' +
      esc(course.name) +
      '">' + L.enroll_btn + '</button>' +
      "</div>" +
      "</article>"
    );
  }

  /* ── Render teacher card ─────────────────────────────────────────────────── */
  function renderTeacherCard(teacher) {
    var directionsHtml = (teacher.directions || [])
      .map(function (d) {
        return (
          '<span class="school-course-card__direction">' +
          esc(DIRECTION_LABELS[d] || d) +
          "</span>"
        );
      })
      .join("");

    var avatarHtml = teacher.photo
      ? '<img class="specialist-card__photo" src="' + esc(teacher.photo) + '" alt="' + esc(teacher.name) + '" loading="lazy">'
      : '<div class="specialist-card__avatar">' + esc(teacher.initials) + '</div>';

    return (
      '<article class="school-teacher-card">' +
      avatarHtml +
      '<div class="school-teacher-card__role">' +
      esc(teacher.role) +
      "</div>" +
      "<h3>" +
      esc(teacher.name) +
      "</h3>" +
      "<p>" +
      esc(teacher.bio) +
      "</p>" +
      '<div class="school-teacher-card__directions">' +
      directionsHtml +
      "</div>" +
      "</article>"
    );
  }

  /* ── Populate course select in enrollment form ───────────────────────────── */
  function populateCourseSelect(courses) {
    var select = document.getElementById("enrollCourse");
    if (!select) return;

    select.innerHTML = '<option value="">Выберите курс</option>';

    var massage = courses.filter(function (c) {
      return c.direction === "massage";
    });
    var cosmetology = courses.filter(function (c) {
      return c.direction === "cosmetology";
    });

    if (massage.length) {
      var mgGroup = document.createElement("optgroup");
      mgGroup.label = "Массаж";
      massage.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        mgGroup.appendChild(opt);
      });
      select.appendChild(mgGroup);
    }

    if (cosmetology.length) {
      var cosGroup = document.createElement("optgroup");
      cosGroup.label = "Косметология";
      cosmetology.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        cosGroup.appendChild(opt);
      });
      select.appendChild(cosGroup);
    }
  }

  /* ── Filter and render courses ───────────────────────────────────────────── */
  function renderCourses(direction) {
    var grid = document.getElementById("coursesGrid");
    if (!grid) return;

    var filtered =
      direction === "all"
        ? allCourses
        : allCourses.filter(function (c) {
            return c.direction === direction;
          });

    if (!filtered.length) {
      grid.innerHTML =
        '<p style="color:var(--muted);grid-column:1/-1;">' + tr("Курсы по этому направлению скоро появятся.", "Cursuri pentru această direcție vor apărea în curând.") + '</p>';
      return;
    }

    grid.innerHTML = filtered.map(renderCourseCard).join("");

    grid.querySelectorAll("[data-enroll-course]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var courseId = btn.getAttribute("data-enroll-course");
        var courseName = btn.getAttribute("data-course-name");
        preselectCourse(courseId, courseName);
      });
    });
  }

  /* ── Pre-select course in enrollment form ────────────────────────────────── */
  function preselectCourse(courseId) {
    var select = document.getElementById("enrollCourse");
    if (select) {
      select.value = courseId;
    }

    var enrollSection = document.getElementById("enroll");
    if (enrollSection) {
      enrollSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ── Direction filter buttons ────────────────────────────────────────────── */
  function initFilters() {
    var container = document.getElementById("courseFilters");
    if (!container) return;

    container.querySelectorAll(".school-filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        container
          .querySelectorAll(".school-filter-btn")
          .forEach(function (b) {
            b.classList.remove("is-active");
          });
        btn.classList.add("is-active");

        activeDirection = btn.getAttribute("data-direction") || "all";
        renderCourses(activeDirection);
      });
    });
  }

  /* ── Enrollment form submission ──────────────────────────────────────────── */
  function initEnrollForm() {
    var form = document.getElementById("enrollForm");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var courseId = (document.getElementById("enrollCourse") || {}).value || "";
      var name = (document.getElementById("enrollName") || {}).value || "";
      var phone = (document.getElementById("enrollPhone") || {}).value || "";
      var email = (document.getElementById("enrollEmail") || {}).value || "";
      var notes = (document.getElementById("enrollNotes") || {}).value || "";

      if (!courseId || !name || !phone || !email) {
        showToast("Пожалуйста, заполните все обязательные поля.", "error");
        return;
      }

      var submitBtn = document.getElementById("enrollSubmitBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Отправляем…";
      }

      try {
        var res = await fetch("/api/school/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, name, phone, email, notes })
        });

        var data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Ошибка при отправке заявки.");
        }

        var courseSelect = document.getElementById("enrollCourse");
        var courseName = courseSelect ? courseSelect.options[courseSelect.selectedIndex]?.text || "" : "";
        var params = new URLSearchParams({ ref: data.reference, course: courseName, name: name });
        location.href = "/school-success?" + params.toString();
      } catch (err) {
        showToast(err.message || "Не удалось отправить заявку. Попробуйте ещё раз.", "error");

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Отправить заявку";
        }
      }
    });
  }

  /* ── Smooth scroll for nav links ─────────────────────────────────────────── */
  function initNavToggle() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("siteNav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("is-open", !expanded);
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ── Reveal on scroll ────────────────────────────────────────────────────── */
  function initReveal() {
    var elements = document.querySelectorAll(".reveal");
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── Boot ────────────────────────────────────────────────────────────────── */
  async function init() {
    initFilters();
    initEnrollForm();
    initNavToggle();
    initReveal();

    try {
      var res = await fetch("/api/school/data");
      if (!res.ok) throw new Error("Failed to load school data");

      var data = await res.json();
      allCourses = data.courses || [];
      window._schoolData = data;

      applyLang();
      populateCourseSelect(allCourses);
      renderCourses(activeDirection);

      var teachersGrid = document.getElementById("teachersGrid");
      if (teachersGrid && data.teachers) {
        teachersGrid.innerHTML = data.teachers.map(renderTeacherCard).join("");
      }
    } catch (err) {
      var grid = document.getElementById("coursesGrid");
      if (grid) {
        grid.innerHTML =
          '<p style="color:var(--muted);grid-column:1/-1;">Не удалось загрузить курсы. Обновите страницу.</p>';
      }
      console.error("School data load error:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
