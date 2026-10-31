import { EventEmitter } from "node:events";
import pg from "pg";

// Turns the database's NOTIFY signal (migration 0023) into "changed" events.
// It listens on its own connection because a pooled one cannot hold a
// LISTEN. A burst of writes becomes one event, and a dropped connection is
// reopened with a growing delay. Without the migration nothing is notified
// and the page falls back to its own timed refresh.
export const CHANNEL = "control_center_changed";
const DEBOUNCE_MS = 300;
const MAX_RETRY_MS = 30_000;

export function createChangeFeed({ connectionString = process.env.DATABASE_URL, ClientClass = pg.Client } = {}) {
  const emitter = new EventEmitter();
  let timer = null;
  let retryMs = 1000;
  let stopped = false;

  const notifyChanged = () => {
    clearTimeout(timer);
    timer = setTimeout(() => emitter.emit("changed"), DEBOUNCE_MS);
  };

  async function connect() {
    if (stopped || !connectionString) return;
    const client = new ClientClass({ connectionString, ssl: { rejectUnauthorized: false } });
    const reconnect = () => {
      if (stopped) return;
      setTimeout(connect, retryMs).unref();
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    };
    client.on("notification", notifyChanged);
    client.on("error", (err) => console.error("Change feed connection error:", err.message));
    client.on("end", reconnect);
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      retryMs = 1000;
    } catch (err) {
      console.error("Change feed could not start:", err.message);
      client.removeAllListeners("end");
      client.end().catch(() => {});
      reconnect();
    }
  }

  return {
    start: connect,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
    onChange(listener) {
      emitter.on("changed", listener);
      return () => emitter.off("changed", listener);
    },
  };
}
