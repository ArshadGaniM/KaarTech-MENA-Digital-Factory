import { Router } from "express";
import { pool } from "../db.js";
import { notFound } from "../errors.js";
import { toResponse, validateBody } from "../teamMemberSchema.js";

export const teamMembersRouter = Router();

teamMembersRouter.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const [rows, count] = await Promise.all([
      pool.query(
        "select * from team_members order by full_name asc limit $1 offset $2",
        [limit, offset]
      ),
      pool.query("select count(*)::int as total from team_members"),
    ]);

    res.json({ data: rows.rows.map(toResponse), total: count.rows[0].total });
  } catch (err) {
    next(err);
  }
});

teamMembersRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("select * from team_members where id = $1", [req.params.id]);
    if (result.rows.length === 0) throw notFound("team_member", req.params.id);
    res.json({ data: toResponse(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

teamMembersRouter.post("/", async (req, res, next) => {
  try {
    validateBody(req.body);
    const { fullName, role = null, department = null, email = null, avatarUrl = null, status = "active" } = req.body;
    const result = await pool.query(
      `insert into team_members (full_name, role, department, email, avatar_url, status)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [fullName, role, department, email, avatarUrl, status]
    );
    res.status(201).json({ data: toResponse(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

teamMembersRouter.patch("/:id", async (req, res, next) => {
  try {
    validateBody(req.body, { partial: true });
    const existing = await pool.query("select * from team_members where id = $1", [req.params.id]);
    if (existing.rows.length === 0) throw notFound("team_member", req.params.id);

    const current = existing.rows[0];
    const merged = {
      full_name: req.body.fullName ?? current.full_name,
      role: req.body.role ?? current.role,
      department: req.body.department ?? current.department,
      email: req.body.email ?? current.email,
      avatar_url: req.body.avatarUrl ?? current.avatar_url,
      status: req.body.status ?? current.status,
    };

    const result = await pool.query(
      `update team_members set full_name = $1, role = $2, department = $3,
         email = $4, avatar_url = $5, status = $6
       where id = $7 returning *`,
      [merged.full_name, merged.role, merged.department, merged.email, merged.avatar_url, merged.status, req.params.id]
    );
    res.json({ data: toResponse(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

teamMembersRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("delete from team_members where id = $1 returning id", [req.params.id]);
    if (result.rows.length === 0) throw notFound("team_member", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
