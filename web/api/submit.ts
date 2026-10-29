// POST /api/submit: one opt-in rating session (blindpanel validates it and stores nothing personal).
import { handlers } from "./_lib.js";

export const POST = (req: Request) => handlers(process.env).submit(req);
