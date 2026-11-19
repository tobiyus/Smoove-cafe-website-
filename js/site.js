/* Shared behaviour for every page: navigation, footer, and filling in details from site-details.js */
(function () {
  var D = window.SMOOVE || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c];
    });
  }
  function telHref(p) { return 'tel:' + String(p).replace(/[^\d+]/g, ''); }
  function mapUrl() { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(D.mapSearch || ''); }
  function instaUrl() { return 'https://www.instagram.com/' + encodeURIComponent(D.instagram) + '/'; }

  var A = D.address || {};
  var addressLines = [A.building, A.street, A.town + (A.county ? ', ' + A.county : ''), A.postcode].filter(Boolean);

  var html = {
    address: function () { return addressLines.map(esc).join('<br>'); },
    addressInline: function () { return addressLines.map(esc).join(', '); },
    hours: function () {
      return '<ul class="hours">' + (D.hours || []).map(function (h) {
        return '<li><span>' + esc(h.days) + '</span><span>' + esc(h.times) + '</span></li>';
      }).join('') + '</ul>';
    },
    phone: function () { return D.phone ? '<a href="' + telHref(D.phone) + '">' + esc(D.phone) + '</a>' : ''; },
    email: function () { return D.email ? '<a href="mailto:' + esc(D.email) + '">' + esc(D.email) + '</a>' : ''; },
    instagram: function () { return D.instagram ? '<a href="' + instaUrl() + '" rel="noopener">@' + esc(D.instagram) + '</a>' : ''; },
    justEat: function () { return D.justEat ? '<a href="' + esc(D.justEat) + '" rel="noopener">Order on Just Eat</a>' : ''; },
    mapLink: function () { return '<a href="' + mapUrl() + '" rel="noopener">Open in Google Maps</a>'; },
    contactLine: function () {
      // "call us on X, email X or message us on Instagram @X"
      var bits = [];
      if (D.phone) bits.push('call us on ' + html.phone());
      if (D.email) bits.push('email ' + html.email());
      if (D.instagram) bits.push('message us on Instagram ' + html.instagram());
      if (!bits.length) return 'pop in and see us';
      return bits.length === 1 ? bits[0] : bits.slice(0, -1).join(', ') + ' or ' + bits[bits.length - 1];
    }
  };

  // Fill any element with data-fill="hours" etc. Hide anything marked data-needs="phone" if phone is empty.
  document.querySelectorAll('[data-fill]').forEach(function (el) {
    var f = html[el.getAttribute('data-fill')];
    if (f) el.innerHTML = f();
  });
  document.querySelectorAll('[data-needs]').forEach(function (el) {
    if (!D[el.getAttribute('data-needs')]) el.hidden = true;
  });

  // Logo images (optional)
  function logo(src) { return '<img src="' + esc(src) + '" alt="' + esc(D.name || 'Smoove Cafe') + '">'; }
  if (D.logoOnBurgundy) document.querySelectorAll('.site-header .brand').forEach(function (el) { el.innerHTML = logo(D.logoOnBurgundy); });

  // Photos (optional): <figure class="photo" data-photo="hero"> gets the image if one is set.
  document.querySelectorAll('[data-photo]').forEach(function (fig) {
    var p = (D.photos || {})[fig.getAttribute('data-photo')];
    if (p && p.file) {
      fig.innerHTML = '<img src="' + esc(p.file) + '" alt="' + esc(p.alt) + '"' + (fig.getAttribute('data-photo') === 'hero' ? '' : ' loading="lazy"') + '>';
    }
  });

  // The photo strip on the home page only appears once at least one of its photos has been added.
  document.querySelectorAll('[data-gallery]').forEach(function (sec) {
    if (sec.querySelector('img')) sec.hidden = false;
  });

  // Mobile navigation
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
  }

  // Footer
  var footer = document.getElementById('site-footer');
  if (footer) {
    var year = new Date().getFullYear();
    footer.innerHTML =
      '<div class="checker thin" aria-hidden="true"></div>' +
      '<div class="site-footer"><div class="wrap">' +
      '<div class="footer-grid">' +
      '<div><a class="brand" href="index.html">' +
      (D.logoOnBurgundy ? logo(D.logoOnBurgundy) : '<span class="brand-name">Smoove</span><span class="brand-sub">Cafe</span>') +
      '</a><p class="footer-slogan">' + esc(D.slogan) + '</p>' +
      '<p style="margin-top:1rem">Family-run, dog-friendly and very fond of a good bagel.</p></div>' +
      '<div><h2>Find us</h2><address>' + html.address() + '</address>' +
      '<p style="margin-top:0.75rem">' + html.mapLink() + '</p></div>' +
      '<div><h2>Opening hours</h2>' + html.hours() +
      '<ul class="footer-links" style="margin-top:1.25rem">' +
      (D.phone ? '<li>' + html.phone() + '</li>' : '') +
      (D.email ? '<li>' + html.email() + '</li>' : '') +
      (D.instagram ? '<li>Instagram ' + html.instagram() + '</li>' : '') +
      (D.justEat ? '<li>' + html.justEat() + '</li>' : '') +
      '</ul></div>' +
      '</div>' +
      '<div class="footer-base"><span>© ' + year + ' ' + esc(D.name) + ', Melksham</span>' +
      '<span><a href="privacy.html">Privacy notice</a> · <a href="book.html">Book a table</a></span></div>' +
      '</div></div>';
  }

  window.SmooveSite = { esc: esc, html: html, mapUrl: mapUrl };
})();
