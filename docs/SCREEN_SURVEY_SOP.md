# SOP — Screen survey (TV model + power rating)

**Who:** whoever installs or next visits a partner store.
**Time:** about two minutes per store.
**Why it matters:** the electricity figure shown to the partner is `watts × measured
on-hours × tariff`. We measure the hours exactly. The watts are a **guess** until
someone does this survey — and a wrong guess is not a small error: a 32" LED draws
~40 W and a 43" ~80 W, so an unsurveyed store's estimate can be off by 2×. Every store
still on the fleet default is flagged in Admin → Power.

---

## What to capture

### 1. The model plate
The sticker on the **back** of the TV with the model number. Usually near the bottom
edge or beside the ports.

- Fill the frame with the sticker, not the whole TV.
- Model number must be readable — that is the whole point of the photo.
- Use flash if the back panel is dark. Wipe dust off first.

### 2. The power rating label
Often the **same** sticker, sometimes a separate one. Look for a line reading
`Power Consumption`, `POWER`, or a figure in watts:

```
Power Consumption : 65 W
Rated Input       : 100-240V ~ 50/60Hz  1.2A
```

- Photograph so the **watt figure is legible**.
- If there is no watt figure but there is `V` and `A`, photograph it anyway and
  note both — watts ≈ volts × amps (e.g. 240 V × 0.4 A ≈ 96 W). Flag it in the note
  so someone checks; that multiplication is an upper bound, not the typical draw.
- If the label is unreachable (wall-mounted, cannot be tilted), photograph the
  **front** with the screen size visible and write the size in the model field. Do not
  invent a wattage — leave it blank and let the fleet default stand, so the store stays
  visibly flagged as unsurveyed rather than being wrong-but-confident.

### 3. Type in the wattage
In Admin → Power, open the store and enter:

| Field | What to put |
|---|---|
| Screen model | Exactly as printed, e.g. `Mi TV 4A Horizon L32M6-EI` |
| Power (W) | The rated figure, e.g. `65`. Leave blank if genuinely not found. |
| Model plate photo | Photo 1 |
| Rating label photo | Photo 2 |

Saving stamps the survey date and immediately switches that store's estimate from the
fleet default to the real figure.

---

## Rules

- **Never guess a wattage.** A blank field is honest and stays flagged; a made-up
  number silently becomes a rupee figure the partner sees.
- **Do not photograph anything else in the shop.** Only the two labels. If a person
  appears in frame, retake it.
- **Include the ALIVE player box only if asked** — its draw (~5 W) is already inside
  the fleet default.
- Redo the survey if a partner **replaces the TV**. The estimate silently follows the
  old figure otherwise.

---

## What the partner sees

The store dashboard shows, for the current month: estimated units used, the rupee
value at the current tariff, the wattage it was calculated from, and — once surveyed —
the photos, so the partner can check the figure against the label themselves.

It is labelled **Estimated** everywhere it appears. Reimbursement is settled
separately (clause 3.3 of the partner agreement); this is transparency about the
screen's running cost, not a bill.
