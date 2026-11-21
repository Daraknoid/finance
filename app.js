'use strict';

/* ---------- Справочники ---------- */
const CATS = {
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
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const KEY = 'finance.v1';

const $ = (s) => document.querySelector(s);
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const fmt = (n) => money.format(n);
const catOf = (type, id) => CATS[type].find((c) => c.id === id) || CATS[type][CATS[type].length - 1];
const pad = (n) => String(n).padStart(2, '0');
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const parseAmount = (s) => { const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };

/* ---------- Хранилище ---------- */
let state = { tx: [], budget: 0 };
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = Object.assign({ tx: [], budget: 0 }, JSON.parse(raw));
  } catch (e) { console.warn(e); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Не удалось сохранить данные'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

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

  // Бюджет
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
  for (const t of expTx) by[t.cat] = (by[t.cat] || 0) + t.amount;
  const rows = Object.entries(by).map(([id, sum]) => ({ cat: catOf('expense', id), sum })).sort((a, b) => b.sum - a.sum);

  let svg = '<circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--fill)" stroke-width="6"></circle>';
  let offset = 0;
  for (const r of rows) {
    const pct = (r.sum / total) * 100;
    svg += `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${r.cat.c}" stroke-width="6"
      stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${-offset}"></circle>`;
    offset += pct;
  }
  $('#donut').innerHTML = svg;
  $('#legend').innerHTML = rows.slice(0, 7).map((r) => `
    <li><span class="sw" style="background:${r.cat.c}"></span>
      <span class="name">${r.cat.e} ${r.cat.name}</span>
      <span class="pct">${Math.round((r.sum / total) * 100)}%</span></li>`).join('')
    + (rows.length > 7 ? `<li><span class="name pct">и ещё ${rows.length - 7}</span></li>` : '');
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function dayLabel(iso) {
  const today = isoToday();
  const d = new Date(iso + 'T00:00:00');
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yIso = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (iso === today) return 'Сегодня';
  if (iso === yIso) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
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
      html += `<button class="tx" data-id="${t.id}">
        <span class="tx-ico" style="background:${c.c}26">${c.e}</span>
        <span class="tx-main"><div class="tx-cat">${c.name}</div>${t.note ? `<div class="tx-note">${esc(t.note)}</div>` : ''}</span>
        <span class="tx-amt ${t.type === 'income' ? 'inc' : ''}">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</span>
      </button>`;
    }
    html += '</div>';
  }
  $('#txList').innerHTML = html;
}

/* ---------- Форма операции ---------- */
let editId = null;
let formType = 'expense';
let formCat = 'food';

function renderCats() {
  $('#catGrid').innerHTML = CATS[formType].map((c) =>
    `<button type="button" class="cat ${c.id === formCat ? 'active' : ''}" data-cat="${c.id}"><span class="e">${c.e}</span>${c.name}</button>`).join('');
}
function setType(type) {
  formType = type;
  if (!CATS[type].some((c) => c.id === formCat)) formCat = CATS[type][0].id;
  document.querySelectorAll('.type-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  renderCats();
}
function openTx(tx) {
  editId = tx ? tx.id : null;
  $('#txFormTitle').textContent = tx ? 'Изменить' : 'Новая операция';
  formCat = tx ? tx.cat : (formType === 'income' ? 'salary' : 'food');
  setType(tx ? tx.type : 'expense');
  $('#amount').value = tx ? String(tx.amount).replace('.', ',') : '';
  // По умолчанию — сегодня, если смотрим текущий месяц, иначе 1-е число выбранного месяца
  const today = isoToday();
  $('#date').value = tx ? tx.date : (today.startsWith(monthKey()) ? today : `${monthKey()}-01`);
  $('#note').value = tx ? tx.note || '' : '';
  $('#deleteTx').hidden = !tx;
  open('#txBackdrop');
  if (!tx) setTimeout(() => $('#amount').focus(), 50);
}

$('#txForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseAmount($('#amount').value);
  if (!(amount > 0)) { toast('Введите сумму'); $('#amount').focus(); return; }
  const date = $('#date').value || isoToday();
  const data = { type: formType, amount, cat: formCat, date, note: $('#note').value.trim() };
  if (editId) Object.assign(state.tx.find((t) => t.id === editId), data);
  else state.tx.push({ id: uid(), created: Date.now(), ...data });
  save();
  // Переключиться на месяц операции
  viewY = +date.slice(0, 4); viewM = +date.slice(5, 7) - 1;
  close('#txBackdrop');
  render();
});
$('.type-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) setType(b.dataset.type); });
$('#catGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { formCat = b.dataset.cat; renderCats(); } });
$('#deleteTx').addEventListener('click', () => {
  if (!confirm('Удалить эту операцию?')) return;
  state.tx = state.tx.filter((t) => t.id !== editId);
  save(); close('#txBackdrop'); render(); toast('Операция удалена');
});

/* ---------- Модальные окна ---------- */
function open(sel) { $(sel).hidden = false; document.body.style.overflow = 'hidden'; }
function close(sel) { $(sel).hidden = true; document.body.style.overflow = ''; }
document.querySelectorAll('.backdrop').forEach((bd) => {
  bd.addEventListener('click', (e) => { if (e.target === bd || e.target.closest('[data-close]')) close('#' + bd.id); });
});

/* ---------- Главный экран ---------- */
$('#addBtn').addEventListener('click', () => openTx(null));
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

/* ---------- Настройки ---------- */
$('#openSettings').addEventListener('click', () => {
  $('#budgetInput').value = state.budget ? String(state.budget).replace('.', ',') : '';
  $('#countInfo').textContent = `Всего операций: ${state.tx.length}`;
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
$('#exportJson').addEventListener('click', () => {
  shareOrDownload(`finance-backup-${isoToday()}.json`, JSON.stringify({ app: 'finance', version: 1, ...state }, null, 1), 'application/json');
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
    state = { tx: valid, budget: +data.budget || 0 };
    save(); render(); close('#setBackdrop'); toast('Данные восстановлены');
  } catch (err) { toast('Файл не похож на резервную копию'); }
});
$('#clearAll').addEventListener('click', () => {
  if (!confirm('Удалить ВСЕ операции? Это нельзя отменить.')) return;
  state = { tx: [], budget: 0 }; save(); render(); close('#setBackdrop'); toast('Все данные удалены');
});

/* ---------- Уведомления ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

/* ---------- Старт ---------- */
load();
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
