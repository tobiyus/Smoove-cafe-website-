/* The "Book a table" form */
(function () {
  var B = window.SmooveBooking;
  var S = B.settings;
  var D = window.SMOOVE || {};
  var esc = window.SmooveSite.esc;
  var $ = function (id) { return document.getElementById(id); };

  var form = $('booking-form');
  if (!D.bookingApiUrl) { $('booking-offline').hidden = false; return; }
  form.hidden = false;

  var state = { date: '', party: 2, start: null, length: null, avail: null, requestId: 0 };
  var MAX = B.maxPartySize();

  function show(id, on) { $(id).hidden = !on; }
  function message(id, html) { var el = $(id); el.innerHTML = html || ''; el.hidden = !html; }

  /* ---------- Step 1: date ---------- */
  var dateInput = $('b-date');
  var now = B.ukNow();
  dateInput.min = now.date;
  var lastStart = B.toMinutes(S.lastStart);
  var d = now.date;
  for (var i = 0; i < 14; i++, d = B.addDays(d, 1)) {
    if (B.isBookingDay(d) && (d > now.date || now.minutes < lastStart)) break;
  }
  dateInput.value = d;
  dateInput.addEventListener('change', loadDate);

  /* ---------- Step 2: party size ---------- */
  var partyPicker = $('party-picker');
  for (var p = 1; p <= MAX + 1; p++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.party = String(p);
    b.textContent = p > MAX ? MAX + '+' : String(p);
    if (p > MAX) b.setAttribute('aria-label', 'More than ' + MAX + ' people');
    else b.setAttribute('aria-label', p + (p === 1 ? ' person' : ' people'));
    b.setAttribute('aria-pressed', String(p === state.party));
    partyPicker.appendChild(b);
  }
  partyPicker.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    state.party = Number(btn.dataset.party);
    partyPicker.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
    render();
  });

  /* ---------- Load availability ---------- */
  function loadDate() {
    state.date = dateInput.value;
    state.avail = null;
    state.start = null;
    state.length = null;
    message('date-message', '');
    if (!B.isValidDate(state.date)) { render(); return; }
    if (!B.isBookingDay(state.date)) {
      message('date-message', '<p>We only take bookings <strong>Tuesday to Saturday</strong>, and we\'re closed on Sundays and Mondays. Please choose another day.</p>');
      render();
      return;
    }
    if (state.date < B.ukNow().date) {
      message('date-message', '<p>That date has already passed. Please choose another day.</p>');
      render();
      return;
    }
    var id = ++state.requestId;
    message('time-message', '<p><span class="spinner" aria-hidden="true"></span> Checking which times are free…</p>');
    show('step-time', true);
    $('time-picker').innerHTML = '';
    window.smooveApi({ action: 'availability', date: state.date }).then(function (res) {
      if (id !== state.requestId) return;   // a newer date was chosen meanwhile
      if (!res.ok) { message('time-message', '<p>' + esc(res.message) + '</p>'); return; }
      state.avail = res;
      render();
    });
  }

  /* ---------- Render steps 3 & 4 ---------- */
  function render() {
    var tooMany = state.party > MAX;
    message('party-message', tooMany
      ? '<p>For groups of more than ' + MAX + ', please get in touch and we\'ll do our best to fit you in: ' + window.SmooveSite.html.contactLine() + '.</p>'
      : '');
    var ready = !tooMany && state.avail && state.avail.date === state.date;
    show('step-time', !tooMany && B.isBookingDay(state.date) && !$('date-message').innerHTML);
    if (!ready) { show('step-length', false); show('step-details', false); return; }

    var busy = state.avail.busy, nowAt = state.avail.now;
    var picker = $('time-picker');
    picker.innerHTML = '';
    var anyFree = false;
    B.startTimes().forEach(function (t) {
      var past = B.isPast(state.date, t, nowAt);
      var free = !past && B.lengthsFor(t).some(function (len) { return B.suggestTable(state.party, t, len, busy); });
      anyFree = anyFree || free;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.start = String(t);
      btn.disabled = !free;
      btn.setAttribute('aria-pressed', String(state.start === t && free));
      btn.innerHTML = esc(B.prettyTime(t)) + (free ? '' : '<small>' + (past ? 'Passed' : 'Taken') + '</small>');
      if (!free) btn.setAttribute('aria-label', B.prettyTime(t) + ', unavailable');
      picker.appendChild(btn);
    });
    if (state.start !== null && !picker.querySelector('[data-start="' + state.start + '"]:not([disabled])')) {
      state.start = null;
      state.length = null;
    }
    message('time-message', anyFree ? '' : '<p>Sorry, there are no tables left for ' + state.party +
      (state.party === 1 ? ' person' : ' people') + ' on ' + esc(B.prettyDate(state.date)) + '. Please try another day. Walk-ins are always welcome if a table\'s free.</p>');
    renderLengths();
  }

  function renderLengths() {
    show('step-length', state.start !== null);
    if (state.start === null) { show('step-details', false); return; }
    var busy = state.avail.busy;
    var picker = $('length-picker');
    picker.innerHTML = '';
    B.lengthsFor(state.start).forEach(function (len) {
      var table = B.suggestTable(state.party, state.start, len, busy);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.length = String(len);
      btn.disabled = !table;
      btn.setAttribute('aria-pressed', String(state.length === len && !!table));
      btn.innerHTML = esc(B.prettyLength(len)) + '<small>' + (table ? 'until ' + esc(B.prettyTime(state.start + len)) : 'Taken') + '</small>';
      picker.appendChild(btn);
    });
    if (state.length !== null && !B.suggestTable(state.party, state.start, state.length, busy)) state.length = null;
    var table = state.length !== null && B.suggestTable(state.party, state.start, state.length, busy);
    message('table-message', table
      ? '<p>Lovely. You\'ll be at <strong>' + esc(table.name) + '</strong>, ' + esc(table.description) + ', from ' +
        esc(B.prettyTime(state.start)) + ' to ' + esc(B.prettyTime(state.start + state.length)) + ' on ' + esc(B.prettyDate(state.date)) + '.</p>'
      : '');
    show('step-details', !!table);
  }

  $('time-picker').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    state.start = Number(btn.dataset.start);
    $('time-picker').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
    renderLengths();
    $('step-length').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('length-picker').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    state.length = Number(btn.dataset.length);
    renderLengths();
    $('step-details').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ---------- Submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('b-name').value.trim(), phone = $('b-phone').value.trim(), email = $('b-email').value.trim();
    if (!name) { message('submit-message', '<p>Please tell us your name.</p>'); $('b-name').focus(); return; }
    if (!phone && !email) { message('submit-message', '<p>Please give us a phone number or an email address.</p>'); $('b-phone').focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message('submit-message', '<p>That email address doesn\'t look quite right.</p>'); $('b-email').focus(); return; }
    message('submit-message', '');
    var btn = $('b-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Booking…';

    window.smooveApi({
      action: 'book', date: state.date, start: B.toTime(state.start), length: state.length, party: state.party,
      name: name, phone: phone, email: email, notes: $('b-notes').value.trim(), website: $('b-website').value
    }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Confirm booking';
      if (res.ok) return done(res);
      message('submit-message', '<p>' + esc(res.message) + '</p>');
      if (res.code === 'taken' || res.code === 'past') {
        var keep = { start: state.start };
        window.smooveApi({ action: 'availability', date: state.date }).then(function (r) {
          if (r.ok) { state.avail = r; state.start = keep.start; render(); }
          message('submit-message', '<p>' + esc(res.message) + '</p>');
        });
      }
    });
  });

  function done(res) {
    var bk = res.booking;
    var s = B.toMinutes(bk.start), en = B.toMinutes(bk.end);
    var box = $('booking-done');
    box.innerHTML =
      '<p class="label">Booking confirmed</p>' +
      '<h2 style="font-style:italic">You\'re booked in!</h2>' +
      '<p>Thanks, ' + esc(bk.name) + '. We\'ll have your table ready.</p>' +
      '<ul class="summary">' +
      '<li><span>Date</span><span>' + esc(B.prettyDate(bk.date)) + '</span></li>' +
      '<li><span>Time</span><span>' + esc(B.prettyTime(s)) + ' – ' + esc(B.prettyTime(en)) + ' (' + esc(B.prettyLength(en - s)) + ')</span></li>' +
      '<li><span>People</span><span>' + esc(bk.party) + '</span></li>' +
      '<li><span>Table</span><span>' + esc(bk.tableName) + ', ' + esc(bk.tableDescription) + '</span></li>' +
      '<li><span>Reference</span><span>' + esc(bk.ref) + '</span></li>' +
      '</ul>' +
      (bk.email
        ? (res.emailSent ? '<p>We\'ve emailed you a confirmation (check your junk folder if it\'s not there), and we\'ll send a quick reminder the day before.</p>'
          : '<p>We couldn\'t send your confirmation email just now, but don\'t worry: your booking is saved.</p>')
        : '<p>You didn\'t give an email, so please save your reference or bookmark the cancel link below.</p>') +
      '<div class="notice"><p><strong>Can\'t make it?</strong> No worries, just let us know so someone else can grab the table: ' +
      '<a href="' + esc(res.cancelUrl) + '">cancel this booking</a>.</p></div>' +
      '<div class="btn-row"><a class="btn btn-wine" href="menu.html">Have a look at the menu</a>' +
      '<a class="btn btn-outline" href="book.html">Make another booking</a></div>';
    form.hidden = true;
    box.hidden = false;
    box.focus();
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  loadDate();
})();
