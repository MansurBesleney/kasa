# Kasa: offline petty-cash report app

Date: 2026-10-02
Status: draft, awaiting review

## Purpose

The user's father pays work expenses from a petty-cash float and is reimbursed by
his employer. Every month he hands a printed cash sheet (*günlük kasa fişi*) to the
company accountant.

Today he builds that sheet in Excel by copying last month's file. He doesn't know
Excel well, so copying causes mistakes, and he types slowly. The September 2026
sheet had a total formula that missed two rows (1,965 TL short) and five dates
typed in 2029.

**Success means:**
- He logs each receipt on his phone in about 10 seconds, on the day or a day or two later.
- At month end he gets a correct, print-ready PDF in the familiar layout, without opening Excel.
- Totals and the carried-over balance are always calculated, never typed in.
- No hosting costs.

## What we know (from the user)

- He has an Android phone and a work laptop.
- The accountant receives **paper only**. No Excel file is needed.
- He prints from the work laptop. The PDF travels phone → WhatsApp (sent to himself) → WhatsApp Web on the laptop → printer.
- He enters receipts daily, sometimes every two days.
- Hosting: GitHub Pages, free.
- Storage: the browser's built-in storage plus a manual backup file. SQLite was rejected because in a browser it also lives in browser storage.
- It must cope with more entries than one page holds.

## Form

A Progressive Web App (PWA): static HTML, CSS and JavaScript with no build step and
no framework, served by GitHub Pages. He installs it once with Chrome's "Add to
Home screen". After that it opens full-screen and works fully offline.

All data stays on the phone. The host only serves the code.

## Data model

Everything is stored as one JSON object under a single `localStorage` key, rewritten
on every change. The data is small (roughly 50 entries a month).

```js
{
  version: 1,
  settings: {
    title: "…",           // PDF heading, entered at setup (keeps the employer name out of the public repo)
    startMonth: "2026-10", // first month tracked
    openingBalance: 1778700 // kuruş: cash on hand at the start of startMonth
  },
  entries: [
    { id: "…", type: "income" | "expense", date: "2026-10-03", desc: "İÇME SUYU", amount: 84000 }
  ]
}
```

- **Amounts are integer kuruş** (1 TL = 100 kuruş), so there are no rounding errors with decimals.
- **Months are derived from entry dates.** There is no "close month" action, so he can't forget one or do it in the wrong order. The carried-over balance (DEVİR) for month M is: `openingBalance + all income before M − all expenses before M`. Editing an old entry automatically corrects every later month.
  - This replaces the "Yeni ay başlat" button from the in-chat design: same result, one less step, one less way to go wrong.
- Descriptions are converted to Turkish uppercase on save (`toLocaleUpperCase('tr-TR')`, so i → İ), matching the current sheet.

## Screens (all text in Turkish)

### First run (setup)
He enters the report title, the start month, and the opening cash amount, for
example 17.787,00 for October 2026 (September's GENEL TOPLAM).

### Main screen
- A month switcher (`‹ EKİM 2026 ›`), defaulting to the current month.
- Totals: Devir, Tahsilat, Harcama, and **Kalan** shown largest. Kalan can be negative; it's shown in red when it is.
- Two large buttons: **+ Harcama** (expense) and **+ Tahsilat** (income).
- The month's entries, newest first. Tapping one opens it for editing, with a delete option (asks for confirmation).
- **Rapor oluştur** (create report) for the month being viewed.
- A small menu: **Yedek al** (back up), **Yedekten yükle** (restore), **Ayarlar** (settings: title).

### Add / edit entry (shared by expenses and income)
- **Date:** buttons for Bugün / Dün / 2 gün önce (today / yesterday / 2 days ago), with today selected. "Başka tarih" (another date) opens a native date picker.
  - Allowed range: from the start of startMonth up to today. **Future dates are rejected**, which prevents typos like the 2029 dates.
- **Description:** a text field with up to 5 tappable suggestions below it. Suggestions come from earlier descriptions of the same type, filtered by what he has typed and ordered by how often he's used them. The keyboard's voice input works as normal.
- **Amount:** uses `inputmode="decimal"` so the number pad opens. It accepts digits with an optional single `,` or `.` decimal separator and at most 2 decimals; anything else is rejected with a message. For example, "1.250" is rejected rather than guessed at. The amount must be greater than 0.
- A large **Kaydet** (save) button.

## PDF report

The PDF is built on the phone with **pdfmake**. Its built-in Roboto font covers the
Turkish letters. The library files are stored in the repo (`vendor/`), not loaded
from a CDN, so the app works offline.

Layout (A4 landscape), matching the current sheet:
- **Header:** the title in bold, centred; the last day of the month (dd.mm.yyyy) on the right.
- **Two columns side by side**, each a bordered 3-column table: TARİH | description | TUTAR.
- **Order:** first a TAHSİLATLAR section:
  - row 1 is `<PREVIOUS MONTH> AYINDAN DEVİR` (carried over from the previous month), dated the 1st of the month;
  - then the month's income entries.

  Then a HARCAMA section with the expenses, sorted by date. Content fills the left column, then the right column, then continues on the next page.
- **KASA DURUMU block** (cash summary) after the last expense: DEVİR, TAHSİLAT (all income this month), TOPLAM, HARCAMA, GENEL TOPLAM (= TOPLAM − HARCAMA).
  - If it doesn't fit in the current column, it moves to the next column or page.
  - Section headers are never left alone at the bottom of a column.
- **Formats:** amounts as `#.##0,00` (tr-TR), dates as `dd.mm.yyyy`.

Pagination is a pure function, `layoutReport(month) → pages[{ left: rows[], right: rows[] }]`,
with a fixed number of rows per column. pdfmake only draws the result.

**Delivery:** `navigator.share({ files: [pdf] })` opens Android's share sheet (WhatsApp
etc.). If file sharing isn't supported (for example on a desktop browser while
developing), the PDF is downloaded instead. The filename is `KASA-2026-10.pdf`.

## Data safety

- On startup the app calls `navigator.storage.persist()`, so Chrome won't delete the data on its own when space runs low.
- **Yedek al** shares `kasa-yedek-YYYY-MM-DD.json` through the same share sheet. He sends it to himself on WhatsApp.
- **Yedekten yükle** uses a file picker. It checks the file's structure and asks for confirmation before replacing the current data. A file that fails the check changes nothing.
- The main screen shows a gentle reminder if no backup has been taken for over 30 days.

## Offline and updates

- A service worker caches every app file (cache-first). The cache name includes a version that is increased on every deploy.
- A new version installs in the background and takes effect the next time he opens the app.
- `manifest.webmanifest` provides the name, icon, `display: standalone` and the theme colour.

## Files

```
index.html              screens and markup
style.css               large touch targets, readable on a small phone
app.js                  UI wiring: rendering, forms, share, storage I/O
logic.js                pure functions: balances, month filtering, suggestions,
                        amount parsing/formatting, report layout, backup validation
sw.js                   offline cache
manifest.webmanifest
icon.png
vendor/pdfmake.min.js, vendor/vfs_fonts.js
test/logic.test.js      node --test (Node's built-in test runner, no dependencies)
```

`logic.js` is an ES module with no DOM access, so the browser and Node load the same file.

## Testing

- **Automated** (`node --test`) for `logic.js`:
  - balance and carry-over across months, including edits to past months;
  - parsing amounts ("12,5" → 1250, "1.250" rejected, "0" rejected);
  - rejecting future dates and dates before the start;
  - suggestion ranking;
  - pagination: small month, exactly one page, overflow to a second page, summary block moved to the next column;
  - backup validation (accepts good files, rejects bad ones).
  - A regression check uses the September 2026 data: expenses total 36.042,00, and with DEVİR 2.429 + TAHSİLAT 51.400 the GENEL TOPLAM is 17.787,00.
- **Manual, on his real phone:** install from GitHub Pages, then switch on airplane mode and add an entry, create a report and share it to WhatsApp, open it on the laptop through WhatsApp Web and print it, then back up, clear the site data, and restore.

## Repository and privacy

- The GitHub repo is public (required for free GitHub Pages), so **no real data or employer name goes in it.**
  - `*.xlsx` is in `.gitignore`.
  - The report title is entered in the app and stored only on the phone.
- Test data uses the September amounts with generic descriptions.

## Out of scope (add only if needed)

- Receipt photos.
- Syncing across several devices or users.
- Excel export.
- Expense categories.
- Warning when editing a month that has already been handed in.
