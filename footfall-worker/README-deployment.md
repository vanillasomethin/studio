# ALIVE Footfall System — Per-Store Deployment

Two ESP32-S3 (N16R8) nodes per store, both powered from a USB port on the
in-store TV — **zero on-premise infrastructure** (no Pi, no local broker,
no on-site server). Both nodes talk directly to HiveMQ Cloud over MQTT/TLS
(8883); the `footfall-worker` process (Railway) consumes those topics and
writes to the same Postgres database as the studio app.

## Prerequisites

- HiveMQ Cloud cluster created, with credentials for:
  - the two ESP32 nodes (or one shared device credential — see note below)
  - the `footfall-worker` process
- Store WiFi SSID/password
- A `store_id` (the `Store.id` cuid from the studio database — find it in
  Admin → Kirana partners)
- `footfall-worker` already deployed on Railway and subscribed (see
  [Worker deploy](#worker-deploy) below) — heartbeats won't show up in
  `device_health` until it's running

## Per-store checklist

### 1. Flash RuView (CSI node)

1. Connect ESP32-S3 #1 via USB to your laptop.
2. Open the RuView Chrome web flasher, select the generic firmware image,
   and flash.
3. Run the provisioning script to write this store's config into NVS
   (zero recompile):

   ```bash
   python3 firmware/provision.py \
     --port /dev/ttyUSB0 \
     --store-id <store_id> \
     --wifi-ssid "<store wifi ssid>" \
     --wifi-password "<store wifi password>" \
     --mqtt-host "<cluster-id>.s1.eu.hivemq.cloud" \
     --mqtt-username "<mqtt username>" \
     --mqtt-password "<mqtt password>" \
     --ota-password "<ota password>"
   ```

   See `firmware/ruview-store.cfg` for the full set of values this writes.

### 2. Flash ESPresense (BLE node)

1. Connect ESP32-S3 #2 via USB.
2. Open the [ESPHome web installer](https://web.esphome.io).
3. Copy `firmware/espresense-store.yaml`, fill in the `substitutions` block
   (or supply a per-store `secrets.yaml` with `store_wifi_ssid`,
   `store_wifi_password`, `mqtt_host`, `mqtt_username`, `mqtt_password`,
   `ota_password`), and set `store_id` to this store's id.
4. Compile + install via the web installer.

### 3. Physical install

- Plug both ESP32-S3 boards into spare USB ports on the in-store TV
  (powers them; no other wiring needed).
- Position RuView near the store entrance / main aisle for best CSI
  coverage of customer flow.
- Position the ESPresense node centrally for balanced BLE coverage.

### 4. Verify on HiveMQ console

In the HiveMQ Cloud web console → **MQTT Websocket Client**, subscribe to
`alive/<store_id>/#` and confirm you see, within a couple of minutes:

- `alive/<store_id>/device/ruview_heartbeat`
- `alive/<store_id>/device/espresense_heartbeat`
- `alive/<store_id>/ble/device_count`

### 5. Confirm in studio admin

Open **Admin → Footfall**, select this store:

- **Sensor nodes** card shows both RuView and ESPresense as online (green
  dot) — backed by `GET /api/health/:storeId`, sourced from
  `StoreSensorHealth` rows the worker upserts on every heartbeat.
- **Calibration status** reads `calibrating` between 06:00–07:00 IST on
  first day, then `calibrated` once the baseline noise floor has been
  recorded.
- Once calibrated and during store hours (06:00–23:00 IST), CSI arrivals
  start appearing in the **Hourly footfall** chart as either confirmed
  (red) or unconfirmed/CSI-only (light) bars.

### 6. Store live

Once steps 1–5 are all green, the store is fully live on the footfall
system. No further action needed — both nodes self-report via heartbeat
every 60s, and `footfall-worker` reconnects to HiveMQ automatically
(exponential backoff, capped at 5 min) if connectivity drops.

---

## Worker deploy

`footfall-worker/` is a standalone Node 20+ process — deploy it to Railway
(or any always-on host; it cannot run on Vercel serverless since it holds a
persistent MQTT connection).

1. `cd footfall-worker && npm install`
2. Copy `.env.example` → `.env` and fill in:
   - `DATABASE_URL` — same Neon Postgres as studio
   - `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` — HiveMQ Cloud credentials
3. `npx prisma generate`
4. `npm start`

The Prisma schema in `footfall-worker/prisma/schema.prisma` is a small
subset of the main studio schema (same tables, same `DATABASE_URL`) — see
the comment at the top of that file if you add fields to the footfall
models in studio's `prisma/schema.prisma`.

## Security notes

- All MQTT traffic is TLS on port 8883 — plaintext 1883 is never used.
- ESPresense publishes anonymous aggregate BLE counts only — no raw MAC
  addresses, no PII.
- OTA on both nodes is password-protected.
- All new REST endpoints (`/api/footfall/*`, `/api/health/*`,
  `/api/presence/*`) require `admin-password` (or, for
  `/api/presence/:campaignId`, the owning brand's session) — same auth
  model as the rest of the admin API.
