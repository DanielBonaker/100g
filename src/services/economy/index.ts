export type { Economy, EconomyEvent, Disposer } from "./types.ts";
export { createEconomy } from "./economy.ts";

import type { Persistence } from "../../engine/services.ts";

export interface EconomyOptions {
  readonly persistence: Persistence;
  readonly storageKey?: string; // default: 'economy'
}
