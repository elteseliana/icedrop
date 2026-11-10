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
  var order = { bags: 0, cooler: "none", slotId: "" };
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
    renderBagPicker();
    renderCoolerPicker();
    renderSlots();
    updateSummary();
    renderContact();
    if (lastOrder) renderConfirmation(lastOrder);
  }

  /* ================= Prices ================= */
  function pkgById(id) { return S.packages.filter(function (p) { return p.id === id; })[0]; }
  function pkgName(id) { return plainT("pkg_" + id); }
  function bestDealId() {
    var best = null;
    S.packages.forEach(function (p) {
      var save = p.bags * S.pricePerBag - p.price;
      if (save > 0 && (!best || save / (p.bags * S.pricePerBag) > best.r)) best = { id: p.id, r: save / (p.bags * S.pricePerBag) };
    });
    return best && best.id;
  }

  function calc() {
    var pkg = pkgById(order.cooler);
    var totalBags = order.bags + (pkg ? pkg.bags : 0);
    var regular = totalBags * S.pricePerBag;
    var final = order.bags * S.pricePerBag + (pkg ? pkg.price : 0);
    return { totalBags: totalBags, totalKg: totalBags * S.kgPerBag, regular: regular, final: final, savings: regular - final, pkg: pkg };
  }

  function renderPitch() {
    var p = pitch();
    $all(".js-mk-kg").forEach(function (el) { el.textContent = p.mkKg; });
    $all(".js-mk-price").forEach(function (el) { el.textContent = p.mkPrice; });
    $all(".js-our-kg").forEach(function (el) { el.textContent = p.ourKg; });
    $all(".js-our-price").forEach(function (el) { el.textContent = p.ourPrice; });
  }

  function renderPrices() {
    $(".js-bag-desc").textContent = plainT("bagDesc", { kg: kgText(S.kgPerBag) });
    $(".js-bag-price").textContent = money(S.pricePerBag);
    $(".js-bag-max").textContent = plainT("bagMax", { n: S.maxBags });
    var best = bestDealId();
    var holder = $("#cooler-cards");
    holder.innerHTML = "";
    S.packages.forEach(function (p) {
      var regular = p.bags * S.pricePerBag, save = regular - p.price;
      var card = document.createElement("article");
      card.className = "cooler-card" + (p.id === best ? " is-best" : "");
      card.innerHTML =
        (p.id === best ? '<span class="best-badge"></span>' : "") +
        '<div><p class="price-name"></p><p class="price-desc"></p></div>' +
        '<div class="cooler-price">' + (save > 0 ? '<s dir="ltr"></s>' : "") + '<b dir="ltr"></b>' +
        (save > 0 ? '<span class="save-tag"></span>' : "") + "</div>";
      if (p.id === best) $(".best-badge", card).textContent = plainT("bestDeal");
      $(".price-name", card).textContent = pkgName(p.id);
      $(".price-desc", card).textContent = plainT("pkgDesc", { bags: p.bags, kg: kgText(p.bags * S.kgPerBag) });
      if (save > 0) {
        $("s", card).textContent = money(regular);
        $(".save-tag", card).textContent = plainT("save", { save: money(save) });
      }
      $("b", card).textContent = money(p.price);
      holder.appendChild(card);
    });
  }

  /* ================= Order form: ice ================= */
  function renderBagPicker() {
    var holder = $("#bag-picker");
    holder.innerHTML = "";
    if (order.bags > S.maxBags) order.bags = S.maxBags;
    for (var n = 0; n <= S.maxBags; n++) {
      var lab = document.createElement("label");
      lab.className = "bag-opt";
      lab.innerHTML = '<input type="radio" name="bags"><span></span>';
      var input = $("input", lab);
      input.value = n;
      input.checked = n === order.bags;
      $("span", lab).textContent = n;
      holder.appendChild(lab);
    }
    $(".js-bags-hint").textContent = plainT("bagsHint", { kg: kgText(S.kgPerBag), price: money(S.pricePerBag) });
  }

  function renderCoolerPicker() {
    var holder = $("#cooler-picker");
    holder.innerHTML = "";
    var best = bestDealId();
    var opts = [{ id: "none" }].concat(S.packages);
    if (!pkgById(order.cooler)) order.cooler = "none";
    opts.forEach(function (p) {
      var lab = document.createElement("label");
      lab.className = "cooler-opt" + (p.id === best ? " is-best" : "");
      var regular = p.bags ? p.bags * S.pricePerBag : 0, save = p.bags ? regular - p.price : 0;
      lab.innerHTML = '<input type="radio" name="cooler"><span class="co-body">' +
        '<span class="co-main"><b class="co-name"></b><small class="co-desc"></small></span>' +
        '<span class="co-price">' + (save > 0 ? '<s dir="ltr"></s> ' : "") + '<b class="co-now" dir="ltr"></b>' +
        (save > 0 ? '<small class="save-tag"></small>' : "") + "</span></span>";
      var input = $("input", lab);
      input.value = p.id;
      input.checked = p.id === order.cooler;
      $(".co-name", lab).textContent = p.id === "none" ? plainT("coolerNone") : pkgName(p.id);
      if (p.id !== "none") {
        $(".co-desc", lab).textContent = plainT("pkgDesc", { bags: p.bags, kg: kgText(p.bags * S.kgPerBag) });
        $(".co-now", lab).textContent = money(p.price);
        if (save > 0) {
          $("s", lab).textContent = money(regular);
          $(".save-tag", lab).textContent = p.id === best ? plainT("save", { save: money(save) }) + " · " + plainT("bestDeal") : plainT("save", { save: money(save) });
        }
      }
      holder.appendChild(lab);
    });
  }

  function updateUpsell() {
    var next = S.packages.filter(function (p) { return p.bags === order.bags + 1; })[0];
    var show = order.bags === S.maxBags && order.cooler === "none" && next;
    $("#upsell").hidden = !show;
    if (show) {
      var save = next.bags * S.pricePerBag - next.price;
      $(".js-upsell-text").innerHTML = t("upsell", { price: money(next.price), save: money(save) });
      $("#upsell-btn").dataset.pkg = next.id;
    }
  }

  function updateSummary() {
    var c = calc();
    $("#sum-bags").textContent = c.totalBags;
    $("#sum-kg").textContent = kgText(c.totalKg) + " " + plainT("kg");
    $("#sum-regular").textContent = money(c.regular);
    $("#sum-save").textContent = money(c.savings);
    $("#sum-total").textContent = money(c.final);
    $(".js-sum-regular").hidden = !(c.savings > 0);
    $(".js-sum-save").hidden = !(c.savings > 0);
    $("#own-cooler-wrap").hidden = order.cooler === "none";
    updateUpsell();
    markSlotFit();
  }

  /* ================= Delivery slots ================= */
  function slotDate(slot) {
    var p = slot.date.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
    return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", {
      weekday: "long", month: lang === "he" ? "long" : "short", day: "numeric", timeZone: "UTC"
    }).format(d);
  }
  function slotLabel(slot) {
    return slotDate(slot) + (slot.timeWindow ? ", ⁦" + slot.timeWindow.replace("-", "–") + "⁩" : "");
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
    slots.forEach(function (s) {
      var lab = document.createElement("label");
      lab.className = "slot-opt" + (s.soldOut ? " is-sold" : "");
      lab.innerHTML = '<input type="radio" name="slot"><span class="slot-body"><b class="slot-day"></b><small class="slot-left"></small></span>';
      var input = $("input", lab);
      input.value = s.id;
      input.disabled = !!s.soldOut;
      input.checked = s.id === order.slotId;
      $(".slot-day", lab).textContent = slotLabel(s);
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
    $all(".slot-opt").forEach(function (lab) {
      var s = slotById($("input", lab).value);
      lab.classList.toggle("too-small", !!(s && !s.soldOut && need > s.remaining));
    });
    var chosen = slotById(order.slotId);
    setError("slot", chosen && need > chosen.remaining ? plainT("slotTooSmall", { n: chosen.remaining }) : "");
  }

  function demoSlots() {
    var out = [], d = new Date();
    for (var i = 2; out.length < 3 && i < 30; i++) {
      var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (day.getDay() !== 5) continue;
      var iso = day.getFullYear() + "-" + ("0" + (day.getMonth() + 1)).slice(-2) + "-" + ("0" + day.getDate()).slice(-2);
      var rem = out.length === 1 ? 6 : 30;
      out.push({ id: iso + "|13:30-15:00", date: iso, timeWindow: "13:30-15:00", capacity: 30, remaining: rem, soldOut: false });
    }
    return out;
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

  var ERR_IDS = ["ice", "slot", "name", "phone", "street", "payment"];
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
    if (c.totalBags < 1) fail("ice", plainT("errIce"));
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
    return money(o.final) + (o.savings > 0 ? " (" + plainT("save", { save: money(o.savings) }) + ")" : "");
  }
  function waOrderText(o) {
    var T = TEXTS[lang];
    var lines = [
      plainT("waOrderMsg", { id: o.id }), "",
      T.fName + ": " + o.name,
      T.fPhone + ": " + o.phone,
      T.cAddress + ": " + o.street + (o.apt ? ", " + o.apt : ""),
      T.cDelivery + ": " + slotLabel(o.slot),
      T.cIce + ": " + itemsText(o)
    ];
    if (o.cooler !== "none" && o.ownCooler) lines.push(T.cOwnCooler + ": " + T.cOwnCoolerYes);
    lines.push(T.cTotal + ": " + totalText(o));
    lines.push(T.cPayment + ": " + (o.payment === "bit" ? T.statusAwaiting : T.statusCash));
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
      [plainT("cIce"), itemsText(o)]
    ];
    if (o.cooler !== "none" && o.ownCooler) rows.push([plainT("cOwnCooler"), plainT("cOwnCoolerYes")]);
    rows.push([plainT("cTotal"), totalText(o)]);
    rows.push([plainT("cPayment"), plainT(o.payment === "bit" ? "statusAwaiting" : "statusCash")]);
    var dl = $("#confirm-list");
    dl.innerHTML = "";
    rows.forEach(function (r) {
      var dt = document.createElement("dt"); dt.textContent = r[0];
      var dd = document.createElement("dd"); dd.textContent = r[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    $("#pay-bit").hidden = o.payment !== "bit";
    $("#pay-cash").hidden = o.payment === "bit";
    $("#pay-bit-text").innerHTML = t("payBitText", { total: money(o.final), id: o.id });
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
      if (n === "bags") order.bags = parseInt(e.target.value, 10) || 0;
      if (n === "cooler") order.cooler = e.target.value;
      if (n === "slot") order.slotId = e.target.value;
      if (n === "bags" || n === "cooler") setError("ice", "");
      if (n === "payment") setError("payment", "");
      updateSummary();
    });
    $("#upsell-btn").addEventListener("click", function () {
      order.bags = 0;
      order.cooler = this.dataset.pkg;
      renderBagPicker();
      renderCoolerPicker();
      updateSummary();
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
        bags: order.bags, cooler: order.cooler, ownCooler: order.cooler !== "none" && !!val("ownCooler"),
        slotId: order.slotId, payment: val("payment"), website: val("website")
      };
      sending = true;
      var btn = $("#submit-btn");
      btn.disabled = true;
      btn.textContent = plainT("sending");

      send(payload).then(function (res) {
        if (res && res.ok && res.orderId) {
          lastOrder = {
            id: res.orderId, slot: slotById(order.slotId) || res.slot,
            name: payload.name, phone: payload.phone, street: payload.street, apt: payload.apt, notes: payload.notes,
            bags: order.bags, cooler: order.cooler, ownCooler: payload.ownCooler, payment: payload.payment,
            totalBags: c.totalBags, totalKg: c.totalKg, regular: c.regular,
            final: res.price ? res.price.final : c.final, savings: res.price ? res.price.savings : c.savings
          };
          renderConfirmation(lastOrder);
          $("#order-form-wrap").hidden = true;
          var thanks = $("#thanks");
          thanks.hidden = false;
          thanks.scrollIntoView({ behavior: FX.reducedMotion() ? "auto" : "smooth", block: "start" });
          thanks.focus({ preventScroll: true });
          FX.celebrate();
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
        btn.textContent = plainT("submit");
      });
    });

    $("#new-order").addEventListener("click", function () {
      lastOrder = null;
      form.reset();
      order = { bags: 0, cooler: "none", slotId: "" };
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
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    // only the shaded circle: no pin, no house number
    var circle = L.circle(center, { radius: M.radiusMeters, color: "#1e90d6", weight: 2, dashArray: "6 6", fillColor: "#5bc0eb", fillOpacity: 0.2 }).addTo(map);
    map.fitBounds(circle.getBounds(), { padding: [16, 16] });
    window.addEventListener("resize", function () { map.invalidateSize(); });
  }

  /* ================= Music ================= */
  function initMusic() {
    var btn = $("#music-btn"), panel = $("#music-panel"), holder = $("#music-frame-holder");
    function open() {
      if (!holder.querySelector("iframe")) {
        var f = document.createElement("iframe");
        f.src = CFG.spotifyEmbedUrl;
        f.width = "100%"; f.height = "152";
        f.setAttribute("frameborder", "0");
        f.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
        f.setAttribute("loading", "lazy");
        f.title = "Spotify: Ice Ice Baby";
        holder.appendChild(f);
      }
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }
    function close() { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function () { panel.hidden ? open() : close(); });
    $("#music-close").addEventListener("click", function () { close(); btn.focus(); });
  }

  /* ================= Photo ================= */
  function initPhoto() {
    if (!CFG.photo) return;
    var img = $("#team-img");
    img.onload = function () { $("#team").hidden = false; };
    img.onerror = function () { console.warn("Ice Drop: photo not found: " + CFG.photo); };
    img.src = CFG.photo;
  }

  /* ================= Start ================= */
  function start() {
    lang = loadLang();
    initForm();
    renderAll();
    initMusic();
    initPhoto();
    try { initMap(); } catch (e) { console.warn("Ice Drop: map failed", e); }
    $("#year").textContent = new Date().getFullYear();
    $("#lang-btn").addEventListener("click", function () {
      lang = lang === "he" ? "en" : "he";
      saveLang(lang);
      clearErrors();
      renderAll();
      $("#team-img").alt = plainT("teamAlt");
    });
    $("#team-img").alt = plainT("teamAlt");
    loadFromSheet();

    // Opening animation: frost creeps over the screen, then clears
    var frostStarted = false;
    function startFrost() { if (!frostStarted) { frostStarted = true; FX.frostIn(); } }
    if (document.readyState === "complete") startFrost();
    else { window.addEventListener("load", startFrost); setTimeout(startFrost, 1200); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
