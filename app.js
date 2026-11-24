'use strict';

/* ---------- Справочники ---------- */
const DEFAULT_CATS = {
  expense: [
    { id: 'food', name: 'Продукты', e: '🛒', c: '#34c759' },
    { id: 'cafe', name: 'Кафе', e: '🍔', c: '#ff9f0a' },
    { id: 'transport', name: 'Транспорт', e: '🚌', c: '#0a84ff' },
    { id: 'home', name: 'Дом', e: '🏠', c: '#a2845e' },
    { id: 'phone', name: 'Связь', e: '📱', c: '#5ac8fa' },
    { id: 'health', name: 'Здоровье', e: '💊', c: '#ff375f' },
    { id: 'clothes', name: 'Одежда', e: '👕', c: '#bf5af2' },
    { id: 'fun', name: 'Развлечения', e: '🎬', c: '#ffd60a' },
    { id: 'study', name: 'Учёба', e: '📚', c: '#5e5ce6' },
    { id: 'gifts', name: 'Подарки', e: '🎁', c: '#ff6482' },
    { id: 'subs', name: 'Подписки', e: '🔁', c: '#64d2ff' },
    { id: 'other', name: 'Другое', e: '📦', c: '#8e8e93' },
  ],
  income: [
    { id: 'salary', name: 'Зарплата', e: '💼', c: '#34c759' },
    { id: 'grant', name: 'Стипендия', e: '🎓', c: '#0a84ff' },
    { id: 'side', name: 'Подработка', e: '🛠', c: '#ff9f0a' },
    { id: 'gift_in', name: 'Подарки', e: '🎁', c: '#ff6482' },
    { id: 'cashback', name: 'Кэшбэк', e: '💳', c: '#5e5ce6' },
    { id: 'other_in', name: 'Другое', e: '💰', c: '#8e8e93' },
  ],
};
// Категория «Другое» удалить нельзя: в неё переносятся операции удалённых категорий.
const FALLBACK = { expense: 'other', income: 'other_in' };
const PALETTE = ['#34c759', '#30b0c7', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff6482', '#ff9f0a', '#ffd60a', '#a2845e', '#64d2ff', '#8e8e93'];
const EMOJI = ['🛒', '🍔', '☕', '🍕', '🚌', '🚕', '⛽', '🚗', '🏠', '💡', '📱', '💻', '💊', '🏥', '👕', '👟', '💇', '🎬', '🎮', '🎵', '📚', '✏️', '🎁', '🐶', '👶', '✈️', '🏖', '🏋️', '🍺', '🔁', '💳', '💼', '🎓', '🛠', '💰', '📈', '🏦', '🧾', '🏷️', '📦'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const KEY = 'finance.v1';
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

const $ = (s) => document.querySelector(s);
// Белорусский рубль. Формат одинаковый во всех браузерах: «1 250,50 BYN».
const CURRENCY = 'BYN';
const numInt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const numDec = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => {
  const r = round2(n);
  return (Number.isInteger(r) ? numInt : numDec).format(r) + ' ' + CURRENCY;
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoToday = () => toIso(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const parseAmount = (s) => { const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? round2(n) : NaN; };
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- Хранилище ---------- */
let state = { tx: [], budget: 0, cats: clone(DEFAULT_CATS) };

function normCats(c) {
  const out = clone(DEFAULT_CATS);
  if (!c) return out;
  for (const t of ['expense', 'income']) {
    if (Array.isArray(c[t])) {
      const list = c[t].filter((x) => x && x.id && x.name).map((x) => ({ id: String(x.id), name: String(x.name), e: x.e || '🏷️', c: x.c || '#8e8e93' }));
      if (list.length) out[t] = list;
    }
    if (!out[t].some((x) => x.id === FALLBACK[t])) out[t].push(clone(DEFAULT_CATS[t].find((x) => x.id === FALLBACK[t])));
  }
  return out;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state = { tx: Array.isArray(s.tx) ? s.tx : [], budget: +s.budget || 0, cats: normCats(s.cats) };
    }
  } catch (e) { console.warn(e); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Не удалось сохранить данные'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Фото чеков — в IndexedDB (в localStorage мало места).
const idb = (() => {
  let p;
  const db = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('finance', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('receipts');
    r.onsuccess = () => res(r.result);
    r.onerror = () => { p = null; rej(r.error); };
  }));
  const op = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('receipts', mode);
      const req = fn(t.objectStore('receipts'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    get: (k) => op('readonly', (s) => s.get(k)),
    put: (k, v) => op('readwrite', (s) => s.put(v, k)),
    del: (k) => op('readwrite', (s) => s.delete(k)),
    clear: () => op('readwrite', (s) => s.clear()),
  };
})();

function catOf(type, id) {
  const list = state.cats[type];
  return list.find((c) => c.id === id) || list.find((c) => c.id === FALLBACK[type]) || { id: FALLBACK[type], name: 'Без категории', e: '❔', c: '#8e8e93' };
}
function nextColor(type) {
  const used = new Set(state.cats[type].map((c) => c.c));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

/* ---------- Состояние экрана ---------- */
const now = new Date();
let viewY = now.getFullYear();
let viewM = now.getMonth();
let filter = 'all';

function monthKey() { return `${viewY}-${pad(viewM + 1)}`; }

/* ---------- Отрисовка ---------- */
function render() {
  $('#monthTitle').textContent = `${MONTHS[viewM]} ${viewY}`;
  const mk = monthKey();
  const monthTx = state.tx.filter((t) => t.date.startsWith(mk));

  let inc = 0, exp = 0;
  for (const t of monthTx) t.type === 'income' ? (inc += t.amount) : (exp += t.amount);
  $('#incomeSum').textContent = fmt(inc);
  $('#expenseSum').textContent = fmt(exp);
  const bal = inc - exp;
  $('#balance').textContent = (bal > 0 ? '+' : '') + fmt(bal);
  $('#balance').style.color = bal < 0 ? 'var(--exp)' : '';

  const total = state.tx.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  $('#totalBalance').textContent = fmt(total);

  const bBox = $('#budgetBox');
  if (state.budget > 0) {
    bBox.hidden = false;
    const p = exp / state.budget;
    const left = state.budget - exp;
    $('#budgetText').textContent = left >= 0 ? `осталось ${fmt(left)}` : `превышен на ${fmt(-left)}`;
    const fill = $('#budgetFill');
    fill.style.width = Math.min(100, p * 100) + '%';
    fill.className = 'bar-fill' + (p >= 1 ? ' over' : p >= 0.8 ? ' warn' : '');
  } else bBox.hidden = true;

  renderChart(monthTx.filter((t) => t.type === 'expense'), exp);
  renderList(monthTx);
}

function renderChart(expTx, total) {
  const card = $('#chartCard');
  if (!total) { card.hidden = true; return; }
  card.hidden = false;
  const by = {};
  for (const t of expTx) { const c = catOf('expense', t.cat); by[c.id] = (by[c.id] || 0) + t.amount; }
  const rows = Object.entries(by).map(([id, sum]) => ({ cat: catOf('expense', id), sum })).sort((a, b) => b.sum - a.sum);

  let svg = '<circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--fill)" stroke-width="6"></circle>';
  let offset = 0;
  for (const r of rows) {
    const pct = (r.sum / total) * 100;
    svg += `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${esc(r.cat.c)}" stroke-width="6"
      stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${-offset}"></circle>`;
    offset += pct;
  }
  $('#donut').innerHTML = svg;
  $('#legend').innerHTML = rows.slice(0, 7).map((r) => `
    <li><span class="sw" style="background:${esc(r.cat.c)}"></span>
      <span class="name">${esc(r.cat.e)} ${esc(r.cat.name)}</span>
      <span class="pct">${Math.round((r.sum / total) * 100)}%</span></li>`).join('')
    + (rows.length > 7 ? `<li><span class="name pct">и ещё ${rows.length - 7}</span></li>` : '');
}

function dayLabel(iso) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === isoToday()) return 'Сегодня';
  if (iso === toIso(y)) return 'Вчера';
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
}

function renderList(monthTx) {
  const items = monthTx.filter((t) => filter === 'all' || t.type === filter)
    .sort((a, b) => (b.date.localeCompare(a.date)) || (b.created || 0) - (a.created || 0));
  $('#emptyMsg').hidden = items.length > 0;
  const groups = new Map();
  for (const t of items) { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); }
  let html = '';
  for (const [date, list] of groups) {
    const daySum = list.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    html += `<div class="day-head"><span>${dayLabel(date)}</span><span>${daySum > 0 ? '+' : ''}${fmt(daySum)}</span></div><div class="day-group">`;
    for (const t of list) {
      const c = catOf(t.type, t.cat);
      const sub = [t.receipt ? '🧾' : '', t.note ? esc(t.note) : ''].filter(Boolean).join(' ');
      html += `<button class="tx" data-id="${esc(t.id)}">
        <span class="tx-ico" style="background:${esc(c.c)}26">${esc(c.e)}</span>
        <span class="tx-main"><div class="tx-cat">${esc(c.name)}</div>${sub ? `<div class="tx-note">${sub}</div>` : ''}</span>
        <span class="tx-amt ${t.type === 'income' ? 'inc' : ''}">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</span>
      </button>`;
    }
    html += '</div>';
  }
  $('#txList').innerHTML = html;
}

/* ---------- Модальные окна ---------- */
function open(sel) { $(sel).hidden = false; document.body.style.overflow = 'hidden'; }
function close(sel) {
  $(sel).hidden = true;
  if (![...document.querySelectorAll('.backdrop')].some((b) => !b.hidden)) document.body.style.overflow = '';
}
document.querySelectorAll('.backdrop').forEach((bd) => {
  bd.addEventListener('click', (e) => { if (e.target === bd || e.target.closest('[data-close]')) close('#' + bd.id); });
});

/* ---------- Форма операции ---------- */
let editId = null;
let formType = 'expense';
let formCat = 'food';
// origId — чек, сохранённый у операции; current — показанное фото; changed — фото заменили или убрали.
let formReceipt = { origId: null, current: null, changed: false, url: null };

function renderCats() {
  $('#catGrid').innerHTML = state.cats[formType].map((c) =>
    `<button type="button" class="cat ${c.id === formCat ? 'active' : ''}" data-cat="${esc(c.id)}"><span class="e">${esc(c.e)}</span><span class="cn">${esc(c.name)}</span></button>`).join('')
    + '<button type="button" class="cat add" data-add><span class="e">＋</span><span class="cn">Новая</span></button>';
}
function setType(type) {
  formType = type;
  if (!state.cats[type].some((c) => c.id === formCat)) formCat = state.cats[type][0].id;
  document.querySelectorAll('.type-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  renderCats();
}
function showReceipt(blob) {
  if (formReceipt.url) URL.revokeObjectURL(formReceipt.url);
  formReceipt.url = blob ? URL.createObjectURL(blob) : null;
  $('#receiptThumb').src = formReceipt.url || '';
  $('#receiptPreview').hidden = !blob;
  $('#receiptEmpty').hidden = !!blob;
}
function openTx(tx) {
  editId = tx ? tx.id : null;
  $('#txFormTitle').textContent = tx ? 'Изменить' : 'Новая операция';
  formCat = tx ? tx.cat : '';
  setType(tx ? tx.type : 'expense');
  $('#amount').value = tx ? String(tx.amount).replace('.', ',') : '';
  // По умолчанию — сегодня, если смотрим текущий месяц, иначе 1-е число выбранного месяца
  const today = isoToday();
  $('#date').value = tx ? tx.date : (today.startsWith(monthKey()) ? today : `${monthKey()}-01`);
  $('#note').value = tx ? tx.note || '' : '';
  $('#deleteTx').hidden = !tx;
  formReceipt = { origId: tx && tx.receipt || null, current: null, changed: false, url: formReceipt.url };
  showReceipt(null);
  if (formReceipt.origId) {
    const id = formReceipt.origId;
    idb.get(id).then((b) => { if (b && formReceipt.origId === id && !formReceipt.changed) { formReceipt.current = b; showReceipt(b); } }).catch(() => {});
  }
  open('#txBackdrop');
}

$('#txForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseAmount($('#amount').value);
  if (!(amount > 0)) { toast('Введите сумму'); $('#amount').focus(); return; }
  const date = $('#date').value || isoToday();
  const data = { type: formType, amount, cat: formCat, date, note: $('#note').value.trim() };
  const tx = editId ? state.tx.find((t) => t.id === editId) : null;
  data.receipt = tx ? tx.receipt : undefined;
  if (formReceipt.changed) {
    try {
      if (formReceipt.current) {
        const rid = 'r_' + uid();
        await idb.put(rid, formReceipt.current);
        data.receipt = rid;
      } else data.receipt = undefined;
      if (formReceipt.origId) idb.del(formReceipt.origId).catch(() => {});
    } catch (err) { toast('Не удалось сохранить фото чека'); return; }
  }
  if (!data.receipt) delete data.receipt;
  if (tx) { delete tx.receipt; Object.assign(tx, data); }
  else state.tx.push({ id: uid(), created: Date.now(), ...data });
  save();
  viewY = +date.slice(0, 4); viewM = +date.slice(5, 7) - 1;
  close('#txBackdrop');
  render();
});
$('.type-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) setType(b.dataset.type); });
$('#catGrid').addEventListener('click', (e) => {
  if (e.target.closest('[data-add]')) { openCatEdit(formType, null, (id) => { formCat = id; renderCats(); }); return; }
  const b = e.target.closest('[data-cat]'); if (b) { formCat = b.dataset.cat; renderCats(); }
});
$('#deleteTx').addEventListener('click', () => {
  if (!confirm('Удалить эту операцию?')) return;
  const tx = state.tx.find((t) => t.id === editId);
  if (tx && tx.receipt) idb.del(tx.receipt).catch(() => {});
  state.tx = state.tx.filter((t) => t.id !== editId);
  save(); close('#txBackdrop'); render(); toast('Операция удалена');
});

/* ---------- Чеки: фото и распознавание ---------- */
let receiptMode = 'attach';
function pickReceipt(mode) { receiptMode = mode; $('#receiptFile').click(); }
$('#scanBtn').addEventListener('click', () => pickReceipt('scan'));
$('#attachReceipt').addEventListener('click', () => pickReceipt('attach'));
$('#replaceReceipt').addEventListener('click', () => pickReceipt('attach'));
$('#removeReceipt').addEventListener('click', () => { formReceipt.current = null; formReceipt.changed = true; showReceipt(null); });
$('#scanAgain').addEventListener('click', () => { if (formReceipt.current) recognize(formReceipt.current); });
$('#receiptThumbBtn').addEventListener('click', () => { $('#viewImg').src = formReceipt.url; open('#viewBackdrop'); });

$('#receiptFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let blob;
  try { blob = await compressImage(f); } catch (err) { toast('Не удалось открыть изображение'); return; }
  if (receiptMode === 'scan') openTx(null);
  formReceipt.current = blob; formReceipt.changed = true;
  showReceipt(blob);
  if (receiptMode === 'scan') recognize(blob);
});

// Уменьшаем фото до 1600 px по длинной стороне и сохраняем в JPEG: ~150–300 КБ на чек.
function compressImage(file, max = 1600, quality = 0.75) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
}

// Tesseract.js (~ несколько МБ) грузится только при первом распознавании, потом берётся из кэша браузера.
let tessLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!tessLoading) {
    tessLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = TESSERACT_URL; s.async = true;
      s.onload = res;
      s.onerror = () => { tessLoading = null; s.remove(); rej(new Error('load')); };
      document.head.appendChild(s);
    });
  }
  return tessLoading;
}
async function ocrText(blob) {
  busy('Загружаю распознавание…');
  await loadTesseract();
  const worker = await Tesseract.createWorker(['rus', 'eng'], 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') busy(`Распознаю чек… ${Math.round(m.progress * 100)}%`);
      else if (/load/i.test(m.status)) busy('Загружаю словари (только в первый раз)…');
    },
  });
  try { return (await worker.recognize(blob)).data.text; }
  finally { worker.terminate(); }
}

function parseReceipt(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const num = /(\d{1,3}(?:[  ]\d{3})+|\d+)\s?[.,]\s?(\d{2})(?!\d)/g;
  const toN = (m) => parseFloat(m[1].replace(/[  ]/g, '') + '.' + m[2]);
  const lastNum = (l) => { const ms = [...(l || '').matchAll(num)]; return ms.length ? toN(ms[ms.length - 1]) : null; };
  let amount = null;
  // Ключевые слова по приоритету: сначала «итого / к оплате», потом «всего / сумма».
  const keys = [/итог|к\s*оплат|total/i, /всего|сумма\s*(по\s*чеку|чека|к\s*оплате)?$|сумма\s*:/i];
  for (const re of keys) {
    const i = lines.findIndex((l) => re.test(l) && !/ндс|скидк|сдач/i.test(l));
    if (i >= 0) { amount = lastNum(lines[i]) ?? lastNum(lines[i + 1]); if (amount) break; }
  }
  if (!amount) {
    let maxV = 0;
    for (const l of lines) for (const m of l.matchAll(num)) { const v = toN(m); if (v > maxV && v < 100000) maxV = v; }
    if (maxV) amount = maxV;
  }
  let date = null;
  for (const m of text.matchAll(/(\d{2})[.\/-](\d{2})[.\/-](\d{4}|\d{2})(?!\d)/g)) {
    const iso = parseDateStr(m[0]);
    if (iso && iso <= isoToday()) { date = iso; break; }
  }
  return { amount: amount ? round2(amount) : null, date };
}

let ocrBusy = false;
async function recognize(blob) {
  if (ocrBusy) return;
  ocrBusy = true;
  try {
    const r = parseReceipt(await ocrText(blob));
    busy(null);
    if ($('#txBackdrop').hidden) return;
    const found = [];
    if (r.amount) { $('#amount').value = String(r.amount).replace('.', ','); found.push('сумма ' + fmt(r.amount)); }
    if (r.date) { $('#date').value = r.date; found.push('дата'); }
    toast(found.length ? `Распознано: ${found.join(', ')}. Проверьте перед сохранением` : 'Сумму найти не удалось — введите вручную', 3500);
  } catch (err) {
    console.warn(err);
    busy(null);
    toast(navigator.onLine ? 'Не удалось распознать чек' : 'Для первого распознавания нужен интернет', 3000);
  } finally { ocrBusy = false; }
}

/* ---------- Главный экран ---------- */
$('#addBtn').addEventListener('click', () => { openTx(null); setTimeout(() => $('#amount').focus(), 50); });
$('#txList').addEventListener('click', (e) => {
  const b = e.target.closest('.tx'); if (!b) return;
  openTx(state.tx.find((t) => t.id === b.dataset.id));
});
$('#prevMonth').addEventListener('click', () => { if (--viewM < 0) { viewM = 11; viewY--; } render(); });
$('#nextMonth').addEventListener('click', () => { if (++viewM > 11) { viewM = 0; viewY++; } render(); });
document.querySelector('.list-section .seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  filter = b.dataset.filter;
  document.querySelectorAll('.list-section .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
  render();
});

/* ---------- Категории ---------- */
let catType = 'expense';
function renderCatList() {
  document.querySelectorAll('#catTypeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === catType));
  const counts = {};
  for (const t of state.tx) if (t.type === catType) counts[t.cat] = (counts[t.cat] || 0) + 1;
  $('#catList').innerHTML = state.cats[catType].map((c) => `
    <button type="button" class="row cat-row" data-id="${esc(c.id)}">
      <span class="tx-ico" style="background:${esc(c.c)}26">${esc(c.e)}</span>
      <span class="cat-name">${esc(c.name)}</span>
      <span class="muted">${counts[c.id] || ''}</span>
      <span class="chev">›</span>
    </button>`).join('');
}
$('#openCats').addEventListener('click', () => { catType = 'expense'; renderCatList(); open('#catBackdrop'); });
$('#catTypeSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) { catType = b.dataset.type; renderCatList(); } });
$('#catList').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) openCatEdit(catType, b.dataset.id); });
$('#addCat').addEventListener('click', () => openCatEdit(catType, null));

let ce = { type: 'expense', id: null, color: PALETTE[0], onSaved: null };
function renderCeColors() {
  $('#ceColors').innerHTML = PALETTE.map((c) =>
    `<button type="button" class="swatch ${c === ce.color ? 'active' : ''}" data-color="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join('');
  $('#ceEmoji').style.background = ce.color + '26';
}
$('#ceEmojiGrid').innerHTML = EMOJI.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
function openCatEdit(type, id, onSaved) {
  const c = id ? state.cats[type].find((x) => x.id === id) : null;
  ce = { type, id: c ? c.id : null, color: c ? c.c : nextColor(type), onSaved: onSaved || null };
  $('#ceTitle').textContent = c ? 'Категория' : (type === 'income' ? 'Новый доход' : 'Новый расход');
  $('#ceEmoji').value = c ? c.e : '🏷️';
  $('#ceName').value = c ? c.name : '';
  $('#ceDelete').hidden = !c || c.id === FALLBACK[type];
  renderCeColors();
  open('#catEditBackdrop');
  if (!c) setTimeout(() => $('#ceName').focus(), 50);
}
$('#ceColors').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) { ce.color = b.dataset.color; renderCeColors(); } });
$('#ceEmojiGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-emoji]'); if (b) $('#ceEmoji').value = b.dataset.emoji; });
$('#ceEmoji').addEventListener('focus', (e) => e.target.select());

function firstGrapheme(s) {
  s = s.trim();
  if (!s) return '';
  if (window.Intl && Intl.Segmenter) return new Intl.Segmenter().segment(s)[Symbol.iterator]().next().value.segment;
  return [...s].slice(0, 2).join('');
}
function afterCatsChanged() {
  save();
  if (!$('#catBackdrop').hidden) renderCatList();
  if (!$('#txBackdrop').hidden) renderCats();
  render();
}
$('#catEditForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#ceName').value.trim();
  if (!name) { toast('Введите название'); $('#ceName').focus(); return; }
  const list = state.cats[ce.type];
  if (list.some((c) => c.id !== ce.id && c.name.toLowerCase() === name.toLowerCase())) { toast('Такая категория уже есть'); return; }
  const emoji = firstGrapheme($('#ceEmoji').value) || '🏷️';
  let id = ce.id;
  if (id) Object.assign(list.find((c) => c.id === id), { name, e: emoji, c: ce.color });
  else { id = 'c_' + uid(); list.push({ id, name, e: emoji, c: ce.color }); }
  const cb = ce.onSaved;
  close('#catEditBackdrop');
  if (cb) cb(id);
  afterCatsChanged();
});
$('#ceDelete').addEventListener('click', () => {
  const { type, id } = ce;
  const c = catOf(type, id), fb = catOf(type, FALLBACK[type]);
  const n = state.tx.filter((t) => t.type === type && t.cat === id).length;
  const msg = n ? `Удалить «${c.name}»? ${n} ${plural(n, 'операция перейдёт', 'операции перейдут', 'операций перейдут')} в «${fb.name}».` : `Удалить категорию «${c.name}»?`;
  if (!confirm(msg)) return;
  for (const t of state.tx) if (t.type === type && t.cat === id) t.cat = FALLBACK[type];
  state.cats[type] = state.cats[type].filter((x) => x.id !== id);
  if (formCat === id) formCat = FALLBACK[type];
  close('#catEditBackdrop');
  afterCatsChanged();
  toast('Категория удалена');
});

/* ---------- Настройки ---------- */
$('#openSettings').addEventListener('click', () => {
  $('#budgetInput').value = state.budget ? String(state.budget).replace('.', ',') : '';
  const r = state.tx.filter((t) => t.receipt).length;
  $('#countInfo').textContent = `Всего операций: ${state.tx.length}` + (r ? `, с чеками: ${r}` : '');
  open('#setBackdrop');
});
$('#budgetInput').addEventListener('change', () => {
  const v = parseAmount($('#budgetInput').value);
  state.budget = v > 0 ? v : 0;
  save(); render();
});

async function shareOrDownload(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

$('#exportJson').addEventListener('click', async () => {
  const receipts = {};
  for (const t of state.tx) {
    if (!t.receipt) continue;
    try { const b = await idb.get(t.receipt); if (b) receipts[t.receipt] = await blobToDataURL(b); } catch (e) { /* пропускаем */ }
  }
  shareOrDownload(`finance-backup-${isoToday()}.json`, JSON.stringify({ app: 'finance', version: 2, ...state, receipts }), 'application/json');
});
$('#exportCsv').addEventListener('click', () => {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['Дата', 'Тип', 'Категория', 'Сумма', 'Заметка'].join(';')];
  [...state.tx].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
    rows.push([t.date, t.type === 'income' ? 'Доход' : 'Расход', q(catOf(t.type, t.cat).name),
      String(t.type === 'income' ? t.amount : -t.amount).replace('.', ','), q(t.note || '')].join(';'));
  });
  shareOrDownload(`finance-${isoToday()}.csv`, '﻿' + rows.join('\r\n'), 'text/csv');
});
$('#importJsonBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.tx)) throw new Error('bad');
    const valid = data.tx.filter((t) => t && t.id && (t.type === 'income' || t.type === 'expense') && t.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
    if (!confirm(`Заменить текущие данные (${state.tx.length} операций) данными из копии (${valid.length} операций)?`)) return;
    await idb.clear().catch(() => {});
    const receipts = data.receipts || {};
    for (const t of valid) {
      if (t.receipt && receipts[t.receipt]) {
        try { await idb.put(t.receipt, await (await fetch(receipts[t.receipt])).blob()); } catch (err) { delete t.receipt; }
      } else delete t.receipt;
    }
    state = { tx: valid, budget: +data.budget || 0, cats: normCats(data.cats) };
    save(); render(); close('#setBackdrop'); toast('Данные восстановлены');
  } catch (err) { toast('Файл не похож на резервную копию'); }
});
$('#clearAll').addEventListener('click', () => {
  if (!confirm('Удалить ВСЕ операции и фото чеков? Категории останутся. Это нельзя отменить.')) return;
  state = { tx: [], budget: 0, cats: state.cats }; save();
  idb.clear().catch(() => {});
  render(); close('#setBackdrop'); toast('Все данные удалены');
});

/* ---------- Импорт CSV ---------- */
async function readTextFile(f) {
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder('windows-1251').decode(buf); } // Excel в Windows часто сохраняет CSV в 1251
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const delim = [';', '\t', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function parseDateStr(s) {
  s = String(s || '').trim();
  const mk = (y, mo, d) => {
    y = +y; mo = +mo; d = +d;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  };
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return mk(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/);
  if (m) return mk(m[3].length === 2 ? '20' + m[3] : m[3], m[2], m[1]);
  return null;
}
function parseMoney(s) {
  let t = String(s || '').replace(/[\s ]/g, '').replace(/[−–—]/g, '-');
  const neg = /^-|^\(.*\)$|-$/.test(t);
  t = t.replace(/[^0-9.,]/g, '');
  if (!t) return NaN;
  const seps = t.match(/[.,]/g) || [];
  const last = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  if (seps.length > 1 && new Set(seps).size === 1 && t.length - last - 1 === 3) t = t.replace(/[.,]/g, ''); // 1,250,000
  else if (seps.length) t = t.slice(0, last).replace(/[.,]/g, '') + '.' + t.slice(last + 1);
  const n = parseFloat(t);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}
const H = {
  date: /^(дата|date|день|число)/i,
  type: /^(тип|type|вид)/i,
  cat: /(категор|category|статья)/i,
  amount: /(сумм|amount|sum|стоимост|цена|price)/i,
  note: /(замет|описан|коммент|назнач|примеч|note|descr|comment|memo|details)/i,
  inc: /^(доход|приход|поступ|зачисл|income|credit)/i,
  exp: /^(расход|списан|трат|expense|debit)/i,
};
function importRows(rows) {
  const head = rows[0].map((h) => h.trim());
  const find = (re) => head.findIndex((h) => re.test(h));
  let col = { date: find(H.date), type: find(H.type), cat: find(H.cat), amount: find(H.amount), note: find(H.note), inc: find(H.inc), exp: find(H.exp) };
  let body = rows.slice(1);
  const hasHeader = col.date > -1 && (col.amount > -1 || col.inc > -1 || col.exp > -1) && !parseDateStr(rows[0][col.date]);
  if (!hasHeader) { col = { date: 0, type: 1, cat: 2, amount: 3, note: 4, inc: -1, exp: -1 }; body = rows; }
  const cell = (r, i) => (i > -1 && r[i] != null ? String(r[i]).trim() : '');

  const anyNeg = col.amount > -1 && body.some((r) => parseMoney(cell(r, col.amount)) < 0);
  const existing = new Set(state.tx.map((t) => `${t.date}|${t.type}|${t.amount}|${t.cat}|${t.note || ''}`));
  const newCats = { expense: [], income: [] };
  const out = [];
  let dup = 0, bad = 0;

  for (const r of body) {
    const date = parseDateStr(cell(r, col.date));
    let v = NaN, type = null;
    if (col.amount > -1) v = parseMoney(cell(r, col.amount));
    else {
      const i = parseMoney(cell(r, col.inc)), x = parseMoney(cell(r, col.exp));
      if (i > 0) { v = i; type = 'income'; } else if (Math.abs(x) > 0) { v = Math.abs(x); type = 'expense'; }
    }
    const amount = round2(Math.abs(v));
    if (!date || !(amount > 0)) { bad++; continue; }
    if (!type) {
      const ts = cell(r, col.type);
      if (/дох|income|прих|поступ|зачисл|^\+/i.test(ts)) type = 'income';
      else if (/расх|expense|спис|трат|покуп|^-/i.test(ts)) type = 'expense';
      else type = anyNeg ? (v < 0 ? 'expense' : 'income') : 'expense';
    }
    const cname = cell(r, col.cat).slice(0, 24);
    let cat = FALLBACK[type];
    if (cname) {
      const lc = cname.toLowerCase();
      const found = state.cats[type].find((c) => c.name.toLowerCase() === lc) || newCats[type].find((c) => c.name.toLowerCase() === lc);
      if (found) cat = found.id;
      else {
        const used = new Set([...state.cats[type], ...newCats[type]].map((c) => c.c));
        const nc = { id: 'c_' + uid() + newCats[type].length, name: cname, e: '🏷️', c: PALETTE.find((c) => !used.has(c)) || PALETTE[newCats[type].length % PALETTE.length] };
        newCats[type].push(nc); cat = nc.id;
      }
    }
    const note = cell(r, col.note).slice(0, 80);
    if (existing.has(`${date}|${type}|${amount}|${cat}|${note}`)) { dup++; continue; }
    out.push({ id: uid() + out.length, created: Date.now() + out.length, type, amount, cat, date, note });
  }
  return { out, dup, bad, newCats };
}
$('#importCsvBtn').addEventListener('click', () => $('#csvFile').click());
$('#csvFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const rows = parseCSV(await readTextFile(f));
    if (!rows.length) { toast('Файл пустой'); return; }
    const { out, dup, bad, newCats } = importRows(rows);
    if (!out.length) {
      toast(dup ? `Эти операции уже есть в приложении (${dup})` : 'Не нашёл операций: нужны колонки с датой и суммой', 3500);
      return;
    }
    // Новые категории добавляем, только если на них есть операции
    const usedCats = new Set(out.map((t) => t.cat));
    for (const t of ['expense', 'income']) newCats[t] = newCats[t].filter((c) => usedCats.has(c.id));
    const ex = out.filter((t) => t.type === 'expense').length;
    const names = [...newCats.expense, ...newCats.income].map((c) => c.name);
    let msg = `Найдено ${out.length} ${plural(out.length, 'операция', 'операции', 'операций')}: расходов ${ex}, доходов ${out.length - ex}.`;
    if (dup) msg += `\nУже есть в приложении (пропущу): ${dup}.`;
    if (bad) msg += `\nНе распознано строк: ${bad}.`;
    if (names.length) msg += `\nНовые категории: ${names.join(', ')}.`;
    if (!confirm(msg + '\n\nДобавить?')) return;
    state.cats.expense.push(...newCats.expense);
    state.cats.income.push(...newCats.income);
    state.tx.push(...out);
    const latest = out.reduce((m, t) => (t.date > m ? t.date : m), '');
    viewY = +latest.slice(0, 4); viewM = +latest.slice(5, 7) - 1;
    save(); render(); close('#setBackdrop');
    toast(`Добавлено: ${out.length}`);
  } catch (err) { console.warn(err); toast('Не удалось прочитать файл'); }
});

/* ---------- Уведомления ---------- */
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
function busy(msg) {
  const t = $('#toast');
  clearTimeout(toastTimer);
  if (msg) { t.textContent = msg; t.hidden = false; } else t.hidden = true;
}

/* ---------- Старт ---------- */
load();
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
