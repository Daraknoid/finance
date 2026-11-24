'use strict';
/* ---------- Аналитика: графики за несколько месяцев и советы ----------
   Использует глобальные state, catOf, fmt, esc, pad, round2, plural, MONTHS, viewY, viewM, open/close из app.js. */

const SHORT_M = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
let statsN = 6;

const fmtAxis = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (Math.round(v / 1e5) / 10).toLocaleString('ru-RU') + ' млн';
  if (a >= 1000) return (Math.round(v / 100) / 10).toLocaleString('ru-RU') + ' тыс';
  return Math.round(v).toLocaleString('ru-RU');
};
const pct = (v) => Math.round(v * 100) + '%';
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

/* ---------- Данные ---------- */
function monthsBack(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(viewY, viewM - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    out.push({ y, m, key: `${y}-${pad(m + 1)}` });
  }
  return out;
}
function aggregate(months) {
  const idx = new Map(months.map((mo, i) => [mo.key, i]));
  const rows = months.map((mo) => ({ ...mo, inc: 0, exp: 0, count: 0, cats: {}, small: 0, smallSum: 0, endBalance: 0 }));
  for (const t of state.tx) {
    const i = idx.get(t.date.slice(0, 7));
    if (i === undefined) continue;
    const r = rows[i];
    r.count++;
    if (t.type === 'income') r.inc += t.amount;
    else {
      r.exp += t.amount;
      const id = catOf('expense', t.cat).id;
      r.cats[id] = (r.cats[id] || 0) + t.amount;
      if (t.amount < 10) { r.small++; r.smallSum += t.amount; }
    }
  }
  for (const r of rows) {
    r.endBalance = state.tx.reduce((s, t) => (t.date.slice(0, 7) <= r.key ? s + (t.type === 'income' ? t.amount : -t.amount) : s), 0);
  }
  return rows;
}
// Накопленные расходы по дням месяца: cum[d] — потрачено с 1-го по d-е число включительно.
function dailyCum(y, m) {
  const key = `${y}-${pad(m + 1)}`, dim = daysIn(y, m);
  const per = new Array(dim + 1).fill(0);
  for (const t of state.tx) if (t.type === 'expense' && t.date.startsWith(key)) per[+t.date.slice(8, 10)] += t.amount;
  for (let d = 1; d <= dim; d++) per[d] += per[d - 1];
  return per;
}

// Средний накопленный расход по дням для 3 предыдущих месяцев, в которых были расходы.
function avgCumPrev(y, m) {
  const dim = daysIn(y, m), prevs = [];
  for (let k = 1; k <= 12 && prevs.length < 3; k++) {
    const d = new Date(y, m - k, 1);
    const c = dailyCum(d.getFullYear(), d.getMonth());
    if (c[c.length - 1] > 0) prevs.push(c);
  }
  const avg = prevs.length ? Array.from({ length: dim + 1 }, (_, d) => prevs.reduce((s, c) => s + c[Math.min(d, c.length - 1)], 0) / prevs.length) : null;
  return { avg, count: prevs.length };
}
// Прогноз расходов на месяц: уже потрачено + сколько обычно тратится после этого дня.
// Так разовые платежи (квартплата 10-го) не раздуваются линейным пересчётом.
function projectMonth(y, m, spent, day) {
  const dim = daysIn(y, m);
  const { avg } = avgCumPrev(y, m);
  if (avg) return spent + Math.max(0, avg[dim] - avg[day]);
  return spent * dim / day;
}

/* ---------- Геометрия ---------- */
function niceScale(min, max, count = 4) {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw - 1e-9);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(round2(v));
  return { lo, hi, ticks };
}
function box(el, h = 180) {
  const w = Math.max(260, Math.round(el.clientWidth || 320));
  return { w, h, pad: { l: 46, r: 10, t: 12, b: 24 } };
}
function frame(b, sc) {
  const { w, h, pad } = b;
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  let s = '';
  for (const v of sc.ticks) {
    const yy = y(v).toFixed(1);
    s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${yy}" y2="${yy}" class="${v === 0 ? 'v-axis' : 'v-grid'}"/>`
      + `<text x="${pad.l - 6}" y="${yy}" dy=".32em" class="v-tick" text-anchor="end">${fmtAxis(v)}</text>`;
  }
  return { s, y };
}
// Столбик со скруглением 4px только на конце с данными; основание остаётся прямым.
function bar(x, y0, y1, w, attrs) {
  const h = Math.abs(y0 - y1);
  if (h < 0.5) return '';
  const r = Math.min(4, w / 2, h);
  const top = Math.min(y0, y1), bot = Math.max(y0, y1);
  const d = y1 <= y0
    ? `M${x},${bot}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bot}Z`
    : `M${x},${top}V${bot - r}Q${x},${bot} ${x + r},${bot}H${x + w - r}Q${x + w},${bot} ${x + w},${bot - r}V${top}Z`;
  return `<path d="${d}" ${attrs}/>`;
}
function xMonthLabels(rows, b, band) {
  const n = rows.length;
  return rows.map((r, i) => {
    if (n > 6 && (n - 1 - i) % 2) return '';
    const label = SHORT_M[r.m] + (r.m === 0 && i > 0 ? ` ’${String(r.y).slice(2)}` : '');
    return `<text x="${(b.pad.l + band * (i + 0.5)).toFixed(1)}" y="${b.h - 6}" class="v-tick" text-anchor="middle">${label}</text>`;
  }).join('');
}
const legend = (items) => `<div class="v-legend">${items.map((it) =>
  `<span><i class="${it.line ? 'ln' : 'sq'}${it.dash ? ' dash' : ''}" style="--c:${esc(it.c)}"></i>${esc(it.name)}</span>`).join('')}</div>`;

/* Подсказка при наведении / касании: общий механизм для всех графиков. */
function mountChart(el, ch) {
  el.innerHTML = `<div class="viz">
    <svg viewBox="0 0 ${ch.w} ${ch.h}" height="${ch.h}" role="img" aria-label="${esc(ch.label)}">
      <g class="hl-u"></g>${ch.svg}<g class="hl-o"></g>
      <rect x="${ch.pad.l}" y="0" width="${ch.w - ch.pad.l - ch.pad.r}" height="${ch.h}" fill="transparent"/>
    </svg><div class="viz-tip" hidden></div></div>${ch.after || ''}`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.viz-tip');
  const hu = el.querySelector('.hl-u'), ho = el.querySelector('.hl-o');
  let cur = -1;
  const hide = () => { cur = -1; hu.innerHTML = ho.innerHTML = ''; tip.hidden = true; };
  const show = (e) => {
    const rc = svg.getBoundingClientRect();
    const i = ch.indexAt((e.clientX - rc.left) * ch.w / rc.width);
    if (i < 0) { hide(); return; }
    if (i !== cur) {
      cur = i;
      const h = ch.hl(i); hu.innerHTML = h.u || ''; ho.innerHTML = h.o || '';
      tip.innerHTML = ch.tip(i);
    }
    tip.hidden = false;
    const px = ch.anchorX(i) * rc.width / ch.w, tw = tip.offsetWidth;
    let left = px + 14;
    if (left + tw > rc.width) left = px - 14 - tw;
    tip.style.left = Math.max(0, left) + 'px';
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  el._hide = hide;
}
const bandIndex = (b, n) => (x) => {
  const i = Math.floor((x - b.pad.l) / ((b.w - b.pad.l - b.pad.r) / n));
  return i >= 0 && i < n ? i : -1;
};
const tipRow = (c, name, val, line) => `<div class="t-row"><i class="${line ? 'ln' : 'sq'}" style="--c:${esc(c)}"></i><span>${esc(name)}</span><b>${val}</b></div>`;
const monthTitle = (r) => `${MONTHS[r.m]} ${r.y}`;

/* ---------- Графики ---------- */
function chartIncExp(el, rows) {
  const b = box(el), n = rows.length;
  const sc = niceScale(0, Math.max(0, ...rows.map((r) => Math.max(r.inc, r.exp))));
  const f = frame(b, sc);
  const band = (b.w - b.pad.l - b.pad.r) / n;
  const bw = Math.max(3, Math.min(14, (band - 10) / 2));
  let s = f.s;
  rows.forEach((r, i) => {
    const cx = b.pad.l + band * (i + 0.5);
    s += bar(cx - bw - 1, f.y(0), f.y(r.inc), bw, 'class="m-inc"') + bar(cx + 1, f.y(0), f.y(r.exp), bw, 'class="m-exp"');
  });
  s += xMonthLabels(rows, b, band);
  const table = `<details class="v-table"><summary>Таблица по месяцам</summary><table>
    <tr><th>Месяц</th><th>Доходы</th><th>Расходы</th><th>Остаток</th></tr>
    ${rows.map((r) => `<tr><td>${SHORT_M[r.m]} ${r.y}</td><td>${fmt(r.inc)}</td><td>${fmt(r.exp)}</td><td>${(r.inc - r.exp > 0 ? '+' : '') + fmt(r.inc - r.exp)}</td></tr>`).join('')}
  </table></details>`;
  mountChart(el, {
    ...b, svg: s, label: 'Доходы и расходы по месяцам',
    after: legend([{ c: 'var(--inc)', name: 'Доходы' }, { c: 'var(--exp)', name: 'Расходы' }]) + table,
    indexAt: bandIndex(b, n), anchorX: (i) => b.pad.l + band * (i + 0.5),
    hl: (i) => ({ u: `<rect x="${b.pad.l + band * i + 1}" y="${b.pad.t}" width="${band - 2}" height="${b.h - b.pad.t - b.pad.b}" rx="6" class="hover-band"/>` }),
    tip: (i) => {
      const r = rows[i], net = r.inc - r.exp;
      return `<div class="t-head">${monthTitle(r)}</div>` + tipRow('var(--inc)', 'Доходы', fmt(r.inc)) + tipRow('var(--exp)', 'Расходы', fmt(r.exp))
        + `<div class="t-foot">Остаток ${(net > 0 ? '+' : '') + fmt(net)}${r.inc > 0 ? ` · ${pct(net / r.inc)} дохода` : ''}</div>`;
    },
  });
}

function chartCats(el, rows) {
  const totals = {};
  for (const r of rows) for (const [id, v] of Object.entries(r.cats)) totals[id] = (totals[id] || 0) + v;
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const top = sorted.slice(0, 5), restIds = new Set(sorted.slice(5));
  const series = top.map((id) => { const c = catOf('expense', id); return { id, name: c.name, e: c.e, c: c.c }; });
  if (restIds.size) series.push({ id: '_rest', name: 'Остальное', e: '…', c: '#8e8e93' });
  const val = (r, sr) => (sr.id === '_rest' ? [...restIds].reduce((s, id) => s + (r.cats[id] || 0), 0) : r.cats[sr.id] || 0);

  const b = box(el, 190), n = rows.length;
  const sc = niceScale(0, Math.max(0, ...rows.map((r) => r.exp)));
  const f = frame(b, sc);
  const band = (b.w - b.pad.l - b.pad.r) / n;
  const bw = Math.max(6, Math.min(26, band - 10));
  let s = f.s;
  rows.forEach((r, i) => {
    const x = b.pad.l + band * (i + 0.5) - bw / 2;
    const segs = series.map((sr) => ({ sr, v: val(r, sr) })).filter((g) => g.v > 0);
    let acc = 0;
    segs.forEach((g, k) => {
      let yb = f.y(acc); const yt = f.y(acc + g.v);
      if (k > 0) yb -= 2; // 2px зазор между сегментами
      acc += g.v;
      if (yb - yt < 0.5) return;
      const attrs = `fill="${esc(g.sr.c)}"`;
      s += k === segs.length - 1 ? bar(x, yb, yt, bw, attrs) : `<rect x="${x}" y="${yt.toFixed(1)}" width="${bw}" height="${(yb - yt).toFixed(1)}" ${attrs}/>`;
    });
  });
  s += xMonthLabels(rows, b, band);
  mountChart(el, {
    ...b, svg: s, label: 'Расходы по категориям по месяцам',
    after: legend(series.map((sr) => ({ c: sr.c, name: `${sr.e} ${sr.name}` }))),
    indexAt: bandIndex(b, n), anchorX: (i) => b.pad.l + band * (i + 0.5),
    hl: (i) => ({ u: `<rect x="${b.pad.l + band * i + 1}" y="${b.pad.t}" width="${band - 2}" height="${b.h - b.pad.t - b.pad.b}" rx="6" class="hover-band"/>` }),
    tip: (i) => {
      const r = rows[i];
      const items = series.map((sr) => ({ sr, v: val(r, sr) })).filter((g) => g.v > 0).reverse();
      return `<div class="t-head">${monthTitle(r)}</div>`
        + (items.length ? items.map((g) => tipRow(g.sr.c, `${g.sr.e} ${g.sr.name}`, fmt(g.v))).join('') : '<div class="t-foot">Нет расходов</div>')
        + (items.length ? `<div class="t-foot">Всего ${fmt(r.exp)}</div>` : '');
    },
  });
}

function chartBalance(el, rows) {
  const todayKey = isoToday().slice(0, 7);
  const pts = rows.filter((r) => r.key <= todayKey);
  if (pts.length < 2) { el.innerHTML = '<p class="hint center">Нужно хотя бы 2 месяца</p>'; return; }
  const b = box(el, 160), n = rows.length;
  const vals = pts.map((r) => r.endBalance);
  const sc = niceScale(Math.min(0, ...vals), Math.max(0, ...vals));
  const f = frame(b, sc);
  const band = (b.w - b.pad.l - b.pad.r) / n;
  const X = (i) => b.pad.l + band * (i + 0.5);
  const d = pts.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${f.y(r.endBalance).toFixed(1)}`).join('');
  const area = `${d}L${X(pts.length - 1).toFixed(1)},${f.y(Math.max(sc.lo, 0)).toFixed(1)}L${X(0).toFixed(1)},${f.y(Math.max(sc.lo, 0)).toFixed(1)}Z`;
  const last = pts.length - 1;
  let s = f.s + `<path d="${area}" class="v-area"/><path d="${d}" class="v-line"/>`
    + `<circle cx="${X(last)}" cy="${f.y(pts[last].endBalance)}" r="4" class="v-dot"/>`;
  s += xMonthLabels(rows, b, band);
  mountChart(el, {
    ...b, svg: s, label: 'Остаток на счету на конец месяца',
    indexAt: (x) => { const i = bandIndex(b, n)(x); return i > last ? last : i; },
    anchorX: X,
    hl: (i) => ({ o: `<line x1="${X(i)}" x2="${X(i)}" y1="${b.pad.t}" y2="${b.h - b.pad.b}" class="v-cross"/><circle cx="${X(i)}" cy="${f.y(pts[i].endBalance)}" r="4.5" class="v-dot"/>` }),
    tip: (i) => {
      const r = pts[i], prev = i ? pts[i - 1].endBalance : r.endBalance - (r.inc - r.exp);
      const diff = r.endBalance - prev;
      return `<div class="t-head">${r.key === todayKey ? 'Сейчас' : `Конец ${MONTHS_GEN[r.m]}`}</div>`
        + tipRow('var(--accent)', 'На счету', fmt(r.endBalance), true)
        + `<div class="t-foot">За месяц ${(diff > 0 ? '+' : '') + fmt(diff)}</div>`;
    },
  });
}

function chartPace(el) {
  const todayIso = isoToday();
  const dim = daysIn(viewY, viewM), key = `${viewY}-${pad(viewM + 1)}`;
  if (key > todayIso.slice(0, 7)) { el.innerHTML = '<p class="hint center">Этот месяц ещё не начался</p>'; return null; }
  const lastDay = key === todayIso.slice(0, 7) ? +todayIso.slice(8, 10) : dim;
  const cur = dailyCum(viewY, viewM);
  const { avg, count: prevCount } = avgCumPrev(viewY, viewM);
  const budget = state.budget > 0 ? state.budget : 0;
  const maxV = Math.max(cur[lastDay], avg ? avg[dim] : 0, budget);
  if (!maxV) { el.innerHTML = '<p class="hint center">В этом месяце пока нет расходов</p>'; return null; }

  const b = box(el, 170);
  const sc = niceScale(0, maxV);
  const f = frame(b, sc);
  const X = (d) => b.pad.l + (b.w - b.pad.l - b.pad.r) * (d - 1) / (dim - 1);
  const path = (arr, upto) => { let p = ''; for (let d = 1; d <= upto; d++) p += `${d > 1 ? 'L' : 'M'}${X(d).toFixed(1)},${f.y(arr[d]).toFixed(1)}`; return p; };
  let s = f.s;
  if (budget) s += `<line x1="${b.pad.l}" x2="${b.w - b.pad.r}" y1="${f.y(budget)}" y2="${f.y(budget)}" class="v-budget"/><text x="${b.w - b.pad.r}" y="${f.y(budget) - 5}" class="v-tick" text-anchor="end">бюджет</text>`;
  if (avg) s += `<path d="${path(avg, dim)}" class="v-line avg"/>`;
  s += `<path d="${path(cur, lastDay)}" class="v-line exp"/><circle cx="${X(lastDay)}" cy="${f.y(cur[lastDay])}" r="4" class="v-dot exp"/>`;
  s += [1, 10, 20, dim].map((d) => `<text x="${X(d)}" y="${b.h - 6}" class="v-tick" text-anchor="middle">${d}</text>`).join('');
  const items = [{ c: 'var(--exp)', name: `${MONTHS[viewM]}`, line: true }];
  if (avg) items.push({ c: 'var(--muted)', name: `Обычно (среднее ${prevCount} мес.)`, line: true, dash: true });
  mountChart(el, {
    ...b, svg: s, label: 'Темп расходов по дням месяца', after: legend(items),
    indexAt: (x) => { if (x < b.pad.l - 4 || x > b.w - b.pad.r + 4) return -1; return Math.min(dim, Math.max(1, Math.round(1 + (x - b.pad.l) / (b.w - b.pad.l - b.pad.r) * (dim - 1)))); },
    anchorX: X,
    hl: (d) => ({ o: `<line x1="${X(d)}" x2="${X(d)}" y1="${b.pad.t}" y2="${b.h - b.pad.b}" class="v-cross"/>`
      + (avg ? `<circle cx="${X(d)}" cy="${f.y(avg[d])}" r="4" class="v-dot avg"/>` : '')
      + (d <= lastDay ? `<circle cx="${X(d)}" cy="${f.y(cur[d])}" r="4.5" class="v-dot exp"/>` : '') }),
    tip: (d) => `<div class="t-head">${d} ${MONTHS_GEN[viewM]}</div>`
      + (d <= lastDay ? tipRow('var(--exp)', 'Потрачено', fmt(cur[d]), true) : '<div class="t-foot">Этот день ещё не наступил</div>')
      + (avg ? tipRow('var(--muted)', 'Обычно', fmt(avg[d]), true) : ''),
  });
  return { cur, avg, lastDay, dim };
}

/* ---------- Советы ---------- */
function buildTips(rows) {
  const todayIso = isoToday(), todayKey = todayIso.slice(0, 7);
  const cur = rows[rows.length - 1];
  const base = rows.slice(0, -1).filter((r) => r.count > 0 && r.key < todayKey);
  const tips = [];
  const add = (level, title, text) => tips.push({ level, title, text });
  const withData = rows.filter((r) => r.count > 0);
  if (withData.length < 2) {
    add('info', 'Мало данных для сравнения', 'Добавьте операции хотя бы за 2 месяца (можно импортом из CSV) — появятся сравнения по месяцам и советы.');
  }

  // Прогноз для текущего месяца
  const inProgress = cur.key === todayKey;
  const day = +todayIso.slice(8, 10), dim = daysIn(cur.y, cur.m);
  const avgExp = base.length ? base.reduce((s, r) => s + r.exp, 0) / base.length : 0;
  const avgInc = base.length ? base.reduce((s, r) => s + r.inc, 0) / base.length : 0;

  if (inProgress && day >= 5 && cur.exp > 0) {
    const proj = projectMonth(cur.y, cur.m, cur.exp, day);
    if (state.budget > 0) {
      const left = state.budget - cur.exp, daysLeft = dim - day;
      if (left <= 0) {
        add('warn', `Бюджет уже превышен на ${fmt(-left)}`,
          `Потрачено ${fmt(cur.exp)} из ${fmt(state.budget)}, до конца месяца ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}. При нынешнем темпе выйдет около ${fmt(proj)} — отложите необязательные покупки.`);
      } else if (proj > state.budget * 1.02) {
        add('warn', `Бюджет может превыситься на ~${fmt(proj - state.budget)}`,
          `При нынешнем темпе к концу месяца выйдет около ${fmt(proj)} при бюджете ${fmt(state.budget)}. `
          + (daysLeft > 0 ? `Чтобы уложиться, тратьте не больше ${fmt(left / daysLeft)} в день до конца месяца.` : ''));
      } else add('good', 'Укладываетесь в бюджет', `Прогноз на месяц — около ${fmt(proj)} из ${fmt(state.budget)}.`);
    } else if (avgExp > 0 && proj > avgExp * 1.15) {
      add('warn', 'Тратите быстрее обычного', `К концу месяца выйдет около ${fmt(proj)} — это на ${pct(proj / avgExp - 1)} больше, чем в среднем (${fmt(avgExp)}).`);
    }
  }
  if (!(state.budget > 0) && avgExp > 0) {
    const sug = Math.max(10, Math.round(avgExp * 0.9 / 10) * 10);
    add('info', 'Задайте месячный бюджет', `В среднем вы тратите ${fmt(avgExp)} в месяц. Можно начать с ${fmt(sug)} (на 10% меньше) — в ⚙︎ Настройках. Тогда появится прогноз и предупреждения.`);
  }

  // Норма сбережений по завершённым месяцам
  if (avgInc > 0) {
    const rate = (avgInc - avgExp) / avgInc;
    if (rate < 0) add('warn', 'Расходы больше доходов', `В среднем за месяц уходит на ${fmt(avgExp - avgInc)} больше, чем приходит. Начните с самых крупных категорий ниже — их сокращение даст наибольший эффект.`);
    else if (rate < 0.1) add('warn', `Откладывается ${pct(rate)} дохода`, `Частый ориентир — 10–20%. Попробуйте сразу после поступления дохода откладывать ${fmt(Math.round(avgInc * 0.1))} (10%), а тратить остальное.`);
    else if (rate >= 0.2) add('good', `Откладываете ${pct(rate)} дохода`, `В среднем остаётся ${fmt(avgInc - avgExp)} в месяц — хороший результат. Держите темп.`);
    else add('info', `Откладываете ${pct(rate)} дохода`, `Это в пределах ориентира 10–20%. Если поднять до 20%, будет оставаться ещё ~${fmt(Math.max(0, avgInc * 0.2 - (avgInc - avgExp)))} в месяц.`);
  }

  // Рост по категориям: фактическая сумма текущего месяца против среднего за месяц.
  // Для идущего месяца срабатывает, только если обычный месячный уровень уже превышен.
  if (base.length) {
    const growth = [];
    for (const [id, v] of Object.entries(cur.cats)) {
      const avg = base.reduce((s, r) => s + (r.cats[id] || 0), 0) / base.length;
      const now = v;
      if (avg > 0 && now > avg * 1.3 && now - avg >= Math.max(10, avgExp * 0.05)) growth.push({ id, avg, now });
    }
    growth.sort((a, b) => (b.now - b.avg) - (a.now - a.avg)).slice(0, 2).forEach((g) => {
      const c = catOf('expense', g.id);
      add('warn', `${c.e} ${c.name}: +${pct(g.now / g.avg - 1)} к обычному`,
        `${inProgress ? 'Уже потрачено' : 'За месяц'} ${fmt(g.now)}, а обычно за весь месяц — ${fmt(g.avg)}. Посмотрите, что именно добавилось.`);
    });
  }

  // Самая крупная статья
  const totals = {}; let totalExp = 0;
  for (const r of rows) for (const [id, v] of Object.entries(r.cats)) { totals[id] = (totals[id] || 0) + v; totalExp += v; }
  const topCat = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const months = Math.max(1, withData.length);
  if (topCat && totalExp > 0) {
    const [id, v] = topCat, share = v / totalExp, c = catOf('expense', id);
    if (id === 'other' && share > 0.25) add('info', 'Много трат в «Другое»', `Это ${pct(share)} расходов. Разнесите их по категориям (или создайте новые) — советы станут точнее.`);
    else if (share > 0.35) add('info', `${c.e} ${c.name} — ${pct(share)} всех расходов`, `Самая крупная статья: ~${fmt(v / months)} в месяц. Сокращение даже на 10% даст ~${fmt(v / months * 0.1)} в месяц.`);
  }

  // Подписки
  const subs = totals.subs || 0;
  if (subs > 0) add('info', `🔁 Подписки: ~${fmt(subs / months)} в месяц`, `Это около ${fmt(subs / months * 12)} в год. Проверьте, всеми ли сервисами вы пользуетесь.`);

  // Мелкие покупки
  const small = rows.reduce((s, r) => s + r.small, 0), smallSum = rows.reduce((s, r) => s + r.smallSum, 0);
  if (small >= 8 && totalExp > 0 && smallSum / totalExp >= 0.12) {
    add('info', `Мелкие покупки: ${small} шт. на ${fmt(smallSum)}`, `Траты до 10 BYN за период — ${pct(smallSum / totalExp)} расходов. По отдельности незаметны, но в сумме ощутимы.`);
  }

  // Резерв
  const total = state.tx.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  if (avgExp > 0 && total > 0) {
    const m = total / avgExp;
    const mText = `${(Math.round(m * 10) / 10).toLocaleString('ru-RU')} мес.`;
    if (m < 1) add('warn', `Запаса хватит на ${mText}`, 'Обычно советуют держать резерв на 3–6 месяцев расходов на случай непредвиденных трат. Можно начать с цели в один месяц.');
    else if (m < 3) add('info', `Запаса хватит на ${mText}`, `Ориентир — 3–6 месяцев расходов. До 3 месяцев не хватает ~${fmt(avgExp * 3 - total)}.`);
    else add('good', `Запаса хватит на ${mText}`, 'Резерв в 3+ месяца расходов — надёжная подушка.');
  }

  const order = { warn: 0, info: 1, good: 2 };
  return tips.sort((a, b) => order[a.level] - order[b.level]).slice(0, 7);
}

/* ---------- Сборка экрана ---------- */
function renderStats() {
  const months = monthsBack(statsN);
  const rows = aggregate(months);
  const first = months[0], last = months[months.length - 1];
  $('#statsRange').textContent = `${MONTHS[first.m]} ${first.y} — ${MONTHS[last.m]} ${last.y}`;
  document.querySelectorAll('#periodSeg .seg-btn').forEach((b) => b.classList.toggle('active', +b.dataset.n === statsN));

  const todayKey = isoToday().slice(0, 7);
  const done = rows.filter((r) => r.count > 0 && r.key < todayKey);
  const basis = done.length ? done : rows.filter((r) => r.count > 0);
  const body = $('#statsBody');
  if (!basis.length) {
    body.innerHTML = '<p class="empty">За этот период операций нет.<br>Выберите период длиннее или добавьте операции.</p>';
    return;
  }
  const aInc = basis.reduce((s, r) => s + r.inc, 0) / basis.length;
  const aExp = basis.reduce((s, r) => s + r.exp, 0) / basis.length;
  const rate = aInc > 0 ? (aInc - aExp) / aInc : null;
  const tips = buildTips(rows);
  const icon = { warn: '⚠️', info: '💡', good: '✅' };

  body.innerHTML = `
    <div class="tiles">
      <div class="tile"><span>Доход в месяц</span><b>${fmt(aInc)}</b></div>
      <div class="tile"><span>Расход в месяц</span><b>${fmt(aExp)}</b></div>
      <div class="tile"><span>Откладываете</span><b>${rate === null ? '—' : pct(rate)}</b></div>
    </div>
    <p class="hint center">В среднем по ${basis.length} ${plural(basis.length, 'месяцу', 'месяцам', 'месяцам')}${done.length ? ' (без текущего незавершённого)' : ''}</p>
    <section class="card"><h2>Советы</h2>
      <ul class="tips">${tips.map((t) => `<li class="tip ${t.level}"><span class="tip-ico">${icon[t.level]}</span><div><b>${esc(t.title)}</b><p>${esc(t.text)}</p></div></li>`).join('')}</ul>
      <p class="hint tiny">Советы рассчитываются автоматически по вашим записям и не являются профессиональной финансовой консультацией.</p>
    </section>
    <section class="card"><h2>Доходы и расходы</h2><div id="chIncExp"></div></section>
    <section class="card"><h2>Темп расходов: ${MONTHS[viewM].toLowerCase()}</h2><div id="chPace"></div></section>
    <section class="card"><h2>Расходы по категориям</h2><div id="chCats"></div></section>
    <section class="card"><h2>Остаток на счету</h2><div id="chBal"></div></section>
    <section class="card"><h2>Категории: ${MONTHS[viewM].toLowerCase()} и среднее</h2><div id="catTable"></div></section>`;

  chartIncExp($('#chIncExp'), rows);
  chartPace($('#chPace'));
  chartCats($('#chCats'), rows);
  chartBalance($('#chBal'), rows);
  renderCatTable(rows);
}

function renderCatTable(rows) {
  const todayKey = isoToday().slice(0, 7);
  const cur = rows[rows.length - 1];
  const base = rows.slice(0, -1).filter((r) => r.count > 0 && r.key < todayKey);
  const ids = new Set([...Object.keys(cur.cats), ...base.flatMap((r) => Object.keys(r.cats))]);
  const list = [...ids].map((id) => ({
    c: catOf('expense', id), now: cur.cats[id] || 0,
    avg: base.length ? base.reduce((s, r) => s + (r.cats[id] || 0), 0) / base.length : null,
  })).sort((a, b) => b.now - a.now || (b.avg || 0) - (a.avg || 0));
  if (!list.length) { $('#catTable').innerHTML = '<p class="hint center">Нет расходов</p>'; return; }
  const inProgress = cur.key === todayKey;
  const delta = (r) => {
    if (r.avg === null || r.avg === 0) return '<span class="muted">—</span>';
    const d = r.now / r.avg - 1;
    if (Math.abs(d) < 0.05) return '<span class="muted">≈</span>';
    if (inProgress && d < 0) return '<span class="muted">идёт</span>';
    return d > 0 ? `<span class="up">↑ ${pct(d)}</span>` : `<span class="down">↓ ${pct(-d)}</span>`;
  };
  $('#catTable').innerHTML = `<table class="ctable">
    <tr><th>Категория</th><th>${SHORT_M[cur.m]}</th>${base.length ? '<th>Среднее</th><th></th>' : ''}</tr>
    ${list.map((r) => `<tr><td><span class="sw" style="background:${esc(r.c.c)}"></span>${esc(r.c.e)} ${esc(r.c.name)}</td><td>${fmt(r.now)}</td>${base.length ? `<td>${fmt(r.avg)}</td><td>${delta(r)}</td>` : ''}</tr>`).join('')}
  </table>${inProgress ? '<p class="hint tiny">Месяц ещё идёт: суммы неполные. Стрелка ↑ появляется, когда потрачено уже больше обычного за весь месяц.</p>' : ''}`;
}

$('#openStats').addEventListener('click', () => { open('#statsBackdrop'); renderStats(); });
$('#periodSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) { statsN = +b.dataset.n; renderStats(); } });
let statsResize;
window.addEventListener('resize', () => {
  clearTimeout(statsResize);
  statsResize = setTimeout(() => { if (!$('#statsBackdrop').hidden) renderStats(); }, 200);
});
// Касание вне графика скрывает подсказку
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.viz')) return;
  document.querySelectorAll('#statsBody [id^="ch"]').forEach((el) => el._hide && el._hide());
});
