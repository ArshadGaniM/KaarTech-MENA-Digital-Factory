import { pool } from "./db.js";
import { recalculateAllModuleLeads } from "./moduleLeadAllocation.js";

// One-off: recomputes every Module Lead allocation (FEAT-43). Not run at startup.
const result = await recalculateAllModuleLeads(pool);
console.log(`Module Lead allocation: ${result.updated} rows updated for ${result.employees} people.`);
await pool.end();
