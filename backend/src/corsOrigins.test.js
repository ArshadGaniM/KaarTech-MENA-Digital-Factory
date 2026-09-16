import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAllowedOrigins } from "./corsOrigins.js";

test("parseAllowedOrigins falls back to '*' when unset", () => {
  assert.equal(parseAllowedOrigins(undefined), "*");
});

test("parseAllowedOrigins falls back to '*' for an empty string", () => {
  assert.equal(parseAllowedOrigins(""), "*");
});

test("parseAllowedOrigins falls back to '*' for a whitespace-only string", () => {
  assert.equal(parseAllowedOrigins("   "), "*");
});

test("parseAllowedOrigins returns a single origin as a one-element array", () => {
  assert.deepEqual(parseAllowedOrigins("https://a.example.com"), ["https://a.example.com"]);
});

test("parseAllowedOrigins splits and trims a comma-separated list", () => {
  assert.deepEqual(
    parseAllowedOrigins("https://a.example.com, https://b.example.com"),
    ["https://a.example.com", "https://b.example.com"],
  );
});

test("parseAllowedOrigins drops empty entries from stray/trailing commas", () => {
  assert.deepEqual(
    parseAllowedOrigins("https://a.example.com,,https://b.example.com,"),
    ["https://a.example.com", "https://b.example.com"],
  );
});
