function fmtRub(n) {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('ru-RU');
}

function fmtArea(n) {
  if (n == null) return '—';
  var v = Math.round(n * 100) / 100;
  if (v % 1 === 0) return String(v);
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function median(arr) {
  if (!arr.length) return null;
  var s = arr.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
}

function minOf(arr) {
  if (!arr.length) return null;
  return Math.min.apply(null, arr);
}

function maxOf(arr) {
  if (!arr.length) return null;
  return Math.max.apply(null, arr);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function amenitiesOf(p) {
  var a = [];
  if (p.hasGas) a.push('газ');
  if (p.hasElectricity) a.push('свет');
  if (p.hasWater) a.push('вода');
  if (p.hasHouse) a.push('дом');
  return a;
}

function sourceName(src) {
  if (src === 'avito') return 'Авито';
  if (src === 'cian') return 'Циан';
  return src;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function listingHtml(p) {
  var meta = [fmtArea(p.area) + ' соток', p.vri].concat(amenitiesOf(p));
  var chips = meta.map(function (t) {
    return '<span class="chip">' + escapeHtml(t) + '</span>';
  }).join('');
  return '' +
    '<article class="listing">' +
      '<div class="listing-head">' +
        '<div class="listing-title">' + escapeHtml(p.address) + '</div>' +
        '<div class="listing-date">' + escapeHtml(sourceName(p.source)) + ' · ' + fmtDate(p.datePublished) + '</div>' +
      '</div>' +
      '<div class="listing-meta">' + chips + '</div>' +
      '<div class="listing-desc">' + escapeHtml(p.description) + '</div>' +
      '<div class="listing-foot">' +
        '<div class="listing-price">' + fmtRub(p.price) + ' ₽<span class="listing-per-unit">' + fmtRub(p.pricePerUnit) + ' ₽/сотка</span></div>' +
        '<a class="btn btn-primary btn-sm" href="' + escapeHtml(p.sourceUrl) + '" target="_blank" rel="noopener">Открыть на ' + escapeHtml(sourceName(p.source)) + '</a>' +
      '</div>' +
    '</article>';
}

function quarterLabel(iso) {
  var d = new Date(iso);
  return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + d.getFullYear();
}

function monthLabel(ym) {
  return new Date(ym + '-01').toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric'
  });
}

function declension(n, one, few, many) {
  var m10 = n % 10;
  var m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function uniqueSorted(arr) {
  var seen = {};
  var out = [];
  arr.forEach(function (v) {
    if (!seen[v]) {
      seen[v] = true;
      out.push(v);
    }
  });
  return out.sort(function (a, b) {
    return a.localeCompare(b, 'ru');
  });
}

function setText(id, txt) {
  var el = document.getElementById(id);
  if (el) el.textContent = txt;
}