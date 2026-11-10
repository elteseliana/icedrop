/* =====================================================================
   ICE DROP — MAIN SCRIPT
   You normally don't need to edit this file.
   Prices / delivery days → the Google Sheet     Words → js/texts.js
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.ICE_DROP_CONFIG;
  var TEXTS = window.ICE_DROP_TEXTS;
  var FX = window.IceDropFX || { frostIn: function () {}, celebrate: function () {}, reducedMotion: function () { return true; } };
  var LANG_KEY = "icedrop-lang";
  var DEMO = !CFG.googleSheetUrl;

  var lang = "he";
  var S = clone(CFG.fallback);        // settings (replaced by the Sheet's)
  var slots = [];                     // delivery slots from the Sheet
  var slotsState = "loading";         // loading | ok | error
  var order = { choice: "b2", slotId: "", weekly: false };   // choice: "b1".."b4" = bags, or a cooler package id
  var coolerFx = null;
  var lastOrder = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function money(n) { return CFG.currency + (Math.round(n * 100) / 100); }
  function kgText(n) { return String(Math.round(n * 10) / 10); }

  /* ================= Language & texts ================= */
  function loadLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    if (saved === "he" || saved === "en") return saved;
    return CFG.defaultLanguage === "en" ? "en" : "he";
  }
  function saveLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch (e) {} }

  var BRAND_HTML = '<span class="brand" dir="ltr" lang="en">Ice Drop</span>';

  // The makolet comparison numbers, worked out from the prices
  function pitch() {
    var mk = CFG.makolet;
    var bagsForSamePrice = mk.price / S.pricePerBag;            // 12 / 6 = 2 bags
    var ourKg = bagsForSamePrice * S.kgPerBag;                   // 2 × 1.3 = 2.6 kg
    return {
      pct: Math.round((ourKg / mk.kg - 1) * 100),                // 30
      mkKg: kgText(mk.kg), mkPrice: money(mk.price),
      ourKg: kgText(ourKg), ourPrice: money(mk.price)
    };
  }

  function t(key, vars, plain) {
    var s = TEXTS[lang][key];
    if (s == null) s = TEXTS.en[key] != null ? TEXTS.en[key] : key;
    var all = pitch();
    if (vars) for (var k in vars) all[k] = vars[k];
    s = s.replace(/\{(\w+)\}/g, function (m, name) {
      if (name === "brand") return plain ? "Ice Drop" : BRAND_HTML;
      return all[name] != null ? all[name] : m;
    });
    if (!plain && lang === "he") s = s.replace(/(^|[^>])Ice Drop/g, "$1" + BRAND_HTML);
    return s;
  }
  function plainT(key, vars) { return t(key, vars, true).replace(/<[^>]+>/g, ""); }

  function applyTexts() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.title = plainT("pageTitle");
    $all("[data-t]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-t")); });
    $all("[data-ph]").forEach(function (el) { el.placeholder = plainT(el.getAttribute("data-ph")); });
    $all("[data-t-label]").forEach(function (el) { el.setAttribute("aria-label", plainT(el.getAttribute("data-t-label"))); });
    $("#lang-btn").setAttribute("lang", lang === "he" ? "en" : "he");
  }

  function renderAll() {
    applyTexts();
    renderPitch();
    renderPrices();
    renderIceChoices();
    renderSlots();
    renderDeliveryDays();
    updateTotals();
    updateCountdown();
    renderContact();
    if (lastOrder) renderConfirmation(lastOrder);
  }

  /* ================= Prices ================= */
  function pkgById(id) { return S.packages.filter(function (p) { return p.id === id; })[0]; }
  function pkgName(id) { return plainT("pkg_" + id); }
  // Weekly = the prices in the Sheet. One-time = those + the one-time increase (e.g. 20%), whole shekels.
  function up(price, weekly) { return weekly ? price : Math.round(price * (1 + (S.oneTimeMarkup || 0) / 100)); }
  function bagPrice(weekly) { return up(S.pricePerBag, weekly); }
  function bestDealId() {
    var best = null;
    S.packages.forEach(function (p) {
      var save = p.bags * S.pricePerBag - p.price;
      if (save > 0 && (!best || save / (p.bags * S.pricePerBag) > best.r)) best = { id: p.id, r: save / (p.bags * S.pricePerBag) };
    });
    return best && best.id;
  }

  function calc() {
    var bags = 0, pkg = null;
    if (/^b\d+$/.test(order.choice)) bags = Math.min(S.maxBags, parseInt(order.choice.slice(1), 10));
    else pkg = pkgById(order.choice);
    if (!bags && !pkg) { bags = Math.min(2, S.maxBags); order.choice = "b" + bags; }
    var w = order.weekly, unit = bagPrice(w);
    var totalBags = bags + (pkg ? pkg.bags : 0);
    var regular = totalBags * unit;
    var final = bags * unit + (pkg ? up(pkg.price, w) : 0);
    return { bags: bags, cooler: pkg ? pkg.id : "none", totalBags: totalBags, totalKg: totalBags * S.kgPerBag,
             regular: regular, final: final, savings: regular - final, pkg: pkg, weekly: w };
  }

  function renderPitch() {
    var p = pitch();
    $all(".js-mk-kg").forEach(function (el) { el.textContent = p.mkKg; });
    $all(".js-mk-price").forEach(function (el) { el.textContent = p.mkPrice; });
    $all(".js-our-kg").forEach(function (el) { el.textContent = p.ourKg; });
    $all(".js-our-price").forEach(function (el) { el.textContent = p.ourPrice; });
  }

  // Prices as a simple menu: weekly price + one-time price. Tap a row to order it.
  function renderPrices() {
    var best = bestDealId();
    var list = $("#price-list");
    list.innerHTML = "";
    var rows = [{ id: "b1", name: plainT("choiceBag1"), bags: 1, price: S.pricePerBag }].concat(
      S.packages.map(function (p) { return { id: p.id, name: pkgName(p.id), bags: p.bags, price: p.price }; }));
    rows.forEach(function (r) {
      var li = document.createElement("li");
      li.className = "price-row" + (r.id === best ? " is-best" : "");
      li.innerHTML = '<button type="button" class="price-btn">' +
        '<span class="pr-name"></span><span class="pr-detail"></span><span class="pr-dots" aria-hidden="true"></span>' +
        '<span class="pr-price"><b dir="ltr"></b><small></small></span>' +
        '<span class="pr-save"></span></button>';
      li.firstChild.dataset.choice = r.id;
      $(".pr-name", li).textContent = r.name;
      $(".pr-detail", li).textContent = r.bags === 1 ? kgText(S.kgPerBag) + " " + plainT("kg")
        : plainT("pkgDesc", { bags: r.bags, kg: kgText(r.bags * S.kgPerBag) });
      $(".pr-price b", li).textContent = money(r.price);
      $(".pr-price small", li).textContent = plainT("perWeekShort");
      $(".pr-save", li).textContent = plainT("oneTimePrice", { price: money(up(r.price, false)) }) + (r.id === best ? " · " + plainT("bestDeal") : "");
      list.appendChild(li);
    });
  }

  /* ================= Order form: ice ================= */
  // One tap: 1–4 bags, or a cooler package
  function renderIceChoices() {
    var holder = $("#ice-choices");
    holder.innerHTML = "";
    var best = bestDealId();
    var bagRow = document.createElement("div");
    bagRow.className = "ice-row ice-bags";
    for (var n = 1; n <= S.maxBags; n++) {
      bagRow.appendChild(iceOption("b" + n, n === 1 ? plainT("choiceBag1") : plainT("choiceBags", { n: n }),
        kgText(n * S.kgPerBag) + " " + plainT("kg"), n * bagPrice(order.weekly), 0, false));
    }
    holder.appendChild(bagRow);
    var pkgRow = document.createElement("div");
    pkgRow.className = "ice-row ice-pkgs";
    S.packages.forEach(function (p) {
      pkgRow.appendChild(iceOption(p.id, pkgName(p.id), kgText(p.bags * S.kgPerBag) + " " + plainT("kg"),
        up(p.price, order.weekly), p.bags * bagPrice(order.weekly) - up(p.price, order.weekly), p.id === best));
    });
    holder.appendChild(pkgRow);
  }
  function iceOption(value, name, kg, price, save, best) {
    var lab = document.createElement("label");
    lab.className = "ice-opt" + (best ? " is-best" : "");
    lab.innerHTML = '<input type="radio" name="ice"><span class="ice-body">' +
      (best ? '<span class="best-badge"></span>' : "") +
      '<b class="ice-name"></b><small class="ice-kg"></small>' +
      '<span class="ice-price"><b dir="ltr"></b></span></span>';
    var input = $("input", lab);
    input.value = value;
    input.checked = value === order.choice;
    if (best) $(".best-badge", lab).textContent = plainT("bestDeal");
    $(".ice-name", lab).textContent = name;
    $(".ice-kg", lab).textContent = kg;
    $(".ice-price b", lab).textContent = money(price);
    return lab;
  }

  function updateUpsell() {
    var c = calc();
    var next = S.packages.filter(function (p) { return p.bags === c.bags + 1; })[0];
    var show = c.bags === S.maxBags && c.cooler === "none" && next;
    $("#upsell").hidden = !show;
    if (show) {
      var nextPrice = up(next.price, order.weekly), save = next.bags * bagPrice(order.weekly) - nextPrice;
      $(".js-upsell-text").innerHTML = t("upsell", { price: money(nextPrice), save: money(save) });
      $("#upsell-btn").dataset.pkg = next.id;
    }
  }

  var shownKg = 0, kgAnim = null;
  function updateTotals() {
    var c = calc();
    $("#btn-total").textContent = money(c.final) + (c.weekly ? plainT("perWeek") : "");
    $("#savings-line").textContent = c.savings > 0 ? plainT("savingsLine", { save: money(c.savings), name: pkgName(c.cooler) }) : "";
    $("#bags-count").textContent = c.totalBags === 1 ? plainT("readoutBag1") : plainT("readoutBags", { n: c.totalBags });
    $("#own-cooler-wrap").hidden = c.cooler === "none";
    // the kg number counts up / down
    var target = Math.round(c.totalKg * 10) / 10, from = shownKg, t0 = performance.now();
    cancelAnimationFrame(kgAnim);
    (function step(now) {
      var k = FX.reducedMotion() ? 1 : Math.min(1, (now - t0) / 600);
      shownKg = from + (target - from) * (1 - Math.pow(1 - k, 3));
      $("#kg-count").textContent = kgText(shownKg);
      if (k < 1) kgAnim = requestAnimationFrame(step); else shownKg = target;
    })(t0);
    if (coolerFx) coolerFx.set(c.totalBags);
    updateUpsell();
    markSlotFit();
  }

  /* ================= Delivery slots ================= */
  function slotDate(slot, short) {
    var p = slot.date.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
    return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", {
      weekday: short ? "short" : "long", month: lang === "he" ? "long" : "short", day: "numeric", timeZone: "UTC"
    }).format(d);
  }
  function slotLabel(slot, short) {
    return slotDate(slot, short) + (slot.timeWindow ? ", ⁦" + slot.timeWindow.replace("-", "–") + "⁩" : "");
  }
  function slotById(id) { return slots.filter(function (s) { return s.id === id; })[0]; }

  function renderSlots() {
    var holder = $("#slot-list");
    holder.innerHTML = "";
    if (slotsState !== "ok") {
      var msg = document.createElement("p");
      msg.className = "slot-msg";
      msg.textContent = plainT(slotsState === "loading" ? "slotsLoading" : "slotsError");
      holder.appendChild(msg);
      return;
    }
    var open = slots.filter(function (s) { return !s.soldOut; });
    if (!open.length && !slots.length) {
      var none = document.createElement("p");
      none.className = "slot-msg";
      none.textContent = plainT("slotsNone");
      holder.appendChild(none);
    }
    if (order.slotId && !(slotById(order.slotId) || {}).remaining) order.slotId = "";
    if (!order.slotId) {                         // pick the first day that has room
      var need = calc().totalBags;
      var first = slots.filter(function (s) { return !s.soldOut && s.remaining >= need; })[0];
      if (first) order.slotId = first.id;
    }
    slots.forEach(function (s) {
      var lab = document.createElement("label");
      lab.className = "slot-chip" + (s.soldOut ? " is-sold" : "");
      lab.innerHTML = '<input type="radio" name="slot"><span class="slot-body"><b class="slot-day"></b><small class="slot-left"></small></span>';
      var input = $("input", lab);
      input.value = s.id;
      input.disabled = !!s.soldOut;
      input.checked = s.id === order.slotId;
      $(".slot-day", lab).textContent = slotLabel(s, true);
      $(".slot-left", lab).textContent = s.soldOut ? plainT("soldOut") : (s.remaining <= 10 ? plainT("bagsLeft", { n: s.remaining }) : "");
      holder.appendChild(lab);
    });
    if (slots.length && !open.length) {
      var full = document.createElement("p");
      full.className = "slot-msg";
      full.textContent = plainT("slotsNone");
      holder.appendChild(full);
    }
    markSlotFit();
  }

  // Grey out days that don't have room for this many bags
  function markSlotFit() {
    var need = calc().totalBags;
    $all(".slot-chip").forEach(function (lab) {
      var s = slotById($("input", lab).value);
      lab.classList.toggle("too-small", !!(s && !s.soldOut && need > s.remaining));
    });
    var chosen = slotById(order.slotId);
    setError("slot", chosen && need > chosen.remaining ? plainT("slotTooSmall", { n: chosen.remaining }) : "");
  }

  function demoSlots() {
    var out = [], d = new Date(), end = 6 - d.getDay() + 7;          // until the end of next week
    for (var i = 1; i <= end; i++) {
      var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (day.getDay() !== 1 && day.getDay() !== 5) continue;          // Mondays and Fridays
      var iso = day.getFullYear() + "-" + ("0" + (day.getMonth() + 1)).slice(-2) + "-" + ("0" + day.getDate()).slice(-2);
      var win = day.getDay() === 1 ? "16:00-18:00" : "13:30-15:00";
      out.push({ id: iso + "|" + win, date: iso, timeWindow: win, capacity: 30, remaining: 30, soldOut: false });
    }
    return out;
  }

  // "Deliveries: Mon 16:00–18:00 · Fri 13:30–15:00", worked out from the Sheet's delivery days
  function renderDeliveryDays() {
    var el = $(".js-delivery-days");
    if (!el) return;
    var seen = {}, parts = [];
    slots.forEach(function (sl) {
      var p = sl.date.split("-").map(Number);
      var d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
      var name = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", { weekday: "long", timeZone: "UTC" }).format(d);
      var key = d.getUTCDay() + "|" + sl.timeWindow;
      if (seen[key]) return;
      seen[key] = true;
      parts.push({ k: d.getUTCDay(), text: name + (sl.timeWindow ? " \u2066" + sl.timeWindow.replace("-", "\u2013") + "\u2069" : "") });
    });
    parts.sort(function (a, b) { return a.k - b.k; });
    el.hidden = !parts.length;
    el.innerHTML = "";
    if (!parts.length) return;
    var label = document.createElement("b");
    label.textContent = plainT("deliveriesLabel");
    el.appendChild(label);
    el.appendChild(document.createTextNode(" " + parts.map(function (x) { return x.text; }).join(" · ")));
  }

  function loadFromSheet() {
    if (DEMO) {
      console.warn("Ice Drop: googleSheetUrl is empty in js/config.js — demo mode, orders are NOT saved.");
      $("#demo-banner").hidden = false;
      slots = demoSlots();
      slotsState = "ok";
      renderAll();
      return Promise.resolve();
    }
    return fetch(CFG.googleSheetUrl, { method: "GET" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || "bad response");
        for (var k in data.settings) if (data.settings[k] !== "" && data.settings[k] != null) S[k] = data.settings[k];
        slots = data.slots || [];
        slotsState = "ok";
      })
      .catch(function (err) {
        console.warn("Ice Drop: couldn't load the Google Sheet", err);
        slotsState = "error";
      })
      .then(renderAll);
  }

  /* ================= Live countdown to the order cutoff ================= */
  // Israel wall-clock time → real moment (handles summer/winter time)
  function israelToUtc(y, m, d, h, mi) {
    function offset(ms) {
      var p = {};
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hourCycle: "h23", year: "numeric", month: "numeric",
        day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms;
    }
    var guess = Date.UTC(y, m - 1, d, h, mi);
    var res = guess - offset(guess);
    return guess - offset(res);
  }
  function cutoffOf(slot) {
    var p = slot.date.split("-").map(Number), c = String(S.cutoff || "20:00").split(":").map(Number);
    return israelToUtc(p[0], p[1], p[2] - 1, c[0] || 0, c[1] || 0);   // the night before
  }
  var reloading = false;
  function updateCountdown() {
    var els = $all(".js-countdown");
    var next = slotsState === "ok" ? slots.filter(function (s) { return !s.soldOut; })[0] : null;
    if (!next) { els.forEach(function (el) { el.hidden = true; }); return; }
    var left = cutoffOf(next) - Date.now();
    if (left <= 0) {
      if (!reloading) { reloading = true; loadFromSheet().then(function () { reloading = false; }); }
      return;
    }
    var sec = Math.floor(left / 1000), d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600),
        m = Math.floor(sec % 3600 / 60), sc = sec % 60, T = TEXTS[lang];
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var clock = "\u2066" + pad(h) + ":" + pad(m) + ":" + pad(sc) + "\u2069";
    var time = (d === 1 ? T.cdDay1 : d > 1 ? T.cdDays.replace("{n}", d) : "") + clock;
    var html = t("countdown", { day: slotDate(next), time: time });
    els.forEach(function (el) { el.hidden = false; $(".js-countdown-text", el).innerHTML = html; });
  }

  /* ================= Form helpers ================= */
  var form;
  function val(name) {
    var el = form.elements[name];
    if (!el) return "";
    if (!el.tagName) { for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value; return ""; }
    if (el.type === "radio") return el.checked ? el.value : "";
    if (el.type === "checkbox") return el.checked;
    return (el.value || "").trim();
  }

  // Israeli phone: mobile 05X, landline 02/03/04/08/09, 07X, or +972
  function normalizePhone(raw) {
    var d = String(raw || "").replace(/[\s\-().]/g, "");
    if (d.indexOf("+972") === 0) d = "0" + d.slice(4);
    else if (d.indexOf("00972") === 0) d = "0" + d.slice(5);
    else if (d.indexOf("972") === 0 && d.length >= 11) d = "0" + d.slice(3);
    if (/^0(5\d|7\d)\d{7}$/.test(d)) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
    if (/^0[23489]\d{7}$/.test(d)) return d.slice(0, 2) + "-" + d.slice(2, 5) + "-" + d.slice(5);
    return null;
  }

  var ERR_IDS = ["slot", "name", "phone", "street", "payment"];
  function setError(id, msg) {
    var err = $("#err-" + id);
    if (err) err.textContent = msg || "";
    var input = form && form.elements[id];
    if (input && input.tagName) {
      input.classList.toggle("is-invalid", !!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) input.setAttribute("aria-describedby", "err-" + id);
    }
  }
  function clearErrors() {
    ERR_IDS.forEach(function (id) { setError(id, ""); });
    $("#form-error").hidden = true;
  }

  function validate() {
    var ok = true, first = null;
    function fail(id, msg) {
      setError(id, msg);
      ok = false;
      if (!first) first = (form.elements[id] && form.elements[id].tagName) ? form.elements[id] : $("#err-" + id);
    }
    clearErrors();
    var c = calc();
    var slot = slotById(order.slotId);
    if (!slot) fail("slot", plainT("errSlot"));
    else if (c.totalBags > slot.remaining) fail("slot", plainT("slotTooSmall", { n: slot.remaining }));
    if (val("name").length < 2) fail("name", plainT("errName"));
    if (!normalizePhone(val("phone"))) fail("phone", plainT("errPhone"));
    if (!val("street")) fail("street", plainT("errRequired"));
    if (!val("payment")) fail("payment", plainT("errChoose"));
    if (!ok) {
      $("#form-error").hidden = false;
      $("#form-error").textContent = plainT("errSummary");
      if (first) {
        if (first.focus && first.tagName) first.focus();
        else first.scrollIntoView({ block: "center" });
      }
    }
    return ok;
  }

  /* ================= WhatsApp ================= */
  function waIntl(num) {
    var d = String(num || "").replace(/\D/g, "");
    if (d.indexOf("0") === 0) d = "972" + d.slice(1);
    return d;
  }
  function waLink(text) {
    return "https://wa.me/" + waIntl(S.whatsappNumber) + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function itemsText(o, l) {
    var T = TEXTS[l || lang], parts = [];
    if (o.bags === 1) parts.push(T.itemBag1);
    else if (o.bags > 1) parts.push(T.itemBags.replace("{n}", o.bags));
    if (o.cooler !== "none") parts.push(T["pkg_" + o.cooler]);
    return parts.join(" + ") + " (" + T.itemsTotal.replace("{n}", o.totalBags).replace("{kg}", kgText(o.totalKg)) + ")";
  }
  function totalText(o) {
    return money(o.final) + (o.weekly ? plainT("perWeek") : "") + (o.savings > 0 ? " (" + plainT("save", { save: money(o.savings) }) + ")" : "");
  }
  function typeText(o) {
    return o.weekly ? plainT("typeWeeklyLong", { day: slotDate(o.slot).split(",")[0] }) : plainT("typeOnce");
  }
  function waOrderText(o) {
    var T = TEXTS[lang];
    var lines = [
      plainT("waOrderMsg", { id: o.id }), "",
      T.fName + ": " + o.name,
      T.fPhone + ": " + o.phone,
      T.cAddress + ": " + o.street + (o.apt ? ", " + o.apt : ""),
      T.cDelivery + ": " + slotLabel(o.slot),
      T.cType + ": " + typeText(o),
      T.cIce + ": " + itemsText(o)
    ];
    if (o.cooler !== "none" && o.ownCooler) lines.push(T.cOwnCooler + ": " + T.cOwnCoolerYes);
    lines.push(T.cTotal + ": " + totalText(o));
    lines.push(T.cPayment + ": " + (o.payment === "bit" ? (o.weekly ? T.statusWeeklyBit : T.statusAwaiting) : T.statusCash));
    if (o.notes) lines.push(T.fNotes + ": " + o.notes);
    return lines.join("\n");
  }
  function renderContact() {
    $all(".js-wa-contact").forEach(function (a) { a.href = waLink(""); });
    $all(".js-wa-number").forEach(function (el) { el.textContent = S.whatsappNumber; });
    $all(".js-bit-number").forEach(function (el) { el.textContent = S.bitNumber; });
  }

  /* ================= Sending the order ================= */
  function send(payload) {
    if (DEMO) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve({ ok: true, orderId: "DEMO-" + (1000 + Math.floor(Math.random() * 9000)) }); }, 400);
      });
    }
    return fetch(CFG.googleSheetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },   // no CORS preflight for Apps Script
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function showFormError(html) {
    var box = $("#form-error");
    box.hidden = false;
    box.innerHTML = html;
    box.scrollIntoView({ block: "center" });
  }

  function renderConfirmation(o) {
    $("#thanks-title").textContent = plainT("thanksTitle", { id: o.id });
    var rows = [
      [plainT("cDelivery"), slotLabel(o.slot)],
      [plainT("cType"), typeText(o)],
      [plainT("cIce"), itemsText(o)]
    ];
    if (o.cooler !== "none" && o.ownCooler) rows.push([plainT("cOwnCooler"), plainT("cOwnCoolerYes")]);
    rows.push([plainT("cTotal"), totalText(o)]);
    rows.push([plainT("cPayment"), plainT(o.payment === "bit" ? (o.weekly ? "statusWeeklyBit" : "statusAwaiting") : "statusCash")]);
    var dl = $("#confirm-list");
    dl.innerHTML = "";
    rows.forEach(function (r) {
      var dt = document.createElement("dt"); dt.textContent = r[0];
      var dd = document.createElement("dd"); dd.textContent = r[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    $("#pay-bit").hidden = o.payment !== "bit";
    $("#pay-cash").hidden = o.payment === "bit";
    $("#pay-bit-text").innerHTML = t(o.weekly ? "payBitTextWeekly" : "payBitText", { total: money(o.final), id: o.id });
    var pause = $("#pause-link");
    pause.hidden = !o.weekly;
    pause.href = waLink(plainT("waPauseMsg", { id: o.id, name: o.name }));
    $("#pay-cash").innerHTML = t("payCashText", { total: money(o.final) });
    $("#wa-order-btn").href = waLink(waOrderText(o));
  }

  /* ================= Copy ================= */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    legacyCopy(text);
    return Promise.resolve();
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }

  /* ================= Form wiring ================= */
  function initForm() {
    form = $("#order-form");

    form.addEventListener("change", function (e) {
      var n = e.target.name;
      if (n === "ice") order.choice = e.target.value;
      if (n === "orderType") { order.weekly = e.target.value === "weekly"; renderIceChoices(); }
      if (n === "slot") order.slotId = e.target.value;
      if (n === "payment") setError("payment", "");
      updateTotals();
    });
    $("#upsell-btn").addEventListener("click", function () {
      order.choice = this.dataset.pkg;
      renderIceChoices();
      updateTotals();
    });
    ["name", "phone", "street"].forEach(function (id) {
      form.elements[id].addEventListener("input", function () { setError(id, ""); });
    });
    form.elements.phone.addEventListener("blur", function () {
      var n = normalizePhone(this.value);
      if (n) this.value = n;
    });
    $all(".js-copy-bit").forEach(function (b) {
      b.addEventListener("click", function () {
        copyText(String(S.bitNumber).replace(/\D/g, ""));
        b.textContent = plainT("bitCopied");
        setTimeout(function () { b.textContent = plainT("bitCopy"); }, 1800);
      });
    });

    var sending = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending || !validate()) return;
      if (val("website")) return;                          // a bot filled the hidden field
      var c = calc();
      var payload = {
        action: "order", language: lang,
        name: val("name"), phone: normalizePhone(val("phone")), street: val("street"),
        apt: val("apt"), notes: val("notes"),
        bags: c.bags, cooler: c.cooler, ownCooler: c.cooler !== "none" && !!val("ownCooler"),
        slotId: order.slotId, payment: val("payment"), website: val("website"),
        orderType: order.weekly ? "weekly" : "once"
      };
      sending = true;
      var btn = $("#submit-btn");
      btn.disabled = true;
      $(".js-submit-label").textContent = plainT("sending");

      send(payload).then(function (res) {
        if (res && res.ok && res.orderId) {
          lastOrder = {
            id: res.orderId, slot: slotById(order.slotId) || res.slot,
            name: payload.name, phone: payload.phone, street: payload.street, apt: payload.apt, notes: payload.notes,
            bags: c.bags, cooler: c.cooler, ownCooler: payload.ownCooler, payment: payload.payment, weekly: c.weekly,
            totalBags: c.totalBags, totalKg: c.totalKg, regular: c.regular,
            final: c.final, savings: c.savings
          };
          renderConfirmation(lastOrder);
          $("#order-form-wrap").hidden = true;
          var thanks = $("#thanks");
          thanks.hidden = false;
          thanks.scrollIntoView({ behavior: FX.reducedMotion() ? "auto" : "smooth", block: "start" });
          thanks.focus({ preventScroll: true });
          FX.celebrate();
          music.start();                           // celebrate the order with the song (unless they turned music off)
          // the slot now has fewer bags left
          var s = slotById(order.slotId);
          if (s) { s.remaining -= c.totalBags; s.soldOut = s.remaining <= 0; }
          return;
        }
        var err = res && res.error;
        if (err === "slot_full") {
          if (res.slots) slots = res.slots;
          renderSlots();
          setError("slot", plainT("slotTooSmall", { n: res.remaining || 0 }));
          showFormError(plainT("slotTooSmall", { n: res.remaining || 0 }));
        } else if (err === "slot_closed") {
          order.slotId = "";
          loadFromSheet().then(function () { showFormError(plainT("errClosed")); });
        } else {
          throw new Error(err || "unknown");
        }
      }).catch(function (e2) {
        console.warn("Ice Drop: order failed", e2);
        showFormError(plainT("errNetwork") + ' <a target="_blank" rel="noopener" href="' + waLink("") + '">WhatsApp</a>');
      }).then(function () {
        sending = false;
        btn.disabled = false;
        $(".js-submit-label").textContent = plainT("submit");
      });
    });

    $("#new-order").addEventListener("click", function () {
      lastOrder = null;
      form.reset();
      order = { choice: "b2", slotId: "", weekly: false };
      $("#thanks").hidden = true;
      $("#order-form-wrap").hidden = false;
      renderAll();
      $("#order").scrollIntoView({ block: "start" });
    });
  }

  /* ================= Map ================= */
  function initMap() {
    var el = $("#map");
    if (!window.L || !el) return;
    var M = CFG.map, center = [M.centerLat, M.centerLng];
    var map = L.map(el, { center: center, zoom: M.zoom, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false });
    // OpenStreetMap (free, no key needed), darkened with a CSS filter (see .map-tiles in style.css)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: "map-tiles",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    // only the shaded circle: no pin, no house number
    var circle = L.circle(center, { radius: M.radiusMeters, color: "#5bc0eb", weight: 2, dashArray: "6 6", fillColor: "#5bc0eb", fillOpacity: 0.18 }).addTo(map);
    map.fitBounds(circle.getBounds(), { padding: [16, 16] });
    window.addEventListener("resize", function () { map.invalidateSize(); });
  }

  /* ================= Music =================
     "Ice Ice Baby" through YouTube's official player (full song, no login),
     kept off-screen. Browsers only allow sound after a tap, so the
     "Tap to enter" screen starts it. Header button = play / pause.
     If config.js has a musicFile, that file is played instead.        */
  var music = { start: function () {} };
  function initMusic() {
    var btn = $("#music-btn"), MUSIC_KEY = "icedrop-music";
    var player = null, ready = false, wantPlay = false, playing = false, audio = null, lastError = null;
    var userOff = false;
    try { userOff = localStorage.getItem(MUSIC_KEY) === "off"; } catch (e) {}

    var panel = $("#music-panel"), dockTimer = null;
    function dock(open) {                          // the small music bar at the bottom
      panel.classList.toggle("is-dock", open);
    }
    function show(on) {
      if (on && panel.classList.contains("is-dock")) { clearTimeout(dockTimer); dockTimer = setTimeout(function () { dock(false); }, 1800); }
      playing = on;
      btn.classList.toggle("is-playing", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    var spotify = null, spotifyStarted = false;
    function play() {
      wantPlay = true;
      if (audio) { audio.play().then(function () { show(true); }).catch(function () { show(false); }); return; }
      if (spotify) { if (!spotifyStarted) { spotify.play(); spotifyStarted = true; } else spotify.resume(); return; }
      if (!ready || lastError) return;             // starts as soon as the player is ready
      player.unMute();
      player.setVolume(85);
      player.playVideo();
    }
    function pause() {
      wantPlay = false;
      if (audio) audio.pause(); else if (spotify) spotify.pause(); else if (ready) player.pauseVideo();
      show(false);
    }

    // Backup: if YouTube won't play the video on other websites, use Spotify's player
    function useSpotify() {
      var id = (String(CFG.spotifyEmbedUrl || "").match(/track\/([A-Za-z0-9]+)/) || [])[1];
      if (!id || window.onSpotifyIframeApiReady) return;
      window.onSpotifyIframeApiReady = function (api) {
        var el = document.createElement("div");
        $("#music-frame-holder").appendChild(el);
        api.createController(el, { uri: "spotify:track:" + id, width: "100%", height: 80 }, function (c) {
          spotify = c;
          c.addListener("playback_update", function (e) { if (e && e.data) show(!e.data.isPaused); });
          if (wantPlay) play();
        });
      };
      var sc = document.createElement("script");
      sc.src = "https://open.spotify.com/embed/iframe-api/v1";
      sc.async = true;
      document.head.appendChild(sc);
    }

    if (CFG.musicFile) {                           // your own music file
      audio = new Audio(CFG.musicFile);
      audio.loop = true;
      audio.preload = "auto";
      audio.addEventListener("pause", function () { show(false); });
      audio.addEventListener("playing", function () { show(true); });
    } else if (CFG.youtubeVideoId) {
      window.onYouTubeIframeAPIReady = function () {
        player = new YT.Player("yt-player", {
          width: 200, height: 113, videoId: CFG.youtubeVideoId,
          playerVars: { playsinline: 1, controls: 0, rel: 0, loop: 1, playlist: CFG.youtubeVideoId, start: CFG.musicStartAt || 0 },
          events: {
            onReady: function () { ready = true; if (wantPlay) play(); },
            onStateChange: function (e) { show(e.data === 1 || e.data === 3); },  // 1 playing, 3 buffering
            onError: function (e) {
              lastError = e.data;
              var yt = $("#yt-player");
              if (yt) yt.style.display = "none";              // hide the blocked YouTube player
              console.warn("Ice Drop: YouTube can't play this video here (error " + e.data + "), switching to Spotify");
              useSpotify();
            }
          }
        });
      };
      var sc = document.createElement("script");
      sc.src = "https://www.youtube.com/iframe_api";
      sc.async = true;
      document.head.appendChild(sc);
    }

    music.start = function () {
      if (CFG.autoPlayMusic === false || userOff) return;
      play();
      // phones often block music that isn't started by a tap on the player itself:
      // if it hasn't started after 2.5 s, show the little music bar
      setTimeout(function () { if (!playing) dock(true); }, 2500);
    };
    $("#music-close").addEventListener("click", function () { dock(false); });
    btn.addEventListener("click", function () {
      if (playing) { pause(); try { localStorage.setItem(MUSIC_KEY, "off"); } catch (e) {} return; }
      userOff = false;
      try { localStorage.removeItem(MUSIC_KEY); } catch (e) {}
      play();
      if (!audio) setTimeout(function () { if (!playing) dock(true); }, 1200);
    });
    window.__iceMusic = function () { return { ready: ready, playing: playing, error: lastError, spotify: !!spotify, state: player && player.getPlayerState ? player.getPlayerState() : null }; };
  }

  /* ================= Music on the first tap =================
     Browsers only allow sound after the visitor touches the page, so the
     song starts on their first tap / click / key press anywhere.       */
  function initFirstTap() {
    var evs = ["pointerdown", "touchend", "keydown"];
    function first(e) {
      if (e.target.closest && e.target.closest("#music-btn, #music-panel")) return;  // those handle themselves
      evs.forEach(function (ev) { document.removeEventListener(ev, first, true); });
      music.start();
    }
    evs.forEach(function (ev) { document.addEventListener(ev, first, true); });
  }

  /* ================= Scroll effects ================= */
  function initScrollFx() {
    var reduced = FX.reducedMotion();
    var items = $all("[data-reveal]");
    if (reduced || !("IntersectionObserver" in window)) items.forEach(function (el) { el.classList.add("is-in"); });
    else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      items.forEach(function (el) { io.observe(el); });
    }

    var header = $(".site-header"), hero = $(".hero"), cube = $("#hero-cube");
    var ticking = false;
    function clamp(v) { return Math.max(0, Math.min(1, v)); }

    function update() {
      ticking = false;
      var y = window.scrollY, vh = window.innerHeight;
      header.classList.toggle("is-solid", y > 40);
      if (reduced || !cube) return;
      // the hero cube "drops" a little as you scroll
      var hp = clamp(y / (hero.offsetHeight * 0.9));
      cube.style.transform = "translateY(" + (hp * vh * 0.4) + "px) rotate(" + (hp * 30) + "deg) scale(" + (1 - hp * 0.2) + ")";
      cube.style.opacity = String(1 - hp * 0.6);
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ================= Start ================= */
  function switchLang() {
    lang = lang === "he" ? "en" : "he";
    saveLang(lang);
    clearErrors();
    renderAll();
  }

  function start() {
    lang = loadLang();
    coolerFx = FX.cooler ? FX.cooler($("#cooler-canvas")) : null;
    initForm();
    renderAll();
    initMusic();
    initFirstTap();
    initScrollFx();
    try { initMap(); } catch (e) { console.warn("Ice Drop: map failed", e); }
    $("#year").textContent = new Date().getFullYear();
    $("#lang-btn").addEventListener("click", switchLang);
    loadFromSheet();
    setInterval(updateCountdown, 1000);
    if (FX.touchIce) FX.touchIce($(".hero"), $("#hero-ice"));

    // tapping a price row picks it in the order form
    $("#price-list").addEventListener("click", function (e) {
      var row = e.target.closest(".price-btn");
      if (!row) return;
      order.choice = row.dataset.choice;
      renderIceChoices();
      updateTotals();
      $("#order").scrollIntoView({ behavior: FX.reducedMotion() ? "auto" : "smooth" });
    });

    // frost creeps over the screen when the page opens, then clears
    var frostStarted = false;
    function startFrost() { if (!frostStarted) { frostStarted = true; FX.frostIn(); } }
    if (document.readyState === "complete") startFrost();
    else { window.addEventListener("load", startFrost); setTimeout(startFrost, 1200); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
