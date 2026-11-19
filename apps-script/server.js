/*
 * SMOOVE CAFE – BOOKING BACK END (Google Apps Script)
 * ---------------------------------------------------------------
 * This runs inside your own Google account, stores bookings in a Google
 * Sheet and sends the emails. Nothing secret lives in this file:
 * the admin password is kept in Apps Script "Script properties".
 *
 * Script properties (Project Settings > Script properties):
 *   ADMIN_PASSWORD  (required)  password for the staff page
 *   OWNER_EMAIL     (optional)  where new-booking alerts go. Defaults to
 *                               the Google account that owns this script.
 */

// The address of the live website (used for the "cancel your booking" link in emails).
var SITE_URL = 'https://tobiyus.github.io/smoove-cafe-website/';

// Personal details (name, phone, email, notes) are wiped this many days after the visit.
var KEEP_DETAILS_DAYS = 30;

var SHEET_NAME = 'Bookings';
var HEADERS = ['Ref', 'Type', 'Status', 'Date', 'Start', 'End', 'Table', 'People', 'Name', 'Phone',
  'Email', 'Notes', 'Created', 'Cancelled', 'Source', 'Token'];
var COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i; });

/* ======================= Web entry points ======================= */

function doGet() {
  return json_({ ok: true, service: 'Smoove Cafe bookings', time: ukNow_() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, code: 'bad_request', message: 'Something went wrong. Please try again.' });
  }
  try {
    return json_(route_(body));
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, code: 'server_error', message: 'Sorry, something went wrong on our side. Please try again or contact us.' });
  }
}

function route_(b) {
  switch (b.action) {
    case 'availability': return availability_(b);
    case 'book': return book_(b);
    case 'lookup': return lookup_(b);
    case 'cancel': return customerCancel_(b);
  }
  if (String(b.action).indexOf('admin.') === 0) {
    var auth = checkPassword_(b.password);
    if (!auth.ok) return auth;
    switch (b.action) {
      case 'admin.login': return { ok: true };
      case 'admin.list': return adminList_(b);
      case 'admin.add': return adminAdd_(b);
      case 'admin.cancel': return adminCancel_(b);
      case 'admin.block': return adminBlock_(b);
    }
  }
  return { ok: false, code: 'bad_request', message: 'Unknown request.' };
}

/* ======================= Customer actions ======================= */

function availability_(b) {
  if (!SmooveBooking.isValidDate(b.date)) return { ok: false, code: 'bad_date', message: 'Please choose a date.' };
  var busy = busyFor_(readRows_(), b.date);
  return { ok: true, date: b.date, now: ukNow_(), busy: busy };
}

function book_(b) {
  if (b.website) return { ok: false, code: 'spam', message: 'Sorry, we couldn\'t take that booking.' };
  var details = cleanDetails_(b, false);
  if (!details.ok) return details;

  if (!rateLimitOk_()) {
    return { ok: false, code: 'busy', message: 'We\'re getting lots of bookings right now. Please try again in a few minutes or contact us.' };
  }

  var result = withLock_(function () {
    var rows = readRows_();
    var chk = SmooveBooking.check(
      { date: b.date, start: b.start, length: Number(b.length), party: Number(b.party) },
      { now: ukNow_(), busy: busyFor_(rows, b.date) });
    if (!chk.ok) return chk;
    var booking = saveBooking_(b.date, chk, Number(b.party), details, 'Website');
    return { ok: true, booking: booking };
  });
  if (!result.ok) return result;

  var bk = result.booking;
  var emailSent = false;
  if (bk.email) emailSent = safely_(function () { sendCustomerConfirmation_(bk); });
  safely_(function () { notifyOwner_('New booking', bk); });
  return { ok: true, booking: publicBooking_(bk), cancelUrl: cancelUrl_(bk), emailSent: emailSent };
}

function lookup_(b) {
  var found = findByRefAndToken_(b.ref, b.token);
  if (!found) return { ok: false, code: 'not_found', message: 'We couldn\'t find that booking. Please check the link in your email.' };
  return { ok: true, booking: publicBooking_(found.booking), canCancel: canCustomerCancel_(found.booking) };
}

function customerCancel_(b) {
  var result = withLock_(function () {
    var found = findByRefAndToken_(b.ref, b.token);
    if (!found) return { ok: false, code: 'not_found', message: 'We couldn\'t find that booking. Please check the link in your email.' };
    var bk = found.booking;
    if (bk.status === 'Cancelled') return { ok: false, code: 'already_cancelled', message: 'This booking has already been cancelled.' };
    if (!canCustomerCancel_(bk)) {
      return { ok: false, code: 'past', message: 'This booking has already started or passed, so it can\'t be cancelled online.' };
    }
    markCancelled_(found.row);
    bk.status = 'Cancelled';
    return { ok: true, booking: bk };
  });
  if (!result.ok) return result;
  var bk = result.booking;
  safely_(function () { notifyOwner_('Booking cancelled by customer', bk); });
  if (bk.email) safely_(function () { sendCustomerCancellation_(bk); });
  return { ok: true, booking: publicBooking_(bk) };
}

/* ======================= Staff (admin) actions ======================= */

function adminList_(b) {
  var now = ukNow_();
  var from = SmooveBooking.isValidDate(b.from) ? b.from : now.date;
  var to = SmooveBooking.isValidDate(b.to) ? b.to : SmooveBooking.addDays(from, 90);
  var items = readRows_().map(function (r) { return r.booking; }).filter(function (bk) {
    return bk.date >= from && bk.date <= to;
  });
  items.sort(function (x, y) {
    return x.date < y.date ? -1 : x.date > y.date ? 1 : SmooveBooking.toMinutes(x.start) - SmooveBooking.toMinutes(y.start);
  });
  return {
    ok: true, from: from, to: to, now: now,
    items: items.map(function (bk) {
      var copy = {};
      for (var k in bk) if (k !== 'token') copy[k] = bk[k];
      return copy;
    })
  };
}

function adminAdd_(b) {
  var details = cleanDetails_(b, true);
  if (!details.ok) return details;
  var result = withLock_(function () {
    var rows = readRows_();
    var chk = SmooveBooking.check(
      { date: b.date, start: b.start, length: Number(b.length), party: Number(b.party), table: b.table || null },
      { now: ukNow_(), busy: busyFor_(rows, b.date), allowPast: true });
    if (!chk.ok) return chk;
    return { ok: true, booking: saveBooking_(b.date, chk, Number(b.party), details, 'Staff') };
  });
  if (!result.ok) return result;
  var bk = result.booking;
  var emailSent = false;
  if (bk.email && b.sendEmail !== false) emailSent = safely_(function () { sendCustomerConfirmation_(bk); });
  return { ok: true, booking: publicBooking_(bk), emailSent: emailSent };
}

function adminCancel_(b) {
  var result = withLock_(function () {
    var rows = readRows_();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].booking.ref === String(b.ref)) {
        var bk = rows[i].booking;
        if (bk.status === 'Cancelled') return { ok: false, code: 'already_cancelled', message: 'Already cancelled.' };
        markCancelled_(rows[i].row);
        bk.status = 'Cancelled';
        return { ok: true, booking: bk };
      }
    }
    return { ok: false, code: 'not_found', message: 'Booking not found.' };
  });
  if (!result.ok) return result;
  var bk = result.booking;
  var emailSent = false;
  if (bk.type === 'Booking' && bk.email && b.notifyCustomer) {
    emailSent = safely_(function () { sendCustomerCancellation_(bk, true); });
  }
  return { ok: true, emailSent: emailSent };
}

/**
 * Blocks a table (or all tables) for one day or a range of days.
 * b = {from, to (optional), table: '1' | '2' | 'All', start (optional), end (optional), reason}
 */
function adminBlock_(b) {
  var from = b.from, to = b.to || b.from;
  if (!SmooveBooking.isValidDate(from) || !SmooveBooking.isValidDate(to) || to < from) {
    return { ok: false, code: 'bad_date', message: 'Please choose valid dates.' };
  }
  var table = b.table === 'All' ? 'All' : SmooveBooking.getTable(b.table) ? String(b.table) : null;
  if (!table) return { ok: false, code: 'bad_table', message: 'Please choose a table.' };
  var start = b.start ? SmooveBooking.toMinutes(b.start) : 0;
  var end = b.end ? SmooveBooking.toMinutes(b.end) : 24 * 60;
  if (isNaN(start) || isNaN(end) || end <= start) return { ok: false, code: 'bad_time', message: 'The end time must be after the start time.' };
  var reason = clip_(b.reason, 200);

  return withLock_(function () {
    var rows = readRows_();
    var created = [], clashes = [];
    for (var d = from, n = 0; d <= to; d = SmooveBooking.addDays(d, 1), n++) {
      if (n > 366) return { ok: false, code: 'too_long', message: 'Please block a year or less at a time.' };
      if (!SmooveBooking.isBookingDay(d)) continue;   // nothing to block when we're closed anyway
      rows.forEach(function (r) {
        var bk = r.booking;
        if (bk.type === 'Booking' && bk.status === 'Confirmed' && bk.date === d &&
          (table === 'All' || bk.table === table) &&
          SmooveBooking.overlaps(start, end, SmooveBooking.toMinutes(bk.start), SmooveBooking.toMinutes(bk.end))) {
          clashes.push(bk);
        }
      });
      var ref = newRef_();
      appendRow_([ref, 'Block', 'Confirmed', d, SmooveBooking.toTime(start), SmooveBooking.toTime(end), table, '',
        reason || 'Blocked', '', '', '', nowStamp_(), '', 'Staff', '']);
      created.push({ ref: ref, date: d });
    }
    if (!created.length) return { ok: false, code: 'nothing', message: 'Those dates are all days we\'re closed anyway, so there was nothing to block.' };
    return {
      ok: true, created: created,
      clashes: clashes.map(function (bk) { return { ref: bk.ref, date: bk.date, start: bk.start, name: bk.name, phone: bk.phone, email: bk.email }; })
    };
  });
}

/* ======================= Storage (Google Sheet) ======================= */

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
    // Store everything as plain text so Sheets doesn't "helpfully" change dates, times or phone numbers.
    sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).setNumberFormat('@');
  }
  return sh;
}

function readRows_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (!v[COL.Ref]) continue;
    out.push({
      row: i + 2,
      booking: {
        ref: String(v[COL.Ref]),
        type: String(v[COL.Type]),
        status: String(v[COL.Status]),
        date: asDate_(v[COL.Date]),
        start: asTime_(v[COL.Start]),
        end: asTime_(v[COL.End]),
        table: String(v[COL.Table]),
        party: v[COL.People] === '' ? '' : Number(v[COL.People]),
        name: String(v[COL.Name]),
        phone: String(v[COL.Phone]),
        email: String(v[COL.Email]),
        notes: String(v[COL.Notes]),
        created: String(v[COL.Created]),
        source: String(v[COL.Source]),
        token: String(v[COL.Token])
      }
    });
  }
  return out;
}

function appendRow_(values) {
  var sh = sheet_();
  var row = sh.getLastRow() + 1;
  var range = sh.getRange(row, 1, 1, values.length);
  range.setNumberFormat('@');
  range.setValues([values.map(safeCell_)]);
}

function markCancelled_(row) {
  var sh = sheet_();
  sh.getRange(row, COL.Status + 1).setValue('Cancelled');
  sh.getRange(row, COL.Cancelled + 1).setValue(nowStamp_());
}

function busyFor_(rows, date) {
  return rows.filter(function (r) {
    return r.booking.date === date && r.booking.status === 'Confirmed';
  }).map(function (r) {
    return {
      table: r.booking.table,
      start: SmooveBooking.toMinutes(r.booking.start),
      end: SmooveBooking.toMinutes(r.booking.end)
    };
  });
}

function saveBooking_(date, chk, party, d, source) {
  var bk = {
    ref: newRef_(), type: 'Booking', status: 'Confirmed', date: date,
    start: SmooveBooking.toTime(chk.start), end: SmooveBooking.toTime(chk.end),
    table: chk.table.id, party: party, name: d.name, phone: d.phone, email: d.email, notes: d.notes,
    created: nowStamp_(), source: source, token: Utilities.getUuid().replace(/-/g, '')
  };
  appendRow_([bk.ref, bk.type, bk.status, bk.date, bk.start, bk.end, bk.table, String(bk.party), bk.name,
    bk.phone, bk.email, bk.notes, bk.created, '', bk.source, bk.token]);
  return bk;
}

function findByRefAndToken_(ref, token) {
  if (!ref || !token) return null;
  var rows = readRows_();
  for (var i = 0; i < rows.length; i++) {
    var bk = rows[i].booking;
    if (bk.ref === String(ref) && bk.type === 'Booking' && bk.token && safeEquals_(bk.token, String(token))) return rows[i];
  }
  return null;
}

/* ======================= Emails ======================= */

function ownerEmail_() {
  return PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || Session.getEffectiveUser().getEmail();
}

function cancelUrl_(bk) {
  return SITE_URL + 'cancel.html?ref=' + encodeURIComponent(bk.ref) + '&t=' + encodeURIComponent(bk.token);
}

function bookingLines_(bk) {
  var t = SmooveBooking.getTable(bk.table);
  var len = SmooveBooking.toMinutes(bk.end) - SmooveBooking.toMinutes(bk.start);
  return [
    ['Date', SmooveBooking.prettyDate(bk.date)],
    ['Time', SmooveBooking.prettyTime(SmooveBooking.toMinutes(bk.start)) + ' – ' + SmooveBooking.prettyTime(SmooveBooking.toMinutes(bk.end)) + ' (' + SmooveBooking.prettyLength(len) + ')'],
    ['People', String(bk.party)],
    ['Table', t ? t.name + ', ' + t.description : bk.table],
    ['Name', bk.name],
    ['Reference', bk.ref]
  ];
}

function emailShell_(title, introHtml, bk, footerHtml) {
  var rows = bookingLines_(bk).map(function (l) {
    return '<tr><td style="padding:6px 16px 6px 0;color:#84353A;font-size:13px;letter-spacing:1px;text-transform:uppercase;">' +
      esc_(l[0]) + '</td><td style="padding:6px 0;color:#3C111A;font-size:16px;">' + esc_(l[1]) + '</td></tr>';
  }).join('');
  return '<div style="background:#F5DFC7;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#3C111A;">' +
    '<div style="max-width:520px;margin:0 auto;background:#FFF8F0;border-top:6px solid #3C111A;">' +
    '<div style="background:#3C111A;color:#F5DFC7;padding:20px 24px;font-family:Georgia,serif;font-size:26px;font-style:italic;">Smoove Cafe</div>' +
    '<div style="padding:24px;font-size:16px;line-height:1.6;">' +
    '<h1 style="font-family:Georgia,serif;font-weight:normal;color:#84353A;font-size:24px;margin:0 0 12px;">' + esc_(title) + '</h1>' +
    introHtml + '<table style="border-collapse:collapse;margin:16px 0;">' + rows + '</table>' + footerHtml +
    '<p style="margin-top:24px;font-family:Georgia,serif;font-style:italic;color:#84353A;">stay a little longer.</p>' +
    '</div></div></div>';
}

function sendCustomerConfirmation_(bk) {
  var url = cancelUrl_(bk);
  var html = emailShell_('You\'re booked in!',
    '<p>Hi ' + esc_(bk.name) + ', thanks for booking with us. We\'ll have your table ready.</p>', bk,
    '<p>Can\'t make it after all? No worries, just let us know so someone else can grab the table:</p>' +
    '<p><a href="' + esc_(url) + '" style="display:inline-block;background:#84353A;color:#F5DFC7;padding:12px 20px;text-decoration:none;">Cancel my booking</a></p>' +
    '<p style="font-size:14px;">Allergies? Please tell our team before you order. Everything is made in our small, shared kitchen.</p>' +
    '<p style="font-size:14px;">Find us inside City Fitness, 69 Roundpond, Melksham, SN12 8EB. Dogs welcome!</p>');
  var text = 'Hi ' + bk.name + ', you\'re booked in at Smoove Cafe.\n\n' +
    bookingLines_(bk).map(function (l) { return l[0] + ': ' + l[1]; }).join('\n') +
    '\n\nNeed to cancel? ' + url + '\n\nstay a little longer.\nSmoove Cafe';
  MailApp.sendEmail({
    to: bk.email, subject: 'Your Smoove Cafe booking – ' + SmooveBooking.prettyDate(bk.date) + ', ' +
      SmooveBooking.prettyTime(SmooveBooking.toMinutes(bk.start)),
    body: text, htmlBody: html, name: 'Smoove Cafe', replyTo: ownerEmail_()
  });
}

function sendCustomerCancellation_(bk, byCafe) {
  var intro = byCafe
    ? '<p>Hi ' + esc_(bk.name) + ', we\'re sorry, but we\'ve had to cancel your booking below. Please get in touch if you\'d like to rebook.</p>'
    : '<p>Hi ' + esc_(bk.name) + ', your booking below has been cancelled. Hope to see you another time!</p>';
  MailApp.sendEmail({
    to: bk.email, subject: 'Booking cancelled – Smoove Cafe',
    body: (byCafe ? 'Sorry, we\'ve had to cancel your booking.' : 'Your booking has been cancelled.') + '\n\n' +
      bookingLines_(bk).map(function (l) { return l[0] + ': ' + l[1]; }).join('\n') + '\n\nSmoove Cafe',
    htmlBody: emailShell_('Booking cancelled', intro, bk, ''), name: 'Smoove Cafe', replyTo: ownerEmail_()
  });
}

function notifyOwner_(what, bk) {
  var lines = bookingLines_(bk).concat([
    ['Phone', bk.phone || '–'], ['Email', bk.email || '–'], ['Notes', bk.notes || '–']
  ]);
  MailApp.sendEmail({
    to: ownerEmail_(),
    subject: what + ': ' + SmooveBooking.shortDate(bk.date) + ' ' + bk.start + ', ' + bk.party + ' people (' + bk.name + ')',
    body: what + '\n\n' + lines.map(function (l) { return l[0] + ': ' + l[1]; }).join('\n') +
      '\n\nSee all bookings: ' + SITE_URL + 'admin.html',
    name: 'Smoove bookings'
  });
}

/* ======================= Helpers ======================= */

function cleanDetails_(b, isStaff) {
  var name = clip_(b.name, 80);
  var phone = clip_(b.phone, 30);
  var email = clip_(b.email, 120).toLowerCase();
  var notes = clip_(b.notes, 500);
  if (!name) return { ok: false, code: 'bad_name', message: 'Please tell us your name.' };
  if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
    return { ok: false, code: 'bad_email', message: 'That email address doesn\'t look quite right.' };
  }
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) {
    return { ok: false, code: 'bad_phone', message: 'That phone number doesn\'t look quite right.' };
  }
  if (!isStaff && !phone && !email) {
    return { ok: false, code: 'need_contact', message: 'Please give us a phone number or an email address.' };
  }
  return { ok: true, name: name, phone: phone, email: email, notes: notes };
}

function publicBooking_(bk) {
  var t = SmooveBooking.getTable(bk.table);
  return {
    ref: bk.ref, status: bk.status, date: bk.date, start: bk.start, end: bk.end, table: bk.table,
    tableName: t ? t.name : bk.table, tableDescription: t ? t.description : '', party: bk.party, name: bk.name,
    email: bk.email ? true : false
  };
}

function canCustomerCancel_(bk) {
  return bk.status === 'Confirmed' && !SmooveBooking.isPast(bk.date, SmooveBooking.toMinutes(bk.start), ukNow_());
}

function checkPassword_(given) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('adminFails') || 0);
  if (fails >= 10) return { ok: false, code: 'locked', message: 'Too many wrong passwords. Please wait 15 minutes and try again.' };
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real) return { ok: false, code: 'no_password', message: 'The admin password hasn\'t been set up yet (see the README).' };
  if (!given || !safeEquals_(String(given), real)) {
    cache.put('adminFails', String(fails + 1), 900);
    return { ok: false, code: 'bad_password', message: 'Wrong password.' };
  }
  return { ok: true };
}

function rateLimitOk_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('recentBookings') || 0);
  if (n >= 30) return false;
  cache.put('recentBookings', String(n + 1), 600);
  return true;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, code: 'busy', message: 'We\'re a bit busy. Please try again in a moment.' };
  try { return fn(); } finally { lock.releaseLock(); }
}

function safely_(fn) {
  try { fn(); return true; } catch (err) { console.error(err && err.stack || err); return false; }
}

function safeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function newRef_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'SM-' + s;
}

function ukNow_() {
  var d = new Date();
  return {
    date: Utilities.formatDate(d, SMOOVE_BOOKING_SETTINGS.timeZone, 'yyyy-MM-dd'),
    minutes: Number(Utilities.formatDate(d, SMOOVE_BOOKING_SETTINGS.timeZone, 'H')) * 60 +
      Number(Utilities.formatDate(d, SMOOVE_BOOKING_SETTINGS.timeZone, 'm'))
  };
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), SMOOVE_BOOKING_SETTINGS.timeZone, 'dd/MM/yyyy HH:mm');
}

function asDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SMOOVE_BOOKING_SETTINGS.timeZone, 'yyyy-MM-dd');
  return String(v).trim();
}

function asTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SMOOVE_BOOKING_SETTINGS.timeZone, 'HH:mm');
  var m = SmooveBooking.toMinutes(String(v).trim());
  return isNaN(m) ? String(v) : SmooveBooking.toTime(m);
}

function clip_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

/** Stops anything typed into the form being treated as a spreadsheet formula. */
function safeCell_(v) {
  v = String(v == null ? '' : v);
  return /^[=+\-@]/.test(v) ? '\'' + v : v;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c];
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================= One-off setup & daily tidy-up ======================= */

/**
 * Run this ONCE from the Apps Script editor (choose "setup" and press Run).
 * It creates the Bookings sheet and a daily job that wipes old personal details.
 */
function setup() {
  sheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyTidyUp') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyTidyUp').timeBased().everyDays(1).atHour(3).create();
  var hasPassword = !!PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  console.log('Setup complete. Booking alerts will go to: ' + ownerEmail_());
  if (!hasPassword) console.warn('Remember to add ADMIN_PASSWORD in Project Settings > Script properties.');
}

/** Runs every night: wipes names, phone numbers, emails and notes from bookings older than KEEP_DETAILS_DAYS. */
function dailyTidyUp() {
  var cutoff = SmooveBooking.addDays(ukNow_().date, -KEEP_DETAILS_DAYS);
  withLock_(function () {
    var sh = sheet_();
    readRows_().forEach(function (r) {
      var bk = r.booking;
      if (bk.type === 'Booking' && bk.date < cutoff && (bk.name !== 'Removed' || bk.phone || bk.email || bk.notes || bk.token)) {
        sh.getRange(r.row, COL.Name + 1, 1, 4).setValues([['Removed', '', '', '']]);
        sh.getRange(r.row, COL.Token + 1).setValue('');
      }
    });
    return { ok: true };
  });
}

/** Optional: run this from the editor to check emails work. */
function sendTestEmail() {
  MailApp.sendEmail(ownerEmail_(), 'Smoove booking system test', 'If you can read this, booking emails are working.');
}
