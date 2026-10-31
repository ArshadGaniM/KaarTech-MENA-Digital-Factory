import { Router } from "express";
import { pool } from "./db.js";
import { notFound, validationError } from "./errors.js";
import { buildControlCenter, buildTeamDetail, isValidMonth, loadControlCenterRows } from "./controlCenter.js";

const HEARTBEAT_MS = 25_000;
const MAX_STREAMS = 100;
// Rows are shared between requests for a moment so a burst of open pages
// (all refetching after one change) costs one set of queries, not one each.
const ROWS_TTL_MS = 1000;
const currentMonth = () => new Date().toISOString().slice(0, 7);

// Read-only, like every GET in this API. `changeFeed` supplies the "changed"
// events the stream relays to open pages.
export function createControlCenterRouter({
  query = (...args) => pool.query(...args),
  changeFeed,
  now = currentMonth,
  maxStreams = MAX_STREAMS,
  rowsTtlMs = ROWS_TTL_MS,
} = {}) {
  const router = Router();

  let rows = null; // { promise, loadedAt }
  const loadRows = () => {
    if (rows && Date.now() - rows.loadedAt < rowsTtlMs) return rows.promise;
    const entry = { promise: loadControlCenterRows(query), loadedAt: Date.now() };
    entry.promise.catch(() => {
      if (rows === entry) rows = null; // never keep a failure
    });
    rows = entry;
    return entry.promise;
  };
  // A change makes the shared rows stale at once.
  changeFeed?.onChange(() => {
    rows = null;
  });

  // ?month=YYYY-MM picks the month the hours are measured in; it defaults
  // to the current one.
  const monthOf = (req) => {
    const month = req.query.month ?? now();
    if (!isValidMonth(month)) throw validationError({ month: "month must look like 2026-10." });
    return month;
  };

  router.get("/", async (req, res, next) => {
    try {
      const month = monthOf(req);
      res.json({ data: buildControlCenter({ ...(await loadRows()), month }) });
    } catch (err) {
      next(err);
    }
  });

  // Server-sent events: one "changed" message per burst of writes, plus a
  // comment line now and then so idle proxies keep the connection open. The
  // route is unauthenticated, so the number of open streams is capped.
  const streams = new Set();
  let heartbeat = null;
  const stopHeartbeatIfIdle = () => {
    if (streams.size === 0 && heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  router.get("/stream", (req, res) => {
    if (streams.size >= maxStreams) {
      res.status(503).json({ error: { code: "too_many_streams", message: "Too many open streams, retry shortly.", details: {} } });
      return;
    }
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    res.write("retry: 5000\n\n");

    const unsubscribe = changeFeed ? changeFeed.onChange(() => res.write("event: changed\ndata: {}\n\n")) : () => {};
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      unsubscribe();
      streams.delete(res);
      stopHeartbeatIfIdle();
    };
    streams.add(res);
    heartbeat ??= setInterval(() => streams.forEach((open) => open.write(": keep-alive\n\n")), HEARTBEAT_MS);
    req.on("close", cleanup);
    res.on("error", cleanup);
  });

  router.get("/teams/:code", async (req, res, next) => {
    try {
      const month = monthOf(req);
      const all = await loadRows();
      const team = all.teams.find((t) => t.code === req.params.code);
      if (!team) throw notFound("team", req.params.code);
      const positions = all.positions.filter((p) => p.teamCode === team.code);
      const positionCodes = new Set(positions.map((p) => p.code));
      res.json({
        data: buildTeamDetail({
          team,
          department: all.departments.find((d) => d.code === team.departmentCode),
          positions,
          deployments: all.deployments.filter((d) => positionCodes.has(d.positionCode)),
          allDeployments: all.deployments,
          assignments: all.assignments.filter((a) => a.teamCode === team.code),
          month,
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
