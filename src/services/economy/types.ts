export type Disposer = () => void;

export interface EconomyEvent {
  readonly gameId: string;
  readonly amount: number;
  readonly newBalance: number;
}

export interface Economy {
  getBalance(): number;
  addYield(gameId: string, amount: number): void;
  subscribe(handler: (event: EconomyEvent) => void): Disposer;
}
