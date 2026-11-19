// Browser tests on a phone-sized screen. They need Playwright (see README).
// Run with:  node --test tests/browser.test.js
// The Google back end is replaced by the same test double used in booking.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createGas } = require('./gas-mock.js');

const ROOT = path.join(__dirname, '..');
const API = 'https://script.google.com/macros/s/TEST/exec';
const NOW = '2026-11-19T10:00:00Z';   // Thursday 10:00 UK time
const SHOTS = process.env.SHOTS_DIR;   // optional: folder to save screenshots in
const PAGES = ['index.html', 'menu.html', 'book.html', 'find-us.html', 'privacy.html', 'cancel.html', 'admin.html', '404.html'];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };

let server, base, browser;

test.before(async () => {
  server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
test.after(async () => { await browser.close(); server.close(); });

async function phone({ gas = createGas({ now: Date.parse(NOW) }), connected = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 375, height: 740 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Point the site at the fake back end
  await page.route('**/js/site-details.js', async route => {
    let body = fs.readFileSync(path.join(ROOT, 'js/site-details.js'), 'utf8');
    if (connected) body = body.replace("bookingApiUrl: ''", `bookingApiUrl: '${API}'`);
    route.fulfill({ body, contentType: 'text/javascript' });
  });
  await page.route(API, route => {
    const result = gas.call(JSON.parse(route.request().postData()));
    route.fulfill({ body: JSON.stringify(result), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  page.on('dialog', d => d.accept());
  return { page, gas, errors, context };
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
}

/* Measures contrast of every visible piece of text against what's actually behind it. */
async function contrastProblems(page) {
  return page.evaluate(() => {
    function rgba(s) { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; }
    function lum(c) { return [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
    function mix(top, under) { return { r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 }; }
    function bgOf(el) {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c.a > 0) layers.push(c);
        if (c.a === 1) break;
      }
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = layers.length - 1; i >= 0; i--) bg = mix(layers[i], bg);
      return bg;
    }
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let minBody = 99;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) continue;
      const el = node.parentElement;
      if (seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || rect.width === 0 || el.closest('[hidden], .visually-hidden, .honeypot, [aria-hidden="true"]') || el.closest('.skip-link')) continue;
      let fg = rgba(cs.color);
      const bg = bgOf(el);
      if (fg.a < 1) fg = mix(fg, bg);
      const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      if (el.matches('p, li, address, label, dd, td') && !el.closest('.label, small, .hint')) minBody = Math.min(minBody, size);
      // Disabled booking buttons are exempt in WCAG, but we still hold them to 4.5:1.
      const need = large ? 3 : 4.5;
      if (ratio < need) out.push(`${ratio.toFixed(2)}:1 "${node.textContent.trim().slice(0, 40)}" (${cs.color} on rgb(${bg.r|0},${bg.g|0},${bg.b|0}))`);
    }
    return { problems: out, minBody };
  });
}

for (const file of PAGES) {
  test(`phone check: ${file} – loads cleanly, no sideways scrolling, all text passes WCAG AA contrast`, async () => {
    const { page, errors, context } = await phone();
    await page.goto(base + file + (file === 'cancel.html' ? '?ref=SM-NOPE&t=nope' : ''));
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `page is ${overflow}px too wide`);
    const { problems, minBody } = await contrastProblems(page);
    assert.deepEqual(problems, [], 'contrast failures');
    assert.ok(minBody >= 16, `smallest body text is ${minBody}px`);
    // Open the phone menu and check that too
    await page.click('.nav-toggle');
    assert.equal(await page.isVisible('#site-nav a[href="menu.html"]'), true);
    const navCheck = await contrastProblems(page);
    assert.deepEqual(navCheck.problems, []);
    await page.click('.nav-toggle');
    assert.deepEqual(errors, []);
    await shot(page, 'phone-' + file.replace('.html', ''));
    await context.close();
  });
}

test('desktop check: every page fits and passes contrast at 1280px wide', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  for (const file of PAGES) {
    await page.goto(base + file);
    await page.waitForLoadState('networkidle');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), file);
    assert.deepEqual((await contrastProblems(page)).problems, [], file);
    await shot(page, 'desktop-' + file.replace('.html', ''));
  }
  await context.close();
});

test('menu page shows every item from the menu file and nothing else', async () => {
  const { page, context } = await phone();
  await page.goto(base + 'menu.html');
  const items = await page.$$eval('.menu-item .name', els => els.map(e => e.firstChild.textContent.trim()));
  const sections = await page.$$eval('.menu-section h3', els => els.map(e => e.textContent));
  assert.deepEqual(sections, ['Bagels', 'Banana Bread', 'Açaí & Bowls', 'Overnight Oats', 'Hot', 'Iced', 'Matcha (Iced)', 'Smoothies', 'Extras', 'Dietary key']);
  assert.equal(items.length, 15 + 7 + 5 + 5 + 4 + 3);
  const text = await page.textContent('main');
  for (const s of ['£8.25', '£7.50', '£10.50', '£7.95', '£6.75', 'Upgrade to our 20oz XL cup +£1.30', 'Swap to a Greek yoghurt base £6.50',
    'Extra toppings +£0.80', 'Add coffee +£0.50', 'Banana bread allergens TBC', '8 stamps = your next drink\'s on us. Ask for a card at the till.',
    'Everything is made in our small, shared kitchen, so we can\'t guarantee any item is free from allergens. Please tell our team about any allergies before you order.']) {
    assert.ok(text.includes(s), s);
  }
  await context.close();
});

test('book page without a back end connected asks people to get in touch', async () => {
  const { page, context } = await phone({ connected: false });
  await page.goto(base + 'book.html');
  assert.equal(await page.isVisible('#booking-offline'), true);
  assert.equal(await page.isVisible('#booking-form'), false);
  await context.close();
});

test('booking journey on a phone: book, then the same slot shows as taken', async () => {
  const { page, gas, errors, context } = await phone();
  await page.goto(base + 'book.html');
  // Today is Thursday 19 Nov 10:00, so 10:00 has passed but 10:30 is free.
  assert.equal(await page.inputValue('#b-date'), '2026-11-19');
  await page.waitForSelector('#time-picker button');
  assert.equal(await page.isDisabled('#time-picker [data-start="600"]'), true);
  assert.match(await page.textContent('#time-picker [data-start="600"]'), /Passed/);
  assert.equal(await page.isDisabled('#time-picker [data-start="630"]'), false);

  await page.fill('#b-date', '2026-11-24');
  await page.dispatchEvent('#b-date', 'change');
  await page.waitForSelector('#time-picker [data-start="600"]:not([disabled])');
  await page.click('#party-picker [data-party="2"]');
  await page.click('#time-picker [data-start="780"]');   // 13:00
  const lengths = await page.$$eval('#length-picker button', b => b.map(x => x.dataset.length));
  assert.deepEqual(lengths, ['30', '60', '90']);
  await page.click('#length-picker [data-length="90"]');
  assert.match(await page.textContent('#table-message'), /Table 1/);
  await shot(page, 'flow-1-choose');
  await page.fill('#b-name', 'Pat Example');
  await page.fill('#b-email', 'pat@example.com');
  await page.fill('#b-notes', 'Bringing Biscuit the spaniel');
  await page.click('#b-submit');
  await page.waitForSelector('#booking-done:not([hidden])');
  const done = await page.textContent('#booking-done');
  assert.match(done, /You're booked in!/);
  assert.match(done, /Tuesday 24 November 2026/);
  assert.match(done, /1pm – 2:30pm/);
  assert.match(done, /emailed you a confirmation/);
  await shot(page, 'flow-2-done');
  assert.equal(gas.mail.length, 2);
  const cancelHref = await page.getAttribute('#booking-done a[href*="cancel.html"]', 'href');

  // Same slot again for 2 people: falls back to Table 2. A third time: the 13:00 slot is taken.
  await page.goto(base + 'book.html');
  await page.fill('#b-date', '2026-11-24');
  await page.dispatchEvent('#b-date', 'change');
  await page.waitForSelector('#time-picker [data-start="600"]:not([disabled])');
  await page.click('#party-picker [data-party="3"]');
  await page.click('#time-picker [data-start="780"]');
  await page.click('#length-picker [data-length="30"]');
  assert.match(await page.textContent('#table-message'), /Table 2/);
  await page.fill('#b-name', 'Group');
  await page.fill('#b-phone', '07700 900456');
  await page.click('#b-submit');
  await page.waitForSelector('#booking-done:not([hidden])');

  await page.goto(base + 'book.html');
  await page.fill('#b-date', '2026-11-24');
  await page.dispatchEvent('#b-date', 'change');
  await page.waitForSelector('#time-picker [data-start="600"]:not([disabled])');
  await page.click('#party-picker [data-party="4"]');
  assert.equal(await page.isDisabled('#time-picker [data-start="780"]'), true, '13:00 for 4 should be taken');
  assert.match(await page.textContent('#time-picker [data-start="780"]'), /Taken/);
  await page.click('#time-picker [data-start="750"]');  // 12:30: Table 2 is free until 13:00
  const l = await page.$$eval('#length-picker button', b => b.map(x => [x.dataset.length, x.disabled]));
  assert.deepEqual(l, [['30', false], ['60', true], ['90', true], ['120', true]]);
  await shot(page, 'flow-3-taken');

  // Cancel via the link
  await page.goto(new URL(cancelHref).pathname.replace('/Smoove-cafe-website-/', base) + new URL(cancelHref).search);
  await page.waitForSelector('#do-cancel');
  await shot(page, 'flow-4-cancel');
  await page.click('#do-cancel');
  await page.waitForSelector('text=All cancelled');
  assert.deepEqual(errors, []);
  await context.close();
});

test('booking form: Sunday/Monday, a group of 7 and a 13:30 start are handled', async () => {
  const { page, context } = await phone();
  await page.goto(base + 'book.html');
  await page.fill('#b-date', '2026-11-22');   // Sunday
  await page.dispatchEvent('#b-date', 'change');
  assert.match(await page.textContent('#date-message'), /Tuesday to Saturday/);
  assert.equal(await page.isVisible('#step-time'), false);
  await page.fill('#b-date', '2026-11-23');   // Monday
  await page.dispatchEvent('#b-date', 'change');
  assert.match(await page.textContent('#date-message'), /closed on Sundays and Mondays/);

  await page.fill('#b-date', '2026-11-28');   // Saturday
  await page.dispatchEvent('#b-date', 'change');
  await page.waitForSelector('#time-picker button');
  await page.click('#party-picker [data-party="7"]');
  assert.match(await page.textContent('#party-message'), /more than 6/);
  assert.equal(await page.isVisible('#step-time'), false);
  await shot(page, 'flow-group-of-7');

  await page.click('#party-picker [data-party="2"]');
  await page.click('#time-picker [data-start="810"]');   // 13:30
  const lengths = await page.$$eval('#length-picker button', b => b.map(x => x.dataset.length));
  assert.deepEqual(lengths, ['30', '60'], 'only 30 minutes and 1 hour fit before 14:30');
  await context.close();
});

test('staff page: sign in, block a day, see it, add a booking, cancel it', async () => {
  const { page, errors, context } = await phone();
  await page.goto(base + 'admin.html');
  await page.fill('#a-password', 'wrong');
  await page.click('#login button[type="submit"]');
  await page.waitForSelector('#login-message:not([hidden])');
  assert.match(await page.textContent('#login-message'), /Wrong password/);
  await page.fill('#a-password', 'letmein');
  await page.click('#login button[type="submit"]');
  await page.waitForSelector('#admin:not([hidden])');

  await page.click('[data-tab="block"]');
  await page.fill('#bl-from', '2026-12-01');
  await page.fill('#bl-reason', 'Christmas shopping');
  await page.click('#block-form button[type="submit"]');
  await page.waitForSelector('text=Blocked 1 day');

  await page.click('[data-tab="add"]');
  await page.fill('#ad-date', '2026-11-25');
  await page.selectOption('#ad-start', '11:00');
  await page.fill('#ad-name', 'Phone Booking');
  await page.click('#add-form button[type="submit"]');
  await page.waitForSelector('text=Booked: Phone Booking');

  await page.click('[data-tab="list"]');
  await page.waitForSelector('.admin-item');
  const txt = await page.textContent('#list');
  assert.match(txt, /Phone Booking/);
  assert.match(txt, /Christmas shopping/);
  await shot(page, 'admin-list');
  await page.click('.admin-item:has-text("Phone Booking") [data-cancel]');
  await page.waitForSelector('text=Booking cancelled');
  assert.deepEqual(errors, []);
  await context.close();
});
