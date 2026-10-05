import * as L from './logic.js';

const KEY = 'kasa';
const $ = id => document.getElementById(id);
const entryForm = $('entry-form').elements;

let state = null;
let viewMonth = null;
let editing = null; // { type, id } while the entry screen is open; id is null for a new entry

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    alert(`Kaydedilemedi! Lütfen hemen yedek alın. (${err.message})`);
  }
}

function show(id) {
  for (const s of document.querySelectorAll('body > section')) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const currentMonth = () => L.monthOf(L.todayISO());
const clampMonth = ym => (ym < state.settings.startMonth ? state.settings.startMonth : ym);

function span(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el;
}

// ---- main screen ----

const reportLabel = () => `${L.monthLabel(viewMonth)} raporu oluştur`;

function renderMain() {
  const today = L.todayISO();
  const s = L.monthSummary(state, viewMonth);
  $('month-label').textContent = L.monthLabel(viewMonth);
  $('prev-month').disabled = viewMonth <= state.settings.startMonth;
  $('next-month').disabled = viewMonth >= L.monthOf(today);
  for (const k of ['devir', 'tahsilat', 'harcama', 'kalan']) $(`t-${k}`).textContent = L.formatAmount(s[k]);
  $('t-kalan').classList.toggle('negative', s.kalan < 0);
  $('report').textContent = reportLabel();
  $('reminder').hidden = !L.needsBackupReminder(state, today);

  const items = L.entriesOf(state, viewMonth).reverse().map(e => {
    const li = document.createElement('li');
    li.className = e.type;
    li.dataset.id = e.id;
    const sign = e.type === 'expense' ? '−' : '+';
    li.append(span(L.formatDate(e.date).slice(0, 5)), span(e.desc), span(sign + L.formatAmount(e.amount)));
    return li;
  });
  $('entries').replaceChildren(...items);
  $('empty').hidden = items.length > 0;
  show('main');
}

// ---- entry screen ----

function openEntry(type, entry = null) {
  editing = { type, id: entry ? entry.id : null };
  $('entry-title').textContent = `${entry ? 'Düzenle' : 'Yeni'}: ${type === 'expense' ? 'Harcama' : 'Tahsilat'}`;
  entryForm.date.min = `${state.settings.startMonth}-01`;
  entryForm.date.max = L.todayISO();
  entryForm.date.value = entry ? entry.date : L.todayISO();
  entryForm.desc.value = entry ? entry.desc : '';
  entryForm.amount.value = entry ? L.formatAmount(entry.amount).replaceAll('.', '') : '';
  $('delete-entry').hidden = !entry;
  $('entry-error').textContent = '';
  renderDateChips();
  renderSuggestions();
  show('entry');
}

function renderDateChips() {
  const today = L.todayISO();
  for (const b of document.querySelectorAll('[data-days]')) {
    b.classList.toggle('selected', entryForm.date.value === L.addDays(today, Number(b.dataset.days)));
  }
}

function renderSuggestions() {
  const chips = L.suggestions(state.entries, editing.type, entryForm.desc.value).map(text => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = text;
    b.dataset.suggestion = text;
    return b;
  });
  $('suggestions').replaceChildren(...chips);
}

$('entry-form').addEventListener('submit', ev => {
  ev.preventDefault();
  const date = entryForm.date.value;
  const desc = L.normalizeDesc(entryForm.desc.value);
  const amount = L.parseAmount(entryForm.amount.value);
  const error =
    !L.isAllowedDate(date, state.settings.startMonth, L.todayISO()) ? 'Tarih ileri bir gün ya da başlangıç ayından önce olamaz.'
    : !desc ? 'Açıklama yazın.'
    : amount === null ? 'Tutarı kontrol edin. Örnek: 1250 veya 1250,50 (binlik nokta koymayın).'
    : '';
  if (error) {
    $('entry-error').textContent = error;
    return;
  }
  const entry = { id: editing.id || newId(), type: editing.type, date, desc, amount };
  state.entries = state.entries.filter(e => e.id !== entry.id).concat(entry);
  save();
  viewMonth = L.monthOf(date);
  renderMain();
});

function deleteEntry() {
  if (!confirm('Bu kayıt silinsin mi?')) return;
  state.entries = state.entries.filter(e => e.id !== editing.id);
  save();
  renderMain();
}

// ---- setup screen ----

$('setup-form').addEventListener('submit', ev => {
  ev.preventDefault();
  const f = ev.target.elements;
  const title = f.title.value.trim().toLocaleUpperCase('tr-TR').slice(0, 80);
  const startMonth = f.startMonth.value;
  const opening = L.parseAmount(f.opening.value, true);
  const error =
    !title ? 'Rapor başlığını yazın.'
    : !/^\d{4}-\d{2}$/.test(startMonth) || startMonth > currentMonth() ? 'Başlangıç ayını seçin (ileri bir ay olamaz).'
    : opening === null ? 'Tutarı kontrol edin. Örnek: 17787 veya 17787,50 (binlik nokta koymayın).'
    : '';
  if (error) {
    $('setup-error').textContent = error;
    return;
  }
  state = { version: 1, settings: { title, startMonth, openingBalance: opening }, entries: [] };
  save();
  viewMonth = currentMonth();
  renderMain();
});

// ---- report, backup, restore ----

// Opens Android's share sheet; falls back to a download where file sharing isn't available.
// Returns false only when the person closed the share sheet without sharing.
async function shareFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      // NotAllowedError (the tap "expired" while the file was built): fall through to download
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}

async function createReport() {
  const button = $('report');
  button.disabled = true;
  button.textContent = 'Hazırlanıyor…';
  try {
    const doc = L.reportDoc(L.layoutReport(state, viewMonth), state.settings.title, viewMonth);
    const blob = await pdfMake.createPdf(doc).getBlob();
    await shareFile(blob, `KASA-${viewMonth}.pdf`);
  } catch (err) {
    alert(`Rapor oluşturulamadı: ${err.message}`);
  } finally {
    button.disabled = false;
    button.textContent = reportLabel();
  }
}

let sharing = false;

async function backup() {
  if (sharing) return;
  sharing = true;
  try {
    const today = L.todayISO();
    // .txt, because Chrome's share sheet refuses .json files
    const blob = new Blob([JSON.stringify(state)], { type: 'text/plain' });
    if (await shareFile(blob, `kasa-yedek-${today}.txt`)) {
      state.settings.lastBackup = today;
      save();
      renderMain();
    }
  } finally {
    sharing = false;
  }
}

$('restore-file').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  let data = null;
  try { data = L.validateBackup(JSON.parse(await file.text())); } catch { /* not JSON: handled below */ }
  if (!data) {
    alert('Bu dosya bir kasa yedeği değil. Hiçbir şey değişmedi.');
    return;
  }
  const newest = data.entries.reduce((m, e) => (e.date > m ? e.date : m), '');
  const last = newest ? L.formatDate(newest) : 'yok';
  const now = state ? state.entries.length : 0;
  if (!confirm(`Telefonda ${now} kayıt var. Yedekte ${data.entries.length} kayıt var (son kayıt: ${last}). Telefondaki bilgiler silinip yedektekiler yüklenecek. Devam edilsin mi?`)) return;
  try { if (state) localStorage.setItem('kasa-onceki', JSON.stringify(state)); } catch { /* parking is best-effort */ }
  state = data;
  save();
  viewMonth = clampMonth(currentMonth());
  renderMain();
});

function editTitle() {
  const title = prompt('Rapor başlığı', state.settings.title);
  if (title === null || !title.trim()) return;
  state.settings.title = title.trim().toLocaleUpperCase('tr-TR').slice(0, 80);
  save();
}

// Every month's DEVİR is derived from this, so fixing it fixes all reports.
function editOpening() {
  const label = `${L.monthLabel(state.settings.startMonth)} başındaki kasa (TL)`;
  const text = prompt(label, L.formatAmount(state.settings.openingBalance).replaceAll('.', ''));
  if (text === null) return;
  const opening = L.parseAmount(text, true);
  if (opening === null) {
    alert('Tutarı kontrol edin. Örnek: 17787 veya 17787,50 (binlik nokta koymayın).');
    return;
  }
  state.settings.openingBalance = opening;
  save();
  renderMain();
}

// ---- events ----

const actions = {
  'prev-month': () => { viewMonth = L.shiftMonth(viewMonth, -1); renderMain(); },
  'next-month': () => { viewMonth = L.shiftMonth(viewMonth, 1); renderMain(); },
  'add-expense': () => openEntry('expense'),
  'add-income': () => openEntry('income'),
  'delete-entry': deleteEntry,
  cancel: renderMain,
  report: createReport,
  backup,
  restore: () => $('restore-file').click(),
  settings: editTitle,
  opening: editOpening,
};

document.addEventListener('click', ev => {
  const t = ev.target;
  const action = t.closest('[data-action]');
  if (action) return actions[action.dataset.action]?.();
  const day = t.closest('[data-days]');
  if (day) {
    entryForm.date.value = L.addDays(L.todayISO(), Number(day.dataset.days));
    return renderDateChips();
  }
  const suggestion = t.closest('[data-suggestion]');
  if (suggestion) {
    entryForm.desc.value = suggestion.dataset.suggestion;
    renderSuggestions();
    return entryForm.amount.focus();
  }
  const li = t.closest('#entries li');
  if (li) {
    const e = state.entries.find(x => x.id === li.dataset.id);
    openEntry(e.type, e);
  }
});
entryForm.desc.addEventListener('input', renderSuggestions);
entryForm.date.addEventListener('change', renderDateChips);

// ---- start ----

function start() {
  const raw = localStorage.getItem(KEY);
  if (raw !== null) {
    try { state = L.validateBackup(JSON.parse(raw)); } catch { state = null; }
    if (!state) {
      // Never silently lose data: park the unreadable copy under another key.
      try { localStorage.setItem(`${KEY}-bozuk-${Date.now()}`, raw); } catch { /* quota: still show the message */ }
      $('setup-error').textContent = 'Kayıtlı bilgiler okunamadı. "Yedekten yükle" ile son yedeğinizi yükleyin.';
    }
  }
  if (state) {
    viewMonth = clampMonth(currentMonth());
    renderMain();
  } else {
    $('setup-form').elements.startMonth.value = currentMonth();
    show('setup');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  try {
    const s = L.validateBackup(JSON.parse(localStorage.getItem(KEY)));
    if (s) { state = s; if (!$('main').hidden) renderMain(); }
  } catch { /* keep in-memory state */ }
});

navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
start();
