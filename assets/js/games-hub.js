/* =========================================================
   games-hub.js — 读取注册表，渲染游戏卡片与标签筛选
   ========================================================= */
(function () {
  "use strict";

  var grid = document.getElementById("game-grid");
  var filterBar = document.getElementById("tag-filter");
  var countEl = document.getElementById("game-count");

  if (!grid) return;

  var games = (window.GAME_REGISTRY || []).slice();
  var placeholders = window.GAME_PLACEHOLDERS || [];

  /* ---------- 工具 ---------- */
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function softColor(hex, alpha) {
    var h = String(hex || "#0052d9").replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var n = parseInt(h, 16);
    if (isNaN(n)) return "rgba(0, 82, 217, " + alpha + ")";
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  function arrowIcon() {
    return (
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 12h13M13 6l6 6-6 6"/></svg>'
    );
  }

  /* ---------- 排序：重点 → 可玩 → 开发中 ---------- */
  var weight = { ready: 0, beta: 1, soon: 2 };
  games.sort(function (a, b) {
    var fa = a.featured ? 0 : 1;
    var fb = b.featured ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return (weight[a.status] || 0) - (weight[b.status] || 0);
  });

  /* ---------- 渲染卡片 ---------- */
  function cardHTML(game) {
    var ready = game.status !== "soon";
    var accent = game.accent || "#0052d9";
    var tags = game.tags || [];
    var tagLine = [game.name]
      .concat(tags)
      .join(" ")
      .toLowerCase();

    var tagHTML = tags
      .map(function (t) {
        return "<span>" + esc(t) + "</span>";
      })
      .join("");

    var badge =
      game.status === "soon"
        ? '<span class="badge-soon">开发中</span>'
        : game.status === "beta"
        ? '<span class="badge-soon">测试中</span>'
        : "";

    var inner =
      '<div class="game-card__top">' +
      '<div class="game-card__icon">' +
      (game.icon || "") +
      "</div>" +
      (game.meta ? '<div class="game-card__meta">' + esc(game.meta) + "</div>" : "") +
      "</div>" +
      "<h3>" +
      esc(game.name) +
      badge +
      "</h3>" +
      (game.subtitle ? '<div class="game-card__sub">' + esc(game.subtitle) + "</div>" : "") +
      (game.description ? '<p class="game-card__desc">' + esc(game.description) + "</p>" : "") +
      (tagHTML ? '<div class="game-card__tags">' + tagHTML + "</div>" : "") +
      '<div class="game-card__go"><span>' +
      (ready ? "开始游戏" : "敬请期待") +
      "</span>" +
      (ready ? arrowIcon() : "") +
      "</div>";

    var style =
      "--card-accent:" + accent + ";--card-accent-soft:" + softColor(accent, 0.09);

    if (ready) {
      return (
        '<a class="game-card" href="' +
        esc(game.path) +
        '" style="' +
        style +
        '" data-tags="' +
        esc(tagLine) +
        '">' +
        inner +
        "</a>"
      );
    }
    return (
      '<div class="game-card game-card--soon" style="' +
      style +
      '" data-tags="' +
      esc(tagLine) +
      '">' +
      inner +
      "</div>"
    );
  }

  function placeholderHTML(item) {
    return (
      '<div class="game-card game-card--soon" data-tags="placeholder">' +
      '<div class="game-card__top">' +
      '<div class="game-card__icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M12 5v14M5 12h14"/></svg>' +
      "</div>" +
      '<div class="game-card__meta">soon</div>' +
      "</div>" +
      "<h3>" +
      esc(item.name) +
      ' <span class="badge-soon">开发中</span></h3>' +
      '<p class="game-card__desc">' +
      esc(item.note || "这个位置留给下一个游戏。") +
      "</p>" +
      '<div class="game-card__go"><span>待接入</span></div>' +
      "</div>"
    );
  }

  function render(list) {
    var html = list.map(cardHTML).join("");
    if (!list.length) {
      html =
        '<p style="grid-column:1/-1;color:#7b8a9e;font-size:14px">该标签下暂时没有游戏。</p>';
    } else {
      html += placeholders.map(placeholderHTML).join("");
    }
    grid.innerHTML = html;
  }

  /* ---------- 数量 ---------- */
  if (countEl) {
    var readyCount = games.filter(function (g) {
      return g.status !== "soon";
    }).length;
    countEl.textContent = String(readyCount);
  }

  /* ---------- 标签筛选 ---------- */
  var tagSet = [];
  games.forEach(function (g) {
    (g.tags || []).forEach(function (t) {
      if (tagSet.indexOf(t) === -1) tagSet.push(t);
    });
  });

  if (filterBar && tagSet.length) {
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "全部";
    allBtn.className = "is-active";
    allBtn.dataset.tag = "*";
    filterBar.appendChild(allBtn);

    tagSet.forEach(function (tag) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = tag;
      b.dataset.tag = tag;
      filterBar.appendChild(b);
    });

    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;

      Array.prototype.forEach.call(filterBar.children, function (c) {
        c.classList.remove("is-active");
      });
      btn.classList.add("is-active");

      var tag = btn.dataset.tag;
      var filtered =
        tag === "*"
          ? games
          : games.filter(function (g) {
              return (g.tags || []).indexOf(tag) !== -1;
            });
      render(filtered);
    });
  }

  render(games);
})();
