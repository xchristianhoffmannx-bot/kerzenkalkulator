# Kerzenkalkulator

A small phone-first web app for makers of dessert candles. Pick a container, a wax and a fragrance oil, and it tells you how much wax and oil you need and what the candle costs to make.

**Live app:** https://xchristianhoffmannx-bot.github.io/kerzenkalkulator/

The interface is in German. It is a Progressive Web App (PWA): open it in Chrome on Android, choose *Install app* or *Add to Home screen*, and it works offline, for example at a market stall.

## Screens

The app opens on a start screen with four buttons:

- **Zubehör** (supplies): containers, waxes and fragrance oils with their prices.
- **Schneller Preis** (quick price): pick a container, enter the weight of the candle with its glass and the fragrance percentage, and see the cost and price straight away.
- **Wachs & Duftöl**: how much wax and oil a candle needs, by container or by weight, with mixed waxes, extras and saved recipes.
- **Meine Kerzen**: a photo gallery. Each photo can carry an optional name, fragrance oil and percentage.

## Features

- **Wax amount** from container volume, fill level and wax density.
- **Weight mode:** enter only the total candle weight and the fragrance percentage. Total = wax + oil, the percentage refers to the wax weight.
- **Wax blends:** add further wax types with their share in %. The first wax gets the remainder up to 100 %. Density is mixed by weight, cost is calculated per wax, and the warning uses the lowest fragrance maximum in the blend.
- **Fragrance oil amount** as a percentage of wax weight, shown in grams and millilitres. A warning appears if the percentage exceeds the wax's maximum.
- **Containers**, round or rectangular. Enter the inner dimensions and the app calculates the volume. Also enter the empty weight of the glass.
- **Weigh-back:** enter the weight of the finished candle and the app subtracts the empty glass to show how much wax and oil was actually used, and the deviation from the calculation.
- **Cost breakdown** for wax, fragrance oil, container and any extras (wick, decoration, label, packaging).
- **Selling price** with an optional percentage markup on material cost, rounded to the nearest 0.50 €.
- **Batch quantity** for a shopping list: total wax in kg, oil in ml, cost and revenue for N candles.
- **Recipes:** save a calculation and recalculate it for a different container with one tap.
- **Photos** are shrunk to 900 px and stored in the browser's IndexedDB, not in localStorage.
- **Backup and restore** of all data, photos included, as one JSON file.
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
