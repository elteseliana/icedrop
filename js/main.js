/* =====================================================================
   ICE DROP — MAIN SCRIPT
   You normally don't need to edit this file.
   Prices/times/numbers → js/config.js     Words → js/texts.js
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.ICE_DROP_CONFIG;
  var TEXTS = window.ICE_DROP_TEXTS;
  var FX = window.IceDropFX || { frostIn: function () {}, celebrate: function () {} };
  var LANG_KEY = "icedrop-lang";
  var lang = "he";
  var lastOrder = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ================= Language ================= */
  function loadLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    if (saved === "he" || saved === "en") return saved;
    return CFG.defaultLanguage === "en" ? "en" : "he";
  }
  function saveLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch (e) {} }

  var BRAND_HTML = '<span class="brand" dir="ltr" lang="en">Ice Drop</span>';

  // In Hebrew, "\u2066…\u2069" keeps "13:30–15:00" in the right order
  function deliveryWindow() { return lang === "he" ? "\u2066" + CFG.delivery.timeWindowHe + "\u2069" : CFG.delivery.timeWindow; }

  // t("key", {name: "Dana"}) → the sentence in the current language
  function t(key, vars, plain) {
    var s = (TEXTS[lang] && TEXTS[lang][key]);
    if (s == null) s = TEXTS.en[key] || key;
    var all = {
      window: deliveryWindow(),
      date: formatDate(getDeliveryDate()),
      number: CFG.contact.bitNumber,
      fee: money(CFG.ice.deliveryFee),
      freeKg: CFG.ice.freeDeliveryFromKg
    };
    if (vars) for (var k in vars) all[k] = vars[k];
    s = s.replace(/\{(\w+)\}/g, function (m, name) {
      if (name === "brand") return plain ? "Ice Drop" : BRAND_HTML;
      return all[name] != null ? all[name] : m;
    });
    // "Ice Drop" inside a Hebrew sentence: keep it LTR
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

  function setLang(l) {
    lang = l;
    saveLang(l);
    clearErrors();
    applyTexts();
    renderPrices();
    updatePayBoxes();
    updateTotal();
    updateWaLinks();
    if (lastOrder) renderSummary(lastOrder);
  }

  /* ================= Delivery date (Israel time) =================
     Orders close on cutoffDay at cutoffHour. After that, the order
     goes to the following delivery day automatically.               */
  function israelNow() {
    var parts = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: CFG.delivery.timeZone, year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short"
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour % 24, min: +parts.minute, wd: wd };
  }

  var DAY = 86400000;
  function getDeliveryDate() {
    var n = israelNow();
    var D = CFG.delivery;
    var today = Date.UTC(n.y, n.m - 1, n.d);
    var delivery = today + ((D.day - n.wd + 7) % 7) * DAY;
    var cutoff = delivery - ((D.day - D.cutoffDay + 7) % 7) * DAY + (D.cutoffHour * 60 + (D.cutoffMinute || 0)) * 60000;
    var nowStamp = today + (n.h * 60 + n.min) * 60000;
    if (nowStamp >= cutoff) delivery += 7 * DAY;
    return new Date(delivery + 12 * 3600000); // noon UTC: safe from time-zone edge cases
  }

  function formatDate(date, forceLang) {
    var l = forceLang || lang;
    return new Intl.DateTimeFormat(l === "he" ? "he-IL" : "en-US", {
      weekday: "long", month: l === "he" ? "long" : "short", day: "numeric", timeZone: "UTC"
    }).format(date);
  }
  function isoDate(date) { return date.toISOString().slice(0, 10); }

  /* ================= Ice & prices ================= */
  function money(n) { return CFG.currency + n; }

  // How much does it cost? Ice price + delivery (free from X kg)
  function priceFor(kg) {
    var I = CFG.ice;
    var ice = kg * I.pricePerKg;
    var fee = kg >= I.freeDeliveryFromKg ? 0 : I.deliveryFee;
    return { ice: ice, fee: fee, total: ice + fee };
  }

  function renderPrices() {
    var I = CFG.ice;
    $("#price-per-kg").textContent = money(I.pricePerKg);
    // a few example amounts under the big price
    var ex = $("#price-examples");
    ex.innerHTML = "";
    [I.minKg, Math.max(I.minKg + 1, I.freeDeliveryFromKg), Math.max(I.minKg + 3, 5)].forEach(function (kg) {
      var chip = document.createElement("span");
      chip.className = "price-chip" + (kg >= I.freeDeliveryFromKg ? " is-free" : "");
      chip.innerHTML = "<b></b><span dir=\"ltr\"></span>";
      chip.firstChild.textContent = kg + " " + (lang === "he" ? "ק״ג" : "kg");
      chip.lastChild.textContent = money(kg * I.pricePerKg);
      ex.appendChild(chip);
    });

    // the kilo dropdown in the form
    var sel = $("#f-kg");
    var current = parseInt(sel.value, 10) || I.minKg;
    sel.innerHTML = "";
    for (var kg = I.minKg; kg <= I.maxKg; kg++) {
      var o = document.createElement("option");
      o.value = kg;
      o.textContent = plainT(kg >= I.freeDeliveryFromKg ? "kgOptionFree" : "kgOption", { kg: kg, price: money(kg * I.pricePerKg) });
      if (kg === current) o.selected = true;
      sel.appendChild(o);
    }
  }

  /* ================= Form helpers ================= */
  var form;
  function val(name) {
    var el = form.elements[name];
    if (!el) return "";
    if (!el.tagName) { // a group of radio buttons
      for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value;
      return "";
    }
    if (el.type === "radio") return el.checked ? el.value : ""; // only one radio button
    return (el.value || "").trim();
  }
  function kgChosen() {
    var n = parseInt($("#f-kg").value, 10);
    return isNaN(n) ? CFG.ice.minKg : n;
  }

  // Israeli phone: mobile 05X-XXXXXXX, landline 02/03/04/08/09, 07X numbers, or +972
  function normalizePhone(raw) {
    var d = String(raw || "").replace(/[\s\-().]/g, "");
    if (d.indexOf("+972") === 0) d = "0" + d.slice(4);
    else if (d.indexOf("00972") === 0) d = "0" + d.slice(5);
    else if (d.indexOf("972") === 0 && d.length >= 11) d = "0" + d.slice(3);
    d = d.replace(/^00/, "0");
    if (/^0(5\d|7\d)\d{7}$/.test(d)) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
    if (/^0[23489]\d{7}$/.test(d)) return d.slice(0, 2) + "-" + d.slice(2, 5) + "-" + d.slice(5);
    return null;
  }

  function updateTotal() {
    var kg = kgChosen();
    var p = priceFor(kg);
    var weekly = val("orderType") === "weekly";
    $("#total-ice").textContent = plainT("totalIce", { kg: kg, price: money(p.ice) });
    $("#total-delivery").textContent = p.fee ? plainT("totalDelivery", { fee: money(p.fee) }) : plainT("deliveryFree");
    $("#total-amount").textContent = money(p.total);
    $("#total-weekly").textContent = weekly ? plainT("totalWeekly") : "";
    var need = CFG.ice.freeDeliveryFromKg - kg;
    var nudge = $("#kg-nudge");
    nudge.textContent = need > 0 ? plainT("nudgeMore", { n: need }) : plainT("nudgeFree");
    nudge.classList.toggle("is-free", need <= 0);
  }

  function updatePayBoxes() {
    var pay = val("payment");
    $("#bit-box").hidden = pay !== "bit";
    $("#cash-box").hidden = pay !== "cash";
  }

  function setError(id, msg) {
    var err = $("#err-" + id);
    if (err) err.textContent = msg || "";
    var input = form.elements[id];
    if (input && input.tagName) {
      input.classList.toggle("is-invalid", !!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) input.setAttribute("aria-describedby", "err-" + id);
    }
  }

  function clearErrors() {
    ["name", "phone", "street", "payment"].forEach(function (id) { setError(id, ""); });
    $("#form-error").hidden = true;
  }

  function validate() {
    var ok = true, first = null;
    function fail(id, key) {
      setError(id, plainT(key));
      ok = false;
      if (!first) first = form.elements[id] && form.elements[id].tagName ? form.elements[id] : $("#err-" + id);
    }
    ["name", "phone", "street", "payment"].forEach(function (id) { setError(id, ""); });

    if (val("name").length < 2) fail("name", "errName");
    if (!normalizePhone(val("phone"))) fail("phone", "errPhone");
    if (!val("street")) fail("street", "errRequired");
    if (!val("payment")) fail("payment", "errChoose");

    var box = $("#form-error");
    box.hidden = ok;
    box.textContent = ok ? "" : plainT("errSummary");
    if (first && first.focus) first.focus({ preventScroll: false });
    return ok;
  }

  /* ================= Building the order ================= */
  function buildOrder() {
    var kg = kgChosen();
    var p = priceFor(kg);
    var date = getDeliveryDate();
    return {
      name: val("name"),
      phone: normalizePhone(val("phone")),
      street: val("street"),
      apt: val("apt"),
      floor: val("floor"),
      code: val("code"),
      notes: val("notes"),
      kg: kg,
      icePrice: p.ice,
      deliveryFee: p.fee,
      total: p.total,
      orderType: val("orderType") === "weekly" ? "weekly" : "once",
      payment: val("payment"),
      deliveryDate: date,
      website: val("website")       // honeypot
    };
  }

  function addressLine(o, l) {
    var T = TEXTS[l || lang];
    var bits = [o.street];
    if (o.apt) bits.push(T.aptShort + " " + o.apt);
    if (o.floor) bits.push(T.floorShort + " " + o.floor);
    if (o.code) bits.push(T.codeShort + " " + o.code);
    return bits.join(", ");
  }
  function typeLabel(o, l) {
    var T = TEXTS[l || lang];
    return o.orderType === "weekly" ? T.typeWeekly : T.typeOnce;
  }
  function payLabel(o, l) {
    var T = TEXTS[l || lang];
    return o.payment === "bit" ? T.payBit : T.payCash;
  }
  function iceLabel(o, l) { return o.kg + ((l || lang) === "he" ? " ק״ג" : " kg") + " (" + money(o.icePrice) + ")"; }
  function feeLabel(o, l) { return o.deliveryFee ? money(o.deliveryFee) : TEXTS[l || lang].free; }
  function totalLabel(o, l) {
    return money(o.total) + (o.orderType === "weekly" ? " " + TEXTS[l || lang].totalWeekly : "");
  }

  function summaryRows(o) {
    var T = TEXTS[lang];
    var rows = [
      [T.sumName, o.name],
      [T.sumPhone, o.phone],
      [T.sumAddress, addressLine(o)],
      [T.sumIce, iceLabel(o)],
      [T.sumType, typeLabel(o)],
      [T.sumPay, payLabel(o)],
      [T.sumDelivery, feeLabel(o)],
      [T.sumTotal, totalLabel(o)],
      [T.sumDate, formatDate(o.deliveryDate) + ", " + deliveryWindow()]
    ];
    if (o.notes) rows.push([T.sumNotes, o.notes]);
    return rows;
  }

  function renderSummary(o) {
    var dl = $("#summary-list");
    dl.innerHTML = "";
    summaryRows(o).forEach(function (r) {
      var dt = document.createElement("dt"); dt.textContent = r[0];
      var dd = document.createElement("dd"); dd.textContent = r[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    $("#wa-order-btn").href = waLink(waOrderText(o));
    $("#thanks-pause").hidden = o.orderType !== "weekly";
    $("#thanks-pause").href = waLink(plainT("waPauseMsg", { name: o.name }));
  }

  /* ================= WhatsApp ================= */
  function waLink(text) {
    return "https://wa.me/" + CFG.contact.whatsappIntl + "?text=" + encodeURIComponent(text);
  }
  function waOrderText(o) {
    var T = TEXTS[lang];
    var lines = [
      plainT("waOrderMsg"),
      "",
      "👤 " + T.sumName + ": " + o.name,
      "📞 " + T.sumPhone + ": " + o.phone,
      "🏠 " + T.sumAddress + ": " + addressLine(o),
      "🧊 " + T.sumIce + ": " + iceLabel(o),
      "🔁 " + T.sumType + ": " + typeLabel(o),
      "💳 " + T.sumPay + ": " + payLabel(o),
      "🚚 " + T.sumDelivery + ": " + feeLabel(o),
      "💰 " + T.sumTotal + ": " + totalLabel(o),
      "📅 " + T.sumDate + ": " + formatDate(o.deliveryDate) + ", " + deliveryWindow()
    ];
    if (o.notes) lines.push("📝 " + T.sumNotes + ": " + o.notes);
    return lines.join("\n");
  }
  function updateWaLinks() {
    var pauseText = plainT("waPauseMsg", { name: TEXTS[lang].waPauseBlank });
    $all(".js-pause-link").forEach(function (a) { if (a.id !== "thanks-pause") a.href = waLink(pauseText); });
    $all(".js-wa-contact").forEach(function (a) { a.href = "https://wa.me/" + CFG.contact.whatsappIntl; });
    $all(".js-wa-number").forEach(function (el) { el.textContent = CFG.contact.whatsappNumber; });
    $all(".js-bit-number").forEach(function (el) { el.textContent = CFG.contact.bitNumber; });
  }

  /* ================= Google Sheet ================= */
  function sendToSheet(o) {
    if (!CFG.googleSheetUrl) {
      console.warn("Ice Drop: googleSheetUrl is empty in js/config.js, so the order was not saved to the Google Sheet.");
      return Promise.resolve();
    }
    var payload = {
      orderType: o.orderType,
      deliveryFriday: isoDate(o.deliveryDate),
      deliveryFridayText: formatDate(o.deliveryDate, "en"),
      name: o.name,
      phone: o.phone,
      address: addressLine(o, "en"),
      whatToBring: o.kg + " kg ice",
      kg: o.kg,
      deliveryFee: o.deliveryFee,
      payment: o.payment === "bit" ? "Bit" : "Cash",
      total: o.total,
      notes: o.notes,
      language: lang,
      website: o.website
    };
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 6000); });
    var req = fetch(CFG.googleSheetUrl, {
      method: "POST",
      mode: "no-cors",                           // Google Apps Script needs this
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).catch(function (err) { console.warn("Ice Drop: could not reach the Google Sheet", err); });
    return Promise.race([req, timeout]);
  }

  /* ================= Copy to clipboard ================= */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    }
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

  /* ================= Map ================= */
  function initMap() {
    var el = $("#map");
    if (!window.L || !el) {
      if (el) el.innerHTML = '<p style="padding:20px;text-align:center">🗺️</p>';
      return;
    }
    var M = CFG.map;
    var center = [M.centerLat, M.centerLng];
    var map = L.map(el, {
      center: center, zoom: M.zoom,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,  // on phones, one finger scrolls the page, not the map
      tap: false,
      attributionControl: true
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    // Only the shaded circle: no pin, no address
    var circle = L.circle(center, {
      radius: M.radiusMeters,
      color: "#1e88e5", weight: 3, dashArray: "8 6",
      fillColor: "#5cc0ff", fillOpacity: 0.25
    }).addTo(map);
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
    function close() {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    btn.addEventListener("click", function () { panel.hidden ? open() : close(); });
    $("#music-close").addEventListener("click", function () { close(); btn.focus(); });
  }

  /* ================= Form wiring ================= */
  function initForm() {
    form = $("#order-form");

    form.addEventListener("change", function (e) {
      if (e.target.name === "payment") { updatePayBoxes(); setError("payment", ""); }
      updateTotal();
    });
    ["name", "phone", "street"].forEach(function (id) {
      form.elements[id].addEventListener("input", function () { setError(id, ""); });
    });
    form.elements.phone.addEventListener("blur", function () {
      var n = normalizePhone(this.value);
      if (n) this.value = n;
    });

    // Bit buttons
    $all(".js-copy-bit").forEach(function (b) {
      b.addEventListener("click", function () {
        copyText(CFG.contact.bitNumber.replace(/-/g, ""));
        b.textContent = plainT("bitCopied");
        setTimeout(function () { b.textContent = plainT("bitCopy"); }, 1800);
      });
    });
    $all(".js-bit-pay").forEach(function (a) {
      if (CFG.bitPaymentLink) {
        a.href = CFG.bitPaymentLink;
      } else {
        a.removeAttribute("target");
        a.addEventListener("click", function (e) {
          e.preventDefault();
          copyText(CFG.contact.bitNumber.replace(/-/g, ""));
          var toast = a.parentNode.querySelector(".bit-toast");
          if (toast) toast.textContent = plainT("bitNoLink");
        });
      }
    });

    var sending = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending || !validate()) return;
      var order = buildOrder();
      if (order.website) return; // a bot filled the hidden field
      sending = true;
      var btn = $("#submit-btn");
      btn.disabled = true;
      btn.textContent = plainT("sending");

      sendToSheet(order).then(function () {
        lastOrder = order;
        renderSummary(order);
        $("#order-form-wrap").hidden = true;
        var thanks = $("#thanks");
        thanks.hidden = false;
        thanks.scrollIntoView({ behavior: FX.reducedMotion && FX.reducedMotion() ? "auto" : "smooth", block: "start" });
        thanks.focus({ preventScroll: true });
        FX.celebrate();
      }).then(function () {
        sending = false;
        btn.disabled = false;
        btn.innerHTML = t("submit");
      });
    });

    $("#new-order").addEventListener("click", function () {
      lastOrder = null;
      form.reset();
      $("#f-kg").value = CFG.ice.minKg;
      updatePayBoxes();
      updateTotal();
      $("#thanks").hidden = true;
      $("#order-form-wrap").hidden = false;
      $("#order").scrollIntoView({ block: "start" });
    });
  }

  /* ================= Start ================= */
  function start() {
    lang = loadLang();
    initForm();
    applyTexts();
    renderPrices();
    updatePayBoxes();
    updateTotal();
    updateWaLinks();
    initMusic();
    try { initMap(); } catch (e) { console.warn("Ice Drop: map failed", e); }
    $("#year").textContent = new Date().getFullYear();
    $("#lang-btn").addEventListener("click", function () { setLang(lang === "he" ? "en" : "he"); });

    // Update "which Friday" text if the page stays open past the cutoff
    setInterval(function () { if (!lastOrder) applyTexts(); }, 5 * 60 * 1000);

    // Opening animation: frost creeps over the screen, then clears.
    // Start once the page has loaded (or after 1.2 s at most), so people see it.
    var frostStarted = false;
    function startFrost() { if (!frostStarted) { frostStarted = true; FX.frostIn(); } }
    if (document.readyState === "complete") startFrost();
    else { window.addEventListener("load", startFrost); setTimeout(startFrost, 1200); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
