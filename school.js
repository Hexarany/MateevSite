(function () {
  "use strict";

  /* ── Label maps ──────────────────────────────────────────────────────────── */
  const DIRECTION_LABELS = {
    massage: "Массаж",
    cosmetology: "Косметология"
  };

  const LEVEL_LABELS = {
    beginner: "С нуля",
    intermediate: "Средний уровень",
    advanced: "Продвинутый",
    any: "Любой уровень"
  };

  const FORMAT_LABELS = {
    group: "Групповой",
    individual: "Индивидуальный"
  };

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
    var directionLabel = DIRECTION_LABELS[course.direction] || course.direction;
    var levelLabel = LEVEL_LABELS[course.level] || course.level;
    var formatLabel = FORMAT_LABELS[course.format] || course.format;

    var priceHtml;
    if (course.price === 0) {
      priceHtml = '<span class="school-course-card__price">Уточняется</span>';
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
        ? '<div class="school-meta-item"><span>Группа</span><strong>' +
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
      '<div class="school-meta-item"><span>Формат</span><strong>' +
      esc(formatLabel) +
      "</strong></div>" +
      '<div class="school-meta-item"><span>Длительность</span><strong>' +
      esc(course.duration) +
      "</strong></div>" +
      groupSizeHtml +
      '<div class="school-meta-item"><span>Сертификат</span><strong>Да</strong></div>' +
      "</div>" +
      '<div class="school-course-card__footer">' +
      priceHtml +
      '<button type="button" class="button button--primary" data-enroll-course="' +
      esc(course.id) +
      '" data-course-name="' +
      esc(course.name) +
      '">Записаться на курс</button>' +
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

    return (
      '<article class="school-teacher-card">' +
      '<div class="specialist-card__avatar">' +
      esc(teacher.initials) +
      "</div>" +
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
        '<p style="color:var(--muted);grid-column:1/-1;">Курсы по этому направлению скоро появятся.</p>';
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
