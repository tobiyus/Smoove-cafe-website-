/* Talks to the Google Apps Script booking back end. */
window.smooveApi = function (payload) {
  var url = (window.SMOOVE || {}).bookingApiUrl;
  if (!url) return Promise.reject(new Error('Booking system not set up yet.'));
  // Sent as plain text so the browser doesn't need an extra permission check with Google.
  return fetch(url, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .catch(function (err) {
      console.error(err);
      return { ok: false, code: 'network', message: 'We couldn\'t reach our booking system. Please check your connection and try again.' };
    });
};
