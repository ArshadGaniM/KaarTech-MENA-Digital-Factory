import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// End to end through the real MCP stdio server (the restore_<table> tools are
// registered inside a module-level loop in index.js, so they can't be reached
// by importing a function): spawn `node src/index.js` against a fake backend
// that records every request, then call tools over the protocol.

const ID = "11111111-1111-4111-8111-111111111111";
const INDEX = fileURLToPath(new URL("./index.js", import.meta.url));

let backend;
let requests;
let respond;
let client;

before(async () => {
  backend = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({
        method: req.method,
        url: req.url,
        key: req.headers["x-internal-api-key"],
        body: raw ? JSON.parse(raw) : undefined,
      });
      const { status, body } = respond();
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    });
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));

  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [INDEX],
      env: {
        PATH: process.env.PATH,
        BACKEND_URL: `http://127.0.0.1:${backend.address().port}`,
        INTERNAL_API_KEY: "test-secret",
      },
      stderr: "ignore",
    })
  );
});

after(async () => {
  await client.close();
  await new Promise((resolve) => backend.close(resolve));
});

function callTool(name, args) {
  requests = [];
  return client.callTool({ name, arguments: args });
}

test("a restore_<table> tool is registered for every table, alongside add/update/delete", async () => {
  const { tools } = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  for (const slug of ["practice", "department", "team", "resource_cost"]) {
    for (const verb of ["add", "update", "delete", "restore"]) {
      assert.ok(names.has(`${verb}_${slug}`), `${verb}_${slug} not registered`);
    }
  }
  assert.equal(tools.filter((t) => t.name.startsWith("restore_")).length, tools.filter((t) => t.name.startsWith("delete_")).length);
});

test("restore_department POSTs /v1/departments/:id/restore with the key header and updatedBy, and returns the row", async () => {
  respond = () => ({ status: 200, body: { data: { id: ID, name: "Design", markedDeleted: "No" } } });

  const result = await callTool("restore_department", { id: ID, updatedBy: "Aisha Al Marri" });

  assert.deepEqual(requests, [
    { method: "POST", url: `/v1/departments/${ID}/restore`, key: "test-secret", body: { updatedBy: "Aisha Al Marri" } },
  ]);
  assert.notEqual(result.isError, true);
  assert.equal(JSON.parse(result.content[0].text).markedDeleted, "No");
});

test("restore_team surfaces the backend's refusal as an error result (parent still deleted)", async () => {
  respond = () => ({
    status: 422,
    body: { error: { code: "validation_error", message: "Request failed validation.", details: { departmentCode: "gone" } } },
  });

  const result = await callTool("restore_team", { id: ID });

  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "Request failed validation.");
});

test("restore_team reports a 404 from the backend as an error result", async () => {
  respond = () => ({ status: 404, body: { error: { code: "team_not_found", message: "No team with that id." } } });

  const result = await callTool("restore_team", { id: ID });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /No team/);
});

test("restore_department rejects a non-uuid id at the schema layer without calling the backend", async () => {
  respond = () => {
    throw new Error("backend must not be reached");
  };

  const result = await callTool("restore_department", { id: "not-a-uuid" }).catch((err) => ({ isError: true, text: err.message }));

  assert.equal(result.isError, true);
  assert.deepEqual(requests, []);
});

test("add_department accepts input/output and forwards them; over-long values are rejected before any request", async () => {
  respond = () => ({ status: 201, body: { data: { id: ID } } });
  await callTool("add_department", { name: "Design", floorNumber: 10, input: "Briefs", output: "Mockups" });
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].body.input, "Briefs");
  assert.equal(requests[0].body.output, "Mockups");

  const tooLong = await callTool("add_department", { name: "Design", floorNumber: 10, output: "x".repeat(2001) }).catch((err) => ({
    isError: true,
    text: err.message,
  }));
  assert.equal(tooLong.isError, true);
  assert.deepEqual(requests, []);
});

test("add_department requires a whole floor number of at least 1, rejected before any request", async () => {
  for (const args of [{ name: "Design" }, { name: "Design", floorNumber: 2.5 }, { name: "Design", floorNumber: 0 }]) {
    const result = await callTool("add_department", args).catch((err) => ({ isError: true, text: err.message }));
    assert.equal(result.isError, true, JSON.stringify(args));
  }
  assert.deepEqual(requests, []);
});
