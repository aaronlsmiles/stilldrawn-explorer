// Media resolve against VITE_MEDIA_BASE (dev: the local /media/ folder) or the contract's media host.
export const mediaBase = (contractBase: string): string => import.meta.env.VITE_MEDIA_BASE || contractBase;
export const mediaUrl = (contractBase: string, path: string) => mediaBase(contractBase) + path;
/** True when media come from the real host, so the full release (PNG originals, every clip) is there. */
export const isLiveHost = (contractBase: string) => mediaBase(contractBase) === contractBase;
