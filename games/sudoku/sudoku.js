/* =========================================================
   sudoku.js — 数独模块（独立、无依赖）
   ---------------------------------------------------------
   结构：
     1. 引擎        —— 生成完整解 / 挖洞 / 唯一解校验 / 唯一性求解计数
     2. 状态        —— 单一 state 对象，所有 UI 由 render() 派生
     3. 渲染        —— 只负责把 state 映射成 DOM
     4. 交互        —— 鼠标 / 触屏 / 键盘
     5. 存档        —— localStorage（当前进度 + 各难度最佳成绩）
   ========================================================= */
(function () {
  "use strict";

  /* =======================================================
     1. 引擎
     ======================================================= */

  var DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var ALL = 0x3fe; // 第 1–9 位为 1

  function popcount(x) {
    var c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function rowOf(i) {
    return (i / 9) | 0;
  }
  function colOf(i) {
    return i % 9;
  }
  function boxOf(i) {
    return ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);
  }

  /* 生成一个完整合法的解（随机回溯） */
  function generateSolved() {
    var grid = new Uint8Array(81);
    var rows = new Int32Array(9);
    var cols = new Int32Array(9);
    var boxes = new Int32Array(9);

    function fill(pos) {
      if (pos === 81) return true;
      var r = rowOf(pos);
      var c = colOf(pos);
      var b = boxOf(pos);
      var avail = ~(rows[r] | cols[c] | boxes[b]) & ALL;
      var list = [];
      for (var v = 1; v <= 9; v++) {
        if (avail & (1 << v)) list.push(v);
      }
      shuffle(list);
      for (var k = 0; k < list.length; k++) {
        var v2 = list[k];
        var bit = 1 << v2;
        grid[pos] = v2;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        if (fill(pos + 1)) return true;
        grid[pos] = 0;
        rows[r] ^= bit;
        cols[c] ^= bit;
        boxes[b] ^= bit;
      }
      return false;
    }

    fill(0);
    return grid;
  }

  /* 统计解的个数，最多数到 limit 个（用于唯一性判断） */
  function countSolutions(grid, limit) {
    var work = new Uint8Array(grid);
    var rows = new Int32Array(9);
    var cols = new Int32Array(9);
    var boxes = new Int32Array(9);

    for (var i = 0; i < 81; i++) {
      var v = work[i];
      if (!v) continue;
      var r = rowOf(i),
        c = colOf(i),
        b = boxOf(i);
      var m = 1 << v;
      if (rows[r] & m || cols[c] & m || boxes[b] & m) return 0; // 题面本身冲突
      rows[r] |= m;
      cols[c] |= m;
      boxes[b] |= m;
    }

    var count = 0;

    function rec() {
      // 选候选数最少的空格（MRV），大幅减少搜索分支
      var best = -1,
        bestMask = 0,
        bestCnt = 10;
      for (var i2 = 0; i2 < 81; i2++) {
        if (work[i2]) continue;
        var r2 = rowOf(i2),
          c2 = colOf(i2),
          b2 = boxOf(i2);
        var avail = ~(rows[r2] | cols[c2] | boxes[b2]) & ALL;
        if (!avail) return; // 死路
        var cnt = popcount(avail);
        if (cnt < bestCnt) {
          bestCnt = cnt;
          best = i2;
          bestMask = avail;
          if (cnt === 1) break;
        }
      }

      if (best === -1) {
        count++;
        return;
      }

      var rr = rowOf(best),
        cc = colOf(best),
        bb = boxOf(best);
      var mask = bestMask;
      while (mask) {
        var bit = mask & -mask;
        mask ^= bit;
        var digit = 31 - Math.clz32(bit); // 2^n -> n
        work[best] = digit;
        rows[rr] |= bit;
        cols[cc] |= bit;
        boxes[bb] |= bit;

        rec();

        work[best] = 0;
        rows[rr] ^= bit;
        cols[cc] ^= bit;
        boxes[bb] ^= bit;

        if (count >= limit) return;
      }
    }

    rec();
    return count;
  }

  /* 目标提示数（越少越难） */
  var DIFFICULTIES = {
    easy: { label: "简单", clues: 40 },
    medium: { label: "中等", clues: 34 },
    hard: { label: "困难", clues: 29 },
    expert: { label: "专家", clues: 25 }
  };

  /* 挖洞：每次挖掉一格，检查是否仍然唯一解，否则填回 */
  function generatePuzzle(difficulty) {
    var conf = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    var target = conf.clues;
    var solution = generateSolved();
    var puzzle = new Uint8Array(solution);
    var clues = 81;

    var order = [];
    for (var i = 0; i < 81; i++) order.push(i);
    shuffle(order);

    var pass, k, idx, backup;
    for (pass = 0; pass < 2 && clues > target; pass++) {
      for (k = 0; k < order.length && clues > target; k++) {
        idx = order[k];
        if (!puzzle[idx]) continue;
        backup = puzzle[idx];
        puzzle[idx] = 0;
        if (countSolutions(puzzle, 2) !== 1) {
          puzzle[idx] = backup;
        } else {
          clues--;
        }
      }
    }

    return { puzzle: puzzle, solution: solution, clues: clues };
  }

  /* =======================================================
     2. 状态
     ======================================================= */

  var S = {
    difficulty: "medium",
    puzzle: null,
    solution: null,
    values: null,
    notes: null,
    hintCells: null,
    history: [],
    selected: -1,
    notesMode: false,
    autoCheck: true,
    mistakes: 0,
    hints: 0,
    seconds: 0,
    solved: false,
    paused: false,
    loading: false
  };

  var STATE_KEY = "sudoku:state:v1";
  var BEST_PREFIX = "sudoku:best:";

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
     DOM 引用 & 构建棋盘
     ======================================================= */

  var board = document.getElementById("board");
  if (!board) return;

  var elTime = document.querySelector('[data-stat="time"]');
  var elMistakes = document.querySelector('[data-stat="mistakes"]');
  var elHints = document.querySelector('[data-stat="hints"]');
  var elBest = document.querySelector("[data-best]");
  var padEl = document.querySelector("[data-pad]");
  var notesBtn = document.querySelector('[data-act="notes"]');
  var notesState = document.querySelector("[data-notes-state]");
  var autoCheckInput = document.querySelector("[data-autocheck]");
  var pauseLabel = document.querySelector("[data-pause-label]");
  var overlay = document.querySelector("[data-overlay]");
  var pauseLayer = document.querySelector("[data-pause-layer]");
  var difficultyGroup = document.querySelector("[data-difficulty-group]");

  var cells = [];
  var unitMap = { rows: [], cols: [], boxes: [] };
  var i, r, c;

  for (r = 0; r < 9; r++) {
    unitMap.rows.push([]);
    unitMap.cols.push([]);
    unitMap.boxes.push([]);
  }
  for (i = 0; i < 81; i++) {
    unitMap.rows[rowOf(i)].push(i);
    unitMap.cols[colOf(i)].push(i);
    unitMap.boxes[boxOf(i)].push(i);
  }

  for (i = 0; i < 81; i++) {
    var cellEl = document.createElement("div");
    cellEl.className = "cell";
    cellEl.setAttribute("role", "gridcell");
    cellEl.dataset.i = String(i);

    var notesEl = document.createElement("div");
    notesEl.className = "cell__notes";
    var noteSpans = [];
    for (var n = 1; n <= 9; n++) {
      var span = document.createElement("i");
      span.textContent = String(n);
      notesEl.appendChild(span);
      noteSpans.push(span);
    }

    var valEl = document.createElement("span");
    valEl.className = "cell__val";

    cellEl.appendChild(notesEl);
    cellEl.appendChild(valEl);
    board.appendChild(cellEl);

    cells.push({ el: cellEl, val: valEl, notes: noteSpans });
  }

  /* 数字键盘 */
  var padButtons = [];
  if (padEl) {
    for (var d = 1; d <= 9; d++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.digit = String(d);
      btn.innerHTML = d + '<span class="n">9</span>';
      padEl.appendChild(btn);
      padButtons.push(btn);
    }
  }

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

  function badCells() {
    var bad = {};
    if (!S.autoCheck || !S.values) return bad;

    // 与答案不符
    for (var i = 0; i < 81; i++) {
      var v = S.values[i];
      if (!v || S.puzzle[i]) continue;
      if (v !== S.solution[i]) bad[i] = true;
    }

    // 同行 / 同列 / 同宫内重复
    function scan(list) {
      var seen = {};
      for (var k = 0; k < 9; k++) {
        var idx = list[k];
        var val = S.values[idx];
        if (!val) continue;
        if (seen[val] !== undefined) {
          bad[idx] = true;
          bad[seen[val]] = true;
        } else {
          seen[val] = idx;
        }
      }
    }

    for (var u = 0; u < 9; u++) {
      scan(unitMap.rows[u]);
      scan(unitMap.cols[u]);
      scan(unitMap.boxes[u]);
    }
    return bad;
  }

  function render() {
    if (!S.values) return;

    var bad = badCells();
    var sel = S.selected;
    var selVal = sel >= 0 ? S.values[sel] : 0;
    var sR = sel >= 0 ? rowOf(sel) : -1;
    var sC = sel >= 0 ? colOf(sel) : -1;
    var sB = sel >= 0 ? boxOf(sel) : -1;

    for (var idx = 0; idx < 81; idx++) {
      var cell = cells[idx];
      var v = S.values[idx];
      var cl = cell.el.classList;

      cell.val.textContent = v ? String(v) : "";

      cl.toggle("has-value", !!v);
      cl.toggle("is-given", !!S.puzzle[idx]);
      cl.toggle("is-hint", S.hintCells.has(idx));
      cl.toggle("is-error", !!bad[idx]);

      var isPeer =
        sel >= 0 &&
        idx !== sel &&
        (rowOf(idx) === sR || colOf(idx) === sC || boxOf(idx) === sB);
      var isSame = selVal > 0 && v === selVal && idx !== sel;
      cl.toggle("is-peer", isPeer && !isSame);
      cl.toggle("is-same", isSame);
      cl.toggle("is-sel", idx === sel);

      // 笔记
      if (!v) {
        var mask = S.notes[idx];
        for (var k = 0; k < 9; k++) {
          cell.notes[k].className = mask & (1 << (k + 1)) ? "on" : "";
        }
      }
    }

    // 数字键盘剩余数量
    var counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var j = 0; j < 81; j++) {
      if (S.values[j]) counts[S.values[j]]++;
    }
    for (var p = 0; p < padButtons.length; p++) {
      var left = 9 - counts[p + 1];
      var badge = padButtons[p].querySelector(".n");
      badge.textContent = left > 0 ? String(left) : "✓";
      padButtons[p].classList.toggle("is-done", left <= 0);
    }
  }

  function updateStats() {
    if (elTime) elTime.textContent = fmtTime(S.seconds);
    if (elMistakes) elMistakes.textContent = String(S.mistakes);
    if (elHints) elHints.textContent = String(S.hints);
  }

  function updateBestLabel() {
    if (!elBest) return;
    var raw = readLS(BEST_PREFIX + S.difficulty);
    elBest.textContent = raw ? "最佳 " + fmtTime(Number(raw)) : "最佳 --:--";
  }

  function updateNotesUI() {
    if (notesBtn) {
      notesBtn.classList.toggle("is-on", S.notesMode);
      notesBtn.setAttribute("aria-pressed", S.notesMode ? "true" : "false");
    }
    if (notesState) notesState.textContent = S.notesMode ? "开" : "关";
  }

  function updateDifficultyUI() {
    if (!difficultyGroup) return;
    var btns = difficultyGroup.querySelectorAll("button");
    for (var k = 0; k < btns.length; k++) {
      btns[k].classList.toggle("is-active", btns[k].dataset.difficulty === S.difficulty);
    }
  }

  /* =======================================================
     4. 存档
     ======================================================= */

  function save() {
    if (!S.puzzle || S.loading) return;
    writeLS(
      STATE_KEY,
      JSON.stringify({
        difficulty: S.difficulty,
        puzzle: Array.prototype.slice.call(S.puzzle),
        solution: Array.prototype.slice.call(S.solution),
        values: Array.prototype.slice.call(S.values),
        notes: Array.prototype.slice.call(S.notes),
        mistakes: S.mistakes,
        hints: S.hints,
        seconds: S.seconds,
        solved: S.solved
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
      !data.puzzle ||
      data.puzzle.length !== 81 ||
      !data.solution ||
      data.solution.length !== 81 ||
      !data.values ||
      data.values.length !== 81 ||
      !data.notes ||
      data.notes.length !== 81 ||
      data.solved
    ) {
      return false;
    }

    S.difficulty = DIFFICULTIES[data.difficulty] ? data.difficulty : "medium";
    S.puzzle = Uint8Array.from(data.puzzle);
    S.solution = Uint8Array.from(data.solution);
    S.values = Uint8Array.from(data.values);
    S.notes = Int32Array.from(data.notes);
    S.mistakes = data.mistakes | 0;
    S.hints = data.hints | 0;
    S.seconds = data.seconds | 0;
    S.hintCells = new Set();
    S.history = [];
    S.selected = -1;
    S.solved = false;
    S.paused = false;
    return true;
  }

  /* =======================================================
     5. 游戏流程
     ======================================================= */

  var genToken = 0;

  function newGame(difficulty) {
    var diff = DIFFICULTIES[difficulty] ? difficulty : S.difficulty || "medium";
    var token = ++genToken;
    S.difficulty = diff;
    S.loading = true;
    board.classList.add("is-loading");

    updateDifficultyUI();
    updateBestLabel();

    // 让 loading 状态先渲染出来，再执行同步计算
    window.setTimeout(function () {
      if (token !== genToken) return;

      var p = generatePuzzle(diff);

      S.puzzle = p.puzzle;
      S.solution = p.solution;
      S.values = Uint8Array.from(p.puzzle);
      S.notes = new Int32Array(81);
      S.hintCells = new Set();
      S.history = [];
      S.selected = -1;
      S.notesMode = false;
      S.mistakes = 0;
      S.hints = 0;
      S.seconds = 0;
      S.solved = false;
      S.paused = false;
      S.loading = false;

      board.classList.remove("is-loading", "is-solved");
      if (overlay) overlay.hidden = true;
      if (pauseLayer) pauseLayer.hidden = true;
      if (pauseLabel) pauseLabel.textContent = "暂停";

      updateNotesUI();
      render();
      updateStats();
      save();
    }, 40);
  }

  function selectCell(idx) {
    if (idx < 0 || idx > 80 || S.paused) return;
    S.selected = idx;
    render();
  }

  function setValue(idx, digit) {
    if (S.solved || S.paused || S.loading) return;
    if (idx < 0 || idx > 80) return;
    if (S.puzzle[idx]) return; // 题面数字不可修改

    var beforeV = S.values[idx];
    var beforeN = S.notes[idx];

    if (S.notesMode && digit > 0) {
      S.values[idx] = 0;
      S.notes[idx] ^= 1 << digit;
    } else if (digit === 0) {
      S.values[idx] = 0;
      S.notes[idx] = 0;
    } else if (S.values[idx] === digit) {
      S.values[idx] = 0; // 再点一次同一个数字 = 取消
    } else {
      S.values[idx] = digit;
      S.notes[idx] = 0;
    }

    if (S.values[idx] === beforeV && S.notes[idx] === beforeN) return;

    S.history.push({ i: idx, v: beforeV, n: beforeN });
    if (S.history.length > 300) S.history.shift();

    // 错误计数（仅在开启自动校验、且填写了错误答案时）
    if (
      S.autoCheck &&
      !S.notesMode &&
      S.values[idx] > 0 &&
      S.values[idx] !== S.solution[idx]
    ) {
      S.mistakes++;
      cells[idx].el.classList.add("shake");
      window.setTimeout(function () {
        cells[idx].el.classList.remove("shake");
      }, 320);
    }

    S.hintCells.delete(idx);
    render();
    updateStats();
    save();
    checkWin();
  }

  function erase() {
    if (S.selected < 0) return;
    setValue(S.selected, 0);
  }

  function undo() {
    if (S.solved || S.paused || !S.history.length) return;
    var last = S.history.pop();
    S.values[last.i] = last.v;
    S.notes[last.i] = last.n;
    S.selected = last.i;
    render();
    save();
  }

  function hint() {
    if (S.solved || S.paused || S.loading) return;

    var empty = [];
    for (var j = 0; j < 81; j++) {
      if (!S.values[j]) empty.push(j);
    }
    if (!empty.length) {
      for (var k = 0; k < 81; k++) {
        if (S.values[k] !== S.solution[k]) empty.push(k);
      }
    }
    if (!empty.length) return;

    var idx = empty[Math.floor(Math.random() * empty.length)];
    S.history.push({ i: idx, v: S.values[idx], n: S.notes[idx] });
    if (S.history.length > 300) S.history.shift();
    S.values[idx] = S.solution[idx];
    S.notes[idx] = 0;
    S.hintCells.add(idx);
    S.hints++;
    S.selected = idx;

    render();
    updateStats();
    save();
    checkWin();
  }

  function toggleNotes() {
    if (S.solved) return;
    S.notesMode = !S.notesMode;
    updateNotesUI();
  }

  function togglePause() {
    if (S.solved || S.loading) return;
    S.paused = !S.paused;
    if (pauseLayer) pauseLayer.hidden = !S.paused;
    if (pauseLabel) pauseLabel.textContent = S.paused ? "继续" : "暂停";
    if (!S.paused) save();
  }

  function isComplete() {
    for (var j = 0; j < 81; j++) {
      if (S.values[j] !== S.solution[j]) return false;
    }
    return true;
  }

  function checkWin() {
    if (S.solved || !isComplete()) return;

    S.solved = true;
    S.paused = false;
    board.classList.add("is-solved");
    if (pauseLayer) pauseLayer.hidden = true;

    // 记录最佳成绩
    var key = BEST_PREFIX + S.difficulty;
    var prev = readLS(key);
    var isRecord = !prev || S.seconds < Number(prev);
    if (isRecord) writeLS(key, String(S.seconds));
    updateBestLabel();

    save();

    window.setTimeout(function () {
      if (!overlay) return;
      var d = overlay.querySelector("[data-win-diff]");
      var t = overlay.querySelector("[data-win-time]");
      var m = overlay.querySelector("[data-win-mistakes]");
      var h = overlay.querySelector("[data-win-hints]");
      var rec = overlay.querySelector("[data-win-record]");

      if (d) d.textContent = DIFFICULTIES[S.difficulty].label;
      if (t) t.textContent = fmtTime(S.seconds);
      if (m) m.textContent = String(S.mistakes);
      if (h) h.textContent = String(S.hints);
      if (rec) rec.hidden = !isRecord;

      overlay.hidden = false;
    }, 420);
  }

  /* =======================================================
     6. 交互绑定
     ======================================================= */

  board.addEventListener("click", function (e) {
    var cell = e.target.closest(".cell");
    if (!cell) return;
    selectCell(Number(cell.dataset.i));
  });

  if (padEl) {
    padEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-digit]");
      if (!btn) return;
      var digit = Number(btn.dataset.digit);
      if (S.selected < 0) {
        // 未选中格子时，自动跳到第一个空格
        for (var j = 0; j < 81; j++) {
          if (!S.values[j]) {
            S.selected = j;
            break;
          }
        }
        render();
      }
      setValue(S.selected, digit);
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.dataset.act;

    if (act === "new") newGame(S.difficulty);
    else if (act === "undo") undo();
    else if (act === "erase") erase();
    else if (act === "notes") toggleNotes();
    else if (act === "hint") hint();
    else if (act === "pause") togglePause();
  });

  if (difficultyGroup) {
    difficultyGroup.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-difficulty]");
      if (!btn) return;
      var diff = btn.dataset.difficulty;
      if (diff === S.difficulty && !S.solved) return;

      var started = false;
      if (S.values) {
        for (var j = 0; j < 81; j++) {
          if (!S.puzzle[j] && S.values[j]) {
            started = true;
            break;
          }
        }
      }
      if (started && !S.solved) {
        var ok = window.confirm("切换难度会开始新的一局，当前进度将丢失，继续吗？");
        if (!ok) return;
      }
      newGame(diff);
    });
  }

  if (autoCheckInput) {
    autoCheckInput.addEventListener("change", function () {
      S.autoCheck = autoCheckInput.checked;
      render();
    });
  }

  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      undo();
      e.preventDefault();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key >= "1" && e.key <= "9") {
      if (S.selected < 0) return;
      setValue(S.selected, Number(e.key));
      e.preventDefault();
      return;
    }

    switch (e.key) {
      case "0":
      case "Backspace":
      case "Delete":
        erase();
        e.preventDefault();
        break;
      case "ArrowUp":
        moveSel(-9);
        e.preventDefault();
        break;
      case "ArrowDown":
        moveSel(9);
        e.preventDefault();
        break;
      case "ArrowLeft":
        moveSel(-1);
        e.preventDefault();
        break;
      case "ArrowRight":
        moveSel(1);
        e.preventDefault();
        break;
      case "n":
      case "N":
        toggleNotes();
        break;
      case "h":
      case "H":
        hint();
        break;
      case "u":
      case "U":
        undo();
        break;
      case "p":
      case "P":
        togglePause();
        break;
      default:
        break;
    }
  });

  function moveSel(delta) {
    if (S.paused) return;
    var cur = S.selected < 0 ? 40 : S.selected;
    var r0 = rowOf(cur),
      c0 = colOf(cur);
    if (delta === -9 || delta === 9) {
      r0 = Math.min(8, Math.max(0, r0 + (delta > 0 ? 1 : -1)));
      S.selected = r0 * 9 + c0;
    } else {
      c0 = Math.min(8, Math.max(0, c0 + (delta > 0 ? 1 : -1)));
      S.selected = r0 * 9 + c0;
    }
    render();
  }

  /* =======================================================
     7. 计时 & 启动
     ======================================================= */

  window.setInterval(function () {
    if (S.loading || S.solved || S.paused || !S.values) return;
    S.seconds++;
    updateStats();
    if (S.seconds % 5 === 0) save();
  }, 1000);

  window.addEventListener("beforeunload", save);

  function boot() {
    var restored = restore();

    updateDifficultyUI();
    updateBestLabel();
    updateNotesUI();

    if (autoCheckInput) {
      S.autoCheck = autoCheckInput.checked;
    }

    if (!restored) {
      newGame("medium");
    } else {
      render();
      updateStats();
    }
  }

  boot();
})();
