(function(){
"use strict";

/* ============ dati ============ */
var KEY = "registro-debiti-v1";
/* alza PRESETS_V di 1 ogni volta che cambi le voci qui sotto:
   al prossimo avvio i prezzi salvati vengono rifatti da questi default. */
var PRESETS_V = 2;
var DEFAULT_PRESETS = [
  {id:"p1", n:"咖啡", c:120},
  {id:"p2", n:"卡普奇诺", c:150},
  {id:"p3", n:"牛角包", c:130},
  {id:"p4", n:"水", c:100},
  {id:"p5", n:"中啤酒", c:250},
  {id:"p6", n:"小啤酒", c:350},
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
    document.getElementById("savedNote").textContent = "Attenzione: questo browser non sta salvando i dati. Fai un backup.";
  }
}

function save(){
  saveLocale();
  if(!applicandoRemoto) inviaModifiche();
}

/* ============ formati ============ */
function cents(c){ return (c/100).toFixed(2).replace(".", ","); }
function eur(c){ return cents(c) + " €"; }
function day(t){
  try{ return new Date(t).toLocaleDateString("it-IT", {day:"2-digit", month:"2-digit"}); }
  catch(err){ return ""; }
}
function total(d){ return d.entries.reduce(function(s,x){ return s + x.c; }, 0); }
function grand(){ return state.debtors.reduce(function(s,d){ return s + total(d); }, 0); }
function nameText(d){ return d.name.type === "text" ? d.name.value : "questa persona"; }

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
    empty.innerHTML = '<div class="namecell" style="grid-column:1/-1"><span class="typed" style="color:var(--ink-soft);font-size:22px">Registro vuoto — aggiungi il primo nome qui sotto.</span></div>';
    frag.appendChild(empty);
  }

  state.debtors.forEach(function(d){
    var t = total(d);
    var row = document.createElement("div");
    row.className = "row" + (t === 0 ? " is-settled" : "");
    row.dataset.id = d.id;

    var nameBtn = document.createElement("button");
    nameBtn.className = "namecell";
    nameBtn.title = "Apri il conto di " + nameText(d);
    nameBtn.setAttribute("aria-label", "Apri il conto di " + nameText(d));
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
        ? '<span class="settled-note">saldato il ' + day(last.t) + " — " + eur(last.c) + "</span>"
        : '<span class="empty">nessun debito</span>';
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
        chip.title = (x.n ? x.n + " — " : "") + day(x.t) + " · tocca per togliere";
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
    add.title = "Segna un debito a " + nameText(d);
    add.setAttribute("aria-label", "Segna un debito a " + nameText(d));
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
    state.debtors.length + (state.debtors.length === 1 ? " persona" : " persone") + " sul registro";
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
          '<button class="btn" data-no>' + (opts.cancel || "Annulla") + "</button>" +
          '<button class="btn ' + (opts.danger ? "danger" : "primary") + '" data-yes data-autofocus>' + (opts.ok || "Conferma") + "</button>" +
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
  var titolo = debtor ? "Riscrivi il nome" : "Nuovo debitore";
  openPanel(
    "<h2>" + titolo + '</h2><p class="sub">Scrivi il nome con il dito o con la penna, come sul quaderno.</p>' +
    '<div class="padwrap"><canvas id="pad"></canvas><div class="padhint" id="padHint">scrivi qui</div></div>' +
    '<div class="padtools">' +
      '<button type="button" id="padUndo">↶ Ultimo tratto</button>' +
      '<button type="button" id="padClear">Cancella tutto</button>' +
      '<button type="button" id="padType">⌨ Usa la tastiera</button>' +
    "</div>" +
    '<div id="typedWrap" hidden style="margin-top:10px">' +
      '<input class="typedinput" id="typedName" placeholder="Nome" maxlength="28" value="' +
        (debtor && debtor.name.type === "text" ? debtor.name.value.replace(/"/g, "&quot;") : "") + '">' +
    "</div>" +
    '<div class="panel-actions">' +
      '<button class="btn" id="padCancel">Annulla</button>' +
      '<button class="btn primary" id="padSave">Salva nome</button>' +
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
        this.textContent = typing ? "✎ Torna a scrivere a mano" : "⌨ Usa la tastiera";
        if(typing) p.querySelector("#typedName").focus();
      });
      p.querySelector("#padCancel").addEventListener("click", closePanel);
      p.querySelector("#padSave").addEventListener("click", function(){
        var name;
        if(typing){
          var v = p.querySelector("#typedName").value.trim();
          if(!v){ toast("Scrivi prima il nome."); return; }
          name = {type:"text", value:v};
        }else{
          if(!strokes.length){ toast("Scrivi il nome sul foglio."); return; }
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
  var etichetta = x.n || (pagamento ? "Pagamento" : "Importo scritto a mano");
  ask({
    lead:
      '<div class="askitem">' +
        '<span class="askitem-name">' + esc(etichetta) + "</span>" +
        '<span class="askitem-amt' + (pagamento ? " paid" : "") + '">' +
          (pagamento ? "− " : "") + cents(Math.abs(x.c)) + " €</span>" +
      "</div>",
    title: pagamento ? "Togliere questo pagamento?" : "Togliere questa voce dal conto?",
    text: "Segnato il " + day(x.t) + ".",
    ok:"Togli", danger:true
  }).then(function(yes){
    if(!yes) return;
    d.entries = d.entries.filter(function(y){ return y.id !== eid; });
    save(); render();
    if(!overlay.hidden && panel.dataset.detail === did) openDetail(did);
  });
}

function openAmount(id){
  var d = byId(id); if(!d) return;
  var added = [];
  var digits = "";

  var presets = state.presets.map(function(p){
    return '<button class="preset" type="button" data-c="' + p.c + '" data-n="' + String(p.n).replace(/"/g,"&quot;") + '">' +
      "<span>" + p.n + "</span><b>" + cents(p.c) + "</b></button>";
  }).join("");

  openPanel(
    "<h2>" + (d.name.type === "text" ? d.name.value : "Segna sul conto") + "</h2>" +
    '<div id="panelName" style="margin:2px 0 8px"></div>' +
    '<p class="sub">Tocca quello che ha preso: si aggiunge subito. Per due caffè, tocca due volte.</p>' +
    '<div class="presets">' + presets + "</div>" +
    '<p class="session" id="sessionLine"></p>' +
    '<div class="divider"></div>' +
    '<button class="btn" type="button" id="amtMore" style="width:100%">Altro importo o pagamento…</button>' +
    '<div id="amtCustom" hidden style="margin-top:12px">' +
    '<div class="amount-display" id="amtDisp">0,00 €</div>' +
    '<div class="keypad">' +
      "<button type='button' data-k='1'>1</button><button type='button' data-k='2'>2</button><button type='button' data-k='3'>3</button>" +
      "<button type='button' data-k='4'>4</button><button type='button' data-k='5'>5</button><button type='button' data-k='6'>6</button>" +
      "<button type='button' data-k='7'>7</button><button type='button' data-k='8'>8</button><button type='button' data-k='9'>9</button>" +
      "<button type='button' data-k='0'>0</button><button type='button' data-k='00'>00</button><button type='button' data-k='del' aria-label='Cancella'>⌫</button>" +
    "</div>" +
    '<div class="panel-actions">' +
      '<button class="btn danger" id="amtDebt">+ Debito</button>' +
      '<button class="btn pay" id="amtPay">− Pagamento</button>' +
    "</div></div>" +
    '<div class="panel-actions"><button class="btn primary" id="amtDone" data-autofocus>Fatto</button></div>',
    function(p){
      paintPanelName(p, d);
      var disp = p.querySelector("#amtDisp");
      var line = p.querySelector("#sessionLine");

      function value(){ return parseInt(digits || "0", 10); }
      function refresh(){
        disp.textContent = eur(value());
        if(!added.length){ line.innerHTML = ""; return; }
        line.innerHTML = "Aggiunto ora: " +
          added.map(function(x){ return (x.c < 0 ? "−" : "") + cents(Math.abs(x.c)); }).join(" + ") +
          ' &nbsp;<button type="button" id="undoAdd" style="background:none;border:0;text-decoration:underline;color:var(--ink-soft);font-family:inherit">annulla ultimo</button>';
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
        if(!value()){ toast("Scrivi prima l'importo."); return; }
        added.push(addEntry(d, value(), ""));
        digits = ""; refresh();
      });
      p.querySelector("#amtPay").addEventListener("click", function(){
        if(!value()){ toast("Scrivi prima l'importo."); return; }
        added.push(addEntry(d, -value(), "Pagamento"));
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
          '<button class="x" data-e="' + x.id + '" aria-label="Togli questa voce">✕</button></li>';
      }).join("")
    : '<li><span class="d">Nessun debito aperto.</span></li>';

  var hist = d.history.length
    ? '<p class="sub" style="margin-top:14px">Saldi precedenti: ' +
        d.history.slice(-6).map(function(h){ return day(h.t) + " (" + cents(h.c) + ")"; }).join(" · ") + "</p>"
    : "";

  openPanel(
    "<h2>" + (d.name.type === "text" ? d.name.value : "Conto") + "</h2>" +
    '<div id="panelName" style="margin:2px 0 8px"></div>' +
    '<p class="sub">Totale: <b style="color:var(--debt);font-family:\'IBM Plex Mono\',monospace">' + eur(t) + "</b></p>" +
    '<ul class="entrylist">' + list + "</ul>" + hist +
    '<div class="stack">' +
      '<button class="btn primary" id="dAdd" data-autofocus>+ Segna un debito</button>' +
      '<button class="btn pay" id="dSettle">Ha pagato tutto — azzera il conto</button>' +
      '<button class="btn" id="dRename">Riscrivi il nome</button>' +
      '<button class="btn danger" id="dDelete">Elimina dal registro</button>' +
      '<button class="btn" id="dClose">Chiudi</button>' +
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
        if(!d.entries.length){ toast("Il conto è già a zero."); return; }
        ask({
          title:"Azzerare il conto?", ok:"Sì, ha pagato",
          text:"Il totale di " + eur(t) + " viene messo nello storico e la riga torna a zero."
        }).then(function(yes){
          if(!yes) return;
          d.history.push({t:Date.now(), c:t});
          d.entries = [];
          save(); render(); closePanel();
          toast("Conto azzerato.");
        });
      });
      p.querySelector("#dDelete").addEventListener("click", function(){
        ask({
          title:"Togliere questa persona dal registro?", ok:"Elimina", danger:true,
          text:"Sparisce il nome e tutto il suo conto. Non si può annullare."
        }).then(function(yes){
          if(!yes) return;
          state.debtors = state.debtors.filter(function(x){ return x.id !== id; });
          save(); render(); closePanel();
        });
      });
    }
  );
}

/* ============ prezzi, backup, ripristino ============ */
function openSettings(focusBackup){
  openPanel(
    "<h2>Prezzi e backup</h2>" +
    '<p class="sub">I prezzi sono i tasti veloci che vedi quando segni un debito.</p>' +
    '<div id="presetEditor"></div>' +
    '<button class="btn" id="addPreset" style="width:100%">+ Aggiungi voce</button>' +
    '<div class="divider"></div>' +
    "<h2>Backup</h2>" +
    '<p class="sub">Copia questo testo e tienilo da parte (email, note). Serve a rimettere tutto a posto se cambi telefono o cancelli i dati del browser.</p>' +
    '<textarea class="backup" id="backupOut" readonly></textarea>' +
    '<div class="panel-actions"><button class="btn" id="copyBackup">Copia il backup</button></div>' +
    '<div class="divider"></div>' +
    "<h2>Ripristino</h2>" +
    '<p class="sub">Incolla qui un backup salvato prima.</p>' +
    '<textarea class="backup" id="backupIn" placeholder="Incolla qui il testo del backup"></textarea>' +
    '<div class="panel-actions"><button class="btn" id="restoreBackup">Ripristina</button></div>' +
    '<div class="divider"></div>' +
    '<div class="panel-actions">' +
      '<button class="btn danger" id="wipeAll">Svuota tutto il registro</button>' +
      '<button class="btn primary" id="setDone">Chiudi</button>' +
    "</div>",
    function(p){
      var ed = p.querySelector("#presetEditor");

      function drawPresets(){
        ed.innerHTML = "";
        state.presets.forEach(function(pr){
          var row = document.createElement("div");
          row.className = "preseted";
          row.innerHTML =
            '<input class="n" value="' + String(pr.n).replace(/"/g,"&quot;") + '" aria-label="Nome voce">' +
            '<input class="p" value="' + cents(pr.c) + '" inputmode="decimal" aria-label="Prezzo">' +
            '<button class="iconbtn" aria-label="Togli voce">✕</button>';
          var inputs = row.querySelectorAll("input");
          inputs[0].addEventListener("change", function(){ pr.n = this.value.trim() || "Voce"; save(); });
          inputs[1].addEventListener("change", function(){
            var v = parseFloat(this.value.replace(",", "."));
            pr.c = isFinite(v) && v > 0 ? Math.round(v * 100) : pr.c;
            this.value = cents(pr.c);
            save();
          });
          row.querySelector("button").addEventListener("click", function(){
            state.presets = state.presets.filter(function(x){ return x.id !== pr.id; });
            save(); drawPresets();
          });
          ed.appendChild(row);
        });
      }
      drawPresets();

      p.querySelector("#addPreset").addEventListener("click", function(){
        state.presets.push({id:uid(), n:"Nuova voce", c:100});
        save(); drawPresets();
      });

      var out = p.querySelector("#backupOut");
      out.value = JSON.stringify(state);
      p.querySelector("#copyBackup").addEventListener("click", function(){
        out.select();
        var done = false;
        try{ done = document.execCommand("copy"); }catch(err){ done = false; }
        if(!done && navigator.clipboard){
          navigator.clipboard.writeText(out.value).then(function(){ toast("Backup copiato."); },
                                                       function(){ toast("Seleziona il testo e copialo a mano."); });
          return;
        }
        toast(done ? "Backup copiato." : "Seleziona il testo e copialo a mano.");
      });

      p.querySelector("#restoreBackup").addEventListener("click", function(){
        var raw = p.querySelector("#backupIn").value.trim();
        if(!raw){ toast("Incolla prima il backup."); return; }
        var data;
        try{ data = JSON.parse(raw); }catch(err){ data = null; }
        if(!data || !Array.isArray(data.debtors)){ toast("Questo testo non è un backup valido."); return; }
        ask({
          title:"Ripristinare il backup?", ok:"Ripristina", danger:true,
          text:"Il registro di adesso viene sostituito da quello del backup (" + data.debtors.length + " persone)."
        }).then(function(yes){
          if(!yes) return;
          if(!Array.isArray(data.presets) || !data.presets.length){ data.presets = DEFAULT_PRESETS.slice(); }
          data.presetsV = PRESETS_V;
          data.debtors.forEach(function(x){ x.entries = x.entries || []; x.history = x.history || []; });
          state = data;
          save(); render(); closePanel();
          toast("Registro ripristinato.");
        });
      });

      p.querySelector("#wipeAll").addEventListener("click", function(){
        ask({
          title:"Svuotare tutto il registro?", ok:"Svuota", danger:true,
          text:"Spariscono tutti i nomi e tutti i conti. Fai prima un backup se ti serve."
        }).then(function(yes){
          if(!yes) return;
          startFresh(false);
          closePanel();
          toast("Registro svuotato.");
        });
      });

      p.querySelector("#setDone").addEventListener("click", closePanel);
      if(focusBackup) p.querySelector("#backupOut").scrollIntoView({block:"center"});
    }
  );
}

/* ============ sincronizzazione fra telefoni ============ */
var SYNC_KEY = "registro-debiti-sync-v1";
var sync = {on:false, codice:null, stato:"spento", offline:false, errore:null};
var ombra = {};

/* Firestore non accetta array dentro array: il nome scritto a mano usa
   strokes come array di array di [x,y,peso], quindi va appiattito in
   oggetti {x,y,w} solo per il viaggio da/verso il database. */
function nomePerFirestore(name){
  if(!name || name.type !== "ink") return name;
  return {
    type:"ink", aspect:name.aspect,
    strokes:(name.strokes || []).map(function(s){
      return s.map(function(p){ return {x:p[0], y:p[1], w:p[2]}; });
    })
  };
}
function nomeDaFirestore(name){
  if(!name || name.type !== "ink") return name;
  return {
    type:"ink", aspect:name.aspect,
    strokes:(name.strokes || []).map(function(s){
      return s.map(function(p){ return [p.x, p.y, p.w]; });
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
      ? "Sincronizzato · ora sei offline, le modifiche partono appena torna la rete."
      : "Sincronizzato con gli altri telefoni · " + sync.codice;
    tasto.style.color = sync.offline ? "var(--ink-soft)" : "var(--paid)";
    tasto.style.borderColor = sync.offline ? "var(--line)" : "var(--paid)";
  }else if(sync.stato === "collegamento"){
    nota.textContent = "Collegamento in corso…";
    tasto.style.color = "var(--ink-soft)";
  }else if(sync.stato === "errore"){
    nota.textContent = "Sincronizzazione ferma — apri ☁ per vedere perché.";
    tasto.style.color = "var(--debt)";
    tasto.style.borderColor = "var(--debt)";
  }else{
    nota.textContent = storageOk ? "I dati restano su questo dispositivo." : "Attenzione: questo browser non salva i dati. Usa il backup.";
    tasto.style.color = "";
    tasto.style.borderColor = "";
  }
}
function connettiSync(codice){
  if(!window.RegistroSync){ toast("Sincronizzazione non disponibile qui."); return; }
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
  if(codice === "accesso_anonimo") return "Firebase rifiuta l'accesso: attiva <b>Authentication → Sign-in method → Anonymous</b> nella console.";
  if(codice === "non_configurato") return "Manca la configurazione: compila <code>firebase-config.js</code> seguendo SINCRONIZZAZIONE.md.";
  if(codice === "permission-denied") return "Le regole di Firestore bloccano la lettura: ricontrolla di averle incollate come da SINCRONIZZAZIONE.md.";
  if(codice === "unavailable") return "Firebase non risponde — probabilmente manca la rete. Il registro intanto funziona lo stesso.";
  return "Firebase non si carica (" + codice + "). Se hai aperto il file direttamente dal telefono, la sincronizzazione funziona solo dal sito.";
}
function openSync(){
  var disponibile = !!(window.RegistroSync && window.RegistroSync.configurata());
  var testa = "<h2>Sincronizzazione</h2>";
  var corpo;

  if(!disponibile){
    corpo = '<p class="sub">Per far vedere lo stesso registro su due telefoni serve un progetto Firebase gratuito: i passaggi sono in <b>SINCRONIZZAZIONE.md</b>, dentro il progetto.</p>' +
      '<p class="sub">Finché non è configurata, ogni telefono tiene il suo registro e si travasa con <b>Backup / Ripristino</b>.</p>' +
      (window.RegistroSync ? "" : '<p class="sub">Nota: funziona solo aprendo il <b>sito</b> (GitHub Pages), non il file scaricato.</p>');
  }else if(sync.stato === "collegato"){
    var link = location.origin + location.pathname + "#r=" + sync.codice;
    corpo =
      '<p class="sub">' + (sync.offline
        ? "Collegato, ma ora <b>senza rete</b>: continua a segnare, parte tutto appena torna la linea."
        : "Questo telefono è <b>collegato</b>. Quello che segni qui compare sull'altro in pochi secondi.") + "</p>" +
      '<p class="sub">Codice del registro:</p>' +
      '<div class="amount-display" style="font-size:17px;text-align:left;word-break:break-all">' + sync.codice + "</div>" +
      '<textarea class="backup" id="syncLink" readonly style="min-height:70px">' + link + "</textarea>" +
      '<div class="panel-actions"><button class="btn" id="syncCopy">Copia il link per l\'altro telefono</button></div>' +
      '<p class="sub">Sull\'altro telefono: apri il link, poi <i>Aggiungi a schermata Home</i>. Chi ha questo link vede e modifica il registro, quindi mandalo solo a chi deve.</p>' +
      '<div class="divider"></div>' +
      '<div class="panel-actions"><button class="btn danger" id="syncOff">Scollega questo telefono</button></div>';
  }else{
    corpo =
      (sync.stato === "errore" ? '<p class="sub" style="color:var(--debt)">' + spiegaErrore(sync.errore) + "</p>" : "") +
      '<p class="sub">Un solo registro condiviso: quello che segna uno lo vede l\'altro. Funziona anche senza rete e si riallinea dopo.</p>' +
      '<div class="stack">' +
        '<button class="btn primary" id="syncNew">Crea il registro condiviso</button>' +
      "</div>" +
      '<div class="divider"></div>' +
      '<p class="sub">Oppure entra in un registro già creato, incollando il codice o il link ricevuto:</p>' +
      '<textarea class="backup" id="syncCode" placeholder="reg-… oppure il link" style="min-height:64px"></textarea>' +
      '<div class="panel-actions"><button class="btn" id="syncJoin">Entra nel registro</button></div>';
  }

  openPanel(testa + corpo + '<div class="panel-actions"><button class="btn primary" id="syncDone" data-autofocus>Chiudi</button></div>',
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
        if(codice.length < 6){ toast("Codice non valido."); return; }
        connettiSync(codice);
      });
      var copia = p.querySelector("#syncCopy");
      if(copia) copia.addEventListener("click", function(){
        var campo = p.querySelector("#syncLink");
        campo.select();
        var fatto = false;
        try{ fatto = document.execCommand("copy"); }catch(err){ fatto = false; }
        if(!fatto && navigator.clipboard){
          navigator.clipboard.writeText(campo.value).then(function(){ toast("Link copiato."); },
                                                         function(){ toast("Seleziona il link e copialo a mano."); });
          return;
        }
        toast(fatto ? "Link copiato." : "Seleziona il link e copialo a mano.");
      });
      var off = p.querySelector("#syncOff");
      if(off) off.addEventListener("click", function(){
        ask({
          title:"Scollegare questo telefono?", ok:"Scollega", danger:true,
          text:"Il registro resta sul telefono e online, ma smettono di aggiornarsi a vicenda. Puoi ricollegarti con lo stesso codice."
        }).then(function(si){ if(si){ scollegaSync(); closePanel(); toast("Telefono scollegato."); } });
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
document.getElementById("btnSettings").addEventListener("click", function(){ openSettings(false); });
document.getElementById("btnBackupFoot").addEventListener("click", function(){ openSettings(true); });
document.getElementById("btnPrint").addEventListener("click", function(){ window.print(); });
document.getElementById("btnSync").addEventListener("click", openSync);
if(!storageOk){
  document.getElementById("savedNote").textContent = "Attenzione: questo browser non salva i dati. Usa il backup.";
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
