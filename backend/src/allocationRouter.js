import { Router } from "express";
import { pool } from "./db.js";
import { validationError } from "./errors.js";
import { BUCKETS, loadAllocationSummary } from "./allocation.js";

const MAX_POSITION_LENGTH = 255;

// Read-only, like every GET in this API (reads are open, only writes need
// the internal key). Any query key other than bucket and position is
// rejected, so a typo in a filter name fails instead of being ignored and
// returning an unfiltered count.
export function createAllocationRouter({ query = (...args) => pool.query(...args) } = {}) {
  const router = Router();

  router.get("/summary", async (req, res, next) => {
    try {
      const details = {};
      for (const key of Object.keys(req.query)) {
        if (key !== "bucket" && key !== "position") details[key] = `${key} is not a valid filter. Use bucket or position.`;
      }
      const { bucket, position } = req.query;
      if (bucket !== undefined && !BUCKETS.includes(bucket)) {
        details.bucket = `bucket must be one of: ${BUCKETS.join(", ")}.`;
      }
      if (
        position !== undefined &&
        (typeof position !== "string" || position === "" || position.length > MAX_POSITION_LENGTH || position.includes("\0"))
      ) {
        details.position = `position must be a text of 1 to ${MAX_POSITION_LENGTH} characters.`;
      }
      if (Object.keys(details).length > 0) throw validationError(details);

      res.json({ data: await loadAllocationSummary(query, { bucket, position }) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
