/* Builds the Menu page from js/menu.js */
(function () {
  var M = window.SMOOVE_MENU;
  var esc = window.SmooveSite.esc;
  if (!M) {
    document.querySelectorAll('[data-menu="food"]').forEach(function (el) {
      el.innerHTML = '<p class="notice error">Sorry, the menu didn\'t load. Please refresh the page.</p>';
    });
    return;
  }

  function tag(t) {
    return t ? ' <span class="tag' + (/soon/i.test(t) ? ' soon' : '') + '">' + esc(t) + '</span>' : '';
  }

  function section(s) {
    var head = '<div class="menu-section-head"><h3>' + esc(s.title) + '</h3>' +
      (s.price ? '<span class="section-price">' + esc(s.price) + '</span>' : '') + '</div>';
    var intro = s.intro ? '<p class="intro">' + esc(s.intro) + '</p>' : '';
    var notes = (s.notes && s.notes.length) ? '<ul class="notes">' + s.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '';
    var items = '<ul class="menu-items">' + (s.items || []).map(function (i) {
      return '<li class="menu-item"><div class="menu-item-head"><span class="name">' + esc(i.name) + tag(i.tag) + '</span>' +
        (i.price ? '<span class="price">' + esc(i.price) + '</span>' : '') + '</div>' +
        (i.description ? '<p class="desc">' + esc(i.description) + '</p>' : '') +
        (i.extra ? '<p class="extra">' + esc(i.extra) + '</p>' : '') +
        (i.allergens ? '<p class="allergens"><span class="visually-hidden">Allergens: </span>' + esc(i.allergens) + '</p>' : '') +
        '</li>';
    }).join('') + '</ul>';
    return '<article class="menu-section">' + head + intro + notes + items + '</article>';
  }

  document.querySelectorAll('[data-menu]').forEach(function (el) {
    var k = el.getAttribute('data-menu');
    if (k === 'food' || k === 'drinks') el.innerHTML = (M[k] || []).map(section).join('');
    if (k === 'key') el.innerHTML = (M.key || []).map(function (p) { return '<li><b>' + esc(p[0]) + '</b> ' + esc(p[1]) + '</li>'; }).join('');
    if (k === 'allergy') el.textContent = M.allergyNote || '';
    if (k === 'loyalty') el.textContent = M.loyalty || '';
  });

  // Highlight the Food / Drinks tab for the section on screen
  var links = document.querySelectorAll('.menu-tabs a');
  var parts = ['food', 'drinks'].map(function (id) { return document.getElementById(id); });
  function update() {
    var current = 'food';
    parts.forEach(function (p) { if (p && p.getBoundingClientRect().top < window.innerHeight * 0.4) current = p.id; });
    links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + current); });
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();
