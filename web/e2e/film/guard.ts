// Film captures never reach an API: the tally gets an empty mock and anything else (a submission) is aborted
// and recorded, and the test fails on it. A film's rate flow can never opt in to the public tally.
import { expect, type Page } from "@playwright/test";
import { study } from "../rateFlow";

export async function guardApi(page: Page) {
  const blocked: string[] = [];
  await page.route((u) => u.pathname.startsWith("/api/"), (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === "/api/tally") return r.fulfill({ status: 200, json: { study: study.id, n_sessions: 0, items: {} } });
    blocked.push(`${r.request().method()} ${path}`);
    return r.abort();
  });
  return () => expect(blocked, "a film capture called an API other than the tally").toEqual([]);
}
