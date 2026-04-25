# iOS Shortcut: "Hey Siri, What's Hot?"

Build a Siri Shortcut in under 10 minutes that reads aloud the top trending meme stocks.

---

## What you'll build

A Shortcut that:
1. Fetches the top 10 trending stocks from the Meme Radar public API
2. Reads them aloud via Siri (ticker + velocity)
3. Can be triggered with "Hey Siri, what's hot?" or a Home Screen tap

---

## API endpoint

```
GET https://thememeradar.com/api/public/v1/stocks/trending?timeframe=24h
```

No API key needed. Returns JSON:
```json
{
  "success": true,
  "data": {
    "trending": [
      { "ticker": "GME", "velocity": 193, "sentimentCategory": "bullish" }
    ]
  }
}
```

---

## Step-by-step Shortcut actions

Open the **Shortcuts** app on your iPhone (iOS 16+) and tap **+** to create a new Shortcut.

### Action 1 — Get Contents of URL

- Add action: **Get Contents of URL**
- URL: `https://thememeradar.com/api/public/v1/stocks/trending?timeframe=24h`
- Method: **GET**
- Leave all other fields blank (no headers or body needed)

### Action 2 — Get Dictionary Value

- Add action: **Get Dictionary Value**
- Get: **Value**
- Key: `data`
- From: **Contents of URL** (the result of Action 1)

> This extracts the `data` object from the response envelope.

### Action 3 — Get Dictionary Value (trending array)

- Add action: **Get Dictionary Value**
- Get: **Value**
- Key: `trending`
- From: **Dictionary Value** (result of Action 2)

> This gives you the array of trending stocks.

### Action 4 — Get Items from List

- Add action: **Get Items from List**
- Get: **First Item** through **10th Item**
- From: **Dictionary Value** (result of Action 3)

> Optional: adjust to fewer items (e.g. First 5) for a shorter Siri readout.

### Action 5 — Repeat with Each

- Add action: **Repeat with Each Item** in **List** (result of Action 4)
- Inside the repeat loop, add two actions:

#### 5a — Get Dictionary Value (ticker)

- Get: **Value** for Key: `ticker`
- From: **Repeat Item**

#### 5b — Get Dictionary Value (velocity)

- Get: **Value** for Key: `velocity`
- From: **Repeat Item**

#### 5c — Text (build the spoken line)

- Add action: **Text**
- Text value (tap the field and insert variables):
  ```
  [Dictionary Value (ticker)] — velocity [Dictionary Value (velocity)] percent
  ```

#### 5d — Speak Text

- Add action: **Speak Text**
- Text: **Text** (result of 5c)
- Language: **Default**
- Wait Until Finished: **On**

### Action 6 — End Repeat

The Repeat block ends automatically. You're done.

---

## Name & Siri phrase

1. Tap the Shortcut name at the top (defaults to "New Shortcut")
2. Rename it: **"What's Hot"**
3. Tap **Add to Siri** and record the phrase: *"What's hot"*

Now say: **"Hey Siri, what's hot"** — Siri runs the Shortcut and reads the top trending tickers aloud.

---

## Tips

- **Home Screen widget**: Long-press the Home Screen → tap **+** → search "Shortcuts" → add the medium widget and pin *What's Hot* to it.
- **Shorter readout**: In Action 4, change "10th Item" to "5th Item" for a 15-second read instead of 30 seconds.
- **Add price data**: In Action 5c, include `price` from the dictionary:
  ```
  [ticker] at $[price], velocity [velocity] percent
  ```
- **Automation**: In the Shortcuts app, tap **Automation** → **+** → set a time trigger (e.g. every morning at 9 AM) to run the Shortcut automatically.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Siri says "I can't run that Shortcut" | Make sure the Shortcut is in **My Shortcuts**, not iCloud |
| No data / empty list | Check internet connection; the API has a 60 req/min rate limit per IP |
| Velocity reads as a long decimal | The API returns integers — if you see decimals, use **Round Number** (round to 0 decimals) before Speak Text |

---

## Mobile web alternative

If you just want a quick glance without Siri, open **[https://thememeradar.com/m](https://thememeradar.com/m)** — it's a text-only page optimised for 3G that loads in under 500ms. Save it as a Home Screen bookmark for one-tap access.
