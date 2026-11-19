/* "Cancel my booking" page, opened from the link in the confirmation email */
(function () {
  var B = window.SmooveBooking;
  var esc = window.SmooveSite.esc;
  var box = document.getElementById('cancel-app');
  var q = new URLSearchParams(location.search);
  var ref = q.get('ref'), token = q.get('t');
  var help = '<p>If you need a hand, ' + window.SmooveSite.html.contactLine() + '.</p>';

  function summary(bk) {
    var s = B.toMinutes(bk.start), e = B.toMinutes(bk.end);
    return '<ul class="summary">' +
      '<li><span>Date</span><span>' + esc(B.prettyDate(bk.date)) + '</span></li>' +
      '<li><span>Time</span><span>' + esc(B.prettyTime(s)) + ' – ' + esc(B.prettyTime(e)) + '</span></li>' +
      '<li><span>People</span><span>' + esc(bk.party) + '</span></li>' +
      '<li><span>Name</span><span>' + esc(bk.name) + '</span></li>' +
      '<li><span>Reference</span><span>' + esc(bk.ref) + '</span></li></ul>';
  }

  if (!ref || !token || !(window.SMOOVE || {}).bookingApiUrl) {
    box.innerHTML = '<h2>Booking link not recognised</h2><p>Please use the link from your confirmation email.</p>' + help;
    return;
  }

  window.smooveApi({ action: 'lookup', ref: ref, token: token }).then(function (res) {
    if (!res.ok) { box.innerHTML = '<h2>Hmm, we can\'t find that</h2><p>' + esc(res.message) + '</p>' + help; return; }
    var bk = res.booking;
    if (bk.status === 'Cancelled') {
      box.innerHTML = '<h2>Already cancelled</h2>' + summary(bk) + '<p>This booking has already been cancelled. Fancy another day?</p>' +
        '<a class="btn btn-wine" href="book.html">Book a table</a>';
      return;
    }
    if (!res.canCancel) {
      box.innerHTML = '<h2>This booking has started or passed</h2>' + summary(bk) + '<p>It can\'t be cancelled online any more.</p>' + help;
      return;
    }
    box.innerHTML = '<h2>Your booking</h2>' + summary(bk) +
      '<div id="cancel-message" class="notice error" role="alert" hidden></div>' +
      '<div class="btn-row"><button class="btn btn-wine" type="button" id="do-cancel">Cancel my booking</button>' +
      '<a class="btn btn-outline" href="index.html">Keep it</a></div>';
    document.getElementById('do-cancel').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Cancelling…';
      window.smooveApi({ action: 'cancel', ref: ref, token: token }).then(function (r) {
        if (r.ok) {
          box.innerHTML = '<h2>All cancelled</h2>' + summary(r.booking) +
            '<p>Thanks for letting us know. ' + (r.booking.email ? 'We\'ve emailed you to confirm. ' : '') + 'Hope to see you another time!</p>' +
            '<a class="btn btn-wine" href="book.html">Book another day</a>';
        } else {
          btn.disabled = false;
          btn.textContent = 'Cancel my booking';
          var m = document.getElementById('cancel-message');
          m.innerHTML = '<p>' + esc(r.message) + '</p>';
          m.hidden = false;
        }
      });
    });
  });
})();
