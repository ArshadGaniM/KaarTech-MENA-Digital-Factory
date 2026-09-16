#!/usr/bin/env node
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

for (const table of MASTER_DATA_TABLES) {
  server.tool(
    `add_${table.slug}`,
    `Add a new ${table.label} record to the master data table. Sets created_at/updated_at automatically.`,
    { name: z.string().min(1).describe(`The ${table.label}'s name.`) },
    async ({ name }) => {
      try {
        return json(await createRecord(table.route, name));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    `update_${table.slug}`,
    `Modify an existing ${table.label} record's name. Bumps updated_at automatically.`,
    {
      id: z.string().uuid().describe(`The ${table.label}'s id.`),
      name: z.string().min(1).describe("The new name."),
    },
    async ({ id, name }) => {
      try {
        return json(await updateRecord(table.route, id, name));
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

await server.connect(new StdioServerTransport());
console.error("[kaartech-mena-digital-factory-mcp] stdio server ready");
