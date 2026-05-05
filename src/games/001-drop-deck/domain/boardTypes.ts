export const BOARD_COLS = 8;
export const BOARD_ROWS = 16;
export const CENTER_COL = 4;

export type Cell = { readonly id: number } | null;

export type Board = readonly (readonly Cell[])[];
