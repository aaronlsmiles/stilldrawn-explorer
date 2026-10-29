// GET /api/keepwarm: the daily cron's trivial query, so the free database is never paused.
import { handlers } from "./_lib.js";

export const GET = (req: Request) => handlers(process.env).keepwarm(req);
