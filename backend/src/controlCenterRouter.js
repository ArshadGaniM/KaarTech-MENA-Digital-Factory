import { Router } from "express";
import { pool } from "./db.js";
import { notFound } from "./errors.js";
import { buildControlCenter, buildTeamDetail, loadControlCenterRows } from "./controlCenter.js";

const HEARTBEAT_MS = 25_000;
const todayIso = () => new Date().toISOString().slice(0, 10);

// Read-only, like every GET in this API. `changeFeed` supplies the "changed"
// events the stream relays to open pages.
export function createControlCenterRouter({ query = (...args) => pool.query(...args), changeFeed, now = todayIso } = {}) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      res.json({ data: buildControlCenter({ ...(await loadControlCenterRows(query)), today: now() }) });
    } catch (err) {
      next(err);
    }
  });

  // Server-sent events: one "changed" message per burst of writes, plus a
  // comment line now and then so idle proxies keep the connection open.
  router.get("/stream", (req, res) => {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    res.write("retry: 5000\n\n");
    const unsubscribe = changeFeed ? changeFeed.onChange(() => res.write("event: changed\ndata: {}\n\n")) : () => {};
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), HEARTBEAT_MS);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  router.get("/teams/:code", async (req, res, next) => {
    try {
      const rows = await loadControlCenterRows(query);
      const team = rows.teams.find((t) => t.code === req.params.code);
      if (!team) throw notFound("team", req.params.code);
      const positions = rows.positions.filter((p) => p.teamCode === team.code);
      const positionCodes = new Set(positions.map((p) => p.code));
      res.json({
        data: buildTeamDetail({
          team,
          department: rows.departments.find((d) => d.code === team.departmentCode),
          positions,
          deployments: rows.deployments.filter((d) => positionCodes.has(d.positionCode)),
          allDeployments: rows.deployments,
          assignments: rows.assignments.filter((a) => a.teamCode === team.code),
          today: now(),
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
