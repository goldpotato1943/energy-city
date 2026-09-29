/* 에너지 도시 설계 게임 — 동작 코드 */
(function () {
  "use strict";

  var T = window.EC_TILES, GROUPS = window.EC_GROUPS, MAP = window.EC_MAP, MISSIONS = window.EC_MISSIONS;
  var N = MAP.size, CELLS = N * N;
  var KEY = "ec-v1-";
  var BY_CODE = {};
  Object.keys(T).forEach(function (k) { BY_CODE[T[k].code] = k; });
  var RIVER = {};
  MAP.river.forEach(function (p) { RIVER[p[0] * N + p[1]] = true; });

  var app = document.getElementById("app");
  var topRight = document.getElementById("topRight");
  var modal = document.getElementById("modal"), modalCard = document.getElementById("modalCard");

  var S = { mission: null, grid: [], tool: "house", name: "" };

  /* ---------- 도우미 ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function get(k) { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function rc(i) { return [Math.floor(i / N), i % N]; }
  function isEdge(i) { var p = rc(i); return p[0] === 0 || p[1] === 0 || p[0] === N - 1 || p[1] === N - 1; }
  function nbrs(i) {
    var p = rc(i), out = [];
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
      var r = p[0] + d[0], c = p[1] + d[1];
      if (r >= 0 && c >= 0 && r < N && c < N) out.push(r * N + c);
    });
    return out;
  }
  function nearRiver(i) { return nbrs(i).some(function (j) { return RIVER[j]; }); }
  function homesNear(grid, i) { return nbrs(i).filter(function (j) { return grid[j] === "house" || grid[j] === "apt"; }).length; }
  function sign(n) { return n > 0 ? "+" + n : String(n); }
  function missionIndex(m) { return MISSIONS.indexOf(m); }

  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }

  /* ---------- 계산 ---------- */
  function cellEffect(grid, i) {
    var k = grid[i]; if (!k) return null;
    var t = T[k];
    var e = { pop: t.pop || 0, gen: t.gen || 0, genC: t.gen || 0, use: t.use || 0, co2: t.co2 || 0, happy: t.happy || 0, money: t.money || 0 };
    if (k === "wind") { if (isEdge(i)) e.gen += 4; e.genC = e.gen / 2; }
    if (k === "solar") e.genC = e.gen / 2;
    if (k === "battery") e.genC = 10;
    if (k === "hydro" && !nearRiver(i)) { e.gen = 0; e.genC = 0; }
    var h = homesNear(grid, i);
    if (k === "park") e.happy += 2 * h;
    if (k === "coal") e.happy -= 4 * h;
    if (k === "factory") e.happy -= 2 * h;
    return e;
  }

  function compute(grid, m) {
    var r = { pop: 0, gen: 0, genC: 0, use: 0, co2: 0, happySum: 0, money: 0, spent: 0, count: 0, coalNear: false, windInland: false };
    for (var i = 0; i < CELLS; i++) {
      var e = cellEffect(grid, i); if (!e) continue;
      r.count++;
      r.pop += e.pop; r.gen += e.gen; r.genC += e.genC; r.use += e.use; r.co2 += e.co2; r.happySum += e.happy; r.money += e.money;
      r.spent += T[grid[i]].cost;
      if (grid[i] === "coal" && homesNear(grid, i)) r.coalNear = true;
      if (grid[i] === "wind" && !isEdge(i)) r.windInland = true;
    }
    r.genC = Math.floor(r.genC);
    r.budget = m.budget + r.money;
    r.left = r.budget - r.spent;
    r.powerOk = r.gen >= r.use;
    r.cloudyOk = r.genC >= r.use;
    var h = 50 + r.happySum - Math.floor(r.pop / 25) - (r.powerOk ? 0 : 20);
    r.happy = r.count ? Math.max(0, Math.min(100, h)) : 50;
    var popT = Math.max(1, m.pop);
    r.goals = [
      { id: "pop",   stars: 1, ok: r.pop >= popT,  t: m.pop ? "주민 " + m.pop + "명 이상 살기" : "주민이 사는 도시 만들기" },
      { id: "power", stars: 1, ok: r.powerOk && r.use > 0, t: "전기가 부족하지 않기" },
      { id: "money", stars: 1, ok: r.left >= 0,    t: "예산 안에서 짓기" },
      { id: "co2",   stars: 2, ok: r.co2 <= m.co2, t: "탄소 " + m.co2 + " 이하로 줄이기" },
      { id: "happy", stars: 3, ok: r.happy >= m.happy, t: "주민 행복 " + m.happy + " 이상" },
      { id: "cloudy", stars: 3, ok: r.cloudyOk && r.use > 0, t: "흐린 날에도 전기 충분하기" }
    ];
    if (!r.count) r.goals.forEach(function (g) { g.ok = false; });
    var s1 = r.goals.filter(function (g) { return g.stars === 1; }).every(function (g) { return g.ok; });
    var s2 = s1 && r.goals.filter(function (g) { return g.stars === 2; }).every(function (g) { return g.ok; });
    var s3 = s2 && r.goals.filter(function (g) { return g.stars === 3; }).every(function (g) { return g.ok; });
    r.stars = s3 ? 3 : s2 ? 2 : s1 ? 1 : 0;
    return r;
  }

  function advice(r, m) {
    if (!r.count) return "건물을 고르고 빈 땅을 눌러 보세요! 먼저 주민이 살 🏠 집부터 지어 볼까요?";
    if (r.left < 0) return "💰 돈이 " + (-r.left) + "코인 모자라요! 비싼 건물을 지우거나 ⚙️ 공장을 지어 돈을 벌어요.";
    if (!r.powerOk) return "⚡ 전기가 " + (r.use - r.gen) + " 모자라요! 불이 꺼지면 주민들이 불편해요. 발전소를 지어요.";
    if (r.coalNear) return "🏭 석탄 발전소가 집 옆에 있어서 주민들이 기침을 해요. 멀리 옮겨 볼까요?";
    if (r.pop < Math.max(1, m.pop)) return "👨‍👩‍👧 주민이 " + (Math.max(1, m.pop) - r.pop) + "명 더 필요해요. 🏠 주택이나 🏢 아파트를 지어요.";
    if (r.co2 > m.co2) return "🌫️ 탄소가 목표보다 " + (r.co2 - m.co2) + " 많아요. 🌳 숲, 🚌 버스, 또는 ☀️🌬️💧 깨끗한 발전소로 바꿔 봐요.";
    if (r.happy < m.happy) return "😊 주민 행복을 " + (m.happy - r.happy) + " 더 올려요. 🏫 학교를 짓거나 🌳 공원을 집 옆에 지어요!";
    if (!r.cloudyOk) return "☁️ 흐린 날에는 태양광과 풍력이 절반만 전기를 만들어요. 🔋 전기 저장소나 💧 수력 발전소가 도와줘요.";
    if (r.windInland) return "🎉 목표를 모두 채웠어요! 팁: 🌬️ 풍력은 가장자리에 지으면 전기가 더 나와요.";
    return "🎉 모든 목표를 채웠어요! '도시 완성! 검사받기'를 눌러 보세요.";
  }

  /* ---------- 저장 ---------- */
  function gridStr(g) { return g.map(function (k) { return k ? T[k].code : "."; }).join(""); }
  function parseGrid(s) {
    if (typeof s !== "string" || s.length !== CELLS) return null;
    var g = [];
    for (var i = 0; i < CELLS; i++) {
      var ch = s[i];
      if (ch === ".") g.push(null);
      else if (BY_CODE[ch] && !RIVER[i]) g.push(BY_CODE[ch]);
      else return null;
    }
    return g;
  }
  function saveCity() { put("city-" + S.mission.id, { g: gridStr(S.grid), n: S.name }); }
  function bestStars() { return get("stars") || {}; }
  function setBest(id, n) { var b = bestStars(); if (!b[id] || b[id] < n) { b[id] = n; put("stars", b); } }
  function cityCode() { return missionIndex(S.mission) + ":" + gridStr(S.grid) + (S.name ? ":" + S.name : ""); }

  /* ---------- 시작 화면 ---------- */
  function renderStart() {
    S.mission = null;
    topRight.innerHTML = "";
    var best = bestStars();
    var cards = MISSIONS.map(function (m, i) {
      var b = best[m.id] || 0, st = "";
      for (var k = 1; k <= 3; k++) st += k <= b ? "⭐" : '<span style="opacity:.2">⭐</span>';
      var goal = (m.pop ? "<span>👨‍👩‍👧 " + m.pop + "명</span>" : "") + "<span>💰 " + m.budget + "코인</span><span>🌫️ 탄소 " + m.co2 + " 이하</span>";
      return '<button type="button" class="mission" data-i="' + i + '"><div class="me">' + m.e + '</div><div class="mn">' + esc(m.name) + "</div>" +
        '<div class="muted small">' + esc(m.desc) + '</div><div class="goal">' + goal + '</div><div class="stars">' + st + "</div></button>";
    }).join("");

    app.innerHTML =
      '<section class="card hero">' +
        '<div class="big">🏙️⚡🌳</div>' +
        "<h1>에너지 도시 설계 게임</h1>" +
        "<p>나는 미래도시의 설계자! 정해진 돈으로 <b>집</b>, <b>발전소</b>, <b>숲</b>을 지어서<br>주민들이 <b>전기 걱정 없이</b>, <b>탄소는 적게</b>, <b>행복하게</b> 사는 도시를 만들어요.</p>" +
        '<div class="how"><span>① 건물 고르기</span><span>② 빈 땅 누르기</span><span>③ 목표 채우기</span><span>④ 검사받고 ⭐ 모으기</span></div>' +
      "</section>" +
      '<h2 class="jua" style="margin:0 0 12px;font-size:24px">🎯 미션을 골라요</h2>' +
      '<div class="missions">' + cards + "</div>" +
      '<section class="card loader"><h3>🔑 친구 도시 코드 불러오기</h3>' +
        '<p class="muted small" style="margin:0 0 8px">친구가 보낸 도시 코드를 붙여 넣으면 그 도시를 열어 볼 수 있어요. (그 미션에 있던 내 도시는 바뀌어요)</p>' +
        '<textarea id="codeIn" placeholder="예: 0:....hh..."></textarea>' +
        '<div class="row" style="margin-top:8px"><button type="button" class="secondary" id="loadBtn">불러오기</button></div>' +
        '<p class="msg" id="loadMsg"></p>' +
      "</section>";

    Array.prototype.forEach.call(app.querySelectorAll(".mission"), function (b) {
      b.onclick = function () { startMission(MISSIONS[+b.getAttribute("data-i")]); };
    });
    document.getElementById("loadBtn").onclick = function () {
      var raw = document.getElementById("codeIn").value.trim();
      var m = raw.match(/^(\d+):([^:]+)(?::(.*))?$/);
      var mi = m ? +m[1] : -1, g = m ? parseGrid(m[2]) : null;
      if (!m || !MISSIONS[mi] || !g) {
        var el = document.getElementById("loadMsg");
        el.textContent = "⚠️ 코드가 올바르지 않아요. 처음부터 끝까지 빠짐없이 붙여 넣었는지 확인해 주세요.";
        el.style.color = "var(--warn)";
        return;
      }
      put("city-" + MISSIONS[mi].id, { g: m[2], n: (m[3] || "").slice(0, 16) });
      startMission(MISSIONS[mi]);
      toast("도시를 불러왔어요!");
    };
  }

  /* ---------- 게임 화면 ---------- */
  function startMission(m) {
    S.mission = m;
    var saved = get("city-" + m.id);
    S.grid = (saved && parseGrid(saved.g)) || new Array(CELLS).fill(null);
    S.name = (saved && saved.n) || "";
    S.tool = "house";
    renderPlay();
    window.scrollTo({ top: 0 });
  }

  function renderPlay() {
    var m = S.mission;
    topRight.innerHTML =
      '<span class="pill">' + m.e + " " + esc(m.name) + "</span>" +
      '<button type="button" class="ghost" id="toMissions">🎯 미션 고르기</button>';
    document.getElementById("toMissions").onclick = renderStart;

    var pal = GROUPS.map(function (g) {
      var btns = Object.keys(T).filter(function (k) { return T[k].group === g.id; }).map(function (k) {
        var t = T[k];
        return '<button type="button" class="tbtn" data-k="' + k + '" title="' + esc(t.n) + '"><span class="te">' + t.e + "</span><span>" + esc(t.n) +
          '</span><span class="tc">💰' + t.cost + "</span></button>";
      }).join("");
      return '<div class="pgroup"><p class="pgroup-title">' + g.icon + " " + g.name + '</p><div class="tiles">' + btns + "</div></div>";
    }).join("");

    var cells = "";
    for (var i = 0; i < CELLS; i++) {
      cells += '<button type="button" class="cell' + (RIVER[i] ? " river" : "") + (isEdge(i) && !RIVER[i] ? " edge" : "") + '" data-i="' + i + '"' +
        (RIVER[i] ? ' aria-label="강" tabindex="-1"' : "") + "></button>";
    }

    app.innerHTML =
      '<div class="play">' +
        '<aside class="card palette">' +
          pal +
          '<div class="pgroup"><div class="tiles"><button type="button" class="tbtn erase" data-k="erase"><span class="te">🧹</span><span>지우개</span><span class="tc">돈 돌려받기</span></button></div></div>' +
          '<div class="info" id="info"></div>' +
        "</aside>" +
        '<section class="board-wrap">' +
          '<div class="board-head">' +
            '<input class="name-input" id="cityName" maxlength="16" placeholder="✏️ 우리 도시 이름을 지어 주세요" value="' + esc(S.name) + '" style="max-width:340px">' +
            '<button type="button" class="danger no-print" id="clearAll">🗑️ 모두 지우기</button>' +
          "</div>" +
          '<div class="board" id="board" style="grid-template-columns:repeat(' + N + ',1fr)">' + cells + "</div>" +
          '<div class="legend"><span><i style="background:var(--grass-edge)"></i>가장자리 (바람이 세요)</span><span><i style="background:var(--river)"></i>강</span><span>💡 칸을 다시 누르면 다른 건물로 바뀌어요</span></div>' +
        "</section>" +
        '<aside class="stats" id="stats"></aside>' +
      "</div>";

    Array.prototype.forEach.call(app.querySelectorAll(".tbtn"), function (b) {
      b.onclick = function () { S.tool = b.getAttribute("data-k"); refreshPalette(); refreshBoard(); };
    });
    Array.prototype.forEach.call(app.querySelectorAll(".cell"), function (b) {
      b.onclick = function () { onCell(+b.getAttribute("data-i"), b); };
    });
    document.getElementById("cityName").oninput = function (e) { S.name = e.target.value.trim(); saveCity(); };
    var clr = document.getElementById("clearAll"), armed = false;
    clr.onclick = function () {
      if (!armed) {
        armed = true; clr.classList.add("armed"); clr.textContent = "정말 지울까요? 한 번 더!";
        setTimeout(function () { armed = false; clr.classList.remove("armed"); clr.textContent = "🗑️ 모두 지우기"; }, 3000);
        return;
      }
      S.grid = new Array(CELLS).fill(null); saveCity(); refreshAll(); toast("도시를 비웠어요");
    };
    refreshAll();
  }

  function onCell(i, el) {
    if (RIVER[i]) { toast("🌊 강에는 지을 수 없어요"); return; }
    var m = S.mission, before = compute(S.grid, m);
    var cur = S.grid[i];
    if (S.tool === "erase") {
      if (!cur) return;
      S.grid[i] = null;
    } else {
      if (cur === S.tool) return;
      var t = T[S.tool];
      if (S.tool === "hydro" && !nearRiver(i)) { toast("💧 수력 발전소는 강 바로 옆에만 지을 수 있어요"); return; }
      var refund = cur ? T[cur].cost : 0;
      if (t.cost > before.left + refund && t.cost > 0) { toast("💰 돈이 모자라요! (" + (before.left + refund) + "코인 남음)"); return; }
      S.grid[i] = S.tool;
    }
    var after = compute(S.grid, m);
    saveCity();
    refreshBoard();
    refreshStats(after);
    var cell = document.querySelector('.cell[data-i="' + i + '"]');
    if (cell && S.grid[i]) { cell.classList.remove("placed"); void cell.offsetWidth; cell.classList.add("placed"); }
    floatDelta(el, before, after);
  }

  function floatDelta(el, a, b) {
    var parts = [];
    var dp = b.pop - a.pop, de = (b.gen - b.use) - (a.gen - a.use), dc = b.co2 - a.co2, dh = b.happy - a.happy;
    if (dp) parts.push("👨‍👩‍👧" + sign(dp));
    if (de) parts.push("⚡" + sign(de));
    if (dc) parts.push("🌫️" + sign(dc));
    if (dh) parts.push("😊" + sign(dh));
    if (!parts.length) return;
    var r = el.getBoundingClientRect();
    var f = document.createElement("div");
    f.className = "float"; f.textContent = parts.join("  ");
    f.style.left = (r.left + r.width / 2) + "px"; f.style.top = (r.top - 6) + "px";
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1300);
  }

  function refreshAll() { refreshPalette(); refreshBoard(); refreshStats(compute(S.grid, S.mission)); }

  function refreshPalette() {
    Array.prototype.forEach.call(app.querySelectorAll(".tbtn"), function (b) { b.classList.toggle("on", b.getAttribute("data-k") === S.tool); });
    var info = document.getElementById("info");
    if (S.tool === "erase") {
      info.innerHTML = '<div class="ih">🧹 지우개</div><div>지운 건물의 돈은 모두 돌려받아요. 마음껏 바꿔 보세요!</div>';
      return;
    }
    var t = T[S.tool], fx = [];
    function add(label, v, goodIfPositive) {
      if (!v) return;
      var good = goodIfPositive ? v > 0 : v < 0;
      fx.push('<span class="' + (good ? "good" : "bad") + '">' + label + " " + sign(v) + "</span>");
    }
    add("💰", t.money || 0, true);
    add("👨‍👩‍👧", t.pop || 0, true);
    add("⚡", (t.gen || 0) - (t.use || 0), true);
    add("🌫️ 탄소", t.co2 || 0, false);
    add("😊", t.happy || 0, true);
    info.innerHTML = '<div class="ih">' + t.e + " " + esc(t.n) + ' <span class="muted small">💰' + t.cost + "코인</span></div>" +
      "<div>" + esc(t.desc) + "</div>" +
      (fx.length ? '<div class="effects">' + fx.join("") + "</div>" : "") +
      (t.rule ? '<div class="rule">💡 ' + esc(t.rule) + "</div>" : "");
  }

  function refreshBoard() {
    var tool = S.tool;
    Array.prototype.forEach.call(app.querySelectorAll(".cell"), function (c) {
      var i = +c.getAttribute("data-i");
      if (RIVER[i]) { c.textContent = "🌊"; return; }
      var k = S.grid[i];
      c.textContent = k ? T[k].e : "";
      c.title = k ? T[k].n : "빈 땅";
      c.setAttribute("aria-label", k ? T[k].n : "빈 땅");
      var good = false, bad = false;
      if (!k) {
        if (tool === "wind") good = isEdge(i);
        if (tool === "hydro") { good = nearRiver(i); bad = !good; }
        if (tool === "park") good = homesNear(S.grid, i) > 0;
        if (tool === "coal" || tool === "factory") bad = homesNear(S.grid, i) > 0;
      }
      c.classList.toggle("hint-good", good);
      c.classList.toggle("hint-bad", bad);
      var warn = (k === "coal" && homesNear(S.grid, i) > 0) || (k === "hydro" && !nearRiver(i));
      c.classList.toggle("warn", !!warn);
    });
  }

  function refreshStats(r) {
    var m = S.mission;
    var popT = Math.max(1, m.pop);
    var maxP = Math.max(r.gen, r.use, 1);
    var co2Col = r.co2 <= m.co2 ? "var(--green)" : r.co2 <= m.co2 + 20 ? "var(--sun)" : "var(--warn)";
    var co2W = Math.min(100, Math.max(4, (r.co2 + 20) / 1.2));
    var face = r.happy >= 80 ? "😄" : r.happy >= 60 ? "🙂" : r.happy >= 40 ? "😐" : "😟";
    var hCol = r.happy >= m.happy ? "var(--green)" : r.happy >= 40 ? "var(--sun)" : "var(--warn)";
    var goals = r.goals.map(function (g) {
      return "<li><span>" + (g.ok ? "✅" : "⬜") + "</span><span>" + esc(g.t) + '</span><span class="gs">' + "⭐".repeat(g.stars) + "</span></li>";
    }).join("");

    document.getElementById("stats").innerHTML =
      '<div class="card">' +
        '<div class="meter"><div class="mh"><span class="ml">💰 남은 돈</span><span class="mv ' + (r.left < 0 ? "no" : "") + '">' + r.left + "코인</span></div>" +
          '<div class="track"><div class="fill" style="width:' + Math.max(0, Math.min(100, (r.left / r.budget) * 100)) + '%;background:var(--sun)"></div></div>' +
          '<div class="sub">처음 예산 ' + m.budget + (r.money ? " + 공장 수입 " + r.money : "") + "</div></div>" +

        '<div class="meter"><div class="mh"><span class="ml">👨‍👩‍👧 주민</span><span class="mv">' + r.pop + (m.pop ? " / " + m.pop : "") + "명</span></div>" +
          '<div class="track"><div class="fill" style="width:' + Math.min(100, (r.pop / popT) * 100) + '%;background:var(--blue)"></div></div></div>' +

        '<div class="meter"><div class="mh"><span class="ml">⚡ 전기</span><span class="mv ' + (r.powerOk ? "ok" : "no") + '">' + (r.count ? (r.powerOk ? "넉넉해요" : "부족해요!") : "-") + "</span></div>" +
          '<div class="power-bars">' +
            '<div class="pb"><span>만드는 양</span><div class="track" style="margin:0"><div class="fill" style="width:' + (r.gen / maxP) * 100 + '%;background:var(--green)"></div></div><b>' + r.gen + "</b></div>" +
            '<div class="pb"><span>쓰는 양</span><div class="track" style="margin:0"><div class="fill" style="width:' + (r.use / maxP) * 100 + '%;background:var(--warn)"></div></div><b>' + r.use + "</b></div>" +
          "</div>" +
          '<div class="sub">☁️ 흐린 날: ' + r.genC + " 만들어요 " + (r.use ? (r.cloudyOk ? '<span class="ok">(충분해요)</span>' : '<span class="no">(모자라요)</span>') : "") + "</div></div>" +

        '<div class="meter"><div class="mh"><span class="ml">🌫️ 탄소</span><span class="mv" style="color:' + co2Col + '">' + r.co2 + "</span></div>" +
          '<div class="track"><div class="fill" style="width:' + co2W + "%;background:" + co2Col + '"></div></div>' +
          '<div class="sub">목표: ' + m.co2 + " 이하 · 숲과 초록 시설은 탄소를 줄여요(−)</div></div>" +

        '<div class="meter"><div class="mh"><span class="ml">' + face + " 주민 행복</span><span class=\"mv\">" + r.happy + " / 100</span></div>" +
          '<div class="track"><div class="fill" style="width:' + r.happy + "%;background:" + hCol + '"></div></div>' +
          '<div class="sub">목표: ' + m.happy + " 이상 · 사람이 많아지면 조금씩 줄어요</div></div>" +
      "</div>" +

      '<div class="owl"><span class="oe">🦉</span><p>' + advice(r, m) + "</p></div>" +

      '<div class="card"><h3>🎯 미션 목표</h3><ul class="goals">' + goals + "</ul>" +
        '<button type="button" class="primary check-btn no-print" id="checkBtn">도시 완성! 검사받기 ✅</button></div>';

    document.getElementById("checkBtn").onclick = function () { showResult(compute(S.grid, S.mission)); };
  }

  /* ---------- 결과 ---------- */
  var CHEERS = [
    ["😢", "아직 조금 더 지어야 해요", "⭐ 첫 별을 받으려면 주민, 전기, 예산 목표를 모두 채워요."],
    ["🌱", "도시가 생겼어요!", "이제 탄소를 줄여서 ⭐⭐에 도전해 봐요."],
    ["🌿", "깨끗한 도시예요!", "주민 행복과 흐린 날 전기까지 챙기면 ⭐⭐⭐!"],
    ["🌍", "최고의 미래도시 설계자!", "완벽해요! 친구들에게 도시 코드를 자랑해 보세요."]
  ];

  function showResult(r) {
    var m = S.mission, c = CHEERS[r.stars];
    if (r.stars) setBest(m.id, r.stars);
    var stars = "";
    for (var k = 1; k <= 3; k++) stars += '<span class="' + (k <= r.stars ? "" : "off") + '">⭐</span>';
    var goals = r.goals.map(function (g) {
      return "<li><span>" + (g.ok ? "✅" : "❌") + "</span><span>" + esc(g.t) + '</span><span class="rs">' + "⭐".repeat(g.stars) + "</span></li>";
    }).join("");
    var next = MISSIONS[missionIndex(m) + 1];

    modalCard.innerHTML =
      '<div class="result-top"><div class="result-stars">' + stars + "</div>" +
        "<h2>" + c[0] + " " + c[1] + "</h2>" +
        '<p class="muted">' + (S.name ? "<b>" + esc(S.name) + "</b> · " : "") + esc(c[2]) + "</p></div>" +
      '<div class="summary">' +
        "<div><b>" + r.pop + "명</b>주민</div>" +
        "<div><b>" + r.gen + "/" + r.use + "</b>전기 만듦/씀</div>" +
        "<div><b>" + r.co2 + "</b>탄소</div>" +
        "<div><b>" + r.happy + "</b>행복</div>" +
        "<div><b>" + r.left + "</b>남은 돈</div>" +
      "</div>" +
      '<ul class="rgoals">' + goals + "</ul>" +
      '<div class="no-print"><b class="jua">🔑 우리 도시 코드</b>' +
        '<p class="muted small" style="margin:2px 0 0">이 코드를 친구나 선생님께 보내면 내 도시를 똑같이 열어 볼 수 있어요.</p>' +
        '<div class="codebox" id="code">' + esc(cityCode()) + "</div>" +
        '<button type="button" class="secondary" id="copyCode">📋 코드 복사</button></div>' +
      '<div class="actions">' +
        '<button type="button" class="secondary" id="keep">✏️ 계속 꾸미기</button>' +
        '<button type="button" class="secondary" id="print">🖨️ 인쇄</button>' +
        (next && r.stars ? '<button type="button" class="primary" id="nextM">다음 미션: ' + next.e + " " + esc(next.name) + " 👉</button>" : "") +
      "</div>";
    modal.hidden = false;

    document.getElementById("keep").onclick = closeModal;
    document.getElementById("print").onclick = function () { closeModal(); setTimeout(function () { window.print(); }, 100); };
    document.getElementById("copyCode").onclick = function () {
      var code = document.getElementById("code").textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () { toast("코드를 복사했어요!"); }, function () { toast("코드를 길게 눌러 복사해 주세요"); });
      else toast("코드를 길게 눌러 복사해 주세요");
    };
    var nb = document.getElementById("nextM");
    if (nb) nb.onclick = function () { closeModal(); startMission(next); };
  }
  function closeModal() { modal.hidden = true; }
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  document.getElementById("btnHome").onclick = function () { closeModal(); renderStart(); };
  renderStart();
})();
