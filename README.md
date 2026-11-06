# 🧊 Ice Drop website

Ice delivery in Ra'anana, every Friday. Plain HTML, CSS and JavaScript, with no build step and nothing to install.

## 📁 What's in here

| File | What it is | Edit it? |
|---|---|---|
| `js/config.js` | **Settings**: price per kilo, kilo choices, delivery fee & free-delivery amount, delivery day/time, cutoff, WhatsApp/Bit number, Bit link, Google Sheet link, map center, Spotify link | ✅ Yes, this is the main one |
| `js/texts.js` | **All the words** on the site, in English and Hebrew | ✅ Yes |
| `index.html` | The page layout | Only for layout changes |
| `css/style.css` | Colors, fonts and design. The brand colors (navy, Ice Drop Blue, glacier, frost, snow) are at the very top | Sometimes |
| `js/main.js`, `js/animations.js` | How things work | Usually no |
| `assets/` | Logo and favicon (SVG). `assets/img/` has the ice photos (swap a photo by saving a new one with the same name) | Optional |
| `google-apps-script/Code.gs` | Script that puts orders in your Google Sheet | Paste into Google once |

## ✏️ Common changes

- **Change the price per kilo:** `js/config.js` → `pricePerKg: 6,`
- **Smallest / biggest order in the dropdown:** `minKg: 2,` and `maxKg: 30,`
- **Delivery fee and free delivery:** `deliveryFee: 6,` and `freeDeliveryFromKg: 3,`
  The price list, dropdown, total and WhatsApp message all update by themselves.
- **Change a sentence:** `js/texts.js`. Change both `en` and `he`.
- **Bit payment link:** `js/config.js` → `bitPaymentLink: ""` → paste your link between the quotes.

> Tip: after editing on GitHub, wait about 1 minute and refresh the site (on phones you might need to pull down to refresh twice).

## 📊 Connect the Google Sheet (do this once)

1. Go to **sheets.new** (signed in to your Google account). Name the sheet **Ice Drop Orders**.
2. Menu **Extensions → Apps Script**.
3. Delete what's in the editor. Open `google-apps-script/Code.gs` from this project, copy **all** of it, paste, then click 💾 **Save**.
4. In the bar at the top, choose the function **`setup`** and click **▶ Run**.
   Google will ask for permission: choose your account → **Advanced** → **Go to … (unsafe)** → **Allow**. (It's your own script.)
   Two tabs appear: **🧊 One-Time Orders** and **📅 Weekly Customers**.
5. Click **Deploy → New deployment**. Click the ⚙️ next to "Select type" and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. Paste it in `js/config.js`: `googleSheetUrl: "https://script.google.com/macros/s/…/exec",`
7. Send a test order on the website. It shows up in the sheet, and you get an email. 🎉

**Reading the sheet:** each row is one order. When you get paid, tick **Paid 💰** and the row turns green ✅.
Want emails to go to a different address? In the script, set `ALERT_EMAIL = "you@example.com"`.
If you edit the script later: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**

## 🗺️ Check the map center

The circle is centered on the middle of Achi Dakar Street, based on OpenStreetMap. To make it exact:
1. Go to **openstreetmap.org**, search "אח״י דקר רעננה", and find number 62.
2. Right-click the exact spot → **Show address**. On the left you'll see two numbers like `32.18745, 34.88075`.
3. Put them in `js/config.js` → `centerLat` (first number) and `centerLng` (second number).

(Or in Google Maps: right-click the house and click the numbers at the top of the menu to copy them.)

## 🚀 Put it online with GitHub Pages (free)

1. On GitHub, open the repository → **Settings → Pages**.
2. Under "Build and deployment": Source **Deploy from a branch**, Branch **main**, folder **/ (root)** → **Save**.
3. After 1–2 minutes your site is live at `https://<your-username>.github.io/<repo-name>/`.

## 🌐 Connecting icedrop.co.il later

1. Buy the domain from an Israeli registrar (`.co.il` domains are sold by registrars accredited by ISOC-IL).
2. In the registrar's DNS settings add:
   - Four **A** records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One **CNAME** record for `www` → `<your-username>.github.io`
3. On GitHub: **Settings → Pages → Custom domain** → type `icedrop.co.il` → Save. (GitHub creates a `CNAME` file for you.)
4. When the check turns green, tick **Enforce HTTPS**. DNS can take a few hours.

Nothing in the site needs to change, because all links are relative.

## 🎨 Notes

- When the page opens, frost creeps in from the edges of the screen and melts away. After an order, 3D ice cubes fall from the top. Both turn off automatically for visitors whose device is set to "reduce motion".
- Fonts: Montserrat (headings, like the logo) and Heebo (body text and all Hebrew).
- The site remembers each visitor's language choice (Hebrew/English).
- Music is Spotify's official player. The song isn't stored on the site.
- The order button sends the order to the Google Sheet. The thank-you screen also has a big WhatsApp button as a backup.
