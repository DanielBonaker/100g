export type SoundId =
  | "dd-block-land"
  | "dd-row-clear"
  | "dd-impact-boom"
  | "dd-melt-splash"
  | "dd-rain-patter"
  | "dd-shop-ambient"
  | "kg-tap";

export interface Audio {
  enable(): Promise<void>;
  setMuted(muted: boolean): void;
  play(soundId: string): void;
  isMuted(): boolean;
}
