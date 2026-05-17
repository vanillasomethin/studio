// Thin event bus for session-expiry signals.
// apiFetch emits when it sees 401; SessionExpiredModal listens.

const EVENT = 'alive:session-expired';

export function emitSessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function onSessionExpired(handler: () => void) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
