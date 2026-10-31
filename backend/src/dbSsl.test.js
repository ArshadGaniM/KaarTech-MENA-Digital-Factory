import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSsl } from "./dbSsl.js";

test("without a CA the connection is encrypted but not verified, as before", () => {
  assert.deepEqual(dbSsl({}), { rejectUnauthorized: false });
  assert.deepEqual(dbSsl({ DATABASE_SSL_CA: "   " }), { rejectUnauthorized: false });
});

test("with a CA the server certificate is verified against it", () => {
  assert.deepEqual(dbSsl({ DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----" }), {
    ca: "-----BEGIN CERTIFICATE-----",
    rejectUnauthorized: true,
  });
});
