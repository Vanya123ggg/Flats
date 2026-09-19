(function () {
  var plots = [];

  var sel = document.getElementById('object-sel');
  var detail = document.getElementById('obj-detail');
  var compare = document.getElementById('compare');
  var rank = document.getElementById('rank');

  function loadData() {
    plots = LAND_PLOTS.slice().sort(function (a, b) {
      return b.datePublished.localeCompare(a.datePublished);
    });
  }

  function buildOptions(preserveId) {
    sel.innerHTML = plots.map(function (p) {
      return '<option value="' + p.id + '">' + escapeHtml(p.address + ' — ' + fmtRub(p.price) + ' ₽, ' + fmtArea(p.area) + ' сот.') + '</option>';
    }).join('');
    if (plots.length) {
      var keep = preserveId != null ? String(preserveId) : '';
      sel.value = keep && sel.querySelector('option[value="' + keep + '"]') ? keep : sel.options[0].value;
    }
  }

  function deltaHtml(med, p) {
    if (med == null) return '<span class="delta-flat">нет данных</span>';
    var diff = p.pricePerUnit - med;
    if (Math.abs(diff) < 1) return '<span class="delta-flat">в норме (0%)</span>';
    var pct = (diff / med * 100);
    var sign = diff > 0 ? '+' : '−';
    var cls = diff > 0 ? 'delta-up' : 'delta-down';
    var label = diff > 0 ? 'дороже' : 'дешевле';
    return '<span class="' + cls + '">' + label + ' на ' + fmtRub(Math.abs(pct)) + '%</span>';
  }

  function compareRow(label, vals, p, count) {
    var med = median(vals);
    return '<div class="compare-row">' +
      '<span>' + escapeHtml(label) + '</span>' +
      '<span class="compare-count">(' + count + ' об.)</span>' +
      '<span class="compare-value">' + fmtRub(med) + ' ₽/сотка ' + deltaHtml(med, p) + '</span>' +
      '</div>';
  }

  function render() {
    var id = parseInt(sel.value, 10);
    var p = plots.filter(function (x) { return x.id === id; })[0];
    if (!p) return;

    detail.innerHTML =
      '<div class="obj-line"><span class="obj-label">Адрес</span><span class="obj-value">' + escapeHtml(p.address) + '</span></div>' +
      '<div class="obj-line"><span class="obj-label">Общая цена</span><span class="obj-value">' + fmtRub(p.price) + ' ₽</span></div>' +
      '<div class="obj-line"><span class="obj-label">Цена за сотку</span><span class="obj-value">' + fmtRub(p.pricePerUnit) + ' ₽</span></div>' +
      '<div class="obj-line"><span class="obj-label">Площадь</span><span class="obj-value">' + fmtArea(p.area) + ' соток</span></div>' +
      '<div class="obj-line"><span class="obj-label">ВРИ</span><span class="obj-value">' + escapeHtml(p.vri) + '</span></div>' +
      '<div class="obj-line"><span class="obj-label">Район</span><span class="obj-value">' + escapeHtml(p.district) + '</span></div>' +
      '<div class="obj-line"><span class="obj-label">Опубликовано</span><span class="obj-value">' + escapeHtml(sourceName(p.source)) + ', ' + fmtDate(p.datePublished) + '</span></div>' +
      '<div style="margin-top:12px;"><a class="btn btn-primary btn-sm" href="' + escapeHtml(p.sourceUrl) + '" target="_blank" rel="noopener">Открыть на ' + escapeHtml(sourceName(p.source)) + '</a></div>';

    var market = plots.map(function (x) { return x.pricePerUnit; });
    var districtVals = plots.filter(function (x) { return x.district === p.district; }).map(function (x) { return x.pricePerUnit; });
    var localityVals = plots.filter(function (x) { return x.locality === p.locality; }).map(function (x) { return x.pricePerUnit; });
    var categoryVals = plots.filter(function (x) { return x.categoryLand === p.categoryLand; }).map(function (x) { return x.pricePerUnit; });
    var vriVals = plots.filter(function (x) { return x.vri === p.vri; }).map(function (x) { return x.pricePerUnit; });

    compare.innerHTML =
      compareRow('Весь рынок земли', market, p, market.length) +
      compareRow('Район: ' + p.district, districtVals, p, districtVals.length) +
      compareRow('Локация: ' + p.locality, localityVals, p, localityVals.length) +
      compareRow('Категория: ' + p.categoryLand, categoryVals, p, categoryVals.length) +
      compareRow('ВРИ: ' + p.vri, vriVals, p, vriVals.length);

    var sorted = districtVals.slice().sort(function (a, b) { return a - b; });
    var less = sorted.filter(function (v) { return v < p.pricePerUnit; }).length;
    var total = sorted.length;
    rank.innerHTML = total > 1 ?
      '<div class="obj-line"><span class="obj-label">Место в районе по цене/сотка</span><span class="obj-value">' + less + ' из ' + total + ' дешевле</span></div>' : '';
  }

  function refreshAll() {
    var keep = parseInt(sel.value, 10);
    loadData();
    buildOptions(isNaN(keep) ? null : keep);
    render();
  }

  sel.addEventListener('change', render);
  refreshAll();
  window.refreshSiteData = refreshAll;
})();