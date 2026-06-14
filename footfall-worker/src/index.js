// ALIVE Footfall Worker — entrypoint.
//
// Subscribes to per-store MQTT topics published by the RuView (WiFi CSI)
// and ESPresense (BLE) nodes installed at each store, and runs the
// signal-fusion / staff-exclusion / dedup / screen-presence pipeline
// (pipeline.js) for every message.
//
// Deploy target: Railway (or any always-on Node host) — this is a
// persistent process, not a Vercel serverless function.

import { config } from './config.js';
import { connectMqtt } from './mqttClient.js';
import { getStore } from './storeCache.js';
import { handleRuviewEvent, handleBleDelta } from './pipeline.js';
import { handleHeartbeat } from './heartbeat.js';

const PREFIX = config.mqtt.topicPrefix;

// alive/<store_id>/<rest...>
const TOPIC_PATTERNS = [
  `${PREFIX}/+/retail/customer_flow`,
  `${PREFIX}/+/retail/shelf_interaction`,
  `${PREFIX}/+/retail/queue`,
  `${PREFIX}/+/device/ruview_heartbeat`,
  `${PREFIX}/+/ble/device_count`,
  `${PREFIX}/+/ble/delta`,
  `${PREFIX}/+/device/espresense_heartbeat`,
];

function parseTopic(topic) {
  const parts = topic.split('/');
  // alive / <storeId> / <a> / <b>
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  return { storeId: parts[1], a: parts[2], b: parts[3] };
}

async function onMessage(topic, payload) {
  const parsed = parseTopic(topic);
  if (!parsed) {
    console.warn(`[worker] unrecognized topic: ${topic}`);
    return;
  }
  const { storeId, a, b } = parsed;

  // Heartbeats and BLE counts don't need staff-exclusion zone info.
  if (a === 'device' && b === 'ruview_heartbeat')     return handleHeartbeat(storeId, 'ruview', payload);
  if (a === 'device' && b === 'espresense_heartbeat') return handleHeartbeat(storeId, 'espresense', payload);

  const store = await getStore(storeId);
  if (!store) {
    console.warn(`[worker] unknown store_id "${storeId}" on topic ${topic}`);
    return;
  }

  if (a === 'ble' && b === 'delta')         return handleBleDelta(store, payload);
  if (a === 'ble' && b === 'device_count')  return; // aggregate count only — not used by the pipeline directly
  if (a === 'retail')                       return handleRuviewEvent(store, payload);

  console.warn(`[worker] unhandled topic: ${topic}`);
}

const conn = connectMqtt(onMessage);
conn.subscribe(TOPIC_PATTERNS);

console.log('[worker] ALIVE footfall worker started');
console.log(`[worker] subscribed topics: ${TOPIC_PATTERNS.join(', ')}`);

process.on('SIGTERM', () => {
  console.log('[worker] shutting down');
  process.exit(0);
});
