/* =========================================================
   site.js — 全站通用交互（导航 / 滚动动画 / 年份）
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 移动端菜单 ---------- */
  var toggle = document.querySelector("[data-nav-toggle]");
  var links = document.querySelector("[data-nav-links]");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "收起菜单" : "展开菜单");
    });

    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("is-open")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 滚动进入动画 ---------- */
  var items = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && items.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            var siblings = Array.prototype.slice.call(
              el.parentNode ? el.parentNode.children : []
            );
            var index = siblings.indexOf(el);
            var delay = Math.min(index, 5) * 55;
            el.style.transitionDelay = delay + "ms";
            el.classList.add("is-in");
            io.unobserve(el);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    items.forEach(function (el) {
      io.observe(el);
    });
  } else {
    items.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  /* ---------- 页脚年份 ---------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
