# Smoove Cafe website

*stay a little longer.*

The website and table booking system for Smoove Cafe, Melksham.

- **Live site:** https://smoovecafe.co.uk/
- **Staff bookings page:** https://smoovecafe.co.uk/admin.html

---

## How it works (in plain English)

The site has three parts. All three are free.

| Part | What it does | Service | Cost |
|---|---|---|---|
| **The website** | The pages people see: Home, Menu, Book, Find us, Privacy | **GitHub Pages** hosts the files in this repository | £0 |
| **The booking "back end"** | Checks that a time is free, saves the booking, sends emails | **Google Apps Script**, a free mini-program that runs inside your Google account | £0 |
| **The bookings list** | Where bookings are stored | A private **Google Sheet** in your Google account | £0 |

When someone books:

1. They choose a date, number of people, start time and length on the website.
2. The website asks the Google back end which times are free. Only times are shared, never names.
3. When they press **Confirm booking**, the back end checks every rule again. It "locks" so two people can't grab the same table at the same moment, then saves the booking to the Google Sheet.
4. Google emails the customer a confirmation with a **cancel link**, and emails you an alert.
5. You see every booking on the **staff page** (password protected), and you can open the Google Sheet too.

### Free plan limits (you're very unlikely to hit these)

- **GitHub Pages:** free for public repositories. Limits: a 1 GB site and 100 GB of visitors' downloads a month (this site is under 1 MB).
- **Google Apps Script with a free Gmail account:** up to **100 emails a day**. Each booking sends 2 (customer + you), so that's about 50 bookings a day. With two tables you'll never get near it. A paid Google Workspace account raises this to 1,500.
- **Google Sheets:** 10 million cells. Enough for decades of bookings.

### The booking rules

- Two tables: **Table 1** seats up to 2, **Table 2** seats up to 6.
- Tuesday to Saturday only. Start times every 30 minutes from 10:00 to 13:30.
- Lengths: 30 minutes, 1 hour, 1 hour 30 or 2 hours. Every booking must end by 14:30, so the site only offers lengths that fit.
- 1–2 people get Table 1 if it's free, otherwise Table 2. 3–6 people get Table 2. Groups of 7 or more are asked to contact you.
- No double-booking, including overlaps of different lengths. Times that have passed (UK time) can't be booked.
- Customers can book as far ahead as they like.

---

## ✅ One-time setup: what you need to do

I've built and tested everything. These steps need *your* accounts, so only you can do them. Allow about 30 minutes.

### Step 1: Switch on the website (GitHub Pages)

1. Open your repository: https://github.com/tobiyus/Smoove-cafe-website-
2. Click **Settings** (top bar), then **Pages** (left-hand menu).
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
5. Wait 1–2 minutes and refresh. You'll see *"Your site is live at https://smoovecafe.co.uk/"*.

At this point the site works, but the Book page says *"Online booking is coming very soon"* until you finish Step 3.

### Step 2: Fill in your phone number, email and Just Eat link

1. In the repository, click the **js** folder, then **site-details.js**.
2. Click the **pencil icon ✏️** (top right of the file) to edit.
3. Fill in the parts between the quote marks, for example:
   ```js
   phone: '01225 123456',
   email: 'hello@smoovecafe.co.uk',
   justEat: 'https://www.just-eat.co.uk/restaurants-smoove-...',
   ```
4. Click **Commit changes…** (green button), then **Commit changes** again. The site updates in a minute or two.

### Step 3: Set up the booking system (Google)

Use the **Google account you want bookings emailed from and to** (e.g. the cafe's Gmail). Do this on a computer, not a phone.

> **Signed into more than one Google account?** (e.g. a personal Gmail and the cafe Gmail.) Google gets confused and opens things in your *first* account, and Apps Script shows **"Sorry, unable to open the file at present."** To avoid this, do the whole of Step 3 in a **private/incognito window** signed into the cafe account only, or in a separate Chrome profile for the cafe (profile picture top-right in Chrome → **Add**).

**3a. Create the bookings spreadsheet**

1. Go to https://sheets.new. This makes a new blank Google Sheet.
2. Click "Untitled spreadsheet" (top left) and rename it **Smoove bookings**.

**3b. Add the booking program**

1. In the spreadsheet menu, click **Extensions → Apps Script**. A new tab opens.
2. Click "Untitled project" at the top and rename it **Smoove bookings**.
3. In this GitHub repository, open **apps-script/Code.gs** and click the **Copy raw file** button (two overlapping squares, top right of the file).
4. Back in Apps Script, select everything in the editor (Ctrl+A, or ⌘A on a Mac), delete it, and paste (Ctrl+V / ⌘V).
5. Click the **Save** icon 💾.

**3c. Set your staff password (kept secret inside Google, never on GitHub)**

1. In Apps Script, click the **cog ⚙️ (Project Settings)** on the left.
2. Scroll to **Script Properties** → **Add script property**.
3. Property: `ADMIN_PASSWORD`. Value: a strong password only staff know (e.g. three random words and a number: `mango-teapot-river-42`).
4. *(Optional)* Add another property `OWNER_EMAIL` if alerts should go to a *different* email address from the Google account you're using.
5. Click **Save script properties**.

**3d. Run the setup once**

1. Click the **< > (Editor)** icon on the left.
2. At the top, in the drop-down next to **Run** / **Debug**, choose **setup**, then click **▶ Run**.
3. Google asks for permission. Click **Review permissions** → choose your account.
4. You'll see **"Google hasn't verified this app"**. That's normal, because it's your own private program, not a public app. Click **Advanced** → **Go to Smoove bookings (unsafe)** → **Allow**.
   *It asks to: see and edit this spreadsheet (to save bookings), send email as you (for confirmations), and run in the background (for the nightly tidy-up of old personal details).*
5. The log at the bottom should say **"Setup complete"**. A new **Bookings** tab appears in your spreadsheet.
6. *(Optional)* Choose **sendTestEmail** in the drop-down and press **Run** to check emails arrive.

**3e. Put it online**

1. Click **Deploy** (blue button, top right) → **New deployment**.
2. Click the cog next to "Select type" → **Web app**.
3. Description: `Smoove bookings`. **Execute as: Me**. **Who has access: Anyone**.
   *("Anyone" means the website can talk to it. People still can't see your spreadsheet. The program only ever reveals which times are taken.)*
4. Click **Deploy**, then copy the **Web app URL** (it starts `https://script.google.com/macros/s/…/exec`).

### Step 4: Connect the website to the booking system

1. On GitHub, edit **js/site-details.js** again (pencil icon ✏️).
2. Paste the URL between the quote marks on the last line:
   ```js
   bookingApiUrl: 'https://script.google.com/macros/s/AKfy...../exec'
   ```
3. Commit the change.

### Step 5: Test it yourself

1. On your phone, open the live site → **Book a table** and book a table for yourself using your own email.
2. Check you get the confirmation email, and that the alert arrives in the cafe inbox.
3. Open the **staff page** (`/admin.html`), sign in with your `ADMIN_PASSWORD`, and check the booking is there.
4. Use the **cancel link** in your email to cancel it, and check you get the cancellation alert.

🎉 Done! Bookmark the staff page on the cafe phone (in Safari/Chrome: Share → **Add to Home Screen**).

---

## Using the staff page

Open **https://smoovecafe.co.uk/admin.html** and sign in. You stay signed in until you close the tab.

- **Bookings:** everything from today for the next 30 days (change the dates and press **Refresh**). Tap a phone number to call, or **Cancel booking** (it asks if you want to email the customer).
- **Add booking:** for phone or walk-in bookings. Pick a table yourself or let it choose. Name only is fine; phone and email are optional.
- **Block time:** for holidays or private events. Block **both tables** or just one, for **one day**, a **range of days** (e.g. a week's holiday), or **part of a day**. If someone has already booked in that time, it tells you who, so you can contact them. Their booking isn't cancelled automatically. To undo a block, find it in the Bookings list and tap **Remove block**.

You can also look at the **Google Sheet** any time. Please don't edit it by hand except to fix a typo in a name or note, as the system relies on the columns staying as they are.

**Wrong password 10 times?** The staff page locks for 15 minutes to stop guessing.

**Change the password:** Apps Script → ⚙️ Project Settings → Script Properties → edit `ADMIN_PASSWORD`. Takes effect straight away.

---

## Updating the site yourself

You can do all of this on the GitHub website. Open the file, click the **pencil ✏️**, make your change, then **Commit changes**. The live site updates within a couple of minutes. If you make a typo, GitHub shows a **red ✗** next to your change (under the "Actions" tab) with a hint about what's wrong.

### Menu items and prices → `js/menu.js`

The whole menu is in this one file, in the same order as it appears on the site. For example, to change a price:

```js
{ name: 'Flat White', price: '£3.50' },     ← change £3.50 to £3.60
```

To add a new item, copy a similar line, paste it underneath, and change the words. Keep the quote marks `'…'` and the comma at the end. If a word needs an apostrophe, type `\'`, e.g. `'Mum\'s favourite'`. The file has more instructions at the top.

### Address, opening hours, phone, email, Instagram, Just Eat → `js/site-details.js`

Everything about where and when you are lives in this one file, and every page (including the footer) reads it from there. **If you move premises**, change the `address`, `mapSearch` and `hours` here.

### Booking times, tables or closing time → `js/booking-rules.js`

These rules are shared by the website *and* the Google back end, so changing them takes two steps:

1. Edit `js/booking-rules.js` on GitHub (e.g. change `closingTime: '14:30'`).
2. Update the Google side so it checks the same rules. Code.gs is built from this file, so the easiest way is to ask whoever helps with the site (or Claude) to "rebuild Code.gs". Then copy the new **apps-script/Code.gs** into Apps Script, as in step 3b, and click **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The web address stays the same.

If you change **opening hours** for customers, also update the `hours` in `js/site-details.js`.

### Logo and photos

1. Go to the **assets/images** folder → **Add file → Upload files**, and upload your logo and photos. Use simple names like `hero.jpg`, `logo-cream.png`. Photos look best around 1600px wide and under 500 KB. https://squoosh.app can shrink them for free.
2. In **js/site-details.js**, type the file names in, for example:
   ```js
   logoOnBurgundy: 'assets/images/logo-cream.png',
   ...
   hero: { file: 'assets/images/hero.jpg', alt: 'An açaí bowl held in hand at Smoove Cafe' },
   ```
   Change the `alt` text to describe each photo (it's read aloud to blind visitors and helps Google).

Until photos are added, the site shows elegant branded panels in their place, and the photo strip on the home page stays hidden.

---

## Your domain name: smoovecafe.co.uk

The domain is registered with **GoDaddy** and points at GitHub Pages. If you ever need to set it up again:

1. **GoDaddy → My Products → DNS** for smoovecafe.co.uk:
   - **A** records for `@` (four of them): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Delete any other A records for `@`, and any AAAA records for `@`.
   - **CNAME** record for `www`: `tobiyus.github.io`
   - Turn off any GoDaddy **Forwarding** on the domain.
2. **GitHub → Settings → Pages → Custom domain** shows `smoovecafe.co.uk` (it comes from the `CNAME` file in this repository). Once it shows a green tick, tick **Enforce HTTPS**.
3. The cancel links in booking emails use `var SITE_URL = 'https://smoovecafe.co.uk/';` near the top of Code.gs. If the domain ever changes, change that line in Apps Script and in `apps-script/server.js`, then redeploy (**Deploy → Manage deployments → ✏️ → New version → Deploy**).

Old links to the github.io address redirect to the domain automatically. Remember to **renew the domain** each year in GoDaddy (turn on auto-renew), or the site will disappear from that address.

---

## Privacy and security

- **No passwords, keys or customer data are in this repository.** The staff password lives only in Google's Script Properties. Bookings live only in your private Google Sheet.
- Customers' names, phone numbers, emails and notes are **automatically wiped 30 days after their visit** (a nightly job set up in step 3d). The date, time and party size are kept for planning. To change 30 days, edit `KEEP_DETAILS_DAYS` in Code.gs.
- The **privacy notice** (`privacy.html`) explains this to customers under UK GDPR. Have a read and make sure it matches how you work. For example, if you also store bookings anywhere else, add it.
- Turn on **2-Step Verification** for the Google account and the GitHub account. They protect your customers' details.
- If a customer asks for their data or asks you to delete it, find their row in the Google Sheet. You have one month to respond.
- The cancel link in each email contains a long random code, so nobody can cancel someone else's booking by guessing.
- The map on "Find us" only loads (with Google's cookies) if the visitor taps **Show map**, so you don't need a cookie banner.

---

## For developers

No build tools or frameworks: plain HTML, CSS and JavaScript.

```
index.html, menu.html, book.html, find-us.html, privacy.html, cancel.html, admin.html, 404.html
css/styles.css              all styling (brand colours as variables at the top)
js/site-details.js          ← business details (edit me)
js/menu.js                  ← the menu (edit me)
js/booking-rules.js         booking rules shared by website + Apps Script
js/site.js                  header/footer, fills in details on every page
js/book.js, cancel.js, admin.js, menu-page.js, find-us.js, api.js
apps-script/server.js       back-end source
apps-script/Code.gs         GENERATED: server.js + booking-rules.js, pasted into Google
scripts/build-apps-script.js  rebuilds Code.gs
tests/                      automated tests
```

- `npm run build`: rebuild `apps-script/Code.gs` after changing `server.js` or `booking-rules.js`.
- `npm test`: checks the edit-me files, runs 27 back-end tests against a stand-in for Google's services, and checks Code.gs is up to date. GitHub runs this automatically on every change.
- `npm run test:browser`: phone and desktop tests in a real browser (needs Playwright): page layout, WCAG AA contrast of every piece of text, the full booking, cancel and staff journeys.
- `npm run serve`: preview locally at http://localhost:8000.

Brand: burgundy `#3C111A`, cream `#F5DFC7`, wine `#84353A`, dusty rose `#C37B6F` (borders only), gold `#D5A35A` (lines, and small labels on burgundy only, 7.2:1), olive `#4E451C` (checkerboard only). Fonts: Playfair Display and Jost, self-hosted in `assets/fonts` (SIL Open Font Licence).
