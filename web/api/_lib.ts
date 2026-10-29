// Shared by the three Vercel functions. Files starting with "_" are not routes.
import { readFileSync } from "node:fs";
import { createKeepwarmHandler, createSubmitHandler, createTallyHandler, supabaseStore, type Store } from "blindpanel/server";
import type { Study } from "blindpanel";

type Env = Record<string, string | undefined>;
const SITE = "https://stilldrawn.studionephele.com";

/** The custom domain, plus this deployment's own origins on a preview (Vercel's system env). */
export function allowedOrigins(env: Env) {
  const own = env.VERCEL_ENV === "preview"
    ? [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean).map((h) => `https://${h}`)
    : [];
  return [SITE, ...own];
}

/** The study the page serves; vercel.json's includeFiles ships it with each function. */
export const loadStudy = (): Study =>
  JSON.parse(readFileSync(new URL("../public/data/blindpanel/stilldrawn/study.json", import.meta.url), "utf8"));

export function handlers(env: Env, store?: Store) {
  const study = loadStudy();
  if (!store) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    store = supabaseStore({ url: env.SUPABASE_URL, key: env.SUPABASE_SECRET_KEY });
  }
  return {
    submit: createSubmitHandler({ study, store, allowedOrigins: allowedOrigins(env) }),
    tally: createTallyHandler({ study, store }),
    keepwarm: createKeepwarmHandler({ store, secret: env.CRON_SECRET, study: study.id }),
  };
}
