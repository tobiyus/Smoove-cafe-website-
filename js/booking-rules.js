/*
 * SMOOVE CAFE – BOOKING RULES
 * ---------------------------------------------------------------
 * These rules are shared by the website (to show which times are free)
 * and by the Google Apps Script back end (which double-checks every
 * booking before saving it). If you change anything here you must ALSO
 * copy the new apps-script/Code.gs into Google Apps Script – see the README.
 *
 * Days: 0 = Sunday, 1 = Monday, 2 = Tuesday ... 6 = Saturday
 */
var SMOOVE_BOOKING_SETTINGS = {
  tables: [
    { id: '1', name: 'Table 1', seats: 2, description: 'our cosy two-seater' },
    { id: '2', name: 'Table 2', seats: 6, description: 'our big table, seats up to six' }
  ],
  bookingDays: [2, 3, 4, 5, 6],      // Tuesday to Saturday
  firstStart: '10:00',               // earliest booking start time
  lastStart: '13:30',                // latest booking start time
  stepMinutes: 30,                   // gap between start times
  closingTime: '14:30',              // every booking must finish by this time
  lengths: [30, 60, 90, 120],        // booking lengths offered, in minutes
  timeZone: 'Europe/London'
};

/* ---------- You shouldn't need to edit anything below this line ---------- */

var SmooveBooking = (function (S) {
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toMinutes(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return NaN;
    var h = +m[1], min = +m[2];
    if (min > 59 || h > 24 || (h === 24 && min > 0)) return NaN;   // 24:00 = end of day
    return h * 60 + min;
  }

  function toTime(minutes) { return pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60); }

  /** "13:30" -> "1:30pm" */
  function prettyTime(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    var suffix = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (m ? ':' + pad(m) : '') + suffix;
  }

  function prettyLength(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    var parts = [];
    if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m) parts.push(m + ' minutes');
    return parts.join(' ');
  }

  function isValidDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }

  function dayOfWeek(dateStr) {
    var p = dateStr.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
  }

  /** "2026-11-21" -> "Saturday 21 November 2026" */
  function prettyDate(dateStr) {
    if (!isValidDate(dateStr)) return dateStr;
    var p = dateStr.split('-');
    return DAY_NAMES[dayOfWeek(dateStr)] + ' ' + (+p[2]) + ' ' + MONTH_NAMES[+p[1] - 1] + ' ' + p[0];
  }

  /** "2026-11-21" -> "21/11/2026" */
  function shortDate(dateStr) {
    var p = String(dateStr).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : dateStr;
  }

  function addDays(dateStr, n) {
    var p = dateStr.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function isBookingDay(dateStr) {
    return isValidDate(dateStr) && S.bookingDays.indexOf(dayOfWeek(dateStr)) !== -1;
  }

  function closingMinutes() { return toMinutes(S.closingTime); }

  function startTimes() {
    var out = [];
    for (var t = toMinutes(S.firstStart); t <= toMinutes(S.lastStart); t += S.stepMinutes) out.push(t);
    return out;
  }

  /** Booking lengths that finish by closing time. */
  function lengthsFor(start) {
    return S.lengths.filter(function (len) { return start + len <= closingMinutes(); });
  }

  function overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }

  function maxPartySize() {
    return S.tables.reduce(function (max, t) { return Math.max(max, t.seats); }, 0);
  }

  /** Tables big enough for the party, smallest first (so 1–2 people try the 2-seater first). */
  function tablesForParty(party) {
    return S.tables
      .filter(function (t) { return t.seats >= party; })
      .sort(function (a, b) { return a.seats - b.seats; });
  }

  function getTable(id) {
    for (var i = 0; i < S.tables.length; i++) if (S.tables[i].id === String(id)) return S.tables[i];
    return null;
  }

  /** busy = [{table: '1' | '2' | 'All', start: minutes, end: minutes}] */
  function isTableFree(tableId, start, end, busy) {
    for (var i = 0; i < busy.length; i++) {
      var b = busy[i];
      if ((String(b.table) === String(tableId) || b.table === 'All') && overlaps(start, end, b.start, b.end)) return false;
    }
    return true;
  }

  function suggestTable(party, start, length, busy) {
    var options = tablesForParty(party);
    for (var i = 0; i < options.length; i++) {
      if (isTableFree(options[i].id, start, start + length, busy)) return options[i];
    }
    return null;
  }

  function isPast(dateStr, start, now) {
    if (dateStr < now.date) return true;
    return dateStr === now.date && start <= now.minutes;
  }

  /** Current date and time in the UK, e.g. {date: '2026-11-19', minutes: 615}. */
  function ukNow(date) {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: S.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date || new Date());
    var v = {};
    parts.forEach(function (p) { v[p.type] = p.value; });
    return { date: v.year + '-' + v.month + '-' + v.day, minutes: (+v.hour % 24) * 60 + +v.minute };
  }

  /**
   * Checks a booking request against every rule.
   * req = {date, start: 'HH:MM', length: minutes, party, table (optional, staff only)}
   * opts = {now, busy, allowPast}
   * Returns {ok: true, table, start, end} or {ok: false, code, message}.
   */
  function check(req, opts) {
    function fail(code, message) { return { ok: false, code: code, message: message }; }
    var party = Number(req.party);
    var length = Number(req.length);
    var start = toMinutes(req.start);

    if (!isValidDate(req.date)) return fail('bad_date', 'Please choose a date.');
    if (!(party >= 1) || Math.floor(party) !== party) return fail('bad_party', 'Please tell us how many people are coming.');
    if (party > maxPartySize()) {
      return fail('too_many', 'For groups of more than ' + maxPartySize() + ', please get in touch and we\'ll do our best to fit you in.');
    }
    if (!isBookingDay(req.date)) return fail('closed_day', 'We only take bookings Tuesday to Saturday.');
    if (isNaN(start) || startTimes().indexOf(start) === -1) {
      return fail('bad_time', 'Bookings start between ' + prettyTime(toMinutes(S.firstStart)) + ' and ' +
        prettyTime(toMinutes(S.lastStart)) + ', every ' + S.stepMinutes + ' minutes.');
    }
    if (S.lengths.indexOf(length) === -1) return fail('bad_length', 'Please choose how long you\'d like the table.');
    if (start + length > closingMinutes()) {
      return fail('too_late', 'That booking would run past closing time (' + prettyTime(closingMinutes()) + '). Please choose a shorter time.');
    }
    if (!opts.allowPast && isPast(req.date, start, opts.now)) return fail('past', 'That time has already passed. Please choose a later time.');

    var table;
    if (req.table) {
      table = getTable(req.table);
      if (!table) return fail('bad_table', 'Unknown table.');
      if (table.seats < party) return fail('table_too_small', table.name + ' only seats ' + table.seats + '.');
      if (!isTableFree(table.id, start, start + length, opts.busy)) return fail('taken', table.name + ' is already booked at that time.');
    } else {
      table = suggestTable(party, start, length, opts.busy);
      if (!table) return fail('taken', 'Sorry, that time has just been taken. Please pick another time.');
    }
    return { ok: true, table: table, start: start, end: start + length };
  }

  return {
    settings: S,
    toMinutes: toMinutes, toTime: toTime, prettyTime: prettyTime, prettyLength: prettyLength,
    prettyDate: prettyDate, shortDate: shortDate, addDays: addDays, dayOfWeek: dayOfWeek,
    isValidDate: isValidDate, isBookingDay: isBookingDay, startTimes: startTimes, lengthsFor: lengthsFor,
    closingMinutes: closingMinutes, overlaps: overlaps, maxPartySize: maxPartySize,
    tablesForParty: tablesForParty, getTable: getTable, isTableFree: isTableFree,
    suggestTable: suggestTable, isPast: isPast, ukNow: ukNow, check: check
  };
})(SMOOVE_BOOKING_SETTINGS);

if (typeof module !== 'undefined' && module.exports) module.exports = SmooveBooking;
