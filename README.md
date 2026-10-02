# Kasa

A small offline phone app for keeping a petty-cash log (*kasa*) and printing the monthly cash sheet.

## Why this exists

My father pays for work expenses out of a cash float, and his employer pays him back. Every month he hands the company's accountant a printed cash sheet listing everything he received and spent.

He made that sheet in Excel. Excel was never his tool. Each month he copied the previous month's file and typed every receipt in by hand, and he isn't a fast typist. Because each new month started from a copy of the last one, mistakes crept in. One month's total formula skipped two rows, and a few dates ended up in 2029. It cost him hours every month, and he spent them fighting a spreadsheet.

I wanted to give him that time back and free him from struggling with Excel. Now he logs each receipt on his phone when he gets it, in about ten seconds. At the end of the month he taps one button and gets the finished sheet, already in the layout the accountant knows, with every total calculated for him.

## What it does

- **Quick entry:** the date is preset to today, with one-tap "yesterday" and "2 days ago". Descriptions he has used before are suggested. The number pad opens for the amount.
- **Totals are always calculated:** the balance carried over from last month (*devir*), income, expenses and the remaining cash. There's no "close the month" step to forget.
- **Month-end report:** a PDF in the same two-column layout as the old Excel sheet, continuing onto more pages in a busy month. It opens the phone's share menu, so he sends it to himself on WhatsApp and prints it from the laptop.
- **Works offline:** after the first visit it runs without internet.
- **Private:** all data stays on the phone. Nothing is sent anywhere. The "Yedek al" (back up) button saves a backup file, and "Yedekten yükle" (restore) brings it back on a new or reset phone.

## Using it

1. Open **https://mansurbesleney.github.io/kasa/** in Chrome on an Android phone.
2. In Chrome's menu, choose **Ana ekrana ekle** or **Uygulamayı yükle** (add to home screen / install app).
3. On first launch, enter the report title, the start month and the cash on hand at the start of that month.
4. Take a backup now and then. The app reminds you after 30 days.

## Development

Plain HTML, CSS and JavaScript. There's no build step and no framework. The only library is [pdfmake](https://github.com/bpampuch/pdfmake) 0.3.3, stored in `vendor/`.

```bash
npm test                                  # unit tests + real PDF rendering (Node 22+)
npx --yes http-server -c-1 -p 8080 .      # run locally at http://localhost:8080
```

| File | What it holds |
|---|---|
| `logic.js` | all calculations (no DOM, shared by the app and the tests) |
| `app.js`, `index.html`, `style.css` | the screens |
| `sw.js`, `manifest.webmanifest` | offline support and home-screen install |
| `docs/superpowers/` | the design document and implementation plan |

**Releasing:** bump `VERSION` in `sw.js` with every change, or installed phones keep serving the old files.

Built with the help of [Claude Code](https://claude.com/claude-code).
