#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { createRecord, updateRecord, markDeleted, ApiClientError } from "./apiClient.js";

const server = new McpServer({ name: "kaartech-mena-digital-factory-mcp", version: "0.1.0" });

function json(result) {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

function errorResult(err) {
  const message = err instanceof ApiClientError ? err.message : `Unexpected error: ${err.message}`;
  return { content: [{ type: "text", text: message }], isError: true };
}

// Exported for tests — the type -> zod mapping is pure data logic
// (no network, no MCP transport) so it's tested directly rather than
// only indirectly through a live tool call.
export function fieldSchema(field) {
  let base;
  if (field.type === "enum") base = z.enum(field.values);
  else if (field.type === "number") base = z.number().finite();
  else if (field.type === "date") base = z.string().date();
  else base = z.string().min(1).max(field.maxLength ?? 255);
  return base.describe(`The ${field.label}.`);
}

const UPDATED_BY_DESCRIPTION =
  "Who is performing this change. Defaults to \"Arshad Gani\" if omitted.";

for (const table of MASTER_DATA_TABLES) {
  // add_ only requires fields the backend actually requires on create;
  // update_ always makes every field optional (only what's passed changes).
  const addFieldEntries = table.fields.map((f) => [
    f.key,
    f.required ? fieldSchema(f) : fieldSchema(f).optional(),
  ]);
  const updateFieldEntries = table.fields.map((f) => [f.key, fieldSchema(f).optional()]);

  server.tool(
    `add_${table.slug}`,
    `Add a new ${table.label} record to the master data table.` +
      (table.hasCode ? " A business code is generated automatically and never changes." : "") +
      " created_at/updated_at are set automatically, and created_by/updated_by" +
      " are set from updatedBy (or default to Arshad Gani).",
    {
      ...Object.fromEntries(addFieldEntries),
      updatedBy: z.string().min(1).optional().describe(UPDATED_BY_DESCRIPTION),
    },
    async (input) => {
      try {
        const { updatedBy, ...fields } = input;
        return json(await createRecord(table.route, { ...fields, updatedBy }));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    `update_${table.slug}`,
    `Modify an existing ${table.label} record. Only the fields you pass are changed. ` +
      "Bumps updated_at automatically; updated_by is set from updatedBy (or defaults to Arshad Gani).",
    {
      id: z.string().uuid().describe(`The ${table.label}'s id.`),
      ...Object.fromEntries(updateFieldEntries),
      updatedBy: z.string().min(1).optional().describe(UPDATED_BY_DESCRIPTION),
    },
    async ({ id, updatedBy, ...fields }) => {
      try {
        return json(await updateRecord(table.route, id, { ...fields, updatedBy }));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    `delete_${table.slug}`,
    `Mark a ${table.label} record as deleted (soft delete — sets deleted_at, does not remove the row).`,
    { id: z.string().uuid().describe(`The ${table.label}'s id.`) },
    async ({ id }) => {
      try {
        await markDeleted(table.route, id);
        return json({ id, deleted: true });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}

// Guarded so importing this module (e.g. from a test, to reach the pure
// fieldSchema()/MASTER_DATA_TABLES logic above) never starts a live stdio
// server as a side effect — only running it directly (`node src/index.js`,
// the "start" script) does.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await server.connect(new StdioServerTransport());
  console.error("[kaartech-mena-digital-factory-mcp] stdio server ready");
}
