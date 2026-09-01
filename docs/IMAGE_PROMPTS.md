# ALIVE — image brief & generation prompts

Every image slot on the marketing site, with a prompt written to be pasted into an
image generator (Midjourney / Firefly / Imagen / Higgsfield) or handed to a
photographer as a shot list.

The current library is stock — generic aisles, generic shopfronts, mismatched grading.
That is why it doesn't read as premium: the pictures are *of* the category rather than
*of this company*. Everything below is written to fix that in one pass.

---

## 0. The house style — prepend to every prompt

Prompts below assume this block. Keep it identical across all eleven so the set looks
like one shoot rather than eleven downloads.

```
Editorial documentary photograph, natural available light, shot on 35mm full-frame,
50mm lens at f/2.0, shallow but honest depth of field. Muted warm-neutral grade:
deep charcoal shadows, unclipped warm highlights, low saturation overall EXCEPT a
single deliberate red accent. Fine natural film grain. No HDR, no glow, no lens flare,
no vignette. Real Indian neighbourhood retail, present day, unstaged and unglamorous
but composed with care. Candid — nobody posing or looking at the camera.
```

**Negative prompt (all images):**
```
no stock-photo smiles, no thumbs up, no people looking at camera, no crowded collage,
no oversaturated colours, no teal-and-orange grade, no neon, no lens flare, no bokeh
balls, no plastic skin retouching, no western supermarket, no fake brand logos, no
readable invented text, no watermark, no cluttered signage, no wide-angle distortion,
no AI gloss
```

### Non-negotiables
- **One red accent per frame, and only one.** The ALIVE red (`#dc2626`) is the brand's
  only loud colour — a screen bezel glow, a crate, a sari edge. If the frame already
  has competing reds, it fights the UI.
- **Negative space on the side the text sits.** These are backgrounds for type, not
  hero art. Compose with an empty third.
- **Real kirana scale.** Indian neighbourhood shops are small, dense, vertical,
  fluorescent-lit. Anything that looks like a Western convenience store is wrong.
- **No invented brand packaging.** Keep real-looking product blurred or out of focus;
  never generate fake logos of real FMCG brands.
- **Never generate a fake ALIVE screen showing a fake ad.** Where a screen appears,
  it should be off, dim, or showing an abstract red/neutral field — real creatives get
  composited later. A generated ad on a generated screen is a fabricated product claim.

### Delivery spec
| | |
|---|---|
| Format | AVIF or WebP (site uses `next/image`) |
| Long edge | 2400px |
| Quality target | under 300 KB each after conversion |
| Colour | sRGB |

---

## 1. Hero — rotating screen, "Brand" state
`/for-brands.jpg` · **3:4 portrait** · appears inside the on-screen device frame and
again as the Audience 01 card

```
Editorial documentary photograph […house style…]. Interior of a small Indian kirana
store seen from just behind the counter, looking out toward the shopfront. Shelves
packed floor to ceiling with everyday household goods, deliberately out of focus.
Foreground sharp on the worn wooden counter edge. Warm afternoon light entering from
the street, cool fluorescent tube overhead. Single red accent: a stack of red plastic
crates at the left edge. Upper-right third intentionally empty and darker for text.
Nobody in frame. Quiet, ordinary, mid-afternoon.
```

## 2. Hero — "Kirana" state
`/kirana-best-practice.jpg` · **3:4 portrait** · also the Voices card for Ramesh Kumar

```
Editorial documentary photograph […house style…]. A kirana shop owner in his fifties
at his counter, mid-task — counting change, half-turned away from camera, face partly
obscured. Weathered hands in focus. Ledger book, calculator, glass jars of sweets on
the counter. Shop interior warm and dim behind him. Single red accent: a red thread
bracelet on his wrist. Candid, dignified, unposed — a working portrait, not a
testimonial headshot. Left third empty for text.
```

## 3. Hero — "Consumer" state
`/india-street.jpg` · **3:4 portrait** · also the Audience 03 card

```
Editorial documentary photograph […house style…]. A narrow Indian neighbourhood
market street at dusk, shot from standing height. Shopfronts glowing warm on both
sides, a woman with a cloth bag walking away from camera, motion-blurred slightly.
Wet ground reflecting shop light after rain. Single red accent: one shop's red awning
mid-frame. Deep perspective down the street. Upper third — sky between buildings —
open and dark for text. Nobody facing camera.
```

## 4. Story section — the product in place
`/alive-product-shot.png` · **3:2 landscape** · captioned "Live · Attavar, Mangalore"

The single most important image on the site: it is the only one that shows what ALIVE
physically *is*.

```
Editorial documentary photograph […house style…]. A small 32-inch digital screen
mounted high on the wall directly above a kirana shop counter, angled slightly down
toward customers. Shot from customer eye level looking up. The screen is powered but
showing only a soft neutral field — no advertisement, no text. Shop shelving and
hanging sachet strips frame it. Warm shop light below, cool screen glow above.
Single red accent: the thin red status LED on the screen's lower bezel. Composition
leaves the right third open. Clean, installed, permanent-looking — not a prototype
taped to a wall.
```

## 5. Audience 02 card — the shelves
`/kirana-shop.jpg` · **4:5 portrait**

```
Editorial documentary photograph […house style…]. Tight three-quarter view of a
kirana shop's shelf wall — tins, pulses in jars, sachet strips hanging in rows,
stacked soap bars. Dense, orderly, genuinely stocked. Shallow focus falling off to
the right. Overhead fluorescent light. Single red accent: one red-lidded jar at the
optical centre. No readable branding — keep all packaging soft-focus or generic.
No people. Texture and abundance is the subject.
```

## 6. Voices — brand manager
`/store-shelf.jpg` · **1:1 square** · quote from Priya Menon, FMCG brand manager

```
Editorial documentary photograph […house style…]. A woman in her thirties in smart
casual office wear standing in a kirana shop aisle, holding a product and examining
the shelf — clearly a professional visiting, not shopping. Three-quarter back view,
face in partial profile, not looking at camera. Shop shelving crisp behind her,
foreground softly out of focus. Single red accent: her red-strapped wristwatch.
Square crop, subject slightly left of centre.
```

## 7. Voices — shopper
`/store-aisle.jpg` · **1:1 square** · quote from Aanya Sharma, shopper

```
Editorial documentary photograph […house style…]. A young woman in a kirana shop
looking upward and slightly off-camera at something above the counter, mild curiosity
on her face, one hand resting on the counter edge. Shot from her side. Shop interior
warm and busy behind, out of focus. Single red accent: red trim on her kurta.
Square crop. The look upward is the point — she is noticing the screen — but the
screen itself must NOT be in frame.
```

## 8. Voices — field lead
`/alive-after.png` · **1:1 square** · quote from Vikram Patel, field lead

```
Editorial documentary photograph […house style…]. A young field technician kneeling
beside an open cardboard box on a kirana shop floor, unpacking a flat screen and a
small media player. Cable coil, screwdriver, mounting bracket beside him. Shot from
above and behind his shoulder — he is absorbed in the task, face not visible. Shop
counter legs and shelving in the background. Single red accent: red handle on the
screwdriver. Square crop. Real installation work, mid-job, slightly untidy.
```

## 9–10. Before / after slider
`/alive_before.png` and `/alive_after.png` · **matched pair, identical framing**

The one part of the site you already rate — so the brief is to preserve exactly what
works and only lift the craft. **These two must be the same shot, same camera position,
same light, same grade.** If the framing shifts even slightly the slider breaks the
illusion and the comparison stops being credible.

**Before:**
```
Editorial documentary photograph […house style…]. Kirana shop counter photographed
straight-on from customer position. The wall above the counter is bare — old paint,
a faded calendar, a small mirror. Everything else in the frame is ordinary and
stocked. Warm shop light. No red accent in this frame. Locked-off composition, exact
centre framing, tripod height 1.5m.
```

**After — identical in every respect except the wall:**
```
[Exactly the same frame, same lighting, same grade.] The bare wall above the counter
now carries a mounted digital screen, powered, showing a soft neutral field. The
calendar and mirror are gone; nothing else in the frame has moved by a millimetre.
Single red accent: the screen's thin red status LED.
```

## 11. Store map / coverage backdrop
`/store-aisle.jpg` alternate use · **16:9 landscape** · sits behind coverage copy

```
Editorial documentary photograph […house style…]. High wide view down an Indian
neighbourhood market lane at golden hour, rooftops and shop awnings receding into
haze. Shot from a first-floor balcony. Human scale visible but no individual
identifiable. Single red accent: one red awning in the middle distance. Wide 16:9
crop with the lower half quiet enough to carry text. Warm, hazy, expansive — the
network's territory, not any one shop.
```

---

## If you commission photography instead

The same list works as a shot list. Two days in Mangaluru covers all eleven: one day
across three partner stores for 1, 2, 4, 5 and the before/after pair, one day of
street and market work for 3 and 11. Voices (6, 7, 8) should ideally be real
partners and real field staff rather than models — the site names them, and a stock
face beside a named quote is the exact thing that reads as inauthentic.

Get signed model releases for anyone recognisable, especially partners, since these
run on a commercial site.
