import 'dotenv/config';

function num(name, fallback) {
  const v = process.env[name];
  return v == null || v === '' ? fallback : Number(v);
}

function str(name, fallback) {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}

export const config = {
  mqtt: {
    url:         str('MQTT_URL', 'mqtts://localhost:8883'),
    username:    str('MQTT_USERNAME', ''),
    password:    str('MQTT_PASSWORD', ''),
    topicPrefix: str('MQTT_TOPIC_PREFIX', 'alive'),
    // Exponential backoff for reconnection, capped at 5 minutes.
    reconnectMinMs: 2000,
    reconnectMaxMs: 5 * 60 * 1000,
  },

  storeHours: {
    start: str('STORE_HOURS_START', '06:00'),
    end:   str('STORE_HOURS_END', '23:00'),
  },

  fusion: {
    bleCorroborationWindowMs: num('BLE_CORROBORATION_WINDOW_MS', 10_000),
    highConfidenceThreshold:  num('HIGH_CONFIDENCE_THRESHOLD', 0.85),
  },

  staffExclusion: {
    dwellMs:      num('STAFF_DWELL_MS', 2 * 60 * 60 * 1000),
    dwellResetMs: num('STAFF_DWELL_RESET_MS', 10 * 60 * 1000),
    baselineWindow: {
      start: str('BASELINE_WINDOW_START', '06:00'),
      end:   str('BASELINE_WINDOW_END', '07:00'),
    },
    baselineMultiplier: num('BASELINE_MULTIPLIER', 1.8),
  },

  dedup: {
    windowMs:              num('DEDUP_WINDOW_MS', 8_000),
    motionConfirmWindowMs: num('MOTION_CONFIRM_WINDOW_MS', 2_000),
    minDwellMs:            num('MIN_DWELL_MS', 3_000),
  },

  heartbeatTimeoutMs: num('HEARTBEAT_TIMEOUT_MS', 10 * 60 * 1000),
};

/** Parse "HH:MM" into minutes-since-midnight. */
export function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes-since-midnight for a Date, in IST (UTC+5:30). */
export function istMinutesOfDay(date) {
  const istMs = date.getTime() + (5 * 60 + 30) * 60 * 1000;
  const d = new Date(istMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Whether `date` falls within an IST [start, end) window, given as "HH:MM" strings. */
export function isWithinIstWindow(date, startHHMM, endHHMM) {
  const mins  = istMinutesOfDay(date);
  const start = parseHHMM(startHHMM);
  const end   = parseHHMM(endHHMM);
  return mins >= start && mins < end;
}

/** Truncate a Date down to the start of its UTC hour. */
export function hourBucketUtc(date) {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}
