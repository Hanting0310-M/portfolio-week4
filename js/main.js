/* =========================================================
   Personal website — shared interactions
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Current year in the footer ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Header shadow after scrolling ---------- */
  var header = document.querySelector(".site-header");
  var onScroll = function () {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  var navMenu = document.getElementById("nav-menu");
  function closeMenu() {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute("aria-expanded", "false");
    navMenu.classList.remove("is-open");
  }
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      var isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navMenu.classList.toggle("is-open", !isOpen);
    });
    // Close after choosing a page
    navMenu.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
    // Close when clicking outside the nav
    document.addEventListener("click", function (e) {
      if (
        navMenu.classList.contains("is-open") &&
        !e.target.closest(".nav")
      ) {
        closeMenu();
      }
    });
    // Close with the Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeMenu();
        navToggle.blur();
      }
    });
    // Reset state when resizing back up to desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth > 640) closeMenu();
    });
  }

  /* ---------- Reveal-on-scroll animations ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Contact form (front-end demo) ---------- */
  var form = document.getElementById("contact-form");
  if (form) {
    var success = document.getElementById("form-success");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (success) success.classList.add("show");
      form.reset();
      // Move focus to the success message for screen-reader users
      if (success) {
        success.setAttribute("tabindex", "-1");
        success.focus({ preventScroll: true });
      }
    });
  }

  /* ---------- Print / save resume as PDF ---------- */
  var printBtn = document.getElementById("print-resume");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }

  /* =========================================================
     To-Do List app (Projects page)
     Calendar date picker + task list; persists to Supabase
     ========================================================= */
  var todoForm = document.getElementById("todo-form");
  if (todoForm) {
    /* ---------- Supabase client ---------- */
    var SUPABASE_URL = "https://btsztcktrwmkuqtektmm.supabase.co";
    var SUPABASE_KEY = "sb_publishable_55kmc5Ydy-b1NfVkkqmb3g_9C96Oim8";
    var supabaseClient = window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
      : null;

    var state = {
      tasks: [],
      selectedDate: todayISO(),
      viewYear: new Date().getFullYear(),
      viewMonth: new Date().getMonth() // 0-11
    };

    var todoInput = document.getElementById("todo-input");
    var todoList = document.getElementById("todo-list");
    var emptyState = document.getElementById("empty-state");
    var selectedDateEl = document.getElementById("selected-date");
    var calGrid = document.getElementById("cal-grid");
    var calTitle = document.getElementById("cal-title");
    var calPrev = document.getElementById("cal-prev");
    var calNext = document.getElementById("cal-next");
    var emojiPicker = document.getElementById("emoji-picker");
    var prioritySelect = document.getElementById("todo-priority");
    var todoCounter = document.getElementById("todo-counter");
    var selectedEmoji = "";

    var MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

    /* ---------- Helpers ---------- */
    function todayISO() {
      var d = new Date();
      return toISO(d);
    }
    function toISO(d) {
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    }
    function parseISO(iso) {
      var parts = iso.split("-");
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    function formatDateLong(iso) {
      var d = parseISO(iso);
      return d.toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      });
    }
    function formatDateShort(iso) {
      var d = parseISO(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    /* ---------- Supabase data layer ---------- */
    /* Map a Supabase row to the app's task shape.
       DB columns -> app fields:
         task -> text, is_complete -> completed */
    function mapRow(r) {
      return {
        id: r.id,
        text: r.task,
        completed: r.is_complete,
        date: r.date,
        emoji: r.emoji,
        priority: r.priority,
        created_at: r.created_at
      };
    }

    async function loadTasks() {
      if (!supabaseClient) return [];
      var res = await supabaseClient
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });
      if (res.error) {
        console.error("Failed to load todos:", res.error.message);
        return [];
      }
      return (res.data || []).map(mapRow);
    }

    /* ---------- Calendar ---------- */
    function renderCalendar() {
      calTitle.textContent = MONTHS[state.viewMonth] + " " + state.viewYear;
      calGrid.innerHTML = "";

      var firstDay = new Date(state.viewYear, state.viewMonth, 1).getDay();
      var daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
      var today = todayISO();

      // Leading blanks
      for (var i = 0; i < firstDay; i++) {
        var blank = document.createElement("span");
        blank.className = "cal-cell cal-blank";
        calGrid.appendChild(blank);
      }

      // Day cells
      for (var d = 1; d <= daysInMonth; d++) {
        var cellISO = toISO(new Date(state.viewYear, state.viewMonth, d));
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cal-cell cal-day";
        cell.textContent = String(d);
        cell.dataset.date = cellISO;

        if (cellISO === today) cell.classList.add("is-today");
        if (cellISO === state.selectedDate) cell.classList.add("is-selected");

        // Show a dot if there are tasks on this date
        if (state.tasks.some(function (t) { return t.date === cellISO; })) {
          cell.classList.add("has-tasks");
        }

        cell.addEventListener("click", function () {
          state.selectedDate = this.dataset.date;
          renderCalendar();
          renderTasks();
        });
        calGrid.appendChild(cell);
      }
    }

    /* ---------- Tasks ---------- */
    function getTasksForDate(iso) {
      return state.tasks.filter(function (t) { return t.date === iso; });
    }

    async function addTask(text, emoji, priority) {
      var trimmed = text.trim();
      if (!trimmed) return;
      var row = {
        task: trimmed,
        date: state.selectedDate,
        is_complete: false,
        emoji: emoji || "",
        priority: priority || "medium"
      };
      var res = await supabaseClient
        .from("todos")
        .insert(row)
        .select()
        .single();
      if (res.error) {
        console.error("Insert failed:", res.error.message);
        return;
      }
      state.tasks.push(mapRow(res.data));
      renderCalendar();
      renderTasks();
    }

    async function toggleTask(id) {
      var task = state.tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      var newVal = !task.completed;
      var res = await supabaseClient
        .from("todos")
        .update({ is_complete: newVal })
        .eq("id", id);
      if (res.error) {
        console.error("Toggle failed:", res.error.message);
        return;
      }
      task.completed = newVal;
      renderTasks();
    }

    async function deleteTask(id) {
      var res = await supabaseClient
        .from("todos")
        .delete()
        .eq("id", id);
      if (res.error) {
        console.error("Delete failed:", res.error.message);
        return;
      }
      state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
      renderCalendar();
      renderTasks();
    }

    /* ---------- Inline editing ---------- */
    function startEdit(span) {
      if (span.isContentEditable) return;
      span.contentEditable = "true";
      span.focus();
      var range = document.createRange();
      range.selectNodeContents(span);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    function finishEdit(span, task, save) {
      if (!span.isContentEditable) return;
      var original = task.text;
      var next = span.textContent.trim();
      span.contentEditable = "false";
      if (save && next && next !== original) {
        task.text = next;
        supabaseClient
          .from("todos")
          .update({ task: next })
          .eq("id", task.id)
          .then(function (res) {
            if (res.error) console.error("Edit save failed:", res.error.message);
          });
      } else {
        span.textContent = original;
      }
    }

    function renderTasks() {
      var dayTasks = getTasksForDate(state.selectedDate);

      selectedDateEl.textContent = "Tasks for " + formatDateLong(state.selectedDate);

      todoList.innerHTML = "";
      dayTasks.forEach(function (task) {
        var li = document.createElement("li");
        li.className = "todo-item" + (task.completed ? " completed" : "");

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "todo-check";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", "Mark task as " + (task.completed ? "incomplete" : "complete"));
        checkbox.addEventListener("change", function () { toggleTask(task.id); });

        var textSpan = document.createElement("span");
        textSpan.className = "todo-text";
        textSpan.textContent = task.text;
        textSpan.title = "Click to edit";
        textSpan.tabIndex = 0;
        textSpan.addEventListener("click", function () { startEdit(textSpan); });
        textSpan.addEventListener("keydown", function (e) {
          if (textSpan.isContentEditable) {
            if (e.key === "Enter") { e.preventDefault(); finishEdit(textSpan, task, true); }
            else if (e.key === "Escape") { e.preventDefault(); finishEdit(textSpan, task, false); }
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit(textSpan);
          }
        });
        textSpan.addEventListener("blur", function () { finishEdit(textSpan, task, true); });

        var emojiSpan = document.createElement("span");
        emojiSpan.className = "todo-emoji";
        emojiSpan.textContent = task.emoji || "";

        var badge = document.createElement("span");
        badge.className = "priority-badge priority-" + (task.priority || "medium");
        badge.textContent = (task.priority || "medium").charAt(0).toUpperCase() + (task.priority || "medium").slice(1);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "todo-delete";
        del.innerHTML = "&times;";
        del.setAttribute("aria-label", "Delete task");
        del.addEventListener("click", function () { deleteTask(task.id); });

        li.appendChild(checkbox);
        li.appendChild(emojiSpan);
        li.appendChild(textSpan);
        li.appendChild(badge);
        li.appendChild(del);
        todoList.appendChild(li);
      });

      emptyState.hidden = dayTasks.length !== 0;

      if (todoCounter) {
        var done = dayTasks.filter(function (t) { return t.completed; }).length;
        var total = dayTasks.length;
        todoCounter.textContent = done + " of " + total + " task" + (total === 1 ? "" : "s") + " completed";
        todoCounter.hidden = total === 0;
      }
    }

    /* ---------- Events ---------- */
    todoForm.addEventListener("submit", function (e) {
      e.preventDefault();
      addTask(todoInput.value, selectedEmoji, prioritySelect.value);
      todoInput.value = "";
      todoInput.focus();
      // Reset emoji picker to "no emoji"
      selectedEmoji = "";
      emojiPicker.querySelectorAll(".emoji-btn").forEach(function (btn) {
        btn.classList.toggle("selected", btn.dataset.emoji === "");
      });
    });

    // Emoji picker selection
    if (emojiPicker) {
      emojiPicker.addEventListener("click", function (e) {
        var btn = e.target.closest(".emoji-btn");
        if (!btn) return;
        selectedEmoji = btn.dataset.emoji;
        emojiPicker.querySelectorAll(".emoji-btn").forEach(function (b) {
          b.classList.toggle("selected", b === btn);
        });
      });
    }

    calPrev.addEventListener("click", function () {
      state.viewMonth--;
      if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
      renderCalendar();
    });

    calNext.addEventListener("click", function () {
      state.viewMonth++;
      if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
      renderCalendar();
    });

    /* ---- Initial render ---- */
    renderCalendar();
    renderTasks();
    // Load todos from Supabase on page load, ordered by created time
    (async function init() {
      state.tasks = await loadTasks();
      renderCalendar();
      renderTasks();
    })();
  }
})();
