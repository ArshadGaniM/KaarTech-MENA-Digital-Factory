import { test } from "node:test";
import assert from "node:assert/strict";
import { requireInternalApiKey } from "./auth.js";

function fakeReq(headerValue) {
  return { header: (name) => (name === "x-internal-api-key" ? headerValue : undefined) };
}

test("rejects when INTERNAL_API_KEY is not configured on the server", () => {
  delete process.env.INTERNAL_API_KEY;
  let calledWith;
  requireInternalApiKey(fakeReq("anything"), {}, (err) => { calledWith = err; });
  assert.equal(calledWith.status, 401);
  assert.equal(calledWith.code, "unauthorized");
});

test("rejects a missing header", () => {
  process.env.INTERNAL_API_KEY = "secret";
  let calledWith;
  requireInternalApiKey(fakeReq(undefined), {}, (err) => { calledWith = err; });
  assert.equal(calledWith.status, 401);
});

test("rejects a wrong header value", () => {
  process.env.INTERNAL_API_KEY = "secret";
  let calledWith;
  requireInternalApiKey(fakeReq("wrong"), {}, (err) => { calledWith = err; });
  assert.equal(calledWith.status, 401);
});

test("allows a matching header value", () => {
  process.env.INTERNAL_API_KEY = "secret";
  let calledWithNoArgs = false;
  requireInternalApiKey(fakeReq("secret"), {}, (err) => { calledWithNoArgs = err === undefined; });
  assert.equal(calledWithNoArgs, true);
});
