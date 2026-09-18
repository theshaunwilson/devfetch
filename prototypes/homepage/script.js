/**
 * DevFetch homepage prototype.
 *
 * Four independent pieces, each guarded so a missing element degrades to
 * nothing happening rather than throwing and taking the rest down with it:
 * the chaos field animation, the navbar scroll state, the scroll reveal and
 * the pricing period toggle.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------ chaos field --- */

  function startChaos() {
    var field = document.getElementById("chaos");
    if (!field) return;

    var chips = Array.prototype.slice.call(field.querySelectorAll(".chip"));
    if (!chips.length) return;

    var SIZE = 46; // matches .chip in styles.css
    var DRIFT = 15; // px per second the icons settle back to
    var MIN_SPEED = DRIFT * 0.65;
    var MAX_SPEED = 260;
    var REPEL_RADIUS = 130;
    var REPEL_FORCE = 1500;

    var bounds = { w: field.clientWidth, h: field.clientHeight };
    var pointer = { x: 0, y: 0, active: false };
    var running = false;
    var frame = 0;
    var last = 0;

    var items = chips.map(function (el, i) {
      var angle = Math.random() * Math.PI * 2;
      return {
        el: el,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * DRIFT,
        vy: Math.sin(angle) * DRIFT,
        phase: Math.random() * Math.PI * 2,
        spin: 0.5 + Math.random() * 0.45,
        tilt: 6 + Math.random() * 5,
        pulse: 0.7 + (i % 3) * 0.16,
      };
    });

    /** Scatter through a jittered grid so no two icons start on top of each other. */
    function scatter() {
      var cols = 4;
      var rows = Math.ceil(items.length / cols);
      var cellW = Math.max(bounds.w / cols, SIZE);
      var cellH = Math.max(bounds.h / rows, SIZE);

      items.forEach(function (item, i) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        var slackX = Math.max(cellW - SIZE, 0);
        var slackY = Math.max(cellH - SIZE, 0);
        item.x = col * cellW + Math.random() * slackX;
        item.y = row * cellH + Math.random() * slackY;
        clamp(item);
      });
    }

    function clamp(item) {
      var maxX = Math.max(bounds.w - SIZE, 0);
      var maxY = Math.max(bounds.h - SIZE, 0);
      if (item.x < 0) item.x = 0;
      if (item.y < 0) item.y = 0;
      if (item.x > maxX) item.x = maxX;
      if (item.y > maxY) item.y = maxY;
    }

    function draw(item) {
      var rot = Math.sin(item.phase * item.spin) * item.tilt;
      var scale = 1 + Math.sin(item.phase * item.pulse) * 0.055;
      item.el.style.transform =
        "translate3d(" +
        item.x.toFixed(2) +
        "px," +
        item.y.toFixed(2) +
        "px,0) rotate(" +
        rot.toFixed(2) +
        "deg) scale(" +
        scale.toFixed(3) +
        ")";
    }

    function step(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      var maxX = Math.max(bounds.w - SIZE, 0);
      var maxY = Math.max(bounds.h - SIZE, 0);

      items.forEach(function (item) {
        if (pointer.active) {
          var dx = item.x + SIZE / 2 - pointer.x;
          var dy = item.y + SIZE / 2 - pointer.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist < REPEL_RADIUS) {
            var push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE * dt;
            item.vx += (dx / dist) * push;
            item.vy += (dy / dist) * push;
          }
        }

        // Bleed the shove off over about a second, and keep a slow drift
        // going so the field never settles into stillness.
        var speed = Math.sqrt(item.vx * item.vx + item.vy * item.vy);
        if (speed < 0.001) {
          var a = Math.random() * Math.PI * 2;
          item.vx = Math.cos(a) * DRIFT;
          item.vy = Math.sin(a) * DRIFT;
        } else {
          var target = speed;
          if (speed > DRIFT) {
            target = DRIFT + (speed - DRIFT) * Math.pow(0.28, dt);
          } else if (speed < MIN_SPEED) {
            target = MIN_SPEED;
          }
          if (target > MAX_SPEED) target = MAX_SPEED;
          item.vx *= target / speed;
          item.vy *= target / speed;
        }

        item.x += item.vx * dt;
        item.y += item.vy * dt;

        if (item.x <= 0) {
          item.x = 0;
          item.vx = Math.abs(item.vx);
        } else if (item.x >= maxX) {
          item.x = maxX;
          item.vx = -Math.abs(item.vx);
        }
        if (item.y <= 0) {
          item.y = 0;
          item.vy = Math.abs(item.vy);
        } else if (item.y >= maxY) {
          item.y = maxY;
          item.vy = -Math.abs(item.vy);
        }

        item.phase += dt;
        draw(item);
      });

      frame = window.requestAnimationFrame(step);
    }

    function play() {
      if (running || reduceMotion.matches) return;
      running = true;
      last = window.performance.now();
      frame = window.requestAnimationFrame(step);
    }

    function pause() {
      if (!running) return;
      running = false;
      window.cancelAnimationFrame(frame);
    }

    function measure() {
      bounds.w = field.clientWidth;
      bounds.h = field.clientHeight;
      items.forEach(function (item) {
        clamp(item);
        draw(item);
      });
    }

    scatter();
    items.forEach(draw);

    field.addEventListener("pointermove", function (event) {
      var rect = field.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    });

    field.addEventListener("pointerleave", function () {
      pointer.active = false;
    });

    if (typeof ResizeObserver === "function") {
      new ResizeObserver(measure).observe(field);
    } else {
      window.addEventListener("resize", measure);
    }

    // Nothing is gained by animating a field nobody is looking at.
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) play();
          else pause();
        });
      }).observe(field);
    } else {
      play();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else play();
    });

    reduceMotion.addEventListener("change", function () {
      if (reduceMotion.matches) pause();
      else play();
    });
  }

  /* ----------------------------------------------------------- navbar --- */

  function startNav() {
    var nav = document.getElementById("nav");
    if (!nav) return;

    function update() {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---------------------------------------------------- scroll reveal --- */

  function startReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!targets.length) return;

    if (reduceMotion.matches || typeof IntersectionObserver !== "function") {
      targets.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* -------------------------------------------------- pricing period --- */

  function startBilling() {
    var toggle = document.getElementById("billingToggle");
    var amount = document.getElementById("proAmount");
    var period = document.getElementById("proPeriod");
    var note = document.getElementById("proNote");
    var monthly = document.getElementById("billingMonthly");
    var yearly = document.getElementById("billingYearly");
    if (!toggle || !amount || !period || !note) return;

    var PLANS = {
      monthly: {
        amount: "$8",
        period: "per month",
        note: "Or $72 a year, billed annually.",
      },
      yearly: {
        amount: "$6",
        period: "per month",
        note: "Billed as $72 once a year.",
      },
    };

    function render(isYearly) {
      var plan = isYearly ? PLANS.yearly : PLANS.monthly;
      amount.textContent = plan.amount;
      period.textContent = plan.period;
      note.textContent = plan.note;
      toggle.setAttribute("aria-checked", String(isYearly));
      if (monthly) monthly.classList.toggle("is-active", !isYearly);
      if (yearly) yearly.classList.toggle("is-active", isYearly);
    }

    toggle.addEventListener("click", function () {
      render(toggle.getAttribute("aria-checked") !== "true");
    });

    render(false);
  }

  /* -------------------------------------------------------------- year --- */

  function startYear() {
    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  startChaos();
  startNav();
  startReveal();
  startBilling();
  startYear();
})();
