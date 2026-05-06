export type Disposer = () => void;

export interface EconomyEvent {
  readonly gameId: string;
  readonly amount: number;
  readonly newBalance: number;
}

export interface Economy {
  getBalance(): number;
  addYield(gameId: string, amount: number): void;
  /** Deducts `amount` from the balance. Returns true if spent, false if insufficient funds. */
  spend(gameId: string, amount: number): boolean;
  subscribe(handler: (event: EconomyEvent) => void): Disposer;
}
