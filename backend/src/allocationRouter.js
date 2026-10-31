import { Router } from "express";
import { pool } from "./db.js";
import { validationError } from "./errors.js";
import { BUCKETS, loadAllocationSummary } from "./allocation.js";

const MAX_POSITION_LENGTH = 255;
const MAX_KEY_SHOWN = 50;

// Read-only, like every GET in this API (reads are open, only writes need
// the internal key). Any query key other than bucket and position is
// rejected, so a typo in a filter name fails instead of being ignored and
// returning an unfiltered count.
export function createAllocationRouter({ query = (...args) => pool.query(...args) } = {}) {
  const router = Router();

  router.get("/summary", async (req, res, next) => {
    try {
      // Problems are collected as pairs and turned into the details object
      // last: assigning to a key named `__proto__` on a plain object is
      // silently dropped, which would let a bad request through. Express's
      // default parser removes that key, but a different parser setting
      // would not.
      const problems = [];
      for (const key of Object.keys(req.query)) {
        if (key !== "bucket" && key !== "position") {
          const shown = key.slice(0, MAX_KEY_SHOWN);
          problems.push([shown, `${shown} is not a valid filter. Use bucket or position.`]);
        }
      }
      const { bucket, position } = req.query;
      if (bucket !== undefined && !BUCKETS.includes(bucket)) {
        problems.push(["bucket", `bucket must be one of: ${BUCKETS.join(", ")}.`]);
      }
      if (
        position !== undefined &&
        (typeof position !== "string" || position === "" || position.length > MAX_POSITION_LENGTH || position.includes("\0"))
      ) {
        problems.push(["position", `position must be a text of 1 to ${MAX_POSITION_LENGTH} characters.`]);
      }
      if (problems.length > 0) throw validationError(Object.fromEntries(problems));

      res.json({ data: await loadAllocationSummary(query, { bucket, position }) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
