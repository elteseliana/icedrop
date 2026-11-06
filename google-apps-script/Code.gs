/* =====================================================================
   🧊 ICE DROP — GOOGLE SHEET ORDER RECEIVER (Google Apps Script)
   ---------------------------------------------------------------------
   What this does:
     • Every order from the website lands in this Google Sheet.
     • One-time orders go to the tab  "🧊 One-Time Orders"
     • Weekly orders go to the tab    "📅 Weekly Customers"
     • You get a short email for every new order.

   HOW TO INSTALL (one time, about 5 minutes) — also in README.md:
     1. Create a new Google Sheet (sheets.new). Name it "Ice Drop Orders".
     2. In the sheet: Extensions → Apps Script.
     3. Delete everything in the editor, paste ALL of this file, click 💾 Save.
     4. At the top, pick the function "setup" and click ▶ Run.
        Google asks for permission → choose your account → "Advanced"
        → "Go to … (unsafe)" → Allow. (It's your own script, it's safe.)
        Your two tabs appear with pretty headers.
     5. Click "Deploy" → "New deployment" → ⚙️ → "Web app".
          Execute as:      Me
          Who has access:  Anyone
        Click Deploy and COPY the "Web app URL" (ends with /exec).
     6. Paste that URL into js/config.js → googleSheetUrl: "…"
     7. Send a test order on the website. It should appear in the sheet!

   If you change this script later: Deploy → Manage deployments → ✏️ Edit
   → Version: "New version" → Deploy. (The URL stays the same.)
   ===================================================================== */

// ✉️ Where to send the "new order" email. Leave "" to use your own Google email.
var ALERT_EMAIL = "";

// Set to false if you don't want emails.
var SEND_EMAILS = true;

var TAB_ONCE   = "🧊 One-Time Orders";
var TAB_WEEKLY = "📅 Weekly Customers";

var HEADERS = [
  "📆 Date ordered",
  "🚚 Delivery Friday",
  "🙂 Name",
  "📞 Phone",
  "🏠 Address (apt / floor / code)",
  "🧊 What to bring",
  "💳 How they pay",
  "💵 Money to collect (NIS)",
  "📝 Notes",
  "Paid 💰"
];
var COLUMN_WIDTHS = [150, 190, 150, 130, 300, 170, 200, 130, 260, 80];
var HEADER_COLORS = { once: "#3fa9f5", weekly: "#7c4dff" };

/* ---------- Run this ONCE from the editor (▶ Run → setup) ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone("Asia/Jerusalem");
  var once = getOrCreateTab_(TAB_ONCE, HEADER_COLORS.once);
  getOrCreateTab_(TAB_WEEKLY, HEADER_COLORS.weekly);

  // Remove the empty default "Sheet1" if it's still there
  var def = ss.getSheetByName("Sheet1") || ss.getSheetByName("גיליון1");
  if (def && ss.getSheets().length > 2 && def.getLastRow() === 0) ss.deleteSheet(def);
  ss.setActiveSheet(once);
  safeToast_("Ice Drop sheet is ready! 🧊");
}

/* ---------- The website sends orders here ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Spam bots fill in the hidden "website" field. People don't.
    if (data.website) return json_({ ok: true, skipped: true });
    if (!data.name || !data.phone) return json_({ ok: false, error: "missing name/phone" });

    var weekly = data.orderType === "weekly";
    var sheet = getOrCreateTab_(weekly ? TAB_WEEKLY : TAB_ONCE, weekly ? HEADER_COLORS.weekly : HEADER_COLORS.once);

    var payText = data.payment === "Bit" ? "📱 Bit (check the Bit app)" : "💵 Cash (collect at the door)";
    var total = Number(data.total) || 0;
    var delivery = parseIsoDate_(data.deliveryFriday);

    var row = [
      new Date(),
      delivery || clean_(data.deliveryFridayText),
      clean_(data.name),
      clean_(data.phone),
      clean_(data.address),
      clean_(data.whatToBring),
      payText,
      total,
      clean_(data.notes),
      false
    ];
    sheet.appendRow(row);
    var r = sheet.getLastRow();
    sheet.getRange(r, 10).insertCheckboxes();
    sheet.getRange(r, 1, 1, HEADERS.length).setVerticalAlignment("middle").setFontSize(12);

    if (SEND_EMAILS) sendAlert_(data, weekly, payText, total);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* Open the Web app URL in a browser to check it's alive. */
function doGet() {
  return ContentService.createTextOutput("🧊 Ice Drop order receiver is running! ✅");
}

/* ---------- Helpers ---------- */
function getOrCreateTab_(name, color) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;

  sh = ss.insertSheet(name);
  sh.setTabColor(color);
  sh.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight("bold").setFontSize(13).setFontColor("#ffffff")
    .setBackground(color).setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setWrap(true);
  sh.setRowHeight(1, 44);
  sh.setFrozenRows(1);
  COLUMN_WIDTHS.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var maxRows = sh.getMaxRows();
  sh.getRange(2, 1, maxRows - 1, 1).setNumberFormat("ddd d mmm, HH:mm");   // Date ordered
  sh.getRange(2, 2, maxRows - 1, 1).setNumberFormat("dddd d mmm yyyy");    // Delivery Friday
  sh.getRange(2, 4, maxRows - 1, 1).setNumberFormat("@");                  // Phone as text (keeps the 0)
  sh.getRange(2, 8, maxRows - 1, 1).setNumberFormat("\"₪\"#,##0");         // Money
  sh.getRange(2, 5, maxRows - 1, 1).setWrap(true);
  sh.getRange(2, 9, maxRows - 1, 1).setWrap(true);
  sh.getRange(2, 8, maxRows - 1, 3).setHorizontalAlignment("center");

  // Light stripes so rows are easy to follow
  sh.getRange(2, 1, maxRows - 1, HEADERS.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);

  // When "Paid 💰" is ticked, the whole row turns green ✅
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied("=$J2=TRUE")
    .setBackground("#c8f7d4")
    .setRanges([sh.getRange(2, 1, maxRows - 1, HEADERS.length)])
    .build();
  sh.setConditionalFormatRules([rule]);
  return sh;
}

function sendAlert_(d, weekly, payText, total) {
  var to = ALERT_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var subject = "🧊 New Ice Drop order: " + (d.name || "") + ", " + (d.whatToBring || "") + " (₪" + total + ")";
  var body = [
    weekly ? "📅 NEW WEEKLY CUSTOMER" : "🧊 New one-time order",
    "",
    "Name: " + (d.name || ""),
    "Phone: " + (d.phone || ""),
    "Address: " + (d.address || ""),
    "What to bring: " + (d.whatToBring || ""),
    "Pays with: " + payText,
    "Money to collect: ₪" + total + (weekly ? " (every week)" : ""),
    "Delivery: " + (d.deliveryFridayText || d.deliveryFriday || ""),
    "Notes: " + (d.notes || "-"),
    "",
    "Open the Google Sheet to see all orders:",
    SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ].join("\n");
  MailApp.sendEmail(to, subject, body);
}

// Stops sneaky "formulas" from being typed into the sheet, and trims long text
function clean_(v) {
  var s = String(v == null ? "" : v).trim().slice(0, 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function parseIsoDate_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0) : null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeToast_(msg) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Ice Drop", 5); } catch (e) {}
}

/* ---------- Optional: run this to add a fake order and test everything ---------- */
function testOrder() {
  doPost({ postData: { contents: JSON.stringify({
    orderType: "once",
    deliveryFriday: "2026-11-13",
    deliveryFridayText: "Friday, Nov 13",
    name: "Test Person",
    phone: "050-123-4567",
    address: "Test Street 1, Apt. 2, Floor 1, Code 1234",
    whatToBring: "2 × Large bag",
    payment: "Cash",
    total: 36,
    notes: "This is a test, you can delete this row"
  }) } });
}
