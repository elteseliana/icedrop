/* =====================================================================
   🧊 ICE DROP — MAIN SCRIPT
   You normally don't need to edit this file.
   Prices/times/numbers → js/config.js     Words → js/texts.js
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.ICE_DROP_CONFIG;
  var TEXTS = window.ICE_DROP_TEXTS;
  var FX = window.IceDropFX || { machineRain: function (cb) { cb && cb(); }, skateStop: function () {}, celebrate: function () {} };
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
      number: CFG.contact.bitNumber
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
    renderProducts();
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

  /* ================= Products ================= */
  function money(n) { return CFG.currency + n; }
  function productById(id) { return CFG.products.filter(function (p) { return p.id === id; })[0]; }
  function loc(obj) { return obj ? (obj[lang] || obj.en || "") : ""; }

  function renderProducts() {
    var cards = $("#price-cards");
    cards.innerHTML = "";
    CFG.products.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "price-card" + (p.popular ? " popular" : "");
      card.innerHTML =
        (p.popular ? '<span class="sticker">' + t("popular") + "</span>" : "") +
        '<div class="price-emoji" aria-hidden="true">' + p.emoji + "</div>" +
        "<h3></h3>" +
        '<div class="price-amount" dir="ltr">' + money(p.price) + "</div>" +
        '<div class="price-per">' + t("perBag") + "</div>" +
        (loc(p.weight) ? '<span class="price-weight">⚖️ ' + t("weightLabel") + ": <span></span></span>" : "") +
        '<p class="price-blurb"></p>';
      $("h3", card).textContent = loc(p.name);
      if (loc(p.weight)) $(".price-weight span", card).textContent = loc(p.weight);
      $(".price-blurb", card).textContent = loc(p.blurb);
      cards.appendChild(card);
    });

    var holder = $("#size-options");
    var current = (holder.querySelector("input:checked") || {}).value;
    holder.innerHTML = "";
    CFG.products.forEach(function (p) {
      var lab = document.createElement("label");
      lab.className = "choice";
      lab.innerHTML =
        '<input type="radio" name="size">' +
        '<span class="choice-body"><b></b><small></small><span class="choice-price" dir="ltr"></span></span>';
      var input = $("input", lab);
      input.value = p.id;
      if (p.id === current) input.checked = true;
      $("b", lab).textContent = p.emoji + " " + loc(p.name);
      $("small", lab).textContent = loc(p.weight);
      $(".choice-price", lab).textContent = money(p.price);
      holder.appendChild(lab);
    });
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
  function qty() {
    var n = parseInt($("#f-qty").value, 10);
    return isNaN(n) ? 0 : n;
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
    var p = productById(val("size"));
    var q = qty();
    var weekly = val("orderType") === "weekly";
    $("#total-amount").textContent = money(p && q > 0 ? p.price * q : 0);
    $("#total-calc").textContent = p && q > 0 ? plainT("totalCalc", { qty: q, name: loc(p.name), price: money(p.price) }) : "";
    $("#total-weekly").textContent = weekly ? plainT("totalWeekly") : "";
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
    ["name", "phone", "street", "size", "qty", "payment"].forEach(function (id) { setError(id, ""); });
    $("#form-error").hidden = true;
  }

  function validate() {
    var ok = true, first = null;
    function fail(id, key) {
      setError(id, plainT(key));
      ok = false;
      if (!first) first = form.elements[id] && form.elements[id].tagName ? form.elements[id] : $("#err-" + id);
    }
    ["name", "phone", "street", "size", "qty", "payment"].forEach(function (id) { setError(id, ""); });

    if (val("name").length < 2) fail("name", "errName");
    if (!normalizePhone(val("phone"))) fail("phone", "errPhone");
    if (!val("street")) fail("street", "errRequired");
    if (!val("size")) fail("size", "errChoose");
    if (qty() < 1) fail("qty", "errQty");
    if (!val("payment")) fail("payment", "errChoose");

    var box = $("#form-error");
    box.hidden = ok;
    box.textContent = ok ? "" : plainT("errSummary");
    if (first && first.focus) first.focus({ preventScroll: false });
    return ok;
  }

  /* ================= Building the order ================= */
  function buildOrder() {
    var p = productById(val("size"));
    var q = qty();
    var date = getDeliveryDate();
    return {
      name: val("name"),
      phone: normalizePhone(val("phone")),
      street: val("street"),
      apt: val("apt"),
      floor: val("floor"),
      code: val("code"),
      notes: val("notes"),
      productId: p.id,
      productName: p.name,          // {en, he}
      qty: q,
      unitPrice: p.price,
      total: p.price * q,
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
    return o.orderType === "weekly" ? T.typeWeekly + " (" + T.typeWeeklySub + ")" : T.typeOnce;
  }
  function payLabel(o, l) {
    var T = TEXTS[l || lang];
    return o.payment === "bit" ? T.payBit : T.payCash;
  }
  function iceLabel(o, l) { return o.qty + " × " + (o.productName[l || lang] || o.productName.en); }
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
      whatToBring: o.qty + " × " + o.productName.en,
      size: o.productName.en,
      qty: o.qty,
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
    var qtyInput = $("#f-qty");

    $("#qty-minus").addEventListener("click", function () { qtyInput.value = Math.max(1, qty() - 1); updateTotal(); });
    $("#qty-plus").addEventListener("click", function () { qtyInput.value = Math.max(1, qty() + 1); updateTotal(); });
    qtyInput.addEventListener("input", updateTotal);
    qtyInput.addEventListener("blur", function () { if (qty() < 1) qtyInput.value = 1; updateTotal(); });

    form.addEventListener("change", function (e) {
      if (e.target.name === "payment") { updatePayBoxes(); setError("payment", ""); }
      if (e.target.name === "size") setError("size", "");
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
      qtyInput.value = 1;
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
    renderProducts();
    updatePayBoxes();
    updateTotal();
    updateWaLinks();
    initMusic();
    try { initMap(); } catch (e) { console.warn("Ice Drop: map failed", e); }
    $("#year").textContent = new Date().getFullYear();
    $("#lang-btn").addEventListener("click", function () { setLang(lang === "he" ? "en" : "he"); });

    // Update "which Friday" text if the page stays open past the cutoff
    setInterval(function () { if (!lastOrder) applyTexts(); }, 5 * 60 * 1000);

    // Animations: machine rain first, skate-stop right after
    FX.machineRain(function () {});
    setTimeout(FX.skateStop, FX.reducedMotion && FX.reducedMotion() ? 0 : 1400);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
