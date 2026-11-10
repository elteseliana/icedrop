/* =====================================================================
   ICE DROP — WEBSITE SETTINGS
   ---------------------------------------------------------------------
   Prices, delivery days, Bit + WhatsApp numbers and the order cutoff
   now live in the GOOGLE SHEET (tabs "Settings" and "Slots"), so you
   can change them without touching code.

   This file only has things the Sheet doesn't:
   the Sheet link, the map, the music, the photo and the language.

   Rules: keep the "quotes" and the commas at the ends of lines.
   ===================================================================== */

window.ICE_DROP_CONFIG = {

  /* ---------- GOOGLE SHEET ----------
     Paste your Apps Script "Web app URL" here (ends with /exec).
     Empty = demo mode: the site works, but orders are NOT saved.   */
  googleSheetUrl: "",

  /* ---------- PHOTO ----------
     Photo of the ice guy with the red wagon and Igloo cooler.
     Put the picture in assets/img/ and write its name here,
     e.g. "assets/img/wagon.jpg". Empty = the photo section is hidden. */
  photo: "",

  /* ---------- THE MAKOLET COMPARISON (headline) ---------- */
  makolet: { kg: 2, price: 12 },

  /* ---------- MAP ----------
     The circle shows the delivery area (~10-minute walk).
     The center is the middle of Ahi Dakar St. (no house number shown). */
  map: {
    centerLat: 32.18745,
    centerLng: 34.88075,
    radiusMeters: 800,
    zoom: 15
  },

  /* ---------- MUSIC ---------- */
  spotifyEmbedUrl: "https://open.spotify.com/embed/track/11d9oUiwHuYt216EFA2tiz",

  /* ---------- LANGUAGE ---------- */
  defaultLanguage: "he",   // "he" = Hebrew first, "en" = English first

  currency: "₪",

  /* ---------- BACKUP SETTINGS ----------
     Only used in demo mode or if the Sheet can't be reached.
     The real values come from the Sheet's "Settings" tab.          */
  fallback: {
    pricePerBag: 6,
    kgPerBag: 1.3,
    maxBags: 4,
    packages: [
      { id: "quarter", bags: 5,  price: 28 },
      { id: "half",    bags: 10, price: 55 },
      { id: "full",    bags: 20, price: 100 }
    ],
    bitNumber: "058-590-9980",
    whatsappNumber: "058-590-9980",
    cutoff: "20:00"
  }
};
