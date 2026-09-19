(function () {
  'use strict';

  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    return;
  }

  var INTERVAL_MS = 15000;
  var running = false;

  function apply(rows) {
    LAND_PLOTS = rows;
    if (typeof window.refreshSiteData === 'function') {
      window.refreshSiteData();
    }
  }

  function poll() {
    if (running) return;
    running = true;
    fetch('/api/land', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('bad status');
        return r.json();
      })
      .then(function (rows) {
        if (Array.isArray(rows) && rows.length) apply(rows);
      })
      .catch(function () {})
      .then(function () {
        running = false;
      });
  }

  setTimeout(poll, 800);
  setInterval(poll, INTERVAL_MS);
})();