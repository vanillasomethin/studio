// HiveMQ Cloud connection (MQTT over TLS, port 8883).
//
// The `mqtt` package handles reconnection itself, but its default backoff
// is fixed-interval. We want exponential backoff capped at 5 minutes, so
// we manage reconnection manually: `reconnectPeriod: 0` disables the
// built-in retry and `connectMqtt` re-dials itself on `close`/`error`.

import mqtt from 'mqtt';
import { config } from './config.js';

/**
 * @param {(topic: string, payload: object) => void} onMessage
 * @returns {{ subscribe: (topics: string[]) => void }}
 */
export function connectMqtt(onMessage) {
  let client = null;
  let backoffMs = config.mqtt.reconnectMinMs;
  let subscribedTopics = [];

  function dial() {
    console.log(`[mqtt] connecting to ${config.mqtt.url}`);
    client = mqtt.connect(config.mqtt.url, {
      username: config.mqtt.username,
      password: config.mqtt.password,
      protocol: 'mqtts',
      reconnectPeriod: 0, // we drive reconnection ourselves (exponential backoff)
      connectTimeout: 15_000,
    });

    client.on('connect', () => {
      console.log('[mqtt] connected');
      backoffMs = config.mqtt.reconnectMinMs; // reset backoff on success
      if (subscribedTopics.length) {
        client.subscribe(subscribedTopics, (err) => {
          if (err) console.error('[mqtt] subscribe error', err);
          else console.log(`[mqtt] subscribed to ${subscribedTopics.length} topic(s)`);
        });
      }
    });

    client.on('message', (topic, payloadBuf) => {
      let payload;
      try {
        payload = JSON.parse(payloadBuf.toString('utf8'));
      } catch (e) {
        console.error(`[mqtt] invalid JSON on ${topic}:`, e.message);
        return;
      }
      try {
        onMessage(topic, payload);
      } catch (e) {
        console.error(`[mqtt] handler error for ${topic}:`, e);
      }
    });

    client.on('error', (err) => {
      console.error('[mqtt] error:', err.message);
    });

    client.on('close', () => {
      console.warn(`[mqtt] connection closed — reconnecting in ${Math.round(backoffMs / 1000)}s`);
      setTimeout(dial, backoffMs);
      backoffMs = Math.min(backoffMs * 2, config.mqtt.reconnectMaxMs);
    });
  }

  dial();

  return {
    subscribe(topics) {
      subscribedTopics = topics;
      if (client?.connected) {
        client.subscribe(topics, (err) => {
          if (err) console.error('[mqtt] subscribe error', err);
        });
      }
    },
  };
}
