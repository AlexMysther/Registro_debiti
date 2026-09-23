(function(){
"use strict";

/* ============ dati ============ */
var KEY = "registro-debiti-v1";
/* alza PRESETS_V di 1 ogni volta che cambi le voci qui sotto:
   al prossimo avvio i prezzi salvati vengono rifatti da questi default. */
var PRESETS_V = 3;
/* sezioni dei tasti veloci: l'ordine qui e' l'ordine con cui compaiono */
var CATEGORIE = [
  {id:"caffe", n:"咖啡"},
  {id:"bibite", n:"饮料"},
  {id:"birre", n:"啤酒"},
  {id:"cocktail", n:"鸡尾酒"},
  {id:"cibo", n:"食物"}
];
var DEFAULT_PRESETS = [
  {id:"p1", n:"咖啡", c:120, cat:"caffe"},
  {id:"p2", n:"卡普奇诺", c:150, cat:"caffe"},
  {id:"p3", n:"牛角包", c:130, cat:"cibo"},
  {id:"p4", n:"水", c:100, cat:"bibite"},
  {id:"p5", n:"中啤酒", c:250, cat:"birre"},
  {id:"p6", n:"小啤酒", c:350, cat:"birre"},
];

var state = null;
var storageOk = true;
var presetsRinnovati = false;

function esc(t){
  return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-3); }

function emptyState(){
  return { v:1, presetsV:PRESETS_V, presets:DEFAULT_PRESETS.slice(), debtors:[] };
}

function load(){
  try{
    var raw = localStorage.getItem(KEY);
    if(raw){
      var d = JSON.parse(raw);
      if(d && Array.isArray(d.debtors)){
        if(!Array.isArray(d.presets) || !d.presets.length || d.presetsV !== PRESETS_V){
          d.presets = DEFAULT_PRESETS.slice();
          d.presetsV = PRESETS_V;
          presetsRinnovati = true;
        }
        d.debtors.forEach(function(x){ x.entries = x.entries || []; x.history = x.history || []; });
        return d;
      }
    }
  }catch(err){ storageOk = false; }
  return emptyState();
}

var applicandoRemoto = false;

function saveLocale(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(err){
    storageOk = false;
    document.getElementById("savedNote").textContent = "注意：此浏览器没有保存数据，请做备份。";
  }
}

function save(){
  saveLocale();
  if(!applicandoRemoto) inviaModifiche();
}

/* ============ formati ============ */
function cents(c){ return (c/100).toFixed(2); }
function eur(c){ return cents(c) + " €"; }
function day(t){
  try{ return new Date(t).toLocaleDateString("zh-CN", {day:"2-digit", month:"2-digit"}); }
  catch(err){ return ""; }
}
function total(d){ return d.entries.reduce(function(s,x){ return s + x.c; }, 0); }
function grand(){ return state.debtors.reduce(function(s,d){ return s + total(d); }, 0); }
function nameText(d){ return d.name.type === "text" ? d.name.value : "这个人"; }

/* ============ scrittura a mano ============ */
function inkColor(){
  var v = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  return v || "#1B2A4A";
}
function paintInk(cv, ink, H){
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  var W = Math.max(10, ink.aspect * H);
  cv.width  = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + "px";
  var ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = ctx.fillStyle = inkColor();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ink.strokes.forEach(function(s){
    if(s.length === 1){
      ctx.beginPath();
      ctx.arc(s[0][0]*H, s[0][1]*H, Math.max(0.7, s[0][2]*H/2), 0, Math.PI*2);
      ctx.fill();
      return;
    }
    for(var i=1;i<s.length;i++){
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.8, (s[i-1][2] + s[i][2])/2 * H);
      ctx.moveTo(s[i-1][0]*H, s[i-1][1]*H);
      ctx.lineTo(s[i][0]*H, s[i][1]*H);
      ctx.stroke();
    }
  });
}

function paintPanelName(p, d){
  var host = p.querySelector("#panelName");
  if(!host || d.name.type !== "ink") return;
  var cv = document.createElement("canvas");
  cv.style.display = "block";
  cv.style.height = "auto";
  cv.style.maxWidth = "100%";
  host.appendChild(cv);
  paintInk(cv, d.name, 44);
}

/* ============ righe del registro ============ */
var rowsEl = document.getElementById("rows");

function render(){
  var frag = document.createDocumentFragment();

  if(!state.debtors.length){
    var empty = document.createElement("div");
    empty.className = "row";
    empty.style.backgroundImage = "none";
    empty.innerHTML = '<div class="namecell" style="grid-column:1/-1"><span class="typed" style="color:var(--ink-soft);font-size:22px">账本是空的——请在下方添加第一个名字。</span></div>';
    frag.appendChild(empty);
  }

  state.debtors.forEach(function(d){
    var t = total(d);
    var row = document.createElement("div");
    row.className = "row" + (t === 0 ? " is-settled" : "");
    row.dataset.id = d.id;

    var nameBtn = document.createElement("button");
    nameBtn.className = "namecell";
    nameBtn.title = "打开" + nameText(d) + "的账单";
    nameBtn.setAttribute("aria-label", "打开" + nameText(d) + "的账单");
    if(d.name.type === "ink"){
      var cv = document.createElement("canvas");
      nameBtn.appendChild(cv);
      paintInk(cv, d.name, 38);
    }else{
      var sp = document.createElement("span");
      sp.className = "typed";
      sp.textContent = d.name.value;
      nameBtn.appendChild(sp);
    }
    nameBtn.addEventListener("click", function(){ openDetail(d.id); });

    var calc = document.createElement("div");
    calc.className = "calc";
    if(!d.entries.length){
      var last = d.history[d.history.length-1];
      calc.innerHTML = last
        ? '<span class="settled-note">已结清 ' + day(last.t) + " — " + eur(last.c) + "</span>"
        : '<span class="empty">没有欠款</span>';
    }else{
      d.entries.forEach(function(x, i){
        if(i > 0 || x.c < 0){
          var op = document.createElement("span");
          op.className = "op";
          op.textContent = x.c < 0 ? "−" : "+";
          calc.appendChild(op);
        }
        var chip = document.createElement("button");
        chip.className = "chip" + (x.c < 0 ? " pay" : "");
        chip.textContent = cents(Math.abs(x.c));
        chip.title = (x.n ? x.n + " — " : "") + day(x.t) + " · 点击删除";
        chip.addEventListener("click", function(){ removeEntry(d.id, x.id); });
        calc.appendChild(chip);
      });
    }

    var tot = document.createElement("div");
    tot.className = "rowtot" + (t === 0 ? " zero" : "");
    tot.textContent = eur(t);

    var add = document.createElement("button");
    add.className = "addbtn";
    add.textContent = "+";
    add.title = "给" + nameText(d) + "记一笔欠款";
    add.setAttribute("aria-label", "给" + nameText(d) + "记一笔欠款");
    add.addEventListener("click", function(){ openAmount(d.id); });

    row.appendChild(nameBtn); row.appendChild(calc); row.appendChild(tot); row.appendChild(add);
    frag.appendChild(row);
  });

  rowsEl.innerHTML = "";
  rowsEl.appendChild(frag);

  var g = grand();
  document.getElementById("grandTotal").textContent = eur(g);
  document.getElementById("sheetTotal").textContent = eur(g);
  document.getElementById("subtitle").textContent =
    "账本上有 " + state.debtors.length + " 人";
}

/* ============ finestre ============ */
var overlay = document.getElementById("overlay");
var panel   = document.getElementById("panel");

function openPanel(html, setup){
  delete panel.dataset.detail;
  delete panel.dataset.sync;
  panel.innerHTML = html;
  overlay.hidden = false;
  if(setup) setup(panel);
  var f = panel.querySelector("[data-autofocus]");
  if(f) f.focus();
}
function closePanel(){ overlay.hidden = true; panel.innerHTML = ""; }
overlay.addEventListener("click", function(e){ if(e.target === overlay) closePanel(); });
document.addEventListener("keydown", function(e){
  if(e.key === "Escape" && !overlay.hidden) closePanel();
});

function ask(opts){
  return new Promise(function(resolve){
    var ov = document.createElement("div");
    ov.className = "overlay";
    ov.style.zIndex = "70";
    ov.innerHTML =
      '<div class="panel" role="dialog" aria-modal="true" style="max-width:420px">' +
        (opts.lead || "") +
        "<h2>" + opts.title + "</h2>" +
        '<p class="sub">' + (opts.text || "") + "</p>" +
        '<div class="panel-actions">' +
          '<button class="btn" data-no>' + (opts.cancel || "取消") + "</button>" +
          '<button class="btn ' + (opts.danger ? "danger" : "primary") + '" data-yes data-autofocus>' + (opts.ok || "确认") + "</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(ov);
    ov.querySelector("[data-autofocus]").focus();
    function done(v){ ov.remove(); resolve(v); }
    ov.querySelector("[data-yes]").addEventListener("click", function(){ done(true); });
    ov.querySelector("[data-no]").addEventListener("click", function(){ done(false); });
    ov.addEventListener("click", function(e){ if(e.target === ov) done(false); });
  });
}

/* password per le azioni che eliminano voci o persone (cambiala qui) */
var PASSWORD_ELIMINA = "1234";
function askPassword(title){
  return new Promise(function(resolve){
    var ov = document.createElement("div");
    ov.className = "overlay";
    ov.style.zIndex = "70";
    ov.innerHTML =
      '<div class="panel" role="dialog" aria-modal="true" style="max-width:420px">' +
        "<h2>" + title + "</h2>" +
        '<p class="sub">请输入密码。</p>' +
        '<div style="display:flex;gap:8px">' +
          '<input class="typedinput" id="pwIn" type="password" placeholder="密码" autocomplete="off" style="font-family:inherit;font-size:18px;flex:1;min-width:0">' +
          '<button type="button" class="iconbtn" id="pwEye" aria-label="显示密码" style="flex:none;height:auto;min-height:44px">👁</button>' +
        "</div>" +
        '<p class="sub" id="pwErr" style="color:var(--debt);margin:8px 0 0" hidden>密码错误。</p>' +
        '<div class="panel-actions">' +
          '<button class="btn" data-no>取消</button>' +
          '<button class="btn danger" data-yes>确认</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(ov);
    var inp = ov.querySelector("#pwIn");
    inp.focus();
    function done(v){ ov.remove(); resolve(v); }
    function check(){
      if(inp.value === PASSWORD_ELIMINA){ done(true); return; }
      ov.querySelector("#pwErr").hidden = false;
      inp.value = ""; inp.focus();
    }
    ov.querySelector("#pwEye").addEventListener("click", function(){
      inp.type = inp.type === "password" ? "text" : "password";
      inp.focus();
    });
    inp.addEventListener("keydown", function(e){ if(e.key === "Enter") check(); });
    ov.querySelector("[data-yes]").addEventListener("click", check);
    ov.querySelector("[data-no]").addEventListener("click", function(){ done(false); });
    ov.addEventListener("click", function(e){ if(e.target === ov) done(false); });
  });
}

var toastTimer = null;
function toast(msg){
  var old = document.querySelector(".toast");
  if(old) old.remove();
  var t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.remove(); }, 2600);
}

/* ============ tavoletta di scrittura ============ */
function openPad(debtor){
  var titolo = debtor ? "重写名字" : "新欠款人";
  openPanel(
    "<h2>" + titolo + '</h2><p class="sub">用手指或笔写下名字，就像写在本子上。</p>' +
    '<div class="padwrap"><canvas id="pad"></canvas><div class="padhint" id="padHint">在这里写</div></div>' +
    '<div class="padtools">' +
      '<button type="button" id="padUndo">↶ 撤销上一笔</button>' +
      '<button type="button" id="padClear">全部清除</button>' +
      '<button type="button" id="padType">⌨ 用键盘输入</button>' +
    "</div>" +
    '<div id="typedWrap" hidden style="margin-top:10px">' +
      '<input class="typedinput" id="typedName" placeholder="名字" maxlength="28" value="' +
        (debtor && debtor.name.type === "text" ? debtor.name.value.replace(/"/g, "&quot;") : "") + '">' +
    "</div>" +
    '<div class="panel-actions">' +
      '<button class="btn" id="padCancel">取消</button>' +
      '<button class="btn primary" id="padSave">保存名字</button>' +
    "</div>",
    function(p){
      var cv = p.querySelector("#pad");
      var hint = p.querySelector("#padHint");
      var ctx = cv.getContext("2d");
      var strokes = [], cur = null, lastW = 3.2, cssH = 190, typing = false;
      var BASE = 3.4;

      function size(){
        if(!cv.isConnected){ window.removeEventListener("resize", size); return; }
        var r = cv.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 3);
        cssH = r.height;
        cv.width  = Math.round(r.width * dpr);
        cv.height = Math.round(r.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
      }
      function redraw(){
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = ctx.fillStyle = inkColor();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        strokes.forEach(function(s){
          if(s.length === 1){
            ctx.beginPath(); ctx.arc(s[0][0], s[0][1], Math.max(0.8, s[0][2]/2), 0, Math.PI*2); ctx.fill();
            return;
          }
          for(var i=1;i<s.length;i++){
            ctx.beginPath();
            ctx.lineWidth = Math.max(0.8, (s[i-1][2] + s[i][2]) / 2);
            ctx.moveTo(s[i-1][0], s[i-1][1]);
            ctx.lineTo(s[i][0], s[i][1]);
            ctx.stroke();
          }
        });
        hint.hidden = strokes.length > 0;
      }
      function pos(e){
        var r = cv.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      }
      function widthFor(e, p){
        var w;
        if(e.pointerType === "pen" && e.pressure > 0){
          w = BASE * (0.45 + e.pressure * 1.1);
        }else{
          var prev = cur && cur[cur.length-1];
          var d = prev ? Math.hypot(p[0]-prev[0], p[1]-prev[1]) : 0;
          w = BASE * Math.max(0.5, Math.min(1.3, 1.25 - d/26));
        }
        lastW = lastW + (w - lastW) * 0.5;
        return lastW;
      }
      cv.addEventListener("pointerdown", function(e){
        e.preventDefault();
        cv.setPointerCapture(e.pointerId);
        var p = pos(e);
        lastW = BASE;
        cur = [[p[0], p[1], widthFor(e, p)]];
        strokes.push(cur);
        redraw();
      });
      cv.addEventListener("pointermove", function(e){
        if(!cur) return;
        e.preventDefault();
        var p = pos(e);
        var prev = cur[cur.length-1];
        if(Math.hypot(p[0]-prev[0], p[1]-prev[1]) < 1.1) return;
        var w = widthFor(e, p);
        cur.push([p[0], p[1], w]);
        ctx.strokeStyle = inkColor();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.lineWidth = Math.max(0.8, (prev[2] + w) / 2);
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      });
      function end(){ cur = null; }
      cv.addEventListener("pointerup", end);
      cv.addEventListener("pointercancel", end);
      cv.addEventListener("pointerleave", end);

      p.querySelector("#padUndo").addEventListener("click", function(){ strokes.pop(); redraw(); });
      p.querySelector("#padClear").addEventListener("click", function(){ strokes = []; redraw(); });
      p.querySelector("#padType").addEventListener("click", function(){
        typing = !typing;
        p.querySelector("#typedWrap").hidden = !typing;
        p.querySelector(".padwrap").hidden = typing;
        p.querySelector("#padUndo").hidden = typing;
        p.querySelector("#padClear").hidden = typing;
        this.textContent = typing ? "✎ 改为手写" : "⌨ 用键盘输入";
        if(typing) p.querySelector("#typedName").focus();
      });
      p.querySelector("#padCancel").addEventListener("click", closePanel);
      p.querySelector("#padSave").addEventListener("click", function(){
        var name;
        if(typing){
          var v = p.querySelector("#typedName").value.trim();
          if(!v){ toast("请先写名字。"); return; }
          name = {type:"text", value:v};
        }else{
          if(!strokes.length){ toast("请在纸上写名字。"); return; }
          name = normalize(strokes, cssH);
        }
        if(debtor){
          debtor.name = name;
        }else{
          state.debtors.push({id:uid(), name:name, entries:[], history:[]});
        }
        save(); render(); closePanel();
      });

      size();
      window.addEventListener("resize", size, {passive:true});
    }
  );
}

function normalize(strokes, cssH){
  var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  strokes.forEach(function(s){
    s.forEach(function(p){
      minx = Math.min(minx, p[0] - p[2]/2); maxx = Math.max(maxx, p[0] + p[2]/2);
      miny = Math.min(miny, p[1] - p[2]/2); maxy = Math.max(maxy, p[1] + p[2]/2);
    });
  });
  var h = Math.max(maxy - miny, Math.max(12, cssH * 0.12));
  var w = Math.max(maxx - minx, 6);
  var r3 = function(n){ return Math.round(n * 1000) / 1000; };
  return {
    type:"ink",
    aspect: Math.min(r3(w / h), 14),
    strokes: strokes.map(function(s){
      return s.map(function(p){ return [r3((p[0]-minx)/h), r3((p[1]-miny)/h), r3(p[2]/h)]; });
    })
  };
}

/* ============ scrivere gli importi ============ */
function byId(id){
  for(var i=0;i<state.debtors.length;i++) if(state.debtors[i].id === id) return state.debtors[i];
  return null;
}
function addEntry(d, c, n){
  var entry = {id:uid(), c:c, n:n || "", t:Date.now()};
  d.entries.push(entry);
  save(); render();
  return entry;
}
function removeEntry(did, eid){
  var d = byId(did); if(!d) return;
  var x = null;
  for(var i=0;i<d.entries.length;i++) if(d.entries[i].id === eid) x = d.entries[i];
  if(!x) return;
  var pagamento = x.c < 0;
  var etichetta = x.n || (pagamento ? "付款" : "手动输入的金额");
  ask({
    lead:
      '<div class="askitem">' +
        '<span class="askitem-name">' + esc(etichetta) + "</span>" +
        '<span class="askitem-amt' + (pagamento ? " paid" : "") + '">' +
          (pagamento ? "− " : "") + cents(Math.abs(x.c)) + " €</span>" +
      "</div>",
    title: pagamento ? "删除这笔付款？" : "从账单中删除这一项？",
    text: "记录于 " + day(x.t) + "。",
    ok:"删除", danger:true
  }).then(function(yes){
    if(!yes) return;
    d.entries = d.entries.filter(function(y){ return y.id !== eid; });
    save(); render();
    if(!overlay.hidden && panel.dataset.detail === did) openDetail(did);
  });
}

/* raggruppa i tasti veloci per sezione (Caffè, Bibite, Birre, ...),
   nell'ordine di CATEGORIE; le voci senza una categoria nota finiscono
   in una sezione "Altro" in fondo. */
function presetsPerSezioni(){
  var gruppi = {};
  state.presets.forEach(function(p){
    var cat = p.cat || "altro";
    (gruppi[cat] = gruppi[cat] || []).push(p);
  });
  var note = {};
  function bottoni(items){
    return items.map(function(p){
      return '<button class="preset" type="button" data-c="' + p.c + '" data-n="' + String(p.n).replace(/"/g,"&quot;") + '">' +
        "<span>" + p.n + "</span><b>" + cents(p.c) + "</b></button>";
    }).join("");
  }
  function sezione(nome, items){
    if(!items || !items.length) return "";
    return '<div class="presetgroup"><h3 class="presetcat">' + esc(nome) + '</h3><div class="presets">' + bottoni(items) + "</div></div>";
  }
  var html = "";
  CATEGORIE.forEach(function(c){ note[c.id] = true; html += sezione(c.n, gruppi[c.id]); });
  var resto = [];
  Object.keys(gruppi).forEach(function(k){ if(!note[k]) resto = resto.concat(gruppi[k]); });
  html += sezione("其他", resto);
  return html;
}

function openAmount(id){
  var d = byId(id); if(!d) return;
  var added = [];
  var digits = "";

  var presets = presetsPerSezioni();

  openPanel(
    "<h2>" + (d.name.type === "text" ? d.name.value : "记入账单") + "</h2>" +
    '<div id="panelName" style="margin:2px 0 8px"></div>' +
    '<p class="sub">点击客人拿的东西，会立刻记上。两杯咖啡就点两次。</p>' +
    presets +
    '<p class="session" id="sessionLine"></p>' +
    '<div class="divider"></div>' +
    '<button class="btn" type="button" id="amtMore" style="width:100%">其他金额或付款…</button>' +
    '<div id="amtCustom" hidden style="margin-top:12px">' +
    '<div class="amount-display" id="amtDisp">0,00 €</div>' +
    '<div class="keypad">' +
      "<button type='button' data-k='1'>1</button><button type='button' data-k='2'>2</button><button type='button' data-k='3'>3</button>" +
      "<button type='button' data-k='4'>4</button><button type='button' data-k='5'>5</button><button type='button' data-k='6'>6</button>" +
      "<button type='button' data-k='7'>7</button><button type='button' data-k='8'>8</button><button type='button' data-k='9'>9</button>" +
      "<button type='button' data-k='0'>0</button><button type='button' data-k='00'>00</button><button type='button' data-k='del' aria-label='删除'>⌫</button>" +
    "</div>" +
    '<div class="panel-actions">' +
      '<button class="btn danger" id="amtDebt">+ 欠款</button>' +
      '<button class="btn pay" id="amtPay">− 付款</button>' +
    "</div></div>" +
    '<div class="panel-actions"><button class="btn primary" id="amtDone" data-autofocus>完成</button></div>',
    function(p){
      paintPanelName(p, d);
      var disp = p.querySelector("#amtDisp");
      var line = p.querySelector("#sessionLine");

      function value(){ return parseInt(digits || "0", 10); }
      function refresh(){
        disp.textContent = eur(value());
        if(!added.length){ line.innerHTML = ""; return; }
        line.innerHTML = "刚刚添加：" +
          added.map(function(x){ return (x.c < 0 ? "−" : "") + cents(Math.abs(x.c)); }).join(" + ") +
          ' &nbsp;<button type="button" id="undoAdd" style="background:none;border:0;text-decoration:underline;color:var(--ink-soft);font-family:inherit">撤销上一项</button>';
        line.querySelector("#undoAdd").addEventListener("click", function(){
          var last = added.pop();
          if(!last) return;
          d.entries = d.entries.filter(function(y){ return y.id !== last.id; });
          save(); render(); refresh();
        });
      }

      p.querySelectorAll(".preset").forEach(function(b){
        b.addEventListener("click", function(){
          added.push(addEntry(d, parseInt(b.dataset.c, 10), b.dataset.n));
          refresh();
        });
      });
      p.querySelectorAll(".keypad button").forEach(function(b){
        b.addEventListener("click", function(){
          var k = b.dataset.k;
          if(k === "del") digits = digits.slice(0, -1);
          else if(digits.length < 7) digits = (digits + k).replace(/^0+(?=\d)/, "");
          refresh();
        });
      });
      p.querySelector("#amtDebt").addEventListener("click", function(){
        if(!value()){ toast("请先输入金额。"); return; }
        added.push(addEntry(d, value(), ""));
        digits = ""; refresh();
      });
      p.querySelector("#amtPay").addEventListener("click", function(){
        if(!value()){ toast("请先输入金额。"); return; }
        added.push(addEntry(d, -value(), "付款"));
        digits = ""; refresh();
      });
      p.querySelector("#amtMore").addEventListener("click", function(){
        var box = p.querySelector("#amtCustom");
        box.hidden = !box.hidden;
        this.hidden = !box.hidden ? true : false;
        if(!box.hidden) box.scrollIntoView({block:"nearest"});
      });
      p.querySelector("#amtDone").addEventListener("click", closePanel);
      refresh();
    }
  );
}

/* ============ il conto di una persona ============ */
function openDetail(id){
  var d = byId(id); if(!d) return;
  var t = total(d);
  var list = d.entries.length
    ? d.entries.map(function(x){
        return '<li><span class="d">' + day(x.t) + (x.n ? " · " + x.n : "") + "</span>" +
          '<span class="v' + (x.c < 0 ? " pay" : "") + '">' + (x.c < 0 ? "−" : "") + cents(Math.abs(x.c)) + "</span>" +
          '<button class="x" data-e="' + x.id + '" aria-label="删除此项">✕</button></li>';
      }).join("")
    : '<li><span class="d">没有未结欠款。</span></li>';

  var hist = d.history.length
    ? '<p class="sub" style="margin-top:14px">以前结清：' +
        d.history.slice(-6).map(function(h){ return day(h.t) + " (" + cents(h.c) + ")"; }).join(" · ") + "</p>"
    : "";

  openPanel(
    "<h2>" + (d.name.type === "text" ? d.name.value : "账单") + "</h2>" +
    '<div id="panelName" style="margin:2px 0 8px"></div>' +
    '<p class="sub">合计：<b style="color:var(--debt);font-family:\'IBM Plex Mono\',monospace">' + eur(t) + "</b></p>" +
    '<ul class="entrylist">' + list + "</ul>" + hist +
    '<div class="stack">' +
      '<button class="btn primary" id="dAdd" data-autofocus>+ 记一笔欠款</button>' +
      '<button class="btn pay" id="dSettle">已全部付清——账单清零</button>' +
      '<button class="btn" id="dRename">重写名字</button>' +
      '<button class="btn danger" id="dDelete">从账本中删除</button>' +
      '<button class="btn" id="dClose">关闭</button>' +
    "</div>",
    function(p){
      panel.dataset.detail = id;
      paintPanelName(p, d);
      p.querySelectorAll(".entrylist .x").forEach(function(b){
        b.addEventListener("click", function(){ removeEntry(id, b.dataset.e); });
      });
      p.querySelector("#dAdd").addEventListener("click", function(){ openAmount(id); });
      p.querySelector("#dClose").addEventListener("click", closePanel);
      p.querySelector("#dRename").addEventListener("click", function(){ openPad(d); });
      p.querySelector("#dSettle").addEventListener("click", function(){
        if(!d.entries.length){ toast("账单已经是零。"); return; }
        ask({
          title:"账单清零？", ok:"是，已付清",
          text:"合计 " + eur(t) + " 会记入历史，这一行恢复为零。"
        }).then(function(yes){
          if(!yes) return;
          d.history.push({t:Date.now(), c:t});
          d.entries = [];
          save(); render(); closePanel();
          toast("账单已清零。");
        });
      });
      p.querySelector("#dDelete").addEventListener("click", function(){
        askPassword("从账本中删除这个人？").then(function(ok){
          if(!ok) return;
          state.debtors = state.debtors.filter(function(x){ return x.id !== id; });
          save(); render(); closePanel();
        });
      });
    }
  );
}

/* ============ prezzi, backup, ripristino ============ */
function openSettings(){
  openPanel(
    "<h2>价格</h2>" +
    '<p class="sub">价格是记欠款时看到的快捷按钮。</p>' +
    '<div id="presetEditor"></div>' +
    '<button class="btn" id="addPreset" style="width:100%">+ 添加项目</button>' +
    '<div class="panel-actions sticky">' +
      '<button class="btn primary" id="setDone">关闭</button>' +
    "</div>",
    function(p){
      var ed = p.querySelector("#presetEditor");

      var opzioniCategorie = CATEGORIE.map(function(c){
        return '<option value="' + c.id + '">' + esc(c.n) + "</option>";
      }).join("") + '<option value="altro">其他</option>';

      function drawPresets(){
        ed.innerHTML = "";
        state.presets.forEach(function(pr){
          var row = document.createElement("div");
          row.className = "preseted";
          row.innerHTML =
            '<input class="n" value="' + String(pr.n).replace(/"/g,"&quot;") + '" aria-label="项目名称">' +
            '<input class="p" value="' + cents(pr.c) + '" inputmode="decimal" aria-label="价格">' +
            '<select class="cat" aria-label="分类">' + opzioniCategorie + "</select>" +
            '<button class="iconbtn" aria-label="删除项目">✕</button>';
          var inputs = row.querySelectorAll("input");
          var sel = row.querySelector("select");
          sel.value = pr.cat || "altro";
          inputs[0].addEventListener("change", function(){ pr.n = this.value.trim() || "项目"; save(); });
          inputs[1].addEventListener("change", function(){
            var v = parseFloat(this.value.replace(",", "."));
            pr.c = isFinite(v) && v > 0 ? Math.round(v * 100) : pr.c;
            this.value = cents(pr.c);
            save();
          });
          sel.addEventListener("change", function(){ pr.cat = this.value; save(); });
          row.querySelector("button").addEventListener("click", function(){
            askPassword("删除“" + esc(pr.n) + "”？").then(function(ok){
              if(!ok) return;
              state.presets = state.presets.filter(function(x){ return x.id !== pr.id; });
              save(); drawPresets();
            });
          });
          ed.appendChild(row);
        });
      }
      drawPresets();

      p.querySelector("#addPreset").addEventListener("click", function(){
        state.presets.push({id:uid(), n:"新项目", c:100, cat:"altro"});
        save(); drawPresets();
      });

      p.querySelector("#setDone").addEventListener("click", closePanel);
    }
  );
}

function openBackup(){
  openPanel(
    "<h2>备份</h2>" +
    '<p class="sub">复制这段文字并保存好（邮件、备忘录）。换手机或清除浏览器数据后，可以用它恢复全部内容。</p>' +
    '<textarea class="backup" id="backupOut" readonly></textarea>' +
    '<div class="panel-actions"><button class="btn" id="copyBackup">复制备份</button></div>' +
    '<div class="divider"></div>' +
    "<h2>恢复</h2>" +
    '<p class="sub">在这里粘贴之前保存的备份。</p>' +
    '<textarea class="backup" id="backupIn" placeholder="在这里粘贴备份文字"></textarea>' +
    '<div class="panel-actions"><button class="btn" id="restoreBackup">恢复</button></div>' +
    '<div class="panel-actions sticky">' +
      '<button class="btn danger" id="wipeAll">清空整个账本</button>' +
      '<button class="btn primary" id="setDone">关闭</button>' +
    "</div>",
    function(p){
      var out = p.querySelector("#backupOut");
      out.value = JSON.stringify(state);
      p.querySelector("#copyBackup").addEventListener("click", function(){
        out.select();
        var done = false;
        try{ done = document.execCommand("copy"); }catch(err){ done = false; }
        if(!done && navigator.clipboard){
          navigator.clipboard.writeText(out.value).then(function(){ toast("备份已复制。"); },
                                                       function(){ toast("请选中文字后手动复制。"); });
          return;
        }
        toast(done ? "备份已复制。" : "请选中文字后手动复制。");
      });

      p.querySelector("#restoreBackup").addEventListener("click", function(){
        var raw = p.querySelector("#backupIn").value.trim();
        if(!raw){ toast("请先粘贴备份。"); return; }
        var data;
        try{ data = JSON.parse(raw); }catch(err){ data = null; }
        if(!data || !Array.isArray(data.debtors)){ toast("这段文字不是有效的备份。"); return; }
        ask({
          title:"恢复备份？", ok:"恢复", danger:true,
          text:"当前账本将被备份替换（" + data.debtors.length + " 人）。"
        }).then(function(yes){
          if(!yes) return;
          if(!Array.isArray(data.presets) || !data.presets.length){ data.presets = DEFAULT_PRESETS.slice(); }
          data.presetsV = PRESETS_V;
          data.debtors.forEach(function(x){ x.entries = x.entries || []; x.history = x.history || []; });
          state = data;
          save(); render(); closePanel();
          toast("账本已恢复。");
        });
      });

      p.querySelector("#wipeAll").addEventListener("click", function(){
        ask({
          title:"清空整个账本？", ok:"清空", danger:true,
          text:"所有名字和账单都会消失。如有需要，请先做备份。"
        }).then(function(yes){
          if(!yes) return;
          startFresh(false);
          closePanel();
          toast("账本已清空。");
        });
      });

      p.querySelector("#setDone").addEventListener("click", closePanel);
    }
  );
}

/* ============ sincronizzazione fra telefoni ============ */
var SYNC_KEY = "registro-debiti-sync-v1";
var sync = {on:false, codice:null, stato:"spento", offline:false, errore:null};
var ombra = {};

/* Firestore non accetta array dentro array, a nessun livello: il nome
   scritto a mano usa strokes come array di array di [x,y,peso]. Ogni
   tratto va incapsulato in un oggetto {p:[...]}, così l'array "strokes"
   contiene solo oggetti e non altri array. Solo per il viaggio da/verso
   il database: il disegno e i calcoli in locale restano con gli array. */
function nomePerFirestore(name){
  if(!name || name.type !== "ink") return name;
  return {
    type:"ink", aspect:name.aspect,
    strokes:(name.strokes || []).map(function(s){
      return { p: s.map(function(p){ return {x:p[0], y:p[1], w:p[2]}; }) };
    })
  };
}
function nomeDaFirestore(name){
  if(!name || name.type !== "ink") return name;
  return {
    type:"ink", aspect:name.aspect,
    strokes:(name.strokes || []).map(function(s){
      return (s.p || []).map(function(p){ return [p.x, p.y, p.w]; });
    })
  };
}
function payloadDebitore(d){
  return {name:nomePerFirestore(d.name), entries:d.entries, history:d.history, ord:d.ord || 0};
}
function rifaiOmbra(){
  ombra = {};
  state.debtors.forEach(function(d){ ombra[d.id] = JSON.stringify(payloadDebitore(d)); });
  ombra.__prezzi = JSON.stringify(state.presets);
}
function inviaModifiche(){
  if(!sync.on || !window.RegistroSync) return;
  var presenti = {};
  state.debtors.forEach(function(d){
    if(!d.ord) d.ord = Date.now();
    presenti[d.id] = true;
    var riga = JSON.stringify(payloadDebitore(d));
    if(ombra[d.id] !== riga){
      ombra[d.id] = riga;
      window.RegistroSync.salvaDebitore(d.id, payloadDebitore(d));
    }
  });
  Object.keys(ombra).forEach(function(k){
    if(k === "__prezzi" || presenti[k]) return;
    delete ombra[k];
    window.RegistroSync.eliminaDebitore(k);
  });
  var prezzi = JSON.stringify(state.presets);
  if(ombra.__prezzi !== prezzi){
    ombra.__prezzi = prezzi;
    window.RegistroSync.salvaPrezzi(state.presets);
  }
}
function applicaRemoto(debitori){
  applicandoRemoto = true;
  debitori.forEach(function(d){ d.name = nomeDaFirestore(d.name); });
  /* aggiorna gli oggetti debitore che esistono gia' invece di sostituirli:
     un pannello aperto (es. "segna un debito") tiene in mano il vecchio
     oggetto, e se lo sostituissimo i tap successivi scriverebbero su un
     oggetto ormai staccato dal registro, perdendosi in silenzio. */
  var esistenti = {};
  state.debtors.forEach(function(d){ esistenti[d.id] = d; });
  debitori = debitori.map(function(nuovo){
    var vecchio = esistenti[nuovo.id];
    if(!vecchio) return nuovo;
    vecchio.name = nuovo.name;
    vecchio.entries = nuovo.entries;
    vecchio.history = nuovo.history;
    vecchio.ord = nuovo.ord;
    return vecchio;
  });
  state.debtors = debitori;
  rifaiOmbra();
  saveLocale();
  applicandoRemoto = false;
  render();
}
function ricordaCodice(codice){
  try{ localStorage.setItem(SYNC_KEY, JSON.stringify({codice:codice})); }catch(err){}
}
function aggiornaStatoSync(){
  var nota = document.getElementById("savedNote");
  var tasto = document.getElementById("btnSync");
  if(sync.stato === "collegato"){
    nota.textContent = sync.offline
      ? "已同步 · 现在离线，网络恢复后会自动上传修改。"
      : "已与其他手机同步 · " + sync.codice;
    tasto.style.color = sync.offline ? "var(--ink-soft)" : "var(--paid)";
    tasto.style.borderColor = sync.offline ? "var(--line)" : "var(--paid)";
  }else if(sync.stato === "collegamento"){
    nota.textContent = "正在连接…";
    tasto.style.color = "var(--ink-soft)";
  }else if(sync.stato === "errore"){
    nota.textContent = "同步已停止——点击 ☁ 查看原因。";
    tasto.style.color = "var(--debt)";
    tasto.style.borderColor = "var(--debt)";
  }else{
    nota.textContent = storageOk ? "数据保存在本设备上。" : "注意：此浏览器不保存数据，请使用备份。";
    tasto.style.color = "";
    tasto.style.borderColor = "";
  }
}
function connettiSync(codice){
  if(!window.RegistroSync){ toast("此处无法同步。"); return; }
  sync.stato = "collegamento";
  aggiornaStatoSync();
  window.RegistroSync.connetti(codice, {
    onDati: function(ev){
      sync.on = true; sync.codice = codice; sync.stato = "collegato"; sync.errore = null;
      sync.offline = !!ev.daCache && !ev.inAttesa;
      if(ev.prima){
        try{ localStorage.setItem("registro-debiti-prima-del-sync", JSON.stringify(state)); }catch(err){}
        if(ev.vuoto){
          /* online non c'è ancora niente: ci mettiamo il registro di questo telefono */
          ombra = {};
          inviaModifiche();
          ricordaCodice(codice); aggiornaStatoSync(); render();
          if(!overlay.hidden && panel.dataset.sync === "1") openSync();
          return;
        }
      }
      applicaRemoto(ev.debitori);
      ricordaCodice(codice);
      aggiornaStatoSync();
      if(!overlay.hidden && panel.dataset.sync === "1") openSync();
    },
    onPrezzi: function(prezzi){
      if(presetsRinnovati){
        /* questo telefono ha voci nuove: le manda agli altri invece di riprenderle */
        presetsRinnovati = false;
        ombra.__prezzi = JSON.stringify(prezzi);
        inviaModifiche();
        return;
      }
      state.presets = prezzi;
      ombra.__prezzi = JSON.stringify(prezzi);
      saveLocale();
    },
    onErrore: function(codiceErrore){
      sync.errore = codiceErrore; sync.stato = "errore";
      aggiornaStatoSync();
    }
  }).catch(function(err){
    sync.on = false; sync.stato = "errore";
    sync.errore = (err && err.message) || "sdk";
    aggiornaStatoSync();
    if(!overlay.hidden && panel.dataset.sync === "1") openSync();
  });
}
function scollegaSync(){
  if(window.RegistroSync) window.RegistroSync.disconnetti();
  sync = {on:false, codice:null, stato:"spento", offline:false, errore:null};
  try{ localStorage.removeItem(SYNC_KEY); }catch(err){}
  aggiornaStatoSync();
}
function spiegaErrore(codice){
  if(codice === "accesso_anonimo") return "Firebase 拒绝访问：请在控制台启用 <b>Authentication → Sign-in method → Anonymous</b>。";
  if(codice === "non_configurato") return "缺少配置：请按照 SINCRONIZZAZIONE.md 填写 <code>firebase-config.js</code>。";
  if(codice === "permission-denied") return "Firestore 规则阻止了读取：请检查是否已按 SINCRONIZZAZIONE.md 粘贴规则。";
  if(codice === "unavailable") return "Firebase 没有响应——可能没有网络。账本仍可正常使用。";
  return "Firebase 无法加载（" + codice + "）。如果直接在手机上打开文件，同步只能在网站上使用。";
}
function openSync(){
  var disponibile = !!(window.RegistroSync && window.RegistroSync.configurata());
  var testa = "<h2>同步</h2>";
  var corpo;

  if(!disponibile){
    corpo = '<p class="sub">要在两部手机上看到同一个账本，需要一个免费的 Firebase 项目：步骤在项目中的 <b>SINCRONIZZAZIONE.md</b>。</p>' +
      '<p class="sub">未配置之前，每部手机各有自己的账本，可以用<b>备份 / 恢复</b>转移。</p>' +
      (window.RegistroSync ? "" : '<p class="sub">注意：只有打开<b>网站</b>（GitHub Pages）才能使用，下载的文件不行。</p>');
  }else if(sync.stato === "collegato"){
    var link = location.origin + location.pathname + "#r=" + sync.codice;
    corpo =
      '<p class="sub">' + (sync.offline
        ? "已连接，但现在<b>没有网络</b>：请继续记账，网络恢复后会自动上传。"
        : "这部手机已<b>连接</b>。你在这里记的内容几秒钟后会出现在另一部手机上。") + "</p>" +
      '<p class="sub">账本代码：</p>' +
      '<div class="amount-display" style="font-size:17px;text-align:left;word-break:break-all">' + sync.codice + "</div>" +
      '<textarea class="backup" id="syncLink" readonly style="min-height:70px">' + link + "</textarea>" +
      '<div class="panel-actions"><button class="btn" id="syncCopy">复制给另一部手机的链接</button></div>' +
      '<p class="sub">在另一部手机上：打开链接，然后<i>添加到主屏幕</i>。拿到此链接的人可以查看和修改账本，请只发给需要的人。</p>' +
      '<div class="divider"></div>' +
      '<div class="panel-actions"><button class="btn danger" id="syncOff">断开这部手机</button></div>';
  }else{
    corpo =
      (sync.stato === "errore" ? '<p class="sub" style="color:var(--debt)">' + spiegaErrore(sync.errore) + "</p>" : "") +
      '<p class="sub">共用一个账本：一个人记的，另一个人也能看到。没有网络也能用，恢复后会自动对齐。</p>' +
      '<div class="stack">' +
        '<button class="btn primary" id="syncNew">创建共享账本</button>' +
      "</div>" +
      '<div class="divider"></div>' +
      '<p class="sub">或者粘贴收到的代码或链接，加入已有的账本：</p>' +
      '<textarea class="backup" id="syncCode" placeholder="reg-… 或链接" style="min-height:64px"></textarea>' +
      '<div class="panel-actions"><button class="btn" id="syncJoin">加入账本</button></div>';
  }

  openPanel(testa + corpo + '<div class="panel-actions"><button class="btn primary" id="syncDone" data-autofocus>关闭</button></div>',
    function(p){
      panel.dataset.sync = "1";
      p.querySelector("#syncDone").addEventListener("click", closePanel);
      var neo = p.querySelector("#syncNew");
      if(neo) neo.addEventListener("click", function(){
        connettiSync(window.RegistroSync.nuovoCodice());
      });
      var join = p.querySelector("#syncJoin");
      if(join) join.addEventListener("click", function(){
        var codice = window.RegistroSync.pulisciCodice(p.querySelector("#syncCode").value);
        if(codice.length < 6){ toast("代码无效。"); return; }
        connettiSync(codice);
      });
      var copia = p.querySelector("#syncCopy");
      if(copia) copia.addEventListener("click", function(){
        var campo = p.querySelector("#syncLink");
        campo.select();
        var fatto = false;
        try{ fatto = document.execCommand("copy"); }catch(err){ fatto = false; }
        if(!fatto && navigator.clipboard){
          navigator.clipboard.writeText(campo.value).then(function(){ toast("链接已复制。"); },
                                                         function(){ toast("请选中链接后手动复制。"); });
          return;
        }
        toast(fatto ? "链接已复制。" : "请选中链接后手动复制。");
      });
      var off = p.querySelector("#syncOff");
      if(off) off.addEventListener("click", function(){
        ask({
          title:"断开这部手机？", ok:"断开", danger:true,
          text:"账本会保留在手机和线上，但不再互相更新。你可以用同一个代码重新连接。"
        }).then(function(si){ if(si){ scollegaSync(); closePanel(); toast("已断开。"); } });
      });
    }
  );
}

function startFresh(silent){
  state = {v:1, presetsV:PRESETS_V, presets:state.presets.slice(), debtors:[]};
  save();
  if(!silent) render();
}

/* ============ avvio ============ */
state = load();
/* prezzi appena rifatti dai default: li fissiamo subito, senza aspettare una modifica */
if(presetsRinnovati) saveLocale();
render();

document.getElementById("btnNew").addEventListener("click", function(){ openPad(null); });
document.getElementById("btnSettings").addEventListener("click", function(){ openSettings(); });
document.getElementById("btnBackupFoot").addEventListener("click", function(){ openBackup(); });
document.getElementById("btnPrint").addEventListener("click", function(){ window.print(); });
document.getElementById("btnSync").addEventListener("click", openSync);
if(!storageOk){
  document.getElementById("savedNote").textContent = "注意：此浏览器不保存数据，请使用备份。";
}

/* si riaggancia da solo al registro condiviso: link #r=… o ultimo codice usato */
(function(){
  var daLink = (location.hash || "").match(/#r=([A-Za-z0-9-]+)/);
  var salvato = null;
  try{ salvato = JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); }catch(err){}
  var codice = daLink ? daLink[1] : (salvato && salvato.codice);
  if(!codice) return;
  var vai = function(){ connettiSync(codice); };
  if(window.RegistroSync) vai();
  else window.addEventListener("registro-sync-pronto", vai, {once:true});
})();

/* i nomi scritti a mano seguono il colore del tema */
if(window.matchMedia){
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  var onTheme = function(){ render(); };
  if(mq.addEventListener) mq.addEventListener("change", onTheme);
  else if(mq.addListener) mq.addListener(onTheme);
}
new MutationObserver(function(){ render(); })
  .observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});

})();
