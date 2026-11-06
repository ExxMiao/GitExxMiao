/* =========================================================
   minesweeper.js — 扫雷模块（独立、无依赖）
   ---------------------------------------------------------
   结构：
     1. 引擎      —— 布雷（首点安全）/ 计数 / 翻开扩散 / 快开
     2. 状态      —— 单一 state 对象，UI 由 render() 派生
     3. 渲染      —— state → DOM
     4. 交互      —— 鼠标 / 触屏（长按插旗）/ 键盘
     5. 存档      —— localStorage（当前进度 + 各难度最佳成绩）
   ========================================================= */
(function () {
  "use strict";

  /* =======================================================
     1. 引擎
     ======================================================= */

  var DIFFICULTIES = {
    beginner: { label: "初级", rows: 9, cols: 9, mines: 10 },
    intermediate: { label: "中级", rows: 16, cols: 16, mines: 40 },
    expert: { label: "高级", rows: 16, cols: 30, mines: 99 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function neighbors(i, rows, cols) {
    var r = Math.floor(i / cols);
    var c = i % cols;
    var out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var nr = r + dr;
        var nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        out.push(nr * cols + nc);
      }
    }
    return out;
  }

  /* 布雷：第一次点击的位置及其周围一圈保证无雷 */
  function placeMines(rows, cols, mines, safe) {
    var total = rows * cols;
    var grid = new Int8Array(total);
    var banned = {};
    banned[safe] = true;
    var ns = neighbors(safe, rows, cols);
    for (var b = 0; b < ns.length; b++) banned[ns[b]] = true;

    var pool = [];
    for (var i = 0; i < total; i++) {
      if (!banned[i]) pool.push(i);
    }
    shuffle(pool);
    for (var m = 0; m < mines; m++) grid[pool[m]] = -1;

    for (var j = 0; j < total; j++) {
      if (grid[j] === -1) continue;
      var cnt = 0;
      var around = neighbors(j, rows, cols);
      for (var k = 0; k < around.length; k++) {
        if (grid[around[k]] === -1) cnt++;
      }
      grid[j] = cnt;
    }
    return grid;
  }

  /* =======================================================
     2. 状态
     ======================================================= */

  var S = {
    difficulty: "beginner",
    rows: 9,
    cols: 9,
    mines: 10,
    grid: null, // Int8Array：-1 雷，0-8 数字
    cellState: null, // Uint8Array：0 未翻，1 已翻，2 插旗
    started: false,
    over: false,
    won: false,
    revealedCount: 0,
    flags: 0,
    seconds: 0,
    paused: false,
    loading: false,
    flagMode: false,
    cursor: -1
  };
  var boomIdx = -1;

  var STATE_KEY = "minesweeper:state:v1";
  var BEST_PREFIX = "minesweeper:best:";

  function readLS(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function writeLS(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {
      /* 隐私模式下忽略 */
    }
  }

  /* =======================================================
     DOM 引用
     ======================================================= */

  var board = document.getElementById("board");
  if (!board) return;
  var boardScroll = board.parentNode;

  var elMines = document.querySelector('[data-stat="mines"]');
  var elTime = document.querySelector('[data-stat="time"]');
  var elBest = document.querySelector('[data-stat="best"]');
  var flagModeBtn = document.querySelector('[data-act="flagmode"]');
  var flagModeState = document.querySelector("[data-flagmode-state]");
  var diffSizeEl = document.querySelector("[data-diff-size]");
  var difficultyGroup = document.querySelector("[data-difficulty-group]");
  var overlay = document.querySelector("[data-overlay]");
  var pauseLayer = document.querySelector("[data-pause-layer]");

  var cells = [];

  /* =======================================================
     3. 渲染
     ======================================================= */

  function fmtTime(total) {
    var m = Math.floor(total / 60);
    var s = total % 60;
    var pad = function (v) {
      return (v < 10 ? "0" : "") + v;
    };
    if (m >= 60) {
      var h = Math.floor(m / 60);
      return h + ":" + pad(m % 60) + ":" + pad(s);
    }
    return pad(m) + ":" + pad(s);
  }

  function updateStats() {
    if (elMines) elMines.textContent = String(S.mines - S.flags);
    if (elTime) elTime.textContent = fmtTime(S.seconds);
  }

  function updateBestLabel() {
    var el = document.querySelector('[data-stat="best"]');
    if (!el) return;
    var raw = readLS(BEST_PREFIX + S.difficulty);
    el.textContent = raw ? fmtTime(Number(raw)) : "--:--";
  }

  function updateFlagModeUI() {
    if (flagModeBtn) {
      flagModeBtn.classList.toggle("is-on", S.flagMode);
      flagModeBtn.setAttribute("aria-pressed", S.flagMode ? "true" : "false");
    }
    if (flagModeState) flagModeState.textContent = S.flagMode ? "开" : "关";
  }

  function updateDifficultyUI() {
    if (!difficultyGroup) return;
    var btns = difficultyGroup.querySelectorAll("button");
    for (var k = 0; k < btns.length; k++) {
      btns[k].classList.toggle("is-active", btns[k].dataset.difficulty === S.difficulty);
    }
    if (diffSizeEl) {
      diffSizeEl.textContent =
        S.cols + " × " + S.rows + " · " + S.mines + " 雷";
    }
  }

  function fitBoard() {
    var avail = (boardScroll ? boardScroll.clientWidth : 720) - 10;
    var size = Math.floor((avail - S.cols) / S.cols); // 扣除 gap
    size = Math.max(16, Math.min(32, size));
    board.style.setProperty("--cell", size + "px");
    board.style.setProperty("--cols", String(S.cols));
  }

  function render() {
    if (!S.cellState) return;

    for (var i = 0; i < cells.length; i++) {
      var st = S.cellState[i];
      var v = S.grid ? S.grid[i] : 0;
      var cls = "cell";
      var text = "";

      if (st === 2) {
        cls += " is-flag";
        text = "⚑";
        if (S.over && v !== -1) cls += " is-wrong";
      } else if (st === 1) {
        cls += " is-open";
        if (v === -1) {
          cls += " is-mine";
          if (i === boomIdx) cls += " is-boom";
          text = "✱";
        } else if (v > 0) {
          cls += " n" + v;
          text = String(v);
        }
      } else if (S.over && v === -1) {
        // 失败后亮出所有雷
        cls += " is-open is-mine";
        text = "✱";
      }

      if (S.cursor === i && !S.over) cls += " is-cursor";

      var cell = cells[i];
      if (cell.el.className !== cls) cell.el.className = cls;
      if (cell.glyph.textContent !== text) cell.glyph.textContent = text;
    }
  }

  /* =======================================================
     4. 游戏流程
     ======================================================= */

  var genToken = 0;

  function newGame(difficulty) {
    var diff = DIFFICULTIES[difficulty] ? difficulty : S.difficulty || "beginner";
    var token = ++genToken;
    var conf = DIFFICULTIES[diff];

    S.difficulty = diff;
    S.rows = conf.rows;
    S.cols = conf.cols;
    S.mines = conf.mines;
    S.loading = true;
    board.classList.add("is-loading");

    updateDifficultyUI();
    updateBestLabel();

    window.setTimeout(function () {
      if (token !== genToken) return;

      S.grid = null;
      S.cellState = new Uint8Array(conf.rows * conf.cols);
      S.started = false;
      S.over = false;
      S.won = false;
      S.revealedCount = 0;
      S.flags = 0;
      S.seconds = 0;
      S.paused = false;
      S.cursor = Math.floor(conf.rows / 2) * conf.cols + Math.floor(conf.cols / 2);
      boomIdx = -1;
      S.loading = false;

      buildBoard();
      board.classList.remove("is-loading", "is-over", "is-won");
      if (overlay) overlay.hidden = true;
      if (pauseLayer) pauseLayer.hidden = true;

      render();
      updateStats();
      save();
    }, 40);
  }

  function buildBoard() {
    board.innerHTML = "";
    cells = [];
    var frag = document.createDocumentFragment();
    var total = S.rows * S.cols;
    for (var i = 0; i < total; i++) {
      var el = document.createElement("div");
      el.className = "cell";
      el.setAttribute("role", "gridcell");
      el.dataset.i = String(i);
      var g = document.createElement("span");
      g.className = "glyph";
      el.appendChild(g);
      frag.appendChild(el);
      cells.push({ el: el, glyph: g });
    }
    board.appendChild(frag);
    fitBoard();
  }

  function ensureGrid(safe) {
    if (S.grid) return;
    S.grid = placeMines(S.rows, S.cols, S.mines, safe);
    S.started = true;
  }

  function floodReveal(start) {
    var queue = [start];
    while (queue.length) {
      var cur = queue.pop();
      if (S.cellState[cur] !== 0) continue;
      S.cellState[cur] = 1;
      S.revealedCount++;
      if (S.grid[cur] === 0) {
        var ns = neighbors(cur, S.rows, S.cols);
        for (var k = 0; k < ns.length; k++) {
          if (S.cellState[ns[k]] === 0) queue.push(ns[k]);
        }
      }
    }
  }

  function doReveal(i) {
    if (S.over || S.paused || S.loading) return;
    if (i < 0 || i >= S.rows * S.cols) return;
    if (S.cellState[i] === 2) return; // 旗子保护
    if (S.cellState[i] === 1) {
      chord(i);
    } else {
      ensureGrid(i);
      if (S.grid[i] === -1) {
        lose(i);
      } else {
        floodReveal(i);
      }
    }
    render();
    updateStats();
    save();
    checkWin();
  }

  /* 快开：已翻开的数字周围旗子数够了，一次翻开剩余格子 */
  function chord(i) {
    if (S.grid[i] <= 0) return;
    var ns = neighbors(i, S.rows, S.cols);
    var flags = 0;
    for (var f = 0; f < ns.length; f++) {
      if (S.cellState[ns[f]] === 2) flags++;
    }
    if (flags !== S.grid[i]) return;
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k];
      if (S.cellState[n] === 0) {
        if (S.grid[n] === -1) {
          lose(n);
          return;
        }
        floodReveal(n);
      }
    }
  }

  function toggleFlag(i) {
    if (S.over || S.paused || S.loading) return;
    if (S.cellState[i] === 1) return;
    if (S.cellState[i] === 2) {
      S.cellState[i] = 0;
      S.flags--;
    } else {
      S.cellState[i] = 2;
      S.flags++;
    }
    render();
    updateStats();
    save();
  }

  function lose(boom) {
    S.over = true;
    S.won = false;
    boomIdx = boom;
    board.classList.add("is-over");
    save();
    showResult(false);
  }

  function checkWin() {
    if (S.over || !S.grid) return;
    if (S.revealedCount !== S.rows * S.cols - S.mines) return;

    S.over = true;
    S.won = true;
    for (var j = 0; j < S.cellState.length; j++) {
      if (S.grid[j] === -1) S.cellState[j] = 2; // 自动插旗
    }
    S.flags = S.mines;

    board.classList.add("is-over", "is-won");
    updateStats();

    var key = BEST_PREFIX + S.difficulty;
    var prev = readLS(key);
    var isRecord = !prev || S.seconds < Number(prev);
    if (isRecord) writeLS(key, String(S.seconds));
    updateBestLabel();
    save();

    showResult(true, isRecord);
  }

  function showResult(won, isRecord) {
    window.setTimeout(function () {
      if (!overlay) return;
      var mark = overlay.querySelector("[data-result-mark]");
      var title = overlay.querySelector("[data-result-title]");
      var diff = overlay.querySelector("[data-result-diff]");
      var time = overlay.querySelector("[data-result-time]");
      var rec = overlay.querySelector("[data-result-record]");

      if (mark) mark.classList.toggle("is-lose", !won);
      if (title) title.textContent = won ? "胜利！" : "踩到雷了";
      if (diff) diff.textContent = DIFFICULTIES[S.difficulty].label;
      if (time) time.textContent = fmtTime(S.seconds);
      if (rec) rec.hidden = !(won && isRecord);

      overlay.hidden = false;
    }, won ? 420 : 700);
  }

  function togglePause() {
    if (S.over || S.loading) return;
    S.paused = !S.paused;
    if (pauseLayer) pauseLayer.hidden = !S.paused;
    if (!S.paused) save();
  }

  /* =======================================================
     5. 存档
     ======================================================= */

  function save() {
    if (!S.cellState || S.loading) return;
    writeLS(
      STATE_KEY,
      JSON.stringify({
        difficulty: S.difficulty,
        grid: S.grid ? Array.prototype.slice.call(S.grid) : null,
        cellState: Array.prototype.slice.call(S.cellState),
        started: S.started,
        revealedCount: S.revealedCount,
        flags: S.flags,
        seconds: S.seconds,
        over: S.over
      })
    );
  }

  function restore() {
    var raw = readLS(STATE_KEY);
    if (!raw) return false;
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    if (
      !data ||
      !data.cellState ||
      data.over ||
      !DIFFICULTIES[data.difficulty]
    ) {
      return false;
    }

    var conf = DIFFICULTIES[data.difficulty];
    if (data.cellState.length !== conf.rows * conf.cols) return false;

    S.difficulty = data.difficulty;
    S.rows = conf.rows;
    S.cols = conf.cols;
    S.mines = conf.mines;
    S.grid = data.grid && data.grid.length === data.cellState.length
      ? Int8Array.from(data.grid)
      : null;
    S.cellState = Uint8Array.from(data.cellState);
    S.started = !!data.started;
    S.revealedCount = data.revealedCount | 0;
    S.flags = data.flags | 0;
    S.seconds = data.seconds | 0;
    S.over = false;
    S.won = false;
    S.paused = false;
    S.cursor = Math.floor(conf.rows / 2) * conf.cols + Math.floor(conf.cols / 2);
    boomIdx = -1;

    buildBoard();
    render();
    updateStats();
    return true;
  }

  /* =======================================================
     6. 交互
     ======================================================= */

  var justLongPressed = false;

  board.addEventListener("click", function (e) {
    var cellEl = e.target.closest(".cell");
    if (!cellEl) return;
    if (justLongPressed) return;
    var i = Number(cellEl.dataset.i);
    S.cursor = i;
    if (S.flagMode) {
      toggleFlag(i);
    } else {
      doReveal(i);
    }
  });

  board.addEventListener("contextmenu", function (e) {
    var cellEl = e.target.closest(".cell");
    if (!cellEl) return;
    e.preventDefault();
    toggleFlag(Number(cellEl.dataset.i));
  });

  /* 长按插旗（触屏） */
  var lpTimer = null;
  board.addEventListener(
    "touchstart",
    function (e) {
      var cellEl = e.target.closest(".cell");
      if (!cellEl) return;
      var i = Number(cellEl.dataset.i);
      lpTimer = window.setTimeout(function () {
        justLongPressed = true;
        toggleFlag(i);
        if (navigator.vibrate) navigator.vibrate(30);
        window.setTimeout(function () {
          justLongPressed = false;
        }, 400);
      }, 380);
    },
    { passive: true }
  );
  ["touchend", "touchmove", "touchcancel"].forEach(function (ev) {
    board.addEventListener(
      ev,
      function () {
        if (lpTimer) window.clearTimeout(lpTimer);
      },
      { passive: true }
    );
  });

  /* 键盘 */
  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.over || S.paused || S.loading || !S.cellState) return;

    var total = S.rows * S.cols;
    var r = Math.floor(S.cursor / S.cols);
    var c = S.cursor % S.cols;

    switch (e.key) {
      case "ArrowUp":
        r = Math.max(0, r - 1);
        break;
      case "ArrowDown":
        r = Math.min(S.rows - 1, r + 1);
        break;
      case "ArrowLeft":
        c = Math.max(0, c - 1);
        break;
      case "ArrowRight":
        c = Math.min(S.cols - 1, c + 1);
        break;
      case "Enter":
      case " ":
        doReveal(S.cursor);
        e.preventDefault();
        return;
      case "f":
      case "F":
        toggleFlag(S.cursor);
        e.preventDefault();
        return;
      default:
        return;
    }
    S.cursor = r * S.cols + c;
    render();
    e.preventDefault();
  });

  /* 工具按钮 */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.dataset.act;

    if (act === "new") newGame(S.difficulty);
    else if (act === "pause") togglePause();
    else if (act === "flagmode") {
      S.flagMode = !S.flagMode;
      updateFlagModeUI();
    } else if (act === "home") {
      window.location.href = "../../games.html";
    }
  });

  if (difficultyGroup) {
    difficultyGroup.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-difficulty]");
      if (!btn) return;
      var diff = btn.dataset.difficulty;
      if (diff === S.difficulty && !S.over) return;

      if (S.started && !S.over) {
        var ok = window.confirm("切换难度会开始新的一局，当前进度将丢失，继续吗？");
        if (!ok) return;
      }
      newGame(diff);
    });
  }

  window.addEventListener("resize", fitBoard);
  window.addEventListener("beforeunload", save);

  /* =======================================================
     7. 计时 & 启动
     ======================================================= */

  window.setInterval(function () {
    if (S.loading || S.over || S.paused || !S.started) return;
    S.seconds++;
    updateStats();
    if (S.seconds % 5 === 0) save();
  }, 1000);

  function boot() {
    var restored = restore();
    updateDifficultyUI();
    updateBestLabel();
    updateFlagModeUI();

    if (!restored) {
      newGame("beginner");
    } else {
      updateStats();
    }
  }

  boot();
})();
