(function () {
  var plots = [];

  var form = document.getElementById('filter-form');
  var districtSel = document.getElementById('f-district');
  var categorySel = document.getElementById('f-category');
  var vriSel = document.getElementById('f-vri');
  var areaFrom = document.getElementById('f-area-from');
  var areaTo = document.getElementById('f-area-to');
  var priceFrom = document.getElementById('f-price-from');
  var priceTo = document.getElementById('f-price-to');

  function loadData() {
    plots = LAND_PLOTS.slice().sort(function (a, b) {
      return b.datePublished.localeCompare(a.datePublished);
    });
  }

  function fillSelect(sel, values) {
    while (sel.options.length > 1) sel.remove(sel.options.length - 1);
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }

  function parseNum(s) {
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function getFilters() {
    return {
      district: districtSel.value,
      category: categorySel.value,
      vri: vriSel.value,
      areaFrom: parseNum(areaFrom.value),
      areaTo: parseNum(areaTo.value),
      priceFrom: parseNum(priceFrom.value),
      priceTo: parseNum(priceTo.value)
    };
  }

  function matches(p, f) {
    if (f.district && p.district !== f.district) return false;
    if (f.category && p.categoryLand !== f.category) return false;
    if (f.vri && p.vri !== f.vri) return false;
    if (f.areaFrom != null && p.area < f.areaFrom) return false;
    if (f.areaTo != null && p.area > f.areaTo) return false;
    if (f.priceFrom != null && p.price < f.priceFrom) return false;
    if (f.priceTo != null && p.price > f.priceTo) return false;
    return true;
  }

  function renderListings(list) {
    var box = document.getElementById('listings');
    var note = document.getElementById('list-note');

    if (!list.length) {
      box.innerHTML = '<div class="empty">Ничего не найдено. Измените параметры фильтра.</div>';
      note.textContent = '';
      return;
    }

    note.textContent = 'Отсортированы по дате публикации, новые сверху.';

    box.innerHTML = list.map(listingHtml).join('');
  }

  function renderMetrics(list) {
    var units = list.map(function (p) { return p.pricePerUnit; });
    var segments = [
      { min: null, max: 30, ids: ['seg1-min', 'seg1-max', 'seg1-avg', 'seg1-med', 'seg1-count'] },
      { min: 30, max: 50, ids: ['seg2-min', 'seg2-max', 'seg2-avg', 'seg2-med', 'seg2-count'] },
      { min: 50, max: null, ids: ['seg3-min', 'seg3-max', 'seg3-avg', 'seg3-med', 'seg3-count'] }
    ];

    setText('met-count', list.length);
    setText('met-total', list.length);
    setText('met-count-word', declension(list.length, 'объявление', 'объявления', 'объявлений'));
    setText('met-min', fmtRub(minOf(units)));
    setText('met-max', fmtRub(maxOf(units)));
    setText('met-avg', fmtRub(mean(units)));
    setText('met-med', fmtRub(median(units)));

    segments.forEach(function (s) {
      var seg = list.filter(function (p) {
        return (s.min == null || p.area > s.min) && (s.max == null || p.area <= s.max);
      });
      var su = seg.map(function (p) { return p.pricePerUnit; });
      setText(s.ids[0], fmtRub(minOf(su)));
      setText(s.ids[1], fmtRub(maxOf(su)));
      setText(s.ids[2], fmtRub(mean(su)));
      setText(s.ids[3], fmtRub(median(su)));
      setText(s.ids[4], seg.length);
    });
  }

  function applyFilters() {
    var f = getFilters();
    var list = plots.filter(function (p) { return matches(p, f); });
    renderMetrics(list);
    renderListings(list);
  }

  function refreshAll() {
    var cur = getFilters();
    loadData();
    fillSelect(districtSel, uniqueSorted(plots.map(function (p) { return p.district; })));
    fillSelect(categorySel, uniqueSorted(plots.map(function (p) { return p.categoryLand; })));
    fillSelect(vriSel, uniqueSorted(plots.map(function (p) { return p.vri; })));
    districtSel.value = cur.district;
    categorySel.value = cur.category;
    vriSel.value = cur.vri;
    setText('total-count', plots.length);
    applyFilters();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    applyFilters();
  });

  form.addEventListener('reset', function () {
    applyFilters();
  });

  refreshAll();
  window.refreshSiteData = refreshAll;
})();