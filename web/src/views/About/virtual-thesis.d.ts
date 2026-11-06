declare module "virtual:thesis" {
  import type { Block } from "./thesisMd";
  export const finding: Block[];
  export const object: Block[];
  /** the /tax/masked write-up; null while MASKED-DRIFT.md is the placeholder */
  export const masked: Block[] | null;
}
