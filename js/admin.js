/* Staff page: view, add and cancel bookings, and block out tables or days. */
(function () {
  var B = window.SmooveBooking;
  var esc = window.SmooveSite.esc;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'smooveAdmin';
  var password = '';
  try { password = sessionStorage.getItem(KEY) || ''; } catch (e) { /* private mode */ }

  function flash(html, isError) {
    var el = $('admin-message');
    el.className = 'notice' + (isError ? ' error' : ' success');
    el.innerHTML = html;
    el.hidden = !html;
    if (html) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function api(payload) {
    payload.password = password;
    return window.smooveApi(payload).then(function (res) {
      if (!res.ok && (res.code === 'bad_password' || res.code === 'locked' || res.code === 'no_password')) {
        signOut(res.message);
      }
      return res;
    });
  }

  if (!(window.SMOOVE || {}).bookingApiUrl) {
    $('login').hidden = false;
    $('login-message').innerHTML = '<p>The booking system isn\'t connected yet. Follow step 4 in the README first.</p>';
    $('login-message').hidden = false;
    return;
  }

  /* ---------- Sign in / out ---------- */
  function signOut(msg) {
    password = '';
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    $('admin').hidden = true;
    $('login').hidden = false;
    $('login-message').innerHTML = msg ? '<p>' + esc(msg) + '</p>' : '';
    $('login-message').hidden = !msg;
  }

  $('login').addEventListener('submit', function (e) {
    e.preventDefault();
    password = $('a-password').value;
    window.smooveApi({ action: 'admin.login', password: password }).then(function (res) {
      if (!res.ok) { signOut(res.message); return; }
      try { sessionStorage.setItem(KEY, password); } catch (err) { /* ignore */ }
      $('a-password').value = '';
      start();
    });
  });
  $('logout').addEventListener('click', function () { signOut(''); });

  /* ---------- Tabs ---------- */
  document.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.getAttribute('data-tab');
      document.querySelectorAll('[data-tab]').forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-pressed', String(on));
        b.className = 'btn ' + (on ? 'btn-wine' : 'btn-outline');
      });
      document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== tab; });
      flash('');
      if (tab === 'list') loadList();
    });
  });

  /* ---------- Bookings list ---------- */
  var today = B.ukNow().date;
  $('f-from').value = today;
  $('f-to').value = B.addDays(today, 30);
  $('list-filter').addEventListener('submit', function (e) { e.preventDefault(); loadList(); });
  $('f-cancelled').addEventListener('change', function () { renderList(); });
  var lastItems = [];

  function loadList() {
    $('list').innerHTML = '<p><span class="spinner" aria-hidden="true"></span> Loading…</p>';
    api({ action: 'admin.list', from: $('f-from').value, to: $('f-to').value }).then(function (res) {
      if (!res.ok) { $('list').innerHTML = '<p class="notice error">' + esc(res.message) + '</p>'; return; }
      lastItems = res.items;
      renderList();
    });
  }

  function renderList() {
    var showCancelled = $('f-cancelled').checked;
    var items = lastItems.filter(function (b) { return showCancelled || b.status !== 'Cancelled'; });
    if (!items.length) { $('list').innerHTML = '<p>No bookings in these dates.</p>'; return; }
    var byDay = {};
    items.forEach(function (b) { (byDay[b.date] = byDay[b.date] || []).push(b); });
    $('list').innerHTML = Object.keys(byDay).sort().map(function (date) {
      return '<div class="admin-day"><h3>' + esc(B.prettyDate(date)) + (date === today ? ' (today)' : '') + '</h3>' +
        byDay[date].map(item).join('') + '</div>';
    }).join('');
  }

  function tableLabel(t) { return t === 'All' ? 'Both tables' : 'Table ' + t; }

  function item(b) {
    var cancelled = b.status === 'Cancelled';
    var isBlock = b.type === 'Block';
    var time = isBlock && b.start === '00:00' && b.end === '24:00' ? 'All day' : esc(b.start) + '–' + esc(b.end);
    var head = '<div class="top"><span>' + time + ' · ' + esc(tableLabel(b.table)) + '</span>' +
      '<span>' + (cancelled ? '<span class="pill cancelled">Cancelled</span>' : isBlock ? '<span class="pill block">Blocked</span>' : '<span class="pill">' + esc(b.party) + ' people</span>') + '</span></div>';
    var body = isBlock
      ? '<p class="meta who">' + esc(b.name) + '</p>'
      : '<p class="meta who"><strong>' + esc(b.name) + '</strong></p>' +
        (b.phone ? '<p class="meta"><a href="tel:' + esc(b.phone.replace(/[^\d+]/g, '')) + '">' + esc(b.phone) + '</a></p>' : '') +
        (b.email ? '<p class="meta"><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a></p>' : '') +
        (b.notes ? '<p class="meta">Notes: ' + esc(b.notes) + '</p>' : '') +
        '<p class="meta">Ref ' + esc(b.ref) + ' · ' + esc(b.source) + ' · made ' + esc(b.created) +
        (b.reminded ? ' · reminder sent ' + esc(b.reminded) : '') + '</p>';
    var action = cancelled ? '' :
      '<button class="btn btn-outline" type="button" data-cancel="' + esc(b.ref) + '" data-kind="' + (isBlock ? 'block' : 'booking') + '"' +
      (b.email ? ' data-email="1"' : '') + '>' + (isBlock ? 'Remove block' : 'Cancel booking') + '</button>';
    return '<div class="admin-item' + (cancelled ? ' cancelled' : '') + (isBlock ? ' block' : '') + '">' + head + body + action + '</div>';
  }

  $('list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cancel]');
    if (!btn) return;
    var isBlock = btn.getAttribute('data-kind') === 'block';
    if (!confirm(isBlock ? 'Remove this block?' : 'Cancel this booking?')) return;
    var notify = !isBlock && btn.getAttribute('data-email') && confirm('Email the customer to let them know it\'s cancelled?');
    btn.disabled = true;
    api({ action: 'admin.cancel', ref: btn.getAttribute('data-cancel'), notifyCustomer: !!notify }).then(function (res) {
      if (!res.ok) { btn.disabled = false; flash('<p>' + esc(res.message) + '</p>', true); return; }
      flash('<p>' + (isBlock ? 'Block removed.' : 'Booking cancelled.' + (res.emailSent ? ' The customer has been emailed.' : '')) + '</p>');
      loadList();
    });
  });

  /* ---------- Add booking ---------- */
  function fillSelect(sel, opts, value) {
    sel.innerHTML = opts.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  var partyOpts = [];
  for (var p = 1; p <= B.maxPartySize(); p++) partyOpts.push([p, p + (p === 1 ? ' person' : ' people')]);
  fillSelect($('ad-party'), partyOpts, 2);
  fillSelect($('ad-start'), B.startTimes().map(function (t) { return [B.toTime(t), B.prettyTime(t)]; }), '');
  function fillLengths() {
    var start = B.toMinutes($('ad-start').value);
    var current = $('ad-length').value;
    fillSelect($('ad-length'), B.lengthsFor(start).map(function (l) { return [l, B.prettyLength(l)]; }), current || 60);
  }
  $('ad-start').addEventListener('change', fillLengths);
  fillLengths();
  $('ad-date').value = today;

  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = e.submitter || this.querySelector('button[type="submit"]');
    btn.disabled = true;
    api({
      action: 'admin.add', date: $('ad-date').value, start: $('ad-start').value, length: Number($('ad-length').value),
      party: Number($('ad-party').value), table: $('ad-table').value, name: $('ad-name').value, phone: $('ad-phone').value,
      email: $('ad-email').value, notes: $('ad-notes').value, sendEmail: $('ad-send').checked
    }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { flash('<p>' + esc(res.message) + '</p>', true); return; }
      var bk = res.booking;
      flash('<p>Booked: <strong>' + esc(bk.name) + '</strong>, ' + esc(B.prettyDate(bk.date)) + ' at ' + esc(bk.start) + ', ' +
        esc(bk.tableName) + '. Ref ' + esc(bk.ref) + (res.emailSent ? '. Confirmation emailed.' : '.') + '</p>');
      ['ad-name', 'ad-phone', 'ad-email', 'ad-notes'].forEach(function (id) { $(id).value = ''; });
    });
  });

  /* ---------- Block time ---------- */
  $('bl-from').value = today;
  $('bl-allday').addEventListener('change', function () { $('bl-times').hidden = this.checked; });
  $('block-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var allDay = $('bl-allday').checked;
    var btn = e.submitter || this.querySelector('button[type="submit"]');
    btn.disabled = true;
    api({
      action: 'admin.block', from: $('bl-from').value, to: $('bl-to').value || $('bl-from').value, table: $('bl-table').value,
      start: allDay ? '' : $('bl-start').value, end: allDay ? '' : $('bl-end').value, reason: $('bl-reason').value
    }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { flash('<p>' + esc(res.message) + '</p>', true); return; }
      var msg = '<p>Blocked ' + res.created.length + (res.created.length === 1 ? ' day' : ' days') + '.</p>';
      if (res.clashes.length) {
        msg += '<p><strong>Heads up:</strong> these bookings are already in that time. They have <em>not</em> been cancelled, so please contact them or cancel them from the Bookings tab:</p><ul>' +
          res.clashes.map(function (c) {
            return '<li>' + esc(B.shortDate(c.date)) + ' ' + esc(c.start) + ' · ' + esc(c.name) + ' ' + esc(c.phone || c.email || '') + '</li>';
          }).join('') + '</ul>';
      }
      flash(msg, false);
    });
  });

  /* ---------- Start ---------- */
  function start() {
    $('login').hidden = true;
    $('admin').hidden = false;
    loadList();
  }
  if (password) start(); else signOut('');
})();
