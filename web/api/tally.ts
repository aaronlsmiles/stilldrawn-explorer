// GET /api/tally: the crowd's counts per clip, cached at the edge for five minutes.
import { handlers } from "./_lib.js";

export const GET = (req: Request) => handlers(process.env).tally(req);
