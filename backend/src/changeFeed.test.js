import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createChangeFeed, CHANNEL } from "./changeFeed.js";

class FakeClient extends EventEmitter {
  static instances = [];
  constructor() {
    super();
    this.queries = [];
    FakeClient.instances.push(this);
  }
  async connect() {}
  async query(sql) {
    this.queries.push(sql);
  }
  async end() {}
}

test("listens on the control-center channel and turns a burst of notifications into one event", async () => {
  FakeClient.instances = [];
  const feed = createChangeFeed({ connectionString: "postgres://x", ClientClass: FakeClient });
  let events = 0;
  feed.onChange(() => (events += 1));
  await feed.start();

  const client = FakeClient.instances[0];
  assert.deepEqual(client.queries, [`LISTEN ${CHANNEL}`]);
  client.emit("notification", {});
  client.emit("notification", {});
  client.emit("notification", {});
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(events, 1);
  feed.stop();
});

test("does nothing without a connection string", async () => {
  FakeClient.instances = [];
  const feed = createChangeFeed({ connectionString: undefined, ClientClass: FakeClient });
  await feed.start();
  assert.equal(FakeClient.instances.length, 0);
});

test("an unreachable database does not throw", async () => {
  class Failing extends FakeClient {
    async connect() {
      throw new Error("down");
    }
  }
  const feed = createChangeFeed({ connectionString: "postgres://x", ClientClass: Failing });
  await feed.start();
  feed.stop();
});
