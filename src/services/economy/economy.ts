import type { Economy, EconomyOptions } from "./index.ts";

export const createEconomy = async (
  _opts: EconomyOptions,
): Promise<Economy> => {
  await Promise.resolve();
  throw new Error("not implemented");
};
