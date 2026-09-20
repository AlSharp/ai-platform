import path from "node:path";

import { SqliteJobRepository } from "./repository";

const dbPath =
  process.env.JOB_DB_PATH ??
  "./data/reasoning.db";

export const jobRepository =
  new SqliteJobRepository(
    path.resolve(dbPath),
  );