/* EYE:NOON — eye-exam booking page (book.html).
 * Talks to /api/booking on the API (base URL from js/checkout-config.js).
 * All times are shown in store time (America/Los_Angeles), whatever the
 * visitor's own time zone is.
 */
(function () {
  var API = (window.EYE_NOON_CHECKOUT_API || "") + "/api/booking";
  var TZ = "America/Los_Angeles";

  var S = {
    en: {
      eyebrow: "Eye exams",
      h1: 'Book an<br/><span class="text-[#E0115F]">eye exam</span>',
      lead: 'Monday, Wednesday, Friday &amp; Saturday · 10:00 – 18:00 (Los Angeles time). Prefer to talk? Call <a href="tel:+12133881447" class="text-[#E0115F] font-semibold no-underline">213.388.1447</a>.',
      s1: "Service", s2: "Date", s3: "Time", s4: "Your details",
      closedNote: "Greyed-out days: no exams (Tue, Thu, Sun) or outside the booking window.",
      name: "Full name", phone: "Phone", email: "Email", notes: "Anything we should know? (optional)",
      submit: "Confirm appointment", sending: "Booking…",
      privacy: "We'll email your confirmation. Please don't include medical details here — we'll go over everything at your visit.",
      pickDate: "Pick a date first.", loading: "Loading times…", none: "No open times this day — try another date or call us.",
      pickTime: "Pick a time.",
      summary: function (svc, when) { return "<b>" + svc + "</b> · " + when; },
      doneEyebrow: "You're booked",
      doneBody: 'A confirmation email is on its way with a link to cancel. To reschedule, call <a href="tel:+12133881447" class="text-[#E0115F] font-semibold no-underline">213.388.1447</a>.<br/>301 S Western Ave. #103, Los Angeles, CA 90020',
      cancelEyebrow: "Your appointment", cancelBtn: "Cancel this appointment", bookNew: "Book a new time",
      cancelConfirm: "Cancel this appointment?", cancelled: "Your appointment has been cancelled.",
      errName: "Please enter your name.", errPhone: "Please enter a valid phone number.", errEmail: "Please enter a valid email.",
      errNet: "Something went wrong. Please call us at 213.388.1447.",
      soonTitle: "Online booking opens soon",
      soonBody: 'For now, call us at <a href="tel:+12133881447" class="text-[#E0115F] font-semibold no-underline">213.388.1447</a> and we’ll book your exam.',
      services: { "eye-exam": "Comprehensive eye exam", "contact-lens-exam": "Contact lens exam / fitting", "frame-styling": "Frame styling consultation" },
      locale: "en-US",
    },
    ko: {
      eyebrow: "시력 검사",
      h1: '시력 검사<br/><span class="text-[#E0115F]">예약하기</span>',
      lead: '월 · 수 · 금 · 토 · 10:00 – 18:00 (LA 시간). 전화가 편하시면 <a href="tel:+12133881447" class="text-[#E0115F] font-semibold no-underline">213.388.1447</a>로 연락 주세요.',
      s1: "서비스", s2: "날짜", s3: "시간", s4: "예약자 정보",
      closedNote: "회색 날짜: 검사 없는 날(화·목·일) 또는 예약 가능 기간 밖이에요.",
      name: "이름", phone: "전화번호", email: "이메일", notes: "전달할 내용 (선택)",
      submit: "예약 확정", sending: "예약 중…",
      privacy: "확인 메일을 보내드려요. 건강 관련 정보는 여기 적지 마시고 방문하셨을 때 말씀해 주세요.",
      pickDate: "먼저 날짜를 골라주세요.", loading: "시간 불러오는 중…", none: "이 날은 남은 시간이 없어요. 다른 날짜를 고르거나 전화 주세요.",
      pickTime: "시간을 골라주세요.",
      summary: function (svc, when) { return "<b>" + svc + "</b> · " + when; },
      doneEyebrow: "예약 완료",
      doneBody: '취소 링크가 담긴 확인 메일을 보내드렸어요. 일정 변경은 <a href="tel:+12133881447" class="text-[#E0115F] font-semibold no-underline">213.388.1447</a>로 전화 주세요.<br/>301 S Western Ave. #103, Los Angeles, CA 90020',
      cancelEyebrow: "예약 정보", cancelBtn: "예약 취소", bookNew: "새로 예약하기",
      cancelConfirm: "이 예약을 취소할까요?", cancelled: "예약이 취소되었어요.",
      errName: "이름을 입력해 주세요.", errPhone: "올바른 전화번호를 입력해 주세요.", errEmail: "올바른 이메일을 입력해 주세요.",
      errNet: "문제가 생겼어요. 213.388.1447로 전화 주세요.",
      soonTitle: "온라인 예약 준비 중이에요",
      soonBody: '지금은 <a href="tel:+12133881447" class="text-[#E0115F] font-semibold no-underline">213.388.1447</a>로 전화 주시면 예약해 드려요.',
      services: { "eye-exam": "종합 시력 검사", "contact-lens-exam": "콘택트렌즈 검사 / 피팅", "frame-styling": "안경테 스타일링 상담" },
      locale: "ko-KR",
    },
  };

  function lang() {
    return window.EyeNoonI18n && window.EyeNoonI18n.getLang() === "ko" ? "ko" : "en";
  }
  function L() { return S[lang()]; }
  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, "0"); }

  var cfg = null;
  var state = { service: "eye-exam", date: "", slot: null, view: null };

  /* ---------- static strings ---------- */
  function applyStrings() {
    var s = L();
    document.querySelectorAll("[data-b]").forEach(function (el) {
      var v = s[el.getAttribute("data-b")];
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-b-html]").forEach(function (el) {
      var v = s[el.getAttribute("data-b-html")];
      if (typeof v === "string") el.innerHTML = v;
    });
    document.querySelectorAll("[data-b-ph]").forEach(function (el) {
      var v = s[el.getAttribute("data-b-ph")];
      if (typeof v === "string") el.setAttribute("placeholder", v);
    });
  }

  /* ---------- formatting in store time ---------- */
  function fmtDateLong(dateStr) {
    var p = dateStr.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
    return new Intl.DateTimeFormat(L().locale, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(d);
  }
  function fmtWhen(iso) {
    return new Intl.DateTimeFormat(L().locale, {
      timeZone: TZ, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  }
  function fmtTime(iso) {
    return new Intl.DateTimeFormat(L().locale, { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  }
  function addDays(dateStr, n) {
    var p = dateStr.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function weekday(dateStr) {
    var p = dateStr.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  }
  function bookable(dateStr) {
    return (
      cfg &&
      dateStr >= cfg.today &&
      dateStr <= addDays(cfg.today, cfg.daysAhead) &&
      cfg.openWeekdays.indexOf(weekday(dateStr)) >= 0
    );
  }

  /* ---------- services ---------- */
  function renderServices() {
    var box = $("bk-services");
    box.innerHTML = "";
    cfg.services.forEach(function (svc) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bk-svc" + (svc.id === state.service ? " is-on" : "");
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", svc.id === state.service ? "true" : "false");
      b.textContent = L().services[svc.id] || svc.label;
      b.addEventListener("click", function () {
        state.service = svc.id;
        renderServices();
        renderSummary();
      });
      box.appendChild(b);
    });
  }

  /* ---------- calendar ---------- */
  function renderCalendar() {
    var v = state.view; // {y, m} m = 1..12
    var first = new Date(Date.UTC(v.y, v.m - 1, 1));
    $("bk-month").textContent = new Intl.DateTimeFormat(L().locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(first);

    var dow = $("bk-dow");
    dow.innerHTML = "";
    for (var i = 0; i < 7; i++) {
      var c = document.createElement("span");
      c.className = "bk-dow";
      c.textContent = new Intl.DateTimeFormat(L().locale, { timeZone: "UTC", weekday: "narrow" }).format(new Date(Date.UTC(2023, 0, 1 + i)));
      dow.appendChild(c);
    }

    var days = $("bk-days");
    days.innerHTML = "";
    for (var k = 0; k < first.getUTCDay(); k++) days.appendChild(document.createElement("span"));
    var dim = new Date(Date.UTC(v.y, v.m, 0)).getUTCDate();
    for (var d = 1; d <= dim; d++) {
      var ds = v.y + "-" + pad(v.m) + "-" + pad(d);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bk-day" + (ds === state.date ? " is-on" : "") + (ds === cfg.today ? " is-today" : "");
      b.textContent = d;
      if (!bookable(ds)) b.disabled = true;
      (function (ds) {
        b.addEventListener("click", function () { selectDate(ds); });
      })(ds);
      days.appendChild(b);
    }

    var minView = cfg.today.slice(0, 7);
    var maxView = addDays(cfg.today, cfg.daysAhead).slice(0, 7);
    var cur = v.y + "-" + pad(v.m);
    $("bk-prev").disabled = cur <= minView;
    $("bk-next").disabled = cur >= maxView;
  }

  function shiftMonth(n) {
    var m = state.view.m + n, y = state.view.y;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    state.view = { y: y, m: m };
    renderCalendar();
  }

  /* ---------- slots ---------- */
  var slotReq = 0;
  function selectDate(ds) {
    state.date = ds;
    state.slot = null;
    renderCalendar();
    loadSlots();
    renderSummary();
  }

  function loadSlots() {
    var box = $("bk-slots");
    $("bk-date-label").textContent = state.date ? "· " + fmtDateLong(state.date) : "";
    if (!state.date) {
      box.innerHTML = '<p class="bk-muted">' + L().pickDate + "</p>";
      return;
    }
    box.innerHTML = '<p class="bk-muted">' + L().loading + "</p>";
    var my = ++slotReq;
    fetch(API + "/slots?date=" + state.date, { cache: "no-store" })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
      .then(function (j) {
        if (my !== slotReq) return;
        renderSlots(j.slots || []);
      })
      .catch(function (e) {
        if (my !== slotReq) return;
        box.innerHTML = '<p class="bk-muted">' + (e.message || L().errNet) + "</p>";
      });
  }

  function renderSlots(slots) {
    var box = $("bk-slots");
    box.innerHTML = "";
    if (!slots.length) {
      box.innerHTML = '<p class="bk-muted">' + L().none + "</p>";
      return;
    }
    slots.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bk-slot" + (state.slot === s.start ? " is-on" : "");
      b.textContent = fmtTime(s.start);
      b.addEventListener("click", function () {
        state.slot = s.start;
        box.querySelectorAll(".bk-slot").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        renderSummary();
      });
      box.appendChild(b);
    });
  }

  function renderSummary() {
    var s = L();
    var svc = s.services[state.service] || state.service;
    $("bk-summary").innerHTML = state.slot ? s.summary(svc, fmtWhen(state.slot)) : "";
    $("bk-submit").disabled = !state.slot;
  }

  /* ---------- submit ---------- */
  function showError(msg) {
    var e = $("bk-error");
    e.textContent = msg || "";
    e.classList.toggle("hidden", !msg);
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var s = L();
    var f = ev.target;
    var name = f.name.value.trim(), phone = f.phone.value.trim(), email = f.email.value.trim();
    if (!state.slot) return showError(s.pickTime);
    if (name.length < 2) return showError(s.errName);
    if (phone.replace(/\D/g, "").length < 10) return showError(s.errPhone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError(s.errEmail);
    showError("");

    var btn = $("bk-submit");
    btn.disabled = true;
    btn.textContent = s.sending;
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: state.slot, service: state.service, name: name, phone: phone, email: email,
        notes: f.notes.value.trim(), website: f.website.value,
      }),
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j.ok) {
          $("bk-flow").classList.add("hidden");
          $("bk-done").classList.remove("hidden");
          $("bk-done-when").textContent = fmtWhen(res.j.start);
          $("bk-done-service").textContent = s.services[state.service] || res.j.service;
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        showError(res.j.error || s.errNet);
        if (res.status === 409) { state.slot = null; loadSlots(); renderSummary(); }
      })
      .catch(function () { showError(s.errNet); })
      .finally(function () {
        btn.textContent = L().submit;
        btn.disabled = !state.slot;
      });
  }

  /* ---------- cancel mode ---------- */
  function initCancel(id, token) {
    $("bk-flow").classList.add("hidden");
    $("bk-cancel").classList.remove("hidden");
    var msg = $("bk-cancel-msg");
    var btn = $("bk-cancel-btn");
    function say(t) { msg.textContent = t; msg.classList.remove("hidden"); }
    fetch(API + "/lookup?id=" + encodeURIComponent(id) + "&token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { $("bk-cancel-when").textContent = "—"; btn.classList.add("hidden"); return say(res.j.error); }
        $("bk-cancel-when").textContent = fmtWhen(res.j.start);
        $("bk-cancel-service").textContent = res.j.service || "";
      })
      .catch(function () { say(L().errNet); });

    btn.addEventListener("click", function () {
      if (!window.confirm(L().cancelConfirm)) return;
      btn.disabled = true;
      fetch(API + "/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, token: token }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { btn.classList.add("hidden"); say(L().cancelled); }
          else { btn.disabled = false; say(res.j.error || L().errNet); }
        })
        .catch(function () { btn.disabled = false; say(L().errNet); });
    });
  }

  /* ---------- boot ---------- */
  function rerender() {
    applyStrings();
    if (!cfg) return;
    renderServices();
    renderCalendar();
    if (state.date) loadSlots();
    renderSummary();
  }

  function init() {
    applyStrings();
    var q = new URLSearchParams(location.search);
    if (q.get("cancel")) return initCancel(q.get("cancel"), q.get("t") || "");

    $("bk-form").addEventListener("submit", onSubmit);
    $("bk-prev").addEventListener("click", function () { shiftMonth(-1); });
    $("bk-next").addEventListener("click", function () { shiftMonth(1); });
    $("bk-slots").innerHTML = '<p class="bk-muted">' + L().loading + "</p>";

    fetch(API + "/config", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        cfg = j;
        if (cfg.enabled === false) return showSoon();
        var t = cfg.today.split("-").map(Number);
        state.view = { y: t[0], m: t[1] };
        if (q.get("service") && cfg.services.some(function (s) { return s.id === q.get("service"); })) state.service = q.get("service");
        renderServices();
        // auto-pick the first bookable day
        for (var i = 0; i <= cfg.daysAhead; i++) {
          var ds = addDays(cfg.today, i);
          if (bookable(ds)) { state.view = { y: +ds.slice(0, 4), m: +ds.slice(5, 7) }; selectDate(ds); break; }
        }
        renderCalendar();
      })
      .catch(function () {
        $("bk-slots").innerHTML = '<p class="bk-muted">' + L().errNet + "</p>";
      });

    window.addEventListener("eyenoon-lang-change", rerender);
  }

  function showSoon() {
    var paint = function () {
      $("bk-flow").innerHTML =
        '<article class="contact-card rounded-sm p-8 sm:p-10 flex gap-5 max-w-3xl">' +
        '<div class="pink-bar self-stretch min-h-[100px]"></div><div class="min-w-0">' +
        '<h2 class="font-display text-2xl sm:text-3xl leading-tight mb-3">' + L().soonTitle + "</h2>" +
        '<p class="text-[#3D2B30] leading-relaxed m-0">' + L().soonBody + "</p></div></article>";
    };
    paint();
    window.addEventListener("eyenoon-lang-change", paint);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
