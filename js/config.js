/* =====================================================================
   🧊 ICE DROP — SETTINGS FILE
   ---------------------------------------------------------------------
   This is the ONE file you edit to change prices, delivery times,
   phone numbers, the map and the music.

   Rules for editing safely:
   • Keep the quotes "like this" around words.
   • Keep the commas at the end of lines.
   • Numbers (like prices) have NO quotes:  pricePerKg: 6,
   • After editing, save, refresh the website, and check it still works.
   ===================================================================== */

window.ICE_DROP_CONFIG = {

  /* ---------- 🧊 ICE & PRICES ----------
     Ice is sold by the kilo. The order form shows a dropdown
     from minKg to maxKg (2 kg, 3 kg, 4 kg …).                    */
  ice: {
    pricePerKg: 6,          // ₪ per kilo  (2 kg = ₪12)
    minKg: 2,               // smallest order
    maxKg: 30,              // biggest choice in the dropdown (just raise it if you want)
    deliveryFee: 6,         // ₪ delivery
    freeDeliveryFromKg: 3   // delivery is FREE from this many kilos
  },

  currency: "₪",

  /* ---------- 🚚 DELIVERY DAY & TIME ----------
     Days are numbers: 0 = Sunday, 1 = Monday, 2 = Tuesday,
     3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday      */
  delivery: {
    day: 5,                       // 5 = Friday
    timeWindow: "1:30–3:00 pm",   // shown in English
    timeWindowHe: "13:30–15:00",  // shown in Hebrew
    cutoffDay: 4,                 // 4 = Thursday (last day to order for this week)
    cutoffHour: 12,               // 12 = 12:00 noon (24-hour clock, Israel time)
    cutoffMinute: 0,
    timeZone: "Asia/Jerusalem"
  },

  /* ---------- 💬 WHATSAPP & 📱 BIT ---------- */
  contact: {
    whatsappNumber: "058-590-9980",  // shown on the site
    whatsappIntl:   "972585909980",  // same number for WhatsApp links: 972 + number WITHOUT the first 0, no dashes
    bitNumber:      "058-590-9980"
  },

  // ⚠️ BIT PAYMENT LINK — paste your Bit payment link between the quotes.
  // Leave it empty ("") and the "Pay with Bit" button will copy the
  // phone number and tell the customer to send the money in the Bit app.
  bitPaymentLink: "",

  /* ---------- 📊 GOOGLE SHEET ----------
     Paste your Google Apps Script "Web app URL" here
     (see README.md, step "Connect the Google Sheet").
     It looks like: https://script.google.com/macros/s/AKfy..../exec    */
  googleSheetUrl: "",

  /* ---------- 🗺️ DELIVERY AREA MAP ----------
     Center of the circle. To change it: open openstreetmap.org,
     right-click your spot → "Show address", and copy the two
     numbers (latitude, longitude).                                    */
  map: {
    centerLat: 32.18745,     // ⚠️ approximate: middle of Achi Dakar St. — please check (see README)
    centerLng: 34.88075,
    radiusMeters: 800,       // about a 10-minute walk
    zoom: 15
  },

  /* ---------- 🎵 MUSIC ---------- */
  spotifyEmbedUrl: "https://open.spotify.com/embed/track/11d9oUiwHuYt216EFA2tiz",

  /* ---------- 🌐 LANGUAGE ---------- */
  defaultLanguage: "he"      // "he" = Hebrew first, "en" = English first
};
