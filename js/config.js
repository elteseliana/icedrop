/* =====================================================================
   ICE DROP — WEBSITE SETTINGS
   ---------------------------------------------------------------------
   Prices, delivery days, Bit + WhatsApp numbers and the order cutoff
   now live in the GOOGLE SHEET (tabs "Settings" and "Slots"), so you
   can change them without touching code.

   This file only has things the Sheet doesn't:
   the Sheet link, the map, the music and the language.

   Rules: keep the "quotes" and the commas at the ends of lines.
   ===================================================================== */

window.ICE_DROP_CONFIG = {

  /* ---------- GOOGLE SHEET ----------
     Paste your Apps Script "Web app URL" here (ends with /exec).
     Empty = demo mode: the site works, but orders are NOT saved.   */
  googleSheetUrl: "https://script.google.com/macros/s/AKfycbxEqktRexWFOf8TLvnJsfWgkb9on_hvnVteo9zTe6LllKgBT88owxNg_LcOVE59s5q1/exec",

  /* ---------- THE MAKOLET COMPARISON (headline) ---------- */
  makolet: { kg: 2, price: 12 },

  /* ---------- MAP ----------
     The circle shows the delivery area (~10-minute walk).
     The center is the middle of Ahi Dakar St. (no house number shown). */
  map: {
    centerLat: 32.18745,
    centerLng: 34.88075,
    radiusMeters: 800,       // used only if "area" below is empty
    zoom: 15,
    // The delivery area: south of Weizmann Blvd, west of Highway 4, north of Ahuza.
    // Each line is one corner: [latitude, longitude]. Leave it empty [] to show a circle instead.
    area: [
      [32.1913, 34.8732], [32.1916, 34.8770], [32.1912, 34.8810], [32.1906, 34.8845],
      [32.1898, 34.8870], [32.1885, 34.8879], [32.1860, 34.8880], [32.1835, 34.8879],
      [32.1818, 34.8870], [32.1808, 34.8845], [32.1804, 34.8810], [32.1805, 34.8775],
      [32.1810, 34.8748], [32.1823, 34.8731], [32.1845, 34.8724], [32.1875, 34.8723],
      [32.1900, 34.8726]
    ]
  },

  /* ---------- MUSIC ----------
     "Ice Ice Baby" plays only when someone taps the music button at the
     top of the page (Spotify's player). Nothing plays by itself.
     musicFile: optional, a music file of your own that you have the rights
                to use, e.g. "assets/audio/song.mp3" (played instead).   */
  spotifyEmbedUrl: "https://open.spotify.com/embed/track/11d9oUiwHuYt216EFA2tiz",
  musicFile: "",

  /* ---------- LANGUAGE ---------- */
  defaultLanguage: "he",   // "he" = Hebrew first, "en" = English first

  currency: "₪",

  /* ---------- BACKUP SETTINGS ----------
     Only used in demo mode or if the Sheet can't be reached.
     The real values come from the Sheet's "Settings" tab.          */
  fallback: {
    pricePerBag: 6,           // weekly price
    oneTimeMarkup: 20,        // one-time orders cost 20% more
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
