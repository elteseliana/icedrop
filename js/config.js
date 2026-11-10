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
    radiusMeters: 800,
    zoom: 15
  },

  /* ---------- MUSIC ----------
     Plays when the visitor taps "Tap to enter" (browsers don't allow
     sound before a tap). Uses YouTube's official video player.
     youtubeVideoId: the part after "watch?v=" in a YouTube link.
     musicStartAt:   second to start from (0 = the beginning).
     musicFile:      optional: a music file of your own that you have the
                     rights to use, e.g. "assets/audio/song.mp3".
                     When set, it is played instead of YouTube.
     autoPlayMusic:  false = only play when the music button is pressed. */
  youtubeVideoId: "rog8ou-ZepE",     // Vanilla Ice - Ice Ice Baby (official video, vanillaiceVEVO)
  // backup if YouTube refuses to play the video on other websites:
  spotifyEmbedUrl: "https://open.spotify.com/embed/track/11d9oUiwHuYt216EFA2tiz",
  musicStartAt: 0,
  musicFile: "",
  autoPlayMusic: true,

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
