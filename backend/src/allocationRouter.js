import { Router } from "express";
import { pool } from "./db.js";
import { validationError } from "./errors.js";
import { BUCKETS, loadAllocationSummary } from "./allocation.js";

const MAX_POSITION_LENGTH = 255;
const MAX_KEY_SHOWN = 50;

// Read-only, like every GET in this API (reads are open, only writes need
// the internal key).
//
// The query string is read raw, not from `req.query`. Express's default
// parser silently removes a `__proto__` key, turns `a[b]=c` into an object
// and a repeated key into an array, and another parser setting would behave
// differently again. Reading it here means a typo or a hostile key in a
// filter name always fails with a 422 instead of being ignored and returning
// an unfiltered count, whatever the parser setting.
export function createAllocationRouter({ query = (...args) => pool.query(...args) } = {}) {
  const router = Router();

  router.get("/summary", async (req, res, next) => {
    try {
      const queryStart = req.url.indexOf("?");
      const raw = new URLSearchParams(queryStart === -1 ? "" : req.url.slice(queryStart + 1));

      // Problems are collected as pairs and turned into the details object
      // last: assigning to a key named `__proto__` on a plain object is
      // silently dropped.
      const problems = [];
      for (const key of new Set(raw.keys())) {
        const shown = key.slice(0, MAX_KEY_SHOWN);
        if (key !== "bucket" && key !== "position") {
          problems.push([shown, `${shown} is not a valid filter. Use bucket or position.`]);
        } else if (raw.getAll(key).length > 1) {
          problems.push([key, `${key} must be given once.`]);
        }
      }
      const bucket = raw.get("bucket") ?? undefined;
      const position = raw.get("position") ?? undefined;
      if (bucket !== undefined && !BUCKETS.includes(bucket)) {
        problems.push(["bucket", `bucket must be one of: ${BUCKETS.join(", ")}.`]);
      }
      if (position !== undefined && (position === "" || position.length > MAX_POSITION_LENGTH || position.includes("\0"))) {
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
