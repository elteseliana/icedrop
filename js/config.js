/* =====================================================================
   🧊 ICE DROP — SETTINGS FILE
   ---------------------------------------------------------------------
   This is the ONE file you edit to change prices, bags, delivery times,
   phone numbers, the map and the music.

   Rules for editing safely:
   • Keep the quotes "like this" around words.
   • Keep the commas at the end of lines.
   • Numbers (like prices) have NO quotes:  price: 10,
   • After editing, save, refresh the website, and check it still works.
   ===================================================================== */

window.ICE_DROP_CONFIG = {

  /* ---------- 🛍️ PRODUCTS ----------
     To add a new bag or bundle: copy one whole { ... } block,
     paste it below the last one (add a comma between blocks),
     and give it a NEW id (lowercase, no spaces).               */
  products: [
    {
      id: "small",
      emoji: "🧊",
      name:   { en: "Small bag", he: "שקית קטנה" },
      weight: { en: "? kg", he: "? ק״ג" },          // ⚠️ TODO: put the real weight, e.g. "2 kg" / "2 ק״ג"
      blurb:  { en: "Perfect for drinks at home", he: "מושלם לשתייה קרה בבית" },
      price: 10                                      // in NIS (₪)
    },
    {
      id: "large",
      emoji: "🧊🧊",
      name:   { en: "Large bag", he: "שקית גדולה" },
      weight: { en: "? kg", he: "? ק״ג" },          // ⚠️ TODO: put the real weight
      blurb:  { en: "For parties, coolers & heatwaves", he: "למסיבות, צידניות וגלי חום" },
      price: 18,
      popular: true                                  // shows a "Most popular" sticker
    }
    /* Example of a bundle you could add later (remove the  /*  and  *\/ ):
    ,{
      id: "party",
      emoji: "🎉",
      name:   { en: "Party pack (3 large)", he: "חבילת מסיבה (3 גדולות)" },
      weight: { en: "? kg", he: "? ק״ג" },
      blurb:  { en: "Big summer party? Done.", he: "מסיבת קיץ גדולה? סגור." },
      price: 50
    }
    */
  ],

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
