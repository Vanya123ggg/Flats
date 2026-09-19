(function () {
  var form = document.getElementById('filter-form');
  var fRegion = document.getElementById('f-region');
  var fStart = document.getElementById('f-start');
  var fEnd = document.getElementById('f-end');
  var fInterval = document.getElementById('f-interval');
  var errBox = document.getElementById('report-error');

  var SEGMENTS = [
    { key: 's1', label: 'До 30 соток', test: function (p) { return p.area <= 30; } },
    { key: 's2', label: 'От 30 до 50 соток', test: function (p) { return p.area > 30 && p.area <= 50; } },
    { key: 's3', label: 'Свыше 50 соток', test: function (p) { return p.area > 50; } }
  ];

  function stats(g) {
    var u = g.map(function (p) { return p.pricePerUnit; });
    return { count: g.length, avg: mean(u), med: median(u), max: maxOf(u), min: minOf(u) };
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function keyOf(dp, interval) {
    if (interval === 'quarter') {
      var q = Math.floor((parseInt(dp.slice(5, 7), 10) - 1) / 3) + 1;
      return dp.slice(0, 4) + '-Q' + q;
    }
    return dp.slice(0, 7);
  }

  function prevOf(key, interval) {
    var y = parseInt(key.slice(0, 4), 10) - 1;
    return y + key.slice(4);
  }

  function buckets(list, interval) {
    var by = {};
    list.forEach(function (p) {
      var dp = p.datePublished;
      if (!dp) return;
      var k = keyOf(dp, interval);
      (by[k] = by[k] || []).push(p);
    });
    return by;
  }

  function bucketLabel(k, interval) {
    if (interval === 'quarter') return k.slice(5) + ' ' + k.slice(0, 4);
    return monthLabel(k);
  }

  function iterateBuckets(start, end, interval, fn) {
    var sd = new Date(start + 'T00:00:00');
    var ed = new Date(end + 'T00:00:00');
    if (interval === 'month') {
      var cur = new Date(sd.getFullYear(), sd.getMonth(), 1);
      var last = new Date(ed.getFullYear(), ed.getMonth(), 1);
      for (; cur <= last; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)) {
        fn(cur.getFullYear() + '-' + pad2(cur.getMonth() + 1));
      }
      return;
    }
    var yr = sd.getFullYear();
    var m0 = Math.floor(sd.getMonth() / 3) * 3;
    var lastY = ed.getFullYear();
    var lastM = Math.floor(ed.getMonth() / 3) * 3;
    for (;;) {
      fn(yr + '-Q' + (m0 / 3 + 1));
      m0 += 3;
      if (m0 >= 12) { m0 = 0; yr += 1; }
      if (yr > lastY || (yr === lastY && m0 > lastM)) break;
    }
  }

  function deltaHtml(cur, prev) {
    if (cur == null || prev == null || prev === 0 || cur === 0) return ' <span class="delta flat">—</span>';
    var pct = (cur - prev) / prev * 100;
    var v = Math.round(pct);
    if (Math.abs(v) < 1) return ' <span class="delta flat">—</span>';
    return v > 0
      ? ' <span class="delta up">▲ ' + v + '%</span>'
      : ' <span class="delta down">▼ ' + Math.abs(v) + '%</span>';
  }

  function numCell(val, pval) {
    return '<td class="num">' + fmtRub(val) + (val == null ? '' : deltaHtml(val, pval)) + '</td>';
  }

  function countCell(c, pc) {
    return '<td class="num">' + c + deltaHtml(c, pc) + '</td>';
  }

  function rowsHtml(curBuckets, prevBuckets, start, end, interval, withDeltas) {
    var out = [];
    iterateBuckets(start, end, interval, function (k) {
      var s = stats(curBuckets[k] || []);
      var p = (withDeltas && prevBuckets) ? stats(prevBuckets[prevOf(k, interval)] || []) : null;
      out.push('<tr><td>' + bucketLabel(k, interval) + '</td>' +
        countCell(s.count, p && p.count ? p.count : null) +
        numCell(s.avg, p ? p.avg : null) +
        numCell(s.med, p ? p.med : null) +
        numCell(s.max, p ? p.max : null) +
        numCell(s.min, p ? p.min : null) +
        '</tr>');
    });
    return out.join('');
  }

  function segmentStats(list) {
    var out = {};
    SEGMENTS.forEach(function (s) { out[s.key] = stats(list.filter(s.test)); });
    return out;
  }

  function segRowsHtml(list, prevList, withDeltas) {
    var cs = segmentStats(list);
    var ps = prevList ? segmentStats(prevList) : null;
    return SEGMENTS.map(function (s) {
      var pst = ps ? ps[s.key] : null;
      var cst = cs[s.key];
      var pc = withDeltas && pst ? (pst.count ? pst.count : null) : null;
      var pa = withDeltas && pst ? pst.avg : null;
      var pm = withDeltas && pst ? pst.med : null;
      var px = withDeltas && pst ? pst.max : null;
      var pn = withDeltas && pst ? pst.min : null;
      return '<tr><td>' + s.label + '</td>' +
        countCell(cst.count, pc) +
        numCell(cst.avg, pa) +
        numCell(cst.med, pm) +
        numCell(cst.max, px) +
        numCell(cst.min, pn) +
        '</tr>';
    }).join('');
  }

  function fillRegion() {
    var regions = uniqueSorted(LAND_PLOTS.map(function (p) { return p.region; }));
    var cur = fRegion.value;
    fRegion.innerHTML = regions.map(function (r) {
      return '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>';
    }).join('');
    if (cur && regions.indexOf(cur) !== -1) fRegion.value = cur;
    else if (regions.length) fRegion.value = regions[0];
  }

  function shiftIso(iso) {
    return (parseInt(iso.slice(0, 4), 10) - 1) + iso.slice(4);
  }

  function setDefaults() {
    var dates = LAND_PLOTS.map(function (p) { return p.datePublished; }).sort();
    if (!dates.length) return;
    var last = dates[dates.length - 1];
    fEnd.value = last;
    fStart.value = last.slice(0, 4) + '-01-01';
  }

  var presets = [];
  function buildPresets() {
    var years = [];
    LAND_PLOTS.forEach(function (p) {
      if (p.datePublished) {
        var y = p.datePublished.slice(0, 4);
        if (years.indexOf(y) === -1) years.push(y);
      }
    });
    years.sort();
    if (!years.length) return;
    var maxY = years[years.length - 1];
    var maxDate = LAND_PLOTS.map(function (p) { return p.datePublished; }).sort().pop();
    presets = [];
    presets.push({
      label: 'Текущий год',
      apply: function () { fStart.value = maxY + '-01-01'; fEnd.value = maxDate; }
    });
    presets.push({
      label: 'Последние 12 мес.',
      apply: function () { fStart.value = shiftIso(maxDate.slice(0, 7) + '-01'); fEnd.value = maxDate; }
    });
    var prevY = parseInt(maxY, 10) - 1;
    if (years.indexOf(String(prevY)) !== -1) {
      presets.push({
        label: 'Прошлый год',
        apply: function () { fStart.value = prevY + '-01-01'; fEnd.value = prevY + '-12-31'; }
      });
    }
    years.forEach(function (y) {
      presets.push({
        label: y,
        apply: function () { fStart.value = y + '-01-01'; fEnd.value = (y === maxY) ? maxDate : y + '-12-31'; }
      });
    });
    var host = document.getElementById('presets');
    if (!host) return;
    host.innerHTML = presets.map(function (pr, i) {
      return '<button class="btn btn-ghost btn-sm preset" type="button" data-i="' + i + '">' + escapeHtml(pr.label) + '</button>';
    }).join('');
    host.querySelectorAll('.preset').forEach(function (b) {
      b.addEventListener('click', function () {
        presets[parseInt(b.getAttribute('data-i'), 10)].apply();
        refreshAll();
      });
    });
  }

  function readUrlParams() {
    var q = new URLSearchParams(location.search);
    return {
      start: q.get('start'),
      end: q.get('end'),
      interval: q.get('interval'),
      region: q.get('region')
    };
  }

  function applyUrlParams(urlp) {
    var dates = LAND_PLOTS.map(function (p) { return p.datePublished; }).filter(Boolean).sort();
    if (!dates.length) return false;
    var min = dates[0];
    var max = dates[dates.length - 1];
    var ok = false;
    if (urlp.start && /^\d{4}-\d{2}-\d{2}$/.test(urlp.start) && urlp.start >= min && urlp.start <= max) {
      fStart.value = urlp.start;
      ok = true;
    }
    if (urlp.end && /^\d{4}-\d{2}-\d{2}$/.test(urlp.end) && urlp.end >= min && urlp.end <= max) {
      fEnd.value = urlp.end;
      ok = true;
    }
    if (ok && fStart.value > fEnd.value) {
      fStart.value = min;
      fEnd.value = max;
    }
    if (urlp.interval === 'month' || urlp.interval === 'quarter') {
      fInterval.value = urlp.interval;
      ok = true;
    }
    if (urlp.region) {
      var vals = [].map.call(fRegion.options, function (o) { return o.value; });
      if (vals.indexOf(urlp.region) !== -1) {
        fRegion.value = urlp.region;
        ok = true;
      }
    }
    return ok;
  }

  function updateUrl() {
    var p = new URLSearchParams();
    p.set('start', fStart.value);
    p.set('end', fEnd.value);
    p.set('interval', fInterval.value);
    if (fRegion.value) p.set('region', fRegion.value);
    var qs = p.toString();
    if (location.pathname + (qs ? '?' + qs : '') === location.pathname + location.search) return;
    try { history.replaceState(null, '', location.pathname + '?' + qs); } catch (e) { }
  }

  function toTicks(v) {
    if (v == null) return '';
    if (v >= 1000000) return (Math.round(v / 100000) / 10) + ' млн';
    if (v >= 1000) return (Math.round(v / 100) / 10) + ' тыс';
    return String(Math.round(v));
  }

  var chart = null;
  var chartRaw = null;
  var chartMetric = 'avg';

  function renderChart() {
    var host = document.getElementById('period-chart');
    if (!host || !window.Chart || !chartRaw) return;
    if (chart) { chart.destroy(); chart = null; }
    if (!host.querySelector('canvas')) host.innerHTML = '<canvas></canvas>';
    var isMed = chartMetric === 'med';
    chart = new Chart(host.querySelector('canvas'), {
      type: 'line',
      data: {
        labels: chartRaw.labels,
        datasets: [
          { label: 'Год назад', data: chartRaw.prev[chartMetric], borderColor: '#9aa5a0', backgroundColor: '#9aa5a0', borderDash: [6, 4], pointRadius: 3, tension: 0.25 },
          { label: 'Выбранный период', data: chartRaw.cur[chartMetric], borderColor: isMed ? '#37733a' : '#b7791f', backgroundColor: isMed ? '#37733a' : '#b7791f', pointRadius: 4, borderWidth: 2, tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#22252a', boxWidth: 14, boxHeight: 14, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ' · ' + (isMed ? 'медиана' : 'средняя цена') + ': ' + fmtRub(ctx.parsed.y);
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#5a6167' }, grid: { color: '#eceff0' } },
          y: { ticks: { color: '#5a6167', callback: toTicks }, grid: { color: '#eceff0' } }
        }
      }
    });
  }

  function renderChartMetric() {
    var btns = document.querySelectorAll('#chart-metric .btn');
    btns.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-metric') === chartMetric); });
    renderChart();
  }

  document.querySelectorAll('#chart-metric .btn').forEach(function (b) {
    b.addEventListener('click', function () {
      chartMetric = b.getAttribute('data-metric');
      renderChartMetric();
    });
  });

  function refreshAll() {
    fillRegion();
    setText('total-count', LAND_PLOTS.length);

    if (!fStart.value || !fEnd.value) {
      errBox.textContent = 'Укажите начало и конец периода.';
      return;
    }
    if (fStart.value > fEnd.value) {
      errBox.textContent = 'Начало периода не может быть позже конца.';
      return;
    }
    errBox.textContent = '';

    var region = fRegion.value;
    var interval = fInterval.value;
    var start = fStart.value;
    var end = fEnd.value;

    document.getElementById('period-col').textContent = interval === 'quarter' ? 'Квартал' : 'Месяц';

    var list = LAND_PLOTS.filter(function (p) {
      return (!region || p.region === region) && p.datePublished >= start && p.datePublished <= end;
    });

    var pStart = shiftIso(start);
    var pEnd = shiftIso(end);
    var prevList = LAND_PLOTS.filter(function (p) {
      return (!region || p.region === region) && p.datePublished >= pStart && p.datePublished <= pEnd;
    });

    var curBuckets = buckets(list, interval);
    var prevBuckets = buckets(prevList, interval);

    setText('report-note', fmtDate(start) + ' — ' + fmtDate(end) + ' · Найдено: ' + list.length);
    setText('prev-note', fmtDate(pStart) + ' — ' + fmtDate(pEnd) + ' · Найдено: ' + prevList.length);

    document.getElementById('report-body').innerHTML =
      rowsHtml(curBuckets, prevBuckets, start, end, interval, true);
    document.getElementById('prev-body').innerHTML =
      rowsHtml(prevBuckets, null, pStart, pEnd, interval, false);

    document.getElementById('segs-body').innerHTML = segRowsHtml(list, prevList, true);
    document.getElementById('prev-segs').innerHTML = segRowsHtml(prevList, null, false);

    chartRaw = { labels: [], cur: { avg: [], med: [] }, prev: { avg: [], med: [] } };
    iterateBuckets(start, end, interval, function (k) {
      var c = stats(curBuckets[k] || []);
      var p = stats(prevBuckets[prevOf(k, interval)] || []);
      chartRaw.labels.push(bucketLabel(k, interval));
      chartRaw.cur.avg.push(c.avg);
      chartRaw.cur.med.push(c.med);
      chartRaw.prev.avg.push(p.avg);
      chartRaw.prev.med.push(p.med);
    });
    renderChart();
    updateUrl();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    refreshAll();
  });

  fRegion.addEventListener('change', refreshAll);
  fInterval.addEventListener('change', refreshAll);

  setDefaults();
  fillRegion();
  if (!applyUrlParams(readUrlParams())) setDefaults();
  buildPresets();
  refreshAll();
  window.refreshSiteData = refreshAll;
})();