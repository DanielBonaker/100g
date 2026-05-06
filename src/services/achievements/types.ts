export type Disposer = () => void;

export interface AchievementEvent {
  readonly gameId: string;
  readonly achievementId: string;
  readonly unlockedAt: number; // ms epoch
}

export interface Achievements {
  unlock(gameId: string, achievementId: string): void;
  getUnlocked(gameId: string): readonly string[];
  isUnlocked(gameId: string, achievementId: string): boolean;
  subscribe(handler: (event: AchievementEvent) => void): Disposer;
}
