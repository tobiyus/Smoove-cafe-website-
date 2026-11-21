/* Work & Events enquiry form */
(function () {
  var B = window.SmooveBooking;
  var esc = window.SmooveSite.esc;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('enquiry-form');
  var MIN_PEOPLE = 6, NOTICE_WORKING_DAYS = 5;

  if (!(window.SMOOVE || {}).bookingApiUrl) { $('enquiry-offline').hidden = false; return; }
  form.hidden = false;

  var today = B.ukNow().date;
  $('e-date').min = today;

  // The date that is 5 working days (Mon–Fri) from today
  var earliest = today;
  for (var n = 0; n < NOTICE_WORKING_DAYS;) {
    earliest = B.addDays(earliest, 1);
    var dow = B.dayOfWeek(earliest);
    if (dow !== 0 && dow !== 6) n++;
  }

  $('e-type').addEventListener('change', function () {
    $('e-frequency-field').hidden = this.value !== 'Regular team lunches';
  });

  var fulfil = '';
  $('e-fulfil').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    fulfil = btn.getAttribute('data-value');
    this.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    $('e-postcode-field').hidden = fulfil !== 'Delivery';
  });

  // Friendly, non-blocking notes about notice and group size
  function softNotes() {
    var notes = [];
    var d = $('e-date').value, people = Number($('e-people').value);
    if (d && d >= today && d < earliest) {
      notes.push('That\'s a bit sooner than our usual 5 working days\' notice. Send it anyway and we\'ll see what we can do.');
    }
    if (people >= 1 && people < MIN_PEOPLE) {
      notes.push('Our catering starts from ' + MIN_PEOPLE + ' people. For a smaller group, you could <a href="book.html">book a table</a> instead, or send this anyway.');
    }
    var el = $('e-soft');
    el.innerHTML = notes.map(function (n) { return '<p>' + n + '</p>'; }).join('');
    el.hidden = !notes.length;
  }
  $('e-date').addEventListener('change', softNotes);
  $('e-people').addEventListener('input', softNotes);

  function fail(msg, focusId) {
    $('e-error').innerHTML = '<p>' + msg + '</p>';
    $('e-error').hidden = false;
    if (focusId) $(focusId).focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = function (id) { return $(id).value.trim(); };
    if (!v('e-name')) return fail('Please tell us your name.', 'e-name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('e-email'))) return fail('Please give us an email address so we can send your quote.', 'e-email');
    if (!v('e-type')) return fail('Please tell us what the food is for.', 'e-type');
    var people = Number(v('e-people'));
    if (!(people >= 1 && Math.floor(people) === people)) return fail('Roughly how many people are you feeding?', 'e-people');
    if (!fulfil) return fail('Would you like to collect, or have it delivered?');
    if (fulfil === 'Delivery' && !v('e-postcode')) return fail('Please give us the delivery postcode.', 'e-postcode');
    $('e-error').hidden = true;

    var btn = $('e-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';
    window.smooveApi({
      action: 'enquiry', name: v('e-name'), company: v('e-company'), email: v('e-email'), phone: v('e-phone'),
      type: v('e-type'), frequency: v('e-type') === 'Regular team lunches' ? v('e-frequency') : '',
      date: v('e-date'), people: String(people), fulfil: fulfil, postcode: fulfil === 'Delivery' ? v('e-postcode') : '',
      budget: v('e-budget'), dietary: v('e-dietary'), message: v('e-message'), website: $('e-website').value
    }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Send enquiry';
      if (!res.ok) return fail(esc(res.message));
      var done = $('enquiry-done');
      done.innerHTML =
        '<p class="label">Enquiry sent</p>' +
        '<h3 style="font-style:italic;font-size:2rem">Thanks, ' + esc(v('e-name').split(' ')[0]) + '!</h3>' +
        '<p>We\'ve got your enquiry and we\'ll be in touch within 2 working days with ideas and a quote.</p>' +
        (res.emailSent ? '<p>We\'ve emailed you a copy (check your junk folder if it\'s not there).</p>' : '') +
        '<p style="font-size:1rem">Your reference: <strong>' + esc(res.ref) + '</strong></p>' +
        '<div class="btn-row"><a class="btn btn-wine" href="menu.html">Browse the menu</a></div>';
      form.hidden = true;
      done.hidden = false;
      done.focus();
      done.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
