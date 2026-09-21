# Kerzenkalkulator

A small phone-first web app for makers of dessert candles. Pick a container, a wax and a fragrance oil, and it tells you how much wax and oil you need and what the candle costs to make.

**Live app:** https://xchristianhoffmannx-bot.github.io/kerzenkalkulator/

The interface is in German. It is a Progressive Web App (PWA): open it in Chrome on Android, choose *Install app* or *Add to Home screen*, and it works offline, for example at a market stall.

## Features

- **Wax amount** from container volume, fill level and wax density.
- **Fragrance oil amount** as a percentage of wax weight, shown in grams and millilitres. A warning appears if the percentage exceeds the wax's maximum.
- **Containers**, round or rectangular. Enter the volume in ml, or the dimensions and let the app calculate it. If ml is filled in, it takes precedence.
- **Cost breakdown** for wax, fragrance oil, container and any extras (wick, decoration, label, packaging).
- **Selling price** with an optional percentage markup on material cost, rounded to the nearest 0.50 €.
- **Batch quantity** for a shopping list: total wax in kg, oil in ml, cost and revenue for N candles.
- **Recipes:** save a calculation and recalculate it for a different container with one tap.
- **Backup and restore** of all data as a JSON file.
- **Selling checklist** in the info dialog (labelling and product safety reminders).

## Defaults

The wax list is pre-filled with typical values: soy, coconut-soy, rapeseed, paraffin and gel wax, each with a density, a standard fragrance percentage and a maximum. The default fill level is 75 %, which suits dessert candles where the wax base fills about three quarters of the glass.

Wax, oil and container prices are left empty. Enter your own; the app warns you while any are missing.

These values are starting points based on supplier guidance and general candle-making references. Always check your wax and fragrance oil data sheets.

## Your data

Everything is stored locally in the browser (`localStorage`). There is no account and nothing is sent to a server. If you clear the browser's site data, it is gone, so use **Sichern** (backup) in the info dialog regularly.

## Assumptions

- Fragrance oil is assumed to weigh 0.95 g/ml when converting grams to millilitres. The oil cost is calculated per ml.
- Rounding goes to the nearest 0.50 €. With the markup switched off, the rounded price can end up slightly below the material cost.

## Selling notice

The checklist in the app is a reminder, not legal advice. Dessert candles that look like food can raise product safety issues, and candles must carry appropriate warnings and labelling. Check the rules that apply to you before you sell.

## Development

No build step and no dependencies. Plain HTML, CSS and JavaScript.

```
index.html      UI and styles
app.js          calculation logic (pure functions) and UI code
sw.js           service worker for offline use
manifest.json   PWA manifest
test.js         checks for the calculation logic
```

Run the checks:

```bash
node test.js
```

Serve it locally:

```bash
python -m http.server 8123
```

When you change any file, bump the cache version `V` in `sw.js`, otherwise installed copies keep showing the old version.

## Deployment

The app is served with GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / root*.
