/* Loads the Google map only when someone asks for it (no Google cookies until then). */
(function () {
  var btn = document.getElementById('load-map');
  var box = document.getElementById('map-box');
  if (!btn || !box) return;
  btn.addEventListener('click', function () {
    var q = encodeURIComponent((window.SMOOVE || {}).mapSearch || '');
    box.classList.add('loaded');
    box.innerHTML = '<iframe title="Map showing Smoove Cafe" loading="lazy" referrerpolicy="no-referrer-when-downgrade" ' +
      'src="https://www.google.com/maps?q=' + q + '&output=embed"></iframe>';
  });
})();
