/* =====================================================================
   ICE DROP — GOOGLE SHEET BACKEND (Google Apps Script web app)
   ---------------------------------------------------------------------
   Tabs it uses (setup() creates them for you):
     • Orders    one row per order
     • Slots     delivery days you open (you control these)
     • Settings  prices, Bit number, WhatsApp number, cutoff, capacity

   The website:
     • READS prices + open delivery slots from this sheet  (doGet)
     • SENDS each order here                               (doPost)
   This script re-checks prices and slot space itself, with a lock,
   so two people can never overbook the same slot.

   HOW TO INSTALL (one time) — also in README.md:
     1. Create a Google Sheet (sheets.new), name it "Ice Drop Orders".
     2. Extensions → Apps Script. Delete what's there, paste this file, Save.
     3. Choose "setup" at the top and press ▶ Run. Allow the permissions.
     4. Deploy → New deployment → ⚙️ Web app
          Execute as: Me      Who has access: Anyone
        Copy the Web app URL (ends with /exec).
     5. Paste it into js/config.js → googleSheetUrl.
   After changing this script: Deploy → Manage deployments → ✏️ →
   Version: New version → Deploy (the URL stays the same).
   ===================================================================== */

var TZ = "Asia/Jerusalem";
var TAB_ORDERS = "Orders";
var TAB_SLOTS = "Slots";
var TAB_SETTINGS = "Settings";

var ORDER_HEADERS = [
  "Timestamp", "Order ID", "Language", "Name", "Phone", "Address", "Apt/Floor", "Notes",
  "Slot date", "Time window", "Bags qty", "Cooler package", "Total bags", "Total kg",
  "Regular price", "Final price", "Savings", "Payment method", "Payment status",
  "Own cooler (Y/N)", "Delivery status", "Order type"
];
var PAYMENT_STATUSES = ["Awaiting payment", "Paid", "Pay on delivery", "Cancelled"];
var DELIVERY_STATUSES = ["New", "Delivered", "Cancelled"];
var SLOT_HEADERS = ["Date", "Day name (fills in by itself)", "Time window (optional, e.g. 16:00-18:00)", "Capacity (bags)", "Open (TRUE/FALSE)"];

// Settings tab: column A = name (don't change it), B = value, C = what it means
var SETTINGS = [
  ["Price per bag (₪)",          6,   "Price of one bag (weekly price)"],
  ["One-time price increase (%)", 20, "One-time orders cost this much more than weekly (rounded to whole ₪). Delivery is always free."],
  ["Kg per bag",                 1.3, "How much ice is in one bag"],
  ["Max single bags",            4,   "Most loose bags someone can pick (bigger orders = cooler package)"],
  ["Quarter cooler bags",        5,   "Bags in a ¼ cooler"],
  ["Quarter cooler price (₪)",   28,  "Price of a ¼ cooler"],
  ["Half cooler bags",           10,  "Bags in a ½ cooler"],
  ["Half cooler price (₪)",      55,  "Price of a ½ cooler"],
  ["Full cooler bags",           20,  "Bags in a full cooler"],
  ["Full cooler price (₪)",      100, "Price of a full cooler"],
  ["Bit number",                 "058-590-9980", "Shown to customers who pay with Bit / PayBox"],
  ["WhatsApp number",            "058-590-9980", "Gets the WhatsApp order summaries"],
  ["Order cutoff time",          "20:00", "Orders close at this time the night before each delivery day"],
  ["Default capacity (bags)",    30,  "Used when a slot's Capacity is empty"],
  ["Alert email",                "",  "Who gets an email per order (empty = the sheet owner)"]
];

/* ---------------- Run once from the editor ---------------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);

  // Orders
  var o = ss.getSheetByName(TAB_ORDERS) || ss.insertSheet(TAB_ORDERS);
  if (o.getLastRow() === 0) {
    o.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
  }
  styleHeader_(o, ORDER_HEADERS.length, "#1e90d6");
  o.setFrozenRows(1);
  o.getRange("A:A").setNumberFormat("ddd d mmm, HH:mm");
  o.getRange("E:E").setNumberFormat("@");
  o.getRange("I:I").setNumberFormat("ddd d mmm yyyy");
  o.getRange("O:Q").setNumberFormat("\"₪\"#,##0");
  setDropdown_(o, colOf_("Payment status"), PAYMENT_STATUSES);
  setDropdown_(o, colOf_("Delivery status"), DELIVERY_STATUSES);
  var rules = [
    rowRule_(o, '=$U2="Delivered"', "#d9f7e3"),
    rowRule_(o, '=OR($U2="Cancelled",$S2="Cancelled")', "#f1f1f1"),
    rowRule_(o, '=$S2="Awaiting payment"', "#fff6dc")
  ];
  o.setConditionalFormatRules(rules);
  o.setColumnWidths(1, ORDER_HEADERS.length, 120);
  o.setColumnWidth(6, 200); o.setColumnWidth(8, 200);

  // Slots (with 3 example Fridays the first time)
  var s = ss.getSheetByName(TAB_SLOTS) || ss.insertSheet(TAB_SLOTS);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, SLOT_HEADERS.length).setValues([SLOT_HEADERS]);
    var d = new Date();
    var rows = [];
    for (var i = 1; rows.length < 3 && i < 30; i++) {
      var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (day.getDay() === 5) rows.push([day, "", "13:30-15:00", 30, true]);
    }
    s.getRange(2, 1, rows.length, 5).setValues(rows);
  }
  styleHeader_(s, SLOT_HEADERS.length, "#0b3d66");
  s.setFrozenRows(1);
  s.getRange("A2:A").setNumberFormat("ddd d mmm yyyy");
  // Day name fills itself in from the date
  s.getRange("B2").setFormula('=ARRAYFORMULA(IF(A2:A="","",TEXT(A2:A,"dddd")))');
  s.getRange("E2:E200").insertCheckboxes();
  s.setColumnWidths(1, 5, 150);

  // Settings
  var st = ss.getSheetByName(TAB_SETTINGS) || ss.insertSheet(TAB_SETTINGS);
  if (st.getLastRow() === 0) {
    st.getRange(1, 1, 1, 3).setValues([["Setting (don't change this column)", "Value", "What it means"]]);
    st.getRange(2, 1, SETTINGS.length, 3).setValues(SETTINGS);
    st.getRange("B2:B").setNumberFormat("@");  // keep "20:00" and phone numbers as text
    st.getRange(2, 2, SETTINGS.length, 1).setValues(SETTINGS.map(function (r) { return [String(r[1])]; }));
  }
  styleHeader_(st, 3, "#5bc0eb");
  st.setFrozenRows(1);
  st.setColumnWidth(1, 230); st.setColumnWidth(2, 140); st.setColumnWidth(3, 420);

  var def = ss.getSheetByName("Sheet1") || ss.getSheetByName("גיליון1");
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(def);
  ss.setActiveSheet(o);
  try { ss.toast("Ice Drop sheet is ready!", "Ice Drop", 5); } catch (e) {}
}

/* ---------------- Website reads settings + slots ---------------- */
function doGet(e) {
  try {
    var settings = readSettings_();
    return json_({ ok: true, settings: publicSettings_(settings), slots: listSlots_(settings) });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------------- Website sends an order ---------------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (err) { return json_({ ok: false, error: "busy" }); }
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (d.website) return json_({ ok: true, skipped: true });          // spam bot

    var settings = readSettings_();
    var name = clean_(d.name), phone = clean_(d.phone), street = clean_(d.street);
    if (!name || !phone || !street) return json_({ ok: false, error: "missing_fields" });

    // Recalculate the price here (never trust the browser)
    var weekly = d.orderType === "weekly";
    var p = price_(settings, d.bags, d.cooler, weekly);
    if (p.totalBags < 1) return json_({ ok: false, error: "no_ice" });

    // Check the slot is still open and has room (we hold the lock)
    var slots = listSlots_(settings);
    var slot = null;
    for (var i = 0; i < slots.length; i++) if (slots[i].id === d.slotId) slot = slots[i];
    if (!slot) return json_({ ok: false, error: "slot_closed" });
    if (p.totalBags > slot.remaining) {
      return json_({ ok: false, error: "slot_full", remaining: slot.remaining, slots: listSlots_(settings) });
    }

    var id = nextOrderId_();
    var payMethod = d.payment === "bit" ? "Bit / PayBox" : "Cash on delivery";
    var payStatus = d.payment === "bit" ? "Awaiting payment" : "Pay on delivery";
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_ORDERS);
    ensureHeaders_(sheet);
    var row = [
      new Date(), id, d.language === "en" ? "en" : "he", name, phone, street,
      clean_(d.apt), clean_(d.notes), parseIsoDate_(slot.date), slot.timeWindow,
      p.bags, p.coolerName, p.totalBags, p.totalKg, p.regular, p.final, p.savings,
      payMethod, payStatus, (p.cooler !== "none" && d.ownCooler) ? "Y" : "N", "New",
      weekly ? "Weekly" : "One-time"
    ];
    sheet.appendRow(row);

    try { sendAlert_(settings, id, row, slot); } catch (mailErr) { console.error(mailErr); }

    return json_({
      ok: true, orderId: id, paymentStatus: payStatus,
      slot: slot, price: p
    });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ===================== Helpers ===================== */
function readSettings_() {
  var s = {};
  SETTINGS.forEach(function (r) { s[r[0]] = r[1]; });                 // defaults
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_SETTINGS);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var key = String(r[0]).trim();
      if (key && r[1] !== "" && r[1] !== null) s[key] = r[1];
    });
  }
  var num = function (k) { var n = Number(s[k]); return isNaN(n) ? Number(defaultOf_(k)) : n; };
  return {
    pricePerBag: num("Price per bag (₪)"),
    oneTimeMarkup: num("One-time price increase (%)"),
    kgPerBag: num("Kg per bag"),
    maxBags: num("Max single bags"),
    packages: [
      { id: "quarter", bags: num("Quarter cooler bags"), price: num("Quarter cooler price (₪)") },
      { id: "half", bags: num("Half cooler bags"), price: num("Half cooler price (₪)") },
      { id: "full", bags: num("Full cooler bags"), price: num("Full cooler price (₪)") }
    ],
    bitNumber: String(s["Bit number"]),
    whatsappNumber: String(s["WhatsApp number"]),
    cutoff: timeText_(s["Order cutoff time"]) || "20:00",
    defaultCapacity: num("Default capacity (bags)"),
    alertEmail: String(s["Alert email"] || "")
  };
}
function defaultOf_(k) { for (var i = 0; i < SETTINGS.length; i++) if (SETTINGS[i][0] === k) return SETTINGS[i][1]; return 0; }
function publicSettings_(s) {
  return { pricePerBag: s.pricePerBag, oneTimeMarkup: s.oneTimeMarkup, kgPerBag: s.kgPerBag, maxBags: s.maxBags, packages: s.packages,
           bitNumber: s.bitNumber, whatsappNumber: s.whatsappNumber, cutoff: s.cutoff };
}

var COOLER_NAMES = { none: "None", quarter: "¼ cooler", half: "½ cooler", full: "Full cooler" };
// Weekly = the prices in Settings. One-time = those prices + the one-time increase.
function up_(s, price, weekly) { return weekly ? price : Math.round(price * (1 + s.oneTimeMarkup / 100)); }
function price_(s, bags, cooler, weekly) {
  bags = Math.max(0, Math.min(s.maxBags, Math.floor(Number(bags) || 0)));
  var pkg = null;
  s.packages.forEach(function (p) { if (p.id === cooler) pkg = p; });
  var bagPrice = up_(s, s.pricePerBag, weekly);
  var totalBags = bags + (pkg ? pkg.bags : 0);
  var regular = totalBags * bagPrice;
  var final = bags * bagPrice + (pkg ? up_(s, pkg.price, weekly) : 0);
  return {
    bags: bags, cooler: pkg ? pkg.id : "none", coolerName: COOLER_NAMES[pkg ? pkg.id : "none"],
    totalBags: totalBags, totalKg: Math.round(totalBags * s.kgPerBag * 10) / 10,
    regular: regular, final: final, savings: regular - final
  };
}

// All slots that are open and before the cutoff, with bags remaining.
function listSlots_(s) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_SLOTS);
  if (!sh || sh.getLastRow() < 2) return [];
  var now = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
  var used = bagsUsed_();
  var out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
    var date = dateText_(r[0]);
    if (!date) return;
    var open = r[4] === true || String(r[4]).toUpperCase() === "TRUE";
    if (!open) return;
    var cutoff = shiftDate_(date, -1) + " " + s.cutoff;               // e.g. the night before at 20:00
    if (now >= cutoff) return;
    var win = timeText_(r[2]);
    var cap = Number(r[3]) || s.defaultCapacity;
    var id = date + "|" + win;
    var taken = used.once[id] || 0;
    used.weekly.forEach(function (w) {                                  // weekly customers come back every week
      if (w.win === win && w.date <= date && weekday_(w.date) === weekday_(date)) taken += w.bags;
    });
    var remaining = Math.max(0, cap - taken);
    out.push({ id: id, date: date, timeWindow: win, capacity: cap, remaining: remaining, soldOut: remaining === 0 });
  });
  out.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  return out;
}

// Bags already booked: one-time orders per slot, weekly orders as a list (cancelled orders don't count)
function bagsUsed_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_ORDERS);
  var used = { once: {}, weekly: [] };
  if (!sh || sh.getLastRow() < 2) return used;
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var c = function (name) { return head.indexOf(name); };
  var iDate = c("Slot date"), iWin = c("Time window"), iBags = c("Total bags"), iPay = c("Payment status"),
      iDel = c("Delivery status"), iType = c("Order type");
  sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().forEach(function (r) {
    if (r[iPay] === "Cancelled" || r[iDel] === "Cancelled") return;
    var date = dateText_(r[iDate]), win = timeText_(r[iWin]), bags = Number(r[iBags]) || 0;
    if (iType >= 0 && r[iType] === "Weekly") used.weekly.push({ date: date, win: win, bags: bags });
    else used.once[date + "|" + win] = (used.once[date + "|" + win] || 0) + bags;
  });
  return used;
}
function weekday_(iso) { var p = iso.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }

// Adds any new column headers (e.g. "Order type") to an Orders tab made by an older version
function ensureHeaders_(sh) {
  var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  ORDER_HEADERS.forEach(function (h, i) {
    if (have.indexOf(h) === -1) sh.getRange(1, i + 1).setValue(h).setFontWeight("bold").setFontColor("#ffffff").setBackground("#1e90d6");
  });
}

function nextOrderId_() {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty("lastOrderId") || 1000) + 1;
  props.setProperty("lastOrderId", String(n));
  return String(n);
}

function sendAlert_(s, id, row, slot) {
  var to = s.alertEmail || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var h = ORDER_HEADERS, v = function (name) { return row[h.indexOf(name)]; };
  var when = slot.date + (slot.timeWindow ? " " + slot.timeWindow : "");
  var subject = (v("Order type") === "Weekly" ? "New WEEKLY Ice Drop order #" : "New Ice Drop order #") + id + ": " + v("Total bags") + " bags, ₪" + v("Final price") + " (" + when + ")";
  var body = [
    "Order #" + id + " (" + v("Order type") + ")",
    "Delivery: " + when,
    "Name: " + v("Name"), "Phone: " + v("Phone"),
    "Address: " + v("Address") + (v("Apt/Floor") ? ", " + v("Apt/Floor") : ""),
    "Ice: " + (v("Bags qty") ? v("Bags qty") + " bag(s)" : "") + (v("Cooler package") !== "None" ? (v("Bags qty") ? " + " : "") + v("Cooler package") : ""),
    "Total: " + v("Total bags") + " bags (" + v("Total kg") + " kg), ₪" + v("Final price") + (v("Order type") === "Weekly" ? " every week" : "") + (v("Savings") ? " (saved ₪" + v("Savings") + ")" : ""),
    "Own cooler: " + v("Own cooler (Y/N)"),
    "Payment: " + v("Payment method") + " (" + v("Payment status") + ")",
    "Notes: " + (v("Notes") || "-"),
    "", SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ].join("\n");
  MailApp.sendEmail(to, subject, body);
}

function dateText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v || ""));
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(String(v || ""));       // 13/11/2026
  if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  return "";
}
function timeText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "HH:mm");
  return String(v == null ? "" : v).trim().replace(/\s*[-–]\s*/, "-");
}
function shiftDate_(iso, days) {
  var p = iso.split("-").map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days));
  return d.toISOString().slice(0, 10);
}
function parseIsoDate_(iso) {
  var p = iso.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
}
function clean_(v) {
  var s = String(v == null ? "" : v).trim().slice(0, 300);
  if (/^[=+\-@]/.test(s)) s = "'" + s;   // block spreadsheet formulas
  return s;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function colOf_(name) { return ORDER_HEADERS.indexOf(name) + 1; }
function styleHeader_(sh, n, color) {
  sh.getRange(1, 1, 1, n).setFontWeight("bold").setFontColor("#ffffff").setBackground(color)
    .setWrap(true).setVerticalAlignment("middle");
  sh.setRowHeight(1, 36);
}
function setDropdown_(sh, col, list) {
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  sh.getRange(2, col, sh.getMaxRows() - 1, 1).setDataValidation(rule);
}
function rowRule_(sh, formula, color) {
  return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setBackground(color)
    .setRanges([sh.getRange(2, 1, sh.getMaxRows() - 1, ORDER_HEADERS.length)]).build();
}
