import pg from "pg";
import { dbSsl } from "./dbSsl.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: dbSsl(),
});
