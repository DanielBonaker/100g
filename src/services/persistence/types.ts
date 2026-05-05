export interface SaveOptions {
  readonly debounceMs?: number;
}

export interface Persistence {
  save(key: string, value: unknown, opts?: SaveOptions): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
}
