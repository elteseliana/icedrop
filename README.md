# Ice Drop website

Fresh ice delivery in Ra'anana: **30% more ice than the makolet. Delivered. Same price.**
Plain HTML, CSS and JavaScript, with no build step and nothing to install. Orders go into a Google Sheet.

## Where things live

| What you want to change | Where |
|---|---|
| Prices, cooler packages, Bit number, WhatsApp number, order cutoff, default capacity | **Google Sheet → `Settings` tab** (no code!) |
| Delivery days / time windows / how many bags per day / open or closed | **Google Sheet → `Slots` tab** |
| Order status (paid, delivered, cancelled) | **Google Sheet → `Orders` tab** |
| Sheet link, map, music, makolet comparison, default language | `js/config.js` |
| Any sentence on the site (English + Hebrew) | `js/texts.js` |
| Colors and fonts | top of `css/style.css` |
| The Google Sheet backend | `google-apps-script/Code.gs` (paste into the Sheet once) |

## 1. Connect the Google Sheet (one time, ~5 minutes)

1. Go to **sheets.new**, name the sheet **Ice Drop Orders**.
2. **Extensions → Apps Script**. Delete what's there, paste all of `google-apps-script/Code.gs`, click **Save**.
3. Choose **`setup`** at the top and press **▶ Run**. Allow the permissions (your account → Advanced → Go to … → Allow).
   Three tabs appear: **Orders**, **Slots** (with 3 example Fridays) and **Settings**.
4. **Deploy → New deployment → ⚙️ → Web app**. Execute as **Me**, Who has access **Anyone** → **Deploy**. Copy the **Web app URL** (ends with `/exec`).
5. Paste it into `js/config.js`: `googleSheetUrl: "https://script.google.com/macros/s/…/exec",`
6. Refresh the site. The yellow "Demo mode" bar disappears, and the delivery days come from your Sheet. Place a test order, then cancel it (see below).

If you change the script later: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (the URL stays the same).

## 2. Running the business from the Sheet

**Slots tab: delivery days**
- The days listed under **Delivery days** in Settings (Monday, Friday) are added by themselves for this week and next week. Just type the **Time window**. The website shows this week + next week only.
- One row per delivery: **Date**, optional **Time window** (e.g. `16:00-18:00`), **Capacity (bags)** (empty = the default, 30), **Open** (tick = open).
- Day name fills in by itself.
- A day disappears from the site when: Open is unticked, or it's past the cutoff (default **20:00 the night before**).
- When all bags are taken, the day shows as **"Sold out, pick another day"**.
- The site and the script both check capacity, with a lock, so two people can't overbook the same day.

**Orders tab: one row per order**
- **Payment status**: Awaiting payment / Paid / Pay on delivery / Cancelled.
- **Delivery status**: New / Delivered / Cancelled.
- Setting either one to **Cancelled** frees up those bags for that day.
- Colors: yellow = awaiting payment, green = delivered, grey = cancelled.
- Each new order also sends an email (to the Sheet owner, or to the "Alert email" in Settings).

**Weekly payments tab**: every week each weekly customer gets a row (date, name, phone, amount). Send them a Bit payment request from the Bit app, tick **Bit request sent**, then **Paid** when it arrives. Rows for this week and next week appear by themselves when you open the Sheet (menu **Ice Drop → Refresh**).

**Settings tab**: change the value in column B. Don't change the names in column A. One-time orders cost **One-time price increase (%)** more than the weekly (member) prices.

## 3. Put it online with GitHub Pages (free)

Repository **Settings → Pages** → Source **Deploy from a branch**, Branch **main**, folder **/ (root)** → Save.
After 1–2 minutes it's live at `https://<username>.github.io/<repo-name>/`.

### Custom domain later (e.g. icedrop.co.il)
1. At the domain registrar's DNS add four **A** records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a **CNAME** for `www` → `<username>.github.io`.
2. GitHub **Settings → Pages → Custom domain** → `icedrop.co.il` → Save, then tick **Enforce HTTPS** once it's green.

## Notes
- The delivery area map shows a ~800 m circle (about a 10-minute walk) around the middle of Ahi Dakar St. No pin, no house number.
- The "30% more" headline is calculated from the bag price and kg per bag (Sheet) and the makolet numbers (`js/config.js`).
- When the page opens, frost creeps in from the screen edges. After an order, 3D ice cubes fall. Both turn off for visitors who ask for "reduce motion".
- The site remembers each visitor's language (Hebrew / English).
- Music: the site opens with a "Tap to enter" screen. That tap starts "Ice Ice Baby" (browsers don't allow sound before a tap). It plays through YouTube's official video player. If YouTube refuses to play the video on other websites, the site switches to Spotify automatically (full song for people logged in to Spotify, a 30-second preview for others). The header button is play/pause. To use your own music file instead, set `musicFile` in `js/config.js`. To turn auto-start off, set `autoPlayMusic: false`.
