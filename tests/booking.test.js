// Tests for the booking rules and the Google Apps Script back end.
// Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/booking-rules.js');
const { createGas } = require('./gas-mock.js');

// "Now" for these tests: Thursday 19 November 2026, 10:00 UK time.
const NOW = '2026-11-19T10:00:00Z';
const TUE = '2026-11-24', WED = '2026-11-25', SAT = '2026-11-28', SUN = '2026-11-22', MON = '2026-11-23';

function fresh() { return createGas({ now: Date.parse(NOW) }); }
function book(gas, o) {
  return gas.call(Object.assign({ action: 'book', date: TUE, start: '10:00', length: 60, party: 2, name: 'Test Person', phone: '07700 900123' }, o));
}

test('calendar sanity: test dates fall on the expected weekdays', () => {
  assert.equal(B.dayOfWeek(TUE), 2);
  assert.equal(B.dayOfWeek(SAT), 6);
  assert.equal(B.dayOfWeek(SUN), 0);
  assert.equal(B.dayOfWeek(MON), 1);
  assert.equal(B.prettyDate(TUE), 'Tuesday 24 November 2026');
  assert.equal(B.shortDate(TUE), '24/11/2026');
});

test('start times run 10:00 to 13:30 in 30-minute steps', () => {
  assert.deepEqual(B.startTimes().map(B.toTime), ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30']);
});

test('only lengths that finish by 14:30 are offered', () => {
  assert.deepEqual(B.lengthsFor(B.toMinutes('13:30')), [30, 60]);
  assert.deepEqual(B.lengthsFor(B.toMinutes('13:00')), [30, 60, 90]);
  assert.deepEqual(B.lengthsFor(B.toMinutes('12:30')), [30, 60, 90, 120]);
});

test('a normal booking works, is saved, and both emails are sent', () => {
  const gas = fresh();
  const r = book(gas, { email: 'guest@example.com' });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.booking.table, '1');
  assert.equal(r.booking.end, '11:00');
  assert.match(r.cancelUrl, /^https:\/\/smoovecafe\.co\.uk\/cancel\.html\?ref=SM-[A-Z0-9]{6}&t=[a-f0-9]{32}$/);
  assert.equal(gas.rows.length, 2);                                 // header + 1 booking
  assert.equal(gas.mail.length, 2);
  assert.equal(gas.mail[0].to, 'guest@example.com');
  assert.match(gas.mail[0].htmlBody, /Cancel my booking/);
  assert.equal(gas.mail[1].to, 'owner@example.com');
  assert.match(gas.mail[1].subject, /^New booking: 24\/11\/2026 10:00/);
});

test('BLOCKED: double-booking the same table at the same time', () => {
  const gas = fresh();
  assert.equal(book(gas, { party: 4 }).ok, true);                   // takes Table 2 (6-seater)
  const r = book(gas, { party: 4 });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'taken');
});

test('BLOCKED: overlapping bookings of different lengths', () => {
  const gas = fresh();
  assert.equal(book(gas, { party: 5, start: '11:00', length: 120 }).ok, true);   // Table 2, 11:00–13:00
  for (const [start, length] of [['10:00', 90], ['10:30', 60], ['11:30', 30], ['12:30', 120], ['12:00', 30]]) {
    const r = book(gas, { party: 3, start, length });
    assert.equal(r.ok, false, `${start} for ${length} mins should clash with 11:00–13:00`);
    assert.equal(r.code, 'taken');
  }
  // Touching but not overlapping is fine: 10:00–11:00 and 13:00–14:30
  assert.equal(book(gas, { party: 3, start: '10:00', length: 60 }).ok, true);
  assert.equal(book(gas, { party: 3, start: '13:00', length: 90 }).ok, true);
});

test('BLOCKED: a 2-hour (or 90-minute) booking at 13:30; 30 mins and 1 hour are allowed', () => {
  const gas = fresh();
  for (const length of [120, 90]) {
    const r = book(gas, { start: '13:30', length });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'too_late');
  }
  assert.equal(book(gas, { start: '13:30', length: 60 }).ok, true);
  assert.equal(book(gas, { start: '13:30', length: 30, party: 3 }).ok, true);
});

test('BLOCKED: start times outside 10:00–13:30 or not on the half hour', () => {
  const gas = fresh();
  for (const start of ['09:30', '09:00', '14:00', '14:30', '10:15', '8:00', '25:00', 'noon', '']) {
    const r = book(gas, { start, length: 30 });
    assert.equal(r.ok, false, start);
    assert.equal(r.code, 'bad_time', start);
  }
});

test('BLOCKED: Sundays and Mondays', () => {
  const gas = fresh();
  for (const date of [SUN, MON, '2026-11-29', '2026-11-30']) {
    const r = book(gas, { date });
    assert.equal(r.ok, false, date);
    assert.equal(r.code, 'closed_day', date);
  }
  // Tuesday–Saturday all work
  for (const date of [TUE, WED, '2026-11-26', '2026-11-27', SAT]) assert.equal(book(gas, { date }).ok, true, date);
});

test('BLOCKED: a group of 7 (asked to contact us)', () => {
  const gas = fresh();
  const r = book(gas, { party: 7 });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'too_many');
  assert.match(r.message, /get in touch/);
  assert.equal(book(gas, { party: 0 }).code, 'bad_party');
  assert.equal(book(gas, { party: 2.5 }).code, 'bad_party');
});

test('BLOCKED: times that have already passed (UK time)', () => {
  const gas = fresh();    // Thursday 19 Nov, 10:00
  assert.equal(book(gas, { date: '2026-11-18' }).code, 'past');            // yesterday
  assert.equal(book(gas, { date: '2026-11-19', start: '10:00' }).code, 'past');   // starting right now
  assert.equal(book(gas, { date: '2026-11-19', start: '10:30', length: 30 }).ok, true);  // later today is fine
  // Summer time: 09:45 UTC on 1 July is 10:45 in the UK, so 10:30 has passed
  gas.setNow('2027-07-01T09:45:00Z');
  assert.equal(book(gas, { date: '2027-07-01', start: '10:30' }).code, 'past');
  assert.equal(book(gas, { date: '2027-07-01', start: '11:00' }).ok, true);
});

test('bookings can be made far into the future', () => {
  const gas = fresh();
  assert.equal(book(gas, { date: '2029-06-12' }).ok, true);   // a Tuesday
});

test('table suggestion: 1–2 people get the 2-seater, then the 6-seater if it is taken; 3–6 get the 6-seater', () => {
  const gas = fresh();
  assert.equal(book(gas, { party: 1 }).booking.table, '1');
  assert.equal(book(gas, { party: 2 }).booking.table, '2');      // 2-seater taken, so the big table
  assert.equal(book(gas, { party: 2 }).code, 'taken');           // both taken
  assert.equal(book(gas, { party: 3, start: '11:00' }).booking.table, '2');
  assert.equal(book(gas, { party: 6, start: '12:00' }).booking.table, '2');
  assert.equal(book(gas, { party: 3, start: '12:30' }).code, 'taken');  // 2-seater is free but too small
});

test('availability only shares times, never names or contact details', () => {
  const gas = fresh();
  book(gas, { party: 2, start: '12:00', length: 90, name: 'Secret Name', email: 'secret@example.com' });
  const a = gas.call({ action: 'availability', date: TUE });
  assert.equal(a.ok, true);
  assert.deepEqual(a.busy, [{ table: '1', start: 720, end: 810 }]);
  assert.doesNotMatch(JSON.stringify(a), /Secret|secret@/);
  assert.deepEqual(a.now, { date: '2026-11-19', minutes: 600 });
});

test('customer details are required and checked', () => {
  const gas = fresh();
  assert.equal(book(gas, { name: '' }).code, 'bad_name');
  assert.equal(book(gas, { phone: '', email: '' }).code, 'need_contact');
  assert.equal(book(gas, { phone: '', email: 'not-an-email' }).code, 'bad_email');
  assert.equal(book(gas, { phone: 'call me maybe' }).code, 'bad_phone');
  assert.equal(book(gas, { phone: '', email: 'only@example.com' }).ok, true);
  assert.equal(book(gas, { website: 'http://spam' }).code, 'spam');   // hidden spam-trap field
});

test('typed formulas are stored as plain text in the sheet', () => {
  const gas = fresh();
  book(gas, { name: '=HYPERLINK("http://evil")', notes: '+cmd' });
  const row = gas.rows[1];
  assert.equal(row[8], '\'=HYPERLINK("http://evil")');
  assert.equal(row[11], '\'+cmd');
});

test('customer cancellation: needs the secret link, frees the table, notifies both sides', () => {
  const gas = fresh();
  const r = book(gas, { email: 'guest@example.com' });
  const url = new URL(r.cancelUrl);
  const ref = url.searchParams.get('ref'), token = url.searchParams.get('t');

  assert.equal(gas.call({ action: 'lookup', ref, token: 'wrong' }).code, 'not_found');
  assert.equal(gas.call({ action: 'cancel', ref, token: 'x'.repeat(32) }).code, 'not_found');

  const look = gas.call({ action: 'lookup', ref, token });
  assert.equal(look.ok, true);
  assert.equal(look.canCancel, true);

  gas.mail.length = 0;
  const c = gas.call({ action: 'cancel', ref, token });
  assert.equal(c.ok, true);
  assert.equal(gas.mail.length, 2);
  assert.match(gas.mail.find(m => m.to === 'owner@example.com').subject, /^Booking cancelled by customer/);
  assert.equal(gas.call({ action: 'cancel', ref, token }).code, 'already_cancelled');

  // The slot is free again
  assert.equal(book(gas, {}).booking.table, '1');
});

test('customers cannot cancel a booking that has already started', () => {
  const gas = fresh();
  const r = book(gas, { date: '2026-11-19', start: '11:00', length: 30 });
  const url = new URL(r.cancelUrl);
  gas.setNow('2026-11-19T11:05:00Z');
  const c = gas.call({ action: 'cancel', ref: url.searchParams.get('ref'), token: url.searchParams.get('t') });
  assert.equal(c.code, 'past');
});

test('staff page: wrong password refused, lock-out after 10 tries', () => {
  const gas = fresh();
  assert.equal(gas.call({ action: 'admin.list' }).code, 'bad_password');
  assert.equal(gas.call({ action: 'admin.login', password: 'nope' }).code, 'bad_password');
  assert.equal(gas.call({ action: 'admin.login', password: 'letmein' }).ok, true);
  for (let i = 0; i < 10; i++) gas.call({ action: 'admin.login', password: 'guess' + i });
  assert.equal(gas.call({ action: 'admin.login', password: 'letmein' }).code, 'locked');
});

test('staff page: no password configured means nobody gets in', () => {
  const gas = createGas({ now: Date.parse(NOW), properties: {} });
  assert.equal(gas.call({ action: 'admin.login', password: '' }).code, 'no_password');
  assert.equal(gas.call({ action: 'admin.login', password: 'anything' }).code, 'no_password');
});

test('staff can list, add and cancel bookings', () => {
  const gas = fresh();
  book(gas, { name: 'Online Olly', start: '12:00' });
  const add = gas.call({ action: 'admin.add', password: 'letmein', date: TUE, start: '10:00', length: 30, party: 2, table: '2', name: 'Walk-in Wendy' });
  assert.equal(add.ok, true, add.message);
  assert.equal(add.booking.table, '2');
  // staff can't double-book either
  assert.equal(gas.call({ action: 'admin.add', password: 'letmein', date: TUE, start: '10:00', length: 30, party: 2, table: '2', name: 'X' }).code, 'taken');

  const list = gas.call({ action: 'admin.list', password: 'letmein', from: TUE, to: TUE });
  assert.deepEqual(list.items.map(i => i.name), ['Walk-in Wendy', 'Online Olly']);
  assert.ok(list.items.every(i => !('token' in i)), 'secret cancel tokens are never sent to the staff page');

  const ref = list.items[1].ref;
  assert.equal(gas.call({ action: 'admin.cancel', password: 'letmein', ref }).ok, true);
  const again = gas.call({ action: 'admin.list', password: 'letmein', from: TUE, to: TUE });
  assert.equal(again.items.find(i => i.ref === ref).status, 'Cancelled');
});

test('staff can block a whole day, and customers then cannot book it', () => {
  const gas = fresh();
  const r = gas.call({ action: 'admin.block', password: 'letmein', from: TUE, table: 'All', reason: 'Holiday' });
  assert.equal(r.ok, true, r.message);
  for (const party of [1, 2, 4]) for (const start of ['10:00', '13:30']) {
    assert.equal(book(gas, { party, start, length: 30 }).code, 'taken');
  }
  assert.equal(book(gas, { date: WED }).ok, true);    // the next day is unaffected
});

test('staff can block one table only', () => {
  const gas = fresh();
  gas.call({ action: 'admin.block', password: 'letmein', from: TUE, table: '1', reason: 'Broken chair' });
  assert.equal(book(gas, { party: 2 }).booking.table, '2');   // falls back to the big table
  assert.equal(book(gas, { party: 2 }).code, 'taken');
});

test('staff can block a holiday date range; closed days are skipped; clashes are reported', () => {
  const gas = fresh();
  book(gas, { date: WED, name: 'Already Booked' });
  const r = gas.call({ action: 'admin.block', password: 'letmein', from: TUE, to: '2026-12-01', table: 'All', reason: 'Holiday' });
  assert.equal(r.ok, true);
  // Tue 24 – Tue 1 Dec: Tue, Wed, Thu, Fri, Sat, (Sun, Mon skipped), Tue = 6 days
  assert.deepEqual(r.created.map(c => c.date), ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-12-01']);
  assert.deepEqual(r.clashes.map(c => c.name), ['Already Booked']);
  // Removing a block opens the day up again
  gas.call({ action: 'admin.cancel', password: 'letmein', ref: r.created[0].ref });
  assert.equal(book(gas, {}).ok, true);
});

test('staff can block part of a day', () => {
  const gas = fresh();
  gas.call({ action: 'admin.block', password: 'letmein', from: TUE, table: 'All', start: '12:00', end: '13:00', reason: 'Private event' });
  assert.equal(book(gas, { start: '11:00', length: 90 }).code, 'taken');
  assert.equal(book(gas, { start: '11:00', length: 60 }).ok, true);
  assert.equal(book(gas, { start: '13:00', length: 60, party: 3 }).ok, true);
});

test('nightly tidy-up wipes personal details 30 days after the visit', () => {
  const gas = fresh();
  book(gas, { date: TUE, name: 'Old Booking', email: 'old@example.com', notes: 'nut allergy' });
  book(gas, { date: '2027-01-12', name: 'Future Booking' });
  gas.setNow('2026-12-25T03:00:00Z');   // 31 days later
  gas.context.dailyTidyUp();
  assert.deepEqual(gas.rows[1].slice(8, 12), ['Removed', '', '', '']);
  assert.equal(gas.rows[1][15], '');
  assert.equal(gas.rows[2][8], 'Future Booking');
});

test('setup() runs without errors', () => {
  const gas = fresh();
  gas.context.setup();
  assert.deepEqual(gas.rows[0].slice(0, 3), ['Ref', 'Type', 'Status']);
});

/* ---------------- Work & Events enquiries ---------------- */
function enquire(gas, o) {
  return gas.call(Object.assign({
    action: 'enquiry', name: 'Sam Manager', company: 'Acme Ltd', email: 'sam@acme.example', phone: '01225 700000',
    type: 'Regular team lunches', frequency: 'Monthly', date: '2026-12-10', people: '12', fulfil: 'Delivery',
    postcode: 'sn12 6aa', budget: '£10', dietary: '2 vegan, 1 nut allergy', message: 'Bagels for the team please'
  }, o));
}

test('enquiry: saved to the Enquiries tab, owner emailed (reply goes to customer), customer thanked', () => {
  const gas = fresh();
  const r = enquire(gas, {});
  assert.equal(r.ok, true, r.message);
  assert.match(r.ref, /^EN-[A-Z0-9]{6}$/);
  const sh = gas.sheets.Enquiries;
  assert.equal(sh[0][0], 'Ref');
  assert.deepEqual(sh[1].slice(2, 13), ['New', 'Sam Manager', 'Acme Ltd', 'sam@acme.example', '01225 700000',
    'Regular team lunches', 'Monthly', '10/12/2026', '12', 'Delivery', 'SN12 6AA']);
  const owner = gas.mail.find(m => m.to === 'owner@example.com');
  assert.match(owner.subject, /^New Work & Events enquiry: Acme Ltd \(Sam Manager\), 12 people, 10\/12\/2026$/);
  assert.equal(owner.replyTo, 'sam@acme.example');
  const thanks = gas.mail.find(m => m.to === 'sam@acme.example');
  assert.match(thanks.htmlBody, /within 2 working days/);
  assert.equal(gas.rows.length, 0, 'bookings untouched');
});

test('enquiry: checks the details', () => {
  const gas = fresh();
  assert.equal(enquire(gas, { name: '' }).code, 'bad_name');
  assert.equal(enquire(gas, { email: '' }).code, 'bad_email');
  assert.equal(enquire(gas, { type: 'Rave' }).code, 'bad_type');
  assert.equal(enquire(gas, { people: '0' }).code, 'bad_people');
  assert.equal(enquire(gas, { people: 'lots' }).code, 'bad_people');
  assert.equal(enquire(gas, { date: '2026-11-01' }).code, 'past');
  assert.equal(enquire(gas, { fulfil: 'Teleport' }).code, 'bad_fulfil');
  assert.equal(enquire(gas, { postcode: 'nowhere' }).code, 'bad_postcode');
  assert.equal(enquire(gas, { website: 'spam' }).code, 'spam');
  // Optional bits can be left out; collection doesn't need a postcode; date can be undecided
  assert.equal(enquire(gas, { company: '', phone: '', date: '', budget: '', dietary: '', message: '', fulfil: 'Collect', postcode: '',
    type: 'One-off event or party', frequency: 'Weekly' }).ok, true);
  const row = gas.sheets.Enquiries[1];
  assert.equal(row[8], '', 'frequency only kept for regular lunches');
});

test('enquiry: too many in an hour are refused (spam protection)', () => {
  const gas = fresh();
  for (let i = 0; i < 20; i++) assert.equal(enquire(gas, {}).ok, true);
  assert.equal(enquire(gas, {}).code, 'busy');
});

test('enquiry: details wiped after a year by the nightly tidy-up', () => {
  const gas = fresh();
  enquire(gas, {});
  gas.setNow('2027-11-21T03:00:00Z');
  assert.equal(enquire(gas, { name: 'Recent Person', date: '' }).ok, true);
  gas.setNow('2027-11-22T03:00:00Z');
  gas.context.dailyTidyUp();
  const [, old, recent] = gas.sheets.Enquiries;
  assert.equal(old[3], 'Removed');
  assert.equal(old[5], '');
  assert.equal(old[15], '');
  assert.equal(old[7], 'Regular team lunches', 'non-personal summary kept');
  assert.equal(recent[3], 'Recent Person');
});

/* ---------------- Reminder emails ---------------- */
test('reminders: sent the day before to people who gave an email, once only', () => {
  const gas = fresh();                                     // Thu 19 Nov 2026, 10:00
  book(gas, { date: '2026-11-21', start: '10:00', name: 'Saturday Sam', email: 'sam@example.com' });   // Saturday
  book(gas, { date: '2026-11-21', start: '11:00', name: 'Phone Only Pat', phone: '07700 900111' });
  const c = book(gas, { date: '2026-11-21', start: '12:00', name: 'Cancelled Cal', email: 'cal@example.com' });
  const u = new URL(c.cancelUrl);
  gas.call({ action: 'cancel', ref: u.searchParams.get('ref'), token: u.searchParams.get('t') });
  book(gas, { date: '2026-11-24', start: '10:00', name: 'Next Week Nia', email: 'nia@example.com' });

  gas.setNow('2026-11-20T10:00:00Z');                      // Friday 10am: tomorrow is Saturday
  gas.mail.length = 0;
  assert.equal(gas.context.sendReminders(), 1);
  assert.equal(gas.mail.length, 1);
  assert.equal(gas.mail[0].to, 'sam@example.com');
  assert.equal(gas.mail[0].subject, 'See you tomorrow at 10am – Smoove Cafe');
  assert.match(gas.mail[0].htmlBody, /Saturday 21 November 2026/);
  assert.match(gas.mail[0].htmlBody, /cancel\.html\?ref=SM-/);
  assert.match(gas.rows[1][16], /^20\/11\/2026 10:00$/, 'marked as reminded in the sheet');

  assert.equal(gas.context.sendReminders(), 0, 'never sent twice');
  assert.equal(gas.mail.length, 1);
});

test('reminders: not sent to someone who only booked today', () => {
  const gas = fresh();
  gas.setNow('2026-11-20T09:00:00Z');                      // Friday 9am
  book(gas, { date: '2026-11-21', email: 'late@example.com' });
  gas.setNow('2026-11-20T10:00:00Z');
  assert.equal(gas.context.sendReminders(), 0);
});

test('reminders: Tuesday bookings are reminded on Monday (even though we are closed)', () => {
  const gas = fresh();
  book(gas, { date: TUE, email: 'tue@example.com' });
  gas.setNow('2026-11-23T10:00:00Z');                      // Monday
  assert.equal(gas.context.sendReminders(), 1);
});

test('setup() installs the nightly tidy-up and the 10am reminders (UK time), once each', () => {
  const gas = fresh();
  assert.equal(gas.get().reminders, false);
  gas.context.setup();
  gas.context.setup();                                     // running it twice doesn't duplicate
  assert.deepEqual(gas.triggers.map(t => [t.handler, t.hour, t.tz]).sort(),
    [['dailyTidyUp', 3, 'Europe/London'], ['sendReminders', 10, 'Europe/London']]);
  assert.equal(gas.get().reminders, true);
});

test('older sheets get the new "Reminder sent" column header automatically', () => {
  const gas = fresh();
  book(gas, {});
  gas.rows[0].length = 16;                                 // pretend it is an old sheet
  book(gas, { start: '12:00' });
  assert.equal(gas.rows[0][16], 'Reminder sent');
});

test('nightly tidy-up keeps the Bookings tab in date and time order', () => {
  const gas = fresh();
  book(gas, { date: SAT, start: '12:00', name: 'C' });
  book(gas, { date: TUE, start: '11:00', name: 'B' });
  book(gas, { date: TUE, start: '10:00', name: 'A' });
  gas.context.dailyTidyUp();
  assert.deepEqual(gas.rows.slice(1).map(r => r[8]), ['A', 'B', 'C']);
  // and everything still works after sorting
  assert.equal(book(gas, { date: TUE, start: '10:00', party: 3 }).booking.table, '2');
});
